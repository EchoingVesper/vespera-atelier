"""
HTTP client for communicating with the Rust Bindery backend.
Handles all HTTP requests and response parsing for the MCP server.
"""

import asyncio
import structlog
from typing import Optional, List, Dict, Any, Union
from httpx import AsyncClient, HTTPError, ConnectError, TimeoutException
from pydantic import ValidationError

from models import (
    TaskInput, TaskOutput, TaskUpdateInput,
    ProjectInput, ProjectOutput,
    SearchInput, SearchOutput,
    NoteInput, NoteOutput,
    DashboardStats,
    BinderyError,
    SuccessResponse,
    ListResponse
)

logger = structlog.get_logger()


class BinderyClientError(Exception):
    """Custom exception for Bindery client errors."""
    def __init__(self, message: str, status_code: Optional[int] = None, details: Optional[Dict] = None):
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(message)


class BinderyClient:
    """
    Async HTTP client for the Rust Bindery backend.
    Provides a clean interface for all MCP server operations.
    """

    def __init__(self, base_url: str = "http://localhost:3000", timeout: float = 30.0):
        self.base_url = base_url.rstrip('/')
        self.timeout = timeout
        self._client: Optional[AsyncClient] = None

    async def __aenter__(self):
        """Async context manager entry."""
        self._client = AsyncClient(
            base_url=self.base_url,
            timeout=self.timeout,
            follow_redirects=True
        )
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if self._client:
            await self._client.aclose()
            self._client = None

    async def _request(
        self,
        method: str,
        endpoint: str,
        json_data: Optional[Dict] = None,
        params: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Make an HTTP request to the Bindery backend with proper error handling.

        Args:
            method: HTTP method (GET, POST, PUT, DELETE)
            endpoint: API endpoint path
            json_data: JSON payload for request body
            params: Query parameters

        Returns:
            Dict containing the JSON response

        Raises:
            BinderyClientError: For various HTTP and connection errors
        """
        if not self._client:
            raise BinderyClientError("Client not initialized. Use async context manager.")

        url = f"{endpoint}"
        if not url.startswith('/'):
            url = f"/{url}"

        try:
            logger.debug("Making request to Bindery", method=method, url=url, has_data=json_data is not None)

            response = await self._client.request(
                method=method,
                url=url,
                json=json_data,
                params=params
            )

            # Log response status
            logger.debug("Bindery response", status_code=response.status_code, url=url)

            # Handle HTTP errors
            if response.status_code >= 400:
                try:
                    error_data = response.json()
                    error_msg = error_data.get('error', f'HTTP {response.status_code}')
                    raise BinderyClientError(
                        message=error_msg,
                        status_code=response.status_code,
                        details=error_data
                    )
                except ValueError:
                    # Not JSON response
                    raise BinderyClientError(
                        message=f"HTTP {response.status_code}: {response.text}",
                        status_code=response.status_code
                    )

            # Parse successful response
            try:
                return response.json()
            except ValueError as e:
                raise BinderyClientError(f"Invalid JSON response: {e}")

        except ConnectError as e:
            logger.error("Cannot connect to Bindery backend", error=str(e), url=self.base_url)
            raise BinderyClientError(
                f"Cannot connect to Bindery backend at {self.base_url}. "
                f"Please ensure the Rust Bindery server is running."
            )
        except TimeoutException as e:
            logger.error("Request timeout", error=str(e), url=url)
            raise BinderyClientError(f"Request timeout: {e}")
        except HTTPError as e:
            logger.error("HTTP error", error=str(e), url=url)
            raise BinderyClientError(f"HTTP error: {e}")
        except Exception as e:
            logger.error("Unexpected error", error=str(e), url=url)
            raise BinderyClientError(f"Unexpected error: {e}")

    # Task Management Methods
    async def create_task(self, task_input: TaskInput) -> TaskOutput:
        """Create a new task in the Bindery backend."""
        try:
            response_data = await self._request("POST", "/api/tasks", task_input.model_dump())
            return TaskOutput(**response_data)
        except ValidationError as e:
            raise BinderyClientError(f"Invalid task data from backend: {e}")

    async def get_task(self, task_id: str) -> TaskOutput:
        """Retrieve a task by ID."""
        try:
            response_data = await self._request("GET", f"/api/tasks/{task_id}")
            return TaskOutput(**response_data)
        except ValidationError as e:
            raise BinderyClientError(f"Invalid task data from backend: {e}")

    async def update_task(self, task_id: str, task_update: TaskUpdateInput) -> TaskOutput:
        """Update an existing task."""
        try:
            response_data = await self._request("PUT", f"/api/tasks/{task_id}", task_update.model_dump(exclude_none=True))
            return TaskOutput(**response_data)
        except ValidationError as e:
            raise BinderyClientError(f"Invalid task data from backend: {e}")

    async def delete_task(self, task_id: str) -> SuccessResponse:
        """Delete a task by ID."""
        response_data = await self._request("DELETE", f"/api/tasks/{task_id}")
        return SuccessResponse(**response_data)

    async def list_tasks(self, project_id: Optional[str] = None, status: Optional[str] = None) -> ListResponse:
        """List tasks with optional filtering."""
        params = {}
        if project_id:
            params['project_id'] = project_id
        if status:
            params['status'] = status

        response_data = await self._request("GET", "/api/tasks", params=params)
        return ListResponse(**response_data)

    # Project Management Methods
    async def create_project(self, project_input: ProjectInput) -> ProjectOutput:
        """Create a new project."""
        try:
            response_data = await self._request("POST", "/api/projects", project_input.model_dump())
            return ProjectOutput(**response_data)
        except ValidationError as e:
            raise BinderyClientError(f"Invalid project data from backend: {e}")

    async def get_project(self, project_id: str) -> ProjectOutput:
        """Retrieve a project by ID."""
        try:
            response_data = await self._request("GET", f"/api/projects/{project_id}")
            return ProjectOutput(**response_data)
        except ValidationError as e:
            raise BinderyClientError(f"Invalid project data from backend: {e}")

    async def list_projects(self) -> ListResponse:
        """List all projects."""
        response_data = await self._request("GET", "/api/projects")
        return ListResponse(**response_data)

    # Search Methods
    async def search(self, search_input: SearchInput) -> SearchOutput:
        """Perform a search across entities."""
        try:
            response_data = await self._request("POST", "/api/search", search_input.model_dump())
            return SearchOutput(**response_data)
        except ValidationError as e:
            raise BinderyClientError(f"Invalid search data from backend: {e}")

    # Note Management Methods
    async def create_note(self, note_input: NoteInput) -> NoteOutput:
        """Create a new note."""
        try:
            response_data = await self._request("POST", "/api/notes", note_input.model_dump())
            return NoteOutput(**response_data)
        except ValidationError as e:
            raise BinderyClientError(f"Invalid note data from backend: {e}")

    async def get_note(self, note_id: str) -> NoteOutput:
        """Retrieve a note by ID."""
        try:
            response_data = await self._request("GET", f"/api/notes/{note_id}")
            return NoteOutput(**response_data)
        except ValidationError as e:
            raise BinderyClientError(f"Invalid note data from backend: {e}")

    # Dashboard Methods
    async def get_dashboard_stats(self) -> DashboardStats:
        """Get dashboard statistics."""
        try:
            response_data = await self._request("GET", "/api/dashboard/stats")
            return DashboardStats(**response_data)
        except ValidationError as e:
            raise BinderyClientError(f"Invalid dashboard data from backend: {e}")

    # Health Check
    async def health_check(self) -> Dict[str, Any]:
        """Check if the Bindery backend is healthy."""
        try:
            return await self._request("GET", "/health")
        except BinderyClientError:
            # Re-raise as is for health checks
            raise
        except Exception as e:
            raise BinderyClientError(f"Health check failed: {e}")


# Utility function for one-off requests
async def with_bindery_client(
    operation,
    base_url: str = "http://localhost:3000",
    timeout: float = 30.0
):
    """
    Utility function for one-off operations with automatic client lifecycle management.

    Usage:
        result = await with_bindery_client(lambda client: client.get_task("123"))
    """
    async with BinderyClient(base_url, timeout) as client:
        return await operation(client)