"""
Database Migration Manager for Triple Database Integration

Handles migration of existing Vespera V2 SQLite databases to support
triple-database coordination with Chroma and KuzuDB.
"""

import logging
import sqlite3
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class MigrationResult:
    """Result of a database migration operation."""
    success: bool
    version_from: str
    version_to: str
    tasks_migrated: int = 0
    errors: List[str] = None
    backup_path: Optional[Path] = None
    migration_time: Optional[datetime] = None
    
    def __post_init__(self):
        if self.errors is None:
            self.errors = []


class MigrationManager:
    """
    Manages database schema migrations for triple-database integration.
    
    Provides safe, versioned migrations with automatic backup and rollback capabilities.
    """
    
    CURRENT_SCHEMA_VERSION = "2.1.0"  # Triple-DB integration version
    
    def __init__(self, db_path: Path):
        """Initialize migration manager with database path."""
        self.db_path = db_path
        self.backup_dir = db_path.parent / "backups"
        self.backup_dir.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"Migration manager initialized for {db_path}")
    
    async def get_current_version(self) -> str:
        """Get current database schema version."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Check if migration_info table exists
                cursor.execute("""
                    SELECT name FROM sqlite_master 
                    WHERE type='table' AND name='migration_info'
                """)
                
                if cursor.fetchone() is None:
                    # No migration table = original V2 schema
                    return "2.0.0"
                
                # Get current version
                cursor.execute("SELECT version FROM migration_info ORDER BY applied_at DESC LIMIT 1")
                result = cursor.fetchone()
                
                return result[0] if result else "2.0.0"
                
        except Exception as e:
            logger.error(f"Failed to get current schema version: {e}")
            return "unknown"
    
    async def needs_migration(self) -> bool:
        """Check if database needs migration to support triple-DB."""
        current_version = await self.get_current_version()
        return current_version != self.CURRENT_SCHEMA_VERSION
    
    async def migrate_to_triple_db(self) -> MigrationResult:
        """
        Migrate existing V2 database to support triple-database coordination.
        
        This migration:
        1. Creates backup of existing database
        2. Adds triple-DB coordination columns to tasks table
        3. Creates migration tracking table
        4. Initializes coordination metadata for existing tasks
        """
        start_time = datetime.now()
        current_version = await self.get_current_version()
        
        result = MigrationResult(
            success=False,
            version_from=current_version,
            version_to=self.CURRENT_SCHEMA_VERSION,
            migration_time=start_time
        )
        
        try:
            # 1. Create backup
            backup_path = await self._create_backup()
            result.backup_path = backup_path
            logger.info(f"Created backup at {backup_path}")
            
            # 2. Apply migrations based on current version
            if current_version == "2.0.0":
                await self._migrate_from_v2_0_0(result)
            elif current_version == "unknown":
                result.errors.append("Cannot migrate from unknown schema version")
                return result
            else:
                result.errors.append(f"Unsupported migration from version {current_version}")
                return result
            
            # 3. Update migration tracking
            await self._record_migration(current_version, self.CURRENT_SCHEMA_VERSION)
            
            result.success = True
            result.migration_time = datetime.now() - start_time
            
            logger.info(f"Successfully migrated database from {current_version} to {self.CURRENT_SCHEMA_VERSION}")
            logger.info(f"Migration took {result.migration_time.total_seconds():.2f} seconds")
            
            return result
            
        except Exception as e:
            logger.error(f"Migration failed: {e}")
            result.errors.append(str(e))
            
            # Attempt to restore from backup if migration failed
            if result.backup_path:
                await self._restore_from_backup(result.backup_path)
                logger.info("Restored database from backup after migration failure")
            
            return result
    
    async def _create_backup(self) -> Path:
        """Create a backup of the current database."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = self.backup_dir / f"tasks_db_backup_{timestamp}.db"
        
        with sqlite3.connect(self.db_path) as source:
            with sqlite3.connect(backup_path) as backup:
                source.backup(backup)
        
        return backup_path
    
    async def _migrate_from_v2_0_0(self, result: MigrationResult) -> None:
        """Migrate from V2.0.0 (original) to V2.1.0 (triple-DB)."""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # 1. Create migration tracking table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS migration_info (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    version TEXT NOT NULL,
                    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    migration_notes TEXT
                )
            """)
            
            # 2. Add triple-DB coordination columns to tasks table
            triple_db_columns = [
                "embedding_id TEXT",
                "content_hash TEXT", 
                "last_embedded TIMESTAMP",
                "embedding_version INTEGER DEFAULT 1",
                "graph_node_id TEXT",
                "last_graph_sync TIMESTAMP",
                "graph_version INTEGER DEFAULT 1",
                "sync_status TEXT DEFAULT 'pending'",
                "last_indexed TIMESTAMP",
                "sync_error TEXT",
                "chroma_synced BOOLEAN DEFAULT 0",
                "kuzu_synced BOOLEAN DEFAULT 0"
            ]
            
            for column_def in triple_db_columns:
                try:
                    cursor.execute(f"ALTER TABLE tasks ADD COLUMN {column_def}")
                    logger.debug(f"Added column: {column_def}")
                except sqlite3.OperationalError as e:
                    if "duplicate column name" in str(e).lower():
                        logger.debug(f"Column already exists: {column_def}")
                    else:
                        raise
            
            # 3. Create indexes for triple-DB coordination
            indexes = [
                "CREATE INDEX IF NOT EXISTS idx_tasks_sync_status ON tasks (sync_status, last_indexed)",
                "CREATE INDEX IF NOT EXISTS idx_tasks_content_hash ON tasks (content_hash, last_embedded)",
                "CREATE INDEX IF NOT EXISTS idx_tasks_embedding_ref ON tasks (embedding_id) WHERE embedding_id IS NOT NULL",
                "CREATE INDEX IF NOT EXISTS idx_tasks_graph_ref ON tasks (graph_node_id) WHERE graph_node_id IS NOT NULL",
                "CREATE INDEX IF NOT EXISTS idx_tasks_embedding_version ON tasks (embedding_version, last_embedded)",
                "CREATE INDEX IF NOT EXISTS idx_tasks_graph_version ON tasks (graph_version, last_graph_sync)"
            ]
            
            for index_sql in indexes:
                cursor.execute(index_sql)
                logger.debug(f"Created index: {index_sql}")
            
            # 4. Create sync log table for tracking synchronization operations
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS sync_log (
                    id TEXT PRIMARY KEY,
                    task_id TEXT NOT NULL,
                    database_name TEXT NOT NULL,
                    operation TEXT NOT NULL,
                    status TEXT NOT NULL,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    error_message TEXT,
                    retry_count INTEGER DEFAULT 0,
                    FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE
                )
            """)
            
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_sync_log_task_db ON sync_log (task_id, database_name)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_sync_log_status ON sync_log (status, timestamp)")
            
            # 5. Initialize coordination metadata for existing tasks
            cursor.execute("SELECT id, title, description, status, priority, updated_at FROM tasks")
            existing_tasks = cursor.fetchall()
            
            tasks_updated = 0
            for task_row in existing_tasks:
                task_id, title, description, status, priority, updated_at = task_row
                
                # Generate content hash for existing tasks
                content = f"{title}|{description}|{status}|{priority}|{updated_at}"
                content_hash = self._generate_content_hash(content)
                
                # Update task with initial coordination metadata
                cursor.execute("""
                    UPDATE tasks 
                    SET content_hash = ?,
                        sync_status = 'pending',
                        embedding_version = 1,
                        graph_version = 1,
                        chroma_synced = 0,
                        kuzu_synced = 0
                    WHERE id = ?
                """, (content_hash, task_id))
                
                tasks_updated += 1
            
            result.tasks_migrated = tasks_updated
            conn.commit()
            
            logger.info(f"Updated {tasks_updated} existing tasks with coordination metadata")
    
    async def _record_migration(self, from_version: str, to_version: str) -> None:
        """Record migration in the migration_info table."""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO migration_info (version, migration_notes)
                VALUES (?, ?)
            """, (to_version, f"Migrated from {from_version} to {to_version} - Added triple-database coordination"))
            conn.commit()
    
    async def _restore_from_backup(self, backup_path: Path) -> None:
        """Restore database from backup."""
        if backup_path.exists():
            # Remove current database
            if self.db_path.exists():
                self.db_path.unlink()
            
            # Copy backup to original location
            with sqlite3.connect(backup_path) as source:
                with sqlite3.connect(self.db_path) as target:
                    source.backup(target)
    
    def _generate_content_hash(self, content: str) -> str:
        """Generate SHA256 hash of content."""
        import hashlib
        return hashlib.sha256(content.encode()).hexdigest()
    
    async def get_migration_history(self) -> List[Dict[str, Any]]:
        """Get history of applied migrations."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT version, applied_at, migration_notes 
                    FROM migration_info 
                    ORDER BY applied_at DESC
                """)
                
                history = []
                for row in cursor.fetchall():
                    history.append({
                        "version": row[0],
                        "applied_at": row[1],
                        "notes": row[2]
                    })
                
                return history
                
        except sqlite3.OperationalError:
            # Migration table doesn't exist
            return []
        except Exception as e:
            logger.error(f"Failed to get migration history: {e}")
            return []
    
    async def validate_schema(self) -> Dict[str, Any]:
        """Validate current database schema against expected triple-DB schema."""
        validation_result = {
            "valid": True,
            "version": await self.get_current_version(),
            "issues": [],
            "missing_columns": [],
            "missing_indexes": [],
            "missing_tables": []
        }
        
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Check for required tables
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
                existing_tables = {row[0] for row in cursor.fetchall()}
                
                required_tables = {"tasks", "task_relationships", "migration_info", "sync_log"}
                missing_tables = required_tables - existing_tables
                
                if missing_tables:
                    validation_result["valid"] = False
                    validation_result["missing_tables"] = list(missing_tables)
                
                # Check for required columns in tasks table
                cursor.execute("PRAGMA table_info(tasks)")
                existing_columns = {row[1] for row in cursor.fetchall()}
                
                required_columns = {
                    "embedding_id", "content_hash", "last_embedded", "embedding_version",
                    "graph_node_id", "last_graph_sync", "graph_version", 
                    "sync_status", "last_indexed", "sync_error", "chroma_synced", "kuzu_synced"
                }
                missing_columns = required_columns - existing_columns
                
                if missing_columns:
                    validation_result["valid"] = False
                    validation_result["missing_columns"] = list(missing_columns)
                
                # Check for required indexes
                cursor.execute("SELECT name FROM sqlite_master WHERE type='index'")
                existing_indexes = {row[0] for row in cursor.fetchall()}
                
                required_indexes = {
                    "idx_tasks_sync_status", "idx_tasks_content_hash", 
                    "idx_tasks_embedding_ref", "idx_tasks_graph_ref"
                }
                missing_indexes = required_indexes - existing_indexes
                
                if missing_indexes:
                    validation_result["valid"] = False
                    validation_result["missing_indexes"] = list(missing_indexes)
                
        except Exception as e:
            validation_result["valid"] = False
            validation_result["issues"].append(f"Schema validation error: {e}")
        
        return validation_result
    
    async def repair_schema(self) -> MigrationResult:
        """Repair schema issues identified by validation."""
        validation = await self.validate_schema()
        
        if validation["valid"]:
            return MigrationResult(
                success=True,
                version_from=validation["version"],
                version_to=validation["version"],
                migration_time=datetime.now()
            )
        
        # If schema is invalid, re-run migration
        logger.info("Schema validation failed, re-running migration to repair")
        return await self.migrate_to_triple_db()


# Standalone migration script for command-line usage
async def main():
    """Command-line migration script."""
    import argparse
    import asyncio
    
    parser = argparse.ArgumentParser(description="Migrate Vespera V2 database to triple-DB support")
    parser.add_argument("--db-path", type=Path, help="Path to database file")
    parser.add_argument("--validate-only", action="store_true", help="Only validate schema, don't migrate")
    parser.add_argument("--force", action="store_true", help="Force migration even if already migrated")
    
    args = parser.parse_args()
    
    # Default database path
    db_path = args.db_path or Path.cwd() / ".vespera_v2" / "tasks.db"
    
    if not db_path.exists():
        print(f"Database not found at {db_path}")
        return 1
    
    migration_manager = MigrationManager(db_path)
    
    if args.validate_only:
        validation = await migration_manager.validate_schema()
        print(f"Schema validation: {'PASS' if validation['valid'] else 'FAIL'}")
        print(f"Current version: {validation['version']}")
        
        if not validation['valid']:
            print("Issues found:")
            for issue in validation['issues']:
                print(f"  - {issue}")
            if validation['missing_tables']:
                print(f"  - Missing tables: {validation['missing_tables']}")
            if validation['missing_columns']:
                print(f"  - Missing columns: {validation['missing_columns']}")
            if validation['missing_indexes']:
                print(f"  - Missing indexes: {validation['missing_indexes']}")
        
        return 0 if validation['valid'] else 1
    
    # Run migration
    needs_migration = await migration_manager.needs_migration()
    
    if not needs_migration and not args.force:
        print("Database is already at the latest version")
        return 0
    
    print("Starting database migration...")
    result = await migration_manager.migrate_to_triple_db()
    
    if result.success:
        print(f"Migration successful!")
        print(f"  Version: {result.version_from} → {result.version_to}")
        print(f"  Tasks migrated: {result.tasks_migrated}")
        print(f"  Duration: {result.migration_time.total_seconds():.2f} seconds")
        print(f"  Backup: {result.backup_path}")
        return 0
    else:
        print("Migration failed!")
        for error in result.errors:
            print(f"  Error: {error}")
        return 1


if __name__ == "__main__":
    import asyncio
    exit(asyncio.run(main()))