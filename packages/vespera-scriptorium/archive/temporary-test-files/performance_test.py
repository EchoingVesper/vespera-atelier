#!/usr/bin/env python3
"""
Performance Testing for Vespera V2 System

Tests performance benchmarks and validates system performance meets requirements.
"""

import time
import asyncio
import sys
from pathlib import Path

# Add the package to path
sys.path.insert(0, str(Path(__file__).parent))

from tasks import TaskService
from roles import RoleManager

async def performance_test():
    print('🚀 Performance Testing V2 System')
    print('=' * 50)
    
    # Initialize system
    start_time = time.time()
    project_root = Path.cwd()
    
    # Use existing V2 database
    db_path = project_root / '.vespera_v2' / 'tasks.db'
    if not db_path.parent.exists():
        db_path = project_root / '.vespera_scriptorium' / 'tasks.db'
        print(f'⚠️  Using legacy database at {db_path.parent}')
    
    role_manager = RoleManager(project_root)
    task_service = TaskService(db_path)
    init_time = time.time() - start_time
    print(f'✓ System initialization: {init_time:.3f}s')
    print(f'✓ Loaded {len(role_manager.list_roles())} roles')
    
    # Test task creation performance
    print('\n📋 Testing Task Creation Performance...')
    tasks_created = []
    
    # Batch task creation test
    batch_start = time.time()
    for i in range(25):  # Smaller batch for testing
        task = await task_service.create_task(
            title=f'Performance Test Task {i}',
            description=f'Automated performance test task number {i}',
            project_id='perf-test',
            priority='normal'
        )
        tasks_created.append(task.id)
    
    batch_time = time.time() - batch_start
    avg_creation_time = batch_time / 25
    print(f'✓ Created 25 tasks in {batch_time:.3f}s')
    print(f'✓ Average task creation: {avg_creation_time:.3f}s per task')
    
    # Test task querying performance
    print('\n🔍 Testing Task Query Performance...')
    query_start = time.time()
    
    for _ in range(10):  # Smaller number for testing
        tasks = await task_service.list_tasks(
            project_id='perf-test',
            limit=100
        )
    
    query_time = time.time() - query_start
    avg_query_time = query_time / 10
    print(f'✓ 10 task queries in {query_time:.3f}s')
    print(f'✓ Average query time: {avg_query_time:.3f}s per query')
    
    # Test task updates performance
    print('\n🔄 Testing Task Update Performance...')
    update_start = time.time()
    
    for task_id in tasks_created[:5]:  # Update first 5 tasks
        await task_service.update_task(
            task_id,
            status='doing',
            assignee='Performance Test'
        )
    
    update_time = time.time() - update_start
    print(f'✓ Updated 5 tasks in {update_time:.3f}s')
    print(f'✓ Average update time: {update_time/5:.3f}s per update')
    
    # Test large query performance
    print(f'\n📊 Large Query Test:')
    large_query_start = time.time()
    all_tasks = await task_service.list_tasks(limit=1000)
    large_query_time = time.time() - large_query_start
    print(f'✓ Retrieved {len(all_tasks)} tasks in {large_query_time:.3f}s')
    
    # Performance analysis
    total_time = time.time() - start_time
    task_count = len(tasks_created)
    
    print(f'\n💾 Performance Summary:')
    print(f'   Total tasks created: {task_count}')
    print(f'   Total test time: {total_time:.3f}s')
    print(f'   Tasks per second: {task_count / batch_time:.1f}')
    print(f'   Queries per second: {10 / query_time:.1f}')
    
    # Performance requirements validation
    print(f'\n✅ Performance Requirements Validation:')
    creation_ok = avg_creation_time < 0.1  # < 100ms per task
    query_ok = avg_query_time < 0.05       # < 50ms per query  
    update_ok = (update_time/5) < 0.1      # < 100ms per update
    large_query_ok = large_query_time < 1.0 # < 1s for large queries
    
    print(f'   Task creation: {"✓" if creation_ok else "❌"} {avg_creation_time:.3f}s (target: <0.1s)')
    print(f'   Query performance: {"✓" if query_ok else "❌"} {avg_query_time:.3f}s (target: <0.05s)')
    print(f'   Update performance: {"✓" if update_ok else "❌"} {update_time/5:.3f}s (target: <0.1s)')
    print(f'   Large queries: {"✓" if large_query_ok else "❌"} {large_query_time:.3f}s (target: <1.0s)')
    
    all_ok = creation_ok and query_ok and update_ok and large_query_ok
    print(f'\n🎯 Overall Performance: {"✅ PASSED" if all_ok else "❌ FAILED"}')
    
    return all_ok

if __name__ == "__main__":
    result = asyncio.run(performance_test())
    sys.exit(0 if result else 1)