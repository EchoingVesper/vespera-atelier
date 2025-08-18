"""
Unified compatibility layer for MCP task orchestration.

This module provides response formatting, error handling, and serialization
utilities to ensure consistent JSON-serializable responses across all use cases.
"""

from .error_handlers import ErrorHandlingMixin, ErrorResponseFormatter
from .response_formatter import ResponseFormatter
from .serialization import SerializationValidator

__all__ = [
    "ResponseFormatter",
    "ErrorHandlingMixin",
    "ErrorResponseFormatter",
    "SerializationValidator",
]
