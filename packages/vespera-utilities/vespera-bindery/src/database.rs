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

/// Database manager for Vespera Bindery data persistence
pub struct Database {
    pool: Pool<Sqlite>,
    config: DatabasePoolConfig,
    // Metrics tracking
    total_acquired: Arc<AtomicU64>,
    total_acquisition_failures: Arc<AtomicU64>,
    acquisition_times: Arc<tokio::sync::Mutex<Vec<Duration>>>,
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
        
        Ok(TaskDashboard {
            total_tasks,
            status_breakdown: serde_json::Value::Object(status_breakdown),
            priority_breakdown: serde_json::Value::Object(priority_breakdown),
            recent_tasks,
            overdue_tasks: Vec::new(), // TODO: Implement overdue logic - query tasks where due_date < now() and status != 'completed'
            upcoming_tasks: Vec::new(), // TODO: Implement upcoming logic - query tasks where due_date > now() and due_date < now() + 7 days
            project_breakdown: serde_json::Value::Object(serde_json::Map::new()),
            completion_rate: 0.0, // TODO: Calculate completion rate as (completed_tasks / total_tasks) * 100
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

                if duration > Duration::from_millis(100) {
                    warn!("Slow database operation detected: {:?}", duration);
                }

                Ok(result)
            }
            Err(e) => {
                // Track failure
                self.total_acquisition_failures.fetch_add(1, Ordering::Relaxed);
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

    /// Get the underlying pool for advanced operations (use with caution)
    pub fn get_pool(&self) -> &Pool<Sqlite> {
        &self.pool
    }
}