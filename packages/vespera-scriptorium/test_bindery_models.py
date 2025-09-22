#!/usr/bin/env python3
"""
Test Bindery models without external dependencies.

This test validates the Pydantic models and JSON serialization
without requiring aiohttp or the actual Bindery server.
"""

import json
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, Any

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

# Test imports
try:
    from bindery.models import (
        # Task Management
        CreateTaskInput, CreateTaskOutput,
        GetTaskInput, GetTaskOutput,
        UpdateTaskInput, UpdateTaskOutput,
        ListTasksInput, ListTasksOutput,
        ExecuteTaskInput, ExecuteTaskOutput,

        # RAG/Search
        IndexDocumentInput, IndexDocumentOutput,
        SearchRagInput, SearchRagOutput,

        # Dashboard
        GetTaskDashboardInput, GetTaskDashboardOutput,

        # Base Models
        TaskInput, TaskOutput, TaskStatus, TaskPriority, DocumentType,
        TaskStatistics, ProjectStatistics, RAGStatistics,
        SearchResult, DocumentMetadata
    )

    print("✓ All Bindery models imported successfully")
    models_imported = True

except ImportError as e:
    print(f"✗ Failed to import Bindery models: {e}")
    models_imported = False
    sys.exit(1)


def test_task_models():
    """Test task-related models."""
    print("\nTesting Task Models:")

    # Test TaskInput
    task_input = TaskInput(
        title="Test Task",
        description="This is a test task",
        priority=TaskPriority.HIGH,
        status=TaskStatus.TODO,
        tags=["test", "mcp"]
    )
    print(f"✓ TaskInput created: {task_input.title}")

    # Test CreateTaskInput
    create_input = CreateTaskInput(task=task_input)
    json_data = create_input.model_dump_json()
    print(f"✓ CreateTaskInput JSON: {len(json_data)} characters")

    # Test TaskOutput
    task_output = TaskOutput(
        id="test-123",
        title="Test Task",
        description="This is a test task",
        priority=TaskPriority.HIGH,
        status=TaskStatus.TODO,
        tags=["test", "mcp"],
        labels={},
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    print(f"✓ TaskOutput created: {task_output.id}")

    # Test CreateTaskOutput
    create_output = CreateTaskOutput(
        success=True,
        message="Task created successfully",
        task=task_output
    )
    json_data = create_output.model_dump_json()
    print(f"✓ CreateTaskOutput JSON: {len(json_data)} characters")


def test_rag_models():
    """Test RAG-related models."""
    print("\nTesting RAG Models:")

    # Test IndexDocumentInput
    index_input = IndexDocumentInput(
        content="This is test content for indexing",
        title="Test Document",
        document_type=DocumentType.TEXT,
        tags=["test", "document"]
    )
    print(f"✓ IndexDocumentInput created: {index_input.title}")

    # Test SearchRagInput
    search_input = SearchRagInput(
        query="test query",
        limit=10,
        document_type=DocumentType.TEXT
    )
    json_data = search_input.model_dump_json()
    print(f"✓ SearchRagInput JSON: {len(json_data)} characters")

    # Test DocumentMetadata
    doc_metadata = DocumentMetadata(
        id="doc-123",
        title="Test Document",
        document_type=DocumentType.TEXT,
        content_hash="abc123",
        indexed_at=datetime.now(),
        updated_at=datetime.now(),
        tags=["test"]
    )
    print(f"✓ DocumentMetadata created: {doc_metadata.id}")


def test_dashboard_models():
    """Test dashboard-related models."""
    print("\nTesting Dashboard Models:")

    # Test TaskStatistics
    task_stats = TaskStatistics(
        total=10,
        by_status={"todo": 5, "doing": 3, "done": 2},
        by_priority={"low": 2, "normal": 6, "high": 2},
        completion_rate=20.0
    )
    print(f"✓ TaskStatistics created: {task_stats.total} total tasks")

    # Test ProjectStatistics
    project_stats = ProjectStatistics(
        total_projects=3,
        active_projects=2,
        project_health={"project1": "healthy", "project2": "warning"}
    )
    print(f"✓ ProjectStatistics created: {project_stats.total_projects} projects")

    # Test RAGStatistics
    rag_stats = RAGStatistics(
        total_documents=100,
        total_chunks=500,
        index_size_bytes=1024000
    )
    print(f"✓ RAGStatistics created: {rag_stats.total_documents} documents")

    # Test GetTaskDashboardOutput
    dashboard_output = GetTaskDashboardOutput(
        success=True,
        message="Dashboard generated",
        task_stats=task_stats,
        project_stats=project_stats,
        rag_stats=rag_stats,
        generated_at=datetime.now()
    )
    json_data = dashboard_output.model_dump_json()
    print(f"✓ GetTaskDashboardOutput JSON: {len(json_data)} characters")


def test_json_serialization():
    """Test JSON serialization of complex nested models."""
    print("\nTesting JSON Serialization:")

    # Create a complex task with all fields
    task_input = TaskInput(
        title="Complex Test Task",
        description="A task with all possible fields",
        priority=TaskPriority.URGENT,
        status=TaskStatus.DOING,
        project_id="project-123",
        parent_id="parent-456",
        tags=["complex", "test", "mcp", "bindery"],
        labels={"type": "integration", "severity": "high", "count": 42}
    )

    create_input = CreateTaskInput(task=task_input)

    # Serialize to JSON
    json_str = create_input.model_dump_json(indent=2)
    print(f"✓ Complex task JSON length: {len(json_str)} characters")

    # Parse back from JSON
    parsed_data = json.loads(json_str)
    recreated_input = CreateTaskInput(**parsed_data)

    # Verify round-trip
    assert recreated_input.task.title == task_input.title
    assert recreated_input.task.priority == task_input.priority
    assert recreated_input.task.labels == task_input.labels
    print("✓ JSON round-trip successful")

    # Test pretty-printed JSON
    print(f"✓ Sample JSON output:\n{json_str[:200]}...")


def test_enum_values():
    """Test enum value validation."""
    print("\nTesting Enum Values:")

    # Test TaskStatus enum
    for status in ["todo", "doing", "done", "blocked", "cancelled"]:
        task_status = TaskStatus(status)
        print(f"✓ TaskStatus.{status.upper()}: {task_status.value}")

    # Test TaskPriority enum
    for priority in ["low", "normal", "high", "urgent"]:
        task_priority = TaskPriority(priority)
        print(f"✓ TaskPriority.{priority.upper()}: {task_priority.value}")

    # Test DocumentType enum
    for doc_type in ["text", "code", "markdown", "documentation", "configuration", "data"]:
        document_type = DocumentType(doc_type)
        print(f"✓ DocumentType.{doc_type.upper()}: {document_type.value}")


def main():
    """Run all tests."""
    print("="*60)
    print("BINDERY MODELS TEST")
    print("="*60)

    if not models_imported:
        print("❌ Cannot run tests due to import failures")
        return False

    tests = [
        test_task_models,
        test_rag_models,
        test_dashboard_models,
        test_json_serialization,
        test_enum_values
    ]

    passed = 0
    for test_func in tests:
        try:
            test_func()
            passed += 1
            print(f"✓ {test_func.__name__} PASSED")
        except Exception as e:
            print(f"✗ {test_func.__name__} FAILED: {e}")

    print("\n" + "="*60)
    print(f"RESULTS: {passed}/{len(tests)} tests passed")

    if passed == len(tests):
        print("✅ All Bindery models are working correctly!")
        print("Ready for MCP tool integration.")
    else:
        print("❌ Some model tests failed.")

    return passed == len(tests)


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)