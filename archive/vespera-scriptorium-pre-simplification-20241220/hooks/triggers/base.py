"""
Base Hook Trigger

Abstract base class for all hook trigger implementations.
"""

import asyncio
from abc import ABC, abstractmethod
from typing import Dict, Any, Callable, Optional
import logging

from ..core.models import HookTriggerType, HookContext

logger = logging.getLogger(__name__)


class HookTrigger(ABC):
    """
    Abstract base class for hook triggers.
    
    Triggers are responsible for detecting events and notifying
    the hook engine when hooks should be executed.
    """
    
    def __init__(self, trigger_type: HookTriggerType):
        self.trigger_type = trigger_type
        self.is_active = False
        self.callback: Optional[Callable] = None
        
    @abstractmethod
    async def start(self, callback: Callable[[HookTriggerType, Dict[str, Any], Optional[HookContext]], None]):
        """
        Start the trigger and begin monitoring for events.
        
        Args:
            callback: Function to call when trigger fires
        """
        pass
    
    @abstractmethod
    async def stop(self):
        """Stop the trigger and cleanup resources"""
        pass
    
    async def fire_trigger(self, trigger_data: Dict[str, Any], context: Optional[HookContext] = None):
        """Fire the trigger with the given data"""
        if self.callback and self.is_active:
            try:
                result = self.callback(self.trigger_type, trigger_data, context)
                # Handle both sync and async callbacks
                if asyncio.iscoroutine(result):
                    await result
            except Exception as e:
                logger.error(f"Error in trigger callback: {e}")
        else:
            logger.warning(f"Trigger {self.trigger_type} fired but no callback registered")
    
    def is_monitoring(self) -> bool:
        """Check if trigger is currently monitoring"""
        return self.is_active