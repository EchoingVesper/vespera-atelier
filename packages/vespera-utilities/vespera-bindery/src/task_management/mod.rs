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
// Re-export specific models to avoid unused import warnings
pub use models::{
    TaskStatus, TaskPriority, TaskRelation, TaskInput, TaskUpdateInput,
    TaskTree, TaskSummary, TaskDashboard, TaskExecutionResult, DependencyAnalysis,
    ExecutionStatus
};

// All type definitions are in models.rs and re-exported above