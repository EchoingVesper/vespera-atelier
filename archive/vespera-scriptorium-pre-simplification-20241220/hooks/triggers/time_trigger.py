"""
Time-based Trigger

Monitors time-based events for scheduled hooks.
"""

import asyncio
import logging
from typing import Dict, Any, Callable, Optional
from datetime import datetime, timedelta

from .base import HookTrigger
from ..core.models import HookTriggerType, HookContext

logger = logging.getLogger(__name__)


class TimeTrigger(HookTrigger):
    """
    Time-based trigger for scheduled or recurring hooks.
    
    Supports:
    - One-time scheduled execution
    - Recurring intervals
    - Cron-like scheduling (simplified)
    """
    
    def __init__(self):
        super().__init__(HookTriggerType.TIME_BASED)
        self.scheduled_tasks = {}
        self.timer_task: Optional[asyncio.Task] = None
    
    async def start(self, callback: Callable[[HookTriggerType, Dict[str, Any], Optional[HookContext]], None]):
        """Start the time-based trigger"""
        if self.is_active:
            logger.warning("Time trigger is already active")
            return
            
        self.callback = callback
        self.is_active = True
        
        # Start timer task
        self.timer_task = asyncio.create_task(self._timer_loop())
        logger.info("Time trigger started")
    
    async def stop(self):
        """Stop the time-based trigger"""
        if not self.is_active:
            return
            
        self.is_active = False
        
        if self.timer_task:
            self.timer_task.cancel()
            try:
                await self.timer_task
            except asyncio.CancelledError:
                pass
            self.timer_task = None
        
        logger.info("Time trigger stopped")
    
    async def _timer_loop(self):
        """Main timer loop that checks scheduled events"""
        try:
            while self.is_active:
                current_time = datetime.now()
                
                # Check scheduled tasks (simplified implementation)
                expired_tasks = []
                for task_id, task_info in self.scheduled_tasks.items():
                    if current_time >= task_info["next_execution"]:
                        expired_tasks.append(task_id)
                
                # Execute expired tasks
                for task_id in expired_tasks:
                    task_info = self.scheduled_tasks[task_id]
                    await self._execute_scheduled_task(task_id, task_info)
                
                # Sleep for 1 second before next check
                await asyncio.sleep(1)
                
        except asyncio.CancelledError:
            logger.info("Timer loop cancelled")
            raise
        except Exception as e:
            logger.error(f"Error in timer loop: {e}")
    
    async def _execute_scheduled_task(self, task_id: str, task_info: Dict[str, Any]):
        """Execute a scheduled task"""
        trigger_data = {
            "task_id": task_id,
            "scheduled_time": task_info["next_execution"].isoformat(),
            "task_type": task_info.get("task_type", "scheduled")
        }
        
        context = HookContext(
            trigger_type=self.trigger_type,
            trigger_data=trigger_data,
            timestamp=datetime.now()
        )
        
        await self.fire_trigger(trigger_data, context)
        
        # Update next execution time for recurring tasks
        if task_info.get("recurring", False) and task_info.get("interval"):
            interval_seconds = task_info["interval"]
            task_info["next_execution"] = datetime.now() + timedelta(seconds=interval_seconds)
        else:
            # Remove one-time tasks after execution
            del self.scheduled_tasks[task_id]
    
    def schedule_once(self, task_id: str, execution_time: datetime, task_data: Optional[Dict[str, Any]] = None):
        """Schedule a one-time execution"""
        self.scheduled_tasks[task_id] = {
            "next_execution": execution_time,
            "recurring": False,
            "task_data": task_data or {}
        }
        logger.info(f"Scheduled one-time task {task_id} for {execution_time}")
    
    def schedule_recurring(self, task_id: str, interval_seconds: int, task_data: Optional[Dict[str, Any]] = None):
        """Schedule a recurring execution"""
        next_execution = datetime.now() + timedelta(seconds=interval_seconds)
        self.scheduled_tasks[task_id] = {
            "next_execution": next_execution,
            "recurring": True,
            "interval": interval_seconds,
            "task_data": task_data or {}
        }
        logger.info(f"Scheduled recurring task {task_id} every {interval_seconds} seconds")
    
    def cancel_scheduled_task(self, task_id: str):
        """Cancel a scheduled task"""
        if task_id in self.scheduled_tasks:
            del self.scheduled_tasks[task_id]
            logger.info(f"Cancelled scheduled task: {task_id}")
        else:
            logger.warning(f"Scheduled task not found: {task_id}")