"""
MCP tools for Vespera Bindery integration.

This module implements MCP tools that translate to Rust Bindery API calls.
Each tool is a pure translation layer with no business logic, just format
conversion between MCP and Bindery APIs.
"""

import asyncio
import logging
from typing import Any, Dict, Optional, List
from datetime import datetime

from mcp.types import Tool, TextContent, ImageContent, EmbeddedResource
from pydantic import ValidationError

from .client import BinderyClient, BinderyClientError, call_bindery_method
from .models import (
    # Task Management
    CreateTaskInput, CreateTaskOutput,
    GetTaskInput, GetTaskOutput,
    UpdateTaskInput, UpdateTaskOutput,
    DeleteTaskInput, DeleteTaskOutput,
    CompleteTaskInput, CompleteTaskOutput,
    ListTasksInput, ListTasksOutput,
    ExecuteTaskInput, ExecuteTaskOutput,

    # Task Trees
    CreateTaskTreeInput, CreateTaskTreeOutput,
    GetTaskTreeInput, GetTaskTreeOutput,
    TaskTreeNode,

    # Role Management
    AssignRoleToTaskInput, AssignRoleToTaskOutput,
    ListRolesInput, ListRolesOutput,
    RoleDefinition,

    # RAG/Search
    IndexDocumentInput, IndexDocumentOutput,
    SearchRagInput, SearchRagOutput,

    # Dashboard
    GetTaskDashboardInput, GetTaskDashboardOutput,

    # Base
    BinderyResponse,
    TaskInput, TaskOutput, TaskStatus, TaskPriority,
    DocumentType, SearchResult, DocumentMetadata
)

logger = logging.getLogger(__name__)


class BinderyTools:
    """
    Collection of MCP tools for Vespera Bindery integration.

    Each tool is a pure translation between MCP protocol and Bindery JSON-RPC calls.
    """

    def __init__(self, client: Optional[BinderyClient] = None):
        """
        Initialize Bindery tools.

        Args:
            client: Optional Bindery client instance
        """
        self.client = client

    async def _call_bindery(self, method: str, params: Optional[Dict[str, Any]] = None) -> Any:
        """
        Internal method to call Bindery backend.

        Args:
            method: JSON-RPC method name
            params: Method parameters

        Returns:
            Result from Bindery backend

        Raises:
            BinderyClientError: If call fails
        """
        return await call_bindery_method(method, params, self.client)

    # Task Management Tools

    async def create_task(self, arguments: Dict[str, Any]) -> List[TextContent | ImageContent | EmbeddedResource]:
        """
        Create a new task in the Bindery backend.

        Translates MCP input to Bindery create_task JSON-RPC call.
        """
        try:
            # Validate input
            input_data = CreateTaskInput(**arguments)

            # Convert to Bindery format
            task_data = input_data.task.model_dump(exclude_none=True)

            logger.info(f"Creating task: {task_data.get('title', 'Untitled')}")

            # Call Bindery backend
            result = await self._call_bindery("create_task", task_data)

            # Format response
            if result:
                # Extract task from result
                task_dict = result if isinstance(result, dict) else {"id": str(result)}

                output = CreateTaskOutput(
                    success=True,
                    message="Task created successfully",
                    task=TaskOutput(
                        id=task_dict.get("id", ""),
                        title=task_dict.get("title", task_data["title"]),
                        description=task_dict.get("description"),
                        priority=TaskPriority(task_dict.get("priority", "normal")),
                        status=TaskStatus(task_dict.get("status", "todo")),
                        project_id=task_dict.get("project_id"),
                        parent_id=task_dict.get("parent_id"),
                        tags=task_dict.get("tags", []),
                        labels=task_dict.get("labels", {}),
                        created_at=datetime.fromisoformat(task_dict.get("created_at", datetime.now().isoformat())),
                        updated_at=datetime.fromisoformat(task_dict.get("updated_at", datetime.now().isoformat()))
                    )
                )
            else:
                output = CreateTaskOutput(
                    success=False,
                    error="Failed to create task"
                )

            return [TextContent(type="text", text=output.model_dump_json(indent=2))]

        except ValidationError as e:
            logger.error(f"Validation error in create_task: {e}")
            output = CreateTaskOutput(
                success=False,
                error=f"Input validation error: {e}"
            )
            return [TextContent(type="text", text=output.model_dump_json(indent=2))]

        except BinderyClientError as e:
            logger.error(f"Bindery client error in create_task: {e}")
            output = CreateTaskOutput(
                success=False,
                error=f"Bindery backend error: {e}"
            )
            return [TextContent(type="text", text=output.model_dump_json(indent=2))]

    async def get_task(self, arguments: Dict[str, Any]) -> List[TextContent | ImageContent | EmbeddedResource]:
        """
        Get a task by ID from the Bindery backend.

        Translates MCP input to Bindery get_task JSON-RPC call.
        """
        try:
            # Validate input
            input_data = GetTaskInput(**arguments)

            logger.info(f"Getting task: {input_data.task_id}")

            # Call Bindery backend
            result = await self._call_bindery("get_task", {"id": input_data.task_id})

            # Format response
            if result:
                task_dict = result
                output = GetTaskOutput(
                    success=True,
                    message="Task retrieved successfully",
                    task=TaskOutput(
                        id=task_dict.get("id", input_data.task_id),
                        title=task_dict.get("title", ""),
                        description=task_dict.get("description"),
                        priority=TaskPriority(task_dict.get("priority", "normal")),
                        status=TaskStatus(task_dict.get("status", "todo")),
                        project_id=task_dict.get("project_id"),
                        parent_id=task_dict.get("parent_id"),
                        tags=task_dict.get("tags", []),
                        labels=task_dict.get("labels", {}),
                        created_at=datetime.fromisoformat(task_dict.get("created_at", datetime.now().isoformat())),
                        updated_at=datetime.fromisoformat(task_dict.get("updated_at", datetime.now().isoformat())),
                        completed_at=datetime.fromisoformat(task_dict["completed_at"]) if task_dict.get("completed_at") else None
                    )
                )
            else:
                output = GetTaskOutput(
                    success=False,
                    error=f"Task {input_data.task_id} not found"
                )

            return [TextContent(type="text", text=output.model_dump_json(indent=2))]

        except ValidationError as e:
            logger.error(f"Validation error in get_task: {e}")
            output = GetTaskOutput(
                success=False,
                error=f"Input validation error: {e}"
            )
            return [TextContent(type="text", text=output.model_dump_json(indent=2))]

        except BinderyClientError as e:
            logger.error(f"Bindery client error in get_task: {e}")
            output = GetTaskOutput(
                success=False,
                error=f"Bindery backend error: {e}"
            )
            return [TextContent(type="text", text=output.model_dump_json(indent=2))]

    async def update_task(self, arguments: Dict[str, Any]) -> List[TextContent | ImageContent | EmbeddedResource]:
        """
        Update a task in the Bindery backend.

        Translates MCP input to Bindery update_task JSON-RPC call.
        """
        try:
            # Validate input
            input_data = UpdateTaskInput(**arguments)

            logger.info(f"Updating task: {input_data.task_id}")

            # Call Bindery backend
            result = await self._call_bindery("update_task", {
                "id": input_data.task_id,
                **input_data.updates
            })

            # Format response
            if result:
                task_dict = result
                output = UpdateTaskOutput(
                    success=True,
                    message="Task updated successfully",
                    task=TaskOutput(
                        id=task_dict.get("id", input_data.task_id),
                        title=task_dict.get("title", ""),
                        description=task_dict.get("description"),
                        priority=TaskPriority(task_dict.get("priority", "normal")),
                        status=TaskStatus(task_dict.get("status", "todo")),
                        project_id=task_dict.get("project_id"),
                        parent_id=task_dict.get("parent_id"),
                        tags=task_dict.get("tags", []),
                        labels=task_dict.get("labels", {}),
                        created_at=datetime.fromisoformat(task_dict.get("created_at", datetime.now().isoformat())),
                        updated_at=datetime.fromisoformat(task_dict.get("updated_at", datetime.now().isoformat())),
                        completed_at=datetime.fromisoformat(task_dict["completed_at"]) if task_dict.get("completed_at") else None
                    )
                )
            else:
                output = UpdateTaskOutput(
                    success=False,
                    error=f"Failed to update task {input_data.task_id}"
                )

            return [TextContent(type="text", text=output.model_dump_json(indent=2))]

        except ValidationError as e:
            logger.error(f"Validation error in update_task: {e}")
            output = UpdateTaskOutput(
                success=False,
                error=f"Input validation error: {e}"
            )
            return [TextContent(type="text", text=output.model_dump_json(indent=2))]

        except BinderyClientError as e:
            logger.error(f"Bindery client error in update_task: {e}")
            output = UpdateTaskOutput(
                success=False,
                error=f"Bindery backend error: {e}"
            )
            return [TextContent(type="text", text=output.model_dump_json(indent=2))]

    async def list_tasks(self, arguments: Dict[str, Any]) -> List[TextContent | ImageContent | EmbeddedResource]:
        """
        List tasks from the Bindery backend.

        Translates MCP input to Bindery list_tasks JSON-RPC call.
        """
        try:
            # Validate input
            input_data = ListTasksInput(**arguments)

            logger.info(f"Listing tasks with filters: {input_data.model_dump(exclude_none=True)}")

            # Prepare filters for Bindery
            filters = input_data.model_dump(exclude_none=True)

            # Call Bindery backend
            result = await self._call_bindery("list_tasks", filters)

            # Format response
            tasks = []
            if isinstance(result, list):
                for task_dict in result:
                    tasks.append(TaskOutput(
                        id=task_dict.get("id", ""),
                        title=task_dict.get("title", ""),
                        description=task_dict.get("description"),
                        priority=TaskPriority(task_dict.get("priority", "normal")),
                        status=TaskStatus(task_dict.get("status", "todo")),
                        project_id=task_dict.get("project_id"),
                        parent_id=task_dict.get("parent_id"),
                        tags=task_dict.get("tags", []),
                        labels=task_dict.get("labels", {}),
                        created_at=datetime.fromisoformat(task_dict.get("created_at", datetime.now().isoformat())),
                        updated_at=datetime.fromisoformat(task_dict.get("updated_at", datetime.now().isoformat())),
                        completed_at=datetime.fromisoformat(task_dict["completed_at"]) if task_dict.get("completed_at") else None
                    ))

            output = ListTasksOutput(
                success=True,
                message=f"Found {len(tasks)} tasks",
                tasks=tasks,
                total=len(tasks),
                has_more=False  # TODO: Implement pagination properly
            )

            return [TextContent(type="text", text=output.model_dump_json(indent=2))]

        except ValidationError as e:
            logger.error(f"Validation error in list_tasks: {e}")
            output = ListTasksOutput(
                success=False,
                error=f"Input validation error: {e}",
                tasks=[],
                total=0,
                has_more=False
            )
            return [TextContent(type="text", text=output.model_dump_json(indent=2))]

        except BinderyClientError as e:
            logger.error(f"Bindery client error in list_tasks: {e}")
            output = ListTasksOutput(
                success=False,
                error=f"Bindery backend error: {e}",
                tasks=[],
                total=0,
                has_more=False
            )
            return [TextContent(type="text", text=output.model_dump_json(indent=2))]

    async def execute_task(self, arguments: Dict[str, Any]) -> List[TextContent | ImageContent | EmbeddedResource]:
        """
        Execute a task with optional role assignment.

        This will update the task status and potentially assign a role.
        """
        try:
            # Validate input
            input_data = ExecuteTaskInput(**arguments)

            logger.info(f"Executing task: {input_data.task_id} with role: {input_data.role}")

            # First assign role if specified
            role_used = None
            if input_data.role:
                try:
                    await self._call_bindery("assign_role_to_task", {
                        "task_id": input_data.task_id,
                        "role_name": input_data.role
                    })
                    role_used = input_data.role
                except Exception as e:
                    logger.warning(f"Failed to assign role {input_data.role}: {e}")

            # Update task status to 'doing' if not dry run
            if not input_data.dry_run:
                result = await self._call_bindery("update_task", {
                    "id": input_data.task_id,
                    "status": "doing"
                })
            else:
                # For dry run, just get the current task
                result = await self._call_bindery("get_task", {"id": input_data.task_id})

            # Format response
            if result:
                task_dict = result
                output = ExecuteTaskOutput(
                    success=True,
                    message=f"Task {'prepared for execution' if input_data.dry_run else 'execution started'}",
                    task=TaskOutput(
                        id=task_dict.get("id", input_data.task_id),
                        title=task_dict.get("title", ""),
                        description=task_dict.get("description"),
                        priority=TaskPriority(task_dict.get("priority", "normal")),
                        status=TaskStatus(task_dict.get("status", "todo")),
                        project_id=task_dict.get("project_id"),
                        parent_id=task_dict.get("parent_id"),
                        tags=task_dict.get("tags", []),
                        labels=task_dict.get("labels", {}),
                        created_at=datetime.fromisoformat(task_dict.get("created_at", datetime.now().isoformat())),
                        updated_at=datetime.fromisoformat(task_dict.get("updated_at", datetime.now().isoformat())),
                        completed_at=datetime.fromisoformat(task_dict["completed_at"]) if task_dict.get("completed_at") else None
                    ),
                    execution_log=f"Task execution {'simulated' if input_data.dry_run else 'started'} at {datetime.now().isoformat()}",
                    role_used=role_used
                )
            else:
                output = ExecuteTaskOutput(
                    success=False,
                    error=f"Failed to execute task {input_data.task_id}"
                )

            return [TextContent(type="text", text=output.model_dump_json(indent=2))]

        except ValidationError as e:
            logger.error(f"Validation error in execute_task: {e}")
            output = ExecuteTaskOutput(
                success=False,
                error=f"Input validation error: {e}"
            )
            return [TextContent(type="text", text=output.model_dump_json(indent=2))]

        except BinderyClientError as e:
            logger.error(f"Bindery client error in execute_task: {e}")
            output = ExecuteTaskOutput(
                success=False,
                error=f"Bindery backend error: {e}"
            )
            return [TextContent(type="text", text=output.model_dump_json(indent=2))]

    async def delete_task(self, arguments: Dict[str, Any]) -> List[TextContent | ImageContent | EmbeddedResource]:
        """
        Delete a task by ID from the Bindery backend.

        Translates MCP input to Bindery delete_task JSON-RPC call.
        """
        try:
            # Validate input
            input_data = DeleteTaskInput(**arguments)

            logger.info(f"Deleting task: {input_data.task_id}")

            # Call Bindery backend
            result = await self._call_bindery("delete_task", {"id": input_data.task_id})

            # Format response
            if result:
                output = DeleteTaskOutput(
                    success=True,
                    message="Task deleted successfully",
                    task_id=input_data.task_id
                )
            else:
                output = DeleteTaskOutput(
                    success=False,
                    error=f"Failed to delete task {input_data.task_id}"
                )

            return [TextContent(type="text", text=output.model_dump_json(indent=2))]

        except ValidationError as e:
            logger.error(f"Validation error in delete_task: {e}")
            output = DeleteTaskOutput(
                success=False,
                error=f"Input validation error: {e}"
            )
            return [TextContent(type="text", text=output.model_dump_json(indent=2))]

        except BinderyClientError as e:
            logger.error(f"Bindery client error in delete_task: {e}")
            output = DeleteTaskOutput(
                success=False,
                error=f"Bindery backend error: {e}"
            )
            return [TextContent(type="text", text=output.model_dump_json(indent=2))]

    async def complete_task(self, arguments: Dict[str, Any]) -> List[TextContent | ImageContent | EmbeddedResource]:
        """
        Mark a task as completed in the Bindery backend.

        Translates MCP input to Bindery complete_task JSON-RPC call.
        """
        try:
            # Validate input
            input_data = CompleteTaskInput(**arguments)

            logger.info(f"Completing task: {input_data.task_id}")

            # Call Bindery backend
            result = await self._call_bindery("complete_task", {
                "id": input_data.task_id,
                "completion_notes": input_data.completion_notes
            })

            # Format response
            if result:
                task_dict = result
                output = CompleteTaskOutput(
                    success=True,
                    message="Task completed successfully",
                    task=TaskOutput(
                        id=task_dict.get("id", input_data.task_id),
                        title=task_dict.get("title", ""),
                        description=task_dict.get("description"),
                        priority=TaskPriority(task_dict.get("priority", "normal")),
                        status=TaskStatus(task_dict.get("status", "done")),
                        project_id=task_dict.get("project_id"),
                        parent_id=task_dict.get("parent_id"),
                        tags=task_dict.get("tags", []),
                        labels=task_dict.get("labels", {}),
                        created_at=datetime.fromisoformat(task_dict.get("created_at", datetime.now().isoformat())),
                        updated_at=datetime.fromisoformat(task_dict.get("updated_at", datetime.now().isoformat())),
                        completed_at=datetime.fromisoformat(task_dict.get("completed_at", datetime.now().isoformat()))
                    )
                )
            else:
                output = CompleteTaskOutput(
                    success=False,
                    error=f"Failed to complete task {input_data.task_id}"
                )

            return [TextContent(type="text", text=output.model_dump_json(indent=2))]

        except ValidationError as e:
            logger.error(f"Validation error in complete_task: {e}")
            output = CompleteTaskOutput(
                success=False,
                error=f"Input validation error: {e}"
            )
            return [TextContent(type="text", text=output.model_dump_json(indent=2))]

        except BinderyClientError as e:
            logger.error(f"Bindery client error in complete_task: {e}")
            output = CompleteTaskOutput(
                success=False,
                error=f"Bindery backend error: {e}"
            )
            return [TextContent(type="text", text=output.model_dump_json(indent=2))]

    async def create_task_tree(self, arguments: Dict[str, Any]) -> List[TextContent | ImageContent | EmbeddedResource]:
        """
        Create a hierarchical task tree structure in the Bindery backend.

        Translates MCP input to Bindery create_task_tree JSON-RPC call.
        """
        try:
            # Validate input
            input_data = CreateTaskTreeInput(**arguments)

            logger.info(f"Creating task tree: {input_data.root_task.title}")

            # Call Bindery backend
            result = await self._call_bindery("create_task_tree", {
                "root_task": input_data.root_task.model_dump(exclude_none=True),
                "children": [child.model_dump(exclude_none=True) for child in (input_data.children or [])]
            })

            # Format response
            if result:
                def build_task_tree(task_data: Dict[str, Any], depth: int = 0) -> TaskTreeNode:
                    """Recursively build task tree from result data."""
                    task = TaskOutput(
                        id=task_data.get("id", ""),
                        title=task_data.get("title", ""),
                        description=task_data.get("description"),
                        priority=TaskPriority(task_data.get("priority", "normal")),
                        status=TaskStatus(task_data.get("status", "todo")),
                        project_id=task_data.get("project_id"),
                        parent_id=task_data.get("parent_id"),
                        tags=task_data.get("tags", []),
                        labels=task_data.get("labels", {}),
                        created_at=datetime.fromisoformat(task_data.get("created_at", datetime.now().isoformat())),
                        updated_at=datetime.fromisoformat(task_data.get("updated_at", datetime.now().isoformat())),
                        completed_at=datetime.fromisoformat(task_data["completed_at"]) if task_data.get("completed_at") else None
                    )

                    children = []
                    for child_data in task_data.get("children", []):
                        children.append(build_task_tree(child_data, depth + 1))

                    return TaskTreeNode(task=task, children=children, depth=depth)

                task_tree = build_task_tree(result)
                total_tasks = result.get("total_tasks_created", 1)

                output = CreateTaskTreeOutput(
                    success=True,
                    message=f"Task tree created successfully with {total_tasks} tasks",
                    task_tree=task_tree,
                    total_tasks_created=total_tasks
                )
            else:
                output = CreateTaskTreeOutput(
                    success=False,
                    error="Failed to create task tree"
                )

            return [TextContent(type="text", text=output.model_dump_json(indent=2))]

        except ValidationError as e:
            logger.error(f"Validation error in create_task_tree: {e}")
            output = CreateTaskTreeOutput(
                success=False,
                error=f"Input validation error: {e}"
            )
            return [TextContent(type="text", text=output.model_dump_json(indent=2))]

        except BinderyClientError as e:
            logger.error(f"Bindery client error in create_task_tree: {e}")
            output = CreateTaskTreeOutput(
                success=False,
                error=f"Bindery backend error: {e}"
            )
            return [TextContent(type="text", text=output.model_dump_json(indent=2))]

    async def get_task_tree(self, arguments: Dict[str, Any]) -> List[TextContent | ImageContent | EmbeddedResource]:
        """
        Get a task tree with parent-child relationships from the Bindery backend.

        Translates MCP input to Bindery get_task_tree JSON-RPC call.
        """
        try:
            # Validate input
            input_data = GetTaskTreeInput(**arguments)

            logger.info(f"Getting task tree for root: {input_data.root_task_id}")

            # Call Bindery backend
            result = await self._call_bindery("get_task_tree", {
                "root_task_id": input_data.root_task_id,
                "max_depth": input_data.max_depth,
                "include_completed": input_data.include_completed
            })

            # Format response
            if result:
                def build_task_tree(task_data: Dict[str, Any], depth: int = 0) -> TaskTreeNode:
                    """Recursively build task tree from result data."""
                    task = TaskOutput(
                        id=task_data.get("id", ""),
                        title=task_data.get("title", ""),
                        description=task_data.get("description"),
                        priority=TaskPriority(task_data.get("priority", "normal")),
                        status=TaskStatus(task_data.get("status", "todo")),
                        project_id=task_data.get("project_id"),
                        parent_id=task_data.get("parent_id"),
                        tags=task_data.get("tags", []),
                        labels=task_data.get("labels", {}),
                        created_at=datetime.fromisoformat(task_data.get("created_at", datetime.now().isoformat())),
                        updated_at=datetime.fromisoformat(task_data.get("updated_at", datetime.now().isoformat())),
                        completed_at=datetime.fromisoformat(task_data["completed_at"]) if task_data.get("completed_at") else None
                    )

                    children = []
                    for child_data in task_data.get("children", []):
                        children.append(build_task_tree(child_data, depth + 1))

                    return TaskTreeNode(task=task, children=children, depth=depth)

                task_tree = build_task_tree(result)
                total_tasks = result.get("total_tasks", 1)

                output = GetTaskTreeOutput(
                    success=True,
                    message="Task tree retrieved successfully",
                    task_tree=task_tree,
                    total_tasks=total_tasks
                )
            else:
                output = GetTaskTreeOutput(
                    success=False,
                    error=f"Task tree not found for root ID {input_data.root_task_id}"
                )

            return [TextContent(type="text", text=output.model_dump_json(indent=2))]

        except ValidationError as e:
            logger.error(f"Validation error in get_task_tree: {e}")
            output = GetTaskTreeOutput(
                success=False,
                error=f"Input validation error: {e}"
            )
            return [TextContent(type="text", text=output.model_dump_json(indent=2))]

        except BinderyClientError as e:
            logger.error(f"Bindery client error in get_task_tree: {e}")
            output = GetTaskTreeOutput(
                success=False,
                error=f"Bindery backend error: {e}"
            )
            return [TextContent(type="text", text=output.model_dump_json(indent=2))]

    async def assign_role_to_task(self, arguments: Dict[str, Any]) -> List[TextContent | ImageContent | EmbeddedResource]:
        """
        Assign a role to execute a task in the Bindery backend.

        Translates MCP input to Bindery assign_role_to_task JSON-RPC call.
        """
        try:
            # Validate input
            input_data = AssignRoleToTaskInput(**arguments)

            logger.info(f"Assigning role {input_data.role_name} to task {input_data.task_id}")

            # Call Bindery backend
            result = await self._call_bindery("assign_role_to_task", {
                "task_id": input_data.task_id,
                "role_name": input_data.role_name
            })

            # Format response
            if result:
                output = AssignRoleToTaskOutput(
                    success=True,
                    message=f"Role {input_data.role_name} assigned to task {input_data.task_id}",
                    task_id=input_data.task_id,
                    role_assigned=input_data.role_name
                )
            else:
                output = AssignRoleToTaskOutput(
                    success=False,
                    error=f"Failed to assign role {input_data.role_name} to task {input_data.task_id}"
                )

            return [TextContent(type="text", text=output.model_dump_json(indent=2))]

        except ValidationError as e:
            logger.error(f"Validation error in assign_role_to_task: {e}")
            output = AssignRoleToTaskOutput(
                success=False,
                error=f"Input validation error: {e}"
            )
            return [TextContent(type="text", text=output.model_dump_json(indent=2))]

        except BinderyClientError as e:
            logger.error(f"Bindery client error in assign_role_to_task: {e}")
            output = AssignRoleToTaskOutput(
                success=False,
                error=f"Bindery backend error: {e}"
            )
            return [TextContent(type="text", text=output.model_dump_json(indent=2))]

    async def list_roles(self, arguments: Dict[str, Any]) -> List[TextContent | ImageContent | EmbeddedResource]:
        """
        List available roles and their capabilities from the Bindery backend.

        Translates MCP input to Bindery list_roles JSON-RPC call.
        """
        try:
            # Validate input
            input_data = ListRolesInput(**arguments)

            logger.info(f"Listing roles (include_capabilities: {input_data.include_capabilities})")

            # Call Bindery backend
            result = await self._call_bindery("list_roles", {
                "include_capabilities": input_data.include_capabilities
            })

            # Format response
            roles = []
            if isinstance(result, list):
                for role_dict in result:
                    roles.append(RoleDefinition(
                        name=role_dict.get("name", ""),
                        description=role_dict.get("description", ""),
                        capabilities=role_dict.get("capabilities", []),
                        file_patterns=role_dict.get("file_patterns", []),
                        restrictions=role_dict.get("restrictions", {})
                    ))

            output = ListRolesOutput(
                success=True,
                message=f"Found {len(roles)} roles",
                roles=roles,
                total_roles=len(roles)
            )

            return [TextContent(type="text", text=output.model_dump_json(indent=2))]

        except ValidationError as e:
            logger.error(f"Validation error in list_roles: {e}")
            output = ListRolesOutput(
                success=False,
                error=f"Input validation error: {e}",
                roles=[],
                total_roles=0
            )
            return [TextContent(type="text", text=output.model_dump_json(indent=2))]

        except BinderyClientError as e:
            logger.error(f"Bindery client error in list_roles: {e}")
            output = ListRolesOutput(
                success=False,
                error=f"Bindery backend error: {e}",
                roles=[],
                total_roles=0
            )
            return [TextContent(type="text", text=output.model_dump_json(indent=2))]

    # RAG/Search Tools

    async def search_rag(self, arguments: Dict[str, Any]) -> List[TextContent | ImageContent | EmbeddedResource]:
        """
        Search the RAG system for relevant documents.

        Note: This may not be implemented in the Rust Bindery server yet.
        """
        try:
            # Validate input
            input_data = SearchRagInput(**arguments)

            logger.info(f"Searching RAG system: {input_data.query}")

            # Call Bindery backend
            try:
                result = await self._call_bindery("search_documents", {
                    "query": input_data.query,
                    "limit": input_data.limit,
                    "project_id": input_data.project_id,
                    "document_type": input_data.document_type.value if input_data.document_type else None,
                    "min_score": input_data.min_score
                })

                # Parse results
                search_results = []
                if isinstance(result, dict) and result.get("results"):
                    for result_dict in result["results"]:
                        search_results.append(SearchResult(
                            document_id=result_dict.get("document_id", ""),
                            chunk_id=result_dict.get("chunk_id", ""),
                            content=result_dict.get("content", ""),
                            score=result_dict.get("score", 0.0),
                            metadata=DocumentMetadata(
                                id=result_dict.get("document_id", ""),
                                title=result_dict.get("title", "Unknown"),
                                document_type=DocumentType(result_dict.get("document_type", "text")),
                                source_path=result_dict.get("source_path"),
                                content_hash=result_dict.get("content_hash", ""),
                                indexed_at=datetime.fromisoformat(result_dict.get("indexed_at", datetime.now().isoformat())),
                                updated_at=datetime.fromisoformat(result_dict.get("updated_at", datetime.now().isoformat())),
                                tags=result_dict.get("tags", []),
                                project_id=result_dict.get("project_id")
                            )
                        ))

                output = SearchRagOutput(
                    success=True,
                    message=f"Found {len(search_results)} results",
                    query=input_data.query,
                    results=search_results,
                    total_results=len(search_results)
                )

            except BinderyClientError as e:
                # Handle case where RAG is not yet implemented
                if "not yet implemented" in str(e).lower() or "method not found" in str(e).lower():
                    output = SearchRagOutput(
                        success=False,
                        error="RAG search functionality not yet implemented in Bindery server",
                        query=input_data.query,
                        results=[],
                        total_results=0
                    )
                else:
                    raise

            return [TextContent(type="text", text=output.model_dump_json(indent=2))]

        except ValidationError as e:
            logger.error(f"Validation error in search_rag: {e}")
            output = SearchRagOutput(
                success=False,
                error=f"Input validation error: {e}",
                query=arguments.get("query", ""),
                results=[],
                total_results=0
            )
            return [TextContent(type="text", text=output.model_dump_json(indent=2))]

        except BinderyClientError as e:
            logger.error(f"Bindery client error in search_rag: {e}")
            output = SearchRagOutput(
                success=False,
                error=f"Bindery backend error: {e}",
                query=arguments.get("query", ""),
                results=[],
                total_results=0
            )
            return [TextContent(type="text", text=output.model_dump_json(indent=2))]

    async def index_document(self, arguments: Dict[str, Any]) -> List[TextContent | ImageContent | EmbeddedResource]:
        """
        Index a document in the RAG system.

        Note: This may not be implemented in the Rust Bindery server yet.
        """
        try:
            # Validate input
            input_data = IndexDocumentInput(**arguments)

            logger.info(f"Indexing document: {input_data.title}")

            # Call Bindery backend
            try:
                result = await self._call_bindery("index_document", {
                    "content": input_data.content,
                    "title": input_data.title,
                    "document_type": input_data.document_type.value,
                    "source_path": input_data.source_path,
                    "tags": input_data.tags or [],
                    "project_id": input_data.project_id
                })

                if result:
                    output = IndexDocumentOutput(
                        success=True,
                        message="Document indexed successfully",
                        document=DocumentMetadata(
                            id=result.get("id", ""),
                            title=result.get("title", input_data.title),
                            document_type=DocumentType(result.get("document_type", input_data.document_type.value)),
                            source_path=result.get("source_path", input_data.source_path),
                            content_hash=result.get("content_hash", ""),
                            indexed_at=datetime.fromisoformat(result.get("indexed_at", datetime.now().isoformat())),
                            updated_at=datetime.fromisoformat(result.get("updated_at", datetime.now().isoformat())),
                            tags=result.get("tags", input_data.tags or []),
                            project_id=result.get("project_id", input_data.project_id)
                        )
                    )
                else:
                    output = IndexDocumentOutput(
                        success=False,
                        error="Failed to index document"
                    )

            except BinderyClientError as e:
                # Handle case where RAG is not yet implemented
                if "not yet implemented" in str(e).lower() or "method not found" in str(e).lower():
                    output = IndexDocumentOutput(
                        success=False,
                        error="RAG indexing functionality not yet implemented in Bindery server"
                    )
                else:
                    raise

            return [TextContent(type="text", text=output.model_dump_json(indent=2))]

        except ValidationError as e:
            logger.error(f"Validation error in index_document: {e}")
            output = IndexDocumentOutput(
                success=False,
                error=f"Input validation error: {e}"
            )
            return [TextContent(type="text", text=output.model_dump_json(indent=2))]

        except BinderyClientError as e:
            logger.error(f"Bindery client error in index_document: {e}")
            output = IndexDocumentOutput(
                success=False,
                error=f"Bindery backend error: {e}"
            )
            return [TextContent(type="text", text=output.model_dump_json(indent=2))]

    # Dashboard Tools

    async def get_task_dashboard(self, arguments: Dict[str, Any]) -> List[TextContent | ImageContent | EmbeddedResource]:
        """
        Get task dashboard with statistics and insights.

        Translates MCP input to Bindery get_task_dashboard JSON-RPC call.
        """
        try:
            # Validate input
            input_data = GetTaskDashboardInput(**arguments)

            logger.info(f"Getting task dashboard for project: {input_data.project_id or 'all'}")

            # Call Bindery backend
            result = await self._call_bindery("get_task_dashboard", {
                "project_id": input_data.project_id
            } if input_data.project_id else {})

            # Format response with mock data structure since Bindery might return simple format
            if result:
                # TODO: Parse actual Bindery dashboard format when implemented
                from .models import TaskStatistics, ProjectStatistics, RAGStatistics

                output = GetTaskDashboardOutput(
                    success=True,
                    message="Dashboard generated successfully",
                    task_stats=TaskStatistics(
                        total=result.get("total_tasks", 0),
                        by_status=result.get("by_status", {}),
                        by_priority=result.get("by_priority", {}),
                        completion_rate=result.get("completion_rate", 0.0),
                        overdue=result.get("overdue_tasks", 0)
                    ),
                    project_stats=ProjectStatistics(
                        total_projects=result.get("total_projects", 1),
                        active_projects=result.get("active_projects", 1),
                        project_health=result.get("project_health", {})
                    ),
                    rag_stats=RAGStatistics(
                        total_documents=result.get("total_documents", 0),
                        total_chunks=result.get("total_chunks", 0),
                        index_size_bytes=result.get("index_size_bytes", 0),
                        last_indexed=datetime.fromisoformat(result["last_indexed"]) if result.get("last_indexed") else None
                    ),
                    generated_at=datetime.now()
                )
            else:
                output = GetTaskDashboardOutput(
                    success=False,
                    error="Failed to generate dashboard",
                    task_stats=TaskStatistics(total=0, completion_rate=0.0),
                    project_stats=ProjectStatistics(total_projects=0, active_projects=0),
                    rag_stats=RAGStatistics(total_documents=0, total_chunks=0, index_size_bytes=0),
                    generated_at=datetime.now()
                )

            return [TextContent(type="text", text=output.model_dump_json(indent=2))]

        except ValidationError as e:
            logger.error(f"Validation error in get_task_dashboard: {e}")
            from .models import TaskStatistics, ProjectStatistics, RAGStatistics
            output = GetTaskDashboardOutput(
                success=False,
                error=f"Input validation error: {e}",
                task_stats=TaskStatistics(total=0, completion_rate=0.0),
                project_stats=ProjectStatistics(total_projects=0, active_projects=0),
                rag_stats=RAGStatistics(total_documents=0, total_chunks=0, index_size_bytes=0),
                generated_at=datetime.now()
            )
            return [TextContent(type="text", text=output.model_dump_json(indent=2))]

        except BinderyClientError as e:
            logger.error(f"Bindery client error in get_task_dashboard: {e}")
            from .models import TaskStatistics, ProjectStatistics, RAGStatistics
            output = GetTaskDashboardOutput(
                success=False,
                error=f"Bindery backend error: {e}",
                task_stats=TaskStatistics(total=0, completion_rate=0.0),
                project_stats=ProjectStatistics(total_projects=0, active_projects=0),
                rag_stats=RAGStatistics(total_documents=0, total_chunks=0, index_size_bytes=0),
                generated_at=datetime.now()
            )
            return [TextContent(type="text", text=output.model_dump_json(indent=2))]


# Tool definitions for MCP server
def get_tool_definitions() -> List[Tool]:
    """
    Get MCP tool definitions for Bindery integration.

    Returns:
        List of Tool objects for MCP server registration
    """
    return [
        Tool(
            name="create_task",
            description="Create a new task in the Bindery backend",
            inputSchema={
                "type": "object",
                "properties": {
                    "task": {
                        "type": "object",
                        "properties": {
                            "title": {"type": "string", "description": "Task title"},
                            "description": {"type": "string", "description": "Task description"},
                            "priority": {"type": "string", "enum": ["low", "normal", "high", "urgent"], "description": "Task priority"},
                            "status": {"type": "string", "enum": ["todo", "doing", "done", "blocked", "cancelled"], "description": "Task status"},
                            "project_id": {"type": "string", "description": "Project ID"},
                            "parent_id": {"type": "string", "description": "Parent task ID"},
                            "tags": {"type": "array", "items": {"type": "string"}, "description": "Task tags"},
                            "labels": {"type": "object", "description": "Task labels"},
                            "subtasks": {"type": "array", "description": "Subtasks"}
                        },
                        "required": ["title"]
                    }
                },
                "required": ["task"]
            }
        ),
        Tool(
            name="get_task",
            description="Get a task by ID from the Bindery backend",
            inputSchema={
                "type": "object",
                "properties": {
                    "task_id": {"type": "string", "description": "Task ID to retrieve"}
                },
                "required": ["task_id"]
            }
        ),
        Tool(
            name="update_task",
            description="Update a task in the Bindery backend",
            inputSchema={
                "type": "object",
                "properties": {
                    "task_id": {"type": "string", "description": "Task ID to update"},
                    "updates": {"type": "object", "description": "Fields to update"}
                },
                "required": ["task_id", "updates"]
            }
        ),
        Tool(
            name="list_tasks",
            description="List tasks from the Bindery backend with optional filters",
            inputSchema={
                "type": "object",
                "properties": {
                    "project_id": {"type": "string", "description": "Filter by project ID"},
                    "status": {"type": "string", "enum": ["todo", "doing", "done", "blocked", "cancelled"], "description": "Filter by status"},
                    "priority": {"type": "string", "enum": ["low", "normal", "high", "urgent"], "description": "Filter by priority"},
                    "parent_id": {"type": "string", "description": "Filter by parent task ID"},
                    "limit": {"type": "integer", "description": "Maximum number of tasks to return"},
                    "offset": {"type": "integer", "description": "Number of tasks to skip"}
                }
            }
        ),
        Tool(
            name="execute_task",
            description="Execute a task with optional role assignment",
            inputSchema={
                "type": "object",
                "properties": {
                    "task_id": {"type": "string", "description": "Task ID to execute"},
                    "role": {"type": "string", "description": "Role to execute task with"},
                    "dry_run": {"type": "boolean", "description": "Whether to perform a dry run"}
                },
                "required": ["task_id"]
            }
        ),
        Tool(
            name="search_rag",
            description="Search the RAG system for relevant documents",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query"},
                    "limit": {"type": "integer", "description": "Maximum number of results"},
                    "project_id": {"type": "string", "description": "Filter by project ID"},
                    "document_type": {"type": "string", "enum": ["text", "code", "markdown", "documentation", "configuration", "data"], "description": "Filter by document type"},
                    "min_score": {"type": "number", "description": "Minimum similarity score"}
                },
                "required": ["query"]
            }
        ),
        Tool(
            name="index_document",
            description="Index a document in the RAG system",
            inputSchema={
                "type": "object",
                "properties": {
                    "content": {"type": "string", "description": "Document content to index"},
                    "title": {"type": "string", "description": "Document title"},
                    "document_type": {"type": "string", "enum": ["text", "code", "markdown", "documentation", "configuration", "data"], "description": "Document type"},
                    "source_path": {"type": "string", "description": "Source file path"},
                    "tags": {"type": "array", "items": {"type": "string"}, "description": "Document tags"},
                    "project_id": {"type": "string", "description": "Project ID"}
                },
                "required": ["content", "title"]
            }
        ),
        Tool(
            name="get_task_dashboard",
            description="Get task dashboard with statistics and insights",
            inputSchema={
                "type": "object",
                "properties": {
                    "project_id": {"type": "string", "description": "Filter by project ID"}
                }
            }
        ),
        Tool(
            name="delete_task",
            description="Delete a task by ID from the Bindery backend",
            inputSchema={
                "type": "object",
                "properties": {
                    "task_id": {"type": "string", "description": "Task ID to delete"}
                },
                "required": ["task_id"]
            }
        ),
        Tool(
            name="complete_task",
            description="Mark a task as completed in the Bindery backend",
            inputSchema={
                "type": "object",
                "properties": {
                    "task_id": {"type": "string", "description": "Task ID to mark as completed"},
                    "completion_notes": {"type": "string", "description": "Optional completion notes"}
                },
                "required": ["task_id"]
            }
        ),
        Tool(
            name="create_task_tree",
            description="Create a hierarchical task tree structure in the Bindery backend",
            inputSchema={
                "type": "object",
                "properties": {
                    "root_task": {
                        "type": "object",
                        "properties": {
                            "title": {"type": "string", "description": "Root task title"},
                            "description": {"type": "string", "description": "Root task description"},
                            "priority": {"type": "string", "enum": ["low", "normal", "high", "urgent"], "description": "Root task priority"},
                            "status": {"type": "string", "enum": ["todo", "doing", "done", "blocked", "cancelled"], "description": "Root task status"},
                            "project_id": {"type": "string", "description": "Project ID"},
                            "tags": {"type": "array", "items": {"type": "string"}, "description": "Root task tags"},
                            "labels": {"type": "object", "description": "Root task labels"}
                        },
                        "required": ["title"]
                    },
                    "children": {
                        "type": "array",
                        "description": "Child task trees",
                        "items": {
                            "type": "object",
                            "description": "Child task tree structure (recursive)"
                        }
                    }
                },
                "required": ["root_task"]
            }
        ),
        Tool(
            name="get_task_tree",
            description="Get a task tree with parent-child relationships from the Bindery backend",
            inputSchema={
                "type": "object",
                "properties": {
                    "root_task_id": {"type": "string", "description": "Root task ID"},
                    "max_depth": {"type": "integer", "description": "Maximum depth to retrieve"},
                    "include_completed": {"type": "boolean", "description": "Whether to include completed tasks"}
                },
                "required": ["root_task_id"]
            }
        ),
        Tool(
            name="assign_role_to_task",
            description="Assign a role to execute a task in the Bindery backend",
            inputSchema={
                "type": "object",
                "properties": {
                    "task_id": {"type": "string", "description": "Task ID"},
                    "role_name": {"type": "string", "description": "Role name to assign"}
                },
                "required": ["task_id", "role_name"]
            }
        ),
        Tool(
            name="list_roles",
            description="List available roles and their capabilities from the Bindery backend",
            inputSchema={
                "type": "object",
                "properties": {
                    "include_capabilities": {"type": "boolean", "description": "Whether to include role capabilities"}
                }
            }
        )
    ]