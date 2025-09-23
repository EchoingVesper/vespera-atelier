"""
Security utilities for MCP server.

Provides input sanitization, error message filtering, and security validation
for the MCP-Bindery integration layer.
"""

import re
import json
import html
from typing import Any, Dict, Optional, Union, Type, TypeVar
from functools import lru_cache
from pydantic import BaseModel, ValidationError
import structlog

logger = structlog.get_logger()

# Type variable for generic type handling
T = TypeVar('T', bound=BaseModel)

# Security constants
MAX_JSON_DEPTH = 10
MAX_STRING_LENGTH = 10000
MAX_ARRAY_LENGTH = 1000
MAX_OBJECT_KEYS = 100

# Patterns for detecting potential security issues
INJECTION_PATTERNS = [
    r'<script[^>]*>.*?</script>',  # Script tags
    r'javascript:',                 # JavaScript protocol
    r'on\w+\s*=',                   # Event handlers
    r'\$\{.*?\}',                   # Template literals
    r'{{.*?}}',                     # Template expressions
    r'eval\s*\(',                   # eval() calls
    r'Function\s*\(',               # Function constructor
    r'__proto__',                   # Prototype pollution
    r'constructor\[',               # Constructor access
]

# Compiled regex for efficiency
INJECTION_REGEX = re.compile('|'.join(INJECTION_PATTERNS), re.IGNORECASE | re.DOTALL)


class SecurityValidator:
    """Validates and sanitizes inputs for security."""

    @staticmethod
    def sanitize_string(value: str, max_length: int = MAX_STRING_LENGTH) -> str:
        """
        Sanitize a string value for security.

        Args:
            value: The string to sanitize
            max_length: Maximum allowed string length

        Returns:
            Sanitized string

        Raises:
            ValidationError: If the string contains dangerous patterns
        """
        # Check length
        if len(value) > max_length:
            raise ValidationError(f"String exceeds maximum length of {max_length}")

        # HTML escape special characters
        value = html.escape(value, quote=False)

        # Check for injection patterns
        if INJECTION_REGEX.search(value):
            logger.warning("Potential injection pattern detected", value_length=len(value))
            # Remove suspicious patterns instead of rejecting
            value = INJECTION_REGEX.sub('', value)

        return value

    @staticmethod
    def validate_json_structure(data: Any, depth: int = 0) -> None:
        """
        Validate JSON structure for security issues.

        Args:
            data: The data structure to validate
            depth: Current recursion depth

        Raises:
            ValidationError: If the structure violates security constraints
        """
        if depth > MAX_JSON_DEPTH:
            raise ValidationError(f"JSON structure exceeds maximum depth of {MAX_JSON_DEPTH}")

        if isinstance(data, dict):
            if len(data) > MAX_OBJECT_KEYS:
                raise ValidationError(f"Object has too many keys ({len(data)} > {MAX_OBJECT_KEYS})")

            for key, value in data.items():
                # Validate key
                if not isinstance(key, str):
                    raise ValidationError(f"Non-string key found: {type(key).__name__}")

                # Check for dangerous keys
                if key.startswith('__') or key in ['constructor', 'prototype', '__proto__']:
                    raise ValidationError(f"Potentially dangerous key: {key}")

                # Recurse into value
                SecurityValidator.validate_json_structure(value, depth + 1)

        elif isinstance(data, list):
            if len(data) > MAX_ARRAY_LENGTH:
                raise ValidationError(f"Array exceeds maximum length of {MAX_ARRAY_LENGTH}")

            for item in data:
                SecurityValidator.validate_json_structure(item, depth + 1)

        elif isinstance(data, str):
            SecurityValidator.sanitize_string(data)

    @staticmethod
    def sanitize_json_string(json_str: str) -> str:
        """
        Sanitize a JSON string before parsing.

        Args:
            json_str: The JSON string to sanitize

        Returns:
            Sanitized JSON string

        Raises:
            ValidationError: If the JSON contains security issues
        """
        # Remove null bytes and other control characters
        json_str = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', json_str)

        # Remove comments (not valid JSON but sometimes present)
        json_str = re.sub(r'//.*$', '', json_str, flags=re.MULTILINE)
        json_str = re.sub(r'/\*.*?\*/', '', json_str, flags=re.DOTALL)

        # Validate basic structure
        if len(json_str) > MAX_STRING_LENGTH * 10:  # Allow larger JSON documents
            raise ValidationError("JSON string is too large")

        return json_str.strip()


class ErrorSanitizer:
    """Sanitizes error messages to prevent information disclosure."""

    # Production mode flag (should be set from environment)
    PRODUCTION_MODE = False

    @staticmethod
    def sanitize_error_message(error: Exception, context: Optional[str] = None) -> Dict[str, Any]:
        """
        Sanitize error messages for safe external exposure.

        Args:
            error: The exception to sanitize
            context: Optional context about where the error occurred

        Returns:
            Sanitized error information
        """
        # In production, return generic messages
        if ErrorSanitizer.PRODUCTION_MODE:
            error_info = {
                "error": "An error occurred processing your request",
                "type": "processing_error"
            }

            # Add safe context if provided
            if context:
                error_info["context"] = context

            # Log the actual error internally
            logger.error(
                "Production error sanitized",
                actual_error=str(error),
                error_type=type(error).__name__,
                context=context
            )

        else:
            # In development, provide more detail but still sanitize
            error_msg = str(error)

            # Remove file paths
            error_msg = re.sub(r'(/[\w\-./]+)+', '[path]', error_msg)

            # Remove potential credentials
            error_msg = re.sub(r'(password|token|key|secret|credential)["\']?\s*[:=]\s*["\']?[\w\-]+',
                              '[credential]', error_msg, flags=re.IGNORECASE)

            # Remove IP addresses
            error_msg = re.sub(r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b', '[ip]', error_msg)

            # Remove port numbers
            error_msg = re.sub(r':\d{4,5}\b', ':[port]', error_msg)

            error_info = {
                "error": error_msg[:500],  # Limit error message length
                "type": type(error).__name__
            }

            if context:
                error_info["context"] = context

        return error_info


class SchemaCache:
    """Cache for Pydantic model schemas to improve performance."""

    def __init__(self, max_size: int = 128):
        """
        Initialize schema cache.

        Args:
            max_size: Maximum number of cached schemas
        """
        self.max_size = max_size
        self._cache: Dict[Type[BaseModel], Dict[str, Any]] = {}

    @lru_cache(maxsize=128)
    def get_schema(self, model_class: Type[BaseModel]) -> Dict[str, Any]:
        """
        Get cached schema for a model class.

        Args:
            model_class: The Pydantic model class

        Returns:
            The model's JSON schema
        """
        if model_class not in self._cache:
            self._cache[model_class] = model_class.model_json_schema()
        return self._cache[model_class]

    def validate_with_cache(self, data: Dict[str, Any], model_class: Type[T]) -> T:
        """
        Validate data against cached schema.

        Args:
            data: The data to validate
            model_class: The model class to validate against

        Returns:
            Validated model instance
        """
        # Get cached schema (for future optimizations)
        schema = self.get_schema(model_class)

        # Validate and create instance
        return model_class(**data)

    def clear(self):
        """Clear the schema cache."""
        self._cache.clear()
        self.get_schema.cache_clear()


# Global schema cache instance
schema_cache = SchemaCache()


def secure_deserialize_mcp_param(
    param: Union[str, Dict, BaseModel],
    model_class: Type[T],
    strict_mode: bool = True
) -> T:
    """
    Securely deserialize MCP parameter with enhanced validation.

    This is a drop-in replacement for deserialize_mcp_param with added security.

    Args:
        param: The input parameter (JSON string, dict, or model instance)
        model_class: The Pydantic model class to deserialize to
        strict_mode: If True, apply strict security validation

    Returns:
        Validated instance of the model class

    Raises:
        ValidationError: If the parameter fails validation
    """
    # Case 1: Already the right type
    if isinstance(param, model_class):
        return param

    # Case 2: JSON string
    if isinstance(param, str):
        try:
            # Sanitize the JSON string first
            if strict_mode:
                param = SecurityValidator.sanitize_json_string(param)

            # Parse JSON
            data = json.loads(param)

            # Validate structure
            if strict_mode:
                SecurityValidator.validate_json_structure(data)

            # Use cached validation
            return schema_cache.validate_with_cache(data, model_class)

        except json.JSONDecodeError as e:
            # Preserve original context
            error_info = ErrorSanitizer.sanitize_error_message(e, "JSON parsing")
            logger.error("JSON parsing failed", **error_info)
            raise ValidationError(
                f"Invalid JSON format: {error_info['error']}",
                model_name=model_class.__name__
            ) from e
        except ValidationError:
            raise
        except Exception as e:
            error_info = ErrorSanitizer.sanitize_error_message(e, "deserialization")
            raise ValidationError(f"Deserialization failed: {error_info['error']}") from e

    # Case 3: Dictionary
    if isinstance(param, dict):
        try:
            # Validate structure
            if strict_mode:
                SecurityValidator.validate_json_structure(param)

            # Use cached validation
            return schema_cache.validate_with_cache(param, model_class)

        except ValidationError:
            raise
        except Exception as e:
            error_info = ErrorSanitizer.sanitize_error_message(e, "dictionary validation")
            raise ValidationError(f"Validation failed: {error_info['error']}") from e

    # Unexpected type
    raise ValidationError(
        f"Cannot deserialize parameter of type {type(param).__name__}",
        model_name=model_class.__name__
    )


def set_production_mode(is_production: bool = False):
    """
    Set the production mode for error sanitization.

    Args:
        is_production: True for production mode (more sanitization)
    """
    ErrorSanitizer.PRODUCTION_MODE = is_production
    logger.info(f"Security mode set to {'production' if is_production else 'development'}")