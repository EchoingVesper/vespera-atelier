"""
HTTP client for communicating with Vespera Bindery JSON-RPC server.

This module provides a client for making JSON-RPC 2.0 calls to the
Rust Bindery backend server.
"""

import asyncio
import json
import logging
from typing import Any, Dict, Optional, Union
from uuid import uuid4

import aiohttp
from aiohttp import ClientTimeout, ClientError

from .models import JsonRpcRequest, JsonRpcResponse, JsonRpcError


logger = logging.getLogger(__name__)


class BinderyClientError(Exception):
    """Base exception for Bindery client errors."""
    pass


class BinderyConnectionError(BinderyClientError):
    """Exception raised when connection to Bindery server fails."""
    pass


class BinderyRpcError(BinderyClientError):
    """Exception raised when JSON-RPC call returns an error."""

    def __init__(self, code: int, message: str, data: Optional[Any] = None):
        self.code = code
        self.message = message
        self.data = data
        super().__init__(f"RPC Error {code}: {message}")


class BinderyClient:
    """
    HTTP client for Vespera Bindery JSON-RPC server.

    Provides async methods for making JSON-RPC 2.0 calls to the Rust backend.
    Handles connection pooling, timeouts, retries, and error handling.
    """

    def __init__(
        self,
        base_url: str = "http://localhost:8080",
        timeout: float = 30.0,
        max_retries: int = 3,
        retry_delay: float = 1.0,
        session: Optional[aiohttp.ClientSession] = None
    ):
        """
        Initialize the Bindery client.

        Args:
            base_url: Base URL of the Bindery server
            timeout: Request timeout in seconds
            max_retries: Maximum number of retry attempts
            retry_delay: Delay between retries in seconds
            session: Optional existing aiohttp session
        """
        self.base_url = base_url.rstrip('/')
        self.rpc_url = f"{self.base_url}/jsonrpc"
        self.timeout = ClientTimeout(total=timeout)
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self._session = session
        self._owns_session = session is None
        self._closed = False

    async def __aenter__(self):
        """Async context manager entry."""
        if self._session is None:
            self._session = aiohttp.ClientSession(timeout=self.timeout)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.close()

    async def close(self):
        """Close the client and cleanup resources."""
        if not self._closed and self._owns_session and self._session:
            await self._session.close()
            self._closed = True

    @property
    def session(self) -> aiohttp.ClientSession:
        """Get the HTTP session, creating one if necessary."""
        if self._session is None:
            self._session = aiohttp.ClientSession(timeout=self.timeout)
            self._owns_session = True
        return self._session

    async def call(
        self,
        method: str,
        params: Optional[Dict[str, Any]] = None,
        request_id: Optional[Union[str, int]] = None
    ) -> Any:
        """
        Make a JSON-RPC 2.0 call to the Bindery server.

        Args:
            method: RPC method name
            params: Method parameters
            request_id: Optional request ID (generated if not provided)

        Returns:
            The result field from the JSON-RPC response

        Raises:
            BinderyConnectionError: If connection fails
            BinderyRpcError: If RPC call returns an error
            BinderyClientError: For other client errors
        """
        if request_id is None:
            request_id = str(uuid4())

        request = JsonRpcRequest(
            method=method,
            params=params,
            id=request_id
        )

        logger.debug(f"Making RPC call: {method} with params: {params}")

        for attempt in range(self.max_retries + 1):
            try:
                async with self.session.post(
                    self.rpc_url,
                    json=request.model_dump(exclude_none=True),
                    headers={"Content-Type": "application/json"}
                ) as response:
                    if response.status == 200:
                        response_data = await response.json()
                        rpc_response = JsonRpcResponse(**response_data)

                        if rpc_response.error:
                            error = JsonRpcError(**rpc_response.error)
                            raise BinderyRpcError(
                                code=error.code,
                                message=error.message,
                                data=error.data
                            )

                        logger.debug(f"RPC call successful: {method}")
                        return rpc_response.result

                    else:
                        error_text = await response.text()
                        raise BinderyConnectionError(
                            f"HTTP {response.status}: {error_text}"
                        )

            except (ClientError, asyncio.TimeoutError) as e:
                if attempt == self.max_retries:
                    raise BinderyConnectionError(
                        f"Failed to connect to Bindery server after {self.max_retries + 1} attempts: {e}"
                    )

                logger.warning(
                    f"Attempt {attempt + 1} failed for {method}: {e}. "
                    f"Retrying in {self.retry_delay}s..."
                )
                await asyncio.sleep(self.retry_delay)

            except json.JSONDecodeError as e:
                raise BinderyClientError(f"Invalid JSON response: {e}")

    async def health_check(self) -> Dict[str, Any]:
        """
        Check if the Bindery server is healthy.

        Returns:
            Health status information
        """
        try:
            return await self.call("version_info")
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return {
                "status": "unhealthy",
                "error": str(e)
            }

    # Task Management Methods

    async def create_task(self, task_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new task."""
        return await self.call("create_task", task_data)

    async def get_task(self, task_id: str) -> Dict[str, Any]:
        """Get task by ID."""
        return await self.call("get_task", {"id": task_id})

    async def update_task(self, task_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update task by ID."""
        return await self.call("update_task", {"id": task_id, **updates})

    async def delete_task(self, task_id: str) -> Dict[str, Any]:
        """Delete task by ID."""
        return await self.call("delete_task", {"id": task_id})

    async def list_tasks(self, filters: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """List tasks with optional filters."""
        return await self.call("list_tasks", filters or {})

    async def complete_task(self, task_id: str) -> Dict[str, Any]:
        """Mark task as completed."""
        return await self.call("complete_task", {"id": task_id})

    async def get_task_dashboard(self, project_id: Optional[str] = None) -> Dict[str, Any]:
        """Get task dashboard statistics."""
        params = {"project_id": project_id} if project_id else {}
        return await self.call("get_task_dashboard", params)

    # Role Management Methods

    async def list_roles(self) -> Dict[str, Any]:
        """List available roles."""
        return await self.call("list_roles")

    async def assign_role_to_task(self, task_id: str, role_name: str) -> Dict[str, Any]:
        """Assign a role to a task."""
        return await self.call("assign_role_to_task", {
            "task_id": task_id,
            "role_name": role_name
        })

    # Codex Management Methods

    async def list_codices(self) -> Dict[str, Any]:
        """List available codices."""
        return await self.call("list_codices")

    async def create_codex(self, codex_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new codex."""
        return await self.call("create_codex", codex_data)

    async def get_codex(self, codex_id: str) -> Dict[str, Any]:
        """Get codex by ID."""
        return await self.call("get_codex", {"id": codex_id})

    async def delete_codex(self, codex_id: str) -> Dict[str, Any]:
        """Delete codex by ID."""
        return await self.call("delete_codex", {"id": codex_id})

    # RAG/Search Methods (Note: These may not be implemented in the Rust server yet)

    async def index_document(self, document_data: Dict[str, Any]) -> Dict[str, Any]:
        """Index a document for search."""
        try:
            return await self.call("index_document", document_data)
        except BinderyRpcError as e:
            if e.code == -32601:  # Method not found
                logger.warning("RAG indexing not yet implemented in Bindery server")
                return {
                    "success": False,
                    "error": "RAG functionality not yet implemented in Bindery server"
                }
            raise

    async def search_documents(self, query: str, filters: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Search indexed documents."""
        try:
            params = {"query": query}
            if filters:
                params.update(filters)
            return await self.call("search_documents", params)
        except BinderyRpcError as e:
            if e.code == -32601:  # Method not found
                logger.warning("RAG search not yet implemented in Bindery server")
                return {
                    "success": False,
                    "error": "RAG functionality not yet implemented in Bindery server",
                    "results": []
                }
            raise


# Default client instance
_default_client: Optional[BinderyClient] = None


def get_default_client() -> BinderyClient:
    """Get the default Bindery client instance."""
    global _default_client
    if _default_client is None:
        _default_client = BinderyClient()
    return _default_client


async def call_bindery_method(
    method: str,
    params: Optional[Dict[str, Any]] = None,
    client: Optional[BinderyClient] = None
) -> Any:
    """
    Convenience function for making Bindery RPC calls.

    Args:
        method: RPC method name
        params: Method parameters
        client: Optional client instance (uses default if not provided)

    Returns:
        The result from the RPC call
    """
    if client is None:
        client = get_default_client()

    return await client.call(method, params)