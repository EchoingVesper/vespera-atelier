"""
Claude CLI Executor for spawning real Claude agents.

Implements actual Claude CLI process spawning for role-based task execution.
"""

import logging
import subprocess
import json
import tempfile
import asyncio
from typing import Dict, List, Optional, Any, Tuple
from pathlib import Path
from dataclasses import dataclass
import time

from .definitions import Role, ToolGroup, RestrictionType
from .execution import ExecutionContext, ExecutionResult, ExecutionStatus

logger = logging.getLogger(__name__)


@dataclass
class ClaudeExecutionConfig:
    """Configuration for Claude CLI execution."""
    claude_binary: str = "claude"  # Path to claude binary
    working_directory: Optional[str] = None
    timeout: int = 300  # 5 minute default timeout
    max_tokens: Optional[int] = None
    model: Optional[str] = None
    temperature: Optional[float] = None
    
    
class ClaudeExecutor:
    """
    Executes tasks by spawning actual Claude CLI processes.
    
    Converts role-based execution contexts into Claude CLI commands
    and manages the subprocess lifecycle.
    """
    
    def __init__(self, project_root: Path, config: Optional[ClaudeExecutionConfig] = None):
        self.project_root = project_root
        self.config = config or ClaudeExecutionConfig()
        self.active_processes: Dict[str, subprocess.Popen] = {}
        
    async def execute_task_with_claude(
        self,
        context: ExecutionContext,
        task_id: str,
        dry_run: bool = False
    ) -> ExecutionResult:
        """
        Execute a task using Claude CLI with role-based restrictions.
        
        Args:
            context: Execution context with role and task information
            task_id: Unique identifier for this task execution
            dry_run: If True, prepare command but don't execute
            
        Returns:
            ExecutionResult with Claude's output and execution metadata
        """
        start_time = time.time()
        
        try:
            # Prepare Claude CLI command
            claude_command, prompt_file = self._prepare_claude_command(context, task_id)
            
            if dry_run:
                return ExecutionResult(
                    status=ExecutionStatus.COMPLETED,
                    output=f"[DRY RUN] Would execute: {' '.join(claude_command)}",
                    role_name=context.role.name,
                    execution_time=time.time() - start_time,
                    tool_groups_used=[self._extract_tool_groups(context.role)],
                    restrictions_violated=[],
                    files_modified=[],
                    claude_command=claude_command
                )
            
            # Execute Claude CLI process
            result = await self._execute_claude_process(
                claude_command, 
                prompt_file,
                task_id,
                context
            )
            
            return result
            
        except Exception as e:
            logger.exception(f"Failed to execute task {task_id} with Claude")
            return ExecutionResult(
                status=ExecutionStatus.FAILED,
                output="",
                role_name=context.role.name,
                execution_time=time.time() - start_time,
                tool_groups_used=[],
                restrictions_violated=[],
                files_modified=[],
                error_message=str(e)
            )
    
    def _prepare_claude_command(
        self, 
        context: ExecutionContext, 
        task_id: str
    ) -> Tuple[List[str], Path]:
        """
        Prepare Claude CLI command with role-based restrictions.
        
        Returns:
            Tuple of (command_args, prompt_file_path)
        """
        # Create temporary prompt file
        prompt_content = self._build_role_aware_prompt(context, task_id)
        prompt_file = self._create_prompt_file(prompt_content, task_id)
        
        # Base Claude command
        command = [self.config.claude_binary]
        
        # Add working directory
        if self.config.working_directory:
            command.extend(["-C", self.config.working_directory])
        elif context.role.file_restrictions:
            # Use project root if role has file restrictions
            command.extend(["-C", str(self.project_root)])
        
        # Add model configuration
        if self.config.model:
            command.extend(["--model", self.config.model])
        
        # Add token limits
        if self.config.max_tokens:
            command.extend(["--max-tokens", str(self.config.max_tokens)])
        
        # Add temperature
        if self.config.temperature:
            command.extend(["--temperature", str(self.config.temperature)])
        
        # Add role-based tool restrictions
        allowed_tools = self._get_allowed_tools(context.role)
        if allowed_tools:
            command.extend(["--tools", ",".join(allowed_tools)])
        
        # Add file pattern restrictions
        file_patterns = self._get_file_restrictions(context.role)
        if file_patterns:
            for pattern in file_patterns:
                command.extend(["--restrict-files", pattern])
        
        # Add prompt file
        command.extend(["-f", str(prompt_file)])
        
        return command, prompt_file
    
    def _build_role_aware_prompt(self, context: ExecutionContext, task_id: str) -> str:
        """Build a comprehensive prompt that includes role context and restrictions."""
        
        prompt_parts = [
            "# Claude Agent Execution Context",
            f"**Task ID**: {task_id}",
            f"**Role**: {context.role.name} ({context.role.display_name})",
            f"**Description**: {context.role.description}",
            "",
            "## Role Capabilities and Restrictions",
        ]
        
        # Add tool group capabilities
        tool_groups = [self._extract_tool_groups(context.role)]
        if tool_groups:
            prompt_parts.extend([
                "**Allowed Tool Groups**:",
                *[f"- {group}" for group in tool_groups],
                ""
            ])
        
        # Add restrictions
        if context.tool_group_restrictions:
            prompt_parts.extend([
                "**Role Restrictions**:",
                *[f"- {restriction}" for restriction in context.tool_group_restrictions],
                ""
            ])
        
        # Add file restrictions
        file_restrictions = self._get_file_restrictions(context.role)
        if file_restrictions:
            prompt_parts.extend([
                "**File Access Restrictions**:",
                *[f"- Only modify files matching: {pattern}" for pattern in file_restrictions],
                ""
            ])
        
        # Add project context
        if context.project_context:
            prompt_parts.extend([
                "## Project Context",
                context.project_context,
                ""
            ])
        
        # Add parent task context
        if context.parent_context:
            prompt_parts.extend([
                "## Parent Task Context",
                context.parent_context,
                ""
            ])
        
        # Add linked documents
        if context.linked_documents:
            prompt_parts.extend([
                "## Relevant Documents",
                *[f"- {doc}" for doc in context.linked_documents],
                ""
            ])
        
        # Add the actual task
        prompt_parts.extend([
            "## Task to Execute",
            context.task_prompt,
            "",
            "## Instructions",
            "Execute this task following the role capabilities and restrictions above.",
            "Provide clear output indicating what was accomplished.",
            "Respect all file access restrictions and tool limitations.",
            "If you cannot complete the task due to restrictions, explain why."
        ])
        
        return "\n".join(prompt_parts)
    
    def _create_prompt_file(self, content: str, task_id: str) -> Path:
        """Create a temporary file with the prompt content."""
        temp_dir = Path(tempfile.gettempdir()) / "vespera-claude-prompts"
        temp_dir.mkdir(exist_ok=True)
        
        prompt_file = temp_dir / f"task_{task_id}_{int(time.time())}.md"
        
        with open(prompt_file, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return prompt_file
    
    async def _execute_claude_process(
        self,
        command: List[str],
        prompt_file: Path,
        task_id: str,
        context: ExecutionContext
    ) -> ExecutionResult:
        """Execute the Claude CLI process and capture results."""
        start_time = time.time()
        
        try:
            logger.info(f"Executing Claude command for task {task_id}: {' '.join(command)}")
            
            # Start Claude process
            process = await asyncio.create_subprocess_exec(
                *command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=self.config.working_directory or self.project_root
            )
            
            self.active_processes[task_id] = process
            
            # Wait for completion with timeout
            try:
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(),
                    timeout=self.config.timeout
                )
            except asyncio.TimeoutError:
                process.kill()
                await process.wait()
                raise TimeoutError(f"Claude execution timed out after {self.config.timeout} seconds")
            
            # Clean up
            if task_id in self.active_processes:
                del self.active_processes[task_id]
            
            # Parse results
            execution_time = time.time() - start_time
            output = stdout.decode('utf-8') if stdout else ""
            error_output = stderr.decode('utf-8') if stderr else ""
            
            # Determine status
            if process.returncode == 0:
                status = ExecutionStatus.COMPLETED
                error_message = None
            else:
                status = ExecutionStatus.FAILED
                error_message = error_output or f"Claude process exited with code {process.returncode}"
            
            # Extract file modifications (would need to parse Claude's output)
            files_modified = self._extract_file_modifications(output)
            
            # Clean up prompt file
            try:
                prompt_file.unlink()
            except Exception:
                pass  # Ignore cleanup errors
            
            return ExecutionResult(
                status=status,
                output=output,
                role_name=context.role.name,
                execution_time=execution_time,
                tool_groups_used=[self._extract_tool_groups(context.role)],
                restrictions_violated=[],  # Would need to parse from output
                files_modified=files_modified,
                error_message=error_message,
                claude_return_code=process.returncode
            )
            
        except Exception as e:
            # Clean up on error
            if task_id in self.active_processes:
                try:
                    self.active_processes[task_id].kill()
                    del self.active_processes[task_id]
                except:
                    pass
            
            try:
                prompt_file.unlink()
            except:
                pass
            
            raise e
    
    def _get_allowed_tools(self, role: Role) -> List[str]:
        """Extract allowed tools from role's tool groups."""
        tools = []
        
        for tool_group in role.tool_groups:
            if isinstance(tool_group, ToolGroup):
                # Map tool groups to Claude CLI tool names
                if tool_group == ToolGroup.READ:
                    tools.extend(["read", "grep", "find"])
                elif tool_group == ToolGroup.EDIT:
                    tools.extend(["edit", "write"])
                elif tool_group == ToolGroup.COMMAND:
                    tools.extend(["bash"])
                elif tool_group == ToolGroup.BROWSER:
                    tools.extend(["webfetch", "websearch"])
                elif tool_group == ToolGroup.MCP:
                    tools.extend(["mcp"])
                # Add other tool group mappings as needed
        
        return list(set(tools))  # Remove duplicates
    
    def _get_file_restrictions(self, role: Role) -> List[str]:
        """Extract file access patterns from role restrictions."""
        patterns = []
        
        for restriction in role.restrictions:
            if restriction.type == RestrictionType.FILE_PATTERN:
                patterns.append(str(restriction.value))
        
        # Check tool groups for file restrictions
        for tool_group in role.tool_groups:
            if isinstance(tool_group, tuple) and len(tool_group) > 1:
                # Tool group with options
                options = tool_group[1]
                if hasattr(options, 'file_regex'):
                    patterns.append(options.file_regex)
        
        return patterns
    
    def _extract_tool_groups(self, role: Role) -> List[str]:
        """Extract tool group names from role."""
        groups = []
        for tool_group in role.tool_groups:
            if isinstance(tool_group, ToolGroup):
                groups.append(tool_group.value)
            elif isinstance(tool_group, tuple):
                groups.append(tool_group[0].value)
        return groups
    
    def _extract_file_modifications(self, output: str) -> List[str]:
        """
        Parse Claude's output to extract file modifications.
        This would need to be enhanced based on actual Claude output format.
        """
        # Simple implementation - look for common file operation patterns
        files = []
        lines = output.split('\n')
        
        for line in lines:
            # Look for file paths in output
            if 'Created:' in line or 'Modified:' in line or 'Updated:' in line:
                # Extract file path (would need better parsing)
                parts = line.split()
                for part in parts:
                    if '/' in part and ('.' in part or part.endswith('/')):
                        files.append(part)
        
        return files
    
    def kill_task(self, task_id: str) -> bool:
        """Kill a running Claude process for the given task."""
        if task_id in self.active_processes:
            try:
                process = self.active_processes[task_id]
                process.kill()
                del self.active_processes[task_id]
                return True
            except Exception as e:
                logger.error(f"Failed to kill process for task {task_id}: {e}")
                return False
        return False
    
    def get_active_tasks(self) -> List[str]:
        """Get list of currently executing task IDs."""
        return list(self.active_processes.keys())
    
    def shutdown(self):
        """Kill all active processes and clean up."""
        for task_id in list(self.active_processes.keys()):
            self.kill_task(task_id)