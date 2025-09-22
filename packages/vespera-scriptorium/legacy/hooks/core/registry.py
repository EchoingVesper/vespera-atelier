"""
Hook Registry - Hook Management

Manages hook definitions, persistence, and matching logic for the hook system.
"""

import logging
from typing import List, Dict, Any, Optional, Set
from pathlib import Path
import yaml
import json

from .models import (
    HookDefinition, HookTriggerType, HookPriority, HookActionType,
    HookTriggerConfig, HookActionConfig, FILE_TYPE_HOOKS
)

logger = logging.getLogger(__name__)


class HookRegistry:
    """
    Registry for managing hook definitions and matching triggers to hooks.
    
    Responsibilities:
    - Store and retrieve hook definitions
    - Match triggers to applicable hooks
    - Load/save hook configurations from files
    - Provide hook validation and management
    """
    
    def __init__(self, config_path: Optional[Path] = None):
        self.hooks: Dict[str, HookDefinition] = {}
        self.config_path = config_path or Path("hooks/config")
        self.config_path.mkdir(parents=True, exist_ok=True)
        
        # Trigger type to hook ID mapping for fast lookups
        self._trigger_index: Dict[HookTriggerType, Set[str]] = {
            trigger_type: set() for trigger_type in HookTriggerType
        }
        
        self._load_default_hooks()
    
    def register_hook(self, hook: HookDefinition):
        """Register a new hook definition"""
        self.hooks[hook.id] = hook
        self._trigger_index[hook.trigger.trigger_type].add(hook.id)
        logger.info(f"Registered hook: {hook.name}")
    
    def unregister_hook(self, hook_id: str):
        """Unregister a hook definition"""
        hook = self.hooks.get(hook_id)
        if hook:
            del self.hooks[hook_id]
            self._trigger_index[hook.trigger.trigger_type].discard(hook_id)
            logger.info(f"Unregistered hook: {hook.name}")
        else:
            logger.warning(f"Hook not found for unregistration: {hook_id}")
    
    def get_hook(self, hook_id: str) -> Optional[HookDefinition]:
        """Get a hook definition by ID"""
        return self.hooks.get(hook_id)
    
    def list_hooks(self, enabled_only: bool = False) -> List[HookDefinition]:
        """List all registered hooks"""
        hooks = list(self.hooks.values())
        if enabled_only:
            hooks = [hook for hook in hooks if hook.enabled]
        return hooks
    
    def find_hooks_for_trigger(self, trigger_type: HookTriggerType, 
                             trigger_data: Dict[str, Any]) -> List[HookDefinition]:
        """Find all hooks that should trigger for the given trigger type and data"""
        candidate_hook_ids = self._trigger_index[trigger_type]
        matching_hooks = []
        
        for hook_id in candidate_hook_ids:
            hook = self.hooks[hook_id]
            if hook.enabled and self._matches_trigger_conditions(hook, trigger_type, trigger_data):
                matching_hooks.append(hook)
        
        # Sort by priority (higher priority first)
        matching_hooks.sort(key=lambda h: h.priority.value, reverse=True)
        return matching_hooks
    
    def _matches_trigger_conditions(self, hook: HookDefinition, trigger_type: HookTriggerType, 
                                  trigger_data: Dict[str, Any]) -> bool:
        """Check if hook conditions match the trigger data"""
        conditions = hook.trigger.conditions
        
        if trigger_type == HookTriggerType.FILE_CHANGE:
            return self._matches_file_conditions(conditions, trigger_data)
        elif trigger_type == HookTriggerType.TASK_STATUS:
            return self._matches_task_conditions(conditions, trigger_data)
        elif trigger_type == HookTriggerType.GIT_OPERATION:
            return self._matches_git_conditions(conditions, trigger_data)
        else:
            # Default: match if no specific conditions
            return not conditions or all(
                trigger_data.get(key) == value 
                for key, value in conditions.items()
            )
    
    def _matches_file_conditions(self, conditions: Dict[str, Any], trigger_data: Dict[str, Any]) -> bool:
        """Check if file change conditions match"""
        file_path = trigger_data.get("file_path", "")
        operation = trigger_data.get("operation", "")
        
        # Check file extensions
        if "extensions" in conditions:
            extensions = conditions["extensions"]
            if not any(file_path.endswith(ext) for ext in extensions):
                return False
        
        # Check file patterns
        if "patterns" in conditions:
            patterns = conditions["patterns"]
            if not any(pattern in file_path for pattern in patterns):
                return False
        
        # Check operation types
        if "operations" in conditions:
            operations = conditions["operations"]
            if operation not in operations:
                return False
        
        return True
    
    def _matches_task_conditions(self, conditions: Dict[str, Any], trigger_data: Dict[str, Any]) -> bool:
        """Check if task status conditions match"""
        task_status = trigger_data.get("status", "")
        task_type = trigger_data.get("task_type", "")
        
        # Check status
        if "statuses" in conditions:
            statuses = conditions["statuses"]
            if task_status not in statuses:
                return False
        
        # Check task type
        if "task_types" in conditions:
            task_types = conditions["task_types"]
            if task_type not in task_types:
                return False
        
        return True
    
    def _matches_git_conditions(self, conditions: Dict[str, Any], trigger_data: Dict[str, Any]) -> bool:
        """Check if git operation conditions match"""
        operation = trigger_data.get("operation", "")
        branch = trigger_data.get("branch", "")
        
        # Check operations
        if "operations" in conditions:
            operations = conditions["operations"]
            if operation not in operations:
                return False
        
        # Check branch patterns
        if "branch_patterns" in conditions:
            patterns = conditions["branch_patterns"]
            if not any(pattern in branch for pattern in patterns):
                return False
        
        return True
    
    def load_hooks_from_file(self, file_path: Path):
        """Load hook definitions from a YAML or JSON file"""
        try:
            with open(file_path, 'r') as f:
                if file_path.suffix.lower() in ['.yaml', '.yml']:
                    data = yaml.safe_load(f)
                else:
                    data = json.load(f)
            
            hooks_data = data.get('hooks', [])
            loaded_count = 0
            
            for hook_data in hooks_data:
                try:
                    hook = self._parse_hook_definition(hook_data)
                    self.register_hook(hook)
                    loaded_count += 1
                except Exception as e:
                    logger.error(f"Failed to parse hook from {file_path}: {e}")
            
            logger.info(f"Loaded {loaded_count} hooks from {file_path}")
            
        except Exception as e:
            logger.error(f"Failed to load hooks from {file_path}: {e}")
    
    def save_hooks_to_file(self, file_path: Path):
        """Save current hook definitions to a file"""
        try:
            hooks_data = []
            for hook in self.hooks.values():
                hooks_data.append(self._serialize_hook_definition(hook))
            
            data = {"hooks": hooks_data}
            
            with open(file_path, 'w') as f:
                if file_path.suffix.lower() in ['.yaml', '.yml']:
                    yaml.dump(data, f, default_flow_style=False)
                else:
                    json.dump(data, f, indent=2, default=str)
            
            logger.info(f"Saved {len(hooks_data)} hooks to {file_path}")
            
        except Exception as e:
            logger.error(f"Failed to save hooks to {file_path}: {e}")
    
    def _parse_hook_definition(self, hook_data: Dict[str, Any]) -> HookDefinition:
        """Parse hook definition from dictionary data"""
        trigger_data = hook_data["trigger"]
        actions_data = hook_data["actions"]
        
        trigger = HookTriggerConfig(
            trigger_type=HookTriggerType(trigger_data["trigger_type"]),
            conditions=trigger_data.get("conditions", {}),
            debounce_seconds=trigger_data.get("debounce_seconds", 0.5),
            enabled=trigger_data.get("enabled", True)
        )
        
        actions = []
        for action_data in actions_data:
            action = HookActionConfig(
                action_type=HookActionType(action_data["action_type"]),
                implementation=action_data["implementation"],
                parameters=action_data.get("parameters", {}),
                timeout_seconds=action_data.get("timeout_seconds", 300),
                retry_count=action_data.get("retry_count", 3),
                require_approval=action_data.get("require_approval", False)
            )
            actions.append(action)
        
        return HookDefinition(
            id=hook_data["id"],
            name=hook_data["name"],
            description=hook_data["description"],
            priority=HookPriority(hook_data.get("priority", 5)),
            trigger=trigger,
            actions=actions,
            enabled=hook_data.get("enabled", True),
            tags=hook_data.get("tags", [])
        )
    
    def _serialize_hook_definition(self, hook: HookDefinition) -> Dict[str, Any]:
        """Serialize hook definition to dictionary"""
        return {
            "id": hook.id,
            "name": hook.name,
            "description": hook.description,
            "priority": hook.priority.value,
            "trigger": {
                "trigger_type": hook.trigger.trigger_type.value,
                "conditions": hook.trigger.conditions,
                "debounce_seconds": hook.trigger.debounce_seconds,
                "enabled": hook.trigger.enabled
            },
            "actions": [
                {
                    "action_type": action.action_type.value,
                    "implementation": action.implementation,
                    "parameters": action.parameters,
                    "timeout_seconds": action.timeout_seconds,
                    "retry_count": action.retry_count,
                    "require_approval": action.require_approval
                }
                for action in hook.actions
            ],
            "enabled": hook.enabled,
            "tags": hook.tags
        }
    
    def _load_default_hooks(self):
        """Load default hooks based on VESPERA_VISION_PLANNING_WORKSHEET.md priorities"""
        
        # Priority 10: File type-based context loading (CRITICAL)
        for ext, file_hook in FILE_TYPE_HOOKS.items():
            hook_id = f"file_context_{ext.replace('.', '_')}"
            hook = HookDefinition(
                id=hook_id,
                name=f"Auto-context for {ext} files",
                description=f"Automatically load context documents for {ext} files",
                priority=HookPriority.CRITICAL,
                trigger=HookTriggerConfig(
                    trigger_type=HookTriggerType.FILE_CHANGE,
                    conditions={
                        "extensions": file_hook.file_extensions,
                        "operations": ["created", "modified"]
                    }
                ),
                actions=[
                    HookActionConfig(
                        action_type=HookActionType.PROGRAMMATIC,
                        implementation="hooks.actions.file_context.load_context_documents",
                        parameters={
                            "context_documents": file_hook.context_documents,
                            "suggested_roles": file_hook.roles
                        }
                    )
                ],
                tags=["file_context", "automatic", "critical"]
            )
            self.register_hook(hook)
        
        # Priority 9: Git branch creation hook
        git_branch_hook = HookDefinition(
            id="git_auto_branch",
            name="Automatic Git Branch Creation",
            description="Create git branches for new implementation tasks",
            priority=HookPriority.HIGH,
            trigger=HookTriggerConfig(
                trigger_type=HookTriggerType.TASK_STATUS,
                conditions={
                    "statuses": ["started"],
                    "task_types": ["implementation", "feature", "bugfix"]
                }
            ),
            actions=[
                HookActionConfig(
                    action_type=HookActionType.PROGRAMMATIC,
                    implementation="hooks.actions.git_operations.create_branch",
                    parameters={"branch_prefix": "task/"}
                )
            ],
            tags=["git", "automation", "high_priority"]
        )
        self.register_hook(git_branch_hook)
        
        # Priority 8: Test execution after code changes
        test_execution_hook = HookDefinition(
            id="auto_test_execution",
            name="Automatic Test Execution",
            description="Run tests automatically after code changes",
            priority=HookPriority.NORMAL,
            trigger=HookTriggerConfig(
                trigger_type=HookTriggerType.FILE_CHANGE,
                conditions={
                    "extensions": [".py", ".js", ".ts"],
                    "operations": ["modified"]
                }
            ),
            actions=[
                HookActionConfig(
                    action_type=HookActionType.PROGRAMMATIC,
                    implementation="hooks.actions.testing.run_relevant_tests",
                    parameters={"test_scope": "related"}
                )
            ],
            tags=["testing", "automation", "normal_priority"]
        )
        self.register_hook(test_execution_hook)
        
        logger.info(f"Loaded {len(self.hooks)} default hooks")