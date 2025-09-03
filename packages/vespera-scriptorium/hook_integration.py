"""Integration module for hook agents with the MCP server.

This module provides the integration layer between the template-driven hook agent system
and the main MCP server, adding hook agent and timed agent tools.
"""

import logging
from typing import Dict, Any, Optional, List
from pydantic import BaseModel, Field

# Try importing with both absolute and relative paths
try:
    from automation.hook_agents import (
        TemplateHookAgentManager,
        TemplateContext,
        HookTriggerType,
        AgentSpawnMode
    )
except ImportError:
    try:
        from .automation.hook_agents import (
            TemplateHookAgentManager,
            TemplateContext,
            HookTriggerType,
            AgentSpawnMode
        )
    except ImportError:
        # Create mock classes for testing
        from enum import Enum
        
        class HookTriggerType(Enum):
            PRE_TASK_EXECUTION = "pre_task_execution"
            POST_TASK_COMPLETION = "post_task_completion"
        
        class AgentSpawnMode(Enum):
            PROGRAMMATIC = "programmatic"
            LLM_DRIVEN = "llm_driven"
            HYBRID = "hybrid"
        
        from dataclasses import dataclass
        from typing import Dict, Any
        
        @dataclass
        class TemplateContext:
            template_id: str
            template_name: str
            template_version: str
            template_data: Dict[str, Any]
            field_schema: Dict[str, Any]
            automation_rules: list
        
        class TemplateHookAgentManager:
            def __init__(self, *args, **kwargs):
                pass
            async def initialize(self):
                pass

# Import TaskPriority from the background manager
try:
    from vespera_utilities.background_manager.task_execution_manager import TaskPriority
except ImportError:
    from enum import Enum
    class TaskPriority(Enum):
        LOW = 0
        NORMAL = 1
        HIGH = 2
        CRITICAL = 3
# Try importing BackgroundTaskExecutionManager with fallback
try:
    from vespera_utilities.background_manager.task_execution_manager import BackgroundTaskExecutionManager
except ImportError:
    try:
        import sys
        from pathlib import Path
        utilities_path = Path(__file__).parent.parent.parent / "vespera-utilities"  
        sys.path.insert(0, str(utilities_path))
        from background_manager.task_execution_manager import BackgroundTaskExecutionManager
    except ImportError:
        # Create a mock for testing if still can't import
        class BackgroundTaskExecutionManager:
            def __init__(self, *args, **kwargs):
                pass
            def submit_task(self, *args, **kwargs):
                return "mock-task-id"
            def get_performance_metrics(self):
                return {"mock": True}

logger = logging.getLogger(__name__)


class HookAgentInput(BaseModel):
    """Input model for registering hook agents from templates."""
    template_id: str = Field(description="Template ID that defines this hook agent")
    template_name: str = Field(description="Human-readable template name")
    automation_rule: Dict[str, Any] = Field(description="Template automation rule defining the hook")
    template_data: Dict[str, Any] = Field(default_factory=dict, description="Current template instance data")
    field_schema: Dict[str, Any] = Field(default_factory=dict, description="Template field schema")
    context: Optional[Dict[str, Any]] = Field(default=None, description="Additional context for the hook")


class TimedAgentInput(BaseModel):
    """Input model for registering timed agents from templates."""
    template_id: str = Field(description="Template ID that defines this timed agent")
    template_name: str = Field(description="Human-readable template name")
    automation_rule: Dict[str, Any] = Field(description="Template automation rule defining the timed agent")
    template_data: Dict[str, Any] = Field(default_factory=dict, description="Current template instance data")
    field_schema: Dict[str, Any] = Field(default_factory=dict, description="Template field schema")
    schedule_config: Dict[str, Any] = Field(description="Scheduling configuration")


class HookTriggerInput(BaseModel):
    """Input model for triggering hook agents."""
    hook_id: str = Field(description="Hook agent ID to trigger")
    trigger_context: Dict[str, Any] = Field(description="Context data for the hook execution")
    force_execute: bool = Field(default=False, description="Force execution even if conditions aren't met")


class HookIntegrationManager:
    """Manages hook agent integration with the MCP server."""
    
    def __init__(self, 
                 task_manager: 'TaskManager',
                 background_executor: BackgroundTaskExecutionManager,
                 project_root: 'Path'):
        self.task_manager = task_manager
        self.background_executor = background_executor
        self.project_root = project_root
        
        # Initialize hook agent manager
        self.hook_manager: Optional[TemplateHookAgentManager] = None
        self.initialized = False
        
        self.logger = logging.getLogger(__name__)
    
    async def initialize(self):
        """Initialize the hook agent manager."""
        if self.initialized:
            return
        
        try:
            # Create a mock template registry for now
            # TODO: Replace with actual TemplateRegistry when available
            template_registry = MockTemplateRegistry()
            
            self.hook_manager = TemplateHookAgentManager(
                task_manager=self.task_manager,
                background_executor=self.background_executor,
                template_registry=template_registry
            )
            
            await self.hook_manager.initialize()
            self.initialized = True
            
            self.logger.info("✅ Hook agent integration initialized")
            
        except Exception as e:
            self.logger.error(f"Failed to initialize hook agent integration: {e}")
            raise
    
    async def register_hook_agent(self, input_data: HookAgentInput) -> Dict[str, Any]:
        """Register a new hook agent from template automation rule."""
        try:
            await self.initialize()
            
            # Build template context from input
            template_context = TemplateContext(
                template_id=input_data.template_id,
                template_name=input_data.template_name,
                template_version="1.0",  # Default version
                template_data=input_data.template_data,
                field_schema=input_data.field_schema,
                automation_rules=[input_data.automation_rule],
                triggering_event=input_data.context
            )
            
            # Register hook agent
            hook_id = await self.hook_manager.register_hook_agent_from_template(
                template_id=input_data.template_id,
                automation_rule=input_data.automation_rule,
                template_context=template_context
            )
            
            return {
                "success": True,
                "hook_id": hook_id,
                "template_id": input_data.template_id,
                "template_name": input_data.template_name,
                "message": f"Hook agent registered successfully",
                "project": self.project_root.name
            }
            
        except Exception as e:
            self.logger.error(f"Failed to register hook agent: {e}")
            return {
                "success": False,
                "error": str(e),
                "template_id": input_data.template_id,
                "project": self.project_root.name
            }
    
    async def register_timed_agent(self, input_data: TimedAgentInput) -> Dict[str, Any]:
        """Register a new timed agent from template automation rule."""
        try:
            await self.initialize()
            
            # Build template context from input
            template_context = TemplateContext(
                template_id=input_data.template_id,
                template_name=input_data.template_name,
                template_version="1.0",  # Default version
                template_data=input_data.template_data,
                field_schema=input_data.field_schema,
                automation_rules=[input_data.automation_rule]
            )
            
            # Register timed agent
            agent_id = await self.hook_manager.register_timed_agent_from_template(
                template_id=input_data.template_id,
                automation_rule=input_data.automation_rule,
                template_context=template_context
            )
            
            return {
                "success": True,
                "agent_id": agent_id,
                "template_id": input_data.template_id,
                "template_name": input_data.template_name,
                "schedule_config": input_data.schedule_config,
                "message": f"Timed agent registered successfully",
                "project": self.project_root.name
            }
            
        except Exception as e:
            self.logger.error(f"Failed to register timed agent: {e}")
            return {
                "success": False,
                "error": str(e),
                "template_id": input_data.template_id,
                "project": self.project_root.name
            }
    
    async def trigger_hook_agent(self, input_data: HookTriggerInput) -> Dict[str, Any]:
        """Manually trigger a hook agent."""
        try:
            await self.initialize()
            
            result = await self.hook_manager.trigger_hook_agent(
                hook_id=input_data.hook_id,
                context=input_data.trigger_context
            )
            
            if result:
                return {
                    "success": True,
                    **result,
                    "project": self.project_root.name
                }
            else:
                return {
                    "success": False,
                    "error": f"Hook agent {input_data.hook_id} not found or conditions not met",
                    "hook_id": input_data.hook_id,
                    "project": self.project_root.name
                }
            
        except Exception as e:
            self.logger.error(f"Failed to trigger hook agent: {e}")
            return {
                "success": False,
                "error": str(e),
                "hook_id": input_data.hook_id,
                "project": self.project_root.name
            }
    
    async def get_hook_agent_status(self) -> Dict[str, Any]:
        """Get status of all hook agents."""
        try:
            await self.initialize()
            
            hook_status = self.hook_manager.get_hook_agent_status()
            timed_status = self.hook_manager.get_timed_agent_status()
            
            return {
                "success": True,
                "hook_agents": hook_status,
                "timed_agents": timed_status,
                "project": self.project_root.name
            }
            
        except Exception as e:
            self.logger.error(f"Failed to get hook agent status: {e}")
            return {
                "success": False,
                "error": str(e),
                "project": self.project_root.name
            }
    
    async def get_comprehensive_agent_status(self) -> Dict[str, Any]:
        """Get comprehensive status including performance metrics."""
        try:
            await self.initialize()
            
            comprehensive_status = self.hook_manager.get_comprehensive_status()
            
            return {
                "success": True,
                **comprehensive_status,
                "project": self.project_root.name
            }
            
        except Exception as e:
            self.logger.error(f"Failed to get comprehensive agent status: {e}")
            return {
                "success": False,
                "error": str(e),
                "project": self.project_root.name
            }
    
    async def pause_timed_agent(self, agent_id: str) -> Dict[str, Any]:
        """Pause a timed agent."""
        try:
            await self.initialize()
            
            if agent_id in self.hook_manager.timed_agents:
                self.hook_manager.timed_agents[agent_id].is_active = False
                
                return {
                    "success": True,
                    "agent_id": agent_id,
                    "status": "paused",
                    "message": f"Timed agent {agent_id} paused",
                    "project": self.project_root.name
                }
            else:
                return {
                    "success": False,
                    "error": f"Timed agent {agent_id} not found",
                    "agent_id": agent_id,
                    "project": self.project_root.name
                }
            
        except Exception as e:
            self.logger.error(f"Failed to pause timed agent: {e}")
            return {
                "success": False,
                "error": str(e),
                "agent_id": agent_id,
                "project": self.project_root.name
            }
    
    async def resume_timed_agent(self, agent_id: str) -> Dict[str, Any]:
        """Resume a paused timed agent."""
        try:
            await self.initialize()
            
            if agent_id in self.hook_manager.timed_agents:
                self.hook_manager.timed_agents[agent_id].is_active = True
                
                return {
                    "success": True,
                    "agent_id": agent_id,
                    "status": "active",
                    "message": f"Timed agent {agent_id} resumed",
                    "project": self.project_root.name
                }
            else:
                return {
                    "success": False,
                    "error": f"Timed agent {agent_id} not found",
                    "agent_id": agent_id,
                    "project": self.project_root.name
                }
            
        except Exception as e:
            self.logger.error(f"Failed to resume timed agent: {e}")
            return {
                "success": False,
                "error": str(e),
                "agent_id": agent_id,
                "project": self.project_root.name
            }


class MockTemplateRegistry:
    """Mock template registry for initial implementation."""
    
    def __init__(self):
        self.templates = {}
    
    async def get_template(self, template_id: str):
        """Get template by ID."""
        return self.templates.get(template_id)
    
    async def get_all_templates(self):
        """Get all templates."""
        return list(self.templates.values())