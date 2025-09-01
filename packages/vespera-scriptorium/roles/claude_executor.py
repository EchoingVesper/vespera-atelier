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
        
        logger.info(f"=== ClaudeExecutor.execute_task_with_claude ENTRY ===")
        logger.info(f"Task ID: {task_id}")
        logger.info(f"Role: {context.role.name}")
        logger.info(f"Dry run: {dry_run}")
        logger.info(f"Project root: {self.project_root}")
        logger.info(f"Config: {self.config.__dict__}")
        
        try:
            logger.info("Step 1: Validating task ID...")
            # Validate inputs first
            task_id = self._validate_task_id(task_id)
            logger.info(f"Task ID validated: {task_id}")
            
            logger.info("Step 2: Preparing Claude CLI command...")
            # Prepare Claude CLI command
            claude_command, user_prompt = self._prepare_claude_command(context, task_id)
            logger.info(f"Command prepared: {' '.join(claude_command)}")
            logger.info(f"User prompt length: {len(user_prompt)} chars")
            
            if dry_run:
                logger.info("Dry run mode - returning without execution")
                return ExecutionResult(
                    status=ExecutionStatus.COMPLETED,
                    output=f"[DRY RUN] Would execute: {' '.join(claude_command)}\nWith user prompt: {user_prompt[:200]}...",
                    role_name=context.role.name,
                    execution_time=time.time() - start_time,
                    tool_groups_used=[self._extract_tool_groups(context.role)],
                    restrictions_violated=[],
                    files_modified=[]
                )
            
            logger.info("Step 3: Executing Claude CLI process...")
            # Execute Claude CLI process with stream-json format
            result = await self._execute_claude_process_with_streaming(
                claude_command, 
                user_prompt,
                task_id,
                context
            )
            
            logger.info("Step 4: Claude CLI execution completed successfully")
            logger.info(f"Result status: {result.status}")
            logger.info(f"Result output length: {len(result.output)}")
            return result
            
        except Exception as e:
            logger.error(f"=== ClaudeExecutor.execute_task_with_claude EXCEPTION ===")
            logger.error(f"Exception type: {type(e).__name__}")
            logger.error(f"Exception message: {str(e)}")
            logger.exception(f"Full traceback for task {task_id} Claude execution:")
            return ExecutionResult(
                status=ExecutionStatus.FAILED,
                output="",
                role_name=context.role.name,
                execution_time=time.time() - start_time,
                tool_groups_used=[],
                restrictions_violated=[],
                files_modified=[],
                error_message=f"ClaudeExecutor error: {str(e)}"
            )
    
    def _prepare_claude_command(
        self, 
        context: ExecutionContext, 
        task_id: str
    ) -> Tuple[List[str], str]:
        """
        Prepare Claude CLI command with role-based restrictions using proper CLI patterns.
        
        Returns:
            Tuple of (command_args, user_prompt_content)
        """
        # Base Claude command with proper flags for agent spawning
        command = [self.config.claude_binary, "--print"]
        
        # Add streaming JSON output for better response capture
        command.extend(["--output-format", "stream-json"])
        # Don't use --input-format stream-json, send plain text to stdin instead
        
        # Add verbose mode for debugging
        command.append("--verbose")
        
        # Add model configuration (template-driven)
        model = context.role.preferred_llm if hasattr(context.role, 'preferred_llm') else self.config.model
        if model:
            command.extend(["--model", model])
        
        # Add role-based tool restrictions (template-driven from role files)
        allowed_tools = self._get_allowed_tools(context.role)
        validated_tools = self._validate_tools(allowed_tools)
        if validated_tools:
            # Join tools with commas as expected by Claude CLI
            tools_str = ",".join(validated_tools)
            command.extend(["--allowed-tools", tools_str])
        
        # Use --append-system-prompt for role-specific system instructions
        system_prompt = self._build_role_system_prompt(context)
        if system_prompt:
            command.extend(["--append-system-prompt", system_prompt])
        
        # Add working directory access
        working_dir = self._get_validated_working_directory()
        if working_dir != self.project_root:
            command.extend(["--add-dir", str(working_dir)])
        
        # Build user prompt (task description) - this goes to stdin
        user_prompt = self._build_user_prompt(context, task_id)
        
        return command, user_prompt
    
    def _build_role_system_prompt(self, context: ExecutionContext) -> str:
        """Build system prompt for role-based execution using --append-system-prompt."""
        system_parts = [
            f"You are operating as a {context.role.display_name}.",
            context.role.system_prompt,
            "",
            "# Role Restrictions",
        ]
        
        # Add role restrictions
        if hasattr(context.role, 'restrictions') and context.role.restrictions:
            for restriction in context.role.restrictions:
                system_parts.append(f"- {restriction}")
        
        # Add tool group restrictions
        system_parts.append("")
        system_parts.append("# Tool Access")
        for group_entry in context.role.tool_groups:
            if isinstance(group_entry, ToolGroup):
                system_parts.append(f"- ✓ {group_entry.value}: Full access")
            elif isinstance(group_entry, tuple):
                group, options = group_entry
                restriction_info = f" (restricted to: {options.file_regex})" if hasattr(options, 'file_regex') and options.file_regex else ""
                system_parts.append(f"- ✓ {group.value}{restriction_info}")
        
        return "\n".join(system_parts)
    
    def _build_user_prompt(self, context: ExecutionContext, task_id: str) -> str:
        """Build user prompt (task description) that goes to stdin."""
        prompt_parts = [
            f"# Task: {context.task_prompt}",
            "",
            f"Task ID: {task_id}",
            "",
            "Please complete this task according to your role as a {}.".format(context.role.display_name),
        ]
        
        # Add any additional context
        if hasattr(context, 'project_context') and context.project_context:
            prompt_parts.extend(["", "## Project Context", context.project_context])
        
        if hasattr(context, 'linked_documents') and context.linked_documents:
            prompt_parts.extend(["", "## Referenced Documents"])
            for doc in context.linked_documents:
                prompt_parts.append(f"- {doc}")
        
        return "\n".join(prompt_parts)
    
    def _get_validated_working_directory(self) -> Path:
        """Get and validate the working directory."""
        if self.config.working_directory:
            try:
                return self._validate_working_directory(self.config.working_directory)
            except ValueError as e:
                logger.warning(f"Invalid working directory in config: {e}")
                return self.project_root
        return self.project_root
    
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
    
    async def _execute_claude_process_with_streaming(
        self,
        command: List[str],
        user_prompt: str,
        task_id: str,
        context: ExecutionContext
    ) -> ExecutionResult:
        """Execute Claude CLI process with stream-json format and proper stdin handling."""
        start_time = time.time()
        
        def log_progress(phase: str, percentage: int, message: str = ""):
            """Log execution progress with phase and percentage."""
            progress_msg = f"[{percentage:3d}%] {phase}"
            if message:
                progress_msg += f": {message}"
            logger.info(progress_msg)
        
        try:
            # Phase 1: Spawning (0-20%)
            log_progress("SPAWNING", 0, "Starting Claude CLI execution")
            logger.info(f"Executing Claude command for task {task_id}: {' '.join(command)}")
            logger.info(f"Working directory: {self.config.working_directory or self.project_root}")
            logger.info(f"User prompt length: {len(user_prompt)} chars")
            
            log_progress("SPAWNING", 5, "Validating working directory")
            # Validate and prepare working directory
            working_dir = self.config.working_directory or str(self.project_root)
            validated_working_dir = self._validate_working_directory(working_dir)
            
            log_progress("SPAWNING", 10, "Creating subprocess")
            # Start Claude process with security restrictions
            process = await asyncio.create_subprocess_exec(
                *command,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=validated_working_dir,
                # Add process limits (available on Unix-like systems)
                preexec_fn=self._setup_process_limits if hasattr(__import__('os'), 'setrlimit') else None
            )
            
            log_progress("SPAWNING", 15, f"Subprocess created with PID: {process.pid}")
            self.active_processes[task_id] = process
            
            log_progress("SPAWNING", 20, "Subprocess spawned successfully")
            
            # Phase 2: Executing (20-80%)
            log_progress("EXECUTING", 25, "Sending task prompt to Claude CLI")
            logger.info(f"User prompt: {user_prompt[:200]}...")
            
            log_progress("EXECUTING", 30, f"Waiting for Claude response (timeout: {self.config.timeout}s)")
            # Wait for completion with extended timeout for LLM processing
            try:
                # Monitor execution with progress updates
                execution_start = time.time()
                timeout_increment = self.config.timeout / 10  # Update every 10% of timeout
                
                # Use a loop to provide progress updates during long execution
                communication_task = asyncio.create_task(
                    process.communicate(input=user_prompt.encode('utf-8'))
                )
                
                # Progress monitoring loop
                progress_step = 35
                while not communication_task.done():
                    elapsed = time.time() - execution_start
                    if elapsed > self.config.timeout:
                        communication_task.cancel()
                        raise asyncio.TimeoutError()
                    
                    # Update progress based on elapsed time
                    if progress_step < 75:  # Cap at 75% during execution
                        execution_progress = min(int((elapsed / self.config.timeout) * 40), 40)
                        current_progress = 35 + execution_progress
                        if current_progress >= progress_step:
                            log_progress("EXECUTING", progress_step, f"Claude processing... ({elapsed:.1f}s elapsed)")
                            progress_step += 5
                    
                    await asyncio.sleep(timeout_increment)
                
                stdout, stderr = await communication_task
                log_progress("EXECUTING", 80, f"Claude execution completed (return code: {process.returncode})")
                
            except asyncio.TimeoutError:
                log_progress("EXECUTING", -1, f"TIMEOUT after {self.config.timeout} seconds")
                logger.error(f"Subprocess timed out after {self.config.timeout} seconds")
                process.kill()
                await process.wait()
                raise TimeoutError(f"Claude execution timed out after {self.config.timeout} seconds")
            
            # Phase 3: Processing (80-95%)
            log_progress("PROCESSING", 82, "Cleaning up subprocess")
            if task_id in self.active_processes:
                del self.active_processes[task_id]
            
            log_progress("PROCESSING", 85, "Decoding output streams")
            execution_time = time.time() - start_time
            raw_output = stdout.decode('utf-8') if stdout else ""
            error_output = stderr.decode('utf-8') if stderr else ""
            
            logger.info(f"Raw output length: {len(raw_output)} chars")
            logger.info(f"Error output: {error_output[:500]}..." if error_output else "No error output")
            
            log_progress("PROCESSING", 88, "Parsing stream-json output")
            # Parse stream-json output to extract actual Claude response
            parsed_output = self._parse_stream_json_output(raw_output)
            
            log_progress("PROCESSING", 92, "Analyzing execution results")
            logger.info(f"Parsed output length: {len(parsed_output)} chars")
            logger.info(f"Subprocess error length: {len(error_output)} chars")
            
            if error_output:
                logger.error(f"Claude subprocess stderr: {error_output[:500]}...")
            
            # Determine status
            if process.returncode == 0:
                status = ExecutionStatus.COMPLETED
                error_message = None
                log_progress("PROCESSING", 95, "Execution successful")
            else:
                status = ExecutionStatus.FAILED
                error_message = error_output or f"Claude process exited with code {process.returncode}"
                log_progress("PROCESSING", 95, f"Execution failed: {error_message[:100]}...")
            
            # Phase 4: Completion (95-100%)
            log_progress("COMPLETION", 97, "Extracting file modifications")
            files_modified = self._extract_file_modifications(parsed_output)
            
            log_progress("COMPLETION", 100, f"Task execution complete ({execution_time:.1f}s total)")
            
            return ExecutionResult(
                status=status,
                output=parsed_output,
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
    
    def _parse_stream_json_output(self, raw_output: str) -> str:
        """Parse stream-json output to extract actual Claude response content using Claude Code SDK schema."""
        if not raw_output.strip():
            return ""
        
        content_parts = []
        
        # Split by lines and parse each JSON object
        for line in raw_output.strip().split('\n'):
            line = line.strip()
            if not line:
                continue
                
            try:
                json_obj = json.loads(line)
                
                # Handle Claude Code SDK message schema format
                if json_obj.get('type') == 'assistant':
                    # Assistant message with content
                    message = json_obj.get('message', {})
                    content = message.get('content', [])
                    
                    if isinstance(content, list):
                        for block in content:
                            if isinstance(block, dict) and block.get('type') == 'text':
                                content_parts.append(block.get('text', ''))
                    elif isinstance(content, str):
                        content_parts.append(content)
                        
                elif json_obj.get('type') == 'result':
                    # Result object with final result
                    result = json_obj.get('result', '')
                    if result:
                        content_parts.append(result)
                        
                elif json_obj.get('type') == 'system':
                    # System initialization - ignore
                    continue
                    
                # Legacy fallbacks for other formats
                elif json_obj.get('type') == 'content_block_delta':
                    # Streaming content delta
                    delta = json_obj.get('delta', {})
                    if delta.get('type') == 'text_delta':
                        content_parts.append(delta.get('text', ''))
                        
                elif json_obj.get('type') == 'content_block':
                    # Complete content block
                    if json_obj.get('content_type') == 'text':
                        content_parts.append(json_obj.get('text', ''))
                        
                elif json_obj.get('type') == 'message':
                    # Complete message (fallback)
                    content = json_obj.get('content', [])
                    if isinstance(content, list):
                        for block in content:
                            if isinstance(block, dict) and block.get('type') == 'text':
                                content_parts.append(block.get('text', ''))
                    elif isinstance(content, str):
                        content_parts.append(content)
                        
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse JSON line: {line[:100]}... Error: {e}")
                # If JSON parsing fails, treat as plain text (fallback)
                content_parts.append(line)
        
        result = ''.join(content_parts).strip()
        
        # If no JSON parsing worked, return raw output as fallback
        if not result and raw_output:
            logger.info("No JSON content found, using raw output as fallback")
            return raw_output
            
        return result
    
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
        
        # File restrictions come from tool group options, not general restrictions
        # Check tool groups for file restrictions
        for tool_group in role.tool_groups:
            if isinstance(tool_group, tuple) and len(tool_group) > 1:
                # Tool group with options
                options = tool_group[1]
                if hasattr(options, 'file_regex') and options.file_regex:
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