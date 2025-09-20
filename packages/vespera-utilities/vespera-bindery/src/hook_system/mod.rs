/// Hook System for Vespera Bindery
/// 
/// This module migrates the Python hook system to Rust, providing
/// template-driven automation and event handling for Codex entries.

pub mod manager;
pub mod agents;
pub mod scheduler;

pub use manager::HookManager;
// Note: HookAgent and TimedAgent structs are defined below, so we don't import them from agents

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use chrono::{DateTime, Utc};

/// Hook trigger types for different events
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HookTrigger {
    PreTaskCreate,
    PostTaskCreate,
    PreTaskUpdate,
    PostTaskUpdate,
    PreTaskDelete,
    PostTaskDelete,
    TaskCompleted,
    TaskStatusChange,
    FieldChange,
    TimeScheduled,
    CustomEvent,
}

/// Hook agent configuration from templates
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookAgentInput {
    pub template_id: String,
    pub template_name: String,
    pub automation_rule: serde_json::Value,
    pub field_schema: HashMap<String, serde_json::Value>,
    pub template_data: HashMap<String, serde_json::Value>,
    pub context: Option<HashMap<String, serde_json::Value>>,
}

/// Timed agent configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimedAgentInput {
    pub template_id: String,
    pub template_name: String,
    pub automation_rule: serde_json::Value,
    pub field_schema: HashMap<String, serde_json::Value>,
    pub template_data: HashMap<String, serde_json::Value>,
    pub schedule_config: HashMap<String, serde_json::Value>,
}

/// Hook trigger context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookTriggerInput {
    pub hook_id: String,
    pub trigger_context: HashMap<String, serde_json::Value>,
    pub force_execute: bool,
}

/// Hook execution result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookExecutionResult {
    pub hook_id: String,
    pub success: bool,
    pub output: Option<String>,
    pub error: Option<String>,
    pub execution_time: DateTime<Utc>,
    pub duration: std::time::Duration,
    pub triggered_by: HookTrigger,
    pub context_data: HashMap<String, serde_json::Value>,
}

/// Hook agent definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookAgent {
    pub id: String,
    pub name: String,
    pub description: String,
    pub trigger: HookTrigger,
    pub conditions: Vec<HookCondition>,
    pub actions: Vec<HookAction>,
    pub template_id: Option<String>,
    pub enabled: bool,
    pub created_at: DateTime<Utc>,
    pub last_executed: Option<DateTime<Utc>>,
    pub execution_count: u64,
}

/// Condition that must be met for hook execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookCondition {
    pub field: String,
    pub operator: ConditionOperator,
    pub value: serde_json::Value,
    pub context_aware: bool,
}

/// Condition operators for hook conditions
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConditionOperator {
    Equals,
    NotEquals,
    Contains,
    StartsWith,
    EndsWith,
    GreaterThan,
    LessThan,
    GreaterOrEqual,
    LessOrEqual,
    In,
    NotIn,
    Changed,
    ChangedFrom,
    ChangedTo,
}

/// Action to take when hook is triggered
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookAction {
    pub action_type: ActionType,
    pub parameters: HashMap<String, serde_json::Value>,
    pub async_execution: bool,
    pub retry_config: Option<RetryConfig>,
}

/// Types of actions that hooks can perform
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ActionType {
    UpdateField,
    CreateTask,
    NotifyUser,
    ExecuteScript,
    CallWebhook,
    SendEmail,
    UpdateEnvironment,
    TriggerWorkflow,
    LogEvent,
    CreateCodex,
    UpdateCodex,
    DeleteCodex,
}

/// Retry configuration for hook actions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetryConfig {
    pub max_attempts: u32,
    pub initial_delay: std::time::Duration,
    pub backoff_multiplier: f64,
    pub max_delay: std::time::Duration,
}

/// Timed agent for scheduled execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimedAgent {
    pub id: String,
    pub name: String,
    pub description: String,
    pub schedule: Schedule,
    pub actions: Vec<HookAction>,
    pub template_id: Option<String>,
    pub enabled: bool,
    pub created_at: DateTime<Utc>,
    pub last_executed: Option<DateTime<Utc>>,
    pub next_execution: Option<DateTime<Utc>>,
    pub execution_count: u64,
}

/// Schedule configuration for timed agents
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Schedule {
    pub schedule_type: ScheduleType,
    pub interval: Option<std::time::Duration>,
    pub cron_expression: Option<String>,
    pub timezone: Option<String>,
    pub start_time: Option<DateTime<Utc>>,
    pub end_time: Option<DateTime<Utc>>,
}

/// Types of schedules for timed agents
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ScheduleType {
    Interval,
    Cron,
    Once,
    Daily,
    Weekly,
    Monthly,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_attempts: 3,
            initial_delay: std::time::Duration::from_secs(1),
            backoff_multiplier: 2.0,
            max_delay: std::time::Duration::from_secs(60),
        }
    }
}

impl HookCondition {
    /// Evaluate if this condition is met given the provided context
    pub fn evaluate(&self, context: &HashMap<String, serde_json::Value>) -> bool {
        let field_value = context.get(&self.field);
        
        match &self.operator {
            ConditionOperator::Equals => field_value == Some(&self.value),
            ConditionOperator::NotEquals => field_value != Some(&self.value),
            ConditionOperator::Contains => {
                if let (Some(field_val), Some(search_val)) = (field_value, self.value.as_str()) {
                    if let Some(field_str) = field_val.as_str() {
                        return field_str.contains(search_val);
                    }
                }
                false
            },
            ConditionOperator::Changed => {
                // Check if field has changed (requires old and new values in context)
                context.contains_key(&format!("{}_old", self.field)) && 
                context.contains_key(&format!("{}_new", self.field))
            },
            ConditionOperator::ChangedFrom => {
                let old_value = context.get(&format!("{}_old", self.field));
                old_value == Some(&self.value)
            },
            ConditionOperator::ChangedTo => {
                let new_value = context.get(&format!("{}_new", self.field));
                new_value == Some(&self.value)
            },
            _ => {
                // TODO: Implement remaining operators
                false
            }
        }
    }
}

impl Schedule {
    /// Calculate the next execution time for this schedule
    pub fn next_execution(&self, from_time: DateTime<Utc>) -> Option<DateTime<Utc>> {
        match self.schedule_type {
            ScheduleType::Interval => {
                if let Some(interval) = self.interval {
                    Some(from_time + chrono::Duration::from_std(interval).ok()?)
                } else {
                    None
                }
            },
            ScheduleType::Once => self.start_time,
            ScheduleType::Daily => {
                Some(from_time + chrono::Duration::days(1))
            },
            ScheduleType::Weekly => {
                Some(from_time + chrono::Duration::weeks(1))
            },
            ScheduleType::Monthly => {
                Some(from_time + chrono::Duration::days(30)) // Approximate
            },
            ScheduleType::Cron => {
                // TODO: Implement cron parsing
                None
            },
        }
    }
}