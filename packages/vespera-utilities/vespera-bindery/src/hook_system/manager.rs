/// Hook Manager - Centralized event handling and automation system
/// 
/// This manager coordinates hook agents, timed agents, and event processing
/// for the Codex-based system.

use super::{
    HookAgent, TimedAgent, HookTrigger, HookExecutionResult, HookAgentInput, 
    TimedAgentInput, HookTriggerInput, HookCondition, HookAction, ActionType
};
use crate::{CodexId, CodexManager};
use crate::codex::{Codex, CodexManagerExt};
use crate::task_management::{TaskInput, TaskUpdateInput};
use crate::TemplateId;
use crate::errors::{BinderyError, BinderyResult};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{RwLock, Mutex};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use serde_json::Value;

/// Hook manager for event-driven automation
#[derive(Debug)]
pub struct HookManager {
    codex_manager: Arc<CodexManager>,
    hook_agents: Arc<RwLock<HashMap<String, HookAgent>>>,
    timed_agents: Arc<RwLock<HashMap<String, TimedAgent>>>,
    execution_history: Arc<RwLock<Vec<HookExecutionResult>>>,
    scheduler_handle: Arc<Mutex<Option<tokio::task::JoinHandle<()>>>>,
}

impl HookManager {
    /// Create a new hook manager
    pub fn new(codex_manager: Arc<CodexManager>) -> Self {
        Self {
            codex_manager,
            hook_agents: Arc::new(RwLock::new(HashMap::new())),
            timed_agents: Arc::new(RwLock::new(HashMap::new())),
            execution_history: Arc::new(RwLock::new(Vec::new())),
            scheduler_handle: Arc::new(Mutex::new(None)),
        }
    }

    /// Create a default hook manager for testing/development
    pub fn default() -> Self {
        // Create a stub CodexManager
        let stub_manager = Arc::new(crate::CodexManager::new().unwrap());
        
        Self {
            codex_manager: stub_manager,
            hook_agents: Arc::new(RwLock::new(HashMap::new())),
            timed_agents: Arc::new(RwLock::new(HashMap::new())),
            execution_history: Arc::new(RwLock::new(Vec::new())),
            scheduler_handle: Arc::new(Mutex::new(None)),
        }
    }

    /// Start the background scheduler for timed agents
    pub async fn start_scheduler(&self) -> BinderyResult<()> {
        let timed_agents = self.timed_agents.clone();
        let execution_history = self.execution_history.clone();
        let codex_manager = self.codex_manager.clone();

        let handle = tokio::spawn(async move {
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(60)); // Check every minute
            
            loop {
                interval.tick().await;
                
                let now = Utc::now();
                let agents = timed_agents.read().await;
                
                for agent in agents.values() {
                    if !agent.enabled {
                        continue;
                    }
                    
                    if let Some(next_exec) = agent.next_execution {
                        if now >= next_exec {
                            // Execute the agent
                            let result = Self::execute_timed_agent_actions(
                                agent,
                                &codex_manager,
                            ).await;
                            
                            if let Ok(execution_result) = result {
                                execution_history.write().await.push(execution_result);
                            }
                        }
                    }
                }
            }
        });

        *self.scheduler_handle.lock().await = Some(handle);
        Ok(())
    }

    /// Register a hook agent from template automation rules
    pub async fn register_hook_agent(&self, input: HookAgentInput) -> BinderyResult<String> {
        let hook_id = Uuid::new_v4().to_string();
        
        // Parse automation rule to create hook agent
        let hook_agent = self.parse_automation_rule_to_hook(&hook_id, &input)?;
        
        self.hook_agents.write().await.insert(hook_id.clone(), hook_agent);
        
        Ok(hook_id)
    }

    /// Register a timed agent from template automation rules
    pub async fn register_timed_agent(&self, input: TimedAgentInput) -> BinderyResult<String> {
        let agent_id = Uuid::new_v4().to_string();
        
        // Parse automation rule to create timed agent
        let timed_agent = self.parse_schedule_config_to_agent(&agent_id, &input)?;
        
        self.timed_agents.write().await.insert(agent_id.clone(), timed_agent);
        
        Ok(agent_id)
    }

    /// Manually trigger a hook agent
    pub async fn trigger_hook_agent(&self, input: HookTriggerInput) -> BinderyResult<HookExecutionResult> {
        let hook_agents = self.hook_agents.read().await;
        
        if let Some(hook) = hook_agents.get(&input.hook_id) {
            if !input.force_execute {
                // Check conditions
                let conditions_met = hook.conditions.iter()
                    .all(|condition| condition.evaluate(&input.trigger_context));
                
                if !conditions_met {
                    return Err(BinderyError::InvalidInput(
                        "Hook conditions not met".to_string()
                    ));
                }
            }

            self.execute_hook_actions(hook, &input.trigger_context).await
        } else {
            Err(BinderyError::NotFound(format!("Hook agent {}", input.hook_id)))
        }
    }

    /// Get status of all agents
    pub async fn get_hook_agent_status(&self) -> BinderyResult<Value> {
        let hook_agents = self.hook_agents.read().await;
        let timed_agents = self.timed_agents.read().await;
        let history = self.execution_history.read().await;

        Ok(serde_json::json!({
            "hook_agents": {
                "total": hook_agents.len(),
                "enabled": hook_agents.values().filter(|h| h.enabled).count(),
                "agents": hook_agents.values().collect::<Vec<_>>()
            },
            "timed_agents": {
                "total": timed_agents.len(),
                "enabled": timed_agents.values().filter(|a| a.enabled).count(),
                "agents": timed_agents.values().collect::<Vec<_>>()
            },
            "recent_executions": history.iter().rev().take(10).collect::<Vec<_>>()
        }))
    }

    /// Pause a timed agent
    pub async fn pause_timed_agent(&self, agent_id: &str) -> BinderyResult<()> {
        let mut agents = self.timed_agents.write().await;
        
        if let Some(agent) = agents.get_mut(agent_id) {
            agent.enabled = false;
            Ok(())
        } else {
            Err(BinderyError::NotFound(format!("Timed agent {}", agent_id)))
        }
    }

    /// Resume a timed agent
    pub async fn resume_timed_agent(&self, agent_id: &str) -> BinderyResult<()> {
        let mut agents = self.timed_agents.write().await;
        
        if let Some(agent) = agents.get_mut(agent_id) {
            agent.enabled = true;
            // Recalculate next execution
            if let Some(next_exec) = agent.schedule.next_execution(Utc::now()) {
                agent.next_execution = Some(next_exec);
            }
            Ok(())
        } else {
            Err(BinderyError::NotFound(format!("Timed agent {}", agent_id)))
        }
    }

    // Event trigger methods for task lifecycle

    /// Trigger pre-task creation hooks
    pub async fn trigger_pre_task_create(&self, input: &TaskInput) -> BinderyResult<()> {
        let context = self.task_input_to_context(input);
        self.trigger_hooks_for_event(HookTrigger::PreTaskCreate, context).await
    }

    /// Trigger post-task creation hooks
    pub async fn trigger_post_task_create(&self, task_id: &CodexId, input: &TaskInput) -> BinderyResult<()> {
        let mut context = self.task_input_to_context(input);
        context.insert("task_id".to_string(), Value::String(task_id.to_string()));
        self.trigger_hooks_for_event(HookTrigger::PostTaskCreate, context).await
    }

    /// Trigger pre-task update hooks
    pub async fn trigger_pre_task_update(&self, input: &TaskUpdateInput, old_task: Option<&Codex>) -> BinderyResult<()> {
        let context = self.task_update_to_context(input, old_task);
        self.trigger_hooks_for_event(HookTrigger::PreTaskUpdate, context).await
    }

    /// Trigger post-task update hooks
    pub async fn trigger_post_task_update(&self, input: &TaskUpdateInput, updated_task: Option<&Codex>) -> BinderyResult<()> {
        let context = self.task_update_to_context(input, updated_task);
        self.trigger_hooks_for_event(HookTrigger::PostTaskUpdate, context).await
    }

    /// Trigger pre-task deletion hooks
    pub async fn trigger_pre_task_delete(&self, task_id: &CodexId, task: Option<&Codex>) -> BinderyResult<()> {
        let mut context = HashMap::new();
        context.insert("task_id".to_string(), Value::String(task_id.to_string()));
        
        if let Some(task) = task {
            context.insert("task_title".to_string(), Value::String(task.title.clone()));
            context.insert("task_content".to_string(), serde_json::to_value(&task.content)?);
        }
        
        self.trigger_hooks_for_event(HookTrigger::PreTaskDelete, context).await
    }

    /// Trigger post-task deletion hooks
    pub async fn trigger_post_task_delete(&self, task_id: &CodexId) -> BinderyResult<()> {
        let mut context = HashMap::new();
        context.insert("task_id".to_string(), Value::String(task_id.to_string()));
        self.trigger_hooks_for_event(HookTrigger::PostTaskDelete, context).await
    }

    /// Trigger task completion hooks
    pub async fn trigger_task_completed(&self, task_id: &CodexId) -> BinderyResult<()> {
        let mut context = HashMap::new();
        context.insert("task_id".to_string(), Value::String(task_id.to_string()));
        context.insert("completion_time".to_string(), Value::String(Utc::now().to_rfc3339()));
        self.trigger_hooks_for_event(HookTrigger::TaskCompleted, context).await
    }

    // Private helper methods

    async fn trigger_hooks_for_event(
        &self,
        trigger: HookTrigger,
        context: HashMap<String, Value>,
    ) -> BinderyResult<()> {
        let hook_agents = self.hook_agents.read().await;
        
        for hook in hook_agents.values() {
            if hook.trigger == trigger && hook.enabled {
                // Check if conditions are met
                let conditions_met = hook.conditions.iter()
                    .all(|condition| condition.evaluate(&context));
                
                if conditions_met {
                    // Execute hook asynchronously
                    let hook_clone = hook.clone();
                    let context_clone = context.clone();
                    let execution_history = self.execution_history.clone();
                    
                    tokio::spawn(async move {
                        let result = Self::execute_hook_actions_static(&hook_clone, &context_clone).await;
                        
                        if let Ok(execution_result) = result {
                            execution_history.write().await.push(execution_result);
                        }
                    });
                }
            }
        }
        
        Ok(())
    }

    async fn execute_hook_actions(
        &self,
        hook: &HookAgent,
        context: &HashMap<String, Value>,
    ) -> BinderyResult<HookExecutionResult> {
        let start_time = std::time::Instant::now();
        let execution_time = Utc::now();
        
        let mut outputs = Vec::new();
        let mut errors = Vec::new();
        
        for action in &hook.actions {
            match self.execute_hook_action(action, context).await {
                Ok(output) => outputs.push(output),
                Err(e) => errors.push(format!("{}", e)),
            }
        }
        
        let duration = start_time.elapsed();
        let success = errors.is_empty();
        
        Ok(HookExecutionResult {
            hook_id: hook.id.clone(),
            success,
            output: if outputs.is_empty() { None } else { Some(outputs.join("; ")) },
            error: if errors.is_empty() { None } else { Some(errors.join("; ")) },
            execution_time,
            duration,
            triggered_by: hook.trigger.clone(),
            context_data: context.clone(),
        })
    }

    async fn execute_hook_action(
        &self,
        action: &HookAction,
        context: &HashMap<String, Value>,
    ) -> BinderyResult<String> {
        match action.action_type {
            ActionType::UpdateField => {
                // Update a field in the Codex
                if let (Some(codex_id), Some(field), Some(value)) = (
                    context.get("task_id").and_then(|v| v.as_str()),
                    action.parameters.get("field").and_then(|v| v.as_str()),
                    action.parameters.get("value")
                ) {
                    let codex_id: CodexId = codex_id.parse().map_err(|e| BinderyError::InvalidInput(format!("Invalid CodexId: {}", e)))?;
                    let mut updates = HashMap::new();
                    updates.insert(field.to_string(), crate::templates::TemplateValue::from_json(value.clone())?);
                    
                    self.codex_manager.update_codex_fields(&codex_id, updates).await?;
                    Ok(format!("Updated field '{}' in codex {}", field, codex_id))
                } else {
                    Err(BinderyError::InvalidInput("Missing required parameters for UpdateField action".to_string()))
                }
            },
            
            ActionType::CreateTask => {
                // Create a new task Codex
                if let Some(title) = action.parameters.get("title").and_then(|v| v.as_str()) {
                    let template_id = "vespera.templates.hierarchical_task".to_string();
                    let codex_id = self.codex_manager.create_codex(title.to_string(), template_id).await?;
                    Ok(format!("Created new task codex: {}", codex_id))
                } else {
                    Err(BinderyError::InvalidInput("Missing title parameter for CreateTask action".to_string()))
                }
            },
            
            ActionType::NotifyUser => {
                // Send notification (placeholder implementation)
                let message = action.parameters.get("message")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Hook notification");
                    
                tracing::info!("Hook notification: {}", message);
                Ok(format!("Notification sent: {}", message))
            },
            
            ActionType::LogEvent => {
                // Log an event
                let message = action.parameters.get("message")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Hook event logged");
                    
                tracing::info!("Hook event: {} - Context: {:?}", message, context);
                Ok(format!("Event logged: {}", message))
            },
            
            _ => {
                // TODO: Implement remaining action types
                Ok(format!("Action type {:?} not yet implemented", action.action_type))
            }
        }
    }

    // Static method for background execution
    async fn execute_hook_actions_static(
        hook: &HookAgent,
        context: &HashMap<String, Value>,
    ) -> BinderyResult<HookExecutionResult> {
        let start_time = std::time::Instant::now();
        let execution_time = Utc::now();
        
        // Simplified implementation for background execution
        let duration = start_time.elapsed();
        
        Ok(HookExecutionResult {
            hook_id: hook.id.clone(),
            success: true,
            output: Some(format!("Background execution of hook '{}'", hook.name)),
            error: None,
            execution_time,
            duration,
            triggered_by: hook.trigger.clone(),
            context_data: context.clone(),
        })
    }

    async fn execute_timed_agent_actions(
        agent: &TimedAgent,
        codex_manager: &Arc<CodexManager>,
    ) -> BinderyResult<HookExecutionResult> {
        let start_time = std::time::Instant::now();
        let execution_time = Utc::now();
        
        // Execute timed agent actions (simplified implementation)
        let duration = start_time.elapsed();
        
        Ok(HookExecutionResult {
            hook_id: agent.id.clone(),
            success: true,
            output: Some(format!("Timed agent '{}' executed", agent.name)),
            error: None,
            execution_time,
            duration,
            triggered_by: HookTrigger::TimeScheduled,
            context_data: HashMap::new(),
        })
    }

    fn parse_automation_rule_to_hook(&self, hook_id: &str, input: &HookAgentInput) -> BinderyResult<HookAgent> {
        // Parse the automation rule JSON to create a hook agent
        // This is a simplified implementation
        
        let rule = &input.automation_rule;
        let trigger_str = rule.get("trigger")
            .and_then(|v| v.as_str())
            .unwrap_or("post_task_create");
        
        let trigger = match trigger_str {
            "pre_task_create" => HookTrigger::PreTaskCreate,
            "post_task_create" => HookTrigger::PostTaskCreate,
            "pre_task_update" => HookTrigger::PreTaskUpdate,
            "post_task_update" => HookTrigger::PostTaskUpdate,
            "task_completed" => HookTrigger::TaskCompleted,
            "field_change" => HookTrigger::FieldChange,
            _ => HookTrigger::CustomEvent,
        };
        
        let name = rule.get("name")
            .and_then(|v| v.as_str())
            .unwrap_or(&input.template_name)
            .to_string();
        
        let description = rule.get("description")
            .and_then(|v| v.as_str())
            .unwrap_or("Template-generated hook agent")
            .to_string();
        
        Ok(HookAgent {
            id: hook_id.to_string(),
            name,
            description,
            trigger,
            conditions: vec![], // TODO: Parse conditions from rule
            actions: vec![],    // TODO: Parse actions from rule
            template_id: Some(input.template_id.clone()),
            enabled: true,
            created_at: Utc::now(),
            last_executed: None,
            execution_count: 0,
        })
    }

    fn parse_schedule_config_to_agent(&self, agent_id: &str, input: &TimedAgentInput) -> BinderyResult<TimedAgent> {
        // Parse the schedule configuration to create a timed agent
        // This is a simplified implementation
        
        let schedule_config = &input.schedule_config;
        let schedule_type = schedule_config.get("type")
            .and_then(|v| v.as_str())
            .unwrap_or("interval");
        
        let schedule = super::Schedule {
            schedule_type: match schedule_type {
                "interval" => super::ScheduleType::Interval,
                "daily" => super::ScheduleType::Daily,
                "weekly" => super::ScheduleType::Weekly,
                "monthly" => super::ScheduleType::Monthly,
                "once" => super::ScheduleType::Once,
                _ => super::ScheduleType::Interval,
            },
            interval: schedule_config.get("interval")
                .and_then(|v| v.as_u64())
                .map(|secs| std::time::Duration::from_secs(secs)),
            cron_expression: schedule_config.get("cron")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            timezone: None,
            start_time: None,
            end_time: None,
        };
        
        let next_execution = schedule.next_execution(Utc::now());
        
        let name = input.automation_rule.get("name")
            .and_then(|v| v.as_str())
            .unwrap_or(&input.template_name)
            .to_string();
        
        Ok(TimedAgent {
            id: agent_id.to_string(),
            name,
            description: "Template-generated timed agent".to_string(),
            schedule,
            actions: vec![], // TODO: Parse actions from automation rule
            template_id: Some(input.template_id.clone()),
            enabled: true,
            created_at: Utc::now(),
            last_executed: None,
            next_execution,
            execution_count: 0,
        })
    }

    fn task_input_to_context(&self, input: &TaskInput) -> HashMap<String, Value> {
        let mut context = HashMap::new();
        
        context.insert("title".to_string(), Value::String(input.title.clone()));
        
        if let Some(description) = &input.description {
            context.insert("description".to_string(), Value::String(description.clone()));
        }
        
        if let Some(priority) = &input.priority {
            context.insert("priority".to_string(), serde_json::to_value(priority).unwrap_or(Value::Null));
        }
        
        if let Some(project_id) = &input.project_id {
            context.insert("project_id".to_string(), Value::String(project_id.clone()));
        }
        
        context.insert("tags".to_string(), serde_json::to_value(&input.tags).unwrap_or(Value::Null));
        context.insert("labels".to_string(), serde_json::to_value(&input.labels).unwrap_or(Value::Null));
        
        context
    }

    fn task_update_to_context(&self, input: &TaskUpdateInput, task: Option<&Codex>) -> HashMap<String, Value> {
        let mut context = HashMap::new();
        
        context.insert("task_id".to_string(), Value::String(input.task_id.to_string()));
        
        if let Some(title) = &input.title {
            context.insert("title_new".to_string(), Value::String(title.clone()));
        }
        
        if let Some(status) = &input.status {
            context.insert("status_new".to_string(), serde_json::to_value(status).unwrap_or(Value::Null));
        }
        
        if let Some(task) = task {
            // Add old values for change detection
            if let Some(old_status) = task.content.template_fields.get("status") {
                context.insert("status_old".to_string(), old_status.as_json_value());
            }
        }
        
        context
    }
}