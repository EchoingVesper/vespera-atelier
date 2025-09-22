"""
Git Operation Trigger

Monitors git operations and triggers hooks accordingly.
"""

import logging
from typing import Dict, Any, Callable, Optional
from datetime import datetime

from .base import HookTrigger
from ..core.models import HookTriggerType, HookContext

logger = logging.getLogger(__name__)


class GitTrigger(HookTrigger):
    """
    Monitors git operations and triggers hooks.
    
    This is a simplified implementation that can be manually triggered
    or integrated with git hooks in the future.
    """
    
    def __init__(self):
        super().__init__(HookTriggerType.GIT_OPERATION)
    
    async def start(self, callback: Callable[[HookTriggerType, Dict[str, Any], Optional[HookContext]], None]):
        """Start monitoring git operations"""
        if self.is_active:
            logger.warning("Git trigger is already active")
            return
            
        self.callback = callback
        self.is_active = True
        logger.info("Git trigger started")
    
    async def stop(self):
        """Stop monitoring git operations"""
        if not self.is_active:
            return
            
        self.is_active = False
        logger.info("Git trigger stopped")
    
    async def trigger_git_operation(self, operation: str, branch: str = "", commit_hash: str = "", 
                                   additional_data: Optional[Dict[str, Any]] = None):
        """Manually trigger a git operation event"""
        if not self.is_active:
            return
        
        trigger_data = {
            "operation": operation,
            "branch": branch,
            "commit_hash": commit_hash,
            "timestamp": datetime.now().isoformat()
        }
        
        if additional_data:
            trigger_data.update(additional_data)
        
        context = HookContext(
            trigger_type=self.trigger_type,
            trigger_data=trigger_data,
            timestamp=datetime.now()
        )
        
        await self.fire_trigger(trigger_data, context)