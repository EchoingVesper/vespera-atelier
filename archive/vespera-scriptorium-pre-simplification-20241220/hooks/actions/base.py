"""
Base Hook Action

Abstract base class for all hook action implementations.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any
import logging

from ..core.models import HookActionConfig, HookContext

logger = logging.getLogger(__name__)


class HookAction(ABC):
    """
    Abstract base class for hook actions.
    
    Actions are responsible for executing the work when hooks are triggered.
    They can be programmatic (pure code), LLM-based (spawn agents), or 
    task-spawning (create new tasks in the system).
    """
    
    @abstractmethod
    async def execute(self, config: HookActionConfig, context: HookContext) -> Dict[str, Any]:
        """
        Execute the hook action.
        
        Args:
            config: Action configuration containing implementation details
            context: Context information from the trigger
            
        Returns:
            Dictionary containing execution results
        """
        pass
    
    @abstractmethod
    def validate_config(self, config: HookActionConfig) -> tuple[bool, list[str]]:
        """
        Validate the action configuration.
        
        Args:
            config: Action configuration to validate
            
        Returns:
            Tuple of (is_valid, error_messages)
        """
        pass
    
    def get_action_type(self) -> str:
        """Get the action type identifier"""
        return self.__class__.__name__.replace("Action", "").lower()
    
    async def pre_execute(self, config: HookActionConfig, context: HookContext) -> bool:
        """
        Pre-execution hook for common setup/validation.
        
        Returns:
            True if execution should continue, False to skip
        """
        # Check if approval is required
        if config.require_approval:
            # TODO: Implement approval mechanism
            logger.warning(f"Action requires approval but approval system not implemented")
            return False
        
        return True
    
    async def post_execute(self, config: HookActionConfig, context: HookContext, result: Dict[str, Any]):
        """
        Post-execution hook for cleanup/logging.
        """
        if result.get("success", False):
            logger.info(f"Action executed successfully: {config.implementation}")
        else:
            logger.error(f"Action failed: {config.implementation} - {result.get('error', 'Unknown error')}")
    
    def _extract_parameters(self, config: HookActionConfig) -> Dict[str, Any]:
        """Extract and validate parameters from config"""
        return config.parameters or {}