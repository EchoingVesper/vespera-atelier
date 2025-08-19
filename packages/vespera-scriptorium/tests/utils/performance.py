"""
Performance benchmarking utilities for Vespera V2 testing.

Provides tools for measuring and asserting performance characteristics
of system components.
"""

import time
import asyncio
import statistics
from datetime import datetime, timedelta
from typing import Dict, Any, List, Callable, Optional, Union
from contextlib import asynccontextmanager, contextmanager
from dataclasses import dataclass, field
import psutil
import gc


@dataclass
class PerformanceMetrics:
    """Container for performance measurement results."""
    execution_time: float
    memory_usage_mb: float
    cpu_usage_percent: float
    operations_per_second: Optional[float] = None
    peak_memory_mb: Optional[float] = None
    gc_collections: int = 0
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert metrics to dictionary."""
        return {
            "execution_time": self.execution_time,
            "memory_usage_mb": self.memory_usage_mb,
            "cpu_usage_percent": self.cpu_usage_percent,
            "operations_per_second": self.operations_per_second,
            "peak_memory_mb": self.peak_memory_mb,
            "gc_collections": self.gc_collections
        }


@dataclass
class PerformanceThresholds:
    """Performance thresholds for assertions."""
    max_execution_time: Optional[float] = None
    max_memory_usage_mb: Optional[float] = None
    max_cpu_usage_percent: Optional[float] = None
    min_operations_per_second: Optional[float] = None


class PerformanceBenchmark:
    """Performance benchmarking context manager."""
    
    def __init__(self, name: str = "benchmark"):
        self.name = name
        self.start_time: Optional[float] = None
        self.end_time: Optional[float] = None
        self.start_memory: Optional[float] = None
        self.peak_memory: Optional[float] = None
        self.cpu_percent: List[float] = []
        self.gc_count_start: int = 0
        self.operation_count: Optional[int] = None
        self._memory_monitor_task: Optional[asyncio.Task] = None
        
    def __enter__(self):
        """Start synchronous benchmark."""
        self._start_monitoring()
        return self
        
    def __exit__(self, exc_type, exc_val, exc_tb):
        """End synchronous benchmark."""
        self._stop_monitoring()
        
    async def __aenter__(self):
        """Start asynchronous benchmark."""
        self._start_monitoring()
        # Start memory monitoring task
        self._memory_monitor_task = asyncio.create_task(self._monitor_memory())
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """End asynchronous benchmark."""
        if self._memory_monitor_task:
            self._memory_monitor_task.cancel()
            try:
                await self._memory_monitor_task
            except asyncio.CancelledError:
                pass
        self._stop_monitoring()
    
    def _start_monitoring(self):
        """Start performance monitoring."""
        # Force garbage collection
        gc.collect()
        self.gc_count_start = gc.get_count()[0]
        
        # Record start metrics
        self.start_time = time.time()
        process = psutil.Process()
        self.start_memory = process.memory_info().rss / 1024 / 1024  # MB
        self.peak_memory = self.start_memory
        
        # Start CPU monitoring
        self.cpu_percent = []
        process.cpu_percent()  # Initialize CPU measurement
    
    def _stop_monitoring(self):
        """Stop performance monitoring."""
        self.end_time = time.time()
        
        # Final CPU measurement
        process = psutil.Process()
        final_cpu = process.cpu_percent()
        if final_cpu > 0:
            self.cpu_percent.append(final_cpu)
    
    async def _monitor_memory(self):
        """Monitor peak memory usage."""
        try:
            while True:
                process = psutil.Process()
                current_memory = process.memory_info().rss / 1024 / 1024  # MB
                if current_memory > self.peak_memory:
                    self.peak_memory = current_memory
                
                # Sample CPU
                cpu = process.cpu_percent()
                if cpu > 0:
                    self.cpu_percent.append(cpu)
                
                await asyncio.sleep(0.1)  # Sample every 100ms
        except asyncio.CancelledError:
            pass
    
    def set_operation_count(self, count: int):
        """Set the number of operations performed."""
        self.operation_count = count
    
    def get_metrics(self) -> PerformanceMetrics:
        """Get performance metrics."""
        if self.start_time is None or self.end_time is None:
            raise RuntimeError("Benchmark not completed")
        
        execution_time = self.end_time - self.start_time
        
        # Calculate memory usage
        process = psutil.Process()
        current_memory = process.memory_info().rss / 1024 / 1024  # MB
        memory_usage = current_memory - self.start_memory
        
        # Calculate average CPU usage
        avg_cpu = statistics.mean(self.cpu_percent) if self.cpu_percent else 0.0
        
        # Calculate operations per second
        ops_per_second = None
        if self.operation_count and execution_time > 0:
            ops_per_second = self.operation_count / execution_time
        
        # GC collections
        gc_collections = gc.get_count()[0] - self.gc_count_start
        
        return PerformanceMetrics(
            execution_time=execution_time,
            memory_usage_mb=memory_usage,
            cpu_usage_percent=avg_cpu,
            operations_per_second=ops_per_second,
            peak_memory_mb=self.peak_memory - self.start_memory,
            gc_collections=gc_collections
        )


@contextmanager
def measure_execution_time():
    """Simple context manager to measure execution time."""
    start_time = time.time()
    yield
    end_time = time.time()
    execution_time = end_time - start_time
    print(f"Execution time: {execution_time:.3f} seconds")


@asynccontextmanager
async def measure_async_execution_time():
    """Async context manager to measure execution time."""
    start_time = time.time()
    yield
    end_time = time.time()
    execution_time = end_time - start_time
    print(f"Async execution time: {execution_time:.3f} seconds")


def assert_performance_threshold(
    metrics: PerformanceMetrics,
    thresholds: PerformanceThresholds
):
    """Assert that performance metrics meet specified thresholds."""
    
    if thresholds.max_execution_time is not None:
        assert metrics.execution_time <= thresholds.max_execution_time, \
            f"Execution time {metrics.execution_time:.3f}s exceeds threshold {thresholds.max_execution_time}s"
    
    if thresholds.max_memory_usage_mb is not None:
        assert metrics.memory_usage_mb <= thresholds.max_memory_usage_mb, \
            f"Memory usage {metrics.memory_usage_mb:.1f}MB exceeds threshold {thresholds.max_memory_usage_mb}MB"
    
    if thresholds.max_cpu_usage_percent is not None:
        assert metrics.cpu_usage_percent <= thresholds.max_cpu_usage_percent, \
            f"CPU usage {metrics.cpu_usage_percent:.1f}% exceeds threshold {thresholds.max_cpu_usage_percent}%"
    
    if thresholds.min_operations_per_second is not None and metrics.operations_per_second is not None:
        assert metrics.operations_per_second >= thresholds.min_operations_per_second, \
            f"Operations per second {metrics.operations_per_second:.1f} below threshold {thresholds.min_operations_per_second}"


async def benchmark_async_function(
    func: Callable,
    *args,
    iterations: int = 1,
    warmup_iterations: int = 0,
    **kwargs
) -> Dict[str, Any]:
    """Benchmark an async function with multiple iterations."""
    
    # Warmup runs
    for _ in range(warmup_iterations):
        await func(*args, **kwargs)
    
    # Benchmark runs
    execution_times = []
    memory_usages = []
    
    for i in range(iterations):
        async with PerformanceBenchmark(f"iteration_{i}") as benchmark:
            result = await func(*args, **kwargs)
            benchmark.set_operation_count(1)
        
        metrics = benchmark.get_metrics()
        execution_times.append(metrics.execution_time)
        memory_usages.append(metrics.memory_usage_mb)
    
    # Calculate statistics
    stats = {
        "iterations": iterations,
        "execution_time": {
            "mean": statistics.mean(execution_times),
            "median": statistics.median(execution_times),
            "min": min(execution_times),
            "max": max(execution_times),
            "stdev": statistics.stdev(execution_times) if len(execution_times) > 1 else 0
        },
        "memory_usage": {
            "mean": statistics.mean(memory_usages),
            "median": statistics.median(memory_usages),
            "min": min(memory_usages),
            "max": max(memory_usages),
            "stdev": statistics.stdev(memory_usages) if len(memory_usages) > 1 else 0
        }
    }
    
    return stats


def benchmark_function(
    func: Callable,
    *args,
    iterations: int = 1,
    warmup_iterations: int = 0,
    **kwargs
) -> Dict[str, Any]:
    """Benchmark a synchronous function with multiple iterations."""
    
    # Warmup runs
    for _ in range(warmup_iterations):
        func(*args, **kwargs)
    
    # Benchmark runs
    execution_times = []
    memory_usages = []
    
    for i in range(iterations):
        with PerformanceBenchmark(f"iteration_{i}") as benchmark:
            result = func(*args, **kwargs)
            benchmark.set_operation_count(1)
        
        metrics = benchmark.get_metrics()
        execution_times.append(metrics.execution_time)
        memory_usages.append(metrics.memory_usage_mb)
    
    # Calculate statistics
    stats = {
        "iterations": iterations,
        "execution_time": {
            "mean": statistics.mean(execution_times),
            "median": statistics.median(execution_times),
            "min": min(execution_times),
            "max": max(execution_times),
            "stdev": statistics.stdev(execution_times) if len(execution_times) > 1 else 0
        },
        "memory_usage": {
            "mean": statistics.mean(memory_usages),
            "median": statistics.median(memory_usages),
            "min": min(memory_usages),
            "max": max(memory_usages),
            "stdev": statistics.stdev(memory_usages) if len(memory_usages) > 1 else 0
        }
    }
    
    return stats


async def concurrent_benchmark(
    func: Callable,
    args_list: List[tuple],
    max_concurrency: int = 10
) -> Dict[str, Any]:
    """Benchmark function with concurrent execution."""
    
    async def run_task(args):
        async with PerformanceBenchmark() as benchmark:
            result = await func(*args)
            benchmark.set_operation_count(1)
        return benchmark.get_metrics()
    
    # Create semaphore to limit concurrency
    semaphore = asyncio.Semaphore(max_concurrency)
    
    async def limited_task(args):
        async with semaphore:
            return await run_task(args)
    
    # Execute tasks concurrently
    start_time = time.time()
    tasks = [limited_task(args) for args in args_list]
    results = await asyncio.gather(*tasks)
    total_time = time.time() - start_time
    
    # Aggregate results
    execution_times = [r.execution_time for r in results]
    memory_usages = [r.memory_usage_mb for r in results]
    
    return {
        "total_tasks": len(args_list),
        "total_time": total_time,
        "throughput": len(args_list) / total_time,
        "execution_time": {
            "mean": statistics.mean(execution_times),
            "median": statistics.median(execution_times),
            "min": min(execution_times),
            "max": max(execution_times)
        },
        "memory_usage": {
            "mean": statistics.mean(memory_usages),
            "max": max(memory_usages)
        }
    }


class LoadTestRunner:
    """Runner for load testing scenarios."""
    
    def __init__(self, name: str):
        self.name = name
        self.results: List[Dict[str, Any]] = []
    
    async def run_load_test(
        self,
        func: Callable,
        load_levels: List[int],
        duration_per_level: float = 10.0
    ) -> Dict[str, Any]:
        """Run load test with increasing load levels."""
        
        load_test_results = {}
        
        for load_level in load_levels:
            print(f"Running load test: {load_level} operations/second")
            
            # Calculate delay between operations
            delay = 1.0 / load_level if load_level > 0 else 0
            
            # Run test for specified duration
            start_time = time.time()
            operations_completed = 0
            errors = 0
            
            async with PerformanceBenchmark(f"load_level_{load_level}") as benchmark:
                while time.time() - start_time < duration_per_level:
                    try:
                        await func()
                        operations_completed += 1
                    except Exception as e:
                        errors += 1
                    
                    if delay > 0:
                        await asyncio.sleep(delay)
                
                benchmark.set_operation_count(operations_completed)
            
            metrics = benchmark.get_metrics()
            
            load_test_results[load_level] = {
                "operations_completed": operations_completed,
                "errors": errors,
                "error_rate": errors / operations_completed if operations_completed > 0 else 0,
                "actual_ops_per_second": operations_completed / duration_per_level,
                "metrics": metrics.to_dict()
            }
        
        return {
            "test_name": self.name,
            "load_levels": load_test_results,
            "summary": self._generate_load_test_summary(load_test_results)
        }
    
    def _generate_load_test_summary(self, results: Dict[int, Dict[str, Any]]) -> Dict[str, Any]:
        """Generate summary of load test results."""
        max_stable_load = 0
        
        for load_level, result in results.items():
            error_rate = result["error_rate"]
            if error_rate < 0.05:  # Less than 5% error rate
                max_stable_load = load_level
        
        return {
            "max_stable_load": max_stable_load,
            "total_load_levels_tested": len(results),
            "peak_operations_per_second": max(r["actual_ops_per_second"] for r in results.values())
        }


# Predefined performance thresholds for different scenarios
PERFORMANCE_THRESHOLDS = {
    "fast_operation": PerformanceThresholds(
        max_execution_time=0.1,
        max_memory_usage_mb=10.0,
        max_cpu_usage_percent=50.0
    ),
    
    "standard_operation": PerformanceThresholds(
        max_execution_time=1.0,
        max_memory_usage_mb=50.0,
        max_cpu_usage_percent=80.0
    ),
    
    "bulk_operation": PerformanceThresholds(
        max_execution_time=10.0,
        max_memory_usage_mb=200.0,
        max_cpu_usage_percent=95.0
    ),
    
    "api_response": PerformanceThresholds(
        max_execution_time=0.5,
        max_memory_usage_mb=25.0
    ),
    
    "background_service": PerformanceThresholds(
        max_execution_time=5.0,
        max_memory_usage_mb=100.0,
        min_operations_per_second=1.0
    )
}