"""
Hook Engine - Core Orchestration

The main engine that processes hook triggers, executes actions,
and manages the lifecycle of automated workflows.
"""

import asyncio
import logging
from typing import List, Dict, Any, Optional, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass
import uuid

from .models import (
    HookDefinition, HookExecution, HookContext, HookTriggerType, 
    HookActionType, HookPriority
)
from .registry import HookRegistry
from ..triggers.base import HookTrigger
from ..actions.base import HookAction

logger = logging.getLogger(__name__)


@dataclass
class ExecutionStats:
    """Statistics for hook execution monitoring"""
    total_executions: int = 0
    successful_executions: int = 0
    failed_executions: int = 0
    average_execution_time: float = 0.0
    last_execution_time: Optional[datetime] = None


class HookEngine:
    """
    Core hook execution engine that manages the complete workflow automation lifecycle.
    
    Responsibilities:
    - Process incoming triggers from various sources
    - Execute hook actions (programmatic, LLM-based, task spawning)
    - Manage execution queues and priorities
    - Handle retries and error recovery
    - Provide execution monitoring and statistics
    """
    
    def __init__(self, registry: HookRegistry):
        self.registry = registry
        self.execution_queue: asyncio.Queue = asyncio.Queue()
        self.active_executions: Dict[str, HookExecution] = {}
        self.execution_stats: Dict[str, ExecutionStats] = {}
        self.trigger_debounce: Dict[str, datetime] = {}
        self.is_running = False
        self.worker_tasks: List[asyncio.Task] = []
        
        # Action executor registry
        self.action_executors: Dict[HookActionType, HookAction] = {}
        
    async def start(self, worker_count: int = 3):
        """Start the hook engine with specified number of workers"""
        if self.is_running:
            logger.warning("Hook engine is already running")
            return
            
        self.is_running = True
        logger.info(f"Starting hook engine with {worker_count} workers")
        
        # Start worker tasks
        for i in range(worker_count):
            task = asyncio.create_task(self._worker(f"worker-{i}"))
            self.worker_tasks.append(task)
            
        logger.info("Hook engine started successfully")
    
    async def stop(self):
        """Stop the hook engine and wait for workers to complete"""
        if not self.is_running:
            return
            
        self.is_running = False
        logger.info("Stopping hook engine...")
        
        # Wait for all workers to complete
        if self.worker_tasks:
            await asyncio.gather(*self.worker_tasks, return_exceptions=True)
            self.worker_tasks.clear()
            
        # Cancel any remaining active executions
        for execution in self.active_executions.values():
            if execution.status == "running":
                execution.status = "cancelled"
                execution.completed_at = datetime.now()
                
        logger.info("Hook engine stopped")
    
    async def process_trigger(self, trigger_type: HookTriggerType, trigger_data: Dict[str, Any], 
                            context: Optional[HookContext] = None):
        """
        Process an incoming trigger and queue matching hooks for execution.
        
        Args:
            trigger_type: Type of trigger that occurred
            trigger_data: Data associated with the trigger
            context: Optional additional context
        """
        if context is None:
            context = HookContext(
                trigger_type=trigger_type,
                trigger_data=trigger_data,
                timestamp=datetime.now()
            )
        
        # Find matching hooks
        matching_hooks = self.registry.find_hooks_for_trigger(trigger_type, trigger_data)
        
        if not matching_hooks:
            logger.debug(f"No hooks found for trigger: {trigger_type}")
            return
            
        logger.info(f"Found {len(matching_hooks)} hooks for trigger: {trigger_type}")
        
        # Check debounce and queue executions
        for hook in matching_hooks:
            if await self._should_execute_hook(hook, context):
                execution = HookExecution(
                    id=str(uuid.uuid4()),
                    hook_id=hook.id,
                    context=context,
                    started_at=datetime.now()
                )
                
                # Queue by priority (higher priority = lower queue position)
                priority_score = hook.priority.value
                await self.execution_queue.put((priority_score, execution))
                
                logger.info(f"Queued hook execution: {hook.name} (priority: {hook.priority.name})")
    
    async def _should_execute_hook(self, hook: HookDefinition, context: HookContext) -> bool:
        """Check if hook should execute based on debounce and conditions"""
        if not hook.enabled:
            return False
            
        # Check debounce
        debounce_key = f"{hook.id}:{context.trigger_type.value}"
        last_trigger = self.trigger_debounce.get(debounce_key)
        
        if last_trigger:
            time_since_last = (context.timestamp - last_trigger).total_seconds()
            if time_since_last < hook.trigger.debounce_seconds:
                logger.debug(f"Hook {hook.name} debounced (last trigger {time_since_last:.2f}s ago)")
                return False
        
        # Update debounce timestamp
        self.trigger_debounce[debounce_key] = context.timestamp
        
        # TODO: Add condition evaluation logic here
        return True
    
    async def _worker(self, worker_name: str):
        """Worker task that processes queued hook executions"""
        logger.info(f"Hook worker {worker_name} started")
        
        while self.is_running:
            try:
                # Wait for next execution with timeout
                priority_score, execution = await asyncio.wait_for(
                    self.execution_queue.get(), 
                    timeout=1.0
                )
                
                await self._execute_hook(execution)
                
            except asyncio.TimeoutError:
                # Normal timeout, continue loop
                continue
            except Exception as e:
                logger.error(f"Worker {worker_name} encountered error: {e}")
                
        logger.info(f"Hook worker {worker_name} stopped")
    
    async def _execute_hook(self, execution: HookExecution):
        """Execute a single hook with all its actions"""
        hook = self.registry.get_hook(execution.hook_id)
        if not hook:
            logger.error(f"Hook not found: {execution.hook_id}")
            return
            
        logger.info(f"Executing hook: {hook.name}")
        self.active_executions[execution.id] = execution
        
        try:
            # Execute all actions in sequence
            for action_config in hook.actions:
                action_result = await self._execute_action(action_config, execution.context)
                execution.results.append(action_result)
                
                # Check if action spawned tasks
                if "spawned_tasks" in action_result:
                    execution.spawned_tasks.extend(action_result["spawned_tasks"])
            
            execution.status = "completed"
            execution.completed_at = datetime.now()
            
            # Update hook statistics
            hook.execution_count += 1
            hook.last_execution = execution.completed_at
            
            self._update_execution_stats(hook.id, execution)
            logger.info(f"Hook executed successfully: {hook.name}")
            
        except Exception as e:
            execution.status = "failed"
            execution.completed_at = datetime.now()
            execution.errors.append(str(e))
            
            logger.error(f"Hook execution failed: {hook.name} - {e}")
            
        finally:
            # Remove from active executions
            self.active_executions.pop(execution.id, None)
    
    async def _execute_action(self, action_config, context: HookContext) -> Dict[str, Any]:
        """Execute a single hook action"""
        action_executor = self.action_executors.get(action_config.action_type)
        
        if not action_executor:
            logger.error(f"No executor found for action type: {action_config.action_type}")
            return {
                "success": False,
                "error": f"No executor for action type: {action_config.action_type}"
            }
        
        try:
            # Execute with timeout
            result = await asyncio.wait_for(
                action_executor.execute(action_config, context),
                timeout=action_config.timeout_seconds
            )
            
            return {
                "success": True,
                "action_type": action_config.action_type.value,
                "result": result
            }
            
        except asyncio.TimeoutError:
            logger.error(f"Action timed out: {action_config.action_type}")
            return {
                "success": False,
                "error": f"Action timed out after {action_config.timeout_seconds}s"
            }
        except Exception as e:
            logger.error(f"Action execution failed: {action_config.action_type} - {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def register_action_executor(self, action_type: HookActionType, executor: HookAction):
        """Register an action executor for a specific action type"""
        self.action_executors[action_type] = executor
        logger.info(f"Registered action executor for: {action_type}")
    
    def _update_execution_stats(self, hook_id: str, execution: HookExecution):
        """Update execution statistics for a hook"""
        if hook_id not in self.execution_stats:
            self.execution_stats[hook_id] = ExecutionStats()
            
        stats = self.execution_stats[hook_id]
        stats.total_executions += 1
        stats.last_execution_time = execution.completed_at
        
        if execution.status == "completed":
            stats.successful_executions += 1
        else:
            stats.failed_executions += 1
            
        # Calculate average execution time
        if execution.completed_at and execution.started_at:
            duration = (execution.completed_at - execution.started_at).total_seconds()
            stats.average_execution_time = (
                (stats.average_execution_time * (stats.total_executions - 1) + duration) / 
                stats.total_executions
            )
    
    def get_execution_stats(self, hook_id: Optional[str] = None) -> Dict[str, Any]:
        """Get execution statistics for hooks"""
        if hook_id:
            return self.execution_stats.get(hook_id, ExecutionStats()).__dict__
        
        return {
            hook_id: stats.__dict__ 
            for hook_id, stats in self.execution_stats.items()
        }
    
    def get_active_executions(self) -> List[HookExecution]:
        """Get list of currently active hook executions"""
        return list(self.active_executions.values())