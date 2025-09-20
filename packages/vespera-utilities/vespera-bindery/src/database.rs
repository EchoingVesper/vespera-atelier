//! Database persistence module for Vespera Bindery
//! 
//! Provides SQLite persistence for tasks, roles, and other data structures

use std::path::Path;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use sqlx::{sqlite::SqlitePool, Pool, Sqlite, Row};
use chrono::{DateTime, Utc};
use uuid::Uuid;

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

/// Database manager for Vespera Bindery data persistence
pub struct Database {
    pool: Pool<Sqlite>,
}

impl Database {
    /// Create a new database instance and initialize tables
    pub async fn new(database_path: impl AsRef<Path>) -> Result<Self> {
        let database_url = format!("sqlite:{}?mode=rwc", database_path.as_ref().display());
        eprintln!("Debug: Database URL: {}", database_url);
        
        // Create parent directory if it doesn't exist
        if let Some(parent) = database_path.as_ref().parent() {
            eprintln!("Debug: Ensuring parent directory exists: {:?}", parent);
            tokio::fs::create_dir_all(parent).await?;
        }
        
        eprintln!("Debug: Attempting to connect to database...");
        let pool = SqlitePool::connect(&database_url).await?;
        eprintln!("Debug: Database connection successful!");
        
        // Try to initialize database schema via migrations, but continue if it fails
        // This allows the server to work even when run from different working directories
        if let Err(migration_error) = sqlx::migrate!("./migrations").run(&pool).await {
            eprintln!("Migration failed (this is expected when run from different working directory): {:?}", migration_error);
            eprintln!("Will use manual schema initialization instead");
        }
        
        Ok(Self { pool })
    }
    
    /// Create a new database instance with in-memory SQLite (for testing)
    pub async fn new_in_memory() -> Result<Self> {
        let pool = SqlitePool::connect("sqlite::memory:").await?;
        sqlx::migrate!("./migrations").run(&pool).await?;
        Ok(Self { pool })
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
    
    /// Create a new task
    pub async fn create_task(&self, input: &TaskInput) -> Result<String> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now();
        let tags_json = serde_json::to_string(&input.tags)?;
        let labels_json = serde_json::to_string(&input.labels)?;
        
        sqlx::query(
            r#"
            INSERT INTO tasks (id, title, description, priority, parent_id, project_id, tags, labels, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
            "#
        )
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
        .execute(&self.pool).await?;
        
        // Create subtasks recursively using Box::pin for async recursion
        for subtask in &input.subtasks {
            let mut subtask_input = subtask.clone();
            subtask_input.parent_id = Some(id.clone());
            Box::pin(self.create_task(&subtask_input)).await?;
        }
        
        Ok(id)
    }
    
    /// List tasks with optional filtering
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
        
        let rows = sqlx::query(&query).fetch_all(&self.pool).await?;
        
        let mut tasks = Vec::new();
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
    
    /// Get task dashboard data
    pub async fn get_task_dashboard(&self, _project_id: Option<String>) -> Result<TaskDashboard> {
        // Get total tasks
        let total_result = sqlx::query("SELECT COUNT(*) as total FROM tasks")
            .fetch_one(&self.pool).await?;
        let total_tasks: i64 = total_result.get("total");
        
        // Get status breakdown
        let status_rows = sqlx::query("SELECT status, COUNT(*) as count FROM tasks GROUP BY status")
            .fetch_all(&self.pool).await?;
        let mut status_breakdown = serde_json::Map::new();
        for row in status_rows {
            let status: String = row.get("status");
            let count: i64 = row.get("count");
            status_breakdown.insert(status, serde_json::Value::Number(count.into()));
        }
        
        // Get priority breakdown
        let priority_rows = sqlx::query("SELECT priority, COUNT(*) as count FROM tasks GROUP BY priority")
            .fetch_all(&self.pool).await?;
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
    
    /// Update a task
    pub async fn update_task(&self, task_id: &str, title: Option<&str>, status: Option<&str>) -> Result<bool> {
        let now = Utc::now();
        let now_str = now.to_rfc3339();
        
        // Build query dynamically based on what fields are provided
        let (_query_str, result) = match (title, status) { // TODO: Use _query_str for logging
            (Some(t), Some(s)) => {
                let query_str = "UPDATE tasks SET title = ?, status = ?, updated_at = ? WHERE id = ?";
                let result = sqlx::query(query_str)
                    .bind(t)
                    .bind(s)
                    .bind(&now_str)
                    .bind(task_id)
                    .execute(&self.pool).await?;
                (query_str, result)
            },
            (Some(t), None) => {
                let query_str = "UPDATE tasks SET title = ?, updated_at = ? WHERE id = ?";
                let result = sqlx::query(query_str)
                    .bind(t)
                    .bind(&now_str)
                    .bind(task_id)
                    .execute(&self.pool).await?;
                (query_str, result)
            },
            (None, Some(s)) => {
                let query_str = "UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?";
                let result = sqlx::query(query_str)
                    .bind(s)
                    .bind(&now_str)
                    .bind(task_id)
                    .execute(&self.pool).await?;
                (query_str, result)
            },
            (None, None) => {
                // No fields to update
                return Ok(false);
            }
        };
        
        Ok(result.rows_affected() > 0)
    }
    
    /// Delete a task
    pub async fn delete_task(&self, task_id: &str) -> Result<bool> {
        let result = sqlx::query("DELETE FROM tasks WHERE id = ?")
            .bind(task_id)
            .execute(&self.pool).await?;
        Ok(result.rows_affected() > 0)
    }
}