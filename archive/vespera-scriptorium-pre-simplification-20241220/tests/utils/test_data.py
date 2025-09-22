"""
Test data generators for Vespera V2 testing.

Provides utilities to generate realistic test data for tasks, projects,
embeddings, and other system components.
"""

import random
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from tasks.models import Task, TaskStatus, TaskPriority


def create_test_task(
    title: Optional[str] = None,
    description: Optional[str] = None,
    status: Optional[TaskStatus] = None,
    priority: Optional[TaskPriority] = None,
    project_id: Optional[str] = None,
    **kwargs
) -> Task:
    """Create a test task with optional customization."""
    
    if title is None:
        title = f"Test Task {uuid.uuid4().hex[:8]}"
    
    if description is None:
        description = f"Test description for {title}"
    
    if status is None:
        status = random.choice(list(TaskStatus))
    
    if priority is None:
        priority = random.choice(list(TaskPriority))
    
    if project_id is None:
        project_id = f"test_project_{uuid.uuid4().hex[:6]}"
    
    task = Task(
        title=title,
        description=description,
        status=status,
        priority=priority,
        project_id=project_id,
        **kwargs
    )
    
    return task


def create_test_project(
    project_id: Optional[str] = None,
    name: Optional[str] = None,
    description: Optional[str] = None,
    **kwargs
) -> Dict[str, Any]:
    """Create a test project with optional customization."""
    
    if project_id is None:
        project_id = f"project_{uuid.uuid4().hex[:8]}"
    
    if name is None:
        name = f"Test Project {project_id[-4:]}"
    
    if description is None:
        description = f"Test project description for {name}"
    
    return {
        "id": project_id,
        "name": name,
        "description": description,
        "created_at": datetime.now().isoformat(),
        "status": "active",
        **kwargs
    }


def create_task_batch(
    count: int,
    project_id: Optional[str] = None,
    status_distribution: Optional[Dict[TaskStatus, float]] = None,
    priority_distribution: Optional[Dict[TaskPriority, float]] = None
) -> List[Task]:
    """Create a batch of test tasks with realistic distributions."""
    
    if project_id is None:
        project_id = f"batch_project_{uuid.uuid4().hex[:6]}"
    
    # Default distributions
    if status_distribution is None:
        status_distribution = {
            TaskStatus.PENDING: 0.4,
            TaskStatus.IN_PROGRESS: 0.3,
            TaskStatus.COMPLETED: 0.2,
            TaskStatus.BLOCKED: 0.1
        }
    
    if priority_distribution is None:
        priority_distribution = {
            TaskPriority.LOW: 0.3,
            TaskPriority.NORMAL: 0.4,
            TaskPriority.HIGH: 0.2,
            TaskPriority.CRITICAL: 0.1
        }
    
    tasks = []
    
    for i in range(count):
        # Select status based on distribution
        status = random.choices(
            list(status_distribution.keys()),
            weights=list(status_distribution.values())
        )[0]
        
        # Select priority based on distribution  
        priority = random.choices(
            list(priority_distribution.keys()),
            weights=list(priority_distribution.values())
        )[0]
        
        task = create_test_task(
            title=f"Batch Task {i+1}",
            description=f"Task {i+1} in batch of {count} for testing",
            status=status,
            priority=priority,
            project_id=project_id
        )
        
        tasks.append(task)
    
    return tasks


def create_realistic_task_set() -> List[Task]:
    """Create a realistic set of tasks for testing complex scenarios."""
    
    # Web application project
    web_tasks = [
        create_test_task(
            title="Implement user authentication",
            description="Add JWT-based authentication with login/logout functionality",
            status=TaskStatus.COMPLETED,
            priority=TaskPriority.HIGH,
            project_id="web_app_project"
        ),
        create_test_task(
            title="Design responsive UI components",
            description="Create reusable React components for the user interface",
            status=TaskStatus.IN_PROGRESS,
            priority=TaskPriority.NORMAL,
            project_id="web_app_project"
        ),
        create_test_task(
            title="Setup database schema",
            description="Design and implement PostgreSQL database schema",
            status=TaskStatus.COMPLETED,
            priority=TaskPriority.HIGH,
            project_id="web_app_project"
        ),
        create_test_task(
            title="Write API documentation",
            description="Document all REST API endpoints with OpenAPI specification",
            status=TaskStatus.PENDING,
            priority=TaskPriority.LOW,
            project_id="web_app_project"
        ),
        create_test_task(
            title="Implement password reset",
            description="Add secure password reset functionality via email",
            status=TaskStatus.BLOCKED,
            priority=TaskPriority.NORMAL,
            project_id="web_app_project"
        )
    ]
    
    # Mobile application project
    mobile_tasks = [
        create_test_task(
            title="Setup React Native environment",
            description="Configure development environment for React Native",
            status=TaskStatus.COMPLETED,
            priority=TaskPriority.HIGH,
            project_id="mobile_app_project"
        ),
        create_test_task(
            title="Implement navigation",
            description="Setup React Navigation for app navigation",
            status=TaskStatus.IN_PROGRESS,
            priority=TaskPriority.NORMAL,
            project_id="mobile_app_project"
        ),
        create_test_task(
            title="Add push notifications",
            description="Integrate Firebase for push notifications",
            status=TaskStatus.PENDING,
            priority=TaskPriority.NORMAL,
            project_id="mobile_app_project"
        )
    ]
    
    # DevOps project
    devops_tasks = [
        create_test_task(
            title="Setup CI/CD pipeline",
            description="Configure GitHub Actions for automated deployment",
            status=TaskStatus.COMPLETED,
            priority=TaskPriority.CRITICAL,
            project_id="devops_project"
        ),
        create_test_task(
            title="Configure monitoring",
            description="Setup application monitoring with Prometheus and Grafana",
            status=TaskStatus.IN_PROGRESS,
            priority=TaskPriority.HIGH,
            project_id="devops_project"
        ),
        create_test_task(
            title="Implement backup strategy",
            description="Setup automated database backups to cloud storage",
            status=TaskStatus.PENDING,
            priority=TaskPriority.NORMAL,
            project_id="devops_project"
        )
    ]
    
    return web_tasks + mobile_tasks + devops_tasks


def create_test_embeddings(task_ids: List[str], dimension: int = 384) -> Dict[str, List[float]]:
    """Create test embeddings for a list of task IDs."""
    embeddings = {}
    
    for task_id in task_ids:
        # Generate reproducible embeddings based on task ID
        random.seed(hash(task_id) % (2**32))
        embedding = [random.uniform(-1.0, 1.0) for _ in range(dimension)]
        embeddings[task_id] = embedding
    
    return embeddings


def create_similar_task_embeddings(base_task_id: str, similar_task_ids: List[str], dimension: int = 384) -> Dict[str, List[float]]:
    """Create embeddings where similar tasks have high cosine similarity."""
    embeddings = {}
    
    # Generate base embedding
    random.seed(hash(base_task_id) % (2**32))
    base_embedding = [random.uniform(-1.0, 1.0) for _ in range(dimension)]
    embeddings[base_task_id] = base_embedding
    
    # Generate similar embeddings (with noise)
    for task_id in similar_task_ids:
        # Start with base embedding and add small random noise
        random.seed(hash(task_id) % (2**32))
        similar_embedding = [
            val + random.uniform(-0.1, 0.1) for val in base_embedding
        ]
        embeddings[task_id] = similar_embedding
    
    return embeddings


def create_clustered_embeddings(clusters: Dict[str, List[str]], dimension: int = 384) -> Dict[str, List[float]]:
    """Create embeddings that naturally cluster into specified groups."""
    embeddings = {}
    
    cluster_centers = []
    
    # Generate cluster centers
    for i, cluster_name in enumerate(clusters.keys()):
        random.seed(i * 1000)  # Deterministic centers
        center = [random.uniform(-1.0, 1.0) for _ in range(dimension)]
        cluster_centers.append(center)
    
    # Generate embeddings around cluster centers
    for cluster_idx, (cluster_name, task_ids) in enumerate(clusters.items()):
        center = cluster_centers[cluster_idx]
        
        for task_id in task_ids:
            random.seed(hash(task_id) % (2**32))
            # Generate embedding close to cluster center
            embedding = [
                center_val + random.uniform(-0.2, 0.2) 
                for center_val in center
            ]
            embeddings[task_id] = embedding
    
    return embeddings


def create_dependency_graph(tasks: List[Task]) -> List[Dict[str, Any]]:
    """Create a realistic dependency graph for a list of tasks."""
    dependencies = []
    
    # Sort tasks by priority (higher priority tasks are often dependencies)
    sorted_tasks = sorted(tasks, key=lambda t: t.priority.value, reverse=True)
    
    for i, task in enumerate(sorted_tasks[1:], 1):
        # Each task depends on 0-2 previous tasks
        num_deps = random.randint(0, min(2, i))
        
        for _ in range(num_deps):
            dependency_idx = random.randint(0, i - 1)
            dependency_task = sorted_tasks[dependency_idx]
            
            dependencies.append({
                "task_id": task.id,
                "depends_on": dependency_task.id,
                "relationship_type": "depends_on",
                "weight": random.uniform(0.5, 1.0)
            })
    
    return dependencies


def create_time_series_tasks(
    count: int,
    start_date: datetime,
    end_date: datetime,
    project_id: Optional[str] = None
) -> List[Task]:
    """Create tasks with timestamps spread across a time range."""
    
    if project_id is None:
        project_id = f"timeseries_project_{uuid.uuid4().hex[:6]}"
    
    tasks = []
    time_delta = (end_date - start_date) / count
    
    for i in range(count):
        created_at = start_date + (time_delta * i)
        
        # Add some randomness to creation times
        created_at += timedelta(
            hours=random.randint(-12, 12),
            minutes=random.randint(-30, 30)
        )
        
        task = create_test_task(
            title=f"Time Series Task {i+1}",
            description=f"Task created at {created_at.strftime('%Y-%m-%d %H:%M')}",
            project_id=project_id
        )
        
        task.created_at = created_at
        
        # Simulate task progression over time
        if created_at < datetime.now() - timedelta(days=7):
            task.status = TaskStatus.COMPLETED
        elif created_at < datetime.now() - timedelta(days=3):
            task.status = random.choice([TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED])
        else:
            task.status = random.choice([TaskStatus.PENDING, TaskStatus.IN_PROGRESS])
        
        tasks.append(task)
    
    return tasks


# Predefined test scenarios
TEST_SCENARIOS = {
    "small_project": {
        "tasks": lambda: create_task_batch(5, "small_project"),
        "description": "Small project with 5 tasks for basic testing"
    },
    
    "medium_project": {
        "tasks": lambda: create_task_batch(25, "medium_project"),
        "description": "Medium project with 25 tasks for integration testing"
    },
    
    "large_project": {
        "tasks": lambda: create_task_batch(100, "large_project"),
        "description": "Large project with 100 tasks for performance testing"
    },
    
    "realistic_multi_project": {
        "tasks": create_realistic_task_set,
        "description": "Realistic multi-project scenario with diverse tasks"
    },
    
    "blocked_tasks_scenario": {
        "tasks": lambda: create_task_batch(
            10, 
            "blocked_project",
            status_distribution={
                TaskStatus.BLOCKED: 0.6,
                TaskStatus.PENDING: 0.3,
                TaskStatus.IN_PROGRESS: 0.1
            }
        ),
        "description": "Project with many blocked tasks for error testing"
    },
    
    "high_priority_scenario": {
        "tasks": lambda: create_task_batch(
            15,
            "urgent_project", 
            priority_distribution={
                TaskPriority.CRITICAL: 0.4,
                TaskPriority.HIGH: 0.4,
                TaskPriority.NORMAL: 0.2
            }
        ),
        "description": "Project with many high-priority tasks"
    }
}


def get_test_scenario(scenario_name: str) -> List[Task]:
    """Get tasks for a predefined test scenario."""
    if scenario_name not in TEST_SCENARIOS:
        raise ValueError(f"Unknown scenario: {scenario_name}")
    
    return TEST_SCENARIOS[scenario_name]["tasks"]()


def list_test_scenarios() -> Dict[str, str]:
    """List available test scenarios."""
    return {
        name: scenario["description"] 
        for name, scenario in TEST_SCENARIOS.items()
    }