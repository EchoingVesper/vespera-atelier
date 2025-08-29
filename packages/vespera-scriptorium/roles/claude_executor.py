"""
Claude CLI Executor for spawning real Claude agents.

Implements actual Claude CLI process spawning for role-based task execution.
"""

import logging
import subprocess
import json
import tempfile
import asyncio
import shlex
import re
from typing import Dict, List, Optional, Any, Tuple
from pathlib import Path
from dataclasses import dataclass
import time

from .definitions import Role, ToolGroup, RestrictionType
from .execution import ExecutionContext, ExecutionResult, ExecutionStatus

logger = logging.getLogger(__name__)

# Security constants
ALLOWED_TOOL_PATTERN = re.compile(r'^[a-zA-Z][a-zA-Z0-9_-]*$')
MAX_TASK_ID_LENGTH = 64
MAX_WORKING_DIR_DEPTH = 10
ALLOWED_CLAUDE_TOOLS = {
    'read', 'write', 'edit', 'bash', 'grep', 'find', 
    'webfetch', 'websearch', 'mcp', 'glob', 'ls'
}


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
        self.project_root = self._validate_project_root(project_root)
        self.config = config or ClaudeExecutionConfig()
        self.active_processes: Dict[str, subprocess.Popen] = {}
    
    def _validate_project_root(self, project_root: Path) -> Path:
        """Validate and sanitize project root path."""
        if not isinstance(project_root, Path):
            project_root = Path(project_root)
        
        # Resolve to absolute path to prevent traversal
        project_root = project_root.resolve()
        
        # Ensure it exists and is a directory
        if not project_root.exists():
            raise ValueError(f"Project root does not exist: {project_root}")
        if not project_root.is_dir():
            raise ValueError(f"Project root is not a directory: {project_root}")
        
        # Check path depth to prevent deeply nested directories
        if len(project_root.parts) > MAX_WORKING_DIR_DEPTH:
            raise ValueError(f"Project root path too deep (max {MAX_WORKING_DIR_DEPTH} levels)")
        
        return project_root
    
    def _validate_task_id(self, task_id: str) -> str:
        """Validate and sanitize task ID."""
        if not isinstance(task_id, str):
            raise ValueError("Task ID must be a string")
        
        if len(task_id) > MAX_TASK_ID_LENGTH:
            raise ValueError(f"Task ID too long (max {MAX_TASK_ID_LENGTH} characters)")
        
        # Allow only alphanumeric, hyphens, and underscores
        if not re.match(r'^[a-zA-Z0-9_-]+$', task_id):
            raise ValueError("Task ID contains invalid characters")
        
        return task_id
    
    def _validate_tools(self, tools: List[str]) -> List[str]:
        """Validate and sanitize tool names."""
        validated_tools = []
        
        for tool in tools:
            if not isinstance(tool, str):
                logger.warning(f"Skipping non-string tool: {tool}")
                continue
            
            # Check against allowed pattern
            if not ALLOWED_TOOL_PATTERN.match(tool):
                logger.warning(f"Skipping invalid tool name: {tool}")
                continue
            
            # Check against whitelist
            if tool not in ALLOWED_CLAUDE_TOOLS:
                logger.warning(f"Skipping disallowed tool: {tool}")
                continue
            
            validated_tools.append(tool)
        
        return validated_tools
    
    def _validate_working_directory(self, working_dir: str) -> Path:
        """Validate and sanitize working directory."""
        if not working_dir:
            return self.project_root
        
        working_path = Path(working_dir).resolve()
        
        # Ensure it's within project root (prevent path traversal)
        try:
            working_path.relative_to(self.project_root)
        except ValueError:
            raise ValueError(f"Working directory outside project root: {working_path}")
        
        # Ensure it exists and is a directory
        if not working_path.exists():
            raise ValueError(f"Working directory does not exist: {working_path}")
        if not working_path.is_dir():
            raise ValueError(f"Working directory is not a directory: {working_path}")
        
        return working_path
    
    def _setup_process_limits(self):
        """Set resource limits for Claude subprocess (Unix only)."""
        try:
            import resource
            
            # Set memory limit (1GB)
            resource.setrlimit(resource.RLIMIT_AS, (1024 * 1024 * 1024, 1024 * 1024 * 1024))
            
            # Set CPU time limit (10 minutes)  
            resource.setrlimit(resource.RLIMIT_CPU, (600, 600))
            
            # Set file size limit (100MB)
            resource.setrlimit(resource.RLIMIT_FSIZE, (100 * 1024 * 1024, 100 * 1024 * 1024))
            
            # Set maximum number of processes
            resource.setrlimit(resource.RLIMIT_NPROC, (10, 10))
            
        except (ImportError, OSError) as e:
            # Resource limits not available on this platform
            logger.debug(f"Process limits not set: {e}")
        
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
            # Validate inputs first
            task_id = self._validate_task_id(task_id)
            
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
                    files_modified=[]
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
        
        # Base Claude command with --print flag for non-interactive execution
        command = [self.config.claude_binary, "--print"]
        
        # Add model configuration
        if self.config.model:
            command.extend(["--model", self.config.model])
        
        # Add role-based tool restrictions using correct Claude CLI format
        allowed_tools = self._get_allowed_tools(context.role)
        validated_tools = self._validate_tools(allowed_tools)
        if validated_tools:
            # Use shlex.quote to prevent command injection
            command.extend(["--allowed-tools"] + [shlex.quote(tool) for tool in validated_tools])
        
        # Add additional directory access if needed (with validation)
        working_dir = None
        if self.config.working_directory:
            try:
                working_dir = self._validate_working_directory(self.config.working_directory)
            except ValueError as e:
                logger.warning(f"Invalid working directory in config: {e}")
                working_dir = self.project_root
        else:
            working_dir = self.project_root
        
        if working_dir and working_dir.exists():
            # Use shlex.quote to prevent path injection
            command.extend(["--add-dir", shlex.quote(str(working_dir))])
        
        # Note: prompt will be sent via stdin, not as command line argument
        
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
        # Validate task_id is already sanitized
        task_id = self._validate_task_id(task_id)
        
        # Create secure temporary directory
        temp_dir = Path(tempfile.gettempdir()) / "vespera-claude-prompts"
        temp_dir.mkdir(mode=0o700, exist_ok=True)  # Restrict permissions
        
        # Use secure filename pattern
        timestamp = int(time.time())
        prompt_file = temp_dir / f"task_{task_id}_{timestamp}.md"
        
        # Write with restricted permissions
        with open(prompt_file, 'w', encoding='utf-8') as f:
            f.write(content)
        
        # Set secure file permissions
        prompt_file.chmod(0o600)  # Owner read/write only
        
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
            logger.info(f"Working directory: {self.config.working_directory or self.project_root}")
            logger.info(f"Prompt file: {prompt_file}")
            
            # Verify prompt file exists and is readable
            if not prompt_file.exists():
                raise FileNotFoundError(f"Prompt file does not exist: {prompt_file}")
            logger.info(f"Prompt file size: {prompt_file.stat().st_size} bytes")
            
            # Validate and prepare working directory
            working_dir = self.config.working_directory or str(self.project_root)
            validated_working_dir = self._validate_working_directory(working_dir)
            
            # Start Claude process with security restrictions
            logger.info("Creating subprocess...")
            process = await asyncio.create_subprocess_exec(
                *command,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=validated_working_dir,
                # Add process limits (available on Unix-like systems)
                preexec_fn=self._setup_process_limits if hasattr(__import__('os'), 'setrlimit') else None
            )
            logger.info(f"Subprocess created with PID: {process.pid}")
            
            self.active_processes[task_id] = process
            
            # Send prompt via stdin and wait for completion
            logger.info("Sending prompt via stdin...")
            prompt_content = prompt_file.read_text(encoding='utf-8')
            
            # Wait for completion with timeout
            logger.info(f"Waiting for subprocess completion (timeout: {self.config.timeout}s)...")
            try:
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(input=prompt_content.encode('utf-8')),
                    timeout=self.config.timeout
                )
                logger.info(f"Subprocess completed with return code: {process.returncode}")
            except asyncio.TimeoutError:
                logger.error(f"Subprocess timed out after {self.config.timeout} seconds")
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
            
            logger.info(f"Subprocess output length: {len(output)} chars")
            logger.info(f"Subprocess error length: {len(error_output)} chars")
            
            if error_output:
                logger.error(f"Claude subprocess stderr: {error_output[:500]}...")
            
            # Determine status
            if process.returncode == 0:
                status = ExecutionStatus.COMPLETED
                error_message = None
                logger.info("Claude subprocess completed successfully")
            else:
                status = ExecutionStatus.FAILED
                error_message = error_output or f"Claude process exited with code {process.returncode}"
                logger.error(f"Claude subprocess failed: {error_message}")
            
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
                error_message=error_message
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