//! Database persistence module for Vespera Bindery
//! 
//! Provides SQLite persistence for tasks, roles, and other data structures

use std::path::Path;
use std::time::Duration;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use sqlx::{sqlite::{SqlitePool, SqlitePoolOptions}, Pool, Sqlite, Row};
use chrono::{DateTime, Utc};
use uuid::Uuid;
use crate::migration::MigrationManager;
// TODO: Add observability when dependencies are resolved
// use crate::observability::{
//     instrumentation::DatabaseInstrumentation,
//     metrics::BinderyMetrics,
//     instrument,
// };
use tracing::{info, warn, error, debug, instrument};
use std::collections::VecDeque;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use tokio::time::Instant;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskSummary {
    pub id: String,
    pub title: String,
    pub status: String,
    pub priority: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub parent_id: Option<String>,
    pub child_count: i64,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskInput {
    pub title: String,
    pub description: Option<String>,
    pub priority: Option<String>,
    pub project_id: Option<String>,
    pub parent_id: Option<String>,
    pub tags: Vec<String>,
    pub labels: serde_json::Value,
    pub subtasks: Vec<TaskInput>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskDashboard {
    pub total_tasks: i64,
    pub status_breakdown: serde_json::Value,
    pub priority_breakdown: serde_json::Value,
    pub recent_tasks: Vec<TaskSummary>,
    pub overdue_tasks: Vec<TaskSummary>,
    pub upcoming_tasks: Vec<TaskSummary>,
    pub project_breakdown: serde_json::Value,
    pub completion_rate: f64,
    pub average_completion_time: Option<f64>,
}

/// Connection pool configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabasePoolConfig {
    /// Maximum number of connections in the pool
    pub max_connections: u32,
    /// Minimum number of connections in the pool
    pub min_connections: u32,
    /// Maximum lifetime of a connection before it's closed
    pub max_connection_lifetime: Duration,
    /// Time to wait for a connection before timing out
    pub acquire_timeout: Duration,
    /// Maximum time a connection can be idle before being closed
    pub idle_timeout: Duration,
    /// Whether to enable connection testing on acquire
    pub test_before_acquire: bool,
}

impl Default for DatabasePoolConfig {
    fn default() -> Self {
        Self {
            max_connections: 20,
            min_connections: 2,
            max_connection_lifetime: Duration::from_secs(30 * 60), // 30 minutes
            acquire_timeout: Duration::from_secs(10),
            idle_timeout: Duration::from_secs(10 * 60), // 10 minutes
            test_before_acquire: true,
        }
    }
}

impl DatabasePoolConfig {
    /// Validate the database pool configuration
    pub fn validate(&self) -> Result<(), crate::BinderyError> {
        // Validate connection counts
        if self.max_connections == 0 {
            return Err(crate::BinderyError::ConfigurationError(
                "max_connections must be greater than 0".to_string()
            ));
        }

        if self.min_connections > self.max_connections {
            return Err(crate::BinderyError::ConfigurationError(
                format!(
                    "min_connections ({}) cannot be greater than max_connections ({})",
                    self.min_connections, self.max_connections
                )
            ));
        }

        // Validate timeouts
        if self.acquire_timeout.as_secs() == 0 {
            return Err(crate::BinderyError::ConfigurationError(
                "acquire_timeout must be greater than 0 seconds".to_string()
            ));
        }

        if self.acquire_timeout > Duration::from_secs(300) {
            return Err(crate::BinderyError::ConfigurationError(
                "acquire_timeout should not exceed 5 minutes (300 seconds) for responsiveness".to_string()
            ));
        }

        if self.idle_timeout.as_secs() < 60 {
            return Err(crate::BinderyError::ConfigurationError(
                "idle_timeout should be at least 60 seconds to avoid connection churn".to_string()
            ));
        }

        if self.max_connection_lifetime.as_secs() < 300 {
            return Err(crate::BinderyError::ConfigurationError(
                "max_connection_lifetime should be at least 5 minutes (300 seconds)".to_string()
            ));
        }

        // Validate reasonable upper bounds
        if self.max_connections > 1000 {
            return Err(crate::BinderyError::ConfigurationError(
                "max_connections should not exceed 1000 for performance reasons".to_string()
            ));
        }

        Ok(())
    }

    /// Create a new configuration with validation
    pub fn new() -> Result<Self, crate::BinderyError> {
        let config = Self::default();
        config.validate()?;
        Ok(config)
    }

    /// Builder pattern for safe configuration construction
    pub fn builder() -> DatabasePoolConfigBuilder {
        DatabasePoolConfigBuilder::new()
    }

    /// Set connection limits with validation
    pub fn with_connections(mut self, min: u32, max: u32) -> Result<Self, crate::BinderyError> {
        if max == 0 {
            return Err(crate::BinderyError::ConfigurationError(
                "max_connections must be greater than 0".to_string()
            ));
        }

        if min > max {
            return Err(crate::BinderyError::ConfigurationError(
                format!(
                    "min_connections ({}) cannot be greater than max_connections ({})",
                    min, max
                )
            ));
        }

        self.min_connections = min;
        self.max_connections = max;
        Ok(self)
    }

    /// Set timeouts with validation
    pub fn with_timeouts(
        mut self,
        acquire_timeout: Duration,
        idle_timeout: Duration,
        max_lifetime: Duration
    ) -> Result<Self, crate::BinderyError> {
        if acquire_timeout.as_secs() == 0 {
            return Err(crate::BinderyError::ConfigurationError(
                "acquire_timeout must be greater than 0 seconds".to_string()
            ));
        }

        if idle_timeout.as_secs() < 60 {
            return Err(crate::BinderyError::ConfigurationError(
                "idle_timeout should be at least 60 seconds".to_string()
            ));
        }

        if max_lifetime.as_secs() < 300 {
            return Err(crate::BinderyError::ConfigurationError(
                "max_connection_lifetime should be at least 5 minutes".to_string()
            ));
        }

        self.acquire_timeout = acquire_timeout;
        self.idle_timeout = idle_timeout;
        self.max_connection_lifetime = max_lifetime;
        Ok(self)
    }

    /// Enable or disable connection testing
    pub fn with_connection_testing(mut self, enabled: bool) -> Self {
        self.test_before_acquire = enabled;
        self
    }
}

/// Builder for DatabasePoolConfig with validation
#[derive(Debug, Default)]
pub struct DatabasePoolConfigBuilder {
    max_connections: Option<u32>,
    min_connections: Option<u32>,
    max_connection_lifetime: Option<Duration>,
    acquire_timeout: Option<Duration>,
    idle_timeout: Option<Duration>,
    test_before_acquire: Option<bool>,
}

impl DatabasePoolConfigBuilder {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn max_connections(mut self, max: u32) -> Result<Self, crate::BinderyError> {
        if max == 0 {
            return Err(crate::BinderyError::ConfigurationError(
                "max_connections must be greater than 0".to_string()
            ));
        }

        if max > 1000 {
            return Err(crate::BinderyError::ConfigurationError(
                "max_connections should not exceed 1000 for performance reasons".to_string()
            ));
        }

        self.max_connections = Some(max);
        Ok(self)
    }

    pub fn min_connections(mut self, min: u32) -> Self {
        self.min_connections = Some(min);
        self
    }

    pub fn acquire_timeout(mut self, timeout: Duration) -> Result<Self, crate::BinderyError> {
        if timeout.as_secs() == 0 {
            return Err(crate::BinderyError::ConfigurationError(
                "acquire_timeout must be greater than 0 seconds".to_string()
            ));
        }

        if timeout > Duration::from_secs(300) {
            return Err(crate::BinderyError::ConfigurationError(
                "acquire_timeout should not exceed 5 minutes for responsiveness".to_string()
            ));
        }

        self.acquire_timeout = Some(timeout);
        Ok(self)
    }

    pub fn idle_timeout(mut self, timeout: Duration) -> Result<Self, crate::BinderyError> {
        if timeout.as_secs() < 60 {
            return Err(crate::BinderyError::ConfigurationError(
                "idle_timeout should be at least 60 seconds to avoid connection churn".to_string()
            ));
        }

        self.idle_timeout = Some(timeout);
        Ok(self)
    }

    pub fn max_connection_lifetime(mut self, lifetime: Duration) -> Result<Self, crate::BinderyError> {
        if lifetime.as_secs() < 300 {
            return Err(crate::BinderyError::ConfigurationError(
                "max_connection_lifetime should be at least 5 minutes".to_string()
            ));
        }

        self.max_connection_lifetime = Some(lifetime);
        Ok(self)
    }

    pub fn test_before_acquire(mut self, enabled: bool) -> Self {
        self.test_before_acquire = Some(enabled);
        self
    }

    pub fn build(self) -> Result<DatabasePoolConfig, crate::BinderyError> {
        let max_connections = self.max_connections.unwrap_or(20);
        let min_connections = self.min_connections.unwrap_or(2);

        // Validate min/max relationship
        if min_connections > max_connections {
            return Err(crate::BinderyError::ConfigurationError(
                format!(
                    "min_connections ({}) cannot be greater than max_connections ({})",
                    min_connections, max_connections
                )
            ));
        }

        let config = DatabasePoolConfig {
            max_connections,
            min_connections,
            max_connection_lifetime: self.max_connection_lifetime.unwrap_or(Duration::from_secs(30 * 60)),
            acquire_timeout: self.acquire_timeout.unwrap_or(Duration::from_secs(10)),
            idle_timeout: self.idle_timeout.unwrap_or(Duration::from_secs(10 * 60)),
            test_before_acquire: self.test_before_acquire.unwrap_or(true),
        };

        config.validate()?;
        Ok(config)
    }
}

/// Pool metrics for monitoring
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoolMetrics {
    pub active_connections: u32,
    pub idle_connections: u32,
    pub total_connections: u32,
    pub total_acquired: u64,
    pub total_acquisition_failures: u64,
    pub average_acquisition_time_ms: f64,
    pub pool_utilization: f64,
}

/// Query performance metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryPerformanceMetrics {
    pub slow_queries: Vec<SlowQueryInfo>,
    pub total_queries: u64,
    pub avg_query_duration_ms: f64,
    pub queries_over_threshold: u64,
    pub deadlocks_detected: u64,
    pub cache_hit_rate: f64,
}

/// Information about slow queries
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlowQueryInfo {
    pub query: String,
    pub duration_ms: u64,
    pub timestamp: DateTime<Utc>,
    pub affected_rows: i64,
    pub query_type: QueryType,
}

/// Type of database query
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum QueryType {
    Select,
    Insert,
    Update,
    Delete,
    Create,
    Drop,
    Other(String),
}

/// Database maintenance configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaintenanceConfig {
    /// Enable automatic VACUUM operations
    pub auto_vacuum_enabled: bool,
    /// Interval between VACUUM operations (in hours)
    pub vacuum_interval_hours: u64,
    /// Enable automatic ANALYZE operations
    pub auto_analyze_enabled: bool,
    /// Interval between ANALYZE operations (in hours)
    pub analyze_interval_hours: u64,
    /// Enable automatic index optimization
    pub auto_optimize_indices: bool,
    /// Threshold for triggering index rebuilds (fragmentation %)
    pub index_fragmentation_threshold: f64,
}

impl Default for MaintenanceConfig {
    fn default() -> Self {
        Self {
            auto_vacuum_enabled: true,
            vacuum_interval_hours: 24, // Daily vacuum
            auto_analyze_enabled: true,
            analyze_interval_hours: 6, // Every 6 hours
            auto_optimize_indices: true,
            index_fragmentation_threshold: 30.0, // 30% fragmentation
        }
    }
}

/// Database manager for Vespera Bindery data persistence
pub struct Database {
    pool: Pool<Sqlite>,
    config: DatabasePoolConfig,
    // Metrics tracking
    total_acquired: Arc<AtomicU64>,
    total_acquisition_failures: Arc<AtomicU64>,
    acquisition_times: Arc<tokio::sync::Mutex<Vec<Duration>>>,
    // Query performance tracking
    slow_queries: Arc<tokio::sync::Mutex<VecDeque<SlowQueryInfo>>>,
    total_queries: Arc<AtomicU64>,
    queries_over_threshold: Arc<AtomicU64>,
    deadlocks_detected: Arc<AtomicU64>,
    // Maintenance tracking
    maintenance_config: MaintenanceConfig,
    last_vacuum: Arc<tokio::sync::Mutex<Option<DateTime<Utc>>>>,
    last_analyze: Arc<tokio::sync::Mutex<Option<DateTime<Utc>>>>,
}

impl Database {
    /// Create a new database instance with default pool configuration
    pub async fn new(database_path: impl AsRef<Path>) -> Result<Self> {
        Self::new_with_config(database_path, DatabasePoolConfig::default()).await
    }

    /// Create a new database instance with custom pool configuration
    #[instrument(skip(database_path, config), fields(
        database_path = %database_path.as_ref().display(),
        max_connections = config.max_connections,
        min_connections = config.min_connections
    ))]
    pub async fn new_with_config(
        database_path: impl AsRef<Path>,
        config: DatabasePoolConfig
    ) -> Result<Self> {
        // Validate configuration before proceeding
        config.validate().map_err(|e| anyhow::anyhow!("Database pool configuration validation failed: {}", e))?;
        let database_url = format!("sqlite:{}?mode=rwc", database_path.as_ref().display());
        info!("Initializing database with pool config: {}", database_url);
        debug!("Pool configuration: max_connections={}, min_connections={}, acquire_timeout={:?}",
               config.max_connections, config.min_connections, config.acquire_timeout);

        // Create parent directory if it doesn't exist
        if let Some(parent) = database_path.as_ref().parent() {
            info!("Ensuring parent directory exists: {:?}", parent);
            tokio::fs::create_dir_all(parent).await?;
        }

        info!("Creating connection pool...");
        let pool = SqlitePoolOptions::new()
            .max_connections(config.max_connections)
            .min_connections(config.min_connections)
            .max_lifetime(Some(config.max_connection_lifetime))
            .acquire_timeout(config.acquire_timeout)
            .idle_timeout(Some(config.idle_timeout))
            .test_before_acquire(config.test_before_acquire)
            .after_connect(|mut conn, _meta| {
                Box::pin(async move {
                    // Enable WAL mode for better concurrency
                    sqlx::query("PRAGMA journal_mode = WAL")
                        .execute(&mut *conn)
                        .await?;
                    // Set synchronous mode for performance
                    sqlx::query("PRAGMA synchronous = NORMAL")
                        .execute(&mut *conn)
                        .await?;
                    // Enable foreign key constraints
                    sqlx::query("PRAGMA foreign_keys = ON")
                        .execute(&mut *conn)
                        .await?;
                    Ok(())
                })
            })
            .connect(&database_url)
            .await?;

        info!("Database connection pool created successfully with {} max connections!", config.max_connections);

        // Initialize with migration system
        let database = Self {
            pool: pool.clone(),
            config,
            total_acquired: Arc::new(AtomicU64::new(0)),
            total_acquisition_failures: Arc::new(AtomicU64::new(0)),
            acquisition_times: Arc::new(tokio::sync::Mutex::new(Vec::new())),
            slow_queries: Arc::new(tokio::sync::Mutex::new(VecDeque::new())),
            total_queries: Arc::new(AtomicU64::new(0)),
            queries_over_threshold: Arc::new(AtomicU64::new(0)),
            deadlocks_detected: Arc::new(AtomicU64::new(0)),
            maintenance_config: MaintenanceConfig::default(),
            last_vacuum: Arc::new(tokio::sync::Mutex::new(None)),
            last_analyze: Arc::new(tokio::sync::Mutex::new(None)),
        };
        database.run_migrations().await?;

        Ok(database)
    }

    /// Run database migrations automatically on startup
    async fn run_migrations(&self) -> Result<()> {
        info!("Running database migrations...");

        // Determine migrations directory path
        let migrations_dir = std::env::current_dir()
            .unwrap_or_else(|_| std::path::PathBuf::from("."))
            .join("migrations");

        if !migrations_dir.exists() {
            warn!("Migrations directory not found at {:?}, using fallback schema initialization", migrations_dir);
            self.init_schema().await?;
            return Ok(());
        }

        match MigrationManager::new(self.pool.clone(), &migrations_dir).await {
            Ok(migration_manager) => {
                let status = migration_manager.get_status().await?;

                if status.pending_count > 0 {
                    info!("Found {} pending migrations, applying them...", status.pending_count);

                    let results = migration_manager.migrate_up(None).await?;
                    let successful_count = results.iter().filter(|r| r.success).count();
                    let failed_count = results.len() - successful_count;

                    if failed_count > 0 {
                        error!("Migration failed: {} successful, {} failed", successful_count, failed_count);
                        for result in &results {
                            if !result.success {
                                error!("Migration {} failed: {}", result.version,
                                    result.error_message.as_deref().unwrap_or("Unknown error"));
                            }
                        }
                        return Err(anyhow::anyhow!("Database migration failed"));
                    } else {
                        info!("Successfully applied {} migrations", successful_count);
                    }
                } else {
                    info!("Database schema is up to date (version {})", status.current_version);
                }

                // Validate migration checksums
                let checksum_errors = migration_manager.validate_checksums().await?;
                if !checksum_errors.is_empty() {
                    warn!("Found {} migration checksum mismatches:", checksum_errors.len());
                    for (version, error) in checksum_errors {
                        warn!("  Migration {}: {}", version, error);
                    }
                }
            }
            Err(e) => {
                warn!("Failed to initialize migration manager: {}, using fallback schema initialization", e);
                self.init_schema().await?;
            }
        }

        Ok(())
    }
    
    /// Create a new database instance with in-memory SQLite (for testing)
    pub async fn new_in_memory() -> Result<Self> {
        let config = DatabasePoolConfig {
            max_connections: 5, // Smaller pool for testing
            min_connections: 1,
            ..Default::default()
        };

        let pool = SqlitePoolOptions::new()
            .max_connections(config.max_connections)
            .min_connections(config.min_connections)
            .connect("sqlite::memory:")
            .await?;

        sqlx::migrate!("./migrations").run(&pool).await?;

        Ok(Self {
            pool,
            config,
            total_acquired: Arc::new(AtomicU64::new(0)),
            total_acquisition_failures: Arc::new(AtomicU64::new(0)),
            acquisition_times: Arc::new(tokio::sync::Mutex::new(Vec::new())),
            slow_queries: Arc::new(tokio::sync::Mutex::new(VecDeque::new())),
            total_queries: Arc::new(AtomicU64::new(0)),
            queries_over_threshold: Arc::new(AtomicU64::new(0)),
            deadlocks_detected: Arc::new(AtomicU64::new(0)),
            maintenance_config: MaintenanceConfig::default(),
            last_vacuum: Arc::new(tokio::sync::Mutex::new(None)),
            last_analyze: Arc::new(tokio::sync::Mutex::new(None)),
        })
    }
    
    /// Initialize the database schema manually (fallback if migrations don't work)
    pub async fn init_schema(&self) -> Result<()> {
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                status TEXT NOT NULL DEFAULT 'todo',
                priority TEXT NOT NULL DEFAULT 'normal',
                parent_id TEXT,
                project_id TEXT,
                assignee TEXT,
                tags TEXT, -- JSON array of strings
                labels TEXT, -- JSON object
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                due_date TEXT,
                FOREIGN KEY(parent_id) REFERENCES tasks(id) ON DELETE CASCADE
            );
            
            CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
            CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
            CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_id);
            CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks(created_at);
            "#
        ).execute(&self.pool).await?;
        
        Ok(())
    }
    
    /// Create a new task with pool metrics tracking
    #[instrument(skip(self, input), fields(
        task_title = %input.title,
        parent_id = ?input.parent_id,
        subtask_count = input.subtasks.len()
    ))]
    pub async fn create_task(&self, input: &TaskInput) -> Result<String> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now();
        let tags_json = serde_json::to_string(&input.tags)?;
        let labels_json = serde_json::to_string(&input.labels)?;

        info!(
            task_id = %id,
            task_title = %input.title,
            priority = input.priority.as_deref().unwrap_or("normal"),
            "Creating new task"
        );

        // Execute with connection acquisition tracking and instrumentation
        let query = r#"
            INSERT INTO tasks (id, title, description, priority, parent_id, project_id, tags, labels, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
        "#;

        let _result = self.execute_with_metrics(async {
            sqlx::query(query)
                .bind(&id)
                .bind(&input.title)
                .bind(&input.description)
                .bind(input.priority.as_deref().unwrap_or("normal"))
                .bind(&input.parent_id)
                .bind(&input.project_id)
                .bind(&tags_json)
                .bind(&labels_json)
                .bind(now.to_rfc3339())
                .bind(now.to_rfc3339())
                .execute(&self.pool).await
        }).await?;

        // Create subtasks recursively using Box::pin for async recursion
        for subtask in &input.subtasks {
            let mut subtask_input = subtask.clone();
            subtask_input.parent_id = Some(id.clone());
            Box::pin(self.create_task(&subtask_input)).await?;
        }

        Ok(id)
    }
    
    /// List tasks with optional filtering and pool metrics tracking
    // Instrumentation removed for compilation
    pub async fn list_tasks(&self, limit: Option<i32>, parent_id: Option<&str>) -> Result<Vec<TaskSummary>> {
        let limit_clause = limit.map(|l| format!("LIMIT {}", l)).unwrap_or_default();

        // Add parent_id filtering if provided
        let parent_filter = match parent_id {
            Some(pid) => format!("WHERE t.parent_id = '{}'", pid),
            None => "WHERE t.parent_id IS NULL".to_string(), // Only show root tasks if no parent_id specified
        };

        let query = format!(
            r#"
            SELECT
                t.id, t.title, t.status, t.priority, t.created_at, t.updated_at, t.parent_id, t.tags,
                COALESCE(child_counts.child_count, 0) as child_count
            FROM tasks t
            LEFT JOIN (
                SELECT parent_id, COUNT(*) as child_count
                FROM tasks
                WHERE parent_id IS NOT NULL
                GROUP BY parent_id
            ) child_counts ON t.id = child_counts.parent_id
            {}
            ORDER BY t.created_at DESC
            {}
            "#,
            parent_filter,
            limit_clause
        );

        debug!(
            query = %query,
            limit = ?limit,
            parent_id = ?parent_id,
            "Executing task list query"
        );

        let rows = self.execute_with_metrics(async {
            sqlx::query(&query)
                .fetch_all(&self.pool).await
        }).await?;
        
        let mut tasks = Vec::new();
        debug!(row_count = rows.len(), "Processing task query results");
        for row in rows {
            let tags_str: Option<String> = row.get("tags");
            let tags = if let Some(tags_json) = tags_str {
                serde_json::from_str(&tags_json).unwrap_or_default()
            } else {
                None
            };
            
            tasks.push(TaskSummary {
                id: row.get("id"),
                title: row.get("title"),
                status: row.get("status"),
                priority: row.get("priority"),
                created_at: DateTime::parse_from_rfc3339(&row.get::<String, _>("created_at"))?.with_timezone(&Utc),
                updated_at: DateTime::parse_from_rfc3339(&row.get::<String, _>("updated_at"))?.with_timezone(&Utc),
                parent_id: row.get("parent_id"),
                child_count: row.get("child_count"),
                tags,
            });
        }
        
        Ok(tasks)
    }
    
    /// Get task dashboard data with pool metrics tracking
    // Instrumentation removed for compilation
    pub async fn get_task_dashboard(&self, _project_id: Option<String>) -> Result<TaskDashboard> {
        // Get total tasks with metrics tracking
        let total_result = self.execute_with_metrics(async {
            sqlx::query("SELECT COUNT(*) as total FROM tasks")
                .fetch_one(&self.pool).await
        }).await?;
        let total_tasks: i64 = total_result.get("total");

        // Get status breakdown with metrics tracking
        let status_rows = self.execute_with_metrics(async {
            sqlx::query("SELECT status, COUNT(*) as count FROM tasks GROUP BY status")
                .fetch_all(&self.pool).await
        }).await?;
        let mut status_breakdown = serde_json::Map::new();
        for row in status_rows {
            let status: String = row.get("status");
            let count: i64 = row.get("count");
            status_breakdown.insert(status, serde_json::Value::Number(count.into()));
        }
        
        // Get priority breakdown with metrics tracking
        let priority_rows = self.execute_with_metrics(async {
            sqlx::query("SELECT priority, COUNT(*) as count FROM tasks GROUP BY priority")
                .fetch_all(&self.pool).await
        }).await?;
        let mut priority_breakdown = serde_json::Map::new();
        for row in priority_rows {
            let priority: String = row.get("priority");
            let count: i64 = row.get("count");
            priority_breakdown.insert(priority, serde_json::Value::Number(count.into()));
        }
        
        // Get recent tasks (last 5) - get root tasks only for dashboard
        let recent_tasks = self.list_tasks(Some(5), None).await?;

        // Get overdue tasks (due_date < now() and status != 'completed')
        let overdue_tasks = self.execute_with_metrics(async {
            sqlx::query_as::<_, TaskSummary>(
                r#"
                SELECT id, title, status, priority, created_at, updated_at, parent_id, 0 as child_count, tags
                FROM tasks
                WHERE due_date < datetime('now')
                AND status NOT IN ('completed', 'done', 'finished')
                ORDER BY due_date ASC
                LIMIT 10
                "#
            )
            .fetch_all(&self.pool).await
        }).await.unwrap_or_default();

        // Get upcoming tasks (due in next 7 days)
        let upcoming_tasks = self.execute_with_metrics(async {
            sqlx::query_as::<_, TaskSummary>(
                r#"
                SELECT id, title, status, priority, created_at, updated_at, parent_id, 0 as child_count, tags
                FROM tasks
                WHERE due_date > datetime('now')
                AND due_date < datetime('now', '+7 days')
                AND status NOT IN ('completed', 'done', 'finished')
                ORDER BY due_date ASC
                LIMIT 10
                "#
            )
            .fetch_all(&self.pool).await
        }).await.unwrap_or_default();

        // Calculate completion rate
        let completed_count = self.execute_with_metrics(async {
            sqlx::query("SELECT COUNT(*) as count FROM tasks WHERE status IN ('completed', 'done', 'finished')")
                .fetch_one(&self.pool).await
        }).await.map(|row| row.get::<i64, _>("count")).unwrap_or(0);

        let completion_rate = if total_tasks > 0 {
            (completed_count as f64 / total_tasks as f64) * 100.0
        } else {
            0.0
        };

        Ok(TaskDashboard {
            total_tasks,
            status_breakdown: serde_json::Value::Object(status_breakdown),
            priority_breakdown: serde_json::Value::Object(priority_breakdown),
            recent_tasks,
            overdue_tasks,
            upcoming_tasks,
            project_breakdown: serde_json::Value::Object(serde_json::Map::new()),
            completion_rate,
            average_completion_time: None,
        })
    }
    
    /// Update a task with pool metrics tracking
    pub async fn update_task(&self, task_id: &str, title: Option<&str>, status: Option<&str>) -> Result<bool> {
        let now = Utc::now();
        let now_str = now.to_rfc3339();

        // Build query dynamically based on what fields are provided
        let (_query_str, result) = match (title, status) { // TODO: Use _query_str for logging
            (Some(t), Some(s)) => {
                let query_str = "UPDATE tasks SET title = ?, status = ?, updated_at = ? WHERE id = ?";
                let result = self.execute_with_metrics(async {
                    sqlx::query(query_str)
                        .bind(t)
                        .bind(s)
                        .bind(&now_str)
                        .bind(task_id)
                        .execute(&self.pool).await
                }).await?;
                (query_str, result)
            },
            (Some(t), None) => {
                let query_str = "UPDATE tasks SET title = ?, updated_at = ? WHERE id = ?";
                let result = self.execute_with_metrics(async {
                    sqlx::query(query_str)
                        .bind(t)
                        .bind(&now_str)
                        .bind(task_id)
                        .execute(&self.pool).await
                }).await?;
                (query_str, result)
            },
            (None, Some(s)) => {
                let query_str = "UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?";
                let result = self.execute_with_metrics(async {
                    sqlx::query(query_str)
                        .bind(s)
                        .bind(&now_str)
                        .bind(task_id)
                        .execute(&self.pool).await
                }).await?;
                (query_str, result)
            },
            (None, None) => {
                // No fields to update
                return Ok(false);
            }
        };
        
        Ok(result.rows_affected() > 0)
    }
    
    /// Delete a task with pool metrics tracking
    pub async fn delete_task(&self, task_id: &str) -> Result<bool> {
        let result = self.execute_with_metrics(async {
            sqlx::query("DELETE FROM tasks WHERE id = ?")
                .bind(task_id)
                .execute(&self.pool).await
        }).await?;
        Ok(result.rows_affected() > 0)
    }

    /// Get pool metrics for monitoring
    pub async fn get_pool_metrics(&self) -> PoolMetrics {
        let pool_state = self.pool.size();
        let total_acquired = self.total_acquired.load(Ordering::Relaxed);
        let total_failures = self.total_acquisition_failures.load(Ordering::Relaxed);

        // Calculate average acquisition time
        let acquisition_times = self.acquisition_times.lock().await;
        let avg_acquisition_time = if acquisition_times.is_empty() {
            0.0
        } else {
            let total_ms: f64 = acquisition_times.iter()
                .map(|d| d.as_millis() as f64)
                .sum();
            total_ms / acquisition_times.len() as f64
        };

        // Calculate pool utilization
        let utilization = if self.config.max_connections > 0 {
            (pool_state as f64) / (self.config.max_connections as f64)
        } else {
            0.0
        };

        PoolMetrics {
            active_connections: pool_state,
            idle_connections: self.config.max_connections.saturating_sub(pool_state),
            total_connections: pool_state,
            total_acquired,
            total_acquisition_failures: total_failures,
            average_acquisition_time_ms: avg_acquisition_time,
            pool_utilization: utilization,
        }
    }

    /// Get pool configuration
    pub fn get_pool_config(&self) -> &DatabasePoolConfig {
        &self.config
    }

    /// Check if pool is healthy
    pub async fn is_pool_healthy(&self) -> bool {
        // Attempt a simple query to test pool health
        match self.pool.acquire().await {
            Ok(_) => true,
            Err(e) => {
                error!("Pool health check failed: {}", e);
                self.total_acquisition_failures.fetch_add(1, Ordering::Relaxed);
                false
            }
        }
    }

    /// Close the pool gracefully
    pub async fn close(&self) {
        info!("Closing database connection pool...");
        self.pool.close().await;
        info!("Database connection pool closed");
    }

    /// Execute a database operation with metrics tracking and error handling
    async fn execute_with_metrics<F, T, E>(&self, operation: F) -> Result<T, E>
    where
        F: std::future::Future<Output = Result<T, E>>,
        E: From<sqlx::Error> + std::fmt::Display,
    {
        let start_time = Instant::now();
        self.total_queries.fetch_add(1, Ordering::Relaxed);

        match operation.await {
            Ok(result) => {
                // Track successful acquisition
                let duration = start_time.elapsed();
                self.total_acquired.fetch_add(1, Ordering::Relaxed);

                // Track acquisition time (keep only last 1000 measurements)
                let mut times = self.acquisition_times.lock().await;
                times.push(duration);
                if times.len() > 1000 {
                    times.remove(0);
                }

                // Check for slow queries (>100ms threshold)
                if duration > Duration::from_millis(100) {
                    warn!("Slow database operation detected: {:?}", duration);
                    self.queries_over_threshold.fetch_add(1, Ordering::Relaxed);

                    // Log slow query for analysis
                    self.log_slow_query("Unknown".to_string(), duration.as_millis() as u64, 0).await;
                }

                Ok(result)
            }
            Err(e) => {
                // Track failure
                self.total_acquisition_failures.fetch_add(1, Ordering::Relaxed);

                // Check for deadlock
                if e.to_string().contains("deadlock") || e.to_string().contains("database is locked") {
                    self.deadlocks_detected.fetch_add(1, Ordering::Relaxed);
                    warn!("Database deadlock detected: {}", e);
                }

                error!("Database operation failed: {}", e);

                // Check if it's a pool exhaustion error
                if e.to_string().contains("timed out") || e.to_string().contains("pool") {
                    warn!("Possible pool exhaustion detected. Current metrics: {:?}",
                          self.get_pool_metrics().await);
                }

                Err(e)
            }
        }
    }

    /// Log a slow query for analysis
    async fn log_slow_query(&self, query: String, duration_ms: u64, affected_rows: i64) {
        let query_type = self.classify_query(&query);
        let slow_query = SlowQueryInfo {
            query: if query.len() > 500 {
                format!("{}...", &query[..500])
            } else {
                query
            },
            duration_ms,
            timestamp: Utc::now(),
            affected_rows,
            query_type,
        };

        let mut slow_queries = self.slow_queries.lock().await;
        slow_queries.push_back(slow_query);

        // Keep only the last 100 slow queries
        if slow_queries.len() > 100 {
            slow_queries.pop_front();
        }
    }

    /// Classify query type based on SQL statement
    fn classify_query(&self, query: &str) -> QueryType {
        let query_upper = query.trim_start().to_uppercase();
        match query_upper.split_whitespace().next() {
            Some("SELECT") => QueryType::Select,
            Some("INSERT") => QueryType::Insert,
            Some("UPDATE") => QueryType::Update,
            Some("DELETE") => QueryType::Delete,
            Some("CREATE") => QueryType::Create,
            Some("DROP") => QueryType::Drop,
            Some(other) => QueryType::Other(other.to_string()),
            None => QueryType::Other("UNKNOWN".to_string()),
        }
    }

    /// Get query performance metrics
    pub async fn get_query_performance_metrics(&self) -> QueryPerformanceMetrics {
        let slow_queries = self.slow_queries.lock().await;
        let total_queries = self.total_queries.load(Ordering::Relaxed);
        let queries_over_threshold = self.queries_over_threshold.load(Ordering::Relaxed);
        let deadlocks_detected = self.deadlocks_detected.load(Ordering::Relaxed);

        // Calculate average query duration
        let acquisition_times = self.acquisition_times.lock().await;
        let avg_query_duration_ms = if !acquisition_times.is_empty() {
            acquisition_times.iter().map(|d| d.as_millis() as f64).sum::<f64>() / acquisition_times.len() as f64
        } else {
            0.0
        };

        // Calculate cache hit rate (simplified - would need actual SQLite stats)
        let cache_hit_rate = if total_queries > 0 {
            ((total_queries - queries_over_threshold) as f64 / total_queries as f64) * 100.0
        } else {
            0.0
        };

        QueryPerformanceMetrics {
            slow_queries: slow_queries.iter().cloned().collect(),
            total_queries,
            avg_query_duration_ms,
            queries_over_threshold,
            deadlocks_detected,
            cache_hit_rate,
        }
    }

    /// Perform database maintenance operations
    pub async fn perform_maintenance(&self) -> Result<MaintenanceReport> {
        let mut report = MaintenanceReport {
            vacuum_performed: false,
            analyze_performed: false,
            indices_optimized: 0,
            maintenance_duration_ms: 0,
            errors: Vec::new(),
        };

        let start_time = Instant::now();

        // Check if VACUUM is needed
        if self.maintenance_config.auto_vacuum_enabled {
            let last_vacuum = self.last_vacuum.lock().await;
            let should_vacuum = match *last_vacuum {
                Some(last) => {
                    let hours_since = Utc::now().signed_duration_since(last).num_hours();
                    hours_since >= self.maintenance_config.vacuum_interval_hours as i64
                },
                None => true, // Never vacuumed
            };

            if should_vacuum {
                match self.vacuum_database().await {
                    Ok(_) => {
                        report.vacuum_performed = true;
                        info!("Database VACUUM completed successfully");
                    },
                    Err(e) => {
                        let error_msg = format!("VACUUM failed: {}", e);
                        error!("{}", error_msg);
                        report.errors.push(error_msg);
                    }
                }
            }
        }

        // Check if ANALYZE is needed
        if self.maintenance_config.auto_analyze_enabled {
            let last_analyze = self.last_analyze.lock().await;
            let should_analyze = match *last_analyze {
                Some(last) => {
                    let hours_since = Utc::now().signed_duration_since(last).num_hours();
                    hours_since >= self.maintenance_config.analyze_interval_hours as i64
                },
                None => true, // Never analyzed
            };

            if should_analyze {
                match self.analyze_database().await {
                    Ok(_) => {
                        report.analyze_performed = true;
                        info!("Database ANALYZE completed successfully");
                    },
                    Err(e) => {
                        let error_msg = format!("ANALYZE failed: {}", e);
                        error!("{}", error_msg);
                        report.errors.push(error_msg);
                    }
                }
            }
        }

        // Optimize indices if enabled
        if self.maintenance_config.auto_optimize_indices {
            match self.optimize_indices().await {
                Ok(count) => {
                    report.indices_optimized = count;
                    if count > 0 {
                        info!("Optimized {} database indices", count);
                    }
                },
                Err(e) => {
                    let error_msg = format!("Index optimization failed: {}", e);
                    error!("{}", error_msg);
                    report.errors.push(error_msg);
                }
            }
        }

        report.maintenance_duration_ms = start_time.elapsed().as_millis() as u64;
        Ok(report)
    }

    /// Perform VACUUM operation
    async fn vacuum_database(&self) -> Result<()> {
        info!("Starting database VACUUM operation");
        let start_time = Instant::now();

        sqlx::query("VACUUM")
            .execute(&self.pool)
            .await?;

        let duration = start_time.elapsed();
        info!("Database VACUUM completed in {:?}", duration);

        // Update last vacuum time
        let mut last_vacuum = self.last_vacuum.lock().await;
        *last_vacuum = Some(Utc::now());

        Ok(())
    }

    /// Perform ANALYZE operation
    async fn analyze_database(&self) -> Result<()> {
        info!("Starting database ANALYZE operation");
        let start_time = Instant::now();

        sqlx::query("ANALYZE")
            .execute(&self.pool)
            .await?;

        let duration = start_time.elapsed();
        info!("Database ANALYZE completed in {:?}", duration);

        // Update last analyze time
        let mut last_analyze = self.last_analyze.lock().await;
        *last_analyze = Some(Utc::now());

        Ok(())
    }

    /// Optimize database indices
    async fn optimize_indices(&self) -> Result<usize> {
        info!("Starting database index optimization");
        let start_time = Instant::now();

        // Get list of indices that might benefit from optimization
        let rows = sqlx::query(
            "SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%'"
        )
        .fetch_all(&self.pool)
        .await?;

        let mut optimized_count = 0;

        for row in rows {
            let index_name: String = row.get("name");

            // For SQLite, we can't directly check fragmentation, but we can rebuild indices
            // This is a simplified approach - in production you might want more sophisticated logic
            match sqlx::query(&format!("REINDEX {}", index_name))
                .execute(&self.pool)
                .await
            {
                Ok(_) => {
                    optimized_count += 1;
                    debug!("Reindexed {}", index_name);
                },
                Err(e) => {
                    warn!("Failed to reindex {}: {}", index_name, e);
                }
            }
        }

        let duration = start_time.elapsed();
        info!("Index optimization completed in {:?}, {} indices processed", duration, optimized_count);

        Ok(optimized_count)
    }

    /// Configure maintenance settings
    pub fn configure_maintenance(&mut self, config: MaintenanceConfig) -> Result<()> {
        info!("Updating database maintenance configuration");
        self.maintenance_config = config;
        Ok(())
    }

    /// Get maintenance configuration
    pub fn get_maintenance_config(&self) -> &MaintenanceConfig {
        &self.maintenance_config
    }

    /// Get the underlying pool for advanced operations (use with caution)
    pub fn get_pool(&self) -> &Pool<Sqlite> {
        &self.pool
    }
}

/// Report from database maintenance operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaintenanceReport {
    pub vacuum_performed: bool,
    pub analyze_performed: bool,
    pub indices_optimized: usize,
    pub maintenance_duration_ms: u64,
    pub errors: Vec<String>,
}
}