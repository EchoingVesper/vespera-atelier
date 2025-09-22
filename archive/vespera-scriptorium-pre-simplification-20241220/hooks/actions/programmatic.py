"""
Programmatic Hook Actions

Executes pure code-based actions like git operations, tests, file operations.
"""

import asyncio
import subprocess
import importlib
import logging
from typing import Dict, Any, Callable
from pathlib import Path

from .base import HookAction
from ..core.models import HookActionConfig, HookContext

logger = logging.getLogger(__name__)


class ProgrammaticAction(HookAction):
    """
    Executes programmatic (code-based) actions.
    
    Can execute:
    - Python functions by module path
    - Shell commands
    - Built-in operations (git, testing, file operations)
    """
    
    def __init__(self):
        # Registry of built-in programmatic actions
        self.builtin_actions = {
            # Git operations (Priority 9)
            "hooks.actions.git_operations.create_branch": self._git_create_branch,
            "hooks.actions.git_operations.commit_changes": self._git_commit_changes,
            "hooks.actions.git_operations.create_pr": self._git_create_pr,
            
            # Testing operations (Priority 8)
            "hooks.actions.testing.run_relevant_tests": self._run_relevant_tests,
            "hooks.actions.testing.run_all_tests": self._run_all_tests,
            
            # File operations (Priority 10)
            "hooks.actions.file_context.load_context_documents": self._load_context_documents,
            "hooks.actions.file_operations.backup_file": self._backup_file,
            
            # Documentation operations (Priority 7)
            "hooks.actions.docs.update_documentation": self._update_documentation,
            
            # CI/CD operations (Priority 5)
            "hooks.actions.cicd.check_status": self._check_cicd_status,
        }
    
    async def execute(self, config: HookActionConfig, context: HookContext) -> Dict[str, Any]:
        """Execute a programmatic action"""
        if not await self.pre_execute(config, context):
            return {"success": False, "error": "Pre-execution failed"}
        
        try:
            implementation = config.implementation
            parameters = self._extract_parameters(config)
            
            # Check if it's a built-in action
            if implementation in self.builtin_actions:
                result = await self.builtin_actions[implementation](parameters, context)
            elif implementation.startswith("shell:"):
                # Shell command execution
                command = implementation[6:]  # Remove 'shell:' prefix
                result = await self._execute_shell_command(command, parameters, context)
            else:
                # Try to import and execute Python function
                result = await self._execute_python_function(implementation, parameters, context)
            
            await self.post_execute(config, context, result)
            return result
            
        except Exception as e:
            error_result = {"success": False, "error": str(e)}
            await self.post_execute(config, context, error_result)
            return error_result
    
    def validate_config(self, config: HookActionConfig) -> tuple[bool, list[str]]:
        """Validate programmatic action configuration"""
        errors = []
        
        if not config.implementation:
            errors.append("Implementation is required for programmatic actions")
        
        # Validate built-in actions
        if config.implementation in self.builtin_actions:
            # Additional validation for built-in actions could go here
            pass
        elif config.implementation.startswith("shell:"):
            command = config.implementation[6:]
            if not command.strip():
                errors.append("Shell command cannot be empty")
        else:
            # Try to validate Python function path
            try:
                module_path, function_name = config.implementation.rsplit('.', 1)
            except ValueError:
                errors.append(f"Invalid Python function path: {config.implementation}")
        
        return len(errors) == 0, errors
    
    async def _execute_python_function(self, function_path: str, parameters: Dict[str, Any], 
                                     context: HookContext) -> Dict[str, Any]:
        """Execute a Python function by import path"""
        try:
            module_path, function_name = function_path.rsplit('.', 1)
            module = importlib.import_module(module_path)
            function = getattr(module, function_name)
            
            # Execute function (handle both sync and async)
            if asyncio.iscoroutinefunction(function):
                result = await function(parameters, context)
            else:
                result = function(parameters, context)
            
            return {"success": True, "result": result}
            
        except ImportError as e:
            return {"success": False, "error": f"Failed to import {function_path}: {e}"}
        except AttributeError as e:
            return {"success": False, "error": f"Function not found {function_path}: {e}"}
        except Exception as e:
            return {"success": False, "error": f"Function execution failed: {e}"}
    
    async def _execute_shell_command(self, command: str, parameters: Dict[str, Any], 
                                   context: HookContext) -> Dict[str, Any]:
        """Execute a shell command"""
        try:
            # Substitute parameters in command
            formatted_command = command.format(**parameters)
            
            # Execute command
            process = await asyncio.create_subprocess_shell(
                formatted_command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            result = {
                "success": process.returncode == 0,
                "return_code": process.returncode,
                "stdout": stdout.decode().strip() if stdout else "",
                "stderr": stderr.decode().strip() if stderr else "",
                "command": formatted_command
            }
            
            if process.returncode != 0:
                result["error"] = f"Command failed with code {process.returncode}: {result['stderr']}"
            
            return result
            
        except Exception as e:
            return {"success": False, "error": f"Shell command execution failed: {e}"}
    
    # Built-in action implementations
    
    async def _git_create_branch(self, parameters: Dict[str, Any], context: HookContext) -> Dict[str, Any]:
        """Create a git branch for a task"""
        try:
            task_id = context.task_id or "unknown"
            branch_prefix = parameters.get("branch_prefix", "task/")
            branch_name = f"{branch_prefix}{task_id}"
            
            # Check if branch already exists
            check_cmd = f"git rev-parse --verify {branch_name}"
            process = await asyncio.create_subprocess_shell(
                check_cmd, stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL
            )
            await process.communicate()
            
            if process.returncode == 0:
                return {"success": True, "message": f"Branch {branch_name} already exists", "branch_name": branch_name}
            
            # Create branch
            create_cmd = f"git checkout -b {branch_name}"
            result = await self._execute_shell_command(create_cmd, {}, context)
            
            if result["success"]:
                result["branch_name"] = branch_name
                result["message"] = f"Created branch: {branch_name}"
            
            return result
            
        except Exception as e:
            return {"success": False, "error": f"Git branch creation failed: {e}"}
    
    async def _git_commit_changes(self, parameters: Dict[str, Any], context: HookContext) -> Dict[str, Any]:
        """Commit changes with automatic message"""
        try:
            message = parameters.get("message", f"Automated commit from hook")
            add_all = parameters.get("add_all", True)
            
            commands = []
            if add_all:
                commands.append("git add .")
            
            commands.append(f"git commit -m '{message}'")
            
            results = []
            for cmd in commands:
                result = await self._execute_shell_command(cmd, {}, context)
                results.append(result)
                if not result["success"]:
                    break
            
            return {
                "success": all(r["success"] for r in results),
                "results": results,
                "message": message
            }
            
        except Exception as e:
            return {"success": False, "error": f"Git commit failed: {e}"}
    
    async def _run_relevant_tests(self, parameters: Dict[str, Any], context: HookContext) -> Dict[str, Any]:
        """Run tests relevant to changed files"""
        try:
            test_scope = parameters.get("test_scope", "related")
            file_path = context.file_path
            
            if not file_path:
                return {"success": False, "error": "No file path in context"}
            
            # Simple heuristic: run tests in same directory or with similar name
            file_path_obj = Path(file_path)
            
            if file_path_obj.suffix == ".py":
                # For Python files, look for corresponding test files
                test_patterns = [
                    f"test_{file_path_obj.stem}.py",
                    f"{file_path_obj.stem}_test.py",
                    f"tests/test_{file_path_obj.stem}.py"
                ]
                
                for pattern in test_patterns:
                    test_file = file_path_obj.parent / pattern
                    if test_file.exists():
                        cmd = f"python -m pytest {test_file} -v"
                        result = await self._execute_shell_command(cmd, {}, context)
                        return result
                
                # If no specific test found, run all tests in directory
                cmd = f"python -m pytest {file_path_obj.parent} -v"
                return await self._execute_shell_command(cmd, {}, context)
            
            return {"success": True, "message": f"No test pattern for file type: {file_path_obj.suffix}"}
            
        except Exception as e:
            return {"success": False, "error": f"Test execution failed: {e}"}
    
    async def _load_context_documents(self, parameters: Dict[str, Any], context: HookContext) -> Dict[str, Any]:
        """Load context documents for file types"""
        try:
            context_documents = parameters.get("context_documents", [])
            suggested_roles = parameters.get("suggested_roles", [])
            file_path = context.file_path
            
            logger.info(f"Loading context documents for {file_path}: {context_documents}")
            logger.info(f"Suggested roles: {suggested_roles}")
            
            # This would integrate with the document linking system
            # For now, just return the information
            return {
                "success": True,
                "context_documents": context_documents,
                "suggested_roles": suggested_roles,
                "file_path": file_path,
                "message": f"Context loaded for {Path(file_path).name}"
            }
            
        except Exception as e:
            return {"success": False, "error": f"Context loading failed: {e}"}
    
    async def _run_all_tests(self, parameters: Dict[str, Any], context: HookContext) -> Dict[str, Any]:
        """Run all tests in the project"""
        test_command = parameters.get("test_command", "python -m pytest")
        return await self._execute_shell_command(test_command, {}, context)
    
    async def _backup_file(self, parameters: Dict[str, Any], context: HookContext) -> Dict[str, Any]:
        """Create backup of a file"""
        file_path = context.file_path
        if not file_path:
            return {"success": False, "error": "No file path in context"}
        
        backup_suffix = parameters.get("suffix", ".backup")
        backup_path = f"{file_path}{backup_suffix}"
        
        cmd = f"cp '{file_path}' '{backup_path}'"
        return await self._execute_shell_command(cmd, {}, context)
    
    async def _update_documentation(self, parameters: Dict[str, Any], context: HookContext) -> Dict[str, Any]:
        """Update documentation after changes"""
        return {"success": True, "message": "Documentation update placeholder"}
    
    async def _check_cicd_status(self, parameters: Dict[str, Any], context: HookContext) -> Dict[str, Any]:
        """Check CI/CD pipeline status"""
        return {"success": True, "message": "CI/CD status check placeholder"}
    
    async def _git_create_pr(self, parameters: Dict[str, Any], context: HookContext) -> Dict[str, Any]:
        """Create pull request"""
        return {"success": True, "message": "PR creation placeholder"}