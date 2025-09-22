"""
HTTP client for communicating with the Rust Bindery backend.
Handles all HTTP requests and response parsing for the MCP server.
Includes resilience patterns like circuit breaker, retry logic, and caching.
"""

import asyncio
import os
import structlog
from typing import Optional, List, Dict, Any, Union
from datetime import datetime
from httpx import AsyncClient, HTTPError, ConnectError, TimeoutException, Limits
from pydantic import ValidationError
from urllib.parse import urlparse

from resilience import ResilienceManager
from models import (
    TaskInput, TaskOutput, TaskUpdateInput, TaskStatus, TaskPriority,
    ProjectInput, ProjectOutput,
    SearchInput, SearchOutput,
    NoteInput, NoteOutput,
    DashboardStats,
    BinderyError,
    SuccessResponse,
    ListResponse,
    DocumentInput
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
    Includes resilience patterns: circuit breaker, retry logic, and caching.
    """

    def __init__(
        self,
        base_url: str = "http://localhost:3000",
        timeout: Optional[float] = None,
        max_connections: int = 10,
        max_keepalive_connections: int = 5,
        max_request_size: int = 10 * 1024 * 1024,  # 10MB
        max_response_size: int = 50 * 1024 * 1024,  # 50MB
        role_context_limits: Optional[Dict[str, int]] = None
    ):
        # Validate URL
        self._validate_url(base_url)
        self.base_url = base_url.rstrip('/')

        # Get timeout from environment or use default
        self.timeout = timeout or float(os.getenv('BINDERY_TIMEOUT', '30.0'))

        # Connection pool configuration
        self.max_connections = max_connections
        self.max_keepalive_connections = max_keepalive_connections

        # Size limits
        self.max_request_size = max_request_size
        self.max_response_size = max_response_size

        # Role-based context limits (for different AI models)
        self.role_context_limits = role_context_limits or {
            "gpt-3.5": 4096,
            "gpt-4": 8192,
            "claude-instant": 100000,
            "claude-2": 200000,
            "default": 8192
        }

        self._client: Optional[AsyncClient] = None

        # Initialize resilience manager
        self.resilience = ResilienceManager(
            enable_circuit_breaker=True,
            enable_retry=True,
            enable_cache=True,
            cache_ttl=float(os.getenv('BINDERY_CACHE_TTL', '300'))
        )

        # Background health check task
        self._health_check_task: Optional[asyncio.Task] = None
        self._last_health_status: Dict[str, Any] = {"status": "unknown"}

    def _validate_url(self, url: str):
        """Validate URL format and scheme."""
        try:
            parsed = urlparse(url)
            if not parsed.scheme:
                raise BinderyClientError(f"Invalid URL: missing scheme - {url}")
            if parsed.scheme not in ['http', 'https']:
                raise BinderyClientError(f"Invalid URL scheme: {parsed.scheme}")
            if not parsed.netloc:
                raise BinderyClientError(f"Invalid URL: missing netloc - {url}")
        except Exception as e:
            raise BinderyClientError(f"Invalid URL: {url} - {e}")

    def get_context_limit_for_role(self, role_name: str) -> int:
        """Get context limit for a specific role based on its model."""
        # Map role names to models (this would come from role configuration)
        role_model_map = {
            "developer": "gpt-4",
            "researcher": "claude-2",
            "writer": "gpt-3.5",
            "analyst": "claude-instant"
        }

        model = role_model_map.get(role_name, "default")
        return self.role_context_limits.get(model, self.role_context_limits["default"])

    async def __aenter__(self):
        """Async context manager entry with error handling."""
        try:
            # Configure connection pooling and limits
            limits = Limits(
                max_connections=self.max_connections,
                max_keepalive_connections=self.max_keepalive_connections
            )

            self._client = AsyncClient(
                base_url=self.base_url,
                timeout=self.timeout,
                follow_redirects=False,  # Don't auto-follow to prevent redirect abuse
                limits=limits,
                max_redirects=3
            )

            # Start background health check
            self._health_check_task = asyncio.create_task(self._background_health_check())

            return self
        except Exception as e:
            logger.error(f"Failed to initialize Bindery client: {e}")
            raise BinderyClientError(f"Client initialization failed: {e}")

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        # Cancel health check task
        if self._health_check_task:
            self._health_check_task.cancel()
            try:
                await self._health_check_task
            except asyncio.CancelledError:
                pass

        # Close HTTP client
        if self._client:
            await self._client.aclose()
            self._client = None

    async def _background_health_check(self):
        """Background task to monitor backend health."""
        while True:
            try:
                await asyncio.sleep(30)  # Check every 30 seconds

                # Perform health check
                try:
                    response = await self._client.get("/health", timeout=5)
                    if response.status_code == 200:
                        self._last_health_status = {
                            "status": "healthy",
                            "timestamp": asyncio.get_event_loop().time()
                        }
                    else:
                        self._last_health_status = {
                            "status": "degraded",
                            "status_code": response.status_code,
                            "timestamp": asyncio.get_event_loop().time()
                        }
                except Exception as e:
                    self._last_health_status = {
                        "status": "unhealthy",
                        "error": str(e),
                        "timestamp": asyncio.get_event_loop().time()
                    }

                logger.debug(f"Health check: {self._last_health_status['status']}")

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Health check error: {e}")

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

        # Check request size
        if json_data:
            import json
            request_size = len(json.dumps(json_data))
            if request_size > self.max_request_size:
                raise BinderyClientError(
                    f"Request too large: {request_size} bytes",
                    status_code=413,
                    details={"max_size": self.max_request_size}
                )

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

            # Check response size
            content_length = response.headers.get('content-length')
            if content_length and int(content_length) > self.max_response_size:
                raise BinderyClientError(
                    f"Response too large: {content_length} bytes",
                    status_code=413,
                    details={"url": url, "max_size": self.max_response_size}
                )

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

            # Check content type before parsing JSON
            content_type = response.headers.get('content-type', '')
            if 'application/json' not in content_type.lower():
                logger.warning(f"Unexpected content type: {content_type}")

            # Parse successful response
            try:
                return response.json()
            except ValueError as e:
                logger.error(f"Failed to parse JSON response: {e}")
                # Return raw text as fallback
                return {"raw_response": response.text}

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
        except BinderyClientError:
            # Re-raise our own errors
            raise
        except Exception as e:
            logger.error("Unexpected error", error=str(e), url=url)
            raise BinderyClientError(f"Unexpected error: {e}")

    # Task Management Methods with Resilience
    async def create_task(self, task_input: TaskInput) -> TaskOutput:
        """Create a new task with resilience patterns."""
        async def _create():
            response_data = await self._request(
                "POST",
                "/api/tasks",
                json_data=task_input.model_dump()
            )
            try:
                return TaskOutput(**response_data)
            except ValidationError as e:
                logger.warning(f"Task output validation failed, using fallback: {e}")
                # Return with minimal required fields
                return TaskOutput(
                    id=response_data.get("id", "unknown"),
                    title=response_data.get("title", task_input.title),
                    status=TaskStatus.TODO,
                    priority=TaskPriority.NORMAL,
                    created_at=datetime.now(),
                    updated_at=datetime.now()
                )

        return await self.resilience.execute_with_resilience(
            "create_task", _create, use_cache=False
        )

    async def get_task(self, task_id: str) -> TaskOutput:
        """Get a task by ID with resilience patterns."""
        async def _get():
            response_data = await self._request("GET", f"/api/tasks/{task_id}")
            try:
                return TaskOutput(**response_data)
            except ValidationError as e:
                logger.warning(f"Task output validation failed: {e}")
                return TaskOutput(
                    id=task_id,
                    title=response_data.get("title", "Unknown"),
                    status=TaskStatus.TODO,
                    priority=TaskPriority.NORMAL,
                    created_at=datetime.now(),
                    updated_at=datetime.now()
                )

        return await self.resilience.execute_with_resilience(
            "get_task", _get, cache_params={"task_id": task_id}
        )

    async def update_task(self, task_id: str, task_update: TaskUpdateInput) -> TaskOutput:
        """Update a task with resilience patterns."""
        async def _update():
            response_data = await self._request(
                "PUT",
                f"/api/tasks/{task_id}",
                json_data=task_update.model_dump(exclude_none=True)
            )
            try:
                return TaskOutput(**response_data)
            except ValidationError as e:
                logger.warning(f"Task output validation failed: {e}")
                return TaskOutput(
                    id=task_id,
                    title=response_data.get("title", "Unknown"),
                    status=TaskStatus.TODO,
                    priority=TaskPriority.NORMAL,
                    created_at=datetime.now(),
                    updated_at=datetime.now()
                )

        return await self.resilience.execute_with_resilience(
            "update_task", _update, use_cache=False
        )

    async def list_tasks(
        self,
        project_id: Optional[str] = None,
        status: Optional[str] = None
    ) -> ListResponse:
        """List tasks with filters and resilience patterns."""
        async def _list():
            params = {}
            if project_id:
                params['project_id'] = project_id
            if status:
                params['status'] = status

            response_data = await self._request("GET", "/api/tasks", params=params)

            # Transform to ListResponse
            if isinstance(response_data, list):
                return ListResponse(items=response_data, total=len(response_data))
            elif isinstance(response_data, dict) and 'items' in response_data:
                return ListResponse(**response_data)
            else:
                return ListResponse(items=[response_data], total=1)

        return await self.resilience.execute_with_resilience(
            "list_tasks", _list,
            cache_params={"project_id": project_id, "status": status}
        )

    async def delete_task(self, task_id: str) -> Dict[str, Any]:
        """Delete a task by ID."""
        async def _delete():
            return await self._request("DELETE", f"/api/tasks/{task_id}")

        return await self.resilience.execute_with_resilience(
            "delete_task", _delete, use_cache=False
        )

    async def execute_task(self, task_id: str, role_name: str) -> Dict[str, Any]:
        """Execute a task with a role."""
        async def _execute():
            return await self._request(
                "POST",
                f"/api/tasks/{task_id}/execute",
                json_data={"role": role_name}
            )

        return await self.resilience.execute_with_resilience(
            "execute_task", _execute, use_cache=False
        )

    async def assign_role(self, task_id: str, role_name: str) -> Dict[str, Any]:
        """Assign a role to a task."""
        async def _assign():
            return await self._request(
                "POST",
                f"/api/tasks/{task_id}/assign-role",
                json_data={"role": role_name}
            )

        return await self.resilience.execute_with_resilience(
            "assign_role_to_task", _assign, use_cache=False
        )

    async def list_roles(self) -> Dict[str, Any]:
        """List all available roles."""
        async def _list():
            return await self._request("GET", "/api/roles")

        return await self.resilience.execute_with_resilience(
            "list_roles", _list, use_cache=True
        )

    async def index_document(self, document_input: 'DocumentInput') -> Dict[str, Any]:
        """Index a document for RAG."""
        async def _index():
            return await self._request(
                "POST",
                "/api/rag/index",
                json_data=document_input.model_dump()
            )

        return await self.resilience.execute_with_resilience(
            "index_document", _index, use_cache=False
        )

    # Project Management Methods
    async def create_project(self, project_input: ProjectInput) -> ProjectOutput:
        """Create a new project."""
        async def _create():
            response_data = await self._request(
                "POST",
                "/api/projects",
                json_data=project_input.model_dump()
            )
            try:
                return ProjectOutput(**response_data)
            except ValidationError as e:
                logger.warning(f"Project validation failed: {e}")
                return ProjectOutput(
                    id=response_data.get("id", "unknown"),
                    name=response_data.get("name", project_input.name),
                    task_count=0,
                    created_at=datetime.now(),
                    updated_at=datetime.now()
                )

        return await self.resilience.execute_with_resilience(
            "create_project", _create, use_cache=False
        )

    # Search Methods
    async def search(self, search_input: SearchInput) -> SearchOutput:
        """Search across entities with resilience."""
        async def _search():
            response_data = await self._request(
                "POST",
                "/api/search",
                json_data=search_input.model_dump()
            )
            try:
                return SearchOutput(**response_data)
            except ValidationError as e:
                logger.warning(f"Search output validation failed: {e}")
                return SearchOutput(
                    query=search_input.query,
                    total_results=0,
                    results=[]
                )

        return await self.resilience.execute_with_resilience(
            "search_entities", _search,
            cache_params={"query": search_input.query}
        )

    # Dashboard Methods
    async def get_dashboard_stats(self) -> DashboardStats:
        """Get dashboard statistics with resilience."""
        async def _get_stats():
            response_data = await self._request("GET", "/api/dashboard/stats")
            try:
                return DashboardStats(**response_data)
            except ValidationError as e:
                logger.warning(f"Dashboard stats validation failed: {e}")
                return DashboardStats()

        return await self.resilience.execute_with_resilience(
            "get_dashboard_stats", _get_stats, use_cache=True
        )

    # Health Check Method
    async def health_check(self) -> Dict[str, Any]:
        """Check backend health status with resilience."""
        async def _health():
            try:
                response = await self._client.get("/health", timeout=5)
                return {
                    "status": "healthy" if response.status_code == 200 else "degraded",
                    "status_code": response.status_code,
                    "resilience": self.resilience.get_status()
                }
            except Exception as e:
                return {
                    "status": "unhealthy",
                    "error": str(e),
                    "resilience": self.resilience.get_status()
                }

        # Use cached health status if circuit is open
        if self.resilience.circuit_breaker and \
           self.resilience.circuit_breaker.state.value == "open":
            return self._last_health_status

        return await self.resilience.execute_with_resilience(
            "health_check", _health, use_cache=True
        )


# Helper function for context managers
async def with_bindery_client(**kwargs):
    """Helper to create and use BinderyClient in async context."""
    async with BinderyClient(**kwargs) as client:
        return client