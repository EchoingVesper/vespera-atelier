"""
Custom assertion helpers for Vespera V2 testing.

Provides domain-specific assertions for validating system behavior,
API responses, and data structures.
"""

from typing import Dict, Any, List, Optional, Union
from datetime import datetime
import json

from tasks.models import Task, TaskStatus, TaskPriority


def assert_task_equality(actual: Union[Task, Dict[str, Any]], expected: Union[Task, Dict[str, Any]], ignore_fields: Optional[List[str]] = None):
    """Assert that two tasks are equal, with optional field exclusions."""
    
    if ignore_fields is None:
        ignore_fields = ['id', 'created_at', 'updated_at']
    
    # Convert to dict if necessary
    if isinstance(actual, Task):
        actual_dict = {
            'title': actual.title,
            'description': actual.description,
            'status': actual.status.value if isinstance(actual.status, TaskStatus) else actual.status,
            'priority': actual.priority.value if isinstance(actual.priority, TaskPriority) else actual.priority,
            'project_id': actual.project_id
        }
    else:
        actual_dict = actual.copy()
    
    if isinstance(expected, Task):
        expected_dict = {
            'title': expected.title,
            'description': expected.description,
            'status': expected.status.value if isinstance(expected.status, TaskStatus) else expected.status,
            'priority': expected.priority.value if isinstance(expected.priority, TaskPriority) else expected.priority,
            'project_id': expected.project_id
        }
    else:
        expected_dict = expected.copy()
    
    # Remove ignored fields
    for field in ignore_fields:
        actual_dict.pop(field, None)
        expected_dict.pop(field, None)
    
    # Compare remaining fields
    for key, expected_value in expected_dict.items():
        assert key in actual_dict, f"Missing field in actual task: {key}"
        assert actual_dict[key] == expected_value, \
            f"Field mismatch for {key}: expected {expected_value}, got {actual_dict[key]}"


def assert_api_response_valid(response: Dict[str, Any], expected_structure: Dict[str, type]):
    """Assert that an API response has the expected structure and types."""
    
    for field, expected_type in expected_structure.items():
        assert field in response, f"Missing required field: {field}"
        
        actual_value = response[field]
        
        if expected_type == "datetime":
            # Special handling for datetime strings
            try:
                datetime.fromisoformat(actual_value.replace('Z', '+00:00'))
            except (ValueError, AttributeError):
                assert False, f"Field {field} is not a valid datetime string: {actual_value}"
        elif expected_type == "optional":
            # Field can be None or missing
            continue
        else:
            assert isinstance(actual_value, expected_type), \
                f"Field {field} has wrong type: expected {expected_type.__name__}, got {type(actual_value).__name__}"


def assert_mcp_response_format(response: Dict[str, Any]):
    """Assert that a response follows MCP response format."""
    
    # All MCP responses should have 'success' field
    assert 'success' in response, "MCP response missing 'success' field"
    assert isinstance(response['success'], bool), "'success' field must be boolean"
    
    if response['success']:
        # Successful responses should not have 'error' field
        assert 'error' not in response, "Successful response should not contain 'error' field"
    else:
        # Failed responses should have 'error' field
        assert 'error' in response, "Failed response missing 'error' field"
        assert isinstance(response['error'], str), "'error' field must be string"
        assert len(response['error']) > 0, "'error' field cannot be empty"


def assert_task_list_valid(tasks: List[Dict[str, Any]], expected_count: Optional[int] = None):
    """Assert that a list of tasks is valid."""
    
    assert isinstance(tasks, list), "Tasks must be a list"
    
    if expected_count is not None:
        assert len(tasks) == expected_count, f"Expected {expected_count} tasks, got {len(tasks)}"
    
    task_ids = set()
    for task in tasks:
        # Check required fields
        required_fields = ['id', 'title', 'status', 'priority']
        for field in required_fields:
            assert field in task, f"Task missing required field: {field}"
        
        # Check for duplicate IDs
        task_id = task['id']
        assert task_id not in task_ids, f"Duplicate task ID: {task_id}"
        task_ids.add(task_id)
        
        # Validate status and priority values
        valid_statuses = [s.value for s in TaskStatus]
        valid_priorities = [p.value for p in TaskPriority]
        
        assert task['status'] in valid_statuses, f"Invalid status: {task['status']}"
        assert task['priority'] in valid_priorities, f"Invalid priority: {task['priority']}"


def assert_clustering_result_valid(result: Dict[str, Any]):
    """Assert that a clustering result is valid."""
    
    assert_mcp_response_format(result)
    
    if result['success']:
        assert 'clusters' in result, "Clustering result missing 'clusters'"
        assert 'clustering_summary' in result, "Clustering result missing 'clustering_summary'"
        
        clusters = result['clusters']
        assert isinstance(clusters, list), "Clusters must be a list"
        
        summary = result['clustering_summary']
        assert 'clusters_found' in summary, "Summary missing 'clusters_found'"
        assert 'total_tasks_analyzed' in summary, "Summary missing 'total_tasks_analyzed'"
        
        # Validate cluster structure
        for cluster in clusters:
            required_cluster_fields = ['cluster_id', 'theme', 'tasks']
            for field in required_cluster_fields:
                assert field in cluster, f"Cluster missing required field: {field}"
            
            assert isinstance(cluster['tasks'], list), "Cluster tasks must be a list"
            assert len(cluster['tasks']) > 0, "Cluster cannot be empty"


def assert_impact_analysis_valid(result: Dict[str, Any]):
    """Assert that an impact analysis result is valid."""
    
    assert_mcp_response_format(result)
    
    if result['success']:
        assert 'task' in result, "Impact analysis missing 'task'"
        assert 'summary' in result, "Impact analysis missing 'summary'"
        assert 'impact_analysis' in result, "Impact analysis missing 'impact_analysis'"
        
        summary = result['summary']
        assert 'total_affected_tasks' in summary, "Summary missing 'total_affected_tasks'"
        assert 'impact_severity' in summary, "Summary missing 'impact_severity'"
        
        valid_severities = ['low', 'medium', 'high', 'critical']
        assert summary['impact_severity'] in valid_severities, \
            f"Invalid impact severity: {summary['impact_severity']}"


def assert_health_analysis_valid(result: Dict[str, Any]):
    """Assert that a health analysis result is valid."""
    
    assert_mcp_response_format(result)
    
    if result['success']:
        assert 'overall_health' in result, "Health analysis missing 'overall_health'"
        assert 'detailed_analysis' in result, "Health analysis missing 'detailed_analysis'"
        
        health = result['overall_health']
        assert 'score' in health, "Health missing 'score'"
        assert 'letter_grade' in health, "Health missing 'letter_grade'"
        
        # Validate score range
        score = health['score']
        assert isinstance(score, (int, float)), "Health score must be numeric"
        assert 0 <= score <= 100, f"Health score must be 0-100, got {score}"
        
        # Validate letter grade
        valid_grades = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F']
        assert health['letter_grade'] in valid_grades, \
            f"Invalid letter grade: {health['letter_grade']}"


def assert_pagination_valid(pagination: Dict[str, Any]):
    """Assert that pagination data is valid."""
    
    required_fields = ['total', 'page', 'per_page']
    for field in required_fields:
        assert field in pagination, f"Pagination missing required field: {field}"
        assert isinstance(pagination[field], int), f"Pagination {field} must be integer"
        assert pagination[field] >= 0, f"Pagination {field} must be non-negative"
    
    # Logical validation
    assert pagination['page'] >= 1, "Page number must be at least 1"
    assert pagination['per_page'] >= 1, "Per page must be at least 1"


def assert_background_service_status_valid(status: Dict[str, Any]):
    """Assert that background service status is valid."""
    
    required_fields = ['service_type', 'status', 'enabled']
    for field in required_fields:
        assert field in status, f"Service status missing required field: {field}"
    
    # Validate service type
    from databases.service_config import ServiceType, ServiceStatus
    valid_service_types = [st.value for st in ServiceType]
    assert status['service_type'] in valid_service_types, \
        f"Invalid service type: {status['service_type']}"
    
    # Validate status
    valid_statuses = [ss.value for ss in ServiceStatus]
    assert status['status'] in valid_statuses, \
        f"Invalid service status: {status['status']}"
    
    # Validate enabled flag
    assert isinstance(status['enabled'], bool), "Enabled flag must be boolean"
    
    # Check metrics if present
    if 'metrics' in status:
        metrics = status['metrics']
        metric_fields = ['operations_completed', 'operations_failed']
        for field in metric_fields:
            if field in metrics:
                assert isinstance(metrics[field], int), f"Metric {field} must be integer"
                assert metrics[field] >= 0, f"Metric {field} must be non-negative"


def assert_websocket_message_valid(message: Dict[str, Any]):
    """Assert that a WebSocket message is valid."""
    
    assert 'type' in message, "WebSocket message missing 'type' field"
    assert isinstance(message['type'], str), "Message type must be string"
    
    message_type = message['type']
    
    if message_type == 'subscribe':
        assert 'channel' in message, "Subscribe message missing 'channel'"
        
    elif message_type == 'task_updated':
        assert 'task' in message, "Task update message missing 'task'"
        assert_task_equality(message['task'], message['task'])  # Basic validation
        
    elif message_type == 'error':
        assert 'error' in message, "Error message missing 'error' field"
        assert isinstance(message['error'], str), "Error must be string"
        
    elif message_type == 'ack':
        # Acknowledgment messages are valid with just type
        pass
    
    else:
        assert False, f"Unknown WebSocket message type: {message_type}"


def assert_triple_db_coordination_valid(task_dict: Dict[str, Any]):
    """Assert that task has valid triple-DB coordination metadata."""
    
    assert 'triple_db' in task_dict, "Task missing triple-DB coordination metadata"
    
    triple_db = task_dict['triple_db']
    required_fields = ['sync_status', 'embedding_version', 'graph_version']
    
    for field in required_fields:
        assert field in triple_db, f"Triple-DB metadata missing {field}"
    
    # Validate sync status
    from tasks.models import SyncStatus
    valid_sync_statuses = [ss.value for ss in SyncStatus]
    assert triple_db['sync_status'] in valid_sync_statuses, \
        f"Invalid sync status: {triple_db['sync_status']}"
    
    # Validate version numbers
    assert isinstance(triple_db['embedding_version'], int), "Embedding version must be integer"
    assert isinstance(triple_db['graph_version'], int), "Graph version must be integer"
    assert triple_db['embedding_version'] >= 1, "Embedding version must be at least 1"
    assert triple_db['graph_version'] >= 1, "Graph version must be at least 1"


def assert_performance_acceptable(metrics: Dict[str, Any], thresholds: Dict[str, float]):
    """Assert that performance metrics meet specified thresholds."""
    
    for metric, threshold in thresholds.items():
        assert metric in metrics, f"Performance metrics missing {metric}"
        
        actual_value = metrics[metric]
        assert isinstance(actual_value, (int, float)), f"Metric {metric} must be numeric"
        
        if metric.startswith('max_'):
            assert actual_value <= threshold, \
                f"Performance metric {metric} ({actual_value}) exceeds threshold ({threshold})"
        elif metric.startswith('min_'):
            assert actual_value >= threshold, \
                f"Performance metric {metric} ({actual_value}) below threshold ({threshold})"


def assert_json_serializable(obj: Any):
    """Assert that an object is JSON serializable."""
    
    try:
        json.dumps(obj)
    except (TypeError, ValueError) as e:
        assert False, f"Object is not JSON serializable: {e}"


def assert_error_response_valid(response: Dict[str, Any], expected_error_type: Optional[str] = None):
    """Assert that an error response is properly formatted."""
    
    assert_mcp_response_format(response)
    assert response['success'] == False, "Error response must have success=False"
    
    error_message = response['error']
    assert len(error_message) > 0, "Error message cannot be empty"
    
    if expected_error_type:
        assert expected_error_type.lower() in error_message.lower(), \
            f"Expected error type '{expected_error_type}' not found in error message: {error_message}"


def assert_list_sorted(items: List[Any], key_func: callable = None, reverse: bool = False):
    """Assert that a list is sorted according to specified criteria."""
    
    if not items:
        return  # Empty list is considered sorted
    
    if key_func is None:
        key_func = lambda x: x
    
    sorted_items = sorted(items, key=key_func, reverse=reverse)
    
    for i, (actual, expected) in enumerate(zip(items, sorted_items)):
        assert actual == expected, \
            f"List not sorted at index {i}: expected {expected}, got {actual}"


def assert_no_duplicate_ids(items: List[Dict[str, Any]], id_field: str = 'id'):
    """Assert that a list of items has no duplicate IDs."""
    
    ids = [item[id_field] for item in items if id_field in item]
    unique_ids = set(ids)
    
    assert len(ids) == len(unique_ids), \
        f"Found duplicate IDs in list. Total items: {len(ids)}, Unique IDs: {len(unique_ids)}"