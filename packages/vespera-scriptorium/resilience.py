"""
Resilience patterns for MCP server including circuit breaker, retry logic, and caching.
"""

import asyncio
import time
import hashlib
import json
from enum import Enum
from typing import Optional, Dict, Any, Callable, TypeVar, Tuple
from datetime import datetime, timedelta
from functools import wraps
import structlog

logger = structlog.get_logger()

T = TypeVar('T')


class CircuitState(Enum):
    """Circuit breaker states."""
    CLOSED = "closed"  # Normal operation
    OPEN = "open"      # Failures exceeded threshold, blocking calls
    HALF_OPEN = "half_open"  # Testing if service recovered


class CircuitBreaker:
    """
    Circuit breaker implementation to prevent cascading failures.

    The circuit breaker has three states:
    - CLOSED: Normal operation, requests pass through
    - OPEN: Too many failures, requests are blocked
    - HALF_OPEN: Testing recovery, limited requests allowed
    """

    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: float = 60.0,
        half_open_requests: int = 3
    ):
        """
        Initialize circuit breaker.

        Args:
            failure_threshold: Number of failures before opening circuit
            recovery_timeout: Seconds to wait before attempting recovery
            half_open_requests: Number of test requests in half-open state
        """
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.half_open_requests = half_open_requests

        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.last_failure_time: Optional[float] = None
        self.half_open_count = 0

    def is_available(self) -> bool:
        """Check if circuit breaker allows requests."""
        if self.state == CircuitState.CLOSED:
            return True

        if self.state == CircuitState.OPEN:
            # Check if recovery timeout has passed
            if self.last_failure_time and \
               (time.time() - self.last_failure_time) > self.recovery_timeout:
                logger.info("Circuit breaker entering HALF_OPEN state")
                self.state = CircuitState.HALF_OPEN
                self.half_open_count = 0
                return True
            return False

        if self.state == CircuitState.HALF_OPEN:
            # Allow limited requests for testing
            return self.half_open_count < self.half_open_requests

        return False

    def record_success(self):
        """Record a successful request."""
        if self.state == CircuitState.HALF_OPEN:
            self.half_open_count += 1
            if self.half_open_count >= self.half_open_requests:
                # All test requests succeeded, close circuit
                logger.info("Circuit breaker closing after successful recovery")
                self.state = CircuitState.CLOSED
                self.failure_count = 0
                self.half_open_count = 0
        elif self.state == CircuitState.CLOSED:
            # Reset failure count on success
            self.failure_count = 0

    def record_failure(self):
        """Record a failed request."""
        self.failure_count += 1
        self.last_failure_time = time.time()

        if self.state == CircuitState.HALF_OPEN:
            # Recovery failed, reopen circuit
            logger.warning("Circuit breaker reopening after recovery failure")
            self.state = CircuitState.OPEN
            self.half_open_count = 0
        elif self.state == CircuitState.CLOSED:
            if self.failure_count >= self.failure_threshold:
                # Too many failures, open circuit
                logger.error(
                    f"Circuit breaker opening after {self.failure_count} failures"
                )
                self.state = CircuitState.OPEN

    def get_state(self) -> Dict[str, Any]:
        """Get current circuit breaker state info."""
        return {
            "state": self.state.value,
            "failure_count": self.failure_count,
            "last_failure": self.last_failure_time,
            "half_open_count": self.half_open_count if self.state == CircuitState.HALF_OPEN else None
        }


class RetryStrategy:
    """
    Retry logic with exponential backoff.
    """

    def __init__(
        self,
        max_retries: int = 3,
        base_delay: float = 1.0,
        max_delay: float = 16.0,
        exponential_base: float = 2.0,
        jitter: bool = True
    ):
        """
        Initialize retry strategy.

        Args:
            max_retries: Maximum number of retry attempts
            base_delay: Initial delay in seconds
            max_delay: Maximum delay in seconds
            exponential_base: Base for exponential backoff
            jitter: Add random jitter to prevent thundering herd
        """
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.exponential_base = exponential_base
        self.jitter = jitter

    def calculate_delay(self, attempt: int) -> float:
        """Calculate delay for given attempt number."""
        delay = min(
            self.base_delay * (self.exponential_base ** attempt),
            self.max_delay
        )

        if self.jitter:
            # Add random jitter (±25%)
            import random
            jitter_amount = delay * 0.25 * (2 * random.random() - 1)
            delay += jitter_amount

        return max(0, delay)

    async def execute_with_retry(
        self,
        func: Callable[..., T],
        *args,
        **kwargs
    ) -> T:
        """
        Execute function with retry logic.

        Args:
            func: Async function to execute
            *args, **kwargs: Arguments to pass to function

        Returns:
            Function result

        Raises:
            Exception from last attempt if all retries fail
        """
        last_exception = None

        for attempt in range(self.max_retries + 1):
            try:
                return await func(*args, **kwargs)
            except Exception as e:
                last_exception = e

                if attempt < self.max_retries:
                    delay = self.calculate_delay(attempt)
                    logger.warning(
                        f"Retry attempt {attempt + 1}/{self.max_retries} after {delay:.2f}s",
                        error=str(e)
                    )
                    await asyncio.sleep(delay)
                else:
                    logger.error(
                        f"All retry attempts failed",
                        attempts=self.max_retries + 1,
                        error=str(e)
                    )

        raise last_exception


class SimpleCache:
    """
    Simple in-memory cache with TTL support.
    """

    def __init__(self, default_ttl: float = 300.0):
        """
        Initialize cache.

        Args:
            default_ttl: Default time-to-live in seconds (5 minutes)
        """
        self.default_ttl = default_ttl
        self._cache: Dict[str, Tuple[Any, float]] = {}

    def _generate_key(self, operation: str, params: Dict[str, Any]) -> str:
        """Generate cache key from operation and parameters."""
        # Create stable JSON representation
        param_str = json.dumps(params, sort_keys=True)
        key_data = f"{operation}:{param_str}"

        # Hash for consistent key length
        return hashlib.sha256(key_data.encode()).hexdigest()[:16]

    def get(self, operation: str, params: Dict[str, Any]) -> Optional[Any]:
        """
        Get value from cache if not expired.

        Args:
            operation: Operation name
            params: Operation parameters

        Returns:
            Cached value or None if not found/expired
        """
        key = self._generate_key(operation, params)

        if key in self._cache:
            value, expiry = self._cache[key]
            if time.time() < expiry:
                logger.debug(f"Cache hit for {operation}")
                return value
            else:
                # Expired, remove from cache
                del self._cache[key]
                logger.debug(f"Cache expired for {operation}")

        logger.debug(f"Cache miss for {operation}")
        return None

    def set(
        self,
        operation: str,
        params: Dict[str, Any],
        value: Any,
        ttl: Optional[float] = None
    ):
        """
        Store value in cache.

        Args:
            operation: Operation name
            params: Operation parameters
            value: Value to cache
            ttl: Time-to-live in seconds (uses default if None)
        """
        key = self._generate_key(operation, params)
        expiry = time.time() + (ttl or self.default_ttl)
        self._cache[key] = (value, expiry)
        logger.debug(f"Cached {operation} (TTL: {ttl or self.default_ttl}s)")

    def invalidate(self, operation: Optional[str] = None):
        """
        Invalidate cache entries.

        Args:
            operation: Specific operation to invalidate (all if None)
        """
        if operation:
            # Invalidate specific operation
            keys_to_remove = [
                key for key in self._cache.keys()
                if key.startswith(operation)
            ]
            for key in keys_to_remove:
                del self._cache[key]
            logger.info(f"Invalidated {len(keys_to_remove)} cache entries for {operation}")
        else:
            # Clear entire cache
            count = len(self._cache)
            self._cache.clear()
            logger.info(f"Cleared entire cache ({count} entries)")

    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        valid_count = sum(
            1 for _, (_, expiry) in self._cache.items()
            if time.time() < expiry
        )

        return {
            "total_entries": len(self._cache),
            "valid_entries": valid_count,
            "expired_entries": len(self._cache) - valid_count
        }


class ResilienceManager:
    """
    Manages all resilience patterns for the MCP server.
    """

    def __init__(
        self,
        enable_circuit_breaker: bool = True,
        enable_retry: bool = True,
        enable_cache: bool = True,
        cache_ttl: float = 300.0
    ):
        """
        Initialize resilience manager.

        Args:
            enable_circuit_breaker: Enable circuit breaker pattern
            enable_retry: Enable retry logic
            enable_cache: Enable caching for read operations
            cache_ttl: Default cache TTL in seconds
        """
        self.enable_circuit_breaker = enable_circuit_breaker
        self.enable_retry = enable_retry
        self.enable_cache = enable_cache

        # Initialize components
        self.circuit_breaker = CircuitBreaker() if enable_circuit_breaker else None
        self.retry_strategy = RetryStrategy() if enable_retry else None
        self.cache = SimpleCache(default_ttl=cache_ttl) if enable_cache else None

        # Define cacheable operations (read-only)
        self.cacheable_operations = {
            "get_task", "list_tasks", "list_roles",
            "get_dashboard_stats", "search_entities", "health_check"
        }

    async def execute_with_resilience(
        self,
        operation: str,
        func: Callable[..., T],
        *args,
        use_cache: bool = True,
        cache_params: Optional[Dict[str, Any]] = None,
        **kwargs
    ) -> T:
        """
        Execute operation with all resilience patterns.

        Args:
            operation: Operation name
            func: Async function to execute
            *args, **kwargs: Arguments for function
            use_cache: Whether to use cache for this operation
            cache_params: Parameters for cache key generation

        Returns:
            Operation result
        """
        # Check circuit breaker
        if self.circuit_breaker and not self.circuit_breaker.is_available():
            raise Exception("Circuit breaker is OPEN - service unavailable")

        # Check cache for read operations
        if self.cache and use_cache and operation in self.cacheable_operations:
            cache_key_params = cache_params or kwargs
            cached_result = self.cache.get(operation, cache_key_params)
            if cached_result is not None:
                return cached_result

        try:
            # Execute with retry logic
            if self.retry_strategy and operation in self.cacheable_operations:
                # Use retry for read operations
                result = await self.retry_strategy.execute_with_retry(
                    func, *args, **kwargs
                )
            else:
                # Direct execution for write operations
                result = await func(*args, **kwargs)

            # Record success
            if self.circuit_breaker:
                self.circuit_breaker.record_success()

            # Cache result for read operations
            if self.cache and use_cache and operation in self.cacheable_operations:
                cache_key_params = cache_params or kwargs
                self.cache.set(operation, cache_key_params, result)

            # Invalidate related cache for write operations
            if self.cache and operation not in self.cacheable_operations:
                # Invalidate cache on writes
                if operation in ["create_task", "update_task", "delete_task", "complete_task"]:
                    self.cache.invalidate("get_task")
                    self.cache.invalidate("list_tasks")
                    self.cache.invalidate("get_dashboard_stats")
                elif operation in ["create_project"]:
                    self.cache.invalidate("get_dashboard_stats")
                elif operation in ["index_document"]:
                    self.cache.invalidate("search_entities")

            return result

        except Exception as e:
            # Record failure
            if self.circuit_breaker:
                self.circuit_breaker.record_failure()
            raise

    def get_status(self) -> Dict[str, Any]:
        """Get status of all resilience components."""
        status = {
            "circuit_breaker": self.circuit_breaker.get_state() if self.circuit_breaker else None,
            "cache": self.cache.get_stats() if self.cache else None,
            "retry": {"enabled": self.enable_retry} if self.retry_strategy else None
        }
        return status