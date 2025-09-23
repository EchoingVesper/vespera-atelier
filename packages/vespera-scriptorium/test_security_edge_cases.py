#!/usr/bin/env python3
"""
Comprehensive edge case and security testing for MCP-Bindery integration.

Tests malformed inputs, injection attempts, error conditions, and edge cases
to ensure robust security and error handling.
"""

import asyncio
import json
import pytest
from typing import Any, Dict
from unittest.mock import Mock, patch

from security import (
    SecurityValidator,
    ErrorSanitizer,
    secure_deserialize_mcp_param,
    set_production_mode,
    schema_cache,
    validate_task_recursion_depth,
    MAX_TASK_DEPTH
)
from models import TaskInput, TaskOutput, TaskStatus, TaskPriority, ProjectInput, SearchInput
from datetime import datetime
from bindery_client import BinderyClient, BinderyClientError
from pydantic import ValidationError


class TestSecurityValidation:
    """Test security validation functions."""

    def test_string_sanitization_basic(self):
        """Test basic string sanitization."""
        validator = SecurityValidator()

        # Normal string should pass
        result = validator.sanitize_string("Normal task title")
        assert result == "Normal task title"

        # HTML entities should be escaped
        result = validator.sanitize_string("<script>alert('xss')</script>")
        assert "<script>" not in result
        assert "&lt;script&gt;" in result or "script" not in result

    def test_string_length_limits(self):
        """Test string length validation."""
        validator = SecurityValidator()

        # String at limit should pass
        long_string = "a" * 10000
        result = validator.sanitize_string(long_string)
        assert len(result) == 10000

        # String over limit should raise
        too_long = "a" * 10001
        with pytest.raises(ValidationError):
            validator.sanitize_string(too_long)

    def test_injection_pattern_detection(self):
        """Test detection of injection patterns."""
        validator = SecurityValidator()

        injection_tests = [
            "javascript:alert('xss')",
            "onclick='malicious()'",
            "${malicious_code}",
            "{{template_injection}}",
            "eval(dangerous_code)",
            "__proto__.polluted = true",
            "constructor['prototype']"
        ]

        for injection in injection_tests:
            result = validator.sanitize_string(injection)
            # Dangerous patterns should be removed
            assert "javascript:" not in result
            assert "eval(" not in result
            assert "__proto__" not in result

    def test_json_structure_validation(self):
        """Test JSON structure validation."""
        validator = SecurityValidator()

        # Valid structure should pass
        valid = {"title": "Test", "tags": ["tag1", "tag2"]}
        validator.validate_json_structure(valid)  # Should not raise

        # Deep nesting should fail
        deep_nested = {"level1": {"level2": {}}}
        for i in range(15):
            deep_nested = {"nested": deep_nested}

        with pytest.raises(ValidationError, match="depth"):
            validator.validate_json_structure(deep_nested)

        # Too many keys should fail
        too_many_keys = {f"key{i}": i for i in range(101)}
        with pytest.raises(ValidationError, match="too many keys"):
            validator.validate_json_structure(too_many_keys)

        # Dangerous keys should fail
        dangerous = {"__proto__": "value", "normal": "ok"}
        with pytest.raises(ValidationError, match="dangerous key"):
            validator.validate_json_structure(dangerous)

    def test_null_byte_removal(self):
        """Test removal of null bytes and control characters."""
        validator = SecurityValidator()

        json_with_nulls = '{"title": "Test\x00Task", "description": "Normal\x0ctext"}'
        sanitized = validator.sanitize_json_string(json_with_nulls)

        assert "\x00" not in sanitized
        assert "\x0c" not in sanitized
        assert "TestTask" in sanitized


class TestErrorSanitization:
    """Test error message sanitization."""

    def test_development_mode_sanitization(self):
        """Test error sanitization in development mode."""
        set_production_mode(False)
        sanitizer = ErrorSanitizer()

        # Create error with sensitive information
        error = Exception("/home/user/secret/path/file.py:42 - password='secret123'")
        result = sanitizer.sanitize_error_message(error)

        # Paths should be sanitized
        assert "/home/user" not in result["error"]
        assert "[path]" in result["error"]

        # Credentials should be sanitized
        assert "secret123" not in result["error"]
        assert "[credential]" in result["error"]

    def test_production_mode_sanitization(self):
        """Test error sanitization in production mode."""
        set_production_mode(True)
        sanitizer = ErrorSanitizer()

        # Any error should return generic message
        error = Exception("Detailed database error with connection string")
        result = sanitizer.sanitize_error_message(error)

        assert result["error"] == "An error occurred processing your request"
        assert "database" not in result["error"]
        assert result["type"] == "processing_error"

    def test_ip_and_port_sanitization(self):
        """Test IP address and port sanitization."""
        set_production_mode(False)
        sanitizer = ErrorSanitizer()

        error = Exception("Connection failed to 192.168.1.100:5432")
        result = sanitizer.sanitize_error_message(error)

        assert "192.168.1.100" not in result["error"]
        assert "[ip]" in result["error"]
        assert "5432" not in result["error"]
        assert "[port]" in result["error"]


class TestSecureDeserialization:
    """Test secure parameter deserialization."""

    def test_valid_json_string_deserialization(self):
        """Test deserializing valid JSON strings."""
        json_input = '{"title": "Test Task", "priority": "high"}'
        result = secure_deserialize_mcp_param(json_input, TaskInput)

        assert isinstance(result, TaskInput)
        assert result.title == "Test Task"
        assert result.priority.value == "high"

    def test_malformed_json_handling(self):
        """Test handling of malformed JSON."""
        malformed_inputs = [
            '{"title": "Unclosed',
            '{"title": null}',  # Required field null
            '{"title": }',  # Missing value
            'not json at all',
            '{"title": "Test", "extra": }',  # Trailing comma issues
        ]

        for malformed in malformed_inputs:
            with pytest.raises(ValidationError):
                secure_deserialize_mcp_param(malformed, TaskInput)

    def test_injection_in_json_values(self):
        """Test handling injection attempts in JSON values."""
        injection_json = json.dumps({
            "title": "<script>alert('xss')</script>",
            "description": "javascript:void(0)",
            "tags": ["normal", "__proto__"]
        })

        # Should sanitize but still create valid object
        result = secure_deserialize_mcp_param(injection_json, TaskInput, strict_mode=True)
        assert isinstance(result, TaskInput)
        # The sanitized values should not contain dangerous patterns
        assert "<script>" not in result.title

    def test_dictionary_input_validation(self):
        """Test dictionary input validation."""
        valid_dict = {
            "title": "Test Task",
            "description": "Test description",
            "priority": "normal"
        }

        result = secure_deserialize_mcp_param(valid_dict, TaskInput)
        assert isinstance(result, TaskInput)
        assert result.title == "Test Task"

    def test_schema_caching_performance(self):
        """Test that schema caching improves performance."""
        # Clear cache
        schema_cache.clear()

        # First call should cache
        schema1 = schema_cache.get_schema(TaskInput)
        # Second call should use cache
        schema2 = schema_cache.get_schema(TaskInput)

        assert schema1 is schema2  # Should be same object from cache

    def test_context_preservation(self):
        """Test that error context is preserved."""
        invalid_json = '{"invalid json}'

        try:
            secure_deserialize_mcp_param(invalid_json, TaskInput)
        except ValidationError as e:
            # Should preserve context about JSON parsing
            assert "JSON" in str(e)
            assert "TaskInput" in str(e) or "model_name" in str(e.json())


class TestEdgeCases:
    """Test edge cases and boundary conditions."""

    def test_empty_inputs(self):
        """Test handling of empty inputs."""
        with pytest.raises(ValidationError):
            secure_deserialize_mcp_param("", TaskInput)

        with pytest.raises(ValidationError):
            secure_deserialize_mcp_param("{}", TaskInput)  # Missing required fields

        with pytest.raises(ValidationError):
            secure_deserialize_mcp_param(None, TaskInput)

    def test_unicode_handling(self):
        """Test handling of unicode and special characters."""
        unicode_input = {
            "title": "测试任务 🚀 Test",
            "description": "Special chars: €£¥₹",
            "tags": ["emoji✨", "中文"]
        }

        result = secure_deserialize_mcp_param(unicode_input, TaskInput)
        assert result.title == "测试任务 🚀 Test"
        assert "emoji✨" in result.tags

    def test_large_payload_handling(self):
        """Test handling of large payloads."""
        # Create a large but valid payload
        large_payload = {
            "title": "Test Task",
            "description": "x" * 5000,  # Large description
            "tags": [f"tag{i}" for i in range(100)]  # Many tags
        }

        result = secure_deserialize_mcp_param(large_payload, TaskInput)
        assert len(result.description) == 5000
        assert len(result.tags) == 100

        # Too large should fail
        too_large = {
            "title": "x" * 10001,  # Over limit
            "tags": []
        }

        with pytest.raises(ValidationError):
            secure_deserialize_mcp_param(json.dumps(too_large), TaskInput, strict_mode=True)

    def test_nested_object_validation(self):
        """Test validation of nested objects."""
        nested_input = {
            "title": "Parent Task",
            "subtasks": [
                {"title": "Subtask 1"},
                {"title": "Subtask 2", "priority": "high"}
            ]
        }

        result = secure_deserialize_mcp_param(nested_input, TaskInput)
        assert len(result.subtasks) == 2
        assert result.subtasks[0].title == "Subtask 1"

    def test_concurrent_deserialization(self):
        """Test thread safety of deserialization."""
        async def deserialize_task(index):
            input_data = {"title": f"Task {index}"}
            return secure_deserialize_mcp_param(input_data, TaskInput)

        async def run_concurrent():
            tasks = [deserialize_task(i) for i in range(10)]
            results = await asyncio.gather(*tasks)
            return results

        results = asyncio.run(run_concurrent())
        assert len(results) == 10
        assert all(isinstance(r, TaskInput) for r in results)


class TestIntegrationScenarios:
    """Test realistic integration scenarios."""

    @pytest.mark.asyncio
    async def test_malicious_task_creation_attempt(self):
        """Test handling of malicious task creation attempts."""
        malicious_inputs = [
            {
                "title": "<img src=x onerror=alert('xss')>",
                "description": "';DROP TABLE tasks;--",
                "tags": ["<script>", "eval()", "__proto__"]
            },
            {
                "title": "Normal",
                "labels": {"__proto__": {"isAdmin": True}}
            }
        ]

        for malicious in malicious_inputs:
            # Should sanitize but not crash
            try:
                result = secure_deserialize_mcp_param(
                    malicious, TaskInput, strict_mode=True
                )
                # If successful, check sanitization occurred
                if hasattr(result, 'title'):
                    assert "<script>" not in str(result.title)
                    assert "__proto__" not in str(result.labels) if result.labels else True
            except ValidationError:
                # Validation error is acceptable for dangerous input
                pass

    def test_error_recovery_scenarios(self):
        """Test error recovery in various scenarios."""
        # Simulate various error conditions
        error_scenarios = [
            json.JSONDecodeError("msg", "doc", 0),
            ValidationError("validation failed", model_name="Test"),
            Exception("Generic error"),
            BinderyClientError("Client error", 500, {"detail": "Internal"})
        ]

        sanitizer = ErrorSanitizer()
        for error in error_scenarios:
            result = sanitizer.sanitize_error_message(error, "test_operation")
            assert "error" in result
            assert "type" in result

    def test_performance_under_load(self):
        """Test performance with many rapid deserializations."""
        import time

        iterations = 100
        start = time.time()

        for i in range(iterations):
            input_data = {"title": f"Task {i}", "priority": "normal"}
            result = secure_deserialize_mcp_param(input_data, TaskInput)
            assert result.title == f"Task {i}"

        elapsed = time.time() - start
        avg_time = elapsed / iterations

        # Should be fast even with security checks
        assert avg_time < 0.01  # Less than 10ms per operation


class TestTaskRecursionDepthValidation:
    """Test task recursion depth validation for security."""

    def test_task_recursion_depth_valid_shallow(self):
        """Test that shallow task trees are accepted (depth 0-5)."""
        # Depth 0 - no subtasks
        shallow_task = TaskInput(title="Root Task")
        max_depth = validate_task_recursion_depth(shallow_task)
        assert max_depth == 0

        # Depth 1 - simple subtasks
        depth_1_task = TaskInput(
            title="Parent Task",
            subtasks=[
                TaskInput(title="Child 1"),
                TaskInput(title="Child 2")
            ]
        )
        max_depth = validate_task_recursion_depth(depth_1_task)
        assert max_depth == 1

        # Depth 5 - deeper but valid
        current = TaskInput(title="Level 5")
        for level in range(4, -1, -1):
            current = TaskInput(title=f"Level {level}", subtasks=[current])

        max_depth = validate_task_recursion_depth(current)
        assert max_depth == 5

    def test_task_recursion_depth_valid_at_limit(self):
        """Test that tasks at exactly the depth limit are accepted."""
        # Create task tree at exactly MAX_TASK_DEPTH (10)
        current = TaskInput(title="Level 10")
        for level in range(9, -1, -1):
            current = TaskInput(title=f"Level {level}", subtasks=[current])

        max_depth = validate_task_recursion_depth(current)
        assert max_depth == MAX_TASK_DEPTH
        assert max_depth == 10

    def test_task_recursion_depth_invalid_exceeds_limit(self):
        """Test that tasks exceeding depth limit are rejected."""
        # Create task tree at depth 11 (exceeds limit)
        current = TaskInput(title="Level 11")
        for level in range(10, -1, -1):
            current = TaskInput(title=f"Level {level}", subtasks=[current])

        with pytest.raises(ValueError, match="recursion depth exceeds maximum"):
            validate_task_recursion_depth(current)

    def test_task_recursion_depth_invalid_deeply_nested(self):
        """Test that deeply nested tasks are rejected with proper error."""
        # Create very deep task tree (depth 25)
        current = TaskInput(title="Level 25")
        for level in range(24, -1, -1):
            current = TaskInput(title=f"Level {level}", subtasks=[current])

        with pytest.raises(ValueError) as exc_info:
            validate_task_recursion_depth(current)

        error_msg = str(exc_info.value)
        assert "recursion depth exceeds maximum" in error_msg
        assert "Found depth: 11" in error_msg  # Should stop at first violation
        assert str(MAX_TASK_DEPTH) in error_msg

    def test_task_recursion_wide_tree(self):
        """Test wide trees with many subtasks at each level."""
        # Create wide tree: 10 subtasks at each level for 3 levels
        # Root (depth 0) -> Level 1 (depth 1) -> Level 2 (depth 2)
        level_2_tasks = [TaskInput(title=f"Level 2 Task {i}") for i in range(10)]
        level_1_tasks = [TaskInput(title=f"Level 1 Task {i}", subtasks=level_2_tasks) for i in range(10)]
        root_task = TaskInput(title="Root", subtasks=level_1_tasks)

        max_depth = validate_task_recursion_depth(root_task)
        assert max_depth == 2

    def test_task_recursion_mixed_depths(self):
        """Test trees where different branches have different depths."""
        # Create mixed depth tree
        shallow_branch = TaskInput(title="Shallow")  # Depth 1 from root
        medium_branch = TaskInput(
            title="Medium",
            subtasks=[TaskInput(title="Medium Child")]  # Depth 2 from root
        )

        # Create deep branch: Root -> Deep Level 1 -> Deep Level 2 -> ... -> Deep Level 7
        deep_branch = TaskInput(title="Deep Level 7")
        for level in range(6, 0, -1):  # Build from level 6 down to 1
            deep_branch = TaskInput(title=f"Deep Level {level}", subtasks=[deep_branch])

        root_task = TaskInput(
            title="Root",
            subtasks=[shallow_branch, medium_branch, deep_branch]
        )

        max_depth = validate_task_recursion_depth(root_task)
        assert max_depth == 7  # Should find the deepest branch

    def test_task_recursion_empty_subtasks(self):
        """Test handling of empty subtask lists."""
        task_with_empty_subtasks = TaskInput(title="Task", subtasks=[])
        max_depth = validate_task_recursion_depth(task_with_empty_subtasks)
        assert max_depth == 0

    def test_task_recursion_none_subtasks(self):
        """Test handling of None subtasks."""
        task_with_none_subtasks = TaskInput(title="Task", subtasks=None)
        max_depth = validate_task_recursion_depth(task_with_none_subtasks)
        assert max_depth == 0

    def test_task_recursion_performance_large_wide_tree(self):
        """Test performance with reasonably large task trees."""
        import time

        # Create large wide tree: 50 subtasks at level 1, 20 at level 2
        level_2_tasks = [TaskInput(title=f"Level 2 Task {i}") for i in range(20)]
        level_1_tasks = [TaskInput(title=f"Level 1 Task {i}", subtasks=level_2_tasks) for i in range(50)]
        root_task = TaskInput(title="Root", subtasks=level_1_tasks)

        start_time = time.time()
        max_depth = validate_task_recursion_depth(root_task)
        elapsed = time.time() - start_time

        assert max_depth == 2
        assert elapsed < 1.0  # Should complete within 1 second

    def test_mcp_integration_depth_validation_valid(self):
        """Test depth validation through secure deserialization (valid case)."""
        # Test valid depth task through the same path as MCP
        valid_task_dict = {
            "title": "Valid Task",
            "subtasks": [
                {"title": "Subtask 1"},
                {"title": "Subtask 2"}
            ]
        }

        # This should succeed (same path as MCP server)
        task = secure_deserialize_mcp_param(valid_task_dict, TaskInput)
        max_depth = validate_task_recursion_depth(task)
        assert max_depth == 1  # Root + 1 level of subtasks

    def test_mcp_integration_depth_validation_invalid(self):
        """Test depth validation through secure deserialization (invalid case)."""
        # Since JSON validation limits depth to 10, we need to test at the edge
        # Create task that is valid for JSON but invalid for task depth
        # JSON depth counts all nesting, task depth counts only task nesting

        # Create task with bypass of strict JSON validation
        invalid_task_dict = {"title": "Root"}
        current = invalid_task_dict
        for level in range(11):  # Create depth 11 task (exceeds task limit)
            current["subtasks"] = [{"title": f"Level {level + 1}"}]
            current = current["subtasks"][0]

        # Test with strict_mode=False to bypass JSON depth validation
        # This focuses specifically on task recursion depth validation
        task = secure_deserialize_mcp_param(invalid_task_dict, TaskInput, strict_mode=False)
        with pytest.raises(ValueError, match="recursion depth exceeds maximum"):
            validate_task_recursion_depth(task)

    def test_malicious_depth_attack(self):
        """Test handling of malicious depth attack attempts."""
        # Simulate extremely deep nesting attack
        malicious_task = TaskInput(title="Malicious")
        current = malicious_task

        # Create very deep nesting (depth 100)
        for level in range(100):
            subtask = TaskInput(title=f"Attack Level {level}")
            current.subtasks = [subtask]
            current = subtask

        # Should fail fast and not consume excessive resources
        import time
        start_time = time.time()

        with pytest.raises(ValueError, match="recursion depth exceeds maximum"):
            validate_task_recursion_depth(malicious_task)

        elapsed = time.time() - start_time
        # Should fail quickly (within 100ms) due to early termination
        assert elapsed < 0.1

    def test_recursion_depth_boundary_conditions(self):
        """Test boundary conditions around the depth limit."""
        # Test exactly at limit (depth 10)
        at_limit_task = TaskInput(title="Level 0")
        current = at_limit_task
        for level in range(1, 11):
            subtask = TaskInput(title=f"Level {level}")
            current.subtasks = [subtask]
            current = subtask

        max_depth = validate_task_recursion_depth(at_limit_task)
        assert max_depth == 10

        # Test one over limit (depth 11)
        over_limit_task = TaskInput(title="Level 0")
        current = over_limit_task
        for level in range(1, 12):
            subtask = TaskInput(title=f"Level {level}")
            current.subtasks = [subtask]
            current = subtask

        with pytest.raises(ValueError, match="Found depth: 11"):
            validate_task_recursion_depth(over_limit_task)

    def test_partial_failure_handling(self):
        """Test handling when some subtasks are invalid."""
        # Create task with mix of valid and invalid subtasks
        valid_subtask = TaskInput(title="Valid")

        # Create invalid subtask (too deep)
        invalid_subtask = TaskInput(title="Invalid Root")
        current = invalid_subtask
        for level in range(15):  # Deep enough to exceed limit
            subtask = TaskInput(title=f"Invalid Level {level}")
            current.subtasks = [subtask]
            current = subtask

        mixed_task = TaskInput(
            title="Mixed",
            subtasks=[valid_subtask, invalid_subtask]
        )

        # Should fail because one subtask is invalid
        with pytest.raises(ValueError, match="recursion depth exceeds maximum"):
            validate_task_recursion_depth(mixed_task)

    def test_error_message_includes_depth_info(self):
        """Test that error messages include useful depth information."""
        # Create task that exceeds depth limit
        deep_task = TaskInput(title="Level 0")
        current = deep_task
        for level in range(1, 15):  # Go to depth 15
            subtask = TaskInput(title=f"Level {level}")
            current.subtasks = [subtask]
            current = subtask

        with pytest.raises(ValueError) as exc_info:
            validate_task_recursion_depth(deep_task)

        error_msg = str(exc_info.value)
        # Should include specific depth information
        assert "Found depth: 11" in error_msg  # First violation
        assert f"maximum allowed depth of {MAX_TASK_DEPTH}" in error_msg
        assert "recursion depth exceeds maximum" in error_msg


# Run tests if executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])