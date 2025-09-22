#!/usr/bin/env python3
"""
Migration Script: V1 Orchestrator to V2 Task System

Archives the old V1 orchestrator data and migrates relevant information
to the new V2 hierarchical task management system.
"""

import sys
import json
import shutil
import sqlite3
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional

# Add the package to path
sys.path.insert(0, str(Path(__file__).parent))

from tasks import TaskManager, TaskStatus, TaskPriority, TaskMetadata
from roles import RoleManager


class V1ToV2Migrator:
    """Migrates data from V1 orchestrator to V2 task system."""
    
    def __init__(self, project_root: Optional[Path] = None):
        self.project_root = project_root or Path.cwd()
        self.v1_dir = self.project_root / ".vespera_scriptorium"
        self.v2_dir = self.project_root / ".vespera_v2"
        self.archive_dir = self.project_root / ".vespera_v1_archive"
        
        # Initialize V2 system
        self.role_manager = RoleManager(self.project_root)
        self.task_manager = TaskManager(self.project_root, self.role_manager)
    
    def check_v1_data_exists(self) -> bool:
        """Check if V1 data exists to migrate."""
        return self.v1_dir.exists()
    
    def get_v1_data_summary(self) -> Dict[str, Any]:
        """Get summary of V1 data for migration planning."""
        summary = {
            "v1_directory_exists": self.v1_dir.exists(),
            "files_found": [],
            "databases_found": [],
            "estimated_tasks": 0,
            "sessions": []
        }
        
        if not self.v1_dir.exists():
            return summary
        
        # Find all files
        for file_path in self.v1_dir.rglob("*"):
            if file_path.is_file():
                summary["files_found"].append(str(file_path.relative_to(self.v1_dir)))
                
                # Check for databases
                if file_path.suffix in [".db", ".sqlite", ".sqlite3"]:
                    summary["databases_found"].append(str(file_path.relative_to(self.v1_dir)))
                    
                    # Try to count tasks in database
                    try:
                        with sqlite3.connect(file_path) as conn:
                            cursor = conn.cursor()
                            # Check for tasks table
                            cursor.execute("""
                                SELECT name FROM sqlite_master 
                                WHERE type='table' AND name LIKE '%task%'
                            """)
                            task_tables = cursor.fetchall()
                            
                            for (table_name,) in task_tables:
                                cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
                                count = cursor.fetchone()[0]
                                summary["estimated_tasks"] += count
                    except Exception as e:
                        print(f"   Warning: Could not read database {file_path}: {e}")
        
        return summary
    
    def create_archive(self) -> bool:
        """Create archive of V1 data."""
        try:
            if self.archive_dir.exists():
                print(f"   Archive directory already exists: {self.archive_dir}")
                print("   Please remove or rename it before continuing.")
                return False
            
            # Create archive with timestamp
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            archive_path = self.project_root / f".vespera_v1_archive_{timestamp}"
            
            print(f"   Creating archive: {archive_path}")
            shutil.copytree(self.v1_dir, archive_path)
            
            # Create migration metadata
            metadata = {
                "migration_date": datetime.now().isoformat(),
                "original_path": str(self.v1_dir),
                "archive_path": str(archive_path),
                "migration_script": __file__,
                "v1_summary": self.get_v1_data_summary()
            }
            
            metadata_file = archive_path / "migration_metadata.json"
            with open(metadata_file, 'w') as f:
                json.dump(metadata, f, indent=2)
            
            self.archive_dir = archive_path
            print(f"   ✓ Created archive with {len(list(archive_path.rglob('*')))} files")
            return True
            
        except Exception as e:
            print(f"   ✗ Failed to create archive: {e}")
            return False
    
    def migrate_tasks_from_v1_db(self, db_path: Path) -> int:
        """Migrate tasks from V1 database to V2 system."""
        migrated_count = 0
        
        try:
            with sqlite3.connect(db_path) as conn:
                cursor = conn.cursor()
                
                # Get table schema to understand structure
                cursor.execute("""
                    SELECT sql FROM sqlite_master 
                    WHERE type='table' AND name LIKE '%task%'
                """)
                
                schemas = cursor.fetchall()
                print(f"      Found {len(schemas)} task-related tables")
                
                # Try to find and migrate tasks
                cursor.execute("""
                    SELECT name FROM sqlite_master 
                    WHERE type='table' AND name LIKE '%task%'
                """)
                
                for (table_name,) in cursor.fetchall():
                    print(f"      Processing table: {table_name}")
                    
                    # Get all columns
                    cursor.execute(f"PRAGMA table_info({table_name})")
                    columns = [row[1] for row in cursor.fetchall()]
                    
                    # Get all rows
                    cursor.execute(f"SELECT * FROM {table_name}")
                    rows = cursor.fetchall()
                    
                    for row in rows:
                        row_data = dict(zip(columns, row))
                        task = self._convert_v1_task_to_v2(row_data, table_name)
                        
                        if task:
                            success = await self._create_v2_task(task)
                            if success:
                                migrated_count += 1
                
        except Exception as e:
            print(f"      Warning: Could not migrate from {db_path}: {e}")
        
        return migrated_count
    
    def _convert_v1_task_to_v2(self, v1_data: Dict[str, Any], table_name: str) -> Optional[Dict[str, Any]]:
        """Convert V1 task data to V2 format."""
        try:
            # Extract common fields
            title = v1_data.get("title") or v1_data.get("name") or "Migrated Task"
            description = v1_data.get("description", "")
            
            # Map status if available
            status = TaskStatus.TODO
            if "status" in v1_data:
                status_value = str(v1_data["status"]).lower()
                if status_value in ["done", "completed", "finished"]:
                    status = TaskStatus.DONE
                elif status_value in ["doing", "in_progress", "active"]:
                    status = TaskStatus.DOING
                elif status_value in ["review", "reviewing"]:
                    status = TaskStatus.REVIEW
                elif status_value in ["blocked"]:
                    status = TaskStatus.BLOCKED
            
            # Map priority if available
            priority = TaskPriority.NORMAL
            if "priority" in v1_data:
                priority_value = str(v1_data["priority"]).lower()
                if priority_value in ["critical", "urgent"]:
                    priority = TaskPriority.CRITICAL
                elif priority_value in ["high", "important"]:
                    priority = TaskPriority.HIGH
                elif priority_value in ["low"]:
                    priority = TaskPriority.LOW
                elif priority_value in ["someday", "later"]:
                    priority = TaskPriority.SOMEDAY
            
            # Create metadata
            metadata = TaskMetadata()
            metadata.tags = ["migrated_from_v1"]
            metadata.set_label("v1_table", table_name)
            metadata.set_label("migration_date", datetime.now().isoformat())
            
            # Add original data as reference
            if v1_data.get("created_at"):
                metadata.set_label("v1_created", str(v1_data["created_at"]))
            if v1_data.get("updated_at"):
                metadata.set_label("v1_updated", str(v1_data["updated_at"]))
            
            return {
                "title": title,
                "description": description,
                "status": status,
                "priority": priority,
                "project_id": "v1_migration",
                "feature": "legacy_tasks",
                "metadata": metadata
            }
            
        except Exception as e:
            print(f"         Warning: Could not convert V1 task: {e}")
            return None
    
    async def _create_v2_task(self, task_data: Dict[str, Any]) -> bool:
        """Create a V2 task from converted data."""
        try:
            success, result = await self.task_manager.task_service.create_task(
                title=task_data["title"],
                description=task_data["description"],
                priority=task_data["priority"],
                project_id=task_data["project_id"],
                feature=task_data["feature"],
                metadata=task_data["metadata"]
            )
            
            if success:
                # Update status if not TODO
                if task_data["status"] != TaskStatus.TODO:
                    task_id = result["task"]["id"]
                    await self.task_manager.task_service.update_task(
                        task_id,
                        {"status": task_data["status"].value}
                    )
            
            return success
            
        except Exception as e:
            print(f"         Warning: Could not create V2 task: {e}")
            return False
    
    async def perform_migration(self, create_archive: bool = True) -> Dict[str, Any]:
        """Perform the complete migration."""
        print("🔄 Starting V1 to V2 Migration")
        print("=" * 50)
        
        migration_result = {
            "success": False,
            "archive_created": False,
            "tasks_migrated": 0,
            "errors": [],
            "warnings": []
        }
        
        # Check V1 data
        print("\n1. Checking V1 Data...")
        v1_summary = self.get_v1_data_summary()
        
        if not v1_summary["v1_directory_exists"]:
            print("   ℹ No V1 data found - nothing to migrate")
            migration_result["success"] = True
            return migration_result
        
        print(f"   ✓ Found V1 directory with {len(v1_summary['files_found'])} files")
        print(f"   ✓ Found {len(v1_summary['databases_found'])} databases")
        print(f"   ✓ Estimated {v1_summary['estimated_tasks']} tasks to migrate")
        
        # Create archive
        if create_archive:
            print("\n2. Creating Archive...")
            archive_success = self.create_archive()
            migration_result["archive_created"] = archive_success
            
            if not archive_success:
                migration_result["errors"].append("Failed to create archive")
                return migration_result
        
        # Initialize V2 system
        print("\n3. Initializing V2 System...")
        self.v2_dir.mkdir(parents=True, exist_ok=True)
        # Override task service database path to use V2 directory
        self.task_manager.task_service.db_path = self.v2_dir / "tasks.db"
        self.task_manager.task_service._init_database()
        print(f"   ✓ V2 system initialized at: {self.v2_dir}")
        
        # Migrate tasks
        print("\n4. Migrating Tasks...")
        total_migrated = 0
        
        for db_file in v1_summary["databases_found"]:
            db_path = self.v1_dir / db_file
            print(f"   Processing: {db_file}")
            
            migrated_count = self.migrate_tasks_from_v1_db(db_path)
            total_migrated += migrated_count
            print(f"      ✓ Migrated {migrated_count} tasks")
        
        migration_result["tasks_migrated"] = total_migrated
        
        # Create migration summary
        print("\n5. Creating Migration Summary...")
        summary_file = self.v2_dir / "migration_summary.json"
        summary = {
            "migration_date": datetime.now().isoformat(),
            "v1_summary": v1_summary,
            "migration_result": migration_result,
            "v2_directory": str(self.v2_dir),
            "archive_directory": str(self.archive_dir) if create_archive else None
        }
        
        with open(summary_file, 'w') as f:
            json.dump(summary, f, indent=2)
        
        print(f"   ✓ Created migration summary: {summary_file}")
        
        # Final status
        migration_result["success"] = True
        
        print("\n" + "=" * 50)
        print("✅ Migration Complete!")
        print(f"   - Tasks migrated: {total_migrated}")
        print(f"   - V2 system: {self.v2_dir}")
        if create_archive:
            print(f"   - V1 archive: {self.archive_dir}")
        
        return migration_result


async def main():
    """Main migration script."""
    print("Vespera V1 to V2 Migration Tool")
    print("=" * 40)
    
    migrator = V1ToV2Migrator()
    
    # Check if migration is needed
    if not migrator.check_v1_data_exists():
        print("✅ No V1 data found - V2 system ready to use")
        return
    
    # Get user confirmation
    v1_summary = migrator.get_v1_data_summary()
    print(f"\nFound V1 data:")
    print(f"- Directory: {migrator.v1_dir}")
    print(f"- Files: {len(v1_summary['files_found'])}")
    print(f"- Estimated tasks: {v1_summary['estimated_tasks']}")
    
    response = input("\nProceed with migration? (y/N): ").strip().lower()
    if response != 'y':
        print("Migration cancelled")
        return
    
    # Perform migration
    try:
        result = await migrator.perform_migration(create_archive=True)
        
        if result["success"]:
            print(f"\n🎉 Migration successful!")
            print(f"   Migrated {result['tasks_migrated']} tasks to V2 system")
            print(f"   V1 data archived safely")
            print(f"\nNext steps:")
            print(f"1. Test the V2 system: python test_mcp_server.py")
            print(f"2. Configure MCP client to use new server")
            print(f"3. Remove V1 directory when satisfied: rm -rf {migrator.v1_dir}")
        else:
            print(f"\n❌ Migration failed!")
            for error in result["errors"]:
                print(f"   Error: {error}")
    
    except Exception as e:
        print(f"\n❌ Migration failed with error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())