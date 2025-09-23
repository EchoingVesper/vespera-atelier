//! Audit logging system for security-sensitive operations
//!
//! This module provides comprehensive audit logging functionality for
//! tracking and analyzing security-sensitive operations in the Vespera
//! Bindery system. It implements tamper-resistant logging with cryptographic
//! hash chaining and separate storage for audit data.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};
use sqlx::{Pool, Sqlite, Row};
use tokio::sync::RwLock;
use tracing::{info, warn, error, debug};
use uuid::Uuid;

use crate::errors::{BinderyError, BinderyResult};

/// Audit event representing a security-sensitive operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEvent {
    /// Unique identifier for this audit event
    pub id: String,
    /// ISO 8601 timestamp when the event occurred
    pub timestamp: DateTime<Utc>,
    /// User context information
    pub user_context: UserContext,
    /// Operation details
    pub operation: Operation,
    /// Security context at time of operation
    pub security_context: SecurityContext,
    /// Outcome of the operation
    pub outcome: OperationOutcome,
    /// Previous event hash for tamper detection
    pub previous_hash: Option<String>,
    /// Hash of this event's data
    pub event_hash: String,
    /// Additional metadata
    pub metadata: HashMap<String, serde_json::Value>,
}

/// User context information for audit events
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserContext {
    /// User identifier (if authenticated)
    pub user_id: Option<String>,
    /// Session identifier
    pub session_id: Option<String>,
    /// Source IP address (if available)
    pub source_ip: Option<String>,
    /// User agent or client information
    pub user_agent: Option<String>,
}

/// Operation being audited
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Operation {
    /// Type of operation (e.g., "role_execution", "migration", "task_execution")
    pub operation_type: String,
    /// Specific action being performed
    pub action: String,
    /// Resource being acted upon
    pub resource: String,
    /// Additional operation-specific data
    pub details: HashMap<String, serde_json::Value>,
}

/// Security context at time of operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityContext {
    /// Active roles at time of operation
    pub roles: Vec<String>,
    /// Permissions granted
    pub permissions: Vec<String>,
    /// Security level or clearance
    pub security_level: Option<String>,
    /// Authentication method used
    pub auth_method: Option<String>,
}

/// Outcome of the audited operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationOutcome {
    /// Whether the operation succeeded
    pub success: bool,
    /// HTTP status code or operation result code
    pub result_code: Option<i32>,
    /// Error message if operation failed
    pub error_message: Option<String>,
    /// Duration of the operation in milliseconds
    pub duration_ms: i64,
    /// Number of records affected (for data operations)
    pub records_affected: Option<i64>,
}

/// Audit configuration settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditConfig {
    /// Path to the audit database
    pub audit_db_path: PathBuf,
    /// Enable hash chaining for tamper detection
    pub enable_hash_chaining: bool,
    /// Maximum number of audit events to keep
    pub max_events: Option<usize>,
    /// Retention period in days
    pub retention_days: Option<u32>,
    /// Enable compression for old audit events
    pub enable_compression: bool,
    /// Batch size for bulk operations
    pub batch_size: usize,
}

impl Default for AuditConfig {
    fn default() -> Self {
        Self {
            audit_db_path: PathBuf::from("audit.db"),
            enable_hash_chaining: true,
            max_events: Some(1_000_000),
            retention_days: Some(365), // 1 year default retention
            enable_compression: true,
            batch_size: 1000,
        }
    }
}

/// Audit query filters for searching audit events
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AuditQueryFilter {
    /// Filter by operation type
    pub operation_type: Option<String>,
    /// Filter by user ID
    pub user_id: Option<String>,
    /// Filter by success/failure
    pub success: Option<bool>,
    /// Start timestamp for range queries
    pub start_time: Option<DateTime<Utc>>,
    /// End timestamp for range queries
    pub end_time: Option<DateTime<Utc>>,
    /// Filter by resource
    pub resource: Option<String>,
    /// Maximum number of results to return
    pub limit: Option<i64>,
    /// Offset for pagination
    pub offset: Option<i64>,
}

/// Statistics about audit events
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditStats {
    /// Total number of audit events
    pub total_events: i64,
    /// Number of successful operations
    pub successful_operations: i64,
    /// Number of failed operations
    pub failed_operations: i64,
    /// Breakdown by operation type
    pub operation_type_breakdown: HashMap<String, i64>,
    /// Breakdown by user
    pub user_breakdown: HashMap<String, i64>,
    /// Most recent event timestamp
    pub last_event_time: Option<DateTime<Utc>>,
    /// Oldest event timestamp
    pub first_event_time: Option<DateTime<Utc>>,
    /// Hash chain integrity status
    pub hash_chain_valid: bool,
}

/// Main audit logger implementation
#[derive(Debug)]
pub struct AuditLogger {
    config: AuditConfig,
    pool: Pool<Sqlite>,
    last_hash: Arc<RwLock<Option<String>>>,
}

impl AuditLogger {
    /// Create a new audit logger with the specified configuration
    pub async fn new(config: AuditConfig) -> BinderyResult<Self> {
        // Create audit database connection
        let database_url = format!("sqlite:{}", config.audit_db_path.display());
        let pool = sqlx::SqlitePool::connect(&database_url)
            .await
            .map_err(|e| BinderyError::DatabaseError(format!("Failed to connect to audit database: {}", e)))?;

        let logger = Self {
            config,
            pool,
            last_hash: Arc::new(RwLock::new(None)),
        };

        // Initialize audit schema
        logger.initialize_schema().await?;

        // Load last hash for chain validation
        logger.load_last_hash().await?;

        info!("Audit logger initialized with database: {:?}", logger.config.audit_db_path);
        Ok(logger)
    }

    /// Initialize the audit database schema
    async fn initialize_schema(&self) -> BinderyResult<()> {
        // Create audit events table
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS audit_events (
                id TEXT PRIMARY KEY,
                timestamp TEXT NOT NULL,
                user_id TEXT,
                session_id TEXT,
                source_ip TEXT,
                user_agent TEXT,
                operation_type TEXT NOT NULL,
                action TEXT NOT NULL,
                resource TEXT NOT NULL,
                security_context TEXT NOT NULL,
                outcome TEXT NOT NULL,
                previous_hash TEXT,
                event_hash TEXT NOT NULL,
                metadata TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            "#,
        )
        .execute(&self.pool)
        .await
        .map_err(|e| BinderyError::DatabaseError(format!("Failed to create audit_events table: {}", e)))?;

        // Create indexes for common queries
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_events(timestamp)")
            .execute(&self.pool)
            .await
            .map_err(|e| BinderyError::DatabaseError(format!("Failed to create timestamp index: {}", e)))?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_events(user_id)")
            .execute(&self.pool)
            .await
            .map_err(|e| BinderyError::DatabaseError(format!("Failed to create user_id index: {}", e)))?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_audit_operation_type ON audit_events(operation_type)")
            .execute(&self.pool)
            .await
            .map_err(|e| BinderyError::DatabaseError(format!("Failed to create operation_type index: {}", e)))?;

        // Create hash chain validation table
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS audit_chain_state (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                last_hash TEXT,
                last_event_id TEXT,
                chain_length INTEGER DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            "#,
        )
        .execute(&self.pool)
        .await
        .map_err(|e| BinderyError::DatabaseError(format!("Failed to create audit_chain_state table: {}", e)))?;

        // Initialize chain state if empty
        sqlx::query("INSERT OR IGNORE INTO audit_chain_state (id, chain_length) VALUES (1, 0)")
            .execute(&self.pool)
            .await
            .map_err(|e| BinderyError::DatabaseError(format!("Failed to initialize chain state: {}", e)))?;

        Ok(())
    }

    /// Load the last hash from the database for chain validation
    async fn load_last_hash(&self) -> BinderyResult<()> {
        let row = sqlx::query("SELECT last_hash FROM audit_chain_state WHERE id = 1")
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| BinderyError::DatabaseError(format!("Failed to load last hash: {}", e)))?;

        if let Some(row) = row {
            let last_hash: Option<String> = row.try_get("last_hash")?;
            *self.last_hash.write().await = last_hash;
        }

        Ok(())
    }

    /// Log an audit event
    pub async fn log_event(&self, event: AuditEvent) -> BinderyResult<()> {
        let mut event = event;

        // Set hash chain if enabled
        if self.config.enable_hash_chaining {
            let last_hash = self.last_hash.read().await.clone();
            event.previous_hash = last_hash;
        }

        // Calculate event hash
        event.event_hash = self.calculate_event_hash(&event)?;

        // Store event in database
        self.store_event(&event).await?;

        // Update hash chain state
        if self.config.enable_hash_chaining {
            *self.last_hash.write().await = Some(event.event_hash.clone());
            self.update_chain_state(&event).await?;
        }

        debug!("Audit event logged: {} - {}", event.operation.operation_type, event.operation.action);
        Ok(())
    }

    /// Store an audit event in the database
    async fn store_event(&self, event: &AuditEvent) -> BinderyResult<()> {
        sqlx::query(
            r#"
            INSERT INTO audit_events (
                id, timestamp, user_id, session_id, source_ip, user_agent,
                operation_type, action, resource, security_context, outcome,
                previous_hash, event_hash, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&event.id)
        .bind(event.timestamp.to_rfc3339())
        .bind(&event.user_context.user_id)
        .bind(&event.user_context.session_id)
        .bind(&event.user_context.source_ip)
        .bind(&event.user_context.user_agent)
        .bind(&event.operation.operation_type)
        .bind(&event.operation.action)
        .bind(&event.operation.resource)
        .bind(serde_json::to_string(&event.security_context)?)
        .bind(serde_json::to_string(&event.outcome)?)
        .bind(&event.previous_hash)
        .bind(&event.event_hash)
        .bind(serde_json::to_string(&event.metadata)?)
        .execute(&self.pool)
        .await
        .map_err(|e| BinderyError::DatabaseError(format!("Failed to store audit event: {}", e)))?;

        Ok(())
    }

    /// Update the hash chain state
    async fn update_chain_state(&self, event: &AuditEvent) -> BinderyResult<()> {
        sqlx::query(
            "UPDATE audit_chain_state SET last_hash = ?, last_event_id = ?, chain_length = chain_length + 1, updated_at = CURRENT_TIMESTAMP WHERE id = 1"
        )
        .bind(&event.event_hash)
        .bind(&event.id)
        .execute(&self.pool)
        .await
        .map_err(|e| BinderyError::DatabaseError(format!("Failed to update chain state: {}", e)))?;

        Ok(())
    }

    /// Calculate the hash of an audit event
    fn calculate_event_hash(&self, event: &AuditEvent) -> BinderyResult<String> {
        let mut hasher = Sha256::new();

        // Include all relevant fields in hash calculation
        hasher.update(event.id.as_bytes());
        hasher.update(event.timestamp.to_rfc3339().as_bytes());
        hasher.update(event.operation.operation_type.as_bytes());
        hasher.update(event.operation.action.as_bytes());
        hasher.update(event.operation.resource.as_bytes());

        if let Some(user_id) = &event.user_context.user_id {
            hasher.update(user_id.as_bytes());
        }

        if let Some(prev_hash) = &event.previous_hash {
            hasher.update(prev_hash.as_bytes());
        }

        // Include serialized security context and outcome
        let security_context_json = serde_json::to_string(&event.security_context)?;
        let outcome_json = serde_json::to_string(&event.outcome)?;
        hasher.update(security_context_json.as_bytes());
        hasher.update(outcome_json.as_bytes());

        Ok(format!("{:x}", hasher.finalize()))
    }

    /// Query audit events with filters
    pub async fn query_events(&self, filter: AuditQueryFilter) -> BinderyResult<Vec<AuditEvent>> {
        let mut query = "SELECT * FROM audit_events WHERE 1=1".to_string();
        let mut conditions = Vec::new();

        // Build WHERE conditions
        if let Some(op_type) = &filter.operation_type {
            conditions.push(format!("operation_type = '{}'", op_type));
        }
        if let Some(user_id) = &filter.user_id {
            conditions.push(format!("user_id = '{}'", user_id));
        }
        if let Some(success) = filter.success {
            conditions.push(format!("JSON_EXTRACT(outcome, '$.success') = {}", success));
        }
        if let Some(start_time) = filter.start_time {
            conditions.push(format!("timestamp >= '{}'", start_time.to_rfc3339()));
        }
        if let Some(end_time) = filter.end_time {
            conditions.push(format!("timestamp <= '{}'", end_time.to_rfc3339()));
        }
        if let Some(resource) = &filter.resource {
            conditions.push(format!("resource = '{}'", resource));
        }

        if !conditions.is_empty() {
            query.push_str(" AND ");
            query.push_str(&conditions.join(" AND "));
        }

        query.push_str(" ORDER BY timestamp DESC");

        if let Some(limit) = filter.limit {
            query.push_str(&format!(" LIMIT {}", limit));
        }
        if let Some(offset) = filter.offset {
            query.push_str(&format!(" OFFSET {}", offset));
        }

        let rows = sqlx::query(&query)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| BinderyError::DatabaseError(format!("Failed to query audit events: {}", e)))?;

        let mut events = Vec::new();
        for row in rows {
            let event = self.row_to_audit_event(&row)?;
            events.push(event);
        }

        Ok(events)
    }

    /// Convert a database row to an AuditEvent
    fn row_to_audit_event(&self, row: &sqlx::sqlite::SqliteRow) -> BinderyResult<AuditEvent> {
        let timestamp_str: String = row.try_get("timestamp")?;
        let timestamp = DateTime::parse_from_rfc3339(&timestamp_str)
            .map_err(|e| BinderyError::InvalidInput(format!("Invalid timestamp: {}", e)))?
            .with_timezone(&Utc);

        let security_context_json: String = row.try_get("security_context")?;
        let security_context: SecurityContext = serde_json::from_str(&security_context_json)?;

        let outcome_json: String = row.try_get("outcome")?;
        let outcome: OperationOutcome = serde_json::from_str(&outcome_json)?;

        let metadata_json: Option<String> = row.try_get("metadata")?;
        let metadata: HashMap<String, serde_json::Value> = if let Some(json) = metadata_json {
            serde_json::from_str(&json)?
        } else {
            HashMap::new()
        };

        // Extract operation details from stored data
        let operation_details: HashMap<String, serde_json::Value> = HashMap::new(); // TODO: Store operation details separately

        Ok(AuditEvent {
            id: row.try_get("id")?,
            timestamp,
            user_context: UserContext {
                user_id: row.try_get("user_id")?,
                session_id: row.try_get("session_id")?,
                source_ip: row.try_get("source_ip")?,
                user_agent: row.try_get("user_agent")?,
            },
            operation: Operation {
                operation_type: row.try_get("operation_type")?,
                action: row.try_get("action")?,
                resource: row.try_get("resource")?,
                details: operation_details,
            },
            security_context,
            outcome,
            previous_hash: row.try_get("previous_hash")?,
            event_hash: row.try_get("event_hash")?,
            metadata,
        })
    }

    /// Get audit statistics
    pub async fn get_stats(&self) -> BinderyResult<AuditStats> {
        // Get total count
        let total_row = sqlx::query("SELECT COUNT(*) as total FROM audit_events")
            .fetch_one(&self.pool)
            .await
            .map_err(|e| BinderyError::DatabaseError(format!("Failed to get total count: {}", e)))?;
        let total_events: i64 = total_row.try_get("total")?;

        // Get success/failure counts
        let success_row = sqlx::query("SELECT COUNT(*) as count FROM audit_events WHERE JSON_EXTRACT(outcome, '$.success') = true")
            .fetch_one(&self.pool)
            .await
            .map_err(|e| BinderyError::DatabaseError(format!("Failed to get success count: {}", e)))?;
        let successful_operations: i64 = success_row.try_get("count")?;

        let failed_operations = total_events - successful_operations;

        // Get operation type breakdown
        let op_type_rows = sqlx::query("SELECT operation_type, COUNT(*) as count FROM audit_events GROUP BY operation_type")
            .fetch_all(&self.pool)
            .await
            .map_err(|e| BinderyError::DatabaseError(format!("Failed to get operation type breakdown: {}", e)))?;

        let mut operation_type_breakdown = HashMap::new();
        for row in op_type_rows {
            let op_type: String = row.try_get("operation_type")?;
            let count: i64 = row.try_get("count")?;
            operation_type_breakdown.insert(op_type, count);
        }

        // Get user breakdown
        let user_rows = sqlx::query("SELECT user_id, COUNT(*) as count FROM audit_events WHERE user_id IS NOT NULL GROUP BY user_id")
            .fetch_all(&self.pool)
            .await
            .map_err(|e| BinderyError::DatabaseError(format!("Failed to get user breakdown: {}", e)))?;

        let mut user_breakdown = HashMap::new();
        for row in user_rows {
            let user_id: String = row.try_get("user_id")?;
            let count: i64 = row.try_get("count")?;
            user_breakdown.insert(user_id, count);
        }

        // Get first and last event times
        let time_range_row = sqlx::query("SELECT MIN(timestamp) as first, MAX(timestamp) as last FROM audit_events")
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| BinderyError::DatabaseError(format!("Failed to get time range: {}", e)))?;

        let (first_event_time, last_event_time) = if let Some(row) = time_range_row {
            let first: Option<String> = row.try_get("first")?;
            let last: Option<String> = row.try_get("last")?;

            let first_time = first.and_then(|s| DateTime::parse_from_rfc3339(&s).ok())
                .map(|dt| dt.with_timezone(&Utc));
            let last_time = last.and_then(|s| DateTime::parse_from_rfc3339(&s).ok())
                .map(|dt| dt.with_timezone(&Utc));

            (first_time, last_time)
        } else {
            (None, None)
        };

        // Validate hash chain
        let hash_chain_valid = self.validate_hash_chain().await?;

        Ok(AuditStats {
            total_events,
            successful_operations,
            failed_operations,
            operation_type_breakdown,
            user_breakdown,
            first_event_time,
            last_event_time,
            hash_chain_valid,
        })
    }

    /// Validate the integrity of the hash chain
    pub async fn validate_hash_chain(&self) -> BinderyResult<bool> {
        if !self.config.enable_hash_chaining {
            return Ok(true); // No chain to validate
        }

        let events = self.query_events(AuditQueryFilter {
            limit: None,
            ..Default::default()
        }).await?;

        if events.is_empty() {
            return Ok(true);
        }

        // Check each event's hash
        for event in &events {
            let calculated_hash = self.calculate_event_hash(event)?;
            if calculated_hash != event.event_hash {
                warn!("Hash mismatch detected for event {}: expected {}, got {}",
                      event.id, event.event_hash, calculated_hash);
                return Ok(false);
            }
        }

        // Check chain linkage
        for i in 1..events.len() {
            let current = &events[i];
            let previous = &events[i - 1];

            if current.previous_hash.as_ref() != Some(&previous.event_hash) {
                warn!("Hash chain break detected between events {} and {}",
                      previous.id, current.id);
                return Ok(false);
            }
        }

        Ok(true)
    }

    /// Clean up old audit events based on retention policy
    pub async fn cleanup_old_events(&self) -> BinderyResult<usize> {
        let mut deleted_count = 0;

        // Clean up by retention days
        if let Some(retention_days) = self.config.retention_days {
            let cutoff_date = Utc::now() - chrono::Duration::days(retention_days as i64);

            let result = sqlx::query("DELETE FROM audit_events WHERE timestamp < ?")
                .bind(cutoff_date.to_rfc3339())
                .execute(&self.pool)
                .await
                .map_err(|e| BinderyError::DatabaseError(format!("Failed to delete old events: {}", e)))?;

            deleted_count += result.rows_affected() as usize;
        }

        // Clean up by max events count
        if let Some(max_events) = self.config.max_events {
            let count_row = sqlx::query("SELECT COUNT(*) as count FROM audit_events")
                .fetch_one(&self.pool)
                .await
                .map_err(|e| BinderyError::DatabaseError(format!("Failed to count events: {}", e)))?;

            let total_count: i64 = count_row.try_get("count")?;

            if total_count > max_events as i64 {
                let excess = total_count - max_events as i64;

                let result = sqlx::query(
                    "DELETE FROM audit_events WHERE id IN (SELECT id FROM audit_events ORDER BY timestamp ASC LIMIT ?)"
                )
                .bind(excess)
                .execute(&self.pool)
                .await
                .map_err(|e| BinderyError::DatabaseError(format!("Failed to delete excess events: {}", e)))?;

                deleted_count += result.rows_affected() as usize;
            }
        }

        if deleted_count > 0 {
            info!("Cleaned up {} old audit events", deleted_count);
        }

        Ok(deleted_count)
    }
}

/// Helper functions for creating common audit events

/// Create a role execution audit event
pub fn create_role_execution_event(
    user_context: UserContext,
    role_name: &str,
    task_id: &str,
    outcome: OperationOutcome,
    permissions: Vec<String>,
) -> AuditEvent {
    let mut details = HashMap::new();
    details.insert("role_name".to_string(), serde_json::Value::String(role_name.to_string()));
    details.insert("task_id".to_string(), serde_json::Value::String(task_id.to_string()));

    AuditEvent {
        id: Uuid::new_v4().to_string(),
        timestamp: Utc::now(),
        user_context,
        operation: Operation {
            operation_type: "role_execution".to_string(),
            action: "execute_task".to_string(),
            resource: format!("task:{}", task_id),
            details,
        },
        security_context: SecurityContext {
            roles: vec![role_name.to_string()],
            permissions,
            security_level: None,
            auth_method: None,
        },
        outcome,
        previous_hash: None, // Will be set by logger
        event_hash: String::new(), // Will be calculated by logger
        metadata: HashMap::new(),
    }
}

/// Create a migration audit event
pub fn create_migration_event(
    user_context: UserContext,
    migration_version: i64,
    migration_name: &str,
    action: &str,
    outcome: OperationOutcome,
) -> AuditEvent {
    let mut details = HashMap::new();
    details.insert("migration_version".to_string(), serde_json::Value::Number(migration_version.into()));
    details.insert("migration_name".to_string(), serde_json::Value::String(migration_name.to_string()));

    AuditEvent {
        id: Uuid::new_v4().to_string(),
        timestamp: Utc::now(),
        user_context,
        operation: Operation {
            operation_type: "migration".to_string(),
            action: action.to_string(),
            resource: format!("migration:{}", migration_version),
            details,
        },
        security_context: SecurityContext {
            roles: vec!["system".to_string()],
            permissions: vec!["database:migrate".to_string()],
            security_level: Some("high".to_string()),
            auth_method: None,
        },
        outcome,
        previous_hash: None,
        event_hash: String::new(),
        metadata: HashMap::new(),
    }
}

/// Create a configuration change audit event
pub fn create_config_change_event(
    user_context: UserContext,
    config_key: &str,
    old_value: Option<&str>,
    new_value: &str,
    outcome: OperationOutcome,
) -> AuditEvent {
    let mut details = HashMap::new();
    details.insert("config_key".to_string(), serde_json::Value::String(config_key.to_string()));
    details.insert("new_value".to_string(), serde_json::Value::String(new_value.to_string()));
    if let Some(old_val) = old_value {
        details.insert("old_value".to_string(), serde_json::Value::String(old_val.to_string()));
    }

    AuditEvent {
        id: Uuid::new_v4().to_string(),
        timestamp: Utc::now(),
        user_context,
        operation: Operation {
            operation_type: "configuration".to_string(),
            action: "change_setting".to_string(),
            resource: format!("config:{}", config_key),
            details,
        },
        security_context: SecurityContext {
            roles: vec!["admin".to_string()],
            permissions: vec!["config:write".to_string()],
            security_level: Some("high".to_string()),
            auth_method: None,
        },
        outcome,
        previous_hash: None,
        event_hash: String::new(),
        metadata: HashMap::new(),
    }
}

/// Create an authentication failure audit event
pub fn create_auth_failure_event(
    user_context: UserContext,
    attempted_user_id: &str,
    failure_reason: &str,
    outcome: OperationOutcome,
) -> AuditEvent {
    let mut details = HashMap::new();
    details.insert("attempted_user_id".to_string(), serde_json::Value::String(attempted_user_id.to_string()));
    details.insert("failure_reason".to_string(), serde_json::Value::String(failure_reason.to_string()));

    AuditEvent {
        id: Uuid::new_v4().to_string(),
        timestamp: Utc::now(),
        user_context,
        operation: Operation {
            operation_type: "authentication".to_string(),
            action: "login_attempt".to_string(),
            resource: format!("user:{}", attempted_user_id),
            details,
        },
        security_context: SecurityContext {
            roles: vec![],
            permissions: vec![],
            security_level: None,
            auth_method: Some("password".to_string()),
        },
        outcome,
        previous_hash: None,
        event_hash: String::new(),
        metadata: HashMap::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    use std::time::Duration;

    async fn setup_test_audit_logger() -> (AuditLogger, TempDir) {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let audit_db_path = temp_dir.path().join("test_audit.db");

        let config = AuditConfig {
            audit_db_path,
            enable_hash_chaining: true,
            max_events: Some(1000),
            retention_days: Some(30),
            enable_compression: false,
            batch_size: 100,
        };

        let logger = AuditLogger::new(config).await.expect("Failed to create audit logger");
        (logger, temp_dir)
    }

    #[tokio::test]
    async fn test_audit_logger_creation() {
        let (_logger, _temp_dir) = setup_test_audit_logger().await;
        // If we get here, creation was successful
    }

    #[tokio::test]
    async fn test_log_audit_event() {
        let (logger, _temp_dir) = setup_test_audit_logger().await;

        let user_context = UserContext {
            user_id: Some("test_user".to_string()),
            session_id: Some("session_123".to_string()),
            source_ip: Some("127.0.0.1".to_string()),
            user_agent: Some("test-client".to_string()),
        };

        let outcome = OperationOutcome {
            success: true,
            result_code: Some(200),
            error_message: None,
            duration_ms: 100,
            records_affected: Some(1),
        };

        let event = create_role_execution_event(
            user_context,
            "test_role",
            "task_123",
            outcome,
            vec!["read".to_string(), "write".to_string()],
        );

        logger.log_event(event).await.expect("Failed to log event");

        // Verify event was stored
        let stats = logger.get_stats().await.expect("Failed to get stats");
        assert_eq!(stats.total_events, 1);
        assert_eq!(stats.successful_operations, 1);
    }

    #[tokio::test]
    async fn test_hash_chain_validation() {
        let (logger, _temp_dir) = setup_test_audit_logger().await;

        // Log multiple events
        for i in 0..5 {
            let user_context = UserContext {
                user_id: Some(format!("user_{}", i)),
                session_id: Some(format!("session_{}", i)),
                source_ip: Some("127.0.0.1".to_string()),
                user_agent: Some("test-client".to_string()),
            };

            let outcome = OperationOutcome {
                success: true,
                result_code: Some(200),
                error_message: None,
                duration_ms: 100,
                records_affected: Some(1),
            };

            let event = create_role_execution_event(
                user_context,
                "test_role",
                &format!("task_{}", i),
                outcome,
                vec!["read".to_string()],
            );

            logger.log_event(event).await.expect("Failed to log event");
        }

        // Validate hash chain
        let is_valid = logger.validate_hash_chain().await.expect("Failed to validate hash chain");
        assert!(is_valid, "Hash chain should be valid");

        let stats = logger.get_stats().await.expect("Failed to get stats");
        assert!(stats.hash_chain_valid, "Hash chain should be reported as valid in stats");
    }

    #[tokio::test]
    async fn test_query_events_with_filters() {
        let (logger, _temp_dir) = setup_test_audit_logger().await;

        // Log events for different users and operation types
        let user_contexts = vec![
            UserContext {
                user_id: Some("user_1".to_string()),
                session_id: Some("session_1".to_string()),
                source_ip: Some("127.0.0.1".to_string()),
                user_agent: Some("client_1".to_string()),
            },
            UserContext {
                user_id: Some("user_2".to_string()),
                session_id: Some("session_2".to_string()),
                source_ip: Some("127.0.0.1".to_string()),
                user_agent: Some("client_2".to_string()),
            },
        ];

        for (i, user_context) in user_contexts.iter().enumerate() {
            let outcome = OperationOutcome {
                success: i % 2 == 0, // Alternate success/failure
                result_code: Some(if i % 2 == 0 { 200 } else { 500 }),
                error_message: if i % 2 == 0 { None } else { Some("Test error".to_string()) },
                duration_ms: 100,
                records_affected: Some(1),
            };

            let event = create_role_execution_event(
                user_context.clone(),
                "test_role",
                &format!("task_{}", i),
                outcome,
                vec!["read".to_string()],
            );

            logger.log_event(event).await.expect("Failed to log event");
        }

        // Test filtering by user
        let user_1_events = logger.query_events(AuditQueryFilter {
            user_id: Some("user_1".to_string()),
            ..Default::default()
        }).await.expect("Failed to query events");

        assert_eq!(user_1_events.len(), 1);
        assert_eq!(user_1_events[0].user_context.user_id, Some("user_1".to_string()));

        // Test filtering by success
        let successful_events = logger.query_events(AuditQueryFilter {
            success: Some(true),
            ..Default::default()
        }).await.expect("Failed to query events");

        assert_eq!(successful_events.len(), 1);
        assert!(successful_events[0].outcome.success);
    }
}