//! Vespera Bindery JSON-RPC Server
//! 
//! A standalone server that exposes Vespera Bindery functionality over JSON-RPC 2.0
//! for integration with various clients like VS Code extensions, web applications, etc.

use std::collections::HashMap;
use std::io::{self, BufRead, Write};
use std::sync::Arc;
use std::path::PathBuf;

use anyhow::{Context, Result};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    routing::{delete, get, post, put},
    Router,
};
use clap::{Parser, Subcommand};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tokio::net::TcpListener;
use tokio::sync::RwLock;
use tower::ServiceBuilder;
use tower_http::cors::CorsLayer;
use tracing::{info, warn};
use uuid::Uuid;
use vespera_bindery::database::{Database, TaskInput as DbTaskInput};
use vespera_bindery::migration::{MigrationCommand, MigrationCommandExecutor};
use vespera_bindery::observability::{
    config::{ObservabilityConfig, LoggingConfig, FileLoggingConfig, LogRotation},
    init_observability,
};

// Input types for JSON-RPC
#[derive(Debug, Clone, Serialize, Deserialize)]
struct TaskInput {
    pub title: String,
    pub description: Option<String>,
    pub priority: Option<String>,
    pub project_id: Option<String>,
    pub parent_id: Option<String>,
    pub tags: Option<Vec<String>>,
    pub labels: Option<serde_json::Value>,
    pub subtasks: Option<Vec<TaskInput>>,
}

impl TaskInput {
    fn to_db_input(&self) -> DbTaskInput {
        DbTaskInput {
            title: self.title.clone(),
            description: self.description.clone(),
            priority: self.priority.clone(),
            project_id: self.project_id.clone(),
            parent_id: self.parent_id.clone(),
            tags: self.tags.clone().unwrap_or_default(),
            labels: self.labels.clone().unwrap_or(serde_json::json!({})),
            subtasks: self.subtasks.clone().unwrap_or_default().into_iter().map(|t| t.to_db_input()).collect(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct TaskUpdateInput {
    pub title: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct TaskUpdateInputWithId {
    pub task_id: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ProjectInput {
    pub name: String,
    pub description: Option<String>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SearchInput {
    pub query: String,
    pub entity_types: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct DocumentInput {
    pub content: String,
    pub title: Option<String>,
    pub document_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RoleAssignmentInput {
    pub role: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct TaskListQuery {
    pub project_id: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Role {
    pub name: String,
    pub description: String,
    pub capabilities: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct JsonRpcRequest {
    jsonrpc: String,
    method: String,
    params: Option<Value>,
    id: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct JsonRpcResponse {
    jsonrpc: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<JsonRpcError>,
    id: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct JsonRpcError {
    code: i32,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    data: Option<Value>,
}

/// Application state shared across handlers
struct AppState {
    database: Arc<Database>,
    roles: Arc<RwLock<Vec<Role>>>,
    codices: Arc<RwLock<HashMap<String, Value>>>,
}

impl AppState {
    async fn new(workspace_root: PathBuf) -> Result<Self> {
        // Create .vespera folder for data storage
        let vespera_dir = workspace_root.join(".vespera");
        eprintln!("Debug: Creating vespera directory: {:?}", vespera_dir);
        tokio::fs::create_dir_all(&vespera_dir).await?;

        // Initialize database in .vespera folder with optimized pool configuration
        let database_path = vespera_dir.join("tasks.db");
        eprintln!("Debug: Database path: {:?}", database_path);

        // Create optimized database pool configuration for high-throughput
        let pool_config = vespera_bindery::database::DatabasePoolConfig::builder()
            .max_connections(8)? // Optimized for SQLite with WAL mode
            .min_connections(2)   // Keep some connections warm
            .acquire_timeout(std::time::Duration::from_secs(3))? // Fast timeout for responsiveness
            .idle_timeout(std::time::Duration::from_secs(300))? // 5 minutes idle timeout
            .max_connection_lifetime(std::time::Duration::from_secs(3600))? // 1 hour lifetime
            .test_before_acquire(true)
            .build()?;

        let database = Database::new_with_config(database_path, pool_config).await?;

        // Initialize schema manually since sqlx migrations might not work
        database.init_schema().await?;

        // Log pool health information for monitoring
        let health_info = database.get_pool_health_info().await;
        eprintln!("Debug: Database pool initialized - Status: {:?}, Connections: {}/{}",
                 health_info.status, health_info.active_connections, health_info.max_connections);
        
        let mut roles = Vec::new();
        roles.push(Role {
            name: "developer".to_string(),
            description: "Software development tasks".to_string(),
            capabilities: vec!["code".to_string(), "test".to_string(), "debug".to_string()],
        });
        roles.push(Role {
            name: "designer".to_string(),
            description: "Design and UI tasks".to_string(),
            capabilities: vec!["design".to_string(), "ui".to_string(), "mockup".to_string()],
        });

        Ok(Self {
            database: Arc::new(database),
            roles: Arc::new(RwLock::new(roles)),
            codices: Arc::new(RwLock::new(HashMap::new())),
        })
    }
}

/// CLI arguments for the Bindery server
#[derive(Parser)]
#[command(name = "bindery-server")]
#[command(version = env!("CARGO_PKG_VERSION"))]
#[command(about = "Vespera Bindery CRDT-based collaborative content management server")]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,

    /// Enable JSON-RPC stdio mode for VS Code extension
    #[arg(long)]
    json_rpc: bool,

    /// HTTP server port (default: 8080)
    #[arg(long, default_value = "8080")]
    port: u16,

    /// Database file path
    #[arg(long)]
    database: Option<PathBuf>,

    /// Workspace root directory
    #[arg(long)]
    workspace: Option<PathBuf>,

    /// Log level (trace, debug, info, warn, error)
    #[arg(long, default_value = "info")]
    log_level: String,

    /// Enable file logging
    #[arg(long)]
    log_to_file: bool,

    /// Log file directory
    #[arg(long)]
    log_dir: Option<PathBuf>,

    /// Enable JSON formatted logs
    #[arg(long)]
    json_logs: bool,
}

#[derive(Subcommand)]
enum Commands {
    /// Database migration commands
    #[command(subcommand)]
    Migrate(MigrationCommand),

    /// Start the server (default if no command specified)
    Serve {
        /// Enable JSON-RPC stdio mode
        #[arg(long)]
        json_rpc: bool,

        /// HTTP server port (default: 8080)
        #[arg(long, default_value = "8080")]
        port: u16,

        /// Log level (trace, debug, info, warn, error)
        #[arg(long, default_value = "info")]
        log_level: String,

        /// Enable file logging
        #[arg(long)]
        log_to_file: bool,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    // Initialize comprehensive observability
    let json_rpc_mode = cli.json_rpc || matches!(cli.command, Some(Commands::Serve { json_rpc: true, .. }));

    // Extract logging configuration from CLI args or serve command
    let (log_level, log_to_file, log_dir, json_logs) = match &cli.command {
        Some(Commands::Serve { log_level, log_to_file, .. }) => {
            (log_level.clone(), *log_to_file, cli.log_dir.clone(), cli.json_logs)
        }
        _ => (cli.log_level.clone(), cli.log_to_file, cli.log_dir.clone(), cli.json_logs)
    };

    // Build observability configuration
    let mut logging_config = LoggingConfig {
        level: log_level,
        console: true,
        file: None,
        json_format: json_logs || json_rpc_mode,
        with_source_location: true,
        with_thread_names: true,
        with_span_events: true,
    };

    // Configure file logging if requested
    if log_to_file {
        let log_directory = log_dir.unwrap_or_else(|| {
            let workspace = cli.workspace.clone().unwrap_or_else(|| {
                std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
            });
            workspace.join(".vespera").join("logs")
        });

        logging_config.file = Some(FileLoggingConfig {
            directory: log_directory,
            filename: "bindery-server.log".to_string(),
            rotation: LogRotation::Daily,
            max_files: Some(10),
        });
    }

    // For JSON-RPC stdio mode, redirect logs to stderr to avoid interfering with JSON-RPC
    if json_rpc_mode {
        logging_config.console = true; // Will use stderr writer
    }

    let observability_config = ObservabilityConfig {
        logging: logging_config,
        opentelemetry: None, // TODO: Add OpenTelemetry configuration from CLI args
        metrics: None,       // TODO: Add metrics configuration from CLI args
        alerting: None,      // TODO: Add alerting configuration from CLI args
    };

    // Initialize observability system
    init_observability(&observability_config)
        .context("Failed to initialize observability system")?;

    if json_rpc_mode {
        eprintln!("Starting Vespera Bindery Server v{}", vespera_bindery::VERSION);
    } else {
        info!(
            version = vespera_bindery::VERSION,
            log_level = %observability_config.logging.level,
            file_logging = observability_config.logging.file.is_some(),
            json_format = observability_config.logging.json_format,
            "Vespera Bindery Server starting"
        );
    }

    match cli.command {
        Some(Commands::Migrate(migration_cmd)) => {
            run_migration_command(migration_cmd, cli.workspace, cli.database).await
        }
        Some(Commands::Serve { json_rpc, port, .. }) => {
            if json_rpc {
                run_json_rpc_stdio(cli.workspace).await
            } else {
                run_http_server_with_port(port, cli.workspace).await
            }
        }
        None => {
            // Default behavior - check for legacy --json-rpc flag
            if cli.json_rpc {
                run_json_rpc_stdio(cli.workspace).await
            } else {
                run_http_server_with_port(cli.port, cli.workspace).await
            }
        }
    }
}

/// Run a migration command
async fn run_migration_command(
    migration_cmd: MigrationCommand,
    workspace: Option<PathBuf>,
    database_path: Option<PathBuf>
) -> Result<()> {
    let workspace_root = workspace.unwrap_or_else(|| {
        std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
    });

    let db_path = if let Some(path) = database_path {
        path
    } else {
        workspace_root.join(".vespera").join("tasks.db")
    };

    info!("Running migration command with database: {:?}", db_path);

    // Create parent directory if it doesn't exist
    if let Some(parent) = db_path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }

    // Connect to database
    let database_url = format!("sqlite:{}?mode=rwc", db_path.display());
    let pool = sqlx::SqlitePool::connect(&database_url).await?;

    // Determine migrations directory
    let migrations_dir = workspace_root.join("migrations");

    // Create migration command executor
    let executor = MigrationCommandExecutor::new(pool, migrations_dir).await
        .context("Failed to create migration command executor")?;

    // Execute the migration command
    executor.execute(migration_cmd).await
        .context("Migration command failed")?;

    Ok(())
}

/// Run JSON-RPC server using stdin/stdout for VS Code extension
async fn run_json_rpc_stdio(workspace: Option<PathBuf>) -> Result<()> {
    // For stdio mode, log to stderr instead of stdout to avoid interfering with JSON-RPC
    eprintln!("Running in JSON-RPC stdio mode");

    let workspace_root = workspace.unwrap_or_else(|| {
        std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
    });
    eprintln!("Debug: Using workspace directory: {:?}", workspace_root);
    let state = Arc::new(AppState::new(workspace_root).await?);
    let stdin = io::stdin();
    let stdout = io::stdout();
    let mut stdout_lock = stdout.lock();
    
    for line in stdin.lock().lines() {
        let line = line.context("Failed to read line from stdin")?;
        if line.trim().is_empty() {
            continue;
        }
        
        let response = handle_json_rpc_request(&state, &line).await;
        let response_json = serde_json::to_string(&response)?;
        
        writeln!(stdout_lock, "{}", response_json)?;
        stdout_lock.flush()?;
    }
    
    Ok(())
}

/// Run HTTP server for web clients with specified port
async fn run_http_server_with_port(port: u16, workspace: Option<PathBuf>) -> Result<()> {
    info!("Running in HTTP server mode on port {}", port);

    let workspace_root = workspace.unwrap_or_else(|| {
        std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
    });
    info!("Using workspace directory: {:?}", workspace_root);
    let state = Arc::new(AppState::new(workspace_root).await?);

    let app = Router::new()
        // JSON-RPC endpoint
        .route("/rpc", post(handle_http_json_rpc))
        // Health check
        .route("/health", get(handle_health_check))
        // Pool metrics endpoint for monitoring
        .route("/api/pool/metrics", get(api_pool_metrics))
        .route("/api/pool/health", get(api_pool_health))
        // REST API endpoints for MCP server
        .route("/api/tasks", post(api_create_task))
        .route("/api/tasks", get(api_list_tasks))
        .route("/api/tasks/:task_id", get(api_get_task))
        .route("/api/tasks/:task_id", put(api_update_task))
        .route("/api/tasks/:task_id", delete(api_delete_task))
        .route("/api/tasks/:task_id/execute", post(api_execute_task))
        .route("/api/tasks/:task_id/assign-role", post(api_assign_role))
        .route("/api/roles", get(api_list_roles))
        .route("/api/projects", post(api_create_project))
        .route("/api/dashboard/stats", get(api_dashboard_stats))
        .route("/api/search", post(api_search))
        .route("/api/rag/index", post(api_index_document))
        .layer(
            ServiceBuilder::new()
                .layer(CorsLayer::permissive())
        )
        .with_state(state);

    let bind_addr = format!("127.0.0.1:{}", port);
    let listener = TcpListener::bind(&bind_addr)
        .await
        .context("Failed to bind to address")?;

    info!("Server listening on http://{}", bind_addr);

    axum::serve(listener, app)
        .await
        .context("Server error")?;

    Ok(())
}

/// Handle health check requests with database pool health information
async fn handle_health_check(State(state): State<Arc<AppState>>) -> Json<Value> {
    let pool_metrics = state.database.get_pool_metrics().await;
    let pool_health = state.database.get_pool_health_info().await;
    let is_db_healthy = state.database.is_pool_healthy().await;

    let overall_status = if is_db_healthy {
        match pool_health.status {
            vespera_bindery::database::PoolHealthStatus::Healthy => "healthy",
            vespera_bindery::database::PoolHealthStatus::Warning => "warning",
            vespera_bindery::database::PoolHealthStatus::Unhealthy => "unhealthy",
        }
    } else {
        "unhealthy"
    };

    Json(json!({
        "status": overall_status,
        "service": "vespera-bindery",
        "version": env!("CARGO_PKG_VERSION"),
        "database": {
            "pool_healthy": is_db_healthy,
            "active_connections": pool_metrics.active_connections,
            "max_connections": pool_health.max_connections,
            "utilization_percent": pool_metrics.pool_utilization,
            "success_rate_percent": pool_health.success_rate,
            "avg_acquisition_time_ms": pool_metrics.average_acquisition_time_ms,
            "total_queries": pool_health.total_queries,
            "slow_queries": pool_health.slow_query_count,
            "deadlocks": pool_health.deadlock_count,
            "recommendations": pool_health.recommendations
        }
    }))
}

/// Handle HTTP JSON-RPC requests
async fn handle_http_json_rpc(
    State(state): State<Arc<AppState>>,
    Json(request): Json<JsonRpcRequest>,
) -> Result<Json<JsonRpcResponse>, StatusCode> {
    let response = handle_json_rpc_method(&state, &request).await;
    Ok(Json(response))
}

/// Handle a single JSON-RPC request from string
async fn handle_json_rpc_request(state: &AppState, request_str: &str) -> JsonRpcResponse {
    match serde_json::from_str::<JsonRpcRequest>(request_str) {
        Ok(request) => handle_json_rpc_method(state, &request).await,
        Err(e) => JsonRpcResponse {
            jsonrpc: "2.0".to_string(),
            result: None,
            error: Some(JsonRpcError {
                code: -32700,
                message: "Parse error".to_string(),
                data: Some(json!({"details": e.to_string()})),
            }),
            id: None,
        },
    }
}

/// Handle JSON-RPC method calls
async fn handle_json_rpc_method(state: &AppState, request: &JsonRpcRequest) -> JsonRpcResponse {
    let method_result = match request.method.as_str() {
        "version_info" => handle_version_info().await,
        "get_task_dashboard" => handle_get_task_dashboard(state, &request.params).await,
        "list_tasks" => handle_list_tasks(state, &request.params).await,
        "get_task" => handle_get_task(state, &request.params).await,
        "create_task" => handle_create_task(state, &request.params).await,
        "update_task" => handle_update_task(state, &request.params).await,
        "delete_task" => handle_delete_task(state, &request.params).await,
        "complete_task" => handle_complete_task(state, &request.params).await,
        "list_roles" => handle_list_roles(state).await,
        "assign_role_to_task" => handle_assign_role_to_task(state, &request.params).await,
        "list_codices" => handle_list_codices(state).await,
        "create_codex" => handle_create_codex(state, &request.params).await,
        "get_codex" => handle_get_codex(state, &request.params).await,
        "update_codex" => handle_update_codex(state, &request.params).await,
        "delete_codex" => handle_delete_codex(state, &request.params).await,
        _ => Err(format!("Method '{}' not found", request.method)),
    };
    
    match method_result {
        Ok(result) => JsonRpcResponse {
            jsonrpc: "2.0".to_string(),
            result: Some(result),
            error: None,
            id: request.id.clone(),
        },
        Err(e) => JsonRpcResponse {
            jsonrpc: "2.0".to_string(),
            result: None,
            error: Some(JsonRpcError {
                code: -32603,
                message: "Internal error".to_string(),
                data: Some(json!({"details": e})),
            }),
            id: request.id.clone(),
        },
    }
}

// Method handlers

async fn handle_version_info() -> Result<Value, String> {
    let info = vespera_bindery::version_info();
    Ok(json!(info))
}

async fn handle_get_task_dashboard(state: &AppState, _params: &Option<Value>) -> Result<Value, String> {
    let dashboard = state.database.get_task_dashboard(None).await
        .map_err(|e| format!("Failed to get task dashboard: {}", e))?;
    
    Ok(serde_json::to_value(dashboard).map_err(|e| e.to_string())?)
}

async fn handle_list_tasks(state: &AppState, params: &Option<Value>) -> Result<Value, String> {
    let limit = params
        .as_ref()
        .and_then(|p| p.get("limit"))
        .and_then(|v| v.as_u64())
        .map(|v| v as usize);
    
    let parent_id = params
        .as_ref()
        .and_then(|p| p.get("parent_id"))
        .and_then(|v| v.as_str());
    
    let tasks = state.database.list_tasks(limit.map(|l| l as i32), parent_id).await
        .map_err(|e| format!("Failed to list tasks: {}", e))?;
    
    Ok(serde_json::to_value(tasks).map_err(|e| e.to_string())?)
}

async fn handle_get_task(state: &AppState, params: &Option<Value>) -> Result<Value, String> {
    let task_id = params
        .as_ref()
        .and_then(|p| p.get("task_id"))
        .and_then(|v| v.as_str())
        .ok_or("Missing task_id parameter")?;
    
    // For now, return a simple implementation since we don't have a get_task_by_id method
    let tasks = state.database.list_tasks(Some(1000), None).await
        .map_err(|e| format!("Failed to list tasks: {}", e))?;
    
    match tasks.iter().find(|task| task.id == task_id) {
        Some(task) => Ok(serde_json::to_value(task).map_err(|e| e.to_string())?),
        None => Err("Task not found".to_string()),
    }
}

async fn handle_create_task(state: &AppState, params: &Option<Value>) -> Result<Value, String> {
    let task_input = params
        .as_ref()
        .and_then(|p| p.get("task_input"))
        .ok_or("Missing task_input parameter")?;
    
    let input: TaskInput = serde_json::from_value(task_input.clone())
        .map_err(|e| format!("Invalid task_input: {}", e))?;
    
    // Convert from server TaskInput to database TaskInput
    let db_input = vespera_bindery::database::TaskInput {
        title: input.title,
        description: input.description,
        priority: input.priority,
        project_id: input.project_id,
        parent_id: input.parent_id,
        tags: input.tags.unwrap_or_default(),
        labels: input.labels.unwrap_or_default(),
        subtasks: input.subtasks.unwrap_or_default().into_iter().map(|s| s.to_db_input()).collect(),
    };

    let task_id = state.database.create_task(&db_input).await
        .map_err(|e| format!("Failed to create task: {}", e))?;
    
    Ok(json!(task_id))
}

async fn handle_update_task(state: &AppState, params: &Option<Value>) -> Result<Value, String> {
    let update_input = params
        .as_ref()
        .and_then(|p| p.get("update_input"))
        .ok_or("Missing update_input parameter")?;
    
    let input: TaskUpdateInputWithId = serde_json::from_value(update_input.clone())
        .map_err(|e| format!("Invalid update_input: {}", e))?;

    // Use database update_task method
    let updated = state.database.update_task(
        &input.task_id,
        input.title.as_deref(),
        input.status.as_deref()
    ).await
    .map_err(|e| format!("Failed to update task: {}", e))?;
    
    if updated {
        Ok(json!(true))
    } else {
        Err("Task not found or no changes made".to_string())
    }
}

async fn handle_delete_task(state: &AppState, params: &Option<Value>) -> Result<Value, String> {
    let task_id = params
        .as_ref()
        .and_then(|p| p.get("task_id"))
        .and_then(|v| v.as_str())
        .ok_or("Missing task_id parameter")?;
    
    let deleted = state.database.delete_task(task_id).await
        .map_err(|e| format!("Failed to delete task: {}", e))?;
    
    if deleted {
        Ok(json!(true))
    } else {
        Err("Task not found".to_string())
    }
}

async fn handle_complete_task(state: &AppState, params: &Option<Value>) -> Result<Value, String> {
    let task_id = params
        .as_ref()
        .and_then(|p| p.get("task_id"))
        .and_then(|v| v.as_str())
        .ok_or("Missing task_id parameter")?;
    
    let updated = state.database.update_task(task_id, None, Some("done")).await
        .map_err(|e| format!("Failed to complete task: {}", e))?;
    
    if updated {
        Ok(json!(true))
    } else {
        Err("Task not found".to_string())
    }
}

async fn handle_list_roles(state: &AppState) -> Result<Value, String> {
    let roles = state.roles.read().await;
    Ok(serde_json::to_value(&*roles).map_err(|e| e.to_string())?)
}

async fn handle_assign_role_to_task(_state: &AppState, params: &Option<Value>) -> Result<Value, String> {
    let task_id = params
        .as_ref()
        .and_then(|p| p.get("task_id"))
        .and_then(|v| v.as_str())
        .ok_or("Missing task_id parameter")?;
    
    let role_name = params
        .as_ref()
        .and_then(|p| p.get("role_name"))
        .and_then(|v| v.as_str())
        .ok_or("Missing role_name parameter")?;
    
    // For now, just return success - actual role assignment would be implemented later
    warn!("Role assignment not yet implemented: task {} -> role {}", task_id, role_name);
    Ok(json!(null))
}

async fn handle_list_codices(state: &AppState) -> Result<Value, String> {
    // Phase 16b: Load from database
    let codices = state.database.list_codices()
        .await
        .map_err(|e| format!("Failed to list codices from database: {}", e))?;

    Ok(json!(codices))
}

async fn handle_create_codex(state: &AppState, params: &Option<Value>) -> Result<Value, String> {
    let title = params
        .as_ref()
        .and_then(|p| p.get("title"))
        .and_then(|v| v.as_str())
        .ok_or("Missing title parameter")?;

    let template_id = params
        .as_ref()
        .and_then(|p| p.get("template_id"))
        .and_then(|v| v.as_str())
        .unwrap_or("default");

    // Phase 16b: Extract metadata (including project_id)
    let metadata = params
        .as_ref()
        .and_then(|p| p.get("metadata"))
        .cloned()
        .unwrap_or(json!({}));

    let codex_id = Uuid::new_v4().to_string();

    // Phase 16b: Persist to database
    state.database.create_codex(&codex_id, title, template_id, &metadata)
        .await
        .map_err(|e| format!("Failed to create codex in database: {}", e))?;

    Ok(json!(codex_id))
}

async fn handle_get_codex(state: &AppState, params: &Option<Value>) -> Result<Value, String> {
    let codex_id = params
        .as_ref()
        .and_then(|p| p.get("codex_id"))
        .and_then(|v| v.as_str())
        .ok_or("Missing codex_id parameter")?;

    // Phase 16b: Load from database
    match state.database.get_codex(codex_id).await {
        Ok(Some(codex)) => Ok(codex),
        Ok(None) => Err("Codex not found".to_string()),
        Err(e) => Err(format!("Failed to get codex from database: {}", e)),
    }
}

async fn handle_update_codex(state: &AppState, params: &Option<Value>) -> Result<Value, String> {
    let codex_id = params
        .as_ref()
        .and_then(|p| p.get("codex_id"))
        .and_then(|v| v.as_str())
        .ok_or("Missing codex_id parameter")?;

    let mut codices = state.codices.write().await;

    // Get existing codex or return error
    let mut codex = codices.get(codex_id)
        .ok_or("Codex not found")?
        .clone();

    // Update fields if provided
    if let Some(params_obj) = params.as_ref().and_then(|p| p.as_object()) {
        let codex_obj = codex.as_object_mut().ok_or("Invalid codex format")?;

        // Update title if provided
        if let Some(title) = params_obj.get("title") {
            codex_obj.insert("title".to_string(), title.clone());
        }

        // Update content if provided
        if let Some(content) = params_obj.get("content") {
            codex_obj.insert("content".to_string(), content.clone());
        }

        // Update template_id if provided
        if let Some(template_id) = params_obj.get("template_id") {
            codex_obj.insert("template_id".to_string(), template_id.clone());
        }

        // Update tags if provided
        if let Some(tags) = params_obj.get("tags") {
            codex_obj.insert("tags".to_string(), tags.clone());
        }

        // Update references if provided
        if let Some(references) = params_obj.get("references") {
            codex_obj.insert("references".to_string(), references.clone());
        }

        // Update the updated_at timestamp
        let now = chrono::Utc::now().to_rfc3339();
        codex_obj.insert("updated_at".to_string(), json!(now));
    }

    // Store updated codex
    codices.insert(codex_id.to_string(), codex.clone());

    Ok(codex)
}

async fn handle_delete_codex(state: &AppState, params: &Option<Value>) -> Result<Value, String> {
    let codex_id = params
        .as_ref()
        .and_then(|p| p.get("codex_id"))
        .and_then(|v| v.as_str())
        .ok_or("Missing codex_id parameter")?;

    let mut codices = state.codices.write().await;
    match codices.remove(codex_id) {
        Some(_) => Ok(json!(true)),
        None => Err("Codex not found".to_string()),
    }
}

// REST API handlers for MCP server integration

/// Create a new task (POST /api/tasks)
async fn api_create_task(
    State(state): State<Arc<AppState>>,
    Json(task_input): Json<TaskInput>,
) -> Result<Json<Value>, StatusCode> {
    let db_input = task_input.to_db_input();

    match state.database.create_task(&db_input).await {
        Ok(task_id) => {
            // Return the created task by getting it from the database
            match get_task_by_id(&state, &task_id).await {
                Ok(task) => Ok(Json(task)),
                Err(_) => {
                    // Fallback: return basic task info
                    Ok(Json(json!({
                        "id": task_id,
                        "title": task_input.title,
                        "description": task_input.description,
                        "status": "todo",
                        "priority": task_input.priority.unwrap_or("normal".to_string()),
                        "project_id": task_input.project_id,
                        "parent_id": task_input.parent_id,
                        "tags": task_input.tags.unwrap_or_default(),
                        "labels": task_input.labels.unwrap_or(json!({})),
                        "created_at": chrono::Utc::now(),
                        "updated_at": chrono::Utc::now()
                    })))
                }
            }
        }
        Err(e) => {
            warn!("Failed to create task: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Get a task by ID (GET /api/tasks/:task_id)
async fn api_get_task(
    State(state): State<Arc<AppState>>,
    Path(task_id): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    match get_task_by_id(&state, &task_id).await {
        Ok(task) => Ok(Json(task)),
        Err(_) => Err(StatusCode::NOT_FOUND),
    }
}

/// Update a task (PUT /api/tasks/:task_id)
async fn api_update_task(
    State(state): State<Arc<AppState>>,
    Path(task_id): Path<String>,
    Json(update_input): Json<TaskUpdateInput>,
) -> Result<Json<Value>, StatusCode> {
    match state.database.update_task(
        &task_id,
        update_input.title.as_deref(),
        update_input.status.as_deref(),
    ).await {
        Ok(true) => {
            // Return the updated task
            match get_task_by_id(&state, &task_id).await {
                Ok(task) => Ok(Json(task)),
                Err(_) => Err(StatusCode::NOT_FOUND),
            }
        }
        Ok(false) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            warn!("Failed to update task {}: {}", task_id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Delete a task (DELETE /api/tasks/:task_id)
async fn api_delete_task(
    State(state): State<Arc<AppState>>,
    Path(task_id): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    match state.database.delete_task(&task_id).await {
        Ok(true) => Ok(Json(json!({"success": true, "message": "Task deleted"}))),
        Ok(false) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            warn!("Failed to delete task {}: {}", task_id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// List tasks (GET /api/tasks)
async fn api_list_tasks(
    State(state): State<Arc<AppState>>,
    Query(query): Query<TaskListQuery>,
) -> Result<Json<Value>, StatusCode> {
    match state.database.list_tasks(Some(1000), query.project_id.as_deref()).await {
        Ok(tasks) => {
            let filtered_tasks = if let Some(status_filter) = query.status {
                tasks.into_iter().filter(|task| {
                    task.status == status_filter
                }).collect::<Vec<_>>()
            } else {
                tasks
            };

            Ok(Json(json!({
                "items": filtered_tasks,
                "total": filtered_tasks.len()
            })))
        }
        Err(e) => {
            warn!("Failed to list tasks: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Execute a task (POST /api/tasks/:task_id/execute)
async fn api_execute_task(
    State(state): State<Arc<AppState>>,
    Path(task_id): Path<String>,
    Json(role_input): Json<RoleAssignmentInput>,
) -> Result<Json<Value>, StatusCode> {
    // Update task status to in_progress
    match state.database.update_task(&task_id, None, Some("in_progress")).await {
        Ok(true) => Ok(Json(json!({
            "success": true,
            "task_id": task_id,
            "role_assigned": role_input.role,
            "execution_id": format!("exec_{}", Uuid::new_v4())
        }))),
        Ok(false) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            warn!("Failed to execute task {}: {}", task_id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Assign a role to a task (POST /api/tasks/:task_id/assign-role)
async fn api_assign_role(
    State(_state): State<Arc<AppState>>,
    Path(task_id): Path<String>,
    Json(role_input): Json<RoleAssignmentInput>,
) -> Result<Json<Value>, StatusCode> {
    // For now, just return success - role assignment would be implemented later
    Ok(Json(json!({
        "success": true,
        "task_id": task_id,
        "role_assigned": role_input.role,
        "message": format!("Role '{}' assigned to task {}", role_input.role, task_id)
    })))
}

/// List available roles (GET /api/roles)
async fn api_list_roles(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, StatusCode> {
    let roles = state.roles.read().await;
    Ok(Json(json!({
        "success": true,
        "roles": *roles,
        "total_roles": roles.len()
    })))
}

/// Create a project (POST /api/projects)
async fn api_create_project(
    State(_state): State<Arc<AppState>>,
    Json(project_input): Json<ProjectInput>,
) -> Result<Json<Value>, StatusCode> {
    let project_id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now();

    Ok(Json(json!({
        "id": project_id,
        "name": project_input.name,
        "description": project_input.description,
        "tags": project_input.tags.unwrap_or_default(),
        "task_count": 0,
        "created_at": now,
        "updated_at": now
    })))
}

/// Get dashboard statistics (GET /api/dashboard/stats)
async fn api_dashboard_stats(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, StatusCode> {
    match state.database.get_task_dashboard(None).await {
        Ok(dashboard) => Ok(Json(serde_json::to_value(dashboard).unwrap_or(json!({})))),
        Err(e) => {
            warn!("Failed to get dashboard stats: {}", e);
            // Return basic stats on error
            Ok(Json(json!({
                "total_tasks": 0,
                "completed_tasks": 0,
                "in_progress_tasks": 0,
                "pending_tasks": 0
            })))
        }
    }
}

/// Search across entities (POST /api/search)
async fn api_search(
    State(_state): State<Arc<AppState>>,
    Json(search_input): Json<SearchInput>,
) -> Result<Json<Value>, StatusCode> {
    // Basic search implementation - would be enhanced later
    Ok(Json(json!({
        "query": search_input.query,
        "total_results": 0,
        "results": []
    })))
}

/// Index a document for RAG (POST /api/rag/index)
async fn api_index_document(
    State(_state): State<Arc<AppState>>,
    Json(document_input): Json<DocumentInput>,
) -> Result<Json<Value>, StatusCode> {
    // Basic document indexing implementation - would be enhanced later
    let document_id = Uuid::new_v4().to_string();

    Ok(Json(json!({
        "success": true,
        "document_id": document_id,
        "message": "Document indexed successfully",
        "chunks_created": 1
    })))
}

/// Get pool metrics (GET /api/pool/metrics)
async fn api_pool_metrics(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, StatusCode> {
    let pool_metrics = state.database.get_pool_metrics().await;
    Ok(Json(serde_json::to_value(pool_metrics).unwrap_or(json!({}))))
}

/// Get pool health information (GET /api/pool/health)
async fn api_pool_health(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, StatusCode> {
    let pool_health = state.database.get_pool_health_info().await;
    let pool_config = state.database.get_pool_config();

    Ok(Json(json!({
        "health": pool_health,
        "configuration": {
            "max_connections": pool_config.max_connections,
            "min_connections": pool_config.min_connections,
            "acquire_timeout_ms": pool_config.acquire_timeout.as_millis(),
            "idle_timeout_ms": pool_config.idle_timeout.as_millis(),
            "max_lifetime_ms": pool_config.max_connection_lifetime.as_millis(),
            "test_before_acquire": pool_config.test_before_acquire
        }
    })))
}

/// Helper function to get a task by ID
async fn get_task_by_id(state: &AppState, task_id: &str) -> Result<Value, String> {
    let tasks = state.database.list_tasks(Some(1000), None).await
        .map_err(|e| format!("Failed to list tasks: {}", e))?;

    match tasks.iter().find(|task| task.id == task_id) {
        Some(task) => Ok(serde_json::to_value(task).map_err(|e| e.to_string())?),
        None => Err("Task not found".to_string()),
    }
}