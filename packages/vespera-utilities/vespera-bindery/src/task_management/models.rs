/// Task models - Types and structures for task management

use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use crate::CodexId;

/// Task execution status
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExecutionStatus {
    Running,
    Completed,
    Failed,
}

/// Task status enumeration
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TaskStatus {
    Todo,
    Doing,
    Review,
    Done,
    Cancelled,
    Blocked,
}

/// Task priority levels
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TaskPriority {
    Low,
    Normal,
    High,
    Critical,
}

/// Task relationship types
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TaskRelation {
    DependsOn,
    Blocks,
    ParentChild,
    RelatesTo,
    DuplicateOf,
}

/// Input for creating a new task
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskInput {
    pub title: String,
    pub description: Option<String>,
    pub priority: Option<TaskPriority>,
    pub assignee: Option<String>,
    pub due_date: Option<DateTime<Utc>>,
    pub role: Option<String>,
    pub project_id: Option<String>,
    pub parent_id: Option<CodexId>,
    pub tags: Vec<String>,
    pub labels: HashMap<String, String>,
    pub subtasks: Vec<TaskInput>,
}

/// Input for updating an existing task
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskUpdateInput {
    pub task_id: CodexId,
    pub title: Option<String>,
    pub description: Option<String>,
    pub status: Option<TaskStatus>,
    pub priority: Option<TaskPriority>,
    pub assignee: Option<String>,
    pub due_date: Option<DateTime<Utc>>,
    pub role: Option<String>,
    pub labels: Option<HashMap<String, String>>,
    pub tags: Option<Vec<String>>,
}

/// Task summary for lists and dashboards
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskSummary {
    pub id: CodexId,
    pub title: String,
    pub status: TaskStatus,
    pub priority: TaskPriority,
    pub assignee: Option<String>,
    pub project_id: Option<String>,
    pub due_date: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub tags: Vec<String>,
    pub progress: Option<f64>,
    pub parent_id: Option<CodexId>,
    pub child_count: usize,
}

/// Hierarchical task structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskTree {
    pub task: TaskSummary,
    pub children: Vec<TaskTree>,
    pub depth: usize,
    pub is_expanded: bool,
}

/// Task execution result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskExecutionResult {
    pub task_id: CodexId,
    pub execution_id: String,
    pub status: ExecutionStatus,
    pub output: Option<String>,
    pub error: Option<String>,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub duration_ms: Option<u64>,
}

/// Task dependency analysis
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

/// Task dashboard with statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskDashboard {
    pub total_tasks: usize,
    pub status_breakdown: HashMap<TaskStatus, usize>,
    pub priority_breakdown: HashMap<TaskPriority, usize>,
    pub project_breakdown: HashMap<String, usize>,
    pub recent_tasks: Vec<TaskSummary>,
    pub overdue_tasks: Vec<TaskSummary>,
    pub completion_rate: f64,
    pub avg_completion_time_hours: Option<f64>,
}