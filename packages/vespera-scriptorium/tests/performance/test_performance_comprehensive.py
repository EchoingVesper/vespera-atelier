"""
Comprehensive Performance Test Suite

Performance tests for system performance validation, benchmarking,
load testing, and scalability assessment. Focuses on establishing
performance baselines and regression detection.
"""

import asyncio
import pytest
import time
import statistics
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from unittest.mock import AsyncMock, MagicMock
import psutil
import threading
from concurrent.futures import ThreadPoolExecutor

# Test infrastructure
from ..infrastructure.base_test_classes import InfrastructureTestWithAsync
from ..infrastructure.infrastructure_test_helpers import PerformanceTestHelper

# System components for performance testing
from vespera_scriptorium.application.usecases.manage_tasks import TaskUseCase
from vespera_scriptorium.application.usecases.execute_task import ExecuteTaskUseCase
from vespera_scriptorium.domain.repositories.task_repository import TaskRepository
from vespera_scriptorium.domain.entities.task import Task, TaskStatus, TaskType
from vespera_scriptorium.domain.value_objects.complexity_level import ComplexityLevel


class TestTaskOperationPerformance(InfrastructureTestWithAsync):
    """Performance tests for task operations."""
    
    async def setup_test_configuration(self):
        """Setup performance test configuration."""
        await super().setup_test_configuration()
        self.perf_helper = PerformanceTestHelper()
        self.benchmark_results = []
    
    @pytest.mark.performance
    @pytest.mark.asyncio
    async def test_task_creation_performance(self):
        """Test task creation performance under various loads."""
        task_repo = self.get_service(TaskRepository)
        
        # Performance test configurations
        test_configurations = [
            {"batch_size": 10, "description": "Small batch"},
            {"batch_size": 50, "description": "Medium batch"},
            {"batch_size": 100, "description": "Large batch"},
        ]
        
        for config in test_configurations:
            batch_size = config["batch_size"]
            
            # Prepare test data
            tasks_data = []
            for i in range(batch_size):
                task_data = {
                    "task_id": f"perf_task_{i:04d}",
                    "title": f"Performance Test Task {i}",
                    "description": f"Task {i} for performance testing",
                    "task_type": TaskType.STANDARD.value,
                    "hierarchy_path": f"/perf_task_{i:04d}",
                    "complexity": ComplexityLevel.SIMPLE.value,
                    "specialist_type": "coder"
                }
                tasks_data.append(task_data)
            
            # Measure creation performance
            start_time = time.perf_counter()
            start_memory = psutil.Process().memory_info().rss / 1024 / 1024  # MB
            
            # Create tasks in parallel batches
            created_tasks = []
            batch_time_limit = 10.0  # 10 seconds max per batch
            
            for task_data in tasks_data:
                task = await asyncio.wait_for(
                    task_repo.create_task_from_dict(task_data),
                    timeout=batch_time_limit
                )
                created_tasks.append(task)
            
            end_time = time.perf_counter()
            end_memory = psutil.Process().memory_info().rss / 1024 / 1024  # MB
            
            # Calculate performance metrics
            total_time = end_time - start_time
            tasks_per_second = batch_size / total_time
            memory_per_task = (end_memory - start_memory) / batch_size
            
            # Record benchmark results
            benchmark_result = {
                "operation": "task_creation",
                "batch_size": batch_size,
                "total_time": total_time,
                "tasks_per_second": tasks_per_second,
                "memory_per_task_mb": memory_per_task,
                "description": config["description"]
            }
            self.benchmark_results.append(benchmark_result)
            
            # Performance assertions
            assert tasks_per_second >= 5, f"Task creation too slow: {tasks_per_second:.2f} tasks/sec"
            assert memory_per_task < 10, f"Memory usage too high: {memory_per_task:.2f} MB/task"
            assert len(created_tasks) == batch_size, "Not all tasks were created successfully"
            
            print(f"Task Creation Performance - {config['description']}: "
                  f"{tasks_per_second:.2f} tasks/sec, "
                  f"{memory_per_task:.2f} MB/task")
    
    @pytest.mark.performance
    @pytest.mark.asyncio
    async def test_task_query_performance(self):
        """Test task query performance with large datasets."""
        task_repo = self.get_service(TaskRepository)
        
        # Create large dataset for querying
        dataset_size = 500
        print(f"Creating dataset of {dataset_size} tasks for query performance testing...")
        
        # Create diverse task dataset
        for i in range(dataset_size):
            task_data = {
                "task_id": f"query_perf_task_{i:04d}",
                "title": f"Query Performance Task {i}",
                "description": f"Task {i} for query performance testing",
                "task_type": TaskType.STANDARD.value,
                "hierarchy_path": f"/query_perf_task_{i:04d}",
                "status": TaskStatus.ACTIVE.value if i % 3 == 0 else TaskStatus.PENDING.value,
                "specialist_type": "coder" if i % 2 == 0 else "tester",
                "complexity": ComplexityLevel.SIMPLE.value if i % 4 == 0 else ComplexityLevel.MODERATE.value
            }
            await task_repo.create_task_from_dict(task_data)
        
        # Test different query patterns
        query_patterns = [
            {
                "name": "filter_by_status",
                "filter": {"status": [TaskStatus.ACTIVE.value]},
                "expected_min_results": dataset_size // 4
            },
            {
                "name": "filter_by_specialist",
                "filter": {"specialist_type": ["coder"]},
                "expected_min_results": dataset_size // 3
            },
            {
                "name": "filter_by_complexity",
                "filter": {"complexity": [ComplexityLevel.SIMPLE.value]},
                "expected_min_results": dataset_size // 5
            },
            {
                "name": "complex_filter",
                "filter": {
                    "status": [TaskStatus.ACTIVE.value],
                    "specialist_type": ["coder"],
                    "complexity": [ComplexityLevel.SIMPLE.value]
                },
                "expected_min_results": 5
            }
        ]
        
        for pattern in query_patterns:
            # Warm up query (exclude from timing)
            await task_repo.query_tasks(pattern["filter"])
            
            # Measure query performance
            query_times = []
            iterations = 5
            
            for _ in range(iterations):
                start_time = time.perf_counter()
                results = await task_repo.query_tasks(pattern["filter"])
                end_time = time.perf_counter()
                
                query_time = end_time - start_time
                query_times.append(query_time)
                
                # Verify query correctness
                assert len(results) >= pattern["expected_min_results"], \
                    f"Query {pattern['name']} returned insufficient results"
            
            # Calculate statistics
            avg_query_time = statistics.mean(query_times)
            min_query_time = min(query_times)
            max_query_time = max(query_times)
            std_dev = statistics.stdev(query_times) if len(query_times) > 1 else 0
            
            # Record benchmark
            benchmark_result = {
                "operation": "task_query",
                "query_pattern": pattern["name"],
                "dataset_size": dataset_size,
                "avg_query_time": avg_query_time,
                "min_query_time": min_query_time,
                "max_query_time": max_query_time,
                "std_dev": std_dev,
                "results_count": len(results)
            }
            self.benchmark_results.append(benchmark_result)
            
            # Performance assertions
            assert avg_query_time < 0.5, f"Query {pattern['name']} too slow: {avg_query_time:.3f}s"
            assert std_dev < 0.1, f"Query {pattern['name']} inconsistent: {std_dev:.3f}s std dev"
            
            print(f"Query Performance - {pattern['name']}: "
                  f"avg={avg_query_time:.3f}s, "
                  f"min={min_query_time:.3f}s, "
                  f"max={max_query_time:.3f}s")
    
    @pytest.mark.performance
    @pytest.mark.asyncio
    async def test_concurrent_operations_performance(self):
        """Test performance under concurrent operations."""
        task_repo = self.get_service(TaskRepository)
        
        # Concurrent operation configurations
        concurrency_levels = [5, 10, 20]
        operations_per_worker = 10
        
        for concurrency_level in concurrency_levels:
            print(f"Testing {concurrency_level} concurrent workers, "
                  f"{operations_per_worker} operations each")
            
            async def worker_operations(worker_id: int):
                """Operations performed by each worker."""
                worker_tasks = []
                worker_start_time = time.perf_counter()
                
                for i in range(operations_per_worker):
                    # Create task
                    task_data = {
                        "task_id": f"concurrent_task_{worker_id}_{i:03d}",
                        "title": f"Concurrent Task {worker_id}-{i}",
                        "description": f"Worker {worker_id} task {i}",
                        "task_type": TaskType.STANDARD.value,
                        "hierarchy_path": f"/concurrent_task_{worker_id}_{i:03d}",
                        "complexity": ComplexityLevel.SIMPLE.value
                    }
                    
                    created_task = await task_repo.create_task_from_dict(task_data)
                    worker_tasks.append(created_task)
                    
                    # Update task
                    await task_repo.update_task(
                        created_task.task_id,
                        {"status": TaskStatus.ACTIVE.value}
                    )
                    
                    # Query tasks (to simulate read load)
                    await task_repo.query_tasks({"status": [TaskStatus.ACTIVE.value]})
                
                worker_end_time = time.perf_counter()
                return {
                    "worker_id": worker_id,
                    "operations_completed": len(worker_tasks) * 3,  # create + update + query
                    "worker_duration": worker_end_time - worker_start_time,
                    "tasks_created": len(worker_tasks)
                }
            
            # Execute concurrent workers
            start_time = time.perf_counter()
            start_memory = psutil.Process().memory_info().rss / 1024 / 1024  # MB
            
            # Create concurrent tasks
            worker_tasks = [
                worker_operations(worker_id)
                for worker_id in range(concurrency_level)
            ]
            
            # Execute all workers concurrently
            worker_results = await asyncio.gather(*worker_tasks)
            
            end_time = time.perf_counter()
            end_memory = psutil.Process().memory_info().rss / 1024 / 1024  # MB
            
            # Calculate overall performance metrics
            total_duration = end_time - start_time
            total_operations = sum(result["operations_completed"] for result in worker_results)
            total_tasks_created = sum(result["tasks_created"] for result in worker_results)
            operations_per_second = total_operations / total_duration
            memory_increase = end_memory - start_memory
            
            # Calculate worker performance statistics
            worker_durations = [result["worker_duration"] for result in worker_results]
            avg_worker_duration = statistics.mean(worker_durations)
            max_worker_duration = max(worker_durations)
            min_worker_duration = min(worker_durations)
            
            # Record benchmark
            benchmark_result = {
                "operation": "concurrent_operations",
                "concurrency_level": concurrency_level,
                "operations_per_worker": operations_per_worker,
                "total_duration": total_duration,
                "total_operations": total_operations,
                "operations_per_second": operations_per_second,
                "avg_worker_duration": avg_worker_duration,
                "max_worker_duration": max_worker_duration,
                "min_worker_duration": min_worker_duration,
                "memory_increase_mb": memory_increase,
                "tasks_created": total_tasks_created
            }
            self.benchmark_results.append(benchmark_result)
            
            # Performance assertions
            assert operations_per_second >= 20, \
                f"Concurrent operations too slow: {operations_per_second:.2f} ops/sec"
            assert max_worker_duration < total_duration * 1.5, \
                "Worker duration indicates potential deadlocks or blocking"
            assert all(result["operations_completed"] == operations_per_worker * 3 
                      for result in worker_results), \
                "Not all workers completed their operations"
            
            print(f"Concurrent Performance - {concurrency_level} workers: "
                  f"{operations_per_second:.2f} ops/sec, "
                  f"avg_worker_time={avg_worker_duration:.3f}s, "
                  f"memory_increase={memory_increase:.2f}MB")


class TestMemoryAndResourcePerformance(InfrastructureTestWithAsync):
    """Test memory usage and resource management performance."""
    
    @pytest.mark.performance
    @pytest.mark.asyncio
    async def test_memory_leak_detection(self):
        """Test for memory leaks in long-running operations."""
        task_repo = self.get_service(TaskRepository)
        
        # Baseline memory measurement
        baseline_memory = psutil.Process().memory_info().rss / 1024 / 1024  # MB
        
        # Perform repeated operations that should not accumulate memory
        iterations = 50
        memory_measurements = []
        
        for i in range(iterations):
            # Create and clean up tasks
            tasks_to_create = 10
            created_task_ids = []
            
            for j in range(tasks_to_create):
                task_data = {
                    "task_id": f"memory_leak_test_{i}_{j}",
                    "title": f"Memory Leak Test Task {i}-{j}",
                    "description": "Task for memory leak testing",
                    "task_type": TaskType.STANDARD.value,
                    "hierarchy_path": f"/memory_leak_test_{i}_{j}",
                    "complexity": ComplexityLevel.SIMPLE.value
                }
                
                created_task = await task_repo.create_task_from_dict(task_data)
                created_task_ids.append(created_task.task_id)
            
            # Perform operations on tasks
            for task_id in created_task_ids:
                await task_repo.update_task(task_id, {"status": TaskStatus.ACTIVE.value})
                await task_repo.get_task(task_id)
                await task_repo.query_tasks({"task_id": task_id})
            
            # Clean up tasks
            for task_id in created_task_ids:
                await task_repo.delete_task(task_id, force=True, archive_instead=False)
            
            # Measure memory after cleanup
            current_memory = psutil.Process().memory_info().rss / 1024 / 1024  # MB
            memory_measurements.append(current_memory - baseline_memory)
            
            # Force garbage collection periodically
            if i % 10 == 0:
                import gc
                gc.collect()
        
        # Analyze memory trend
        final_memory = memory_measurements[-1]
        max_memory_increase = max(memory_measurements)
        avg_memory_increase = statistics.mean(memory_measurements)
        
        # Check for memory leak pattern
        # A memory leak would show consistently increasing memory usage
        if len(memory_measurements) >= 10:
            recent_avg = statistics.mean(memory_measurements[-10:])
            early_avg = statistics.mean(memory_measurements[:10])
            memory_trend = recent_avg - early_avg
        else:
            memory_trend = 0
        
        # Record benchmark
        benchmark_result = {
            "operation": "memory_leak_detection",
            "iterations": iterations,
            "baseline_memory_mb": baseline_memory,
            "final_memory_increase_mb": final_memory,
            "max_memory_increase_mb": max_memory_increase,
            "avg_memory_increase_mb": avg_memory_increase,
            "memory_trend_mb": memory_trend
        }
        self.benchmark_results.append(benchmark_result)
        
        # Memory leak assertions
        assert final_memory < 50, f"Excessive final memory usage: {final_memory:.2f}MB"
        assert max_memory_increase < 100, f"Peak memory usage too high: {max_memory_increase:.2f}MB"
        assert memory_trend < 10, f"Memory leak detected: {memory_trend:.2f}MB trend"
        
        print(f"Memory Leak Test: final_increase={final_memory:.2f}MB, "
              f"max_increase={max_memory_increase:.2f}MB, "
              f"trend={memory_trend:.2f}MB")
    
    @pytest.mark.performance
    @pytest.mark.asyncio
    async def test_resource_cleanup_performance(self):
        """Test resource cleanup efficiency."""
        task_repo = self.get_service(TaskRepository)
        
        # Create resources that need cleanup
        resource_batches = [10, 50, 100]
        
        for batch_size in resource_batches:
            print(f"Testing resource cleanup for {batch_size} resources")
            
            # Create resources
            created_resources = []
            creation_start = time.perf_counter()
            
            for i in range(batch_size):
                task_data = {
                    "task_id": f"cleanup_test_task_{i:04d}",
                    "title": f"Cleanup Test Task {i}",
                    "description": "Task for cleanup performance testing",
                    "task_type": TaskType.STANDARD.value,
                    "hierarchy_path": f"/cleanup_test_task_{i:04d}",
                    "complexity": ComplexityLevel.SIMPLE.value
                }
                
                created_task = await task_repo.create_task_from_dict(task_data)
                created_resources.append(created_task.task_id)
            
            creation_end = time.perf_counter()
            creation_time = creation_end - creation_start
            
            # Cleanup resources
            cleanup_start = time.perf_counter()
            cleanup_successful = 0
            
            for task_id in created_resources:
                try:
                    await task_repo.delete_task(task_id, force=True, archive_instead=False)
                    cleanup_successful += 1
                except Exception as e:
                    print(f"Failed to cleanup task {task_id}: {e}")
            
            cleanup_end = time.perf_counter()
            cleanup_time = cleanup_end - cleanup_start
            
            # Calculate cleanup efficiency
            cleanup_rate = cleanup_successful / cleanup_time
            cleanup_efficiency = (cleanup_successful / batch_size) * 100
            
            # Record benchmark
            benchmark_result = {
                "operation": "resource_cleanup",
                "batch_size": batch_size,
                "creation_time": creation_time,
                "cleanup_time": cleanup_time,
                "cleanup_successful": cleanup_successful,
                "cleanup_rate": cleanup_rate,
                "cleanup_efficiency_percent": cleanup_efficiency
            }
            self.benchmark_results.append(benchmark_result)
            
            # Cleanup performance assertions
            assert cleanup_efficiency >= 95, \
                f"Cleanup efficiency too low: {cleanup_efficiency:.1f}%"
            assert cleanup_rate >= 10, \
                f"Cleanup too slow: {cleanup_rate:.2f} resources/sec"
            
            print(f"Cleanup Performance - {batch_size} resources: "
                  f"{cleanup_rate:.2f} cleanups/sec, "
                  f"{cleanup_efficiency:.1f}% efficiency")


class TestScalabilityPerformance(InfrastructureTestWithAsync):
    """Test system scalability under increasing load."""
    
    @pytest.mark.performance
    @pytest.mark.asyncio
    async def test_linear_scalability(self):
        """Test if performance scales linearly with load."""
        task_repo = self.get_service(TaskRepository)
        
        # Test different load levels
        load_levels = [10, 20, 40, 80]
        scalability_data = []
        
        for load_level in load_levels:
            print(f"Testing scalability at load level: {load_level}")
            
            # Measure performance at current load level
            start_time = time.perf_counter()
            
            # Create tasks at current load level
            tasks = []
            for i in range(load_level):
                task_data = {
                    "task_id": f"scalability_task_{load_level}_{i:04d}",
                    "title": f"Scalability Test Task {load_level}-{i}",
                    "description": f"Task for scalability testing at load {load_level}",
                    "task_type": TaskType.STANDARD.value,
                    "hierarchy_path": f"/scalability_task_{load_level}_{i:04d}",
                    "complexity": ComplexityLevel.SIMPLE.value
                }
                
                created_task = await task_repo.create_task_from_dict(task_data)
                tasks.append(created_task)
            
            # Perform operations on all tasks
            for task in tasks:
                await task_repo.update_task(task.task_id, {"status": TaskStatus.ACTIVE.value})
                await task_repo.get_task(task.task_id)
            
            end_time = time.perf_counter()
            total_time = end_time - start_time
            
            # Calculate throughput
            operations_performed = load_level * 3  # create + update + get
            throughput = operations_performed / total_time
            
            scalability_data.append({
                "load_level": load_level,
                "total_time": total_time,
                "throughput": throughput,
                "time_per_operation": total_time / operations_performed
            })
            
            print(f"Load {load_level}: {throughput:.2f} ops/sec, "
                  f"{total_time:.3f}s total")
        
        # Analyze scalability
        base_throughput = scalability_data[0]["throughput"]
        
        for i, data in enumerate(scalability_data[1:], 1):
            expected_throughput_range = (base_throughput * 0.7, base_throughput * 1.3)
            actual_throughput = data["throughput"]
            
            # Check if throughput is within acceptable range
            # (allowing for some degradation with increased load)
            throughput_ratio = actual_throughput / base_throughput
            
            assert throughput_ratio >= 0.5, \
                f"Throughput degraded too much at load {data['load_level']}: " \
                f"{throughput_ratio:.2f}x baseline"
            
            print(f"Scalability at load {data['load_level']}: "
                  f"{throughput_ratio:.2f}x baseline throughput")
        
        # Record final benchmark
        benchmark_result = {
            "operation": "scalability_test",
            "scalability_data": scalability_data,
            "base_throughput": base_throughput,
            "max_load_tested": max(load_levels),
            "linear_scaling_maintained": all(
                d["throughput"] / base_throughput >= 0.5 
                for d in scalability_data
            )
        }
        self.benchmark_results.append(benchmark_result)


@pytest.fixture(scope="session", autouse=True)
def performance_test_report(request):
    """Generate performance test report at end of session."""
    yield
    
    # Collect all benchmark results from test instances
    all_results = []
    for item in request.node.items:
        if hasattr(item, 'benchmark_results'):
            all_results.extend(item.benchmark_results)
    
    # Generate performance report
    if all_results:
        report_path = Path("performance_test_report.json")
        
        report = {
            "timestamp": datetime.now().isoformat(),
            "system_info": {
                "cpu_count": psutil.cpu_count(),
                "memory_total_gb": psutil.virtual_memory().total / 1024 / 1024 / 1024,
                "python_version": f"{psutil.Process().exe}",
            },
            "benchmark_results": all_results,
            "summary": {
                "total_benchmarks": len(all_results),
                "operations_tested": list(set(r.get("operation") for r in all_results))
            }
        }
        
        with open(report_path, 'w') as f:
            import json
            json.dump(report, f, indent=2)
        
        print(f"\nPerformance test report saved to: {report_path}")
        print(f"Total benchmarks: {len(all_results)}")