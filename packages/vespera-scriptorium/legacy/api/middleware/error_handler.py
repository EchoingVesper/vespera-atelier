"""
Error Handling Middleware

Comprehensive error handling for the Vespera REST API.
Provides consistent error responses and logging.
"""

import logging
import traceback
from typing import Dict, Any
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from pydantic import ValidationError

logger = logging.getLogger(__name__)


def setup_error_handlers(app: FastAPI) -> None:
    """Setup comprehensive error handlers for the FastAPI application."""
    
    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
        """Handle HTTP exceptions with consistent error format."""
        
        error_response = {
            "success": False,
            "error": exc.detail,
            "error_code": exc.status_code,
            "error_type": "http_error",
            "request_id": getattr(request.state, "request_id", None),
            "path": str(request.url.path),
            "method": request.method,
        }
        
        # Add additional context for authentication errors
        if exc.status_code == 401:
            error_response["auth_required"] = True
            error_response["error_hint"] = "Include 'Authorization: Bearer <token>' header"
        elif exc.status_code == 403:
            error_response["permission_denied"] = True
            error_response["error_hint"] = "Check plugin permissions for this operation"
        elif exc.status_code == 404:
            error_response["resource_not_found"] = True
        elif exc.status_code == 429:
            error_response["rate_limited"] = True
            error_response["error_hint"] = "Too many requests, please slow down"
        
        # Log error details
        if exc.status_code >= 500:
            logger.error(f"HTTP {exc.status_code} error: {exc.detail} - Path: {request.url.path}")
        else:
            logger.warning(f"HTTP {exc.status_code} error: {exc.detail} - Path: {request.url.path}")
        
        return JSONResponse(
            status_code=exc.status_code,
            content=error_response
        )
    
    @app.exception_handler(StarletteHTTPException)
    async def starlette_http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        """Handle Starlette HTTP exceptions."""
        
        error_response = {
            "success": False,
            "error": exc.detail,
            "error_code": exc.status_code,
            "error_type": "starlette_error",
            "request_id": getattr(request.state, "request_id", None),
            "path": str(request.url.path),
            "method": request.method,
        }
        
        logger.warning(f"Starlette HTTP {exc.status_code} error: {exc.detail}")
        
        return JSONResponse(
            status_code=exc.status_code,
            content=error_response
        )
    
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        """Handle Pydantic validation errors with detailed field information."""
        
        # Extract detailed validation errors
        validation_errors = []
        for error in exc.errors():
            field_path = " -> ".join(str(loc) for loc in error["loc"])
            validation_errors.append({
                "field": field_path,
                "message": error["msg"],
                "type": error["type"],
                "input_value": error.get("input", "N/A")
            })
        
        error_response = {
            "success": False,
            "error": "Request validation failed",
            "error_code": 422,
            "error_type": "validation_error",
            "validation_errors": validation_errors,
            "request_id": getattr(request.state, "request_id", None),
            "path": str(request.url.path),
            "method": request.method,
            "error_hint": "Check the request format and required fields"
        }
        
        logger.warning(f"Validation error on {request.method} {request.url.path}: {len(validation_errors)} field errors")
        
        return JSONResponse(
            status_code=422,
            content=error_response
        )
    
    @app.exception_handler(ValidationError)
    async def pydantic_validation_exception_handler(request: Request, exc: ValidationError) -> JSONResponse:
        """Handle Pydantic model validation errors."""
        
        validation_errors = []
        for error in exc.errors():
            field_path = " -> ".join(str(loc) for loc in error["loc"])
            validation_errors.append({
                "field": field_path,
                "message": error["msg"],
                "type": error["type"]
            })
        
        error_response = {
            "success": False,
            "error": "Data validation failed",
            "error_code": 422,
            "error_type": "pydantic_validation_error",
            "validation_errors": validation_errors,
            "request_id": getattr(request.state, "request_id", None),
            "path": str(request.url.path),
            "method": request.method,
        }
        
        logger.warning(f"Pydantic validation error: {exc}")
        
        return JSONResponse(
            status_code=422,
            content=error_response
        )
    
    @app.exception_handler(ValueError)
    async def value_error_handler(request: Request, exc: ValueError) -> JSONResponse:
        """Handle ValueError exceptions."""
        
        error_response = {
            "success": False,
            "error": str(exc),
            "error_code": 400,
            "error_type": "value_error",
            "request_id": getattr(request.state, "request_id", None),
            "path": str(request.url.path),
            "method": request.method,
            "error_hint": "Check input values and data types"
        }
        
        logger.warning(f"ValueError: {exc}")
        
        return JSONResponse(
            status_code=400,
            content=error_response
        )
    
    @app.exception_handler(KeyError)
    async def key_error_handler(request: Request, exc: KeyError) -> JSONResponse:
        """Handle KeyError exceptions."""
        
        error_response = {
            "success": False,
            "error": f"Missing required field or key: {str(exc)}",
            "error_code": 400,
            "error_type": "key_error",
            "request_id": getattr(request.state, "request_id", None),
            "path": str(request.url.path),
            "method": request.method,
            "error_hint": "Check that all required fields are provided"
        }
        
        logger.warning(f"KeyError: {exc}")
        
        return JSONResponse(
            status_code=400,
            content=error_response
        )
    
    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        """Handle all other unexpected exceptions."""
        
        # Generate unique error ID for tracking
        import uuid
        error_id = str(uuid.uuid4())[:8]
        
        error_response = {
            "success": False,
            "error": "Internal server error occurred",
            "error_code": 500,
            "error_type": "internal_server_error",
            "error_id": error_id,
            "request_id": getattr(request.state, "request_id", None),
            "path": str(request.url.path),
            "method": request.method,
            "error_hint": f"Report this error ID to support: {error_id}"
        }
        
        # Log full exception details
        logger.error(
            f"Unexpected error [{error_id}]: {type(exc).__name__}: {str(exc)}\n"
            f"Path: {request.method} {request.url.path}\n"
            f"Traceback: {traceback.format_exc()}"
        )
        
        return JSONResponse(
            status_code=500,
            content=error_response
        )


class ErrorLoggingMiddleware:
    """Middleware to add request IDs and enhanced error logging."""
    
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            # Generate request ID
            import uuid
            request_id = str(uuid.uuid4())
            
            # Add request ID to scope
            scope["state"] = scope.get("state", {})
            scope["state"]["request_id"] = request_id
            
            # Log request start
            method = scope["method"]
            path = scope["path"]
            logger.debug(f"[{request_id}] {method} {path} - Request started")
        
        await self.app(scope, receive, send)


def create_error_response(
    error_message: str,
    error_code: int = 400,
    error_type: str = "api_error",
    additional_data: Dict[str, Any] = None
) -> Dict[str, Any]:
    """
    Create a standardized error response.
    
    Args:
        error_message: Human-readable error message
        error_code: HTTP status code
        error_type: Type of error for categorization
        additional_data: Additional error context
    
    Returns:
        Standardized error response dictionary
    """
    
    error_response = {
        "success": False,
        "error": error_message,
        "error_code": error_code,
        "error_type": error_type,
        "timestamp": "2025-01-20T00:00:00Z"  # Would use actual timestamp
    }
    
    if additional_data:
        error_response.update(additional_data)
    
    return error_response


def log_api_error(
    error: Exception,
    request_context: Dict[str, Any] = None,
    severity: str = "error"
) -> str:
    """
    Log API errors with context and return error ID.
    
    Args:
        error: Exception that occurred
        request_context: Request context information
        severity: Logging severity level
    
    Returns:
        Unique error ID for tracking
    """
    
    import uuid
    error_id = str(uuid.uuid4())[:8]
    
    # Build log message
    log_message = f"[{error_id}] {type(error).__name__}: {str(error)}"
    
    if request_context:
        log_message += f" | Context: {request_context}"
    
    # Log with appropriate severity
    if severity == "critical":
        logger.critical(log_message)
    elif severity == "error":
        logger.error(log_message)
    elif severity == "warning":
        logger.warning(log_message)
    else:
        logger.info(log_message)
    
    return error_id