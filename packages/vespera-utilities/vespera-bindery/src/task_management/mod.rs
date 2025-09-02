/// Task Management System for Vespera Bindery
/// 
/// This module migrates the existing Python task management system to a Codex-based
/// Rust implementation. Tasks are now treated as Codex entries with collaborative
/// editing support via CRDT operations.

pub mod manager;
pub mod service; 
pub mod executor;
pub mod models;

pub use manager::TaskManager;
pub use service::TaskService;
pub use executor::TaskExecutor;
pub use models::*;

use crate::{CodexId, CodexManager};
use crate::crdt::VesperaCRDT;
use crate::templates::TemplateId;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

/// Task status enumeration matching the Python system
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TaskStatus {
    Todo,
    Doing, 
    Review,
    Done,
    Blocked,
    Cancelled,
    Archived,
}

/// Task priority enumeration matching the Python system  
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TaskPriority {
    Critical,
    High,
    Normal,
    Low,
    Someday,
}

/// Task relationship types
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TaskRelation {
    ParentChild,
    DependsOn,
    Blocks, 
    RelatesTo,
    DuplicateOf,
}

/// Task execution result from role-based execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskExecutionResult {
    pub task_id: CodexId,
    pub execution_id: String,
    pub status: ExecutionStatus,
    pub output: Option<String>,
    pub error: Option<String>,
    pub started_at: chrono::DateTime<chrono::Utc>,
    pub completed_at: Option<chrono::DateTime<chrono::Utc>>,
    pub role_name: Option<String>,
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Execution status tracking
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExecutionStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Cancelled,
}

/// Task creation input structure  
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskInput {
    pub title: String,
    pub description: Option<String>,
    pub priority: Option<TaskPriority>,
    pub project_id: Option<String>,
    pub parent_id: Option<CodexId>,
    pub assignee: Option<String>,
    pub due_date: Option<chrono::DateTime<chrono::Utc>>,
    pub tags: Vec<String>,
    pub labels: HashMap<String, String>,
    pub subtasks: Vec<TaskInput>,
}

/// Task update input structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskUpdateInput {
    pub task_id: CodexId,
    pub title: Option<String>,
    pub description: Option<String>,
    pub status: Option<TaskStatus>,
    pub priority: Option<TaskPriority>,
    pub assignee: Option<String>,
    pub due_date: Option<chrono::DateTime<chrono::Utc>>,
    pub role: Option<String>,
}

/// Task tree structure for hierarchical display
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskTree {
    pub task: TaskSummary,
    pub children: Vec<TaskTree>,
    pub depth: usize,
}

/// Lightweight task summary for listings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskSummary {
    pub id: CodexId,
    pub title: String,
    pub status: TaskStatus,
    pub priority: TaskPriority, 
    pub assignee: Option<String>,
    pub project_id: Option<String>,
    pub parent_id: Option<CodexId>,
    pub child_count: usize,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub due_date: Option<chrono::DateTime<chrono::Utc>>,
    pub tags: Vec<String>,
}

/// Dashboard statistics 
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskDashboard {
    pub total_tasks: usize,
    pub status_breakdown: HashMap<TaskStatus, usize>,
    pub priority_breakdown: HashMap<TaskPriority, usize>,
    pub recent_tasks: Vec<TaskSummary>,
    pub overdue_tasks: Vec<TaskSummary>,
    pub upcoming_tasks: Vec<TaskSummary>,
    pub project_breakdown: HashMap<String, usize>,
    pub completion_rate: f64,
    pub average_completion_time: Option<chrono::Duration>,
}

/// Task dependency analysis result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DependencyAnalysis {
    pub task_id: CodexId,
    pub depends_on: Vec<CodexId>,
    pub blocks: Vec<CodexId>,
    pub is_blocked: bool,
    pub blocking_tasks: Vec<CodexId>,
    pub dependency_depth: usize,
    pub critical_path: bool,
}