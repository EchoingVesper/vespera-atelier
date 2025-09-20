/// Database migration system for Vespera Bindery
///
/// This module provides comprehensive database migration capabilities including:
/// - Schema versioning and migration tracking
/// - Forward and rollback migrations
/// - Transaction-safe migration execution
/// - Migration status and history reporting
/// - Legacy migration utilities for transitioning from Python Scriptorium

pub mod manager;
pub mod commands;

// Re-export commonly used types
pub use manager::{MigrationManager, MigrationInfo, MigrationRecord, MigrationStatus, MigrationResult};
pub use commands::{MigrationCommand, MigrationCommandExecutor};

use crate::task_management::{TaskManager, TaskInput, TaskPriority};
use crate::role_management::RoleManager;
use crate::hook_system::HookManager;
use crate::templates::{Template, TemplateId, FieldDefinition, FieldType, CrdtLayer, TemplateValue};
use crate::errors::{BinderyError, BinderyResult};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use chrono::{DateTime, Utc};

/// Python MCP server integration manager
pub struct McpIntegration {
    task_manager: Arc<TaskManager>,
    role_manager: Arc<RoleManager>,
    hook_manager: Arc<HookManager>,
}

/// Python task data structure for migration
#[derive(Debug, Deserialize, Serialize)]
pub struct PythonTaskData {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub priority: String,
    pub project_id: Option<String>,
    pub assignee: Option<String>,
    pub assigned_role: Option<String>,
    pub parent_id: Option<String>,
    pub child_ids: Vec<String>,
    pub tags: Vec<String>,
    pub labels: HashMap<String, String>,
    pub created_at: String,
    pub updated_at: String,
    pub due_date: Option<String>,
    pub execution_history: Vec<PythonExecutionRecord>,
    pub content: HashMap<String, serde_json::Value>,
}

/// Python execution record for migration
#[derive(Debug, Deserialize, Serialize)]
pub struct PythonExecutionRecord {
    pub execution_id: String,
    pub timestamp: String,
    pub role_name: Option<String>,
    pub status: String,
    pub output: Option<String>,
    pub metadata: HashMap<String, serde_json::Value>,
}

impl McpIntegration {
    /// Create a new MCP integration manager
    pub async fn new(
        task_manager: Arc<TaskManager>,
        role_manager: Arc<RoleManager>, 
        hook_manager: Arc<HookManager>,
    ) -> BinderyResult<Self> {
        Ok(Self {
            task_manager,
            role_manager,
            hook_manager,
        })
    }

    /// Migrate a Python task to the Rust Bindery system
    pub async fn migrate_python_task(&self, python_task: PythonTaskData) -> BinderyResult<String> {
        // Convert Python task data to Rust TaskInput
        let task_input = self.python_task_to_input(python_task)?;
        
        // Create the task using the task manager
        let task_id = self.task_manager.create_task(task_input).await?;
        
        Ok(task_id.to_string())
    }

    /// Batch migrate multiple Python tasks with hierarchy computation
    pub async fn batch_migrate_python_tasks(&self, mut python_tasks: Vec<PythonTaskData>) -> BinderyResult<Vec<String>> {
        // First pass: compute child relationships from parent relationships
        self.compute_child_relationships(&mut python_tasks)?;

        let mut migrated_ids = Vec::new();
        let mut errors = Vec::new();

        for python_task in python_tasks {
            match self.migrate_python_task(python_task).await {
                Ok(task_id) => migrated_ids.push(task_id),
                Err(e) => errors.push(e),
            }
        }

        if !errors.is_empty() {
            tracing::warn!("Migration completed with {} errors", errors.len());
            for error in &errors {
                tracing::error!("Migration error: {}", error);
            }
        }

        Ok(migrated_ids)
    }

    /// Compute child relationships from parent relationships
    fn compute_child_relationships(&self, tasks: &mut [PythonTaskData]) -> BinderyResult<()> {
        // Build a mapping of parent_id -> child_ids
        let mut parent_to_children: HashMap<String, Vec<String>> = HashMap::new();

        // First pass: collect all parent-child relationships
        for task in tasks.iter() {
            if let Some(parent_id) = &task.parent_id {
                parent_to_children
                    .entry(parent_id.clone())
                    .or_default()
                    .push(task.id.clone());
            }
        }

        // Second pass: update child_ids for each task
        for task in tasks.iter_mut() {
            if let Some(children) = parent_to_children.get(&task.id) {
                // Merge existing child_ids with computed ones
                let mut all_children = task.child_ids.clone();
                for child_id in children {
                    if !all_children.contains(child_id) {
                        all_children.push(child_id.clone());
                    }
                }
                task.child_ids = all_children;
            }
        }

        tracing::info!(
            "Computed child relationships for {} tasks, {} parent-child pairs",
            tasks.len(),
            parent_to_children.len()
        );

        Ok(())
    }

    /// Export current Rust tasks to Python format (for reverse migration if needed)
    pub async fn export_to_python_format(&self, project_id: Option<String>) -> BinderyResult<Vec<PythonTaskData>> {
        let tasks = self.task_manager.list_tasks(
            project_id,
            None,
            None,
            None,
            None,
            Some(1000),
        ).await?;

        let mut python_tasks = Vec::new();

        for task_summary in tasks {
            if let Some(task_json) = self.task_manager.get_task(&task_summary.id).await? {
                let python_task = self.rust_task_to_python(task_json)?;
                python_tasks.push(python_task);
            }
        }

        Ok(python_tasks)
    }

    /// Create default task template for the Bindery system
    pub async fn create_default_task_template(&self) -> BinderyResult<Template> {
        let template_id = TemplateId::new("vespera.templates.hierarchical_task");
        let mut template = Template::new(
            template_id,
            "Hierarchical Task Template".to_string(),
            "Template for hierarchical task management with role execution support".to_string(),
            "vespera.task".to_string(),
        );

        // Add core task fields
        template.add_field("title".to_string(), FieldDefinition {
            field_type: FieldType::Text,
            required: true,
            default_value: None,
            validation: None,
            crdt_layer: CrdtLayer::Text,
            ui_config: None,
        });

        template.add_field("description".to_string(), FieldDefinition {
            field_type: FieldType::Text,
            required: false,
            default_value: Some(TemplateValue::Text(String::new())),
            validation: None,
            crdt_layer: CrdtLayer::Text,
            ui_config: None,
        });

        template.add_field("status".to_string(), FieldDefinition {
            field_type: FieldType::Enum(vec![
                "todo".to_string(),
                "doing".to_string(),
                "review".to_string(),
                "done".to_string(),
                "blocked".to_string(),
                "cancelled".to_string(),
                "archived".to_string(),
            ]),
            required: true,
            default_value: Some(TemplateValue::Enum("todo".to_string())),
            validation: None,
            crdt_layer: CrdtLayer::Metadata,
            ui_config: None,
        });

        template.add_field("priority".to_string(), FieldDefinition {
            field_type: FieldType::Enum(vec![
                "critical".to_string(),
                "high".to_string(),
                "normal".to_string(),
                "low".to_string(),
                "someday".to_string(),
            ]),
            required: true,
            default_value: Some(TemplateValue::Enum("normal".to_string())),
            validation: None,
            crdt_layer: CrdtLayer::Metadata,
            ui_config: None,
        });

        template.add_field("assignee".to_string(), FieldDefinition {
            field_type: FieldType::Text,
            required: false,
            default_value: None,
            validation: None,
            crdt_layer: CrdtLayer::Metadata,
            ui_config: None,
        });

        template.add_field("assigned_role".to_string(), FieldDefinition {
            field_type: FieldType::Text,
            required: false,
            default_value: Some(TemplateValue::Text("default_agent".to_string())),
            validation: None,
            crdt_layer: CrdtLayer::Metadata,
            ui_config: None,
        });

        template.add_field("project_id".to_string(), FieldDefinition {
            field_type: FieldType::Text,
            required: false,
            default_value: None,
            validation: None,
            crdt_layer: CrdtLayer::Metadata,
            ui_config: None,
        });

        template.add_field("due_date".to_string(), FieldDefinition {
            field_type: FieldType::DateTime,
            required: false,
            default_value: None,
            validation: None,
            crdt_layer: CrdtLayer::Metadata,
            ui_config: None,
        });

        template.add_field("parent_id".to_string(), FieldDefinition {
            field_type: FieldType::Reference,
            required: false,
            default_value: None,
            validation: None,
            crdt_layer: CrdtLayer::Hierarchy,
            ui_config: None,
        });

        template.add_field("tags".to_string(), FieldDefinition {
            field_type: FieldType::Array,
            required: false,
            default_value: Some(TemplateValue::Array(Vec::new())),
            validation: None,
            crdt_layer: CrdtLayer::Reference,
            ui_config: None,
        });

        template.add_field("labels".to_string(), FieldDefinition {
            field_type: FieldType::Object,
            required: false,
            default_value: Some(TemplateValue::Object(serde_json::json!({}))),
            validation: None,
            crdt_layer: CrdtLayer::Metadata,
            ui_config: None,
        });

        Ok(template)
    }

    /// Generate Python MCP tool wrappers for the Rust functionality
    pub fn generate_python_mcp_wrappers(&self) -> String {
        r#"
# Generated MCP tool wrappers for Rust Bindery integration
# This code should be integrated into the Python MCP server

import asyncio
import json
from typing import Dict, List, Optional, Any
from pydantic import BaseModel

class BinderyTaskInput(BaseModel):
    title: str
    description: Optional[str] = None
    priority: Optional[str] = None
    project_id: Optional[str] = None
    parent_id: Optional[str] = None
    assignee: Optional[str] = None
    due_date: Optional[str] = None
    tags: List[str] = []
    labels: Dict[str, str] = {}
    subtasks: List['BinderyTaskInput'] = []

class BinderyTaskUpdateInput(BaseModel):
    task_id: str
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    assignee: Optional[str] = None
    due_date: Optional[str] = None
    role: Optional[str] = None

# These functions would call into the Rust library via PyO3 bindings
async def bindery_create_task(input_data: Dict[str, Any]) -> str:
    """Create a task using the Rust Bindery system"""
    # This would call rust_bindery.create_task(input_data)
    pass

async def bindery_update_task(input_data: Dict[str, Any]) -> None:
    """Update a task using the Rust Bindery system"""
    # This would call rust_bindery.update_task(input_data)
    pass

async def bindery_get_task(task_id: str) -> Optional[Dict[str, Any]]:
    """Get a task from the Rust Bindery system"""
    # This would call rust_bindery.get_task(task_id)
    pass

async def bindery_list_tasks(
    project_id: Optional[str] = None,
    status_filter: Optional[str] = None,
    priority_filter: Optional[str] = None,
    assignee: Optional[str] = None,
    parent_id: Optional[str] = None,
    limit: Optional[int] = 50
) -> List[Dict[str, Any]]:
    """List tasks from the Rust Bindery system"""
    # This would call rust_bindery.list_tasks(...)
    pass

async def bindery_execute_task(task_id: str, dry_run: bool = False) -> str:
    """Execute a task using the Rust Bindery system"""
    # This would call rust_bindery.execute_task(task_id, dry_run)
    pass

async def bindery_get_task_dashboard(project_id: Optional[str] = None) -> Dict[str, Any]:
    """Get task dashboard from the Rust Bindery system"""
    # This would call rust_bindery.get_task_dashboard(project_id)
    pass

# MCP tool definitions that wrap the Rust functionality
@app.tool()
async def create_task_rust(
    title: str,
    description: str = "",
    priority: str = "normal",
    project_id: Optional[str] = None,
    assignee: Optional[str] = None,
    due_date: Optional[str] = None,
    tags: List[str] = [],
    labels: Dict[str, str] = {}
) -> Dict[str, Any]:
    """Create a new task using the Rust Bindery system"""
    
    input_data = {
        "title": title,
        "description": description,
        "priority": priority,
        "project_id": project_id,
        "assignee": assignee,
        "due_date": due_date,
        "tags": tags,
        "labels": labels,
        "subtasks": []
    }
    
    try:
        task_id = await bindery_create_task(input_data)
        return {
            "success": True,
            "task_id": task_id,
            "message": f"Task '{title}' created successfully"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "message": f"Failed to create task: {e}"
        }

@app.tool()
async def list_tasks_rust(
    project_id: Optional[str] = None,
    status_filter: Optional[str] = None,
    priority_filter: Optional[str] = None,
    assignee: Optional[str] = None,
    parent_id: Optional[str] = None,
    limit: int = 50
) -> Dict[str, Any]:
    """List tasks using the Rust Bindery system"""
    
    try:
        tasks = await bindery_list_tasks(
            project_id, status_filter, priority_filter,
            assignee, parent_id, limit
        )
        return {
            "success": True,
            "tasks": tasks,
            "count": len(tasks)
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "message": f"Failed to list tasks: {e}"
        }
"#.to_string()
    }

    // Private helper methods

    fn python_task_to_input(&self, python_task: PythonTaskData) -> BinderyResult<TaskInput> {
        let priority = match python_task.priority.as_str() {
            "critical" => Some(TaskPriority::Critical),
            "high" => Some(TaskPriority::High),
            "normal" => Some(TaskPriority::Normal),
            "low" => Some(TaskPriority::Low),
            "someday" => Some(TaskPriority::Low),
            _ => Some(TaskPriority::Normal),
        };

        let parent_id = python_task.parent_id
            .as_ref()
            .and_then(|id| id.parse().ok());

        let due_date = python_task.due_date
            .as_ref()
            .and_then(|date| date.parse::<DateTime<Utc>>().ok());

        Ok(TaskInput {
            title: python_task.title,
            description: python_task.description,
            priority,
            project_id: python_task.project_id,
            parent_id,
            assignee: python_task.assignee,
            due_date,
            role: None, // No role information in legacy Python task data
            tags: python_task.tags,
            labels: python_task.labels,
            subtasks: Vec::new(), // Will be handled separately for hierarchical tasks
        })
    }

    fn rust_task_to_python(&self, task_json: serde_json::Value) -> BinderyResult<PythonTaskData> {
        let id = task_json["id"].as_str()
            .ok_or_else(|| BinderyError::InvalidInput("Missing task ID".to_string()))?
            .to_string();

        let title = task_json["title"].as_str()
            .ok_or_else(|| BinderyError::InvalidInput("Missing task title".to_string()))?
            .to_string();

        let description = task_json["description"].as_str().map(|s| s.to_string());
        
        let status = task_json["content"]["status"].as_str()
            .unwrap_or("todo")
            .to_string();

        let priority = task_json["content"]["priority"].as_str()
            .unwrap_or("normal")
            .to_string();

        let project_id = task_json["content"]["project_id"].as_str().map(|s| s.to_string());
        let assignee = task_json["content"]["assignee"].as_str().map(|s| s.to_string());
        let assigned_role = task_json["content"]["assigned_role"].as_str().map(|s| s.to_string());
        let parent_id = task_json["content"]["parent_id"].as_str().map(|s| s.to_string());

        let tags = task_json["content"]["tags"].as_array()
            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
            .unwrap_or_default();

        let labels = task_json["content"]["labels"].as_object()
            .map(|obj| obj.iter().map(|(k, v)| (k.clone(), v.as_str().unwrap_or("").to_string())).collect())
            .unwrap_or_default();

        let created_at = task_json["created_at"].as_str()
            .unwrap_or("")
            .to_string();

        let updated_at = task_json["updated_at"].as_str()
            .unwrap_or("")
            .to_string();

        let due_date = task_json["content"]["due_date"].as_str().map(|s| s.to_string());

        // Convert execution history
        let execution_history = task_json["execution_history"].as_array()
            .map(|arr| {
                arr.iter().filter_map(|exec| {
                    Some(PythonExecutionRecord {
                        execution_id: exec["execution_id"].as_str()?.to_string(),
                        timestamp: exec["started_at"].as_str()?.to_string(),
                        role_name: exec["role_name"].as_str().map(|s| s.to_string()),
                        status: exec["status"].as_str()?.to_string(),
                        output: exec["output"].as_str().map(|s| s.to_string()),
                        metadata: exec["metadata"].as_object()
                            .map(|obj| obj.iter().map(|(k, v)| (k.clone(), v.clone())).collect())
                            .unwrap_or_default(),
                    })
                }).collect()
            })
            .unwrap_or_default();

        Ok(PythonTaskData {
            id,
            title,
            description,
            status,
            priority,
            project_id,
            assignee,
            assigned_role,
            parent_id,
            child_ids: task_json["content"]["child_ids"].as_array()
                .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
                .unwrap_or_else(|| {
                    // If child_ids is not in content, check root level
                    task_json["child_ids"].as_array()
                        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
                        .unwrap_or_default()
                }),
            tags,
            labels,
            created_at,
            updated_at,
            due_date,
            execution_history,
            content: HashMap::new(),
        })
    }
}

/// Migration utilities for the transition period
pub struct MigrationUtilities;

impl MigrationUtilities {
    /// Validate that the migration was successful
    pub async fn validate_migration(
        task_manager: &TaskManager,
        original_tasks: &[PythonTaskData],
    ) -> BinderyResult<bool> {
        let migrated_tasks = task_manager.list_tasks(
            None, None, None, None, None, Some(original_tasks.len() * 2)
        ).await?;

        let migrated_count = migrated_tasks.len();
        let original_count = original_tasks.len();

        if migrated_count < original_count {
            tracing::warn!("Migration incomplete: {} original tasks, {} migrated tasks", 
                original_count, migrated_count);
            return Ok(false);
        }

        // Additional validation logic could go here
        Ok(true)
    }

    /// Generate a migration report
    pub fn generate_migration_report(
        original_count: usize,
        migrated_count: usize,
        errors: Vec<String>,
    ) -> String {
        format!(
            r#"
# Task Migration Report

## Summary
- Original tasks: {}
- Successfully migrated: {}
- Failed migrations: {}
- Success rate: {:.1}%

## Errors
{}

## Status
Migration {}
            "#,
            original_count,
            migrated_count,
            errors.len(),
            (migrated_count as f64 / original_count as f64) * 100.0,
            if errors.is_empty() {
                "None".to_string()
            } else {
                errors.join("\n")
            },
            if errors.is_empty() { "SUCCESSFUL" } else { "COMPLETED WITH ERRORS" }
        )
    }
}