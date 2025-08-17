"""
Comprehensive Infrastructure Layer Tests - MCP Tools

Tests for all MCP (Model Context Protocol) tool implementations focusing on
protocol compliance, error handling, and integration with the orchestration system.
"""

import pytest
import json
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from unittest.mock import Mock, AsyncMock, patch, MagicMock

from vespera_scriptorium.infrastructure.mcp.tool_definitions import (
    get_all_tool_definitions,
    validate_tool_definition,
    create_tool_response
)
from vespera_scriptorium.infrastructure.mcp.handlers.core_handlers import (
    MCPHandler,
    TaskOrchestrationHandler,
    ProgressTrackingHandler,
    TemplateSystemHandler
)
from vespera_scriptorium.infrastructure.mcp.handlers.task_handlers import (
    TaskCreationHandler,
    TaskExecutionHandler,
    TaskCompletionHandler,
    TaskQueryHandler
)
from vespera_scriptorium.infrastructure.mcp.protocol_adapters import (
    MCPProtocolAdapter,
    RequestValidator,
    ResponseFormatter
)
from vespera_scriptorium.infrastructure.mcp.error_handling import (
    MCPErrorHandler,
    ErrorCode,
    create_error_response
)
from vespera_scriptorium.infrastructure.mcp.server import MCPServer

from vespera_scriptorium.domain.entities.task import Task, TaskStatus, TaskType
from vespera_scriptorium.domain.value_objects.complexity_level import ComplexityLevel


@pytest.mark.infrastructure
@pytest.mark.unit
@pytest.mark.mcp_protocol
class TestMCPToolDefinitions:
    """Test MCP tool definition system."""

    def test_get_all_tool_definitions(self):
        """Test retrieving all tool definitions."""
        tools = get_all_tool_definitions()
        
        assert isinstance(tools, list)
        assert len(tools) > 0
        
        # Check required orchestrator tools are present
        tool_names = [tool["name"] for tool in tools]
        required_tools = [
            "orchestrator_initialize_session",
            "orchestrator_plan_task",
            "orchestrator_execute_task",
            "orchestrator_complete_task",
            "orchestrator_get_status"
        ]
        
        for required_tool in required_tools:
            assert required_tool in tool_names

    def test_tool_definition_structure(self):
        """Test tool definition structure compliance."""
        tools = get_all_tool_definitions()
        
        for tool in tools:
            # Each tool must have required fields
            assert "name" in tool
            assert "description" in tool
            assert "inputSchema" in tool
            
            # Name should be valid identifier
            assert isinstance(tool["name"], str)
            assert len(tool["name"]) > 0
            assert tool["name"].replace("_", "").replace("-", "").isalnum()
            
            # Description should be meaningful
            assert isinstance(tool["description"], str)
            assert len(tool["description"]) > 10
            
            # Input schema should be valid JSON schema
            schema = tool["inputSchema"]
            assert isinstance(schema, dict)
            assert "type" in schema
            assert schema["type"] == "object"

    def test_validate_tool_definition(self):
        """Test tool definition validation."""
        # Valid tool definition
        valid_tool = {
            "name": "test_tool",
            "description": "A test tool for validation",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "param1": {"type": "string", "description": "First parameter"}
                },
                "required": ["param1"]
            }
        }
        
        assert validate_tool_definition(valid_tool) is True
        
        # Invalid tool definition - missing name
        invalid_tool = {
            "description": "Missing name",
            "inputSchema": {"type": "object"}
        }
        
        assert validate_tool_definition(invalid_tool) is False

    def test_create_tool_response(self):
        """Test tool response creation."""
        # Success response
        success_response = create_tool_response(
            success=True,
            data={"result": "success", "task_id": "test_001"},
            tool_name="test_tool"
        )
        
        assert success_response["success"] is True
        assert success_response["data"]["result"] == "success"
        assert success_response["metadata"]["tool_name"] == "test_tool"
        
        # Error response
        error_response = create_tool_response(
            success=False,
            error="Tool execution failed",
            error_code="TOOL_001",
            tool_name="test_tool"
        )
        
        assert error_response["success"] is False
        assert error_response["error"] == "Tool execution failed"
        assert error_response["error_code"] == "TOOL_001"


@pytest.mark.infrastructure
@pytest.mark.unit
@pytest.mark.mcp_protocol
class TestTaskOrchestrationHandler:
    """Test TaskOrchestrationHandler MCP implementation."""

    @pytest.fixture
    def mock_orchestration_service(self):
        """Create mock orchestration service."""
        return AsyncMock()

    @pytest.fixture
    def orchestration_handler(self, mock_orchestration_service):
        """Create TaskOrchestrationHandler with mocked dependencies."""
        return TaskOrchestrationHandler(
            orchestration_service=mock_orchestration_service
        )

    async def test_initialize_session(self, orchestration_handler, mock_orchestration_service):
        """Test session initialization through MCP."""
        request_data = {
            "working_directory": "/test/workspace",
            "session_metadata": {"user": "test_user", "project": "test_project"}
        }
        
        mock_orchestration_service.initialize_session.return_value = {
            "session_id": "session_001",
            "status": "initialized",
            "workspace_ready": True
        }
        
        response = await orchestration_handler.handle_initialize_session(request_data)
        
        assert response["success"] is True
        assert response["session_id"] == "session_001"
        assert response["workspace_ready"] is True
        
        mock_orchestration_service.initialize_session.assert_called_once_with(
            working_directory="/test/workspace",
            metadata=request_data["session_metadata"]
        )

    async def test_plan_task(self, orchestration_handler, mock_orchestration_service):
        """Test task planning through MCP."""
        request_data = {
            "title": "Test Task",
            "description": "A test task for MCP",
            "complexity": "moderate",
            "specialist_type": "coder"
        }
        
        mock_orchestration_service.plan_task.return_value = {
            "task_id": "planned_task_001",
            "status": "planned",
            "estimated_effort": "2 hours"
        }
        
        response = await orchestration_handler.handle_plan_task(request_data)
        
        assert response["success"] is True
        assert response["task_id"] == "planned_task_001"
        assert response["status"] == "planned"

    async def test_execute_task(self, orchestration_handler, mock_orchestration_service):
        """Test task execution through MCP."""
        request_data = {
            "task_id": "execute_test_001"
        }
        
        mock_orchestration_service.execute_task.return_value = {
            "task_id": "execute_test_001",
            "execution_status": "running",
            "assigned_specialist": "coder",
            "estimated_completion": "2024-12-31T23:59:59Z"
        }
        
        response = await orchestration_handler.handle_execute_task(request_data)
        
        assert response["success"] is True
        assert response["task_id"] == "execute_test_001"
        assert response["execution_status"] == "running"

    async def test_complete_task(self, orchestration_handler, mock_orchestration_service):
        """Test task completion through MCP."""
        request_data = {
            "task_id": "complete_test_001",
            "summary": "Task completed successfully",
            "detailed_work": "Implemented feature X with comprehensive tests",
            "next_action": "complete"
        }
        
        mock_orchestration_service.complete_task.return_value = {
            "task_id": "complete_test_001",
            "status": "completed",
            "artifacts_created": 3,
            "completion_timestamp": "2024-12-31T23:59:59Z"
        }
        
        response = await orchestration_handler.handle_complete_task(request_data)
        
        assert response["success"] is True
        assert response["task_id"] == "complete_test_001"
        assert response["status"] == "completed"

    async def test_get_status(self, orchestration_handler, mock_orchestration_service):
        """Test status retrieval through MCP."""
        mock_orchestration_service.get_status.return_value = {
            "active_tasks": 3,
            "completed_tasks": 7,
            "failed_tasks": 1,
            "system_health": "healthy",
            "session_info": {
                "session_id": "session_001",
                "uptime": "2 hours 15 minutes"
            }
        }
        
        response = await orchestration_handler.handle_get_status({})
        
        assert response["success"] is True
        assert response["active_tasks"] == 3
        assert response["system_health"] == "healthy"

    async def test_error_handling(self, orchestration_handler, mock_orchestration_service):
        """Test error handling in MCP tools."""
        request_data = {"task_id": "invalid_task"}
        
        mock_orchestration_service.execute_task.side_effect = Exception("Task not found")
        
        response = await orchestration_handler.handle_execute_task(request_data)
        
        assert response["success"] is False
        assert "error" in response
        assert "Task not found" in response["error"]


@pytest.mark.infrastructure
@pytest.mark.unit
@pytest.mark.mcp_protocol
class TestProgressTrackingHandler:
    """Test ProgressTrackingHandler MCP implementation."""

    @pytest.fixture
    def mock_progress_service(self):
        """Create mock progress service."""
        return AsyncMock()

    @pytest.fixture
    def progress_handler(self, mock_progress_service):
        """Create ProgressTrackingHandler with mocked dependencies."""
        return ProgressTrackingHandler(progress_service=mock_progress_service)

    async def test_start_tracking(self, progress_handler, mock_progress_service):
        """Test starting progress tracking through MCP."""
        request_data = {
            "task_id": "track_test_001",
            "milestones": [25, 50, 75, 100]
        }
        
        mock_progress_service.start_tracking.return_value = {
            "task_id": "track_test_001",
            "tracking_active": True,
            "initial_progress": 0
        }
        
        response = await progress_handler.handle_start_tracking(request_data)
        
        assert response["success"] is True
        assert response["task_id"] == "track_test_001"
        assert response["tracking_active"] is True

    async def test_update_progress(self, progress_handler, mock_progress_service):
        """Test updating progress through MCP."""
        request_data = {
            "task_id": "progress_test_001",
            "progress": 65,
            "message": "Making good progress"
        }
        
        mock_progress_service.update_progress.return_value = {
            "task_id": "progress_test_001",
            "current_progress": 65,
            "milestone_reached": True,
            "last_milestone": 50
        }
        
        response = await progress_handler.handle_update_progress(request_data)
        
        assert response["success"] is True
        assert response["current_progress"] == 65
        assert response["milestone_reached"] is True

    async def test_get_progress(self, progress_handler, mock_progress_service):
        """Test getting progress information through MCP."""
        request_data = {"task_id": "progress_query_001"}
        
        mock_progress_service.get_progress.return_value = {
            "task_id": "progress_query_001",
            "current_progress": 45,
            "status_message": "Halfway through implementation",
            "milestones_achieved": [25],
            "next_milestone": 50,
            "estimated_completion": "2024-12-31T18:00:00Z"
        }
        
        response = await progress_handler.handle_get_progress(request_data)
        
        assert response["success"] is True
        assert response["current_progress"] == 45
        assert response["next_milestone"] == 50


@pytest.mark.infrastructure
@pytest.mark.unit
@pytest.mark.mcp_protocol
class TestTemplateSystemHandler:
    """Test TemplateSystemHandler MCP implementation."""

    @pytest.fixture
    def mock_template_service(self):
        """Create mock template service."""
        return AsyncMock()

    @pytest.fixture
    def template_handler(self, mock_template_service):
        """Create TemplateSystemHandler with mocked dependencies."""
        return TemplateSystemHandler(template_service=mock_template_service)

    async def test_list_templates(self, template_handler, mock_template_service):
        """Test listing available templates through MCP."""
        mock_template_service.list_templates.return_value = [
            {
                "template_id": "dev_workflow",
                "name": "Development Workflow",
                "category": "development",
                "description": "Standard development workflow template"
            },
            {
                "template_id": "research_project", 
                "name": "Research Project",
                "category": "research",
                "description": "Research project template"
            }
        ]
        
        response = await template_handler.handle_list_templates({})
        
        assert response["success"] is True
        assert len(response["templates"]) == 2
        assert response["templates"][0]["template_id"] == "dev_workflow"

    async def test_instantiate_template(self, template_handler, mock_template_service):
        """Test template instantiation through MCP."""
        request_data = {
            "template_id": "dev_workflow",
            "parameters": {
                "project_name": "Test Project",
                "language": "Python",
                "complexity": "moderate"
            }
        }
        
        mock_template_service.instantiate_template.return_value = {
            "parent_task_id": "project_root_001",
            "created_tasks": [
                {"task_id": "setup_001", "title": "Project Setup"},
                {"task_id": "implement_001", "title": "Implementation"},
                {"task_id": "test_001", "title": "Testing"}
            ],
            "task_count": 3
        }
        
        response = await template_handler.handle_instantiate_template(request_data)
        
        assert response["success"] is True
        assert response["parent_task_id"] == "project_root_001"
        assert response["task_count"] == 3

    async def test_validate_template(self, template_handler, mock_template_service):
        """Test template validation through MCP."""
        request_data = {
            "template_content": json.dumps({
                "template_id": "test_template",
                "tasks": {
                    "main_task": {
                        "title": "{{title}}",
                        "description": "{{description}}"
                    }
                }
            })
        }
        
        mock_template_service.validate_template.return_value = {
            "valid": True,
            "errors": [],
            "warnings": [],
            "parameter_count": 2
        }
        
        response = await template_handler.handle_validate_template(request_data)
        
        assert response["success"] is True
        assert response["valid"] is True
        assert response["parameter_count"] == 2


@pytest.mark.infrastructure
@pytest.mark.unit
@pytest.mark.mcp_protocol
class TestMCPProtocolAdapter:
    """Test MCP protocol adapter implementation."""

    @pytest.fixture
    def protocol_adapter(self):
        """Create MCPProtocolAdapter instance."""
        return MCPProtocolAdapter()

    def test_request_validation(self, protocol_adapter):
        """Test MCP request validation."""
        # Valid request
        valid_request = {
            "method": "tools/call",
            "params": {
                "name": "orchestrator_plan_task",
                "arguments": {
                    "title": "Test Task",
                    "description": "Test description"
                }
            }
        }
        
        validation_result = protocol_adapter.validate_request(valid_request)
        assert validation_result["valid"] is True
        
        # Invalid request - missing method
        invalid_request = {
            "params": {
                "name": "orchestrator_plan_task",
                "arguments": {}
            }
        }
        
        validation_result = protocol_adapter.validate_request(invalid_request)
        assert validation_result["valid"] is False
        assert "method" in validation_result["errors"][0]

    def test_response_formatting(self, protocol_adapter):
        """Test MCP response formatting."""
        # Success response
        success_data = {
            "task_id": "test_001",
            "status": "created"
        }
        
        formatted_response = protocol_adapter.format_response(
            success=True,
            data=success_data,
            request_id="req_001"
        )
        
        assert formatted_response["id"] == "req_001"
        assert formatted_response["result"] == success_data
        assert "error" not in formatted_response
        
        # Error response
        formatted_error = protocol_adapter.format_response(
            success=False,
            error="Tool execution failed",
            error_code=-1,
            request_id="req_002"
        )
        
        assert formatted_error["id"] == "req_002"
        assert formatted_error["error"]["message"] == "Tool execution failed"
        assert formatted_error["error"]["code"] == -1

    def test_tool_call_parsing(self, protocol_adapter):
        """Test parsing tool calls from MCP requests."""
        request = {
            "method": "tools/call",
            "params": {
                "name": "orchestrator_execute_task",
                "arguments": {
                    "task_id": "execute_001"
                }
            },
            "id": "call_001"
        }
        
        parsed_call = protocol_adapter.parse_tool_call(request)
        
        assert parsed_call["tool_name"] == "orchestrator_execute_task"
        assert parsed_call["arguments"]["task_id"] == "execute_001"
        assert parsed_call["request_id"] == "call_001"

    def test_protocol_version_compatibility(self, protocol_adapter):
        """Test MCP protocol version compatibility."""
        # Test different protocol versions
        v1_request = {
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {"name": "test_tool", "arguments": {}},
            "id": 1
        }
        
        compatibility = protocol_adapter.check_version_compatibility(v1_request)
        assert compatibility["compatible"] is True
        
        # Test unsupported version
        unsupported_request = {
            "jsonrpc": "3.0",  # Future version
            "method": "tools/call",
            "params": {"name": "test_tool", "arguments": {}},
            "id": 1
        }
        
        compatibility = protocol_adapter.check_version_compatibility(unsupported_request)
        assert compatibility["compatible"] is False


@pytest.mark.infrastructure
@pytest.mark.unit
@pytest.mark.mcp_protocol
class TestMCPErrorHandling:
    """Test MCP error handling implementation."""

    @pytest.fixture
    def error_handler(self):
        """Create MCPErrorHandler instance."""
        return MCPErrorHandler()

    def test_create_error_response(self, error_handler):
        """Test creating standardized error responses."""
        error_response = error_handler.create_error_response(
            error_code=ErrorCode.TOOL_NOT_FOUND,
            message="Tool 'invalid_tool' not found",
            details={"requested_tool": "invalid_tool"},
            request_id="req_001"
        )
        
        assert error_response["id"] == "req_001"
        assert error_response["error"]["code"] == ErrorCode.TOOL_NOT_FOUND.value
        assert error_response["error"]["message"] == "Tool 'invalid_tool' not found"
        assert error_response["error"]["data"]["requested_tool"] == "invalid_tool"

    def test_handle_validation_error(self, error_handler):
        """Test handling validation errors."""
        validation_errors = [
            {"field": "title", "message": "Title is required"},
            {"field": "description", "message": "Description too long"}
        ]
        
        error_response = error_handler.handle_validation_error(
            validation_errors,
            request_id="validation_001"
        )
        
        assert error_response["error"]["code"] == ErrorCode.INVALID_PARAMS.value
        assert len(error_response["error"]["data"]["validation_errors"]) == 2

    def test_handle_internal_error(self, error_handler):
        """Test handling internal server errors."""
        try:
            raise Exception("Database connection failed")
        except Exception as e:
            error_response = error_handler.handle_internal_error(
                e,
                request_id="internal_001"
            )
        
        assert error_response["error"]["code"] == ErrorCode.INTERNAL_ERROR.value
        assert "Database connection failed" in error_response["error"]["message"]

    def test_sanitize_error_details(self, error_handler):
        """Test sanitizing error details for security."""
        sensitive_error = {
            "database_password": "secret123",
            "api_key": "key_456",
            "user_message": "Safe message",
            "file_path": "/safe/path/file.txt"
        }
        
        sanitized = error_handler.sanitize_error_details(sensitive_error)
        
        assert "database_password" not in sanitized
        assert "api_key" not in sanitized
        assert sanitized["user_message"] == "Safe message"
        assert sanitized["file_path"] == "/safe/path/file.txt"


@pytest.mark.infrastructure
@pytest.mark.integration
@pytest.mark.mcp_protocol
class TestMCPServerIntegration:
    """Integration tests for MCP server implementation."""

    @pytest.fixture
    async def mcp_server(self):
        """Create MCP server for integration testing."""
        server = MCPServer(
            name="test_server",
            version="1.0.0"
        )
        await server.initialize()
        return server

    async def test_full_tool_execution_workflow(self, mcp_server):
        """Test complete tool execution workflow."""
        # 1. Initialize session
        init_request = {
            "method": "tools/call",
            "params": {
                "name": "orchestrator_initialize_session",
                "arguments": {"working_directory": "/test"}
            },
            "id": "init_001"
        }
        
        init_response = await mcp_server.handle_request(init_request)
        assert init_response["result"]["success"] is True
        session_id = init_response["result"]["session_id"]
        
        # 2. Plan task
        plan_request = {
            "method": "tools/call",
            "params": {
                "name": "orchestrator_plan_task",
                "arguments": {
                    "title": "Integration Test Task",
                    "description": "A task for integration testing"
                }
            },
            "id": "plan_001"
        }
        
        plan_response = await mcp_server.handle_request(plan_request)
        assert plan_response["result"]["success"] is True
        task_id = plan_response["result"]["task_id"]
        
        # 3. Execute task
        execute_request = {
            "method": "tools/call",
            "params": {
                "name": "orchestrator_execute_task",
                "arguments": {"task_id": task_id}
            },
            "id": "execute_001"
        }
        
        execute_response = await mcp_server.handle_request(execute_request)
        assert execute_response["result"]["success"] is True
        
        # 4. Complete task
        complete_request = {
            "method": "tools/call",
            "params": {
                "name": "orchestrator_complete_task",
                "arguments": {
                    "task_id": task_id,
                    "summary": "Task completed",
                    "detailed_work": "Integration test completed successfully",
                    "next_action": "complete"
                }
            },
            "id": "complete_001"
        }
        
        complete_response = await mcp_server.handle_request(complete_request)
        assert complete_response["result"]["success"] is True

    async def test_error_propagation(self, mcp_server):
        """Test error propagation through MCP layer."""
        # Test invalid tool call
        invalid_request = {
            "method": "tools/call",
            "params": {
                "name": "nonexistent_tool",
                "arguments": {}
            },
            "id": "error_001"
        }
        
        error_response = await mcp_server.handle_request(invalid_request)
        assert "error" in error_response
        assert error_response["error"]["code"] == ErrorCode.TOOL_NOT_FOUND.value

    async def test_concurrent_tool_execution(self, mcp_server):
        """Test concurrent tool execution handling."""
        # Create multiple concurrent requests
        requests = [
            {
                "method": "tools/call",
                "params": {
                    "name": "orchestrator_get_status",
                    "arguments": {}
                },
                "id": f"concurrent_{i}"
            }
            for i in range(5)
        ]
        
        # Execute concurrently
        import asyncio
        responses = await asyncio.gather(
            *[mcp_server.handle_request(req) for req in requests],
            return_exceptions=True
        )
        
        # All should succeed
        successful_responses = [r for r in responses if not isinstance(r, Exception)]
        assert len(successful_responses) == 5

    async def test_protocol_compliance(self, mcp_server):
        """Test MCP protocol compliance."""
        # Test capabilities
        capabilities_request = {
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {}
            },
            "id": "init"
        }
        
        capabilities_response = await mcp_server.handle_request(capabilities_request)
        assert "result" in capabilities_response
        assert "capabilities" in capabilities_response["result"]
        
        # Test tool listing
        tools_request = {
            "method": "tools/list",
            "params": {},
            "id": "tools_list"
        }
        
        tools_response = await mcp_server.handle_request(tools_request)
        assert "result" in tools_response
        assert "tools" in tools_response["result"]
        assert len(tools_response["result"]["tools"]) > 0