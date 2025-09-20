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

/// Migration execution result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MigrationResult {
    pub version: i64,
    pub name: String,
    pub success: bool,
    pub execution_time_ms: i64,
    pub error_message: Option<String>,
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
}

/// Database migration manager
pub struct MigrationManager {
    pool: Pool<Sqlite>,
    migrations_dir: PathBuf,
    migrations: HashMap<i64, MigrationInfo>,
}

impl MigrationManager {
    /// Create a new migration manager
    pub async fn new(pool: Pool<Sqlite>, migrations_dir: PathBuf) -> BinderyResult<Self> {
        let mut manager = Self {
            pool,
            migrations_dir,
            migrations: HashMap::new(),
        };

        // Initialize migration tracking table
        manager.initialize_migration_table().await?;

        // Load available migrations
        manager.load_migrations().await?;

        Ok(manager)
    }

    /// Initialize the migration tracking table
    async fn initialize_migration_table(&self) -> BinderyResult<()> {
        sqlx::query(
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
        .await
        .map_err(|e| BinderyError::DatabaseError(e.to_string()))?;

        Ok(())
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

    /// Execute all pending migrations
    pub async fn migrate(&self) -> BinderyResult<Vec<MigrationResult>> {
        let pending = self.get_pending_migrations().await?;

        if pending.is_empty() {
            info!("No pending migrations");
            return Ok(Vec::new());
        }

        info!("Executing {} pending migrations", pending.len());

        let mut results = Vec::new();
        for migration in pending {
            let result = self.execute_migration_up(&migration).await?;
            results.push(result);
        }

        Ok(results)
    }

    /// Execute a single migration up
    async fn execute_migration_up(&self, migration: &MigrationInfo) -> BinderyResult<MigrationResult> {
        info!("Executing migration {} ({})", migration.version, migration.name);

        let start_time = std::time::Instant::now();

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
                .bind(start_time.elapsed().as_millis() as i64)
                .execute(&mut *tx)
                .await
                .map_err(|e| BinderyError::DatabaseError(e.to_string()))?;

                tx.commit().await
                    .map_err(|e| BinderyError::DatabaseError(e.to_string()))?;

                let execution_time = start_time.elapsed().as_millis() as i64;
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
                tx.rollback().await
                    .map_err(|rollback_err| BinderyError::DatabaseError(format!("Failed to rollback: {}", rollback_err)))?;

                let execution_time = start_time.elapsed().as_millis() as i64;
                error!("Migration {} failed: {}", migration.version, e);

                Ok(MigrationResult {
                    version: migration.version,
                    name: migration.name.clone(),
                    success: false,
                    execution_time_ms: execution_time,
                    error_message: Some(e.to_string()),
                })
            }
        }
    }

    /// Execute a single migration down (rollback)
    async fn execute_migration_down(&self, migration: &MigrationInfo) -> BinderyResult<MigrationResult> {
        let down_sql = migration.down_sql.as_ref()
            .ok_or_else(|| BinderyError::InvalidInput(format!("Migration {} has no rollback SQL", migration.version)))?;

        info!("Rolling back migration {} ({})", migration.version, migration.name);

        let start_time = std::time::Instant::now();

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
                    .map_err(|rollback_err| BinderyError::DatabaseError(format!("Failed to rollback: {}", rollback_err)))?;

                let execution_time = start_time.elapsed().as_millis() as i64;
                error!("Migration {} rollback failed: {}", migration.version, e);

                Ok(MigrationResult {
                    version: migration.version,
                    name: migration.name.clone(),
                    success: false,
                    execution_time_ms: execution_time,
                    error_message: Some(e.to_string()),
                })
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

    /// Rollback to a specific version
    pub async fn rollback_to(&self, target_version: i64) -> BinderyResult<Vec<MigrationResult>> {
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
            let result = self.execute_migration_down(migration).await?;
            results.push(result);
        }

        Ok(results)
    }

    /// Rollback the last migration
    pub async fn rollback_last(&self) -> BinderyResult<MigrationResult> {
        let current_version = self.get_current_version().await?;

        if current_version == 0 {
            return Err(BinderyError::InvalidInput("No migrations to rollback".to_string()));
        }

        let migration = self.migrations.get(&current_version)
            .ok_or_else(|| BinderyError::InvalidInput(format!("Migration {} not found", current_version)))?;

        self.execute_migration_down(migration).await
    }

    /// Redo the last migration (rollback then reapply)
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

        // Re-apply if rollback was successful - FIXED: Safe access to last element
        let should_reapply = results.last()
            .ok_or_else(|| BinderyError::Internal("No rollback result available".to_string()))?
            .success;

        if should_reapply {
            let reapply_result = self.execute_migration_up(migration).await?;
            results.push(reapply_result);
        }

        Ok(results)
    }

    /// Force mark a migration as executed (use with caution)
    pub async fn mark_as_executed(&self, version: i64) -> BinderyResult<()> {
        let migration = self.migrations.get(&version)
            .ok_or_else(|| BinderyError::InvalidInput(format!("Migration {} not found", version)))?;

        info!("Force marking migration {} as executed", version);

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

    /// Validate migration checksums
    pub async fn validate_checksums(&self) -> BinderyResult<Vec<(i64, bool)>> {
        let applied = self.get_applied_migrations().await?;
        let mut results = Vec::new();

        for record in applied {
            if let Some(migration) = self.migrations.get(&record.version) {
                let checksum_valid = migration.checksum == record.checksum;
                results.push((record.version, checksum_valid));

                if !checksum_valid {
                    warn!("Migration {} has invalid checksum", record.version);
                }
            } else {
                warn!("Applied migration {} not found in migration files", record.version);
                results.push((record.version, false));
            }
        }

        Ok(results)
    }

    /// Get migration information by version
    pub fn get_migration(&self, version: i64) -> Option<&MigrationInfo> {
        self.migrations.get(&version)
    }

    /// List all available migrations
    pub fn list_migrations(&self) -> Vec<&MigrationInfo> {
        let mut migrations: Vec<_> = self.migrations.values().collect();
        migrations.sort_by_key(|m| m.version);
        migrations
    }

    /// Reset all migrations (dangerous operation)
    pub async fn reset(&self) -> BinderyResult<()> {
        warn!("Resetting all migrations - this will drop all migration history!");

        sqlx::query("DELETE FROM migrations")
            .execute(&self.pool)
            .await
            .map_err(|e| BinderyError::DatabaseError(e.to_string()))?;

        info!("All migration history reset");
        Ok(())
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
        let results = manager.migrate().await.unwrap();
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

        // Execute migration
        manager.migrate().await.unwrap();

        // Rollback
        let result = manager.rollback_last().await.unwrap();
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