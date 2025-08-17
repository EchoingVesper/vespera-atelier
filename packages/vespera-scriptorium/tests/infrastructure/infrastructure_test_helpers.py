"""
Infrastructure Layer Test Helpers

Provides specialized testing utilities for repositories, external integrations,
MCP protocol compliance, and infrastructure service testing.
"""

import asyncio
import json
import sqlite3
import tempfile
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Type, TypeVar, Union
from unittest.mock import AsyncMock, MagicMock, patch

from vespera_scriptorium.infrastructure.database.connection_manager import DatabaseConnectionManager
from vespera_scriptorium.infrastructure.mcp.protocol_adapters import MCPProtocolAdapter
from vespera_scriptorium.infrastructure.error_handling.decorators import retry_on_failure
from vespera_scriptorium.infrastructure.di.container import ServiceContainer

T = TypeVar("T")


class DatabaseTestHelper:
    """Helper for database testing with isolation and cleanup."""
    
    def __init__(self):
        self._test_databases = []
        self._connections = []
    
    def create_test_database(self, schema_sql: Optional[str] = None) -> str:
        """Create in-memory test database."""
        db_path = ":memory:"
        
        if schema_sql:
            conn = sqlite3.connect(db_path)
            conn.executescript(schema_sql)
            conn.close()
        
        self._test_databases.append(db_path)
        return db_path
    
    def create_temp_file_database(self, schema_sql: Optional[str] = None) -> str:
        """Create temporary file database for persistent testing."""
        temp_file = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        db_path = temp_file.name
        temp_file.close()
        
        if schema_sql:
            conn = sqlite3.connect(db_path)
            conn.executescript(schema_sql)
            conn.close()
        
        self._test_databases.append(db_path)
        return db_path
    
    @asynccontextmanager
    async def database_transaction(self, db_path: str):
        """Context manager for database transaction testing."""
        conn = sqlite3.connect(db_path)
        self._connections.append(conn)
        
        try:
            conn.execute("BEGIN")
            yield conn
            # Auto-rollback for test isolation
            conn.execute("ROLLBACK")
        except Exception:
            conn.execute("ROLLBACK")
            raise
        finally:
            conn.close()
            if conn in self._connections:
                self._connections.remove(conn)
    
    def populate_test_data(self, db_path: str, test_data: Dict[str, List[Dict]]):
        """Populate test database with test data."""
        conn = sqlite3.connect(db_path)
        try:
            for table_name, rows in test_data.items():
                for row in rows:
                    columns = ', '.join(row.keys())
                    placeholders = ', '.join(['?' for _ in row.keys()])
                    sql = f"INSERT INTO {table_name} ({columns}) VALUES ({placeholders})"
                    conn.execute(sql, list(row.values()))
            conn.commit()
        finally:
            conn.close()
    
    def cleanup(self):
        """Clean up test databases and connections."""
        for conn in self._connections:
            try:
                conn.close()
            except:
                pass
        
        for db_path in self._test_databases:
            if db_path != ":memory:" and Path(db_path).exists():
                try:
                    Path(db_path).unlink()
                except:
                    pass
        
        self._test_databases.clear()
        self._connections.clear()


class RepositoryTestHelper:
    """Helper for testing repository implementations."""
    
    def __init__(self, db_helper: DatabaseTestHelper):
        self.db_helper = db_helper
    
    async def test_repository_crud_operations(
        self, 
        repository_factory: callable,
        entity_factory: callable,
        db_path: str
    ):
        """Test basic CRUD operations for repository."""
        repository = repository_factory(db_path)
        
        # Test Create/Save
        entity = entity_factory()
        save_result = await repository.save(entity)
        assert save_result, "Save operation should succeed"
        
        # Test Read
        retrieved = await repository.get_by_id(entity.id)
        assert retrieved is not None, "Entity should be retrievable after save"
        assert retrieved.id == entity.id, "Retrieved entity should have same ID"
        
        # Test Update
        entity.updated_at = datetime.now()
        update_result = await repository.save(entity)
        assert update_result, "Update operation should succeed"
        
        updated = await repository.get_by_id(entity.id)
        assert updated.updated_at == entity.updated_at, "Update should be persisted"
        
        # Test Delete
        delete_result = await repository.delete(entity.id)
        assert delete_result, "Delete operation should succeed"
        
        deleted_check = await repository.get_by_id(entity.id)
        assert deleted_check is None, "Entity should be deleted"
    
    async def test_repository_query_operations(
        self,
        repository_factory: callable,
        entity_factory: callable,
        db_path: str,
        test_entities_count: int = 5
    ):
        """Test query operations for repository."""
        repository = repository_factory(db_path)
        
        # Create multiple test entities
        entities = []
        for i in range(test_entities_count):
            entity = entity_factory(id=f"test_entity_{i}")
            await repository.save(entity)
            entities.append(entity)
        
        # Test find_all
        all_entities = await repository.find_all()
        assert len(all_entities) >= test_entities_count, "Should retrieve all saved entities"
        
        # Test find_by_criteria (if implemented)
        if hasattr(repository, 'find_by_criteria'):
            criteria = {"status": "active"}  # Example criteria
            filtered = await repository.find_by_criteria(criteria)
            assert isinstance(filtered, list), "Query should return list"
        
        # Test count
        if hasattr(repository, 'count'):
            count = await repository.count()
            assert count >= test_entities_count, "Count should match saved entities"
        
        # Test exists
        if hasattr(repository, 'exists'):
            exists = await repository.exists(entities[0].id)
            assert exists, "Should confirm entity exists"
            
            not_exists = await repository.exists("non_existent_id")
            assert not not_exists, "Should confirm non-existent entity does not exist"


class MCPProtocolTestHelper:
    """Helper for testing MCP protocol compliance."""
    
    def __init__(self):
        self._protocol_messages = []
    
    def create_mock_mcp_server(self) -> AsyncMock:
        """Create mock MCP server for testing."""
        mock_server = AsyncMock()
        
        # Standard MCP methods
        mock_server.list_tools.return_value = []
        mock_server.call_tool.return_value = [{"type": "text", "text": "Success"}]
        mock_server.initialize.return_value = {"capabilities": {}}
        
        return mock_server
    
    def create_test_tool_definition(self, tool_name: str) -> Dict[str, Any]:
        """Create test MCP tool definition."""
        return {
            "name": tool_name,
            "description": f"Test tool: {tool_name}",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "input": {"type": "string", "description": "Test input"}
                },
                "required": ["input"]
            }
        }
    
    def validate_tool_response(self, response: List[Dict[str, Any]]) -> bool:
        """Validate MCP tool response format."""
        if not isinstance(response, list):
            return False
        
        for item in response:
            if not isinstance(item, dict):
                return False
            if "type" not in item:
                return False
            if item["type"] not in ["text", "image", "resource"]:
                return False
            
            # Validate content based on type
            if item["type"] == "text" and "text" not in item:
                return False
        
        return True
    
    async def test_tool_execution(
        self,
        tool_handler: callable,
        tool_name: str,
        test_arguments: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Test MCP tool execution."""
        start_time = datetime.now()
        
        try:
            result = await tool_handler(tool_name, test_arguments)
            execution_time = (datetime.now() - start_time).total_seconds()
            
            # Validate response format
            is_valid = self.validate_tool_response(result)
            
            return {
                "success": True,
                "result": result,
                "execution_time": execution_time,
                "valid_format": is_valid
            }
        
        except Exception as e:
            execution_time = (datetime.now() - start_time).total_seconds()
            return {
                "success": False,
                "error": str(e),
                "execution_time": execution_time,
                "valid_format": False
            }
    
    def assert_mcp_compliance(self, tool_definitions: List[Dict[str, Any]]):
        """Assert MCP protocol compliance for tool definitions."""
        for tool_def in tool_definitions:
            assert "name" in tool_def, "Tool must have name"
            assert "description" in tool_def, "Tool must have description"
            assert "inputSchema" in tool_def, "Tool must have input schema"
            
            schema = tool_def["inputSchema"]
            assert "type" in schema, "Input schema must have type"
            assert "properties" in schema, "Input schema must have properties"


class ExternalServiceTestHelper:
    """Helper for testing external service integrations."""
    
    def __init__(self):
        self._mock_responses = {}
        self._call_history = []
    
    def setup_mock_responses(self, service_name: str, responses: Dict[str, Any]):
        """Setup mock responses for external service."""
        self._mock_responses[service_name] = responses
    
    def create_external_service_mock(self, service_name: str) -> AsyncMock:
        """Create mock for external service."""
        mock = AsyncMock()
        
        # Setup responses if configured
        if service_name in self._mock_responses:
            responses = self._mock_responses[service_name]
            for method_name, response in responses.items():
                if asyncio.iscoroutinefunction(getattr(mock, method_name, None)):
                    getattr(mock, method_name).return_value = response
                else:
                    setattr(mock, method_name, MagicMock(return_value=response))
        
        # Track method calls
        def track_call(method_name, args, kwargs):
            self._call_history.append({
                "service": service_name,
                "method": method_name,
                "args": args,
                "kwargs": kwargs,
                "timestamp": datetime.now()
            })
        
        mock.side_effect = track_call
        return mock
    
    def get_call_history(self, service_name: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get call history for service(s)."""
        if service_name:
            return [call for call in self._call_history if call["service"] == service_name]
        return self._call_history.copy()
    
    def assert_external_call_made(self, service_name: str, method_name: str):
        """Assert external service call was made."""
        calls = self.get_call_history(service_name)
        method_calls = [call for call in calls if call["method"] == method_name]
        assert len(method_calls) > 0, f"Expected call to {service_name}.{method_name} not found"
    
    @asynccontextmanager
    async def mock_external_service(self, service_type: Type, mock_behavior: Dict[str, Any]):
        """Context manager for mocking external service."""
        with patch.object(service_type, 'create_instance') as mock_factory:
            mock_instance = self.create_external_service_mock(service_type.__name__)
            
            for method_name, behavior in mock_behavior.items():
                if asyncio.iscoroutinefunction(behavior):
                    getattr(mock_instance, method_name).side_effect = behavior
                else:
                    getattr(mock_instance, method_name).return_value = behavior
            
            mock_factory.return_value = mock_instance
            yield mock_instance


class FileSystemTestHelper:
    """Helper for file system testing."""
    
    def __init__(self):
        self._temp_dirs = []
        self._temp_files = []
    
    def create_test_directory(self) -> Path:
        """Create temporary test directory."""
        temp_dir = tempfile.mkdtemp()
        path = Path(temp_dir)
        self._temp_dirs.append(path)
        return path
    
    def create_test_file(self, content: str = "", suffix: str = ".txt") -> Path:
        """Create temporary test file."""
        temp_dir = self.create_test_directory()
        file_path = temp_dir / f"test_file_{uuid.uuid4().hex[:8]}{suffix}"
        file_path.write_text(content)
        self._temp_files.append(file_path)
        return file_path
    
    def create_test_file_structure(self, structure: Dict[str, Union[str, Dict]]) -> Path:
        """Create test file structure from dict."""
        root_dir = self.create_test_directory()
        self._create_structure_recursive(root_dir, structure)
        return root_dir
    
    def _create_structure_recursive(self, base_path: Path, structure: Dict[str, Union[str, Dict]]):
        """Recursively create file structure."""
        for name, content in structure.items():
            if isinstance(content, dict):
                # Create directory
                dir_path = base_path / name
                dir_path.mkdir()
                self._create_structure_recursive(dir_path, content)
            else:
                # Create file
                file_path = base_path / name
                file_path.write_text(content)
                self._temp_files.append(file_path)
    
    def assert_file_exists(self, file_path: Path):
        """Assert file exists."""
        assert file_path.exists(), f"File should exist: {file_path}"
    
    def assert_file_content(self, file_path: Path, expected_content: str):
        """Assert file content matches expected."""
        assert file_path.exists(), f"File should exist: {file_path}"
        actual_content = file_path.read_text()
        assert actual_content == expected_content, f"File content mismatch in {file_path}"
    
    def assert_directory_structure(self, root_path: Path, expected_structure: Dict[str, Union[str, Dict]]):
        """Assert directory structure matches expected."""
        self._assert_structure_recursive(root_path, expected_structure)
    
    def _assert_structure_recursive(self, base_path: Path, expected: Dict[str, Union[str, Dict]]):
        """Recursively assert structure."""
        for name, content in expected.items():
            path = base_path / name
            assert path.exists(), f"Path should exist: {path}"
            
            if isinstance(content, dict):
                assert path.is_dir(), f"Should be directory: {path}"
                self._assert_structure_recursive(path, content)
            else:
                assert path.is_file(), f"Should be file: {path}"
                actual_content = path.read_text()
                assert actual_content == content, f"Content mismatch in {path}"
    
    def cleanup(self):
        """Clean up all test files and directories."""
        for file_path in self._temp_files:
            try:
                if file_path.exists():
                    file_path.unlink()
            except:
                pass
        
        for dir_path in reversed(self._temp_dirs):
            try:
                if dir_path.exists():
                    import shutil
                    shutil.rmtree(dir_path)
            except:
                pass
        
        self._temp_files.clear()
        self._temp_dirs.clear()


class InfrastructureTestScenarios:
    """Pre-built test scenarios for infrastructure layer."""
    
    @staticmethod
    def create_database_integration_scenario():
        """Create database integration test scenario."""
        return {
            "schema": """
                CREATE TABLE tasks (
                    task_id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    description TEXT,
                    status TEXT DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """,
            "test_data": {
                "tasks": [
                    {
                        "task_id": "task_1",
                        "title": "Test Task 1",
                        "description": "First test task",
                        "status": "pending"
                    },
                    {
                        "task_id": "task_2", 
                        "title": "Test Task 2",
                        "description": "Second test task",
                        "status": "completed"
                    }
                ]
            }
        }
    
    @staticmethod
    def create_file_system_scenario():
        """Create file system test scenario."""
        return {
            "project_root": {
                "src": {
                    "main.py": "print('Hello, World!')",
                    "utils": {
                        "__init__.py": "",
                        "helpers.py": "def helper(): pass"
                    }
                },
                "tests": {
                    "test_main.py": "def test_main(): assert True"
                },
                "README.md": "# Test Project",
                "requirements.txt": "pytest\nblack\n"
            }
        }
    
    @staticmethod
    def create_mcp_protocol_scenario():
        """Create MCP protocol test scenario."""
        return {
            "tools": [
                {
                    "name": "create_task",
                    "description": "Create a new task",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "title": {"type": "string"},
                            "description": {"type": "string"}
                        },
                        "required": ["title"]
                    }
                },
                {
                    "name": "get_task",
                    "description": "Get task by ID",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "task_id": {"type": "string"}
                        },
                        "required": ["task_id"]
                    }
                }
            ],
            "test_calls": [
                {
                    "tool": "create_task",
                    "arguments": {"title": "Test Task", "description": "Test description"},
                    "expected_success": True
                },
                {
                    "tool": "get_task",
                    "arguments": {"task_id": "test_task_123"},
                    "expected_success": True
                }
            ]
        }


class InfrastructureAssertions:
    """Specialized assertions for infrastructure layer."""
    
    @staticmethod
    def assert_database_state(connection, table_name: str, expected_count: int):
        """Assert database table state."""
        cursor = connection.execute(f"SELECT COUNT(*) FROM {table_name}")
        actual_count = cursor.fetchone()[0]
        assert actual_count == expected_count, f"Expected {expected_count} rows in {table_name}, got {actual_count}"
    
    @staticmethod
    def assert_repository_implementation(repository, interface_type):
        """Assert repository implements required interface."""
        required_methods = ['get_by_id', 'save', 'delete', 'find_all']
        
        for method in required_methods:
            assert hasattr(repository, method), f"Repository must implement {method}"
            assert asyncio.iscoroutinefunction(getattr(repository, method)), f"{method} must be async"
    
    @staticmethod
    def assert_mcp_tool_compliance(tool_handler: callable, tool_definitions: List[Dict]):
        """Assert MCP tool handler compliance."""
        assert asyncio.iscoroutinefunction(tool_handler), "Tool handler must be async"
        
        for tool_def in tool_definitions:
            assert "name" in tool_def, "Tool definition must have name"
            assert "inputSchema" in tool_def, "Tool definition must have input schema"
    
    @staticmethod
    def assert_external_service_integration(service_mock: AsyncMock, expected_calls: List[str]):
        """Assert external service integration."""
        for call in expected_calls:
            assert hasattr(service_mock, call), f"Service must have {call} method"
    
    @staticmethod
    def assert_error_handling(operation: callable, expected_exception: Type[Exception]):
        """Assert proper error handling."""
        try:
            operation()
            assert False, f"Operation should raise {expected_exception.__name__}"
        except expected_exception:
            pass  # Expected behavior
        except Exception as e:
            assert False, f"Operation raised {type(e).__name__} instead of {expected_exception.__name__}"


class PerformanceTestHelper:
    """Helper for infrastructure performance testing."""
    
    def __init__(self):
        self._performance_data = []
    
    async def measure_database_performance(
        self,
        operation: callable,
        iterations: int = 100
    ) -> Dict[str, float]:
        """Measure database operation performance."""
        execution_times = []
        
        for _ in range(iterations):
            start_time = datetime.now()
            await operation()
            execution_time = (datetime.now() - start_time).total_seconds()
            execution_times.append(execution_time)
        
        return {
            "average_time": sum(execution_times) / len(execution_times),
            "min_time": min(execution_times),
            "max_time": max(execution_times),
            "total_time": sum(execution_times),
            "iterations": iterations
        }
    
    async def measure_mcp_tool_performance(
        self,
        tool_handler: callable,
        tool_name: str,
        arguments: Dict[str, Any],
        iterations: int = 50
    ) -> Dict[str, Any]:
        """Measure MCP tool performance."""
        execution_times = []
        success_count = 0
        
        for _ in range(iterations):
            start_time = datetime.now()
            try:
                await tool_handler(tool_name, arguments)
                success_count += 1
            except Exception:
                pass
            execution_time = (datetime.now() - start_time).total_seconds()
            execution_times.append(execution_time)
        
        return {
            "average_time": sum(execution_times) / len(execution_times),
            "min_time": min(execution_times),
            "max_time": max(execution_times),
            "success_rate": success_count / iterations,
            "iterations": iterations,
            "tool_name": tool_name
        }