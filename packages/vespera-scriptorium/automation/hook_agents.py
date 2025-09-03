"""Template-driven hook agent system for pre/post task hooks and timed agent spawning.

This module implements the template-driven hook agent architecture that enables:
- Pre-task and post-task hook agents defined in templates
- Timed agents for scheduled execution based on template automation rules
- Rich context inheritance from templates to spawned agents
- Integration with the background task execution manager

The system follows the Dynamic Automation Architecture and Template System 
Architecture documents, enabling users to define hook behavior through JSON5 
template files rather than hardcoded system behavior.
"""

import asyncio
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, List, Optional, Any, Callable, Union, Set
import json
import time
import re
from pathlib import Path


def sanitize_template_data(data: Any, max_depth: int = 10, max_string_length: int = 10000) -> Any:
    """
    Sanitize template data to prevent injection attacks.
    
    Args:
        data: Template data to sanitize
        max_depth: Maximum recursion depth to prevent DoS
        max_string_length: Maximum string length to prevent DoS
        
    Returns:
        Sanitized version of the data
    """
    if max_depth <= 0:
        return "[MAX_DEPTH_EXCEEDED]"
    
    if isinstance(data, str):
        # Limit string length
        if len(data) > max_string_length:
            data = data[:max_string_length] + "[TRUNCATED]"
        # Remove potentially dangerous characters that could break JSON or prompts
        # Keep alphanumeric, spaces, basic punctuation, but remove control characters
        sanitized = re.sub(r'[^\w\s\-_.,:;!?(){}[\]"\'+=/<>@#$%^&*|~`]', '', data)
        return sanitized
    elif isinstance(data, dict):
        return {
            str(k)[:100]: sanitize_template_data(v, max_depth - 1, max_string_length) 
            for k, v in list(data.items())[:50]  # Limit dict size
        }
    elif isinstance(data, list):
        return [
            sanitize_template_data(item, max_depth - 1, max_string_length) 
            for item in data[:50]  # Limit list size
        ]
    elif isinstance(data, (int, float, bool, type(None))):
        return data
    else:
        # Convert unknown types to string and sanitize
        return sanitize_template_data(str(data), max_depth - 1, max_string_length)

# Try importing with both absolute and relative paths
try:
    from tasks.manager import TaskManager
    from tasks.models import TaskStatus
except ImportError:
    try:
        from ..tasks.manager import TaskManager
        from ..tasks.models import TaskStatus
    except ImportError:
        # Create mock classes for testing
        class TaskManager:
            def __init__(self, *args, **kwargs):
                pass
            async def create_task(self, *args, **kwargs):
                return {"id": "mock-task-123", "success": True}
        
        from enum import Enum
        class TaskStatus(Enum):
            TODO = "todo"
            IN_PROGRESS = "in_progress"
            DONE = "done"
# Import from background manager with fallback
try:
    from vespera_utilities.background_manager.task_execution_manager import BackgroundTaskExecutionManager
    from vespera_utilities.background_manager.task_execution_manager import TaskPriority
except ImportError:
    # Create mock classes for testing
    from enum import Enum
    class TaskPriority(Enum):
        LOW = 0
        NORMAL = 1
        HIGH = 2
        CRITICAL = 3
    
    class BackgroundTaskExecutionManager:
        def __init__(self, *args, **kwargs):
            pass
        def submit_task(self, *args, **kwargs):
            return "mock-task-id"
        def get_performance_metrics(self):
            return {"mock": True}


class HookTriggerType(Enum):
    """Types of hook triggers defined in templates."""
    PRE_TASK_EXECUTION = "pre_task_execution"
    POST_TASK_COMPLETION = "post_task_completion"
    POST_TASK_FAILURE = "post_task_failure"
    TEMPLATE_FIELD_CHANGE = "template_field_change"
    TEMPLATE_INSTANCE_CREATED = "template_instance_created"
    TEMPLATE_AUTOMATION_CHAIN = "template_automation_chain"
    TIMED_INTERVAL = "timed_interval"
    TIMED_SCHEDULE = "timed_schedule"


class AgentSpawnMode(Enum):
    """Agent execution modes following Video Game Component Framework."""
    PROGRAMMATIC = "programmatic"
    LLM_DRIVEN = "llm_driven"
    HYBRID = "hybrid"
    TEMPLATE_DRIVEN = "template_driven"


@dataclass
class TemplateContext:
    """Rich context data inherited from templates."""
    template_id: str
    template_name: str
    template_version: str
    template_data: Dict[str, Any]
    field_schema: Dict[str, Any]
    automation_rules: List[Dict[str, Any]]
    
    # Cross-template references
    linked_templates: Dict[str, List[str]] = field(default_factory=dict)
    template_relationships: Dict[str, Any] = field(default_factory=dict)
    
    # Environmental context
    immersive_config: Optional[Dict[str, Any]] = None
    environmental_state: Optional[Dict[str, Any]] = None
    
    # User context
    user_id: Optional[str] = None
    user_patterns: Optional[Dict[str, Any]] = None
    
    # Execution context
    triggering_event: Optional[Dict[str, Any]] = None
    parent_task_id: Optional[str] = None
    execution_chain_depth: int = 0


@dataclass
class HookAgentDefinition:
    """Definition of a hook agent from template automation rules."""
    hook_id: str
    name: str
    trigger_type: HookTriggerType
    spawn_mode: AgentSpawnMode
    
    # Template-defined hook behavior
    template_context: TemplateContext
    hook_rules: List[Dict[str, Any]]
    
    # Execution configuration
    priority: TaskPriority = TaskPriority.NORMAL
    max_execution_time: int = 300  # 5 minutes default
    retry_attempts: int = 1
    
    # Context filtering and conditions
    trigger_conditions: List[str] = field(default_factory=list)
    context_filters: Dict[str, Any] = field(default_factory=dict)
    
    # Agent capabilities and restrictions
    allowed_operations: List[str] = field(default_factory=list)
    file_patterns: List[str] = field(default_factory=list)
    
    # Scheduling (for timed agents)
    schedule_config: Optional[Dict[str, Any]] = None


@dataclass
class TimedAgentDefinition:
    """Definition of a timed agent from template automation rules."""
    agent_id: str
    name: str
    spawn_mode: AgentSpawnMode
    
    # Template context for the timed agent
    template_context: TemplateContext
    agent_rules: List[Dict[str, Any]]
    
    # Scheduling configuration
    schedule_type: str  # "interval", "cron", "one_time"
    schedule_config: Dict[str, Any]
    
    # Execution configuration
    priority: TaskPriority = TaskPriority.NORMAL
    max_execution_time: int = 300
    retry_attempts: int = 1
    
    # Agent capabilities
    allowed_operations: List[str] = field(default_factory=list)
    file_patterns: List[str] = field(default_factory=list)
    
    # State tracking
    last_execution: Optional[datetime] = None
    next_execution: Optional[datetime] = None
    execution_count: int = 0
    is_active: bool = True


class HookAgentExecutor(ABC):
    """Abstract base for hook agent executors."""
    
    @abstractmethod
    async def execute_hook_agent(self, 
                                hook_def: HookAgentDefinition,
                                context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a hook agent with the given context."""
        pass
    
    @abstractmethod
    async def execute_timed_agent(self,
                                 agent_def: TimedAgentDefinition,
                                 context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a timed agent with the given context."""
        pass


class ClaudeCodeHookExecutor(HookAgentExecutor):
    """Hook agent executor that spawns real Claude Code agents."""
    
    def __init__(self, task_manager: TaskManager):
        self.task_manager = task_manager
        self.logger = logging.getLogger(__name__)
    
    async def execute_hook_agent(self, 
                                hook_def: HookAgentDefinition,
                                context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute hook agent by spawning a Claude Code agent."""
        
        # Build agent context from template definition
        agent_context = self._build_agent_context(hook_def.template_context, context)
        
        # Create agent instructions from template hook rules
        agent_instructions = self._compile_hook_instructions(hook_def, agent_context)
        
        # Spawn Claude Code agent through task manager
        task_data = {
            "agent_type": "hook_agent",
            "hook_definition": asdict(hook_def),
            "agent_context": agent_context,
            "instructions": agent_instructions,
            "execution_mode": hook_def.spawn_mode.value,
            "max_execution_time": hook_def.max_execution_time
        }
        
        # Create task for the hook agent
        task_id = await self.task_manager.create_task(
            title=f"Hook Agent: {hook_def.name}",
            description=f"Template-driven hook agent execution",
            task_data=task_data,
            priority=hook_def.priority.value,
            role="hook_agent_executor"
        )
        
        self.logger.info(f"Spawned hook agent {hook_def.hook_id} as task {task_id}")
        
        return {
            "agent_id": hook_def.hook_id,
            "task_id": task_id,
            "status": "spawned",
            "spawn_time": datetime.now().isoformat()
        }
    
    async def execute_timed_agent(self,
                                 agent_def: TimedAgentDefinition,
                                 context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute timed agent by spawning a Claude Code agent."""
        
        # Build agent context from template definition
        agent_context = self._build_agent_context(agent_def.template_context, context)
        
        # Add scheduling context
        agent_context["scheduling"] = {
            "schedule_type": agent_def.schedule_type,
            "schedule_config": agent_def.schedule_config,
            "execution_count": agent_def.execution_count,
            "last_execution": agent_def.last_execution.isoformat() if agent_def.last_execution else None
        }
        
        # Create agent instructions from template rules
        agent_instructions = self._compile_timed_agent_instructions(agent_def, agent_context)
        
        # Spawn Claude Code agent
        task_data = {
            "agent_type": "timed_agent",
            "agent_definition": asdict(agent_def),
            "agent_context": agent_context,
            "instructions": agent_instructions,
            "execution_mode": agent_def.spawn_mode.value,
            "max_execution_time": agent_def.max_execution_time
        }
        
        task_id = await self.task_manager.create_task(
            title=f"Timed Agent: {agent_def.name}",
            description=f"Template-driven scheduled agent execution",
            task_data=task_data,
            priority=agent_def.priority.value,
            role="timed_agent_executor"
        )
        
        self.logger.info(f"Spawned timed agent {agent_def.agent_id} as task {task_id}")
        
        return {
            "agent_id": agent_def.agent_id,
            "task_id": task_id,
            "status": "spawned",
            "execution_time": datetime.now().isoformat(),
            "execution_count": agent_def.execution_count + 1
        }
    
    def _build_agent_context(self, 
                            template_context: TemplateContext,
                            execution_context: Dict[str, Any]) -> Dict[str, Any]:
        """Build comprehensive agent context from template and execution data."""
        
        return {
            "template": {
                "id": template_context.template_id,
                "name": template_context.template_name,
                "version": template_context.template_version,
                "data": template_context.template_data,
                "field_schema": template_context.field_schema,
                "automation_rules": template_context.automation_rules
            },
            "relationships": {
                "linked_templates": template_context.linked_templates,
                "template_relationships": template_context.template_relationships
            },
            "environment": {
                "immersive_config": template_context.immersive_config or {},
                "environmental_state": template_context.environmental_state or {}
            },
            "user": {
                "user_id": template_context.user_id,
                "patterns": template_context.user_patterns or {}
            },
            "execution": {
                "triggering_event": template_context.triggering_event or {},
                "parent_task_id": template_context.parent_task_id,
                "chain_depth": template_context.execution_chain_depth,
                **execution_context
            }
        }
    
    def _compile_hook_instructions(self, 
                                  hook_def: HookAgentDefinition,
                                  agent_context: Dict[str, Any]) -> str:
        """Compile template hook rules into agent instructions."""
        
        instructions = f"""# Template-Driven Hook Agent: {hook_def.name}

## Agent Context
You are a hook agent spawned from the template "{hook_def.template_context.template_name}" 
(ID: {hook_def.template_context.template_id}) with trigger type: {hook_def.trigger_type.value}.

## Template Context
Template Data: {json.dumps(sanitize_template_data(agent_context['template']['data']), indent=2)}
Field Schema: {json.dumps(sanitize_template_data(agent_context['template']['field_schema']), indent=2)}

## Execution Context
Trigger Event: {json.dumps(sanitize_template_data(agent_context['execution']['triggering_event']), indent=2)}
Parent Task: {agent_context['execution']['parent_task_id']}
Chain Depth: {agent_context['execution']['chain_depth']}

## Hook Rules
You must execute the following template-defined hook rules:
"""
        
        for i, rule in enumerate(hook_def.hook_rules, 1):
            instructions += f"\n### Rule {i}: {rule.get('name', 'Unnamed Rule')}\n"
            instructions += f"**Trigger**: {rule.get('trigger', 'N/A')}\n"
            instructions += f"**Action**: {rule.get('action', 'N/A')}\n"
            instructions += f"**Parameters**: {json.dumps(sanitize_template_data(rule.get('params', {})), indent=2)}\n"
            
            if rule.get('condition'):
                instructions += f"**Condition**: {rule['condition']}\n"
        
        instructions += f"""

## Execution Mode
This agent operates in {hook_def.spawn_mode.value} mode.

## Capabilities and Restrictions
Allowed Operations: {', '.join(hook_def.allowed_operations) if hook_def.allowed_operations else 'All operations'}
File Patterns: {', '.join(hook_def.file_patterns) if hook_def.file_patterns else 'No restrictions'}

## Linked Templates
{json.dumps(sanitize_template_data(agent_context['relationships']['linked_templates']), indent=2)}

## Instructions
Based on the template hook rules above and the current context, execute the required 
actions. Follow the template-defined behavior exactly as specified. Report back with 
detailed results of each action taken.

If operating in LLM-driven or hybrid mode, use your understanding of the context to 
enhance the template-defined actions while staying within the specified parameters.
"""
        
        return instructions
    
    def _compile_timed_agent_instructions(self,
                                         agent_def: TimedAgentDefinition,
                                         agent_context: Dict[str, Any]) -> str:
        """Compile template timed agent rules into agent instructions."""
        
        instructions = f"""# Template-Driven Timed Agent: {agent_def.name}

## Agent Context
You are a timed agent spawned from the template "{agent_def.template_context.template_name}" 
(ID: {agent_def.template_context.template_id}) with schedule type: {agent_def.schedule_type}.

## Scheduling Context
Schedule Configuration: {json.dumps(sanitize_template_data(agent_def.schedule_config), indent=2)}
Execution Count: {agent_context['scheduling']['execution_count']}
Last Execution: {agent_context['scheduling']['last_execution']}

## Template Context
Template Data: {json.dumps(sanitize_template_data(agent_context['template']['data']), indent=2)}
Field Schema: {json.dumps(sanitize_template_data(agent_context['template']['field_schema']), indent=2)}

## Agent Rules
You must execute the following template-defined agent rules:
"""
        
        for i, rule in enumerate(agent_def.agent_rules, 1):
            instructions += f"\n### Rule {i}: {rule.get('name', 'Unnamed Rule')}\n"
            instructions += f"**Action**: {rule.get('action', 'N/A')}\n"
            instructions += f"**Parameters**: {json.dumps(sanitize_template_data(rule.get('params', {})), indent=2)}\n"
            
            if rule.get('condition'):
                instructions += f"**Condition**: {rule['condition']}\n"
            if rule.get('frequency'):
                instructions += f"**Frequency**: {rule['frequency']}\n"
        
        instructions += f"""

## Execution Mode
This agent operates in {agent_def.spawn_mode.value} mode.

## Capabilities and Restrictions
Allowed Operations: {', '.join(agent_def.allowed_operations) if agent_def.allowed_operations else 'All operations'}
File Patterns: {', '.join(agent_def.file_patterns) if agent_def.file_patterns else 'No restrictions'}

## Instructions
Based on the template agent rules above and the current scheduling context, execute 
the required periodic/scheduled actions. Follow the template-defined behavior exactly 
as specified.

This is execution #{agent_context['scheduling']['execution_count']} of this timed agent.
Report back with detailed results of each action taken and any scheduling-related 
observations or recommendations.
"""
        
        return instructions


class TemplateHookAgentManager:
    """Main manager for template-driven hook and timed agents."""
    
    def __init__(self, 
                 task_manager: TaskManager,
                 background_executor: BackgroundTaskExecutionManager,
                 template_registry: 'TemplateRegistry'):
        self.task_manager = task_manager
        self.background_executor = background_executor
        self.template_registry = template_registry
        
        # Hook agent executor
        self.executor = ClaudeCodeHookExecutor(task_manager)
        
        # Active hook and timed agent definitions
        self.hook_agents: Dict[str, HookAgentDefinition] = {}
        self.timed_agents: Dict[str, TimedAgentDefinition] = {}
        
        # Execution tracking
        self.hook_execution_history: List[Dict[str, Any]] = []
        self.timed_execution_history: List[Dict[str, Any]] = []
        
        # Background scheduler for timed agents
        self.scheduler_task: Optional[asyncio.Task] = None
        self.scheduler_running = False
        
        self.logger = logging.getLogger(__name__)
    
    async def initialize(self):
        """Initialize the hook agent manager and load template definitions."""
        await self._load_template_hook_definitions()
        await self._load_template_timed_agents()
        await self._start_timed_agent_scheduler()
        
        self.logger.info(f"Initialized TemplateHookAgentManager with {len(self.hook_agents)} hook agents and {len(self.timed_agents)} timed agents")
    
    async def register_hook_agent_from_template(self, 
                                              template_id: str,
                                              automation_rule: Dict[str, Any],
                                              template_context: TemplateContext) -> str:
        """Register a hook agent from a template automation rule."""
        
        hook_id = f"{template_id}_{automation_rule.get('name', 'hook')}_{int(time.time())}"
        
        # Parse hook trigger type
        trigger_type_str = automation_rule.get('trigger', 'template_field_change')
        try:
            trigger_type = HookTriggerType(trigger_type_str)
        except ValueError:
            self.logger.warning(f"Unknown hook trigger type: {trigger_type_str}, defaulting to template_field_change")
            trigger_type = HookTriggerType.TEMPLATE_FIELD_CHANGE
        
        # Parse spawn mode
        spawn_mode_str = automation_rule.get('spawn_mode', 'hybrid')
        try:
            spawn_mode = AgentSpawnMode(spawn_mode_str)
        except ValueError:
            self.logger.warning(f"Unknown spawn mode: {spawn_mode_str}, defaulting to hybrid")
            spawn_mode = AgentSpawnMode.HYBRID
        
        # Extract hook configuration
        hook_config = automation_rule.get('hook_agent', {})
        
        hook_def = HookAgentDefinition(
            hook_id=hook_id,
            name=automation_rule.get('name', f'Hook Agent for {template_context.template_name}'),
            trigger_type=trigger_type,
            spawn_mode=spawn_mode,
            template_context=template_context,
            hook_rules=[automation_rule],
            priority=TaskPriority(hook_config.get('priority', 1)),
            max_execution_time=hook_config.get('max_execution_time', 300),
            retry_attempts=hook_config.get('retry_attempts', 1),
            trigger_conditions=hook_config.get('trigger_conditions', []),
            context_filters=hook_config.get('context_filters', {}),
            allowed_operations=hook_config.get('allowed_operations', []),
            file_patterns=hook_config.get('file_patterns', [])
        )
        
        self.hook_agents[hook_id] = hook_def
        
        self.logger.info(f"Registered hook agent {hook_id} from template {template_id}")
        return hook_id
    
    async def register_timed_agent_from_template(self,
                                               template_id: str,
                                               automation_rule: Dict[str, Any],
                                               template_context: TemplateContext) -> str:
        """Register a timed agent from a template automation rule."""
        
        agent_id = f"{template_id}_{automation_rule.get('name', 'timed')}_{int(time.time())}"
        
        # Parse spawn mode
        spawn_mode_str = automation_rule.get('spawn_mode', 'hybrid')
        try:
            spawn_mode = AgentSpawnMode(spawn_mode_str)
        except ValueError:
            self.logger.warning(f"Unknown spawn mode: {spawn_mode_str}, defaulting to hybrid")
            spawn_mode = AgentSpawnMode.HYBRID
        
        # Extract timed agent configuration
        timed_config = automation_rule.get('timed_agent', {})
        schedule_config = timed_config.get('schedule', {})
        
        # Calculate next execution time
        next_execution = self._calculate_next_execution(schedule_config)
        
        agent_def = TimedAgentDefinition(
            agent_id=agent_id,
            name=automation_rule.get('name', f'Timed Agent for {template_context.template_name}'),
            spawn_mode=spawn_mode,
            template_context=template_context,
            agent_rules=[automation_rule],
            schedule_type=schedule_config.get('type', 'interval'),
            schedule_config=schedule_config,
            priority=TaskPriority(timed_config.get('priority', 1)),
            max_execution_time=timed_config.get('max_execution_time', 300),
            retry_attempts=timed_config.get('retry_attempts', 1),
            allowed_operations=timed_config.get('allowed_operations', []),
            file_patterns=timed_config.get('file_patterns', []),
            next_execution=next_execution
        )
        
        self.timed_agents[agent_id] = agent_def
        
        self.logger.info(f"Registered timed agent {agent_id} from template {template_id}, next execution: {next_execution}")
        return agent_id
    
    async def trigger_hook_agent(self, 
                                hook_id: str,
                                context: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Trigger execution of a specific hook agent."""
        
        if hook_id not in self.hook_agents:
            self.logger.warning(f"Hook agent {hook_id} not found")
            return None
        
        hook_def = self.hook_agents[hook_id]
        
        # Check trigger conditions
        if not self._check_hook_conditions(hook_def, context):
            self.logger.debug(f"Hook agent {hook_id} conditions not met, skipping execution")
            return None
        
        # Execute hook agent in background
        task_id = self.background_executor.submit_task(
            f"Hook Agent: {hook_def.name}",
            self._execute_hook_agent_async,
            hook_def,
            context,
            priority=hook_def.priority
        )
        
        # Record execution
        execution_record = {
            "hook_id": hook_id,
            "task_id": task_id,
            "trigger_time": datetime.now().isoformat(),
            "context": context,
            "status": "triggered"
        }
        self.hook_execution_history.append(execution_record)
        
        # Keep only last 1000 executions
        if len(self.hook_execution_history) > 1000:
            self.hook_execution_history = self.hook_execution_history[-1000:]
        
        self.logger.info(f"Triggered hook agent {hook_id} as background task {task_id}")
        
        return {
            "hook_id": hook_id,
            "background_task_id": task_id,
            "status": "triggered",
            "trigger_time": execution_record["trigger_time"]
        }
    
    async def _execute_hook_agent_async(self, 
                                       hook_def: HookAgentDefinition,
                                       context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute hook agent asynchronously."""
        try:
            result = await self.executor.execute_hook_agent(hook_def, context)
            self.logger.info(f"Hook agent {hook_def.hook_id} executed successfully")
            return result
        except Exception as e:
            self.logger.error(f"Hook agent {hook_def.hook_id} execution failed: {e}")
            raise
    
    def _check_hook_conditions(self, 
                              hook_def: HookAgentDefinition,
                              context: Dict[str, Any]) -> bool:
        """Check if hook agent conditions are met."""
        
        # TODO: Implement condition evaluation logic
        # This would evaluate template-defined conditions against the context
        # For now, return True to execute all triggered hooks
        return True
    
    async def _start_timed_agent_scheduler(self):
        """Start the background scheduler for timed agents."""
        if self.scheduler_running:
            return
        
        self.scheduler_running = True
        self.scheduler_task = asyncio.create_task(self._scheduler_loop())
        self.logger.info("Started timed agent scheduler")
    
    async def _scheduler_loop(self):
        """Main scheduler loop for timed agents."""
        while self.scheduler_running:
            try:
                current_time = datetime.now()
                
                # Check each timed agent
                for agent_id, agent_def in self.timed_agents.items():
                    if not agent_def.is_active:
                        continue
                    
                    if (agent_def.next_execution and 
                        current_time >= agent_def.next_execution):
                        
                        # Execute timed agent
                        await self._execute_timed_agent(agent_def)
                        
                        # Update next execution time
                        agent_def.next_execution = self._calculate_next_execution(
                            agent_def.schedule_config
                        )
                        agent_def.last_execution = current_time
                        agent_def.execution_count += 1
                
                # Sleep for 30 seconds before next check
                await asyncio.sleep(30)
                
            except Exception as e:
                self.logger.error(f"Error in timed agent scheduler: {e}")
                await asyncio.sleep(60)  # Longer sleep on error
    
    async def _execute_timed_agent(self, agent_def: TimedAgentDefinition):
        """Execute a timed agent."""
        
        context = {
            "execution_time": datetime.now().isoformat(),
            "execution_count": agent_def.execution_count,
            "last_execution": agent_def.last_execution.isoformat() if agent_def.last_execution else None
        }
        
        # Execute in background
        task_id = self.background_executor.submit_task(
            f"Timed Agent: {agent_def.name}",
            self._execute_timed_agent_async,
            agent_def,
            context,
            priority=agent_def.priority
        )
        
        # Record execution
        execution_record = {
            "agent_id": agent_def.agent_id,
            "task_id": task_id,
            "execution_time": context["execution_time"],
            "execution_count": agent_def.execution_count + 1,
            "status": "triggered"
        }
        self.timed_execution_history.append(execution_record)
        
        # Keep only last 1000 executions
        if len(self.timed_execution_history) > 1000:
            self.timed_execution_history = self.timed_execution_history[-1000:]
        
        self.logger.info(f"Triggered timed agent {agent_def.agent_id} as background task {task_id}")
    
    async def _execute_timed_agent_async(self,
                                        agent_def: TimedAgentDefinition,
                                        context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute timed agent asynchronously."""
        try:
            result = await self.executor.execute_timed_agent(agent_def, context)
            self.logger.info(f"Timed agent {agent_def.agent_id} executed successfully")
            return result
        except Exception as e:
            self.logger.error(f"Timed agent {agent_def.agent_id} execution failed: {e}")
            raise
    
    def _calculate_next_execution(self, schedule_config: Dict[str, Any]) -> Optional[datetime]:
        """Calculate next execution time based on schedule configuration."""
        
        current_time = datetime.now()
        schedule_type = schedule_config.get('type', 'interval')
        
        if schedule_type == 'interval':
            # Interval-based scheduling
            interval_seconds = schedule_config.get('interval_seconds', 3600)  # Default 1 hour
            return current_time + timedelta(seconds=interval_seconds)
        
        elif schedule_type == 'cron':
            # TODO: Implement cron-style scheduling
            # For now, default to 1 hour interval
            return current_time + timedelta(hours=1)
        
        elif schedule_type == 'one_time':
            # One-time execution at specified time
            target_time_str = schedule_config.get('execute_at')
            if target_time_str:
                try:
                    target_time = datetime.fromisoformat(target_time_str)
                    if target_time > current_time:
                        return target_time
                except ValueError:
                    self.logger.warning(f"Invalid one_time schedule format: {target_time_str}")
            return None
        
        else:
            self.logger.warning(f"Unknown schedule type: {schedule_type}")
            return None
    
    async def _load_template_hook_definitions(self):
        """Load hook agent definitions from all templates."""
        # TODO: Integrate with TemplateRegistry when available
        # This would scan all templates for hook agent automation rules
        pass
    
    async def _load_template_timed_agents(self):
        """Load timed agent definitions from all templates."""
        # TODO: Integrate with TemplateRegistry when available
        # This would scan all templates for timed agent automation rules
        pass
    
    async def shutdown(self):
        """Shutdown the hook agent manager."""
        self.scheduler_running = False
        
        if self.scheduler_task:
            self.scheduler_task.cancel()
            try:
                await self.scheduler_task
            except asyncio.CancelledError:
                pass
        
        self.logger.info("TemplateHookAgentManager shutdown complete")
    
    # Status and monitoring methods
    
    def get_hook_agent_status(self) -> Dict[str, Any]:
        """Get status of all hook agents."""
        return {
            "total_hook_agents": len(self.hook_agents),
            "hook_agents": [
                {
                    "hook_id": hook_id,
                    "name": hook_def.name,
                    "trigger_type": hook_def.trigger_type.value,
                    "spawn_mode": hook_def.spawn_mode.value,
                    "template_id": hook_def.template_context.template_id
                }
                for hook_id, hook_def in self.hook_agents.items()
            ],
            "recent_executions": self.hook_execution_history[-10:]  # Last 10
        }
    
    def get_timed_agent_status(self) -> Dict[str, Any]:
        """Get status of all timed agents."""
        return {
            "total_timed_agents": len(self.timed_agents),
            "active_agents": len([a for a in self.timed_agents.values() if a.is_active]),
            "timed_agents": [
                {
                    "agent_id": agent_id,
                    "name": agent_def.name,
                    "schedule_type": agent_def.schedule_type,
                    "spawn_mode": agent_def.spawn_mode.value,
                    "template_id": agent_def.template_context.template_id,
                    "next_execution": agent_def.next_execution.isoformat() if agent_def.next_execution else None,
                    "execution_count": agent_def.execution_count,
                    "is_active": agent_def.is_active
                }
                for agent_id, agent_def in self.timed_agents.items()
            ],
            "recent_executions": self.timed_execution_history[-10:]  # Last 10
        }
    
    def get_comprehensive_status(self) -> Dict[str, Any]:
        """Get comprehensive status of the hook agent system."""
        return {
            "hook_agents": self.get_hook_agent_status(),
            "timed_agents": self.get_timed_agent_status(),
            "scheduler_status": {
                "is_running": self.scheduler_running,
                "has_scheduler_task": self.scheduler_task is not None
            },
            "background_executor": self.background_executor.get_performance_metrics()
        }