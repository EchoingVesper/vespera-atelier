"""
Task Status Trigger

Monitors task status changes and triggers hooks accordingly.
"""

import asyncio
import logging
from typing import Dict, Any, Callable, Optional, Set
from datetime import datetime

from .base import HookTrigger
from ..core.models import HookTriggerType, HookContext

logger = logging.getLogger(__name__)


class TaskTrigger(HookTrigger):
    """
    Monitors task status changes and triggers hooks.
    
    Integrates with the task management system to receive
    notifications about task lifecycle events.
    """
    
    def __init__(self, task_manager=None):
        super().__init__(HookTriggerType.TASK_STATUS)
        self.task_manager = task_manager
        self.monitored_statuses: Set[str] = {
            "created", "started", "completed", "failed", "cancelled"
        }
        self.monitored_task_types: Set[str] = {
            "implementation", "research", "testing", "documentation",
            "review", "planning", "design", "debugging"
        }
    
    async def start(self, callback: Callable[[HookTriggerType, Dict[str, Any], Optional[HookContext]], None]):
        """Start monitoring task status changes"""
        if self.is_active:
            logger.warning("Task trigger is already active")
            return
            
        self.callback = callback
        self.is_active = True
        
        # Register with task manager if available
        if self.task_manager:
            self.task_manager.register_status_callback(self._handle_task_status_change)
        
        logger.info("Task trigger started")
    
    async def stop(self):
        """Stop monitoring task status changes"""
        if not self.is_active:
            return
            
        self.is_active = False
        
        # Unregister from task manager
        if self.task_manager:
            self.task_manager.unregister_status_callback(self._handle_task_status_change)
        
        logger.info("Task trigger stopped")
    
    async def _handle_task_status_change(self, task_id: str, old_status: str, new_status: str, task_data: Dict[str, Any]):
        """Handle task status change notification"""
        if not self.is_active:
            return
        
        # Filter by monitored statuses
        if new_status not in self.monitored_statuses:
            return
        
        # Get task type from task data
        task_type = task_data.get("task_type", "unknown")
        
        # Filter by monitored task types if specified
        if self.monitored_task_types and task_type not in self.monitored_task_types:
            return
        
        trigger_data = {
            "task_id": task_id,
            "old_status": old_status,
            "status": new_status,
            "task_type": task_type,
            "task_title": task_data.get("title", ""),
            "task_priority": task_data.get("priority", "normal"),
            "parent_task_id": task_data.get("parent_id"),
            "project_id": task_data.get("project_id"),
            "assigned_role": task_data.get("assigned_role")
        }
        
        context = HookContext(
            trigger_type=self.trigger_type,
            trigger_data=trigger_data,
            timestamp=datetime.now(),
            task_id=task_id
        )
        
        await self.fire_trigger(trigger_data, context)
    
    def monitor_status(self, status: str):
        """Add a task status to monitor"""
        self.monitored_statuses.add(status)
        logger.info(f"Now monitoring task status: {status}")
    
    def ignore_status(self, status: str):
        """Remove a task status from monitoring"""
        self.monitored_statuses.discard(status)
        logger.info(f"No longer monitoring task status: {status}")
    
    def monitor_task_type(self, task_type: str):
        """Add a task type to monitor"""
        self.monitored_task_types.add(task_type)
        logger.info(f"Now monitoring task type: {task_type}")
    
    def ignore_task_type(self, task_type: str):
        """Remove a task type from monitoring"""
        self.monitored_task_types.discard(task_type)
        logger.info(f"No longer monitoring task type: {task_type}")
    
    async def trigger_manual_task_event(self, task_id: str, event_type: str, task_data: Dict[str, Any]):
        """Manually trigger a task event (for testing or special cases)"""
        await self._handle_task_status_change(task_id, "unknown", event_type, task_data)