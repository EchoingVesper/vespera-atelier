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
    extract::State,
    http::StatusCode,
    response::Json,
    routing::post,
    Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tokio::net::TcpListener;
use tokio::sync::RwLock;
use tower::ServiceBuilder;
use tower_http::cors::CorsLayer;
use tracing::{info, warn};
use uuid::Uuid;
use vespera_bindery::database::{Database, TaskInput as DbTaskInput};

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
    pub task_id: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
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
        
        // Initialize database in .vespera folder
        let database_path = vespera_dir.join("tasks.db");
        eprintln!("Debug: Database path: {:?}", database_path);
        let database = Database::new(database_path).await?;
        
        // Initialize schema manually since sqlx migrations might not work
        database.init_schema().await?;
        
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

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing - for stdio mode, we'll configure it to write to stderr
    let args: Vec<String> = std::env::args().collect();
    let json_rpc_mode = args.iter().any(|arg| arg == "--json-rpc");
    
    if json_rpc_mode {
        // For JSON-RPC stdio mode, redirect all logs to stderr
        tracing_subscriber::fmt()
            .with_env_filter("vespera_bindery=debug,bindery_server=debug")
            .with_writer(std::io::stderr)
            .init();
        eprintln!("Starting Vespera Bindery Server v{}", vespera_bindery::VERSION);
    } else {
        // For HTTP mode, use normal stdout logging
        tracing_subscriber::fmt()
            .with_env_filter("vespera_bindery=debug,bindery_server=debug")
            .init();
        info!("Starting Vespera Bindery Server v{}", vespera_bindery::VERSION);
    }
    
    if json_rpc_mode {
        // JSON-RPC mode via stdin/stdout (for VS Code extension)
        run_json_rpc_stdio().await
    } else {
        // HTTP server mode (for web clients)
        run_http_server().await
    }
}

/// Run JSON-RPC server using stdin/stdout for VS Code extension
async fn run_json_rpc_stdio() -> Result<()> {
    // For stdio mode, log to stderr instead of stdout to avoid interfering with JSON-RPC
    eprintln!("Running in JSON-RPC stdio mode");
    
    let workspace_root = std::env::current_dir().context("Failed to get current directory")?;
    eprintln!("Debug: Current working directory: {:?}", workspace_root);
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

/// Run HTTP server for web clients
async fn run_http_server() -> Result<()> {
    info!("Running in HTTP server mode");
    
    let workspace_root = std::env::current_dir().context("Failed to get current directory")?;
    let state = Arc::new(AppState::new(workspace_root).await?);
    
    let app = Router::new()
        .route("/rpc", post(handle_http_json_rpc))
        .layer(
            ServiceBuilder::new()
                .layer(CorsLayer::permissive())
        )
        .with_state(state);
    
    let listener = TcpListener::bind("127.0.0.1:8080")
        .await
        .context("Failed to bind to address")?;
    
    info!("Server listening on http://127.0.0.1:8080");
    
    axum::serve(listener, app)
        .await
        .context("Server error")?;
    
    Ok(())
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
    
    let input: TaskUpdateInput = serde_json::from_value(update_input.clone())
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
    let codices = state.codices.read().await;
    let codex_ids: Vec<String> = codices.keys().cloned().collect();
    Ok(serde_json::to_value(codex_ids).map_err(|e| e.to_string())?)
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
    
    let codex_id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    
    let codex = json!({
        "id": codex_id,
        "title": title,
        "template_id": template_id,
        "created_at": now,
        "updated_at": now
    });
    
    let mut codices = state.codices.write().await;
    codices.insert(codex_id.clone(), codex);
    
    Ok(json!(codex_id))
}

async fn handle_get_codex(state: &AppState, params: &Option<Value>) -> Result<Value, String> {
    let codex_id = params
        .as_ref()
        .and_then(|p| p.get("codex_id"))
        .and_then(|v| v.as_str())
        .ok_or("Missing codex_id parameter")?;
    
    let codices = state.codices.read().await;
    match codices.get(codex_id) {
        Some(codex) => Ok(codex.clone()),
        None => Err("Codex not found".to_string()),
    }
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