# Task Management Guide

**Master Vespera V2's hierarchical task management system and transform how you organize, track, and execute projects.**

## 🎯 Overview

Vespera V2's task management system goes far beyond simple to-do lists. It provides:

- **🌲 Hierarchical Organization**: Parent-child task relationships with unlimited nesting
- **🔗 Smart Dependencies**: Automatic dependency tracking and cycle detection
- **🤖 AI-Powered Intelligence**: Semantic search and smart recommendations
- **👥 Role-Based Execution**: Capability-restricted task assignment
- **📊 Real-time Analytics**: Project health and progress tracking
- **⚡ Background Automation**: Automatic maintenance and optimization

## 📋 Task Fundamentals

### Task Structure

Every task in Vespera V2 has a rich data model:

```yaml
Task Properties:
  Core:
    - task_id: Unique identifier (auto-generated)
    - title: Clear, descriptive title
    - description: Detailed explanation
    - status: pending | in_progress | completed | blocked
    - priority: low | normal | high | critical
    
  Organization:
    - project_id: Project grouping identifier
    - feature: Feature area or component
    - parent_id: Parent task for hierarchy
    - dependencies: List of prerequisite tasks
    
  Assignment:
    - role: Assigned role with capabilities
    - assignee: Specific person (optional)
    - estimated_hours: Time estimation
    - actual_hours: Time tracking
    
  Metadata:
    - tags: Categorization labels
    - created_at: Creation timestamp
    - updated_at: Last modification
    - completed_at: Completion timestamp
```

### Task Lifecycle

Tasks flow through a well-defined lifecycle:

```
📝 Created
    ↓
⏳ Pending ──→ 🚀 In Progress ──→ ✅ Completed
    ↓              ↓
🚫 Blocked ←──────┘
```

**Status Definitions:**
- **Pending**: Ready to start, waiting for assignment or scheduling
- **In Progress**: Currently being worked on
- **Completed**: Successfully finished with outputs
- **Blocked**: Cannot proceed due to dependencies or issues

## 🌲 Hierarchical Organization

### Creating Task Hierarchies

Organize complex projects with parent-child relationships:

**Method 1: Single Task Creation**
```python
# Create parent task
main_task = create_task({
    "title": "Build E-commerce Website",
    "description": "Complete online store with payment processing",
    "project_id": "ecommerce-v1"
})

# Create child tasks
frontend_task = create_task({
    "title": "Develop Frontend Interface",
    "description": "React-based user interface with responsive design",
    "parent_id": main_task.task_id,
    "role": "frontend_developer"
})

backend_task = create_task({
    "title": "Build Backend API",
    "description": "RESTful API with database integration",
    "parent_id": main_task.task_id,
    "role": "backend_developer"
})
```

**Method 2: Task Tree Creation**
```python
# Create entire hierarchy at once
create_task_tree({
    "title": "Build E-commerce Website",
    "description": "Complete online store with payment processing",
    "project_id": "ecommerce-v1",
    "subtasks": [
        {
            "title": "Develop Frontend Interface",
            "description": "React-based user interface",
            "role": "frontend_developer",
            "priority": "high"
        },
        {
            "title": "Build Backend API", 
            "description": "RESTful API with database",
            "role": "backend_developer",
            "priority": "high"
        },
        {
            "title": "Setup Payment Processing",
            "description": "Integrate Stripe payment gateway",
            "role": "full_stack_developer",
            "priority": "normal"
        }
    ]
})
```

### Visualizing Task Trees

View your project structure as a tree:

```python
task_tree = get_task_tree({"task_id": "main-task-id"})

# Example output:
# 📁 Build E-commerce Website
# ├── 🎨 Develop Frontend Interface (frontend_developer)
# │   ├── ⚛️ Setup React Components
# │   ├── 🎨 Design Product Catalog
# │   └── 📱 Implement Responsive Layout
# ├── 🔧 Build Backend API (backend_developer)
# │   ├── 🗄️ Design Database Schema
# │   ├── 🔌 Create REST Endpoints
# │   └── 🔐 Implement Authentication
# └── 💳 Setup Payment Processing (full_stack_developer)
#     ├── 🔗 Integrate Stripe API
#     └── 🧪 Test Payment Flows
```

### Task Relationships

**Parent-Child Benefits:**
- **Automatic Progress Rollup**: Parent completion calculated from children
- **Dependency Inheritance**: Children automatically depend on parent prerequisites
- **Batch Operations**: Update, assign, or complete entire subtrees
- **Progress Tracking**: Visual progress bars for complex projects

**Best Practices:**
- Keep hierarchy depth reasonable (3-4 levels max)
- Use consistent naming conventions
- Group related functionality together
- Balance granularity vs. complexity

## 🔗 Dependency Management

### Creating Dependencies

Tasks can depend on other tasks being completed first:

```python
# Method 1: Add dependency during creation
create_task({
    "title": "Deploy to Production",
    "description": "Deploy tested code to production servers",
    "dependencies": ["testing-task-id", "security-review-task-id"]
})

# Method 2: Add dependency to existing task
add_task_dependency({
    "task_id": "deployment-task-id",
    "depends_on_task_id": "testing-task-id"
})
```

### Dependency Types

**Hard Dependencies** (Default):
- Task cannot start until dependency is completed
- Automatically enforced by the system
- Creates critical path for project scheduling

**Soft Dependencies** (Future feature):
- Task can start but may need dependency output
- Warning-based rather than blocking
- Useful for parallel work streams

### Cycle Detection

Vespera automatically prevents dependency cycles:

```python
# This would be automatically rejected:
add_task_dependency("task-a", "task-b")  # A depends on B
add_task_dependency("task-b", "task-c")  # B depends on C  
add_task_dependency("task-c", "task-a")  # C depends on A (creates cycle!)

# Result: Error with cycle detection details
{
    "error": "DEPENDENCY_CYCLE_DETECTED",
    "cycle": ["task-a", "task-b", "task-c", "task-a"],
    "suggestion": "Remove dependency from task-c to task-a"
}
```

### Critical Path Analysis

Identify the longest path through your project:

```python
dependencies = analyze_task_dependencies({"task_id": "main-project-id"})

print("Critical Path:")
for task_id in dependencies["critical_path"]:
    task = get_task({"task_id": task_id})
    print(f"→ {task['title']} ({task['estimated_hours']}h)")

# Example output:
# → Design Database Schema (8h)
# → Implement Core API (16h)
# → Add Authentication (12h)
# → Integration Testing (8h)
# → Production Deployment (4h)
# Total: 48 hours
```

## 🤖 AI-Powered Intelligence

### Semantic Search

Find tasks using natural language, not just keywords:

```python
# Traditional keyword search limitations:
# search("database") → only finds tasks with word "database"

# Semantic search power:
search_results = semantic_search({
    "query": "data storage and retrieval optimization",
    "n_results": 10,
    "min_similarity": 0.7
})

# Finds conceptually related tasks:
# - "Optimize database queries"
# - "Implement caching layer"
# - "Design efficient data models"
# - "Add database indexing"
```

### Smart Task Discovery

**Find Similar Tasks:**
```python
similar = find_similar_tasks({
    "task_id": "authentication-task-id",
    "n_results": 5
})

# Discovers related tasks:
# - "Add password reset functionality"
# - "Implement OAuth integration"
# - "Setup session management" 
# - "Add two-factor authentication"
```

**Task Clustering:**
```python
clusters = cluster_tasks({
    "project_id": "web-app",
    "n_clusters": 5
})

# Automatically groups tasks:
# Cluster 1: "Authentication & Security"
# Cluster 2: "Frontend Components"
# Cluster 3: "Database Operations" 
# Cluster 4: "API Development"
# Cluster 5: "Testing & QA"
```

### Intelligent Recommendations

Get AI-powered suggestions for your project:

```python
recommendations = get_recommendations({
    "project_id": "web-app",
    "context": "authentication_implementation"
})

# Example recommendations:
# 1. "Add input validation" (confidence: 0.85)
#    Reason: Authentication systems require robust input validation
#
# 2. "Implement rate limiting" (confidence: 0.78)
#    Reason: Prevent brute force attacks on login endpoints
#
# 3. "Add password strength requirements" (confidence: 0.73)
#    Reason: Improve security with password complexity rules
```

## 👥 Role-Based Task Management

### Understanding Roles

Roles define what capabilities are needed to complete tasks:

```yaml
Role Example - Frontend Developer:
  name: frontend_developer
  description: Frontend development with modern frameworks
  capabilities:
    - WRITE_CODE: Can create and modify code
    - READ_CODE: Can analyze existing code
    - DEBUG_CODE: Can troubleshoot issues
    - TEST_CODE: Can write and run tests
  file_patterns:
    - "*.js", "*.jsx", "*.ts", "*.tsx"
    - "*.css", "*.scss", "*.html"
  tools:
    - npm, webpack, babel, jest
  max_concurrent_tasks: 3
```

### Assigning Roles

**During Task Creation:**
```python
create_task({
    "title": "Implement Shopping Cart",
    "description": "Add cart functionality with local storage",
    "role": "frontend_developer",  # Role assigned at creation
    "project_id": "ecommerce"
})
```

**After Task Creation:**
```python
assign_role_to_task({
    "task_id": "shopping-cart-task-id",
    "role_name": "frontend_developer"
})
```

### Role Capability Matching

Vespera automatically validates that assigned roles have required capabilities:

```python
# This assignment would succeed:
task = create_task({
    "title": "Fix CSS layout issues",
    "role": "frontend_developer"  # Has WRITE_CODE + CSS file access
})

# This assignment would warn or fail:
task = create_task({
    "title": "Optimize database queries", 
    "role": "frontend_developer"  # Lacks database capabilities
})
```

### Workload Management

Monitor and balance role assignments:

```python
workload = get_role_workload_analysis()

# Example output:
# frontend_developer: 5/8 tasks (62% utilization) ✅ Normal
# backend_developer: 8/6 tasks (133% utilization) ⚠️ Overloaded  
# devops_engineer: 2/5 tasks (40% utilization) 📈 Available

# Recommendations:
# - Move 2 backend tasks to full_stack_developer
# - Assign new infrastructure tasks to devops_engineer
```

## 📊 Project Health & Analytics

### Dashboard Overview

Get comprehensive project insights:

```python
dashboard = get_task_dashboard({"project_id": "ecommerce"})

# Summary metrics:
# Total Tasks: 47
# Completed: 28 (59.6%)
# In Progress: 12 (25.5%)
# Pending: 5 (10.6%)
# Blocked: 2 (4.3%)

# Health score: 8.2/10
# Velocity: 3.4 tasks/week
# Estimated completion: 2 weeks
```

### Progress Tracking

**Completion Rates:**
```python
# Overall project progress
completion_rate = completed_tasks / total_tasks

# By priority:
critical_completion = completed_critical / total_critical
high_completion = completed_high / total_high

# By role:
frontend_completion = frontend_completed / frontend_total
backend_completion = backend_completed / backend_total
```

**Velocity Tracking:**
```python
# Tasks completed per time period
weekly_velocity = tasks_completed_last_7_days / 7
monthly_velocity = tasks_completed_last_30_days / 30

# Trend analysis
velocity_trend = "increasing" | "stable" | "decreasing"
```

### Bottleneck Detection

Identify what's slowing down your project:

```python
bottlenecks = get_project_bottlenecks({"project_id": "ecommerce"})

# Resource bottlenecks:
# - backend_developer role overallocated (8/6 tasks)
# - frontend_developer waiting for backend APIs

# Dependency bottlenecks:
# - "Database schema" task blocks 5 other tasks
# - "Authentication API" delays frontend integration

# Process bottlenecks:
# - 3 tasks stuck in review for > 2 days
# - Integration testing environment unavailable
```

### Risk Assessment

Monitor project risks in real-time:

```python
health = get_project_health({"project_id": "ecommerce"})

# Risk factors:
risks = health["risks"]
# - High: Dependency cycle detected
# - Medium: Backend developer overallocated
# - Low: No recent commits to feature branch

# Mitigation suggestions:
# - Break dependency cycle by splitting large task
# - Reassign 2 tasks to full_stack_developer
# - Encourage more frequent commits
```

## ⚡ Advanced Task Operations

### Batch Operations

Perform operations on multiple tasks efficiently:

```python
# Update multiple tasks
update_tasks_batch({
    "task_ids": ["task-1", "task-2", "task-3"],
    "updates": {
        "priority": "high",
        "assignee": "john.doe@company.com"
    }
})

# Complete multiple related tasks
complete_tasks_batch({
    "task_ids": ["unit-test-1", "unit-test-2", "unit-test-3"],
    "output": "All unit tests passing",
    "artifacts": ["test_results.xml"]
})
```

### Task Templates

Create reusable task patterns:

```python
# Define template
authentication_template = {
    "title": "Implement {feature} Authentication",
    "subtasks": [
        {
            "title": "Design {feature} auth schema",
            "role": "backend_developer",
            "estimated_hours": 4
        },
        {
            "title": "Implement {feature} login flow", 
            "role": "frontend_developer",
            "estimated_hours": 6
        },
        {
            "title": "Add {feature} auth tests",
            "role": "qa_engineer", 
            "estimated_hours": 3
        }
    ]
}

# Use template
create_from_template({
    "template": authentication_template,
    "variables": {"feature": "Google OAuth"},
    "project_id": "user-management"
})
```

### Task Cloning

Duplicate tasks for similar work:

```python
# Clone single task
clone_task({
    "source_task_id": "original-task-id",
    "modifications": {
        "title": "Implement logout functionality",
        "role": "frontend_developer"
    }
})

# Clone task tree
clone_task_tree({
    "source_task_id": "authentication-tree-id",
    "target_project": "mobile-app",
    "role_mapping": {
        "web_developer": "mobile_developer"
    }
})
```

### Task Archiving

Manage completed or obsolete tasks:

```python
# Archive completed tasks older than 30 days
archive_tasks({
    "criteria": {
        "status": "completed",
        "completed_before": "2024-12-01"
    },
    "preserve_references": true
})

# Archive entire project
archive_project({
    "project_id": "legacy-system",
    "export_data": true,
    "export_format": "json"
})
```

## 🔄 Workflow Automation

### Automatic Status Updates

Configure automatic task progression:

```python
# Auto-progress when all children complete
configure_auto_progression({
    "task_id": "parent-task-id",
    "rule": "complete_when_all_children_complete"
})

# Auto-start when dependencies complete
configure_auto_start({
    "task_id": "dependent-task-id", 
    "rule": "start_when_dependencies_complete"
})
```

### Trigger-Based Actions

Set up automatic actions based on events:

```python
# Email notification when critical task is blocked
create_trigger({
    "event": "task_status_changed",
    "conditions": {
        "new_status": "blocked",
        "priority": "critical"
    },
    "action": {
        "type": "send_notification",
        "target": "project_manager@company.com",
        "message": "Critical task blocked: {task_title}"
    }
})

# Auto-assign tasks to available role
create_trigger({
    "event": "task_created",
    "conditions": {
        "role": "backend_developer",
        "project_id": "high_priority_project"
    },
    "action": {
        "type": "auto_assign",
        "strategy": "least_loaded_available"
    }
})
```

### Integration Hooks

Connect with external tools:

```python
# Create GitHub issue when task created
create_hook({
    "event": "task_created",
    "conditions": {"project_id": "open_source_project"},
    "action": {
        "type": "webhook",
        "url": "https://api.github.com/repos/owner/repo/issues",
        "method": "POST",
        "payload": {
            "title": "{task_title}",
            "body": "{task_description}",
            "labels": ["{priority}", "vespera-task"]
        }
    }
})

# Update Slack when milestone completed
create_hook({
    "event": "task_completed",
    "conditions": {"tags": ["milestone"]},
    "action": {
        "type": "slack_notification",
        "channel": "#project-updates",
        "message": "🎉 Milestone completed: {task_title}"
    }
})
```

## 🎯 Best Practices

### Task Creation Guidelines

**✅ Do:**
- Use clear, action-oriented titles ("Implement user login" not "User login")
- Include detailed descriptions with acceptance criteria
- Set realistic time estimates based on historical data
- Add relevant tags for categorization
- Assign appropriate roles based on required capabilities

**❌ Avoid:**
- Vague titles ("Fix bugs" or "Update stuff")
- Missing descriptions or context
- Overly optimistic time estimates
- Creating tasks too small (< 1 hour) or too large (> 40 hours)
- Assigning roles without required capabilities

### Hierarchy Design

**Effective Hierarchies:**
```
📁 E-commerce Website (Project)
├── 🔐 User Management (Feature)
│   ├── 📝 User Registration (8h)
│   ├── 🔑 User Login (6h)
│   └── 👤 Profile Management (12h)
├── 🛒 Shopping Cart (Feature)
│   ├── ➕ Add Items (4h)
│   ├── ✏️ Edit Quantities (3h)
│   └── 🗑️ Remove Items (2h)
└── 💳 Payment Processing (Feature)
    ├── 🔗 Stripe Integration (16h)
    └── 🧪 Payment Testing (8h)
```

**Hierarchy Principles:**
- Group by feature or component
- Keep similar complexity at same level
- Use consistent granularity
- Limit depth to 3-4 levels
- Balance breadth vs. depth

### Dependency Management

**Smart Dependencies:**
```python
# Good: Logical workflow dependencies
"Design database schema" → "Implement user model" → "Create registration API"

# Good: Technical dependencies
"Setup development environment" → "Write code" → "Run tests"

# Avoid: Artificial dependencies
"Fix typo in documentation" → "Deploy to production"
```

**Dependency Best Practices:**
- Only create necessary dependencies
- Prefer task breakdown over complex dependencies
- Document dependency reasoning
- Regularly review and clean up obsolete dependencies
- Use parallel work streams when possible

### Role Assignment Strategy

**Capacity Planning:**
```python
# Monitor role utilization
frontend_tasks = count_tasks_by_role("frontend_developer")
frontend_capacity = get_role_capacity("frontend_developer")
utilization = frontend_tasks / frontend_capacity

if utilization > 0.8:
    # Consider reassigning or hiring
    print("Frontend developer overallocated")
```

**Cross-Training Benefits:**
- Assign full_stack_developer to both frontend and backend tasks
- Use code_reviewer role for quality assurance across teams
- Rotate developers through different role assignments

### Performance Optimization

**Search Optimization:**
- Use specific terms in task titles and descriptions
- Add relevant tags for better categorization
- Include context in task descriptions for better embeddings
- Regularly update task status to maintain accuracy

**System Performance:**
- Limit task tree depth for faster loading
- Use pagination for large task lists
- Archive completed projects to reduce database size
- Monitor background service performance

## 🚨 Troubleshooting Common Issues

### Task Creation Problems

**Issue**: "Role not found" error
```python
# Problem: Invalid role name
create_task({"title": "Fix bug", "role": "bug_fixer"})  # Role doesn't exist

# Solution: Check available roles
roles = list_roles()
print([role["name"] for role in roles["roles"]])

# Use valid role
create_task({"title": "Fix bug", "role": "backend_developer"})
```

**Issue**: Dependency cycle detected
```python
# Problem: Circular dependencies
# A depends on B, B depends on C, C depends on A

# Solution: Analyze dependencies
deps = analyze_task_dependencies({"task_id": "task-a"})
print("Cycle detected:", deps["cycles"])

# Break the cycle by removing one dependency
remove_task_dependency("task-c", "task-a")
```

### Search Issues

**Issue**: Poor search results
```python
# Problem: Too generic search terms
search_results = semantic_search({"query": "task"})  # Too broad

# Solution: Use specific, contextual terms
search_results = semantic_search({
    "query": "user authentication login security backend API",
    "min_similarity": 0.6
})
```

**Issue**: No search results found
```python
# Problem: Embeddings not generated yet
# Solution: Wait for background service or force embedding generation
from databases import ChromaService
chroma = ChromaService()
chroma.force_embedding_generation()
```

### Performance Issues

**Issue**: Slow task loading
```python
# Problem: Loading too many tasks at once
# Solution: Use pagination and filtering
tasks = list_tasks({
    "limit": 20,           # Limit results
    "project_id": "specific-project",  # Filter scope
    "status": "in_progress"  # Only active tasks
})
```

**Issue**: Dashboard timeout
```python
# Problem: Project too large for dashboard
# Solution: Use project-specific dashboards
dashboard = get_task_dashboard({"project_id": "specific-project"})

# Or filter by time range
dashboard = get_task_dashboard({
    "created_after": "2025-01-01",
    "status": ["in_progress", "pending"]
})
```

---

**🎉 You're now equipped to master Vespera V2's task management system!**

*Next: Explore [Project Templates](project-templates.md) to accelerate your project setup, or dive into [Workflow Automation](workflow-automation.md) for advanced productivity.*