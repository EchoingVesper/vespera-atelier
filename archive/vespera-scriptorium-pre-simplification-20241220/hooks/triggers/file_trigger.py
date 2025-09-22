"""
File System Trigger

Monitors file system events and triggers hooks for file changes.
"""

import asyncio
import logging
from pathlib import Path
from typing import Dict, Any, Callable, Optional, Set
from watchfiles import awatch

from .base import HookTrigger
from ..core.models import HookTriggerType, HookContext

logger = logging.getLogger(__name__)


class FileTrigger(HookTrigger):
    """
    Monitors file system changes and triggers hooks.
    
    Uses watchfiles for efficient file system monitoring.
    Triggers on file creation, modification, and deletion.
    """
    
    def __init__(self, watch_paths: list[Path], ignore_patterns: Optional[Set[str]] = None):
        super().__init__(HookTriggerType.FILE_CHANGE)
        self.watch_paths = watch_paths
        self.ignore_patterns = ignore_patterns or {
            "__pycache__",
            ".git",
            ".vscode", 
            ".idea",
            "node_modules",
            ".env",
            "*.tmp",
            "*.log"
        }
        self.watch_task: Optional[asyncio.Task] = None
        
    async def start(self, callback: Callable[[HookTriggerType, Dict[str, Any], Optional[HookContext]], None]):
        """Start monitoring file system changes"""
        if self.is_active:
            logger.warning("File trigger is already active")
            return
            
        self.callback = callback
        self.is_active = True
        
        # Start watching files
        self.watch_task = asyncio.create_task(self._watch_files())
        logger.info(f"File trigger started, watching {len(self.watch_paths)} paths")
    
    async def stop(self):
        """Stop monitoring file system changes"""
        if not self.is_active:
            return
            
        self.is_active = False
        
        if self.watch_task:
            self.watch_task.cancel()
            try:
                await self.watch_task
            except asyncio.CancelledError:
                pass
            self.watch_task = None
        
        logger.info("File trigger stopped")
    
    async def _watch_files(self):
        """Watch file system changes using watchfiles"""
        try:
            # Convert Path objects to strings for watchfiles
            watch_paths_str = [str(path) for path in self.watch_paths]
            
            async for changes in awatch(*watch_paths_str):
                if not self.is_active:
                    break
                
                for change_type, file_path in changes:
                    file_path = Path(file_path)
                    
                    # Skip ignored patterns
                    if self._should_ignore_file(file_path):
                        continue
                    
                    # Map watchfiles change types to our operation types
                    operation_map = {
                        1: "created",    # Added
                        2: "modified",   # Modified  
                        3: "deleted"     # Deleted
                    }
                    
                    operation = operation_map.get(change_type, "unknown")
                    
                    trigger_data = {
                        "file_path": str(file_path),
                        "operation": operation,
                        "file_extension": file_path.suffix,
                        "file_name": file_path.name,
                        "directory": str(file_path.parent)
                    }
                    
                    context = HookContext(
                        trigger_type=self.trigger_type,
                        trigger_data=trigger_data,
                        timestamp=asyncio.get_event_loop().time(),
                        file_path=str(file_path)
                    )
                    
                    await self.fire_trigger(trigger_data, context)
                    
        except asyncio.CancelledError:
            logger.info("File watching cancelled")
            raise
        except Exception as e:
            logger.error(f"Error in file watching: {e}")
    
    def _should_ignore_file(self, file_path: Path) -> bool:
        """Check if file should be ignored based on patterns"""
        file_str = str(file_path)
        
        for pattern in self.ignore_patterns:
            if pattern.startswith("*."):
                # Extension pattern
                if file_path.suffix == pattern[1:]:
                    return True
            else:
                # Path pattern
                if pattern in file_str:
                    return True
        
        return False
    
    def add_watch_path(self, path: Path):
        """Add a new path to watch"""
        if path not in self.watch_paths:
            self.watch_paths.append(path)
            logger.info(f"Added watch path: {path}")
    
    def remove_watch_path(self, path: Path):
        """Remove a path from watching"""
        if path in self.watch_paths:
            self.watch_paths.remove(path)
            logger.info(f"Removed watch path: {path}")
    
    def add_ignore_pattern(self, pattern: str):
        """Add a new ignore pattern"""
        self.ignore_patterns.add(pattern)
        logger.info(f"Added ignore pattern: {pattern}")
    
    def remove_ignore_pattern(self, pattern: str):
        """Remove an ignore pattern"""
        self.ignore_patterns.discard(pattern)
        logger.info(f"Removed ignore pattern: {pattern}")