//! Migration commands for Vespera Bindery CLI
//!
//! Provides command-line interface for database migration operations

use crate::migration::manager::{MigrationManager, MigrationStatus, MigrationResult};
use crate::errors::{BinderyError, BinderyResult};
use clap::Subcommand;
use serde_json;
use sqlx::sqlite::SqlitePool;
use std::path::PathBuf;
use tracing::{info, warn};

/// Migration CLI commands
#[derive(Debug, Subcommand)]
pub enum MigrationCommand {
    /// Show migration status
    Status {
        /// Output format (table, json)
        #[arg(long, default_value = "table")]
        format: String,
    },

    /// Run pending migrations
    Up {
        /// Target version to migrate to (latest if not specified)
        #[arg(long)]
        to: Option<i64>,
        /// Dry run (show what would be executed without running)
        #[arg(long)]
        dry_run: bool,
    },

    /// Rollback migrations
    Down {
        /// Target version to rollback to
        #[arg(long)]
        to: i64,
        /// Dry run (show what would be executed without running)
        #[arg(long)]
        dry_run: bool,
    },

    /// Redo the last migration
    Redo {
        /// Dry run (show what would be executed without running)
        #[arg(long)]
        dry_run: bool,
    },

    /// Validate migration checksums
    Validate,

    /// Force mark a migration as executed (dangerous)
    MarkExecuted {
        /// Migration version to mark as executed
        version: i64,
        /// Skip confirmation prompt
        #[arg(long)]
        force: bool,
    },

    /// Create a new migration file
    Create {
        /// Migration name (will be prefixed with version number)
        name: String,
        /// Migration description
        #[arg(long)]
        description: Option<String>,
    },

    /// Show detailed information about a specific migration
    Info {
        /// Migration version to show info for
        version: i64,
    },
}

/// Migration command executor
pub struct MigrationCommandExecutor {
    manager: MigrationManager,
}

impl MigrationCommandExecutor {
    /// Create a new migration command executor
    pub async fn new(pool: SqlitePool, migrations_dir: PathBuf) -> BinderyResult<Self> {
        let manager = MigrationManager::new(pool, migrations_dir).await?;
        Ok(Self { manager })
    }

    /// Execute a migration command
    pub async fn execute(&self, command: MigrationCommand) -> BinderyResult<()> {
        match command {
            MigrationCommand::Status { format } => self.status(format).await,
            MigrationCommand::Up { to, dry_run } => self.migrate_up(to, dry_run).await,
            MigrationCommand::Down { to, dry_run } => self.migrate_down(to, dry_run).await,
            MigrationCommand::Redo { dry_run } => self.redo(dry_run).await,
            MigrationCommand::Validate => self.validate().await,
            MigrationCommand::MarkExecuted { version, force } => self.mark_executed(version, force).await,
            MigrationCommand::Create { name, description } => self.create_migration(name, description).await,
            MigrationCommand::Info { version } => self.show_info(version).await,
        }
    }

    /// Show migration status
    async fn status(&self, format: String) -> BinderyResult<()> {
        let status = self.manager.get_status().await?;

        match format.as_str() {
            "json" => {
                println!("{}", serde_json::to_string_pretty(&status)
                    .map_err(|e| BinderyError::SerializationError(format!("Failed to serialize status: {}", e)))?);
            }
            "table" | _ => {
                self.print_status_table(&status);
            }
        }

        Ok(())
    }

    /// Print migration status as a formatted table
    fn print_status_table(&self, status: &MigrationStatus) {
        println!("┌─────────────────────────────────────────────────────────────────┐");
        println!("│                        Migration Status                        │");
        println!("├─────────────────────────────────────────────────────────────────┤");
        println!("│ Current Version: {:<47} │", status.current_version);
        println!("│ Total Migrations: {:<46} │", status.total_migrations);
        println!("│ Pending Migrations: {:<44} │", status.pending_count);
        println!("└─────────────────────────────────────────────────────────────────┘");

        if !status.executed_migrations.is_empty() {
            println!("\nExecuted Migrations:");
            println!("┌─────────┬─────────────────────────────┬─────────────┬─────────────────────┐");
            println!("│ Version │ Name                        │ Status      │ Executed At         │");
            println!("├─────────┼─────────────────────────────┼─────────────┼─────────────────────┤");

            for migration in &status.executed_migrations {
                let status_str = if migration.success { "SUCCESS" } else { "FAILED" };
                let executed_at = migration.executed_at.format("%Y-%m-%d %H:%M:%S").to_string();

                println!("│ {:<7} │ {:<27} │ {:<11} │ {:<19} │",
                    migration.version,
                    truncate_string(&migration.name, 27),
                    status_str,
                    executed_at
                );
            }
            println!("└─────────┴─────────────────────────────┴─────────────┴─────────────────────┘");
        }

        if !status.pending_migrations.is_empty() {
            println!("\nPending Migrations:");
            println!("┌─────────┬─────────────────────────────────────────────────────────────────┐");
            println!("│ Version │ Name                                                            │");
            println!("├─────────┼─────────────────────────────────────────────────────────────────┤");

            for migration in &status.pending_migrations {
                println!("│ {:<7} │ {:<63} │",
                    migration.version,
                    truncate_string(&migration.name, 63)
                );
            }
            println!("└─────────┴─────────────────────────────────────────────────────────────────┘");
        }
    }

    /// Run pending migrations
    async fn migrate_up(&self, target_version: Option<i64>, dry_run: bool) -> BinderyResult<()> {
        if dry_run {
            let status = self.manager.get_status().await?;
            let current_version = status.current_version;
            let target = target_version.unwrap_or_else(|| {
                status.pending_migrations.iter().map(|m| m.version).max().unwrap_or(current_version)
            });

            println!("Dry run: Migrations that would be executed:");
            println!("Current version: {}", current_version);
            println!("Target version: {}", target);

            for migration in &status.pending_migrations {
                if migration.version <= target {
                    println!("  → {} ({})", migration.version, migration.name);
                }
            }
            return Ok(());
        }

        info!("Running migrations up to version {:?}", target_version);
        let results = self.manager.migrate_up(target_version).await?;

        self.print_migration_results(&results);
        Ok(())
    }

    /// Rollback migrations
    async fn migrate_down(&self, target_version: i64, dry_run: bool) -> BinderyResult<()> {
        if dry_run {
            let status = self.manager.get_status().await?;
            let current_version = status.current_version;

            println!("Dry run: Migrations that would be rolled back:");
            println!("Current version: {}", current_version);
            println!("Target version: {}", target_version);

            for migration in status.executed_migrations.iter().rev() {
                if migration.version > target_version {
                    println!("  ← {} ({})", migration.version, migration.name);
                }
            }
            return Ok(());
        }

        warn!("Rolling back migrations to version {}", target_version);
        let results = self.manager.migrate_down(target_version).await?;

        self.print_migration_results(&results);
        Ok(())
    }

    /// Redo the last migration
    async fn redo(&self, dry_run: bool) -> BinderyResult<()> {
        if dry_run {
            let current_version = self.manager.get_current_version().await?;
            if current_version == 0 {
                println!("Dry run: No migrations to redo");
                return Ok(());
            }

            println!("Dry run: Would redo migration {}", current_version);
            return Ok(());
        }

        info!("Redoing last migration");
        let results = self.manager.redo_last().await?;

        self.print_migration_results(&results);
        Ok(())
    }

    /// Validate migration checksums
    async fn validate(&self) -> BinderyResult<()> {
        info!("Validating migration checksums");
        let mismatches = self.manager.validate_checksums().await?;

        if mismatches.is_empty() {
            println!("✓ All migration checksums are valid");
        } else {
            println!("✗ Found {} checksum mismatches:", mismatches.len());
            for (version, error) in mismatches {
                println!("  Migration {}: {}", version, error);
            }
        }

        Ok(())
    }

    /// Force mark a migration as executed
    async fn mark_executed(&self, version: i64, force: bool) -> BinderyResult<()> {
        if !force {
            println!("WARNING: This will mark migration {} as executed without running it.", version);
            println!("This can lead to inconsistent database state.");
            print!("Are you sure you want to continue? (y/N): ");

            let mut input = String::new();
            std::io::stdin().read_line(&mut input)
                .map_err(|e| BinderyError::IoError(format!("Failed to read input: {}", e)))?;

            if !input.trim().eq_ignore_ascii_case("y") {
                println!("Aborted.");
                return Ok(());
            }
        }

        warn!("Force marking migration {} as executed", version);
        self.manager.mark_as_executed(version).await?;
        println!("Migration {} marked as executed", version);

        Ok(())
    }

    /// Create a new migration file
    async fn create_migration(&self, name: String, description: Option<String>) -> BinderyResult<()> {
        let status = self.manager.get_status().await?;
        let next_version = status.current_version + 1;

        let sanitized_name = name.replace(' ', "_").to_lowercase();
        let filename = format!("{:03}_{}.sql", next_version, sanitized_name);

        let migrations_dir = std::path::Path::new("migrations");
        if !migrations_dir.exists() {
            tokio::fs::create_dir_all(migrations_dir).await
                .map_err(|e| BinderyError::IoError(format!("Failed to create migrations directory: {}", e)))?;
        }

        let file_path = migrations_dir.join(&filename);
        let description_text = description.unwrap_or_else(|| format!("Migration: {}", name));

        let content = format!(
            r#"-- {}
-- Version: {}
-- Created: {}

-- +migrate up
-- Add your forward migration SQL here
-- Example:
-- CREATE TABLE new_table (
--     id INTEGER PRIMARY KEY,
--     name TEXT NOT NULL
-- );

-- +migrate down
-- Add your rollback migration SQL here
-- Example:
-- DROP TABLE IF EXISTS new_table;
"#,
            description_text,
            next_version,
            chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC")
        );

        tokio::fs::write(&file_path, content).await
            .map_err(|e| BinderyError::IoError(format!("Failed to write migration file: {}", e)))?;

        println!("Created migration file: {}", file_path.display());
        Ok(())
    }

    /// Show detailed information about a specific migration
    async fn show_info(&self, version: i64) -> BinderyResult<()> {
        let status = self.manager.get_status().await?;

        // Find the migration in pending or executed
        let migration_info = status.pending_migrations.iter()
            .find(|m| m.version == version)
            .or_else(|| {
                // Look for it in executed migrations by checking if it exists
                status.executed_migrations.iter()
                    .find(|m| m.version == version)
                    .and_then(|_| {
                        // TODO: We need to refactor this to store migration info with executed migrations
                        None
                    })
            });

        if let Some(migration) = migration_info {
            println!("Migration Information:");
            println!("┌─────────────────────────────────────────────────────────────────┐");
            println!("│ Version: {:<55} │", migration.version);
            println!("│ Name: {:<58} │", truncate_string(&migration.name, 58));
            println!("│ Description: {:<51} │", truncate_string(&migration.description, 51));
            println!("│ Checksum: {:<54} │", truncate_string(&migration.checksum, 54));
            println!("├─────────────────────────────────────────────────────────────────┤");

            if let Some(executed_at) = migration.executed_at {
                println!("│ Status: EXECUTED                                                │");
                println!("│ Executed At: {:<47} │", executed_at.format("%Y-%m-%d %H:%M:%S UTC"));
                if let Some(exec_time) = migration.execution_time_ms {
                    println!("│ Execution Time: {}ms{:<42} │", exec_time, "");
                }
            } else {
                println!("│ Status: PENDING                                                 │");
            }
            println!("└─────────────────────────────────────────────────────────────────┘");

            // Show SQL preview
            println!("\nUp SQL Preview:");
            println!("{}", truncate_string(&migration.up_sql, 500));

            if let Some(down_sql) = &migration.down_sql {
                println!("\nDown SQL Preview:");
                println!("{}", truncate_string(down_sql, 500));
            } else {
                println!("\nNo rollback SQL available for this migration.");
            }
        } else {
            println!("Migration {} not found", version);
        }

        Ok(())
    }

    /// Print migration results in a formatted table
    fn print_migration_results(&self, results: &[MigrationResult]) {
        if results.is_empty() {
            println!("No migrations were executed.");
            return;
        }

        println!("Migration Results:");
        println!("┌─────────┬─────────────────────────────┬─────────────┬─────────────────┐");
        println!("│ Version │ Name                        │ Status      │ Execution Time  │");
        println!("├─────────┼─────────────────────────────┼─────────────┼─────────────────┤");

        for result in results {
            let status_str = if result.success { "SUCCESS" } else { "FAILED" };

            println!("│ {:<7} │ {:<27} │ {:<11} │ {:<13}ms │",
                result.version,
                truncate_string(&result.name, 27),
                status_str,
                result.execution_time_ms
            );

            if let Some(error) = &result.error_message {
                println!("│         │ Error: {:<52} │",
                    truncate_string(error, 52)
                );
            }
        }
        println!("└─────────┴─────────────────────────────┴─────────────┴─────────────────┘");
    }
}

/// Truncate a string to a maximum length, adding "..." if truncated
fn truncate_string(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else if max_len <= 3 {
        "...".to_string()
    } else {
        format!("{}...", &s[..max_len - 3])
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_truncate_string() {
        assert_eq!(truncate_string("short", 10), "short");
        assert_eq!(truncate_string("this is a very long string", 10), "this is...");
        assert_eq!(truncate_string("test", 3), "test");
        assert_eq!(truncate_string("test", 2), "...");
    }
}