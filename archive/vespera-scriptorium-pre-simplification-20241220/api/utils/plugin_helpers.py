"""
Plugin Helper Utilities

Common utilities for plugin integration and management.
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


def validate_plugin_capabilities(plugin_type: str, required_capabilities: List[str]) -> Dict[str, Any]:
    """
    Validate if a plugin type supports the required capabilities.
    
    Args:
        plugin_type: Type of plugin (vscode, obsidian, custom)
        required_capabilities: List of required capabilities
    
    Returns:
        Validation result with details
    """
    
    # Define capabilities by plugin type
    plugin_capabilities = {
        "vscode": [
            "file_operations", "code_analysis", "git_integration",
            "real_time_updates", "syntax_highlighting", "debugging_support",
            "task_creation", "search_integration", "webhook_notifications"
        ],
        "obsidian": [
            "note_operations", "markdown_processing", "knowledge_graph",
            "backlink_analysis", "template_generation", "tag_management",
            "task_creation", "search_integration", "vault_integration"
        ],
        "custom": [
            "basic_api_access", "task_reading", "search_operations"
        ]
    }
    
    available_capabilities = plugin_capabilities.get(plugin_type, [])
    
    # Check capability coverage
    supported = [cap for cap in required_capabilities if cap in available_capabilities]
    missing = [cap for cap in required_capabilities if cap not in available_capabilities]
    
    validation_result = {
        "is_valid": len(missing) == 0,
        "plugin_type": plugin_type,
        "required_capabilities": required_capabilities,
        "supported_capabilities": supported,
        "missing_capabilities": missing,
        "coverage_percentage": (len(supported) / len(required_capabilities)) * 100 if required_capabilities else 100
    }
    
    return validation_result


def generate_plugin_context(plugin_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generate plugin context for request processing.
    
    Args:
        plugin_data: Plugin information from authentication
    
    Returns:
        Enhanced plugin context
    """
    
    context = {
        "plugin_id": plugin_data.get("plugin_id"),
        "plugin_name": plugin_data.get("plugin_name"),
        "plugin_type": plugin_data.get("plugin_type"),
        "version": plugin_data.get("version"),
        "permissions": plugin_data.get("permissions", []),
        "capabilities": plugin_data.get("capabilities", []),
        "status": plugin_data.get("status", "active"),
        "created_at": plugin_data.get("created_at"),
        "last_seen": plugin_data.get("last_seen")
    }
    
    # Add plugin-specific enhancements
    plugin_type = context.get("plugin_type")
    
    if plugin_type == "vscode":
        context.update({
            "supports_file_operations": True,
            "supports_git_integration": True,
            "supports_real_time_updates": True,
            "editor_type": "code_editor"
        })
    elif plugin_type == "obsidian":
        context.update({
            "supports_note_operations": True,
            "supports_knowledge_graph": True,
            "supports_backlinks": True,
            "editor_type": "note_editor"
        })
    else:
        context.update({
            "supports_basic_api": True,
            "editor_type": "custom"
        })
    
    return context


def format_task_for_plugin(task_data: Dict[str, Any], plugin_type: str) -> Dict[str, Any]:
    """
    Format task data specifically for plugin consumption.
    
    Args:
        task_data: Raw task data
        plugin_type: Type of requesting plugin
    
    Returns:
        Plugin-optimized task data
    """
    
    # Base task format
    formatted_task = {
        "id": task_data.get("id"),
        "title": task_data.get("title"),
        "description": task_data.get("description"),
        "status": task_data.get("status"),
        "priority": task_data.get("priority"),
        "created_at": task_data.get("created_at"),
        "updated_at": task_data.get("updated_at"),
        "assignee": task_data.get("assignee")
    }
    
    # Plugin-specific formatting
    if plugin_type == "vscode":
        # Add file-centric information for VS Code
        formatted_task.update({
            "file_references": task_data.get("code_references", []),
            "language_hints": extract_language_hints(task_data),
            "git_branch": task_data.get("labels", {}).get("git_branch"),
            "workspace_context": {
                "project_id": task_data.get("project_id"),
                "feature": task_data.get("feature")
            }
        })
    
    elif plugin_type == "obsidian":
        # Add note-centric information for Obsidian
        formatted_task.update({
            "note_references": task_data.get("source_references", []),
            "tags": task_data.get("tags", []),
            "knowledge_links": extract_knowledge_links(task_data),
            "vault_context": {
                "project_id": task_data.get("project_id"),
                "feature": task_data.get("feature")
            }
        })
    
    # Add common metadata
    formatted_task["metadata"] = {
        "plugin_optimized": True,
        "plugin_type": plugin_type,
        "formatted_at": datetime.now().isoformat()
    }
    
    return formatted_task


def extract_language_hints(task_data: Dict[str, Any]) -> List[str]:
    """Extract programming language hints from task data."""
    
    hints = []
    
    # Check file references
    code_refs = task_data.get("code_references", [])
    for ref in code_refs:
        if "." in ref:
            extension = ref.split(".")[-1].lower()
            language_map = {
                "py": "python", "js": "javascript", "ts": "typescript",
                "java": "java", "go": "go", "rs": "rust", "cpp": "cpp",
                "c": "c", "rb": "ruby", "php": "php", "swift": "swift"
            }
            if extension in language_map:
                hints.append(language_map[extension])
    
    # Check description for language keywords
    description = task_data.get("description", "").lower()
    for lang in ["python", "javascript", "typescript", "java", "go", "rust"]:
        if lang in description:
            hints.append(lang)
    
    return list(set(hints))  # Remove duplicates


def extract_knowledge_links(task_data: Dict[str, Any]) -> List[str]:
    """Extract knowledge graph links from task data."""
    
    links = []
    
    # Extract from source references
    source_refs = task_data.get("source_references", [])
    for ref in source_refs:
        if ref.endswith(".md") or "note" in ref.lower():
            links.append(ref)
    
    # Extract from description
    description = task_data.get("description", "")
    # Simple pattern matching for [[wiki-links]]
    import re
    wiki_links = re.findall(r'\[\[([^\]]+)\]\]', description)
    links.extend(wiki_links)
    
    # Extract from tags that might be note references
    tags = task_data.get("tags", [])
    note_tags = [tag for tag in tags if tag.startswith("note/") or tag.endswith(".md")]
    links.extend(note_tags)
    
    return list(set(links))  # Remove duplicates


def create_webhook_payload(event_type: str, data: Dict[str, Any], plugin_context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Create a webhook payload for plugin notifications.
    
    Args:
        event_type: Type of event (task.created, task.updated, etc.)
        data: Event data
        plugin_context: Plugin context information
    
    Returns:
        Webhook payload
    """
    
    payload = {
        "event": event_type,
        "timestamp": datetime.now().isoformat(),
        "api_version": "2.0.0",
        "plugin_context": {
            "plugin_id": plugin_context.get("plugin_id"),
            "plugin_type": plugin_context.get("plugin_type")
        },
        "data": data
    }
    
    # Add event-specific metadata
    if event_type.startswith("task."):
        payload["resource_type"] = "task"
        payload["resource_id"] = data.get("id")
    elif event_type.startswith("project."):
        payload["resource_type"] = "project"
        payload["resource_id"] = data.get("project_id")
    
    return payload


def calculate_plugin_metrics(plugin_activity: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Calculate usage metrics for a plugin.
    
    Args:
        plugin_activity: List of plugin activity records
    
    Returns:
        Plugin metrics
    """
    
    if not plugin_activity:
        return {
            "total_requests": 0,
            "success_rate": 0.0,
            "avg_response_time": 0.0,
            "last_activity": None,
            "most_used_endpoints": [],
            "error_rate": 0.0
        }
    
    total_requests = len(plugin_activity)
    successful_requests = len([a for a in plugin_activity if a.get("success", True)])
    
    # Calculate response times
    response_times = [a.get("response_time", 0) for a in plugin_activity if a.get("response_time")]
    avg_response_time = sum(response_times) / len(response_times) if response_times else 0
    
    # Count endpoint usage
    endpoint_counts = {}
    for activity in plugin_activity:
        endpoint = activity.get("endpoint", "unknown")
        endpoint_counts[endpoint] = endpoint_counts.get(endpoint, 0) + 1
    
    # Sort endpoints by usage
    most_used_endpoints = sorted(endpoint_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    
    metrics = {
        "total_requests": total_requests,
        "success_rate": (successful_requests / total_requests) if total_requests > 0 else 0.0,
        "avg_response_time": avg_response_time,
        "last_activity": max([a.get("timestamp") for a in plugin_activity], default=None),
        "most_used_endpoints": [{"endpoint": ep, "count": count} for ep, count in most_used_endpoints],
        "error_rate": ((total_requests - successful_requests) / total_requests) if total_requests > 0 else 0.0
    }
    
    return metrics


def generate_api_documentation_for_plugin(plugin_type: str) -> Dict[str, Any]:
    """
    Generate plugin-specific API documentation.
    
    Args:
        plugin_type: Type of plugin
    
    Returns:
        Plugin-specific API documentation
    """
    
    base_endpoints = {
        "task_management": {
            "GET /api/v1/tasks": "List tasks with filtering",
            "POST /api/v1/tasks": "Create a new task",
            "GET /api/v1/tasks/{id}": "Get task details",
            "PUT /api/v1/tasks/{id}": "Update task",
            "DELETE /api/v1/tasks/{id}": "Delete task"
        },
        "search": {
            "POST /api/v1/search/semantic": "Semantic task search",
            "GET /api/v1/search/similar/{id}": "Find similar tasks"
        }
    }
    
    plugin_specific_endpoints = {
        "vscode": {
            "POST /api/v1/plugins/vscode/context/file": "Analyze file context",
            "POST /api/v1/plugins/vscode/tasks/from-selection": "Create task from code selection"
        },
        "obsidian": {
            "POST /api/v1/plugins/obsidian/context/note": "Analyze note context",
            "POST /api/v1/plugins/obsidian/tasks/from-note": "Create task from note"
        }
    }
    
    documentation = {
        "plugin_type": plugin_type,
        "api_version": "2.0.0",
        "base_url": "http://localhost:8000",
        "authentication": {
            "type": "Bearer Token",
            "header": "Authorization: Bearer <token>",
            "registration_endpoint": "/api/v1/plugins/register"
        },
        "endpoints": {
            **base_endpoints,
            "plugin_specific": plugin_specific_endpoints.get(plugin_type, {})
        },
        "examples": generate_plugin_examples(plugin_type)
    }
    
    return documentation


def generate_plugin_examples(plugin_type: str) -> Dict[str, Any]:
    """Generate example requests for plugin type."""
    
    examples = {
        "create_task": {
            "method": "POST",
            "url": "/api/v1/tasks",
            "headers": {"Authorization": "Bearer <token>"},
            "body": {
                "title": f"Example task from {plugin_type}",
                "description": "Task created via plugin",
                "priority": "normal",
                "tags": [plugin_type]
            }
        },
        "search_tasks": {
            "method": "POST", 
            "url": "/api/v1/search/semantic",
            "headers": {"Authorization": "Bearer <token>"},
            "body": {
                "query": "database optimization tasks",
                "n_results": 10
            }
        }
    }
    
    if plugin_type == "vscode":
        examples["analyze_file"] = {
            "method": "POST",
            "url": "/api/v1/plugins/vscode/context/file",
            "headers": {"Authorization": "Bearer <token>"},
            "body": {
                "file_path": "src/main.py",
                "language": "python",
                "function_name": "process_data",
                "content_preview": "def process_data(items):\n    # TODO: optimize this function"
            }
        }
    elif plugin_type == "obsidian":
        examples["analyze_note"] = {
            "method": "POST",
            "url": "/api/v1/plugins/obsidian/context/note",
            "headers": {"Authorization": "Bearer <token>"},
            "body": {
                "note_path": "Projects/API Development.md",
                "note_title": "API Development",
                "tags": ["project", "api"],
                "content_preview": "# API Development\n\n## TODO\n- [ ] Implement authentication"
            }
        }
    
    return examples