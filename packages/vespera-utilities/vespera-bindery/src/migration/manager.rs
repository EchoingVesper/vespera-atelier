//! Database migration manager for Vespera Bindery
//!
//! Provides comprehensive database migration capabilities including:
//! - Schema versioning and migration tracking
//! - Forward and rollback migrations
//! - Transaction-safe migration execution
//! - Migration status and history reporting

use crate::errors::{BinderyError, BinderyResult};
use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{Pool, Sqlite, Row, Transaction};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
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

/// Migration execution record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MigrationRecord {
    pub version: i64,
    pub name: String,
    pub checksum: String,
    pub executed_at: DateTime<Utc>,
    pub execution_time_ms: i64,
    pub success: bool,
    pub error_message: Option<String>,
}

/// Migration status information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MigrationStatus {
    pub current_version: i64,
    pub pending_migrations: Vec<MigrationInfo>,
    pub executed_migrations: Vec<MigrationRecord>,
    pub total_migrations: usize,
    pub pending_count: usize,
}

/// Migration execution result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MigrationResult {
    pub version: i64,
    pub name: String,
    pub success: bool,
    pub execution_time_ms: i64,
    pub error_message: Option<String>,
}

/// Database migration manager
pub struct MigrationManager {
    pool: Pool<Sqlite>,
    migrations_dir: PathBuf,
    migrations: HashMap<i64, MigrationInfo>,
}

impl MigrationManager {
    /// Create a new migration manager
    pub async fn new(pool: Pool<Sqlite>, migrations_dir: impl AsRef<Path>) -> BinderyResult<Self> {
        let migrations_dir = migrations_dir.as_ref().to_path_buf();
        let mut manager = Self {
            pool,
            migrations_dir,
            migrations: HashMap::new(),
        };

        // Initialize the migration tracking table
        manager.init_migration_table().await?;

        // Load available migrations
        manager.load_migrations().await?;

        Ok(manager)
    }

    /// Initialize the migration tracking table
    async fn init_migration_table(&self) -> BinderyResult<()> {
        debug!("Initializing migration tracking table");

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS _schema_migrations (
                version INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                checksum TEXT NOT NULL,
                executed_at TEXT NOT NULL,
                execution_time_ms INTEGER NOT NULL,
                success BOOLEAN NOT NULL DEFAULT 1,
                error_message TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_migrations_executed_at ON _schema_migrations(executed_at);
            CREATE INDEX IF NOT EXISTS idx_migrations_success ON _schema_migrations(success);
            "#
        ).execute(&self.pool).await
        .map_err(|e| BinderyError::DatabaseError(format!("Failed to initialize migration table: {}", e)))?;

        info!("Migration tracking table initialized");
        Ok(())
    }

    /// Load migrations from the migrations directory
    async fn load_migrations(&mut self) -> BinderyResult<()> {
        debug!("Loading migrations from {:?}", self.migrations_dir);

        if !self.migrations_dir.exists() {
            warn!("Migrations directory does not exist: {:?}", self.migrations_dir);
            return Ok(());
        }

        let mut dir_entries = tokio::fs::read_dir(&self.migrations_dir).await
            .map_err(|e| BinderyError::IoError(format!("Failed to read migrations directory: {}", e)))?;

        while let Some(entry) = dir_entries.next_entry().await
            .map_err(|e| BinderyError::IoError(format!("Failed to read directory entry: {}", e)))? {

            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("sql") {
                if let Some(file_name) = path.file_stem().and_then(|s| s.to_str()) {
                    if let Some(migration) = self.parse_migration_file(&path, file_name).await? {
                        self.migrations.insert(migration.version, migration);
                    }
                }
            }
        }

        info!("Loaded {} migrations", self.migrations.len());
        Ok(())
    }

    /// Parse a migration file into MigrationInfo
    async fn parse_migration_file(&self, path: &Path, file_name: &str) -> BinderyResult<Option<MigrationInfo>> {
        // Parse version from filename (format: 001_migration_name.sql)
        let parts: Vec<&str> = file_name.splitn(2, '_').collect();
        if parts.len() != 2 {
            warn!("Skipping migration file with invalid name format: {}", file_name);
            return Ok(None);
        }

        let version = parts[0].parse::<i64>()
            .map_err(|_| BinderyError::InvalidInput(format!("Invalid migration version in filename: {}", file_name)))?;

        let name = parts[1].replace('_', " ");

        let content = tokio::fs::read_to_string(path).await
            .map_err(|e| BinderyError::IoError(format!("Failed to read migration file {}: {}", path.display(), e)))?;

        // Parse SQL content for up/down migrations
        let (description, up_sql, down_sql) = self.parse_migration_content(&content)?;

        // Calculate checksum
        let checksum = self.calculate_checksum(&up_sql);

        Ok(Some(MigrationInfo {
            version,
            name,
            description,
            up_sql,
            down_sql,
            checksum,
            executed_at: None,
            execution_time_ms: None,
        }))
    }

    /// Parse migration content to extract description, up SQL, and down SQL
    fn parse_migration_content(&self, content: &str) -> BinderyResult<(String, String, Option<String>)> {
        let lines: Vec<&str> = content.lines().collect();
        let mut description = String::new();
        let mut up_sql = Vec::new();
        let mut down_sql = Vec::new();
        let mut current_section = "description";

        for line in lines {
            let trimmed = line.trim();

            if trimmed.starts_with("-- ") && current_section == "description" {
                if !description.is_empty() {
                    description.push('\n');
                }
                description.push_str(&trimmed[3..]);
            } else if trimmed.eq_ignore_ascii_case("-- +migrate up") {
                current_section = "up";
            } else if trimmed.eq_ignore_ascii_case("-- +migrate down") {
                current_section = "down";
            } else if !trimmed.is_empty() && !trimmed.starts_with("--") {
                match current_section {
                    "up" => up_sql.push(line),
                    "down" => down_sql.push(line),
                    _ => up_sql.push(line), // Default to up SQL
                }
            } else if current_section == "description" && !trimmed.starts_with("--") && !trimmed.is_empty() {
                // If we hit non-comment content and we're still in description, switch to up
                current_section = "up";
                up_sql.push(line);
            }
        }

        let up_sql_string = up_sql.join("\n");
        let down_sql_string = if down_sql.is_empty() {
            None
        } else {
            Some(down_sql.join("\n"))
        };

        if description.is_empty() {
            description = "No description provided".to_string();
        }

        Ok((description, up_sql_string, down_sql_string))
    }

    /// Calculate SHA-256 checksum of SQL content
    fn calculate_checksum(&self, sql: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(sql.as_bytes());
        format!("{:x}", hasher.finalize())
    }

    /// Get current schema version
    pub async fn get_current_version(&self) -> BinderyResult<i64> {
        let result = sqlx::query("SELECT COALESCE(MAX(version), 0) as version FROM _schema_migrations WHERE success = 1")
            .fetch_one(&self.pool).await
            .map_err(|e| BinderyError::DatabaseError(format!("Failed to get current version: {}", e)))?;

        Ok(result.get("version"))
    }

    /// Get migration status
    pub async fn get_status(&self) -> BinderyResult<MigrationStatus> {
        let current_version = self.get_current_version().await?;

        // Get executed migrations
        let executed_rows = sqlx::query("SELECT * FROM _schema_migrations ORDER BY version")
            .fetch_all(&self.pool).await
            .map_err(|e| BinderyError::DatabaseError(format!("Failed to get executed migrations: {}", e)))?;

        let mut executed_migrations = Vec::new();
        for row in executed_rows {
            executed_migrations.push(MigrationRecord {
                version: row.get("version"),
                name: row.get("name"),
                checksum: row.get("checksum"),
                executed_at: DateTime::parse_from_rfc3339(&row.get::<String, _>("executed_at"))
                    .map_err(|e| BinderyError::InvalidInput(format!("Invalid datetime format: {}", e)))?
                    .with_timezone(&Utc),
                execution_time_ms: row.get("execution_time_ms"),
                success: row.get("success"),
                error_message: row.get("error_message"),
            });
        }

        // Get pending migrations
        let mut pending_migrations = Vec::new();
        for (version, migration) in &self.migrations {
            if *version > current_version {
                pending_migrations.push(migration.clone());
            }
        }
        pending_migrations.sort_by_key(|m| m.version);

        Ok(MigrationStatus {
            current_version,
            pending_migrations: pending_migrations.clone(),
            executed_migrations,
            total_migrations: self.migrations.len(),
            pending_count: pending_migrations.len(),
        })
    }

    /// Run pending migrations
    pub async fn migrate_up(&self, target_version: Option<i64>) -> BinderyResult<Vec<MigrationResult>> {
        let current_version = self.get_current_version().await?;
        let target = target_version.unwrap_or_else(|| {
            self.migrations.keys().copied().max().unwrap_or(0)
        });

        info!("Running migrations from version {} to {}", current_version, target);

        let mut results = Vec::new();
        let mut migrations_to_run: Vec<_> = self.migrations
            .iter()
            .filter(|(version, _)| **version > current_version && **version <= target)
            .collect();
        migrations_to_run.sort_by_key(|(version, _)| *version);

        for (version, migration) in migrations_to_run {
            let result = self.execute_migration_up(migration).await?;
            results.push(result.clone());

            if !result.success {
                error!("Migration {} failed, stopping execution", version);
                break;
            }
        }

        Ok(results)
    }

    /// Rollback migrations
    pub async fn migrate_down(&self, target_version: i64) -> BinderyResult<Vec<MigrationResult>> {
        let current_version = self.get_current_version().await?;

        if target_version >= current_version {
            return Err(BinderyError::InvalidInput(
                format!("Target version {} must be less than current version {}", target_version, current_version)
            ));
        }

        info!("Rolling back migrations from version {} to {}", current_version, target_version);

        let mut results = Vec::new();
        let mut migrations_to_rollback: Vec<_> = self.migrations
            .iter()
            .filter(|(version, _)| **version > target_version && **version <= current_version)
            .collect();
        migrations_to_rollback.sort_by_key(|(version, _)| std::cmp::Reverse(*version));

        for (version, migration) in migrations_to_rollback {
            let result = self.execute_migration_down(migration).await?;
            results.push(result.clone());

            if !result.success {
                error!("Rollback of migration {} failed, stopping execution", version);
                break;
            }
        }

        Ok(results)
    }

    /// Execute a migration up
    async fn execute_migration_up(&self, migration: &MigrationInfo) -> BinderyResult<MigrationResult> {
        let start_time = std::time::Instant::now();
        info!("Executing migration {} ({})", migration.version, migration.name);

        let mut tx = self.pool.begin().await
            .map_err(|e| BinderyError::DatabaseError(format!("Failed to start transaction: {}", e)))?;

        let result = self.execute_sql_in_transaction(&mut tx, &migration.up_sql, migration).await;
        let execution_time = start_time.elapsed().as_millis() as i64;

        match result {
            Ok(_) => {
                // Record successful migration
                sqlx::query(
                    "INSERT INTO _schema_migrations (version, name, checksum, executed_at, execution_time_ms, success) VALUES (?, ?, ?, ?, ?, ?)"
                )
                .bind(migration.version)
                .bind(&migration.name)
                .bind(&migration.checksum)
                .bind(Utc::now().to_rfc3339())
                .bind(execution_time)
                .bind(true)
                .execute(&mut *tx).await
                .map_err(|e| BinderyError::DatabaseError(format!("Failed to record migration: {}", e)))?;

                tx.commit().await
                    .map_err(|e| BinderyError::DatabaseError(format!("Failed to commit transaction: {}", e)))?;

                info!("Migration {} completed successfully in {}ms", migration.version, execution_time);
                Ok(MigrationResult {
                    version: migration.version,
                    name: migration.name.clone(),
                    success: true,
                    execution_time_ms: execution_time,
                    error_message: None,
                })
            }
            Err(e) => {
                // Record failed migration
                let error_message = e.to_string();
                sqlx::query(
                    "INSERT INTO _schema_migrations (version, name, checksum, executed_at, execution_time_ms, success, error_message) VALUES (?, ?, ?, ?, ?, ?, ?)"
                )
                .bind(migration.version)
                .bind(&migration.name)
                .bind(&migration.checksum)
                .bind(Utc::now().to_rfc3339())
                .bind(execution_time)
                .bind(false)
                .bind(&error_message)
                .execute(&mut *tx).await
                .map_err(|e| BinderyError::DatabaseError(format!("Failed to record failed migration: {}", e)))?;

                tx.commit().await
                    .map_err(|e| BinderyError::DatabaseError(format!("Failed to commit transaction: {}", e)))?;

                error!("Migration {} failed after {}ms: {}", migration.version, execution_time, error_message);
                Ok(MigrationResult {
                    version: migration.version,
                    name: migration.name.clone(),
                    success: false,
                    execution_time_ms: execution_time,
                    error_message: Some(error_message),
                })
            }
        }
    }

    /// Execute a migration down (rollback)
    async fn execute_migration_down(&self, migration: &MigrationInfo) -> BinderyResult<MigrationResult> {
        let down_sql = migration.down_sql.as_ref()
            .ok_or_else(|| BinderyError::InvalidInput(
                format!("Migration {} does not have a rollback script", migration.version)
            ))?;

        let start_time = std::time::Instant::now();
        info!("Rolling back migration {} ({})", migration.version, migration.name);

        let mut tx = self.pool.begin().await
            .map_err(|e| BinderyError::DatabaseError(format!("Failed to start transaction: {}", e)))?;

        let result = self.execute_sql_in_transaction(&mut tx, down_sql, migration).await;
        let execution_time = start_time.elapsed().as_millis() as i64;

        match result {
            Ok(_) => {
                // Remove migration record
                sqlx::query("DELETE FROM _schema_migrations WHERE version = ?")
                    .bind(migration.version)
                    .execute(&mut *tx).await
                    .map_err(|e| BinderyError::DatabaseError(format!("Failed to remove migration record: {}", e)))?;

                tx.commit().await
                    .map_err(|e| BinderyError::DatabaseError(format!("Failed to commit transaction: {}", e)))?;

                info!("Migration {} rolled back successfully in {}ms", migration.version, execution_time);
                Ok(MigrationResult {
                    version: migration.version,
                    name: migration.name.clone(),
                    success: true,
                    execution_time_ms: execution_time,
                    error_message: None,
                })
            }
            Err(e) => {
                tx.rollback().await
                    .map_err(|e| BinderyError::DatabaseError(format!("Failed to rollback transaction: {}", e)))?;

                let error_message = e.to_string();
                error!("Migration {} rollback failed after {}ms: {}", migration.version, execution_time, error_message);
                Ok(MigrationResult {
                    version: migration.version,
                    name: migration.name.clone(),
                    success: false,
                    execution_time_ms: execution_time,
                    error_message: Some(error_message),
                })
            }
        }
    }

    /// Execute SQL within a transaction
    async fn execute_sql_in_transaction(
        &self,
        tx: &mut Transaction<'_, Sqlite>,
        sql: &str,
        migration: &MigrationInfo,
    ) -> Result<()> {
        debug!("Executing SQL for migration {}: {}", migration.version, sql.len());

        // Split SQL into individual statements
        let statements: Vec<&str> = sql.split(';')
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .collect();

        for statement in statements {
            if !statement.trim().is_empty() {
                sqlx::query(statement).execute(&mut **tx).await
                    .map_err(|e| anyhow::anyhow!("Failed to execute SQL statement '{}': {}", statement, e))?;
            }
        }

        Ok(())
    }

    /// Redo the last migration (rollback and re-apply)
    pub async fn redo_last(&self) -> BinderyResult<Vec<MigrationResult>> {
        let current_version = self.get_current_version().await?;

        if current_version == 0 {
            return Err(BinderyError::InvalidInput("No migrations to redo".to_string()));
        }

        let migration = self.migrations.get(&current_version)
            .ok_or_else(|| BinderyError::InvalidInput(format!("Migration {} not found", current_version)))?;

        info!("Redoing migration {} ({})", migration.version, migration.name);

        let mut results = Vec::new();

        // Rollback
        let rollback_result = self.execute_migration_down(migration).await?;
        results.push(rollback_result);

        // Re-apply if rollback was successful
        if results.last().unwrap().success {
            let reapply_result = self.execute_migration_up(migration).await?;
            results.push(reapply_result);
        }

        Ok(results)
    }

    /// Force mark a migration as executed (use with caution)
    pub async fn mark_as_executed(&self, version: i64) -> BinderyResult<()> {
        let migration = self.migrations.get(&version)
            .ok_or_else(|| BinderyError::InvalidInput(format!("Migration {} not found", version)))?;

        warn!("Force marking migration {} as executed", version);

        sqlx::query(
            "INSERT OR REPLACE INTO _schema_migrations (version, name, checksum, executed_at, execution_time_ms, success) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(version)
        .bind(&migration.name)
        .bind(&migration.checksum)
        .bind(Utc::now().to_rfc3339())
        .bind(0)
        .bind(true)
        .execute(&self.pool).await
        .map_err(|e| BinderyError::DatabaseError(format!("Failed to mark migration as executed: {}", e)))?;

        Ok(())
    }

    /// Validate migration checksums
    pub async fn validate_checksums(&self) -> BinderyResult<Vec<(i64, String)>> {
        let executed_rows = sqlx::query("SELECT version, checksum FROM _schema_migrations WHERE success = 1")
            .fetch_all(&self.pool).await
            .map_err(|e| BinderyError::DatabaseError(format!("Failed to get executed migrations: {}", e)))?;

        let mut checksum_mismatches = Vec::new();

        for row in executed_rows {
            let version: i64 = row.get("version");
            let stored_checksum: String = row.get("checksum");

            if let Some(migration) = self.migrations.get(&version) {
                if migration.checksum != stored_checksum {
                    checksum_mismatches.push((version, format!(
                        "Checksum mismatch: stored={}, current={}",
                        stored_checksum,
                        migration.checksum
                    )));
                }
            } else {
                checksum_mismatches.push((version, "Migration file not found".to_string()));
            }
        }

        Ok(checksum_mismatches)
    }
}