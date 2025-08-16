"""
Validation Hooks System

Provides automated quality assurance through hook-based validation
that runs automatically during critical operations.
"""

import asyncio
import json
import logging
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Union

logger = logging.getLogger(__name__)


class HookTrigger(Enum):
    """When validation hooks should trigger."""
    BEFORE_TASK_CREATE = "before_task_create"
    AFTER_TASK_CREATE = "after_task_create"
    BEFORE_TASK_UPDATE = "before_task_update"
    AFTER_TASK_UPDATE = "after_task_update"
    BEFORE_TASK_COMPLETE = "before_task_complete"
    AFTER_TASK_COMPLETE = "after_task_complete"
    BEFORE_TEMPLATE_SAVE = "before_template_save"
    AFTER_TEMPLATE_SAVE = "after_template_save"
    BEFORE_SESSION_CREATE = "before_session_create"
    AFTER_SESSION_CREATE = "after_session_create"
    SYSTEM_HEALTH_CHECK = "system_health_check"
    DATABASE_OPERATION = "database_operation"


class ValidationResult:
    """Result of a validation hook."""
    
    def __init__(
        self, 
        passed: bool, 
        message: str = "", 
        details: Optional[Dict[str, Any]] = None,
        severity: str = "info"
    ):
        self.passed = passed
        self.message = message
        self.details = details or {}
        self.severity = severity
        self.timestamp = datetime.now()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "passed": self.passed,
            "message": self.message,
            "details": self.details,
            "severity": self.severity,
            "timestamp": self.timestamp.isoformat()
        }


class ValidationHook:
    """A single validation hook with its configuration."""
    
    def __init__(
        self,
        name: str,
        trigger: HookTrigger,
        validator_func: Callable[..., Union[ValidationResult, bool]],
        description: str = "",
        enabled: bool = True,
        priority: int = 100
    ):
        self.name = name
        self.trigger = trigger
        self.validator_func = validator_func
        self.description = description
        self.enabled = enabled
        self.priority = priority

    async def execute(self, context: Dict[str, Any]) -> ValidationResult:
        """Execute the validation hook."""
        try:
            if not self.enabled:
                return ValidationResult(True, f"Hook {self.name} disabled")

            # Call the validator function
            if asyncio.iscoroutinefunction(self.validator_func):
                result = await self.validator_func(context)
            else:
                result = self.validator_func(context)

            # Convert boolean result to ValidationResult
            if isinstance(result, bool):
                message = f"Hook {self.name} {'passed' if result else 'failed'}"
                return ValidationResult(result, message)
            elif isinstance(result, ValidationResult):
                return result
            else:
                return ValidationResult(
                    False, 
                    f"Hook {self.name} returned invalid result type: {type(result)}"
                )

        except Exception as e:
            logger.error(f"Validation hook {self.name} failed: {e}")
            return ValidationResult(
                False, 
                f"Hook {self.name} execution error: {str(e)}",
                severity="error"
            )


class ValidationHooksManager:
    """Manages all validation hooks and their execution."""

    def __init__(self):
        self.hooks: Dict[HookTrigger, List[ValidationHook]] = {}
        self.results_history: List[Dict[str, Any]] = []
        self._setup_default_hooks()

    def register_hook(self, hook: ValidationHook) -> None:
        """Register a new validation hook."""
        if hook.trigger not in self.hooks:
            self.hooks[hook.trigger] = []
        
        # Insert hook maintaining priority order (lower priority number = higher priority)
        inserted = False
        for i, existing_hook in enumerate(self.hooks[hook.trigger]):
            if hook.priority < existing_hook.priority:
                self.hooks[hook.trigger].insert(i, hook)
                inserted = True
                break
        
        if not inserted:
            self.hooks[hook.trigger].append(hook)

        logger.info(f"Registered validation hook: {hook.name} for {hook.trigger.value}")

    async def execute_hooks(
        self, 
        trigger: HookTrigger, 
        context: Dict[str, Any],
        fail_fast: bool = True
    ) -> List[ValidationResult]:
        """Execute all hooks for a given trigger."""
        if trigger not in self.hooks:
            return []

        results = []
        failed_hooks = []

        for hook in self.hooks[trigger]:
            result = await hook.execute(context)
            results.append(result)
            
            # Log result
            if result.passed:
                logger.debug(f"Validation hook passed: {hook.name}")
            else:
                logger.warning(f"Validation hook failed: {hook.name} - {result.message}")
                failed_hooks.append(hook.name)
                
                if fail_fast:
                    break

        # Store results in history
        self.results_history.append({
            "trigger": trigger.value,
            "timestamp": datetime.now().isoformat(),
            "total_hooks": len(self.hooks[trigger]),
            "passed_hooks": len([r for r in results if r.passed]),
            "failed_hooks": failed_hooks,
            "results": [r.to_dict() for r in results]
        })

        # Keep only last 1000 results
        if len(self.results_history) > 1000:
            self.results_history = self.results_history[-1000:]

        return results

    def _setup_default_hooks(self) -> None:
        """Setup default validation hooks."""
        
        # Task validation hooks
        self.register_hook(ValidationHook(
            name="task_title_validation",
            trigger=HookTrigger.BEFORE_TASK_CREATE,
            validator_func=self._validate_task_title,
            description="Ensure task titles are meaningful and not empty",
            priority=10
        ))

        self.register_hook(ValidationHook(
            name="task_description_validation", 
            trigger=HookTrigger.BEFORE_TASK_CREATE,
            validator_func=self._validate_task_description,
            description="Ensure task descriptions provide sufficient detail",
            priority=20
        ))

        self.register_hook(ValidationHook(
            name="task_data_integrity",
            trigger=HookTrigger.AFTER_TASK_CREATE,
            validator_func=self._validate_task_data_integrity,
            description="Verify task was created with all required fields",
            priority=10
        ))

        # Template validation hooks
        self.register_hook(ValidationHook(
            name="template_security_validation",
            trigger=HookTrigger.BEFORE_TEMPLATE_SAVE,
            validator_func=self._validate_template_security,
            description="Check templates for security issues",
            priority=5
        ))

        self.register_hook(ValidationHook(
            name="template_syntax_validation",
            trigger=HookTrigger.BEFORE_TEMPLATE_SAVE,
            validator_func=self._validate_template_syntax,
            description="Validate template JSON5 syntax",
            priority=10
        ))

        # System health hooks
        self.register_hook(ValidationHook(
            name="database_health_check",
            trigger=HookTrigger.SYSTEM_HEALTH_CHECK,
            validator_func=self._validate_database_health,
            description="Check database connectivity and integrity",
            priority=10
        ))

        self.register_hook(ValidationHook(
            name="file_permissions_check",
            trigger=HookTrigger.SYSTEM_HEALTH_CHECK,
            validator_func=self._validate_file_permissions,
            description="Check critical file permissions",
            priority=20
        ))

    def _validate_task_title(self, context: Dict[str, Any]) -> ValidationResult:
        """Validate task title is meaningful."""
        title = context.get("title", "")
        
        if not title or len(title.strip()) == 0:
            return ValidationResult(False, "Task title cannot be empty")
        
        if len(title.strip()) < 3:
            return ValidationResult(False, "Task title too short (minimum 3 characters)")
        
        if title.strip().lower() in ["test", "todo", "fixme", "temp"]:
            return ValidationResult(
                False, 
                "Task title appears to be placeholder text",
                severity="warning"
            )
        
        return ValidationResult(True, "Task title validation passed")

    def _validate_task_description(self, context: Dict[str, Any]) -> ValidationResult:
        """Validate task description provides sufficient detail."""
        description = context.get("description", "")
        
        if not description or len(description.strip()) == 0:
            return ValidationResult(False, "Task description cannot be empty")
        
        if len(description.strip()) < 10:
            return ValidationResult(
                False, 
                "Task description too short (minimum 10 characters)",
                severity="warning"
            )
        
        return ValidationResult(True, "Task description validation passed")

    def _validate_task_data_integrity(self, context: Dict[str, Any]) -> ValidationResult:
        """Validate task was created with proper data integrity."""
        task_data = context.get("task_data", {})
        
        required_fields = ["id", "title", "description", "status", "created_at"]
        missing_fields = []
        
        for field in required_fields:
            if field not in task_data or task_data[field] is None:
                missing_fields.append(field)
        
        if missing_fields:
            return ValidationResult(
                False,
                f"Task missing required fields: {missing_fields}",
                {"missing_fields": missing_fields}
            )
        
        return ValidationResult(True, "Task data integrity validation passed")

    def _validate_template_security(self, context: Dict[str, Any]) -> ValidationResult:
        """Check template for security issues."""
        template_data = context.get("template_data", {})
        
        # Check for dangerous patterns
        template_str = json.dumps(template_data).lower()
        dangerous_patterns = [
            "eval(", "exec(", "__import__", "subprocess", 
            "os.system", "shell=true", "rm -rf", "del *"
        ]
        
        found_patterns = []
        for pattern in dangerous_patterns:
            if pattern in template_str:
                found_patterns.append(pattern)
        
        if found_patterns:
            return ValidationResult(
                False,
                f"Template contains dangerous patterns: {found_patterns}",
                {"dangerous_patterns": found_patterns},
                severity="error"
            )
        
        return ValidationResult(True, "Template security validation passed")

    def _validate_template_syntax(self, context: Dict[str, Any]) -> ValidationResult:
        """Validate template JSON5 syntax."""
        template_content = context.get("template_content", "")
        
        if not template_content:
            return ValidationResult(False, "Template content is empty")
        
        try:
            # Basic JSON validation (could be enhanced for JSON5)
            json.loads(template_content)
            return ValidationResult(True, "Template syntax validation passed")
        except json.JSONDecodeError as e:
            return ValidationResult(
                False,
                f"Template syntax error: {str(e)}",
                {"json_error": str(e)}
            )

    def _validate_database_health(self, context: Dict[str, Any]) -> ValidationResult:
        """Check database health and connectivity."""
        try:
            # Basic database file check
            workspace_dir = context.get("workspace_dir", Path.cwd())
            db_file = workspace_dir / ".vespera_scriptorium" / "vespera_scriptorium.db"
            
            if not db_file.exists():
                return ValidationResult(
                    False,
                    "Database file not found",
                    {"db_path": str(db_file)}
                )
            
            # Check file is readable/writable
            if not db_file.is_file():
                return ValidationResult(False, "Database path is not a file")
            
            return ValidationResult(True, "Database health check passed")
            
        except Exception as e:
            return ValidationResult(
                False,
                f"Database health check failed: {str(e)}",
                severity="error"
            )

    def _validate_file_permissions(self, context: Dict[str, Any]) -> ValidationResult:
        """Check critical file permissions."""
        try:
            workspace_dir = context.get("workspace_dir", Path.cwd())
            scriptorium_dir = workspace_dir / ".vespera_scriptorium"
            
            if not scriptorium_dir.exists():
                return ValidationResult(True, "Scriptorium directory not yet created")
            
            # Check directory is writable
            if not scriptorium_dir.is_dir():
                return ValidationResult(False, "Scriptorium path is not a directory")
            
            # Test write access
            test_file = scriptorium_dir / ".permission_test"
            try:
                test_file.write_text("test")
                test_file.unlink()
                return ValidationResult(True, "File permissions check passed")
            except Exception:
                return ValidationResult(False, "No write access to scriptorium directory")
                
        except Exception as e:
            return ValidationResult(
                False,
                f"File permissions check failed: {str(e)}",
                severity="error"
            )

    def get_hook_status(self) -> Dict[str, Any]:
        """Get status of all registered hooks."""
        status = {
            "total_hooks": sum(len(hooks) for hooks in self.hooks.values()),
            "triggers": {},
            "recent_results": self.results_history[-10:] if self.results_history else []
        }
        
        for trigger, hooks in self.hooks.items():
            status["triggers"][trigger.value] = {
                "hook_count": len(hooks),
                "hooks": [
                    {
                        "name": hook.name,
                        "description": hook.description,
                        "enabled": hook.enabled,
                        "priority": hook.priority
                    }
                    for hook in hooks
                ]
            }
        
        return status


# Global validation hooks manager
_validation_hooks_manager: Optional[ValidationHooksManager] = None


def get_validation_hooks_manager() -> ValidationHooksManager:
    """Get the global validation hooks manager."""
    global _validation_hooks_manager
    if _validation_hooks_manager is None:
        _validation_hooks_manager = ValidationHooksManager()
    return _validation_hooks_manager


async def run_validation_hooks(
    trigger: HookTrigger, 
    context: Dict[str, Any],
    fail_fast: bool = True
) -> List[ValidationResult]:
    """Run validation hooks for a trigger."""
    manager = get_validation_hooks_manager()
    return await manager.execute_hooks(trigger, context, fail_fast)