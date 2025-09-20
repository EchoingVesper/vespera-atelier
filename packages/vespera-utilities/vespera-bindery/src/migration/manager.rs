//! Database migration manager for Vespera Bindery with audit logging
//!
//! Provides comprehensive database migration capabilities including:
//! - Schema versioning and migration tracking
//! - Forward and rollback migrations
//! - Transaction-safe migration execution
//! - Migration status and history reporting
//! - Comprehensive audit logging for all migration operations

use crate::errors::{BinderyError, BinderyResult};
use crate::observability::audit::{
    AuditLogger, UserContext, Operation, SecurityContext, OperationOutcome,
    create_migration_event
};
use crate::observability::metrics::BinderyMetrics;
use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{Pool, Sqlite, Row, Transaction};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tracing::{info, warn, error, debug};
use sha2::{Sha256, Digest};

/// Migration information structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MigrationInfo {
    pub version: i64,
    pub name: String,
    pub description: String,
    pub up_sql: String,
    pub down_sql: Option<String>,
    pub checksum: String,
    pub executed_at: Option<DateTime<Utc>>,
    pub execution_time_ms: Option<i64>,
}

/// Migration execution result with audit information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MigrationResult {
    pub version: i64,
    pub name: String,
    pub success: bool,
    pub execution_time_ms: i64,
    pub error_message: Option<String>,
    /// Audit event ID for tracking
    pub audit_event_id: Option<String>,
}

/// Historical migration record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MigrationRecord {
    pub version: i64,
    pub name: String,
    pub checksum: String,
    pub executed_at: DateTime<Utc>,
    pub execution_time_ms: i64,
}

/// Migration status information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MigrationStatus {
    pub current_version: i64,
    pub pending_migrations: Vec<MigrationInfo>,
    pub applied_migrations: Vec<MigrationRecord>,
    pub total_migrations: usize,
    pub pending_count: usize,
}

/// Migration performance metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MigrationMetrics {
    pub total_executed: u64,
    pub total_failed: u64,
    pub total_rolled_back: u64,
    pub average_execution_time_ms: f64,
    pub last_migration_time: Option<DateTime<Utc>>,
    pub failure_rate_percent: f64,
    pub rollback_frequency: f64, // rollbacks per day
}

/// Database migration manager with audit logging
pub struct MigrationManager {
    pool: Pool<Sqlite>,
    migrations_dir: PathBuf,
    migrations: HashMap<i64, MigrationInfo>,
    /// Audit logger for migration operations
    audit_logger: Option<Arc<AuditLogger>>,
}

impl MigrationManager {
    /// Create a new migration manager
    pub async fn new(pool: Pool<Sqlite>, migrations_dir: PathBuf) -> BinderyResult<Self> {
        let mut manager = Self {
            pool,
            migrations_dir,
            migrations: HashMap::new(),
            audit_logger: None,
        };

        // Initialize migration tracking table
        manager.initialize_migration_table().await?;

        // Load available migrations
        manager.load_migrations().await?;

        Ok(manager)
    }

    /// Create a new migration manager with audit logging
    pub async fn new_with_audit(
        pool: Pool<Sqlite>,
        migrations_dir: PathBuf,
        audit_logger: Arc<AuditLogger>
    ) -> BinderyResult<Self> {
        let mut manager = Self {
            pool,
            migrations_dir,
            migrations: HashMap::new(),
            audit_logger: Some(audit_logger),
        };

        // Initialize migration tracking table
        manager.initialize_migration_table().await?;

        // Load available migrations
        manager.load_migrations().await?;

        Ok(manager)
    }

    /// Initialize the migration tracking table
    async fn initialize_migration_table(&self) -> BinderyResult<()> {
        let start_time = std::time::Instant::now();

        let result = sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS migrations (
                version INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                checksum TEXT NOT NULL,
                executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                execution_time_ms INTEGER NOT NULL
            )
            "#,
        )
        .execute(&self.pool)
        .await;

        match result {
            Ok(_) => {
                let duration = start_time.elapsed();
                BinderyMetrics::record_migration("initialize_table", 0, duration, true);
                info!("Migration table initialized in {:?}", duration);
                Ok(())
            }
            Err(e) => {
                let duration = start_time.elapsed();
                BinderyMetrics::record_migration("initialize_table", 0, duration, false);
                Err(BinderyError::DatabaseError(e.to_string()))
            }
        }
    }

    /// Load migrations from the migrations directory
    async fn load_migrations(&mut self) -> BinderyResult<()> {
        if !self.migrations_dir.exists() {
            warn!("Migrations directory does not exist: {:?}", self.migrations_dir);
            return Ok(());
        }

        let mut dir_entries = tokio::fs::read_dir(&self.migrations_dir)
            .await
            .map_err(|e| BinderyError::IoError(format!("Failed to read migrations directory: {}", e)))?;

        while let Some(entry) = dir_entries.next_entry()
            .await
            .map_err(|e| BinderyError::IoError(format!("Failed to read directory entry: {}", e)))?
        {
            let path = entry.path();
            if path.extension().map_or(false, |ext| ext == "sql") {
                if let Some(migration) = self.parse_migration_file(&path).await? {
                    self.migrations.insert(migration.version, migration);
                }
            }
        }

        info!("Loaded {} migrations", self.migrations.len());
        Ok(())
    }

    /// Parse a migration file
    async fn parse_migration_file(&self, path: &Path) -> BinderyResult<Option<MigrationInfo>> {
        let filename = path.file_name()
            .and_then(|name| name.to_str())
            .ok_or_else(|| BinderyError::InvalidInput(format!("Invalid migration file name: {:?}", path)))?;

        // Expected format: V{version}__{name}.sql
        if !filename.starts_with('V') || !filename.contains("__") {
            warn!("Skipping migration file with invalid format: {}", filename);
            return Ok(None);
        }

        let parts: Vec<&str> = filename.splitn(2, "__").collect();
        if parts.len() != 2 {
            warn!("Skipping migration file with invalid format: {}", filename);
            return Ok(None);
        }

        let version_str = &parts[0][1..]; // Remove 'V' prefix
        let name = parts[1].trim_end_matches(".sql");

        let version = version_str.parse::<i64>()
            .map_err(|_| BinderyError::InvalidInput(format!("Invalid version in migration file: {}", filename)))?;

        let content = tokio::fs::read_to_string(path)
            .await
            .map_err(|e| BinderyError::IoError(format!("Failed to read migration file {}: {}", filename, e)))?;

        // Calculate checksum
        let mut hasher = Sha256::new();
        hasher.update(content.as_bytes());
        let checksum = format!("{:x}", hasher.finalize());

        // Parse up and down SQL
        let (up_sql, down_sql) = self.parse_migration_content(&content)?;

        Ok(Some(MigrationInfo {
            version,
            name: name.to_string(),
            description: format!("Migration {}: {}", version, name),
            up_sql,
            down_sql,
            checksum,
            executed_at: None,
            execution_time_ms: None,
        }))
    }

    /// Parse migration content into up and down SQL
    fn parse_migration_content(&self, content: &str) -> BinderyResult<(String, Option<String>)> {
        let content = content.trim();

        // Look for -- Down marker
        if let Some(down_pos) = content.find("-- Down") {
            let up_sql = content[..down_pos].trim().to_string();
            let down_sql = content[down_pos..].lines()
                .skip(1) // Skip the "-- Down" line
                .collect::<Vec<_>>()
                .join("\n")
                .trim()
                .to_string();

            Ok((up_sql, if down_sql.is_empty() { None } else { Some(down_sql) }))
        } else {
            Ok((content.to_string(), None))
        }
    }

    /// Get the current database version
    pub async fn get_current_version(&self) -> BinderyResult<i64> {
        let row = sqlx::query("SELECT MAX(version) as version FROM migrations")
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| BinderyError::DatabaseError(e.to_string()))?;

        match row {
            Some(row) => Ok(row.try_get::<Option<i64>, _>("version")?.unwrap_or(0)),
            None => Ok(0),
        }
    }

    /// Get pending migrations
    pub async fn get_pending_migrations(&self) -> BinderyResult<Vec<MigrationInfo>> {
        let current_version = self.get_current_version().await?;

        let mut pending: Vec<_> = self.migrations.values()
            .filter(|m| m.version > current_version)
            .cloned()
            .collect();

        pending.sort_by_key(|m| m.version);
        Ok(pending)
    }

    /// Get migration status
    pub async fn get_status(&self) -> BinderyResult<MigrationStatus> {
        let current_version = self.get_current_version().await?;
        let pending_migrations = self.get_pending_migrations().await?;
        let applied_migrations = self.get_applied_migrations().await?;

        Ok(MigrationStatus {
            current_version,
            pending_count: pending_migrations.len(),
            pending_migrations,
            applied_migrations,
            total_migrations: self.migrations.len(),
        })
    }

    /// Get applied migrations
    async fn get_applied_migrations(&self) -> BinderyResult<Vec<MigrationRecord>> {
        let rows = sqlx::query("SELECT version, name, checksum, executed_at, execution_time_ms FROM migrations ORDER BY version")
            .fetch_all(&self.pool)
            .await
            .map_err(|e| BinderyError::DatabaseError(e.to_string()))?;

        let mut records = Vec::new();
        for row in rows {
            records.push(MigrationRecord {
                version: row.try_get("version")?,
                name: row.try_get("name")?,
                checksum: row.try_get("checksum")?,
                executed_at: row.try_get("executed_at")?,
                execution_time_ms: row.try_get("execution_time_ms")?,
            });
        }

        Ok(records)
    }

    /// Execute all pending migrations with audit logging
    pub async fn migrate(&self, user_context: Option<UserContext>) -> BinderyResult<Vec<MigrationResult>> {
        let pending = self.get_pending_migrations().await?;

        if pending.is_empty() {
            info!("No pending migrations");
            return Ok(Vec::new());
        }

        info!("Executing {} pending migrations", pending.len());

        let mut results = Vec::new();
        for migration in pending {
            let result = self.execute_migration_up(&migration, user_context.as_ref()).await?;
            results.push(result);
        }

        Ok(results)
    }

    /// Execute a single migration up with audit logging
    async fn execute_migration_up(&self, migration: &MigrationInfo, user_context: Option<&UserContext>) -> BinderyResult<MigrationResult> {
        info!("Executing migration {} ({})", migration.version, migration.name);

        let start_time = std::time::Instant::now();

        // Audit: Log migration attempt
        let audit_event_id = self.audit_migration_attempt(migration, "migrate_up", user_context).await;

        let mut tx = self.pool.begin().await
            .map_err(|e| BinderyError::DatabaseError(e.to_string()))?;

        match self.execute_sql_in_transaction(&mut tx, &migration.up_sql).await {
            Ok(_) => {
                // Record the migration
                sqlx::query(
                    "INSERT INTO migrations (version, name, checksum, executed_at, execution_time_ms) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)"
                )
                .bind(migration.version)
                .bind(&migration.name)
                .bind(&migration.checksum)
                .execute(&mut *tx)
                .await
                .map_err(|e| BinderyError::DatabaseError(e.to_string()))?;

                tx.commit().await
                    .map_err(|e| BinderyError::DatabaseError(e.to_string()))?;

                let execution_time = start_time.elapsed().as_millis() as i64;
                info!("Migration {} completed successfully in {}ms", migration.version, execution_time);

                // Record migration success metrics
                BinderyMetrics::record_migration(
                    "migrate_up",
                    migration.version as u64,
                    start_time.elapsed(),
                    true,
                );

                let result = MigrationResult {
                    version: migration.version,
                    name: migration.name.clone(),
                    success: true,
                    execution_time_ms: execution_time,
                    error_message: None,
                    audit_event_id: audit_event_id.clone(),
                };

                // Audit: Log migration success
                self.audit_migration_completion(migration, "migrate_up", &result, user_context).await;

                Ok(result)
            }
            Err(e) => {
                tx.rollback().await
                    .map_err(|rollback_err| BinderyError::DatabaseError(format!("Failed to rollback: {}", rollback_err)))?;

                let execution_time = start_time.elapsed().as_millis() as i64;
                error!("Migration {} failed: {}", migration.version, e);

                // Record migration failure metrics
                BinderyMetrics::record_migration(
                    "migrate_up",
                    migration.version as u64,
                    start_time.elapsed(),
                    false,
                );

                let result = MigrationResult {
                    version: migration.version,
                    name: migration.name.clone(),
                    success: false,
                    execution_time_ms: execution_time,
                    error_message: Some(e.to_string()),
                    audit_event_id: audit_event_id.clone(),
                };

                // Audit: Log migration failure
                self.audit_migration_completion(migration, "migrate_up", &result, user_context).await;

                Ok(result)
            }
        }
    }

    /// Execute a single migration down (rollback) with audit logging
    async fn execute_migration_down(&self, migration: &MigrationInfo, user_context: Option<&UserContext>) -> BinderyResult<MigrationResult> {
        let down_sql = migration.down_sql.as_ref()
            .ok_or_else(|| BinderyError::InvalidInput(format!("Migration {} has no rollback SQL", migration.version)))?;

        info!("Rolling back migration {} ({})", migration.version, migration.name);

        let start_time = std::time::Instant::now();

        // Audit: Log rollback attempt
        let audit_event_id = self.audit_migration_attempt(migration, "rollback", user_context).await;

        let mut tx = self.pool.begin().await
            .map_err(|e| BinderyError::DatabaseError(e.to_string()))?;

        match self.execute_sql_in_transaction(&mut tx, down_sql).await {
            Ok(_) => {
                // Remove the migration record
                sqlx::query("DELETE FROM migrations WHERE version = ?")
                    .bind(migration.version)
                    .execute(&mut *tx)
                    .await
                    .map_err(|e| BinderyError::DatabaseError(e.to_string()))?;

                tx.commit().await
                    .map_err(|e| BinderyError::DatabaseError(e.to_string()))?;

                let execution_time = start_time.elapsed().as_millis() as i64;
                info!("Migration {} rolled back successfully in {}ms", migration.version, execution_time);

                // Record rollback success metrics
                BinderyMetrics::record_migration_rollback(
                    migration.version as u64,
                    0, // to_version not applicable for single rollback
                    start_time.elapsed(),
                );

                let result = MigrationResult {
                    version: migration.version,
                    name: migration.name.clone(),
                    success: true,
                    execution_time_ms: execution_time,
                    error_message: None,
                    audit_event_id: audit_event_id.clone(),
                };

                // Audit: Log rollback success
                self.audit_migration_completion(migration, "rollback", &result, user_context).await;

                Ok(result)
            }
            Err(e) => {
                tx.rollback().await
                    .map_err(|rollback_err| BinderyError::DatabaseError(format!("Failed to rollback: {}", rollback_err)))?;

                let execution_time = start_time.elapsed().as_millis() as i64;
                error!("Migration {} rollback failed: {}", migration.version, e);

                // Record rollback failure metrics
                BinderyMetrics::record_migration(
                    "rollback",
                    migration.version as u64,
                    start_time.elapsed(),
                    false,
                );

                let result = MigrationResult {
                    version: migration.version,
                    name: migration.name.clone(),
                    success: false,
                    execution_time_ms: execution_time,
                    error_message: Some(e.to_string()),
                    audit_event_id: audit_event_id.clone(),
                };

                // Audit: Log rollback failure
                self.audit_migration_completion(migration, "rollback", &result, user_context).await;

                Ok(result)
            }
        }
    }

    /// Execute SQL in a transaction
    async fn execute_sql_in_transaction(&self, tx: &mut Transaction<'_, Sqlite>, sql: &str) -> BinderyResult<()> {
        // Split SQL into individual statements
        let statements: Vec<&str> = sql.split(';')
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .collect();

        for statement in statements {
            sqlx::query(statement)
                .execute(&mut **tx)
                .await
                .map_err(|e| BinderyError::DatabaseError(format!("SQL execution failed: {}", e)))?;
        }

        Ok(())
    }

    /// Rollback to a specific version with audit logging
    pub async fn rollback_to(&self, target_version: i64, user_context: Option<UserContext>) -> BinderyResult<Vec<MigrationResult>> {
        let current_version = self.get_current_version().await?;

        if target_version >= current_version {
            return Err(BinderyError::InvalidInput(format!(
                "Target version {} must be less than current version {}",
                target_version, current_version
            )));
        }

        info!("Rolling back from version {} to {}", current_version, target_version);

        let mut results = Vec::new();

        // Get migrations to rollback (in reverse order)
        let mut migrations_to_rollback: Vec<_> = self.migrations.values()
            .filter(|m| m.version > target_version && m.version <= current_version)
            .collect();

        migrations_to_rollback.sort_by(|a, b| b.version.cmp(&a.version)); // Reverse order

        for migration in migrations_to_rollback {
            let result = self.execute_migration_down(migration, user_context.as_ref()).await?;
            results.push(result);
        }

        Ok(results)
    }

    /// Rollback the last migration with audit logging
    pub async fn rollback_last(&self, user_context: Option<UserContext>) -> BinderyResult<MigrationResult> {
        let current_version = self.get_current_version().await?;

        if current_version == 0 {
            return Err(BinderyError::InvalidInput("No migrations to rollback".to_string()));
        }

        let migration = self.migrations.get(&current_version)
            .ok_or_else(|| BinderyError::InvalidInput(format!("Migration {} not found", current_version)))?;

        self.execute_migration_down(migration, user_context.as_ref()).await
    }

    /// Redo the last migration (rollback then reapply) with audit logging
    pub async fn redo_last(&self, user_context: Option<UserContext>) -> BinderyResult<Vec<MigrationResult>> {
        let current_version = self.get_current_version().await?;

        if current_version == 0 {
            return Err(BinderyError::InvalidInput("No migrations to redo".to_string()));
        }

        let migration = self.migrations.get(&current_version)
            .ok_or_else(|| BinderyError::InvalidInput(format!("Migration {} not found", current_version)))?;

        info!("Redoing migration {} ({})", migration.version, migration.name);

        let mut results = Vec::new();

        // Rollback
        let rollback_result = self.execute_migration_down(migration, user_context.as_ref()).await?;
        results.push(rollback_result);

        // Re-apply if rollback was successful - FIXED: Safe access to last element
        let should_reapply = results.last()
            .ok_or_else(|| BinderyError::Internal("No rollback result available".to_string()))?
            .success;

        if should_reapply {
            let reapply_result = self.execute_migration_up(migration, user_context.as_ref()).await?;
            results.push(reapply_result);
        }

        Ok(results)
    }

    /// Force mark a migration as executed (use with caution) with audit logging
    pub async fn mark_as_executed(&self, version: i64, user_context: Option<UserContext>) -> BinderyResult<()> {
        let migration = self.migrations.get(&version)
            .ok_or_else(|| BinderyError::InvalidInput(format!("Migration {} not found", version)))?;

        info!("Force marking migration {} as executed", version);

        // Audit: Log force mark operation
        self.audit_migration_force_mark(migration, user_context.as_ref()).await;

        sqlx::query(
            "INSERT OR REPLACE INTO migrations (version, name, checksum, executed_at, execution_time_ms) VALUES (?, ?, ?, CURRENT_TIMESTAMP, 0)"
        )
        .bind(version)
        .bind(&migration.name)
        .bind(&migration.checksum)
        .execute(&self.pool)
        .await
        .map_err(|e| BinderyError::DatabaseError(e.to_string()))?;

        Ok(())
    }

    /// Validate migration checksums with audit logging
    pub async fn validate_checksums(&self, user_context: Option<UserContext>) -> BinderyResult<Vec<(i64, bool)>> {
        let applied = self.get_applied_migrations().await?;
        let mut results = Vec::new();

        // Audit: Log checksum validation start
        self.audit_checksum_validation_start(user_context.as_ref()).await;

        for record in applied {
            if let Some(migration) = self.migrations.get(&record.version) {
                let checksum_valid = migration.checksum == record.checksum;
                results.push((record.version, checksum_valid));

                if !checksum_valid {
                    warn!("Migration {} has invalid checksum", record.version);
                    // Audit: Log checksum mismatch
                    self.audit_checksum_mismatch(&record, migration, user_context.as_ref()).await;
                }
            } else {
                warn!("Applied migration {} not found in migration files", record.version);
                results.push((record.version, false));
            }
        }

        // Audit: Log checksum validation completion
        self.audit_checksum_validation_completion(&results, user_context.as_ref()).await;

        Ok(results)
    }

    /// Get migration information by version
    pub fn get_migration(&self, version: i64) -> Option<&MigrationInfo> {
        self.migrations.get(&version)
    }

    /// Get comprehensive migration metrics
    pub async fn get_migration_metrics(&self) -> BinderyResult<MigrationMetrics> {
        let applied_migrations = self.get_applied_migrations().await?;

        let total_executed = applied_migrations.len() as u64;

        // Calculate average execution time
        let average_execution_time_ms = if !applied_migrations.is_empty() {
            applied_migrations.iter()
                .map(|m| m.execution_time_ms as f64)
                .sum::<f64>() / applied_migrations.len() as f64
        } else {
            0.0
        };

        // Get last migration time
        let last_migration_time = applied_migrations
            .iter()
            .max_by_key(|m| m.executed_at)
            .map(|m| m.executed_at);

        // For now, we'll calculate failure and rollback rates from historical data
        // In a real implementation, these would be tracked separately
        Ok(MigrationMetrics {
            total_executed,
            total_failed: 0, // Would need separate tracking
            total_rolled_back: 0, // Would need separate tracking
            average_execution_time_ms,
            last_migration_time,
            failure_rate_percent: 0.0, // Would need separate tracking
            rollback_frequency: 0.0, // Would need separate tracking
        })
    }

    /// List all available migrations
    pub fn list_migrations(&self) -> Vec<&MigrationInfo> {
        let mut migrations: Vec<_> = self.migrations.values().collect();
        migrations.sort_by_key(|m| m.version);
        migrations
    }

    /// Reset all migrations (dangerous operation) with audit logging
    pub async fn reset(&self, user_context: Option<UserContext>) -> BinderyResult<()> {
        warn!("Resetting all migrations - this will drop all migration history!");

        // Audit: Log reset operation
        self.audit_migration_reset(user_context.as_ref()).await;

        sqlx::query("DELETE FROM migrations")
            .execute(&self.pool)
            .await
            .map_err(|e| BinderyError::DatabaseError(e.to_string()))?;

        info!("All migration history reset");
        Ok(())
    }

    // Audit logging methods

    /// Audit migration attempt
    async fn audit_migration_attempt(&self, migration: &MigrationInfo, action: &str, user_context: Option<&UserContext>) -> Option<String> {
        if let Some(ref audit_logger) = self.audit_logger {
            let user_ctx = user_context.cloned().unwrap_or_else(|| UserContext {
                user_id: Some("system".to_string()),
                session_id: None,
                source_ip: None,
                user_agent: Some("migration_manager".to_string()),
            });

            let outcome = OperationOutcome {
                success: true, // Just attempting
                result_code: None,
                error_message: None,
                duration_ms: 0,
                records_affected: None,
            };

            let event = create_migration_event(
                user_ctx,
                migration.version,
                &migration.name,
                action,
                outcome,
            );

            let event_id = event.id.clone();
            if let Err(e) = audit_logger.log_event(event).await {
                error!("Failed to log migration attempt audit event: {}", e);
                return None;
            }

            Some(event_id)
        } else {
            None
        }
    }

    /// Audit migration completion
    async fn audit_migration_completion(&self, migration: &MigrationInfo, action: &str, result: &MigrationResult, user_context: Option<&UserContext>) {
        if let Some(ref audit_logger) = self.audit_logger {
            let user_ctx = user_context.cloned().unwrap_or_else(|| UserContext {
                user_id: Some("system".to_string()),
                session_id: None,
                source_ip: None,
                user_agent: Some("migration_manager".to_string()),
            });

            let outcome = OperationOutcome {
                success: result.success,
                result_code: Some(if result.success { 200 } else { 500 }),
                error_message: result.error_message.clone(),
                duration_ms: result.execution_time_ms,
                records_affected: Some(1),
            };

            let event = create_migration_event(
                user_ctx,
                migration.version,
                &migration.name,
                &format!("{}_complete", action),
                outcome,
            );

            if let Err(e) = audit_logger.log_event(event).await {
                error!("Failed to log migration completion audit event: {}", e);
            }
        }
    }

    /// Audit migration force mark operation
    async fn audit_migration_force_mark(&self, migration: &MigrationInfo, user_context: Option<&UserContext>) {
        if let Some(ref audit_logger) = self.audit_logger {
            let user_ctx = user_context.cloned().unwrap_or_else(|| UserContext {
                user_id: Some("system".to_string()),
                session_id: None,
                source_ip: None,
                user_agent: Some("migration_manager".to_string()),
            });

            let outcome = OperationOutcome {
                success: true,
                result_code: Some(200),
                error_message: None,
                duration_ms: 0,
                records_affected: Some(1),
            };

            let event = create_migration_event(
                user_ctx,
                migration.version,
                &migration.name,
                "force_mark_executed",
                outcome,
            );

            if let Err(e) = audit_logger.log_event(event).await {
                error!("Failed to log migration force mark audit event: {}", e);
            }
        }
    }

    /// Audit checksum validation start
    async fn audit_checksum_validation_start(&self, user_context: Option<&UserContext>) {
        if let Some(ref audit_logger) = self.audit_logger {
            let user_ctx = user_context.cloned().unwrap_or_else(|| UserContext {
                user_id: Some("system".to_string()),
                session_id: None,
                source_ip: None,
                user_agent: Some("migration_manager".to_string()),
            });

            let outcome = OperationOutcome {
                success: true,
                result_code: None,
                error_message: None,
                duration_ms: 0,
                records_affected: None,
            };

            let event = create_migration_event(
                user_ctx,
                0,
                "checksum_validation",
                "validate_checksums_start",
                outcome,
            );

            if let Err(e) = audit_logger.log_event(event).await {
                error!("Failed to log checksum validation start audit event: {}", e);
            }
        }
    }

    /// Audit checksum validation completion
    async fn audit_checksum_validation_completion(&self, results: &[(i64, bool)], user_context: Option<&UserContext>) {
        if let Some(ref audit_logger) = self.audit_logger {
            let user_ctx = user_context.cloned().unwrap_or_else(|| UserContext {
                user_id: Some("system".to_string()),
                session_id: None,
                source_ip: None,
                user_agent: Some("migration_manager".to_string()),
            });

            let invalid_count = results.iter().filter(|(_, valid)| !valid).count();
            let outcome = OperationOutcome {
                success: invalid_count == 0,
                result_code: Some(if invalid_count == 0 { 200 } else { 422 }),
                error_message: if invalid_count > 0 {
                    Some(format!("{} migrations have invalid checksums", invalid_count))
                } else {
                    None
                },
                duration_ms: 0,
                records_affected: Some(results.len() as i64),
            };

            let event = create_migration_event(
                user_ctx,
                0,
                "checksum_validation",
                "validate_checksums_complete",
                outcome,
            );

            if let Err(e) = audit_logger.log_event(event).await {
                error!("Failed to log checksum validation completion audit event: {}", e);
            }
        }
    }

    /// Audit checksum mismatch
    async fn audit_checksum_mismatch(&self, record: &MigrationRecord, migration: &MigrationInfo, user_context: Option<&UserContext>) {
        if let Some(ref audit_logger) = self.audit_logger {
            let user_ctx = user_context.cloned().unwrap_or_else(|| UserContext {
                user_id: Some("system".to_string()),
                session_id: None,
                source_ip: None,
                user_agent: Some("migration_manager".to_string()),
            });

            let outcome = OperationOutcome {
                success: false,
                result_code: Some(422), // Unprocessable Entity
                error_message: Some(format!(
                    "Checksum mismatch: expected {}, got {}",
                    migration.checksum, record.checksum
                )),
                duration_ms: 0,
                records_affected: Some(1),
            };

            let event = create_migration_event(
                user_ctx,
                record.version,
                &record.name,
                "checksum_mismatch",
                outcome,
            );

            if let Err(e) = audit_logger.log_event(event).await {
                error!("Failed to log checksum mismatch audit event: {}", e);
            }
        }
    }

    /// Audit migration reset operation
    async fn audit_migration_reset(&self, user_context: Option<&UserContext>) {
        if let Some(ref audit_logger) = self.audit_logger {
            let user_ctx = user_context.cloned().unwrap_or_else(|| UserContext {
                user_id: Some("system".to_string()),
                session_id: None,
                source_ip: None,
                user_agent: Some("migration_manager".to_string()),
            });

            let outcome = OperationOutcome {
                success: true,
                result_code: Some(200),
                error_message: None,
                duration_ms: 0,
                records_affected: None,
            };

            let event = create_migration_event(
                user_ctx,
                0,
                "migration_reset",
                "reset_all_migrations",
                outcome,
            );

            if let Err(e) = audit_logger.log_event(event).await {
                error!("Failed to log migration reset audit event: {}", e);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::SqlitePool;
    use tempfile::TempDir;
    use std::fs;

    async fn setup_test_db() -> (SqlitePool, TempDir) {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let db_path = temp_dir.path().join("test.db");

        let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.display()))
            .await
            .expect("Failed to connect to test database");

        (pool, temp_dir)
    }

    fn create_test_migration(dir: &Path, version: i64, name: &str, up_sql: &str, down_sql: Option<&str>) {
        let filename = format!("V{}__{}.sql", version, name);
        let path = dir.join(filename);

        let mut content = up_sql.to_string();
        if let Some(down) = down_sql {
            content.push_str("\n-- Down\n");
            content.push_str(down);
        }

        fs::write(path, content).expect("Failed to write migration file");
    }

    #[tokio::test]
    async fn test_migration_manager_creation() {
        let (pool, temp_dir) = setup_test_db().await;
        let migrations_dir = temp_dir.path().join("migrations");
        fs::create_dir(&migrations_dir).expect("Failed to create migrations dir");

        let manager = MigrationManager::new(pool, migrations_dir).await;
        assert!(manager.is_ok());
    }

    #[tokio::test]
    async fn test_migration_execution() {
        let (pool, temp_dir) = setup_test_db().await;
        let migrations_dir = temp_dir.path().join("migrations");
        fs::create_dir(&migrations_dir).expect("Failed to create migrations dir");

        // Create test migration
        create_test_migration(
            &migrations_dir,
            1,
            "create_test_table",
            "CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT);",
            Some("DROP TABLE test;")
        );

        let manager = MigrationManager::new(pool.clone(), migrations_dir).await.unwrap();

        // Test migration
        let user_context = UserContext {
            user_id: Some("test_user".to_string()),
            session_id: Some("test_session".to_string()),
            source_ip: Some("127.0.0.1".to_string()),
            user_agent: Some("test_client".to_string()),
        };

        let results = manager.migrate(Some(user_context)).await.unwrap();
        assert_eq!(results.len(), 1);
        assert!(results[0].success);

        // Verify table was created
        let row = sqlx::query("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='test'")
            .fetch_one(&pool)
            .await
            .unwrap();
        let count: i64 = row.try_get("count").unwrap();
        assert_eq!(count, 1);
    }

    #[tokio::test]
    async fn test_migration_rollback() {
        let (pool, temp_dir) = setup_test_db().await;
        let migrations_dir = temp_dir.path().join("migrations");
        fs::create_dir(&migrations_dir).expect("Failed to create migrations dir");

        // Create test migration
        create_test_migration(
            &migrations_dir,
            1,
            "create_test_table",
            "CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT);",
            Some("DROP TABLE test;")
        );

        let manager = MigrationManager::new(pool.clone(), migrations_dir).await.unwrap();

        let user_context = UserContext {
            user_id: Some("test_user".to_string()),
            session_id: Some("test_session".to_string()),
            source_ip: Some("127.0.0.1".to_string()),
            user_agent: Some("test_client".to_string()),
        };

        // Execute migration
        manager.migrate(Some(user_context.clone())).await.unwrap();

        // Rollback
        let result = manager.rollback_last(Some(user_context)).await.unwrap();
        assert!(result.success);

        // Verify table was dropped
        let row = sqlx::query("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='test'")
            .fetch_one(&pool)
            .await
            .unwrap();
        let count: i64 = row.try_get("count").unwrap();
        assert_eq!(count, 0);
    }
}