# Basic Workflows Examples

**Real-world examples of common task management patterns and workflows using Vespera V2.**

## 🎯 Overview

This directory contains practical examples that demonstrate how to use Vespera V2 for common project management scenarios. Each example includes complete code samples, explanations, and best practices.

## 📋 Available Workflows

### 1. **Software Development Workflows**
- [Feature Development Cycle](feature-development-cycle.md)
- [Bug Tracking and Resolution](bug-tracking-workflow.md)
- [Code Review Process](code-review-workflow.md)
- [Release Management](release-management-workflow.md)

### 2. **Team Collaboration Workflows**
- [Sprint Planning and Execution](sprint-planning-workflow.md)
- [Cross-Team Dependencies](cross-team-dependencies.md)
- [Daily Standup Automation](daily-standup-automation.md)
- [Retrospective Task Creation](retrospective-workflow.md)

### 3. **Project Management Workflows**
- [Project Kickoff and Setup](project-kickoff-workflow.md)
- [Milestone Tracking](milestone-tracking-workflow.md)
- [Resource Allocation](resource-allocation-workflow.md)
- [Risk Management](risk-management-workflow.md)

### 4. **Automation Workflows**
- [Git Integration Workflows](git-integration-workflow.md)
- [CI/CD Pipeline Integration](cicd-integration-workflow.md)
- [Notification and Alerting](notification-workflow.md)
- [Automated Progress Updates](automated-progress-workflow.md)

## 🚀 Quick Start Example

Here's a simple example to get you started with Vespera V2 workflows:

### Create a Web Application Project

```python
from vespera import VesperaClient

# Initialize client (using MCP tools or REST API)
client = VesperaClient()

# 1. Create main project task
project = client.create_task_tree({
    "title": "E-commerce Website Development",
    "description": "Full-stack e-commerce platform with modern UI and secure backend",
    "project_id": "ecommerce-v1",
    "subtasks": [
        {
            "title": "Frontend Development",
            "description": "React-based user interface with responsive design",
            "role": "frontend_developer",
            "priority": "high"
        },
        {
            "title": "Backend API Development", 
            "description": "RESTful API with authentication and payment processing",
            "role": "backend_developer",
            "priority": "high"
        },
        {
            "title": "Database Design",
            "description": "Database schema for products, users, and orders",
            "role": "database_architect",
            "priority": "critical"
        },
        {
            "title": "DevOps and Deployment",
            "description": "CI/CD pipeline and production deployment",
            "role": "devops_engineer",
            "priority": "normal"
        }
    ]
})

# 2. Add dependencies between tasks
client.add_task_dependency(
    task_id=project["created_subtasks"][1]["task_id"],  # Backend API
    depends_on_task_id=project["created_subtasks"][2]["task_id"]  # Database Design
)

# 3. Set up automated progress tracking
client.create_automation_rule({
    "trigger": "task_completed",
    "conditions": {"project_id": "ecommerce-v1"},
    "actions": [
        {
            "type": "update_parent_progress",
            "calculate_percentage": True
        },
        {
            "type": "notify_team",
            "channel": "#development",
            "message": "Task completed: {task_title}"
        }
    ]
})

print(f"✅ Created project with {len(project['created_subtasks'])} tasks")
```

## 🎨 Workflow Patterns

### Pattern 1: Hierarchical Feature Development

```python
def create_feature_workflow(feature_name, components):
    """Create a complete feature development workflow"""
    
    # Main feature task
    feature_task = create_task({
        "title": f"Implement {feature_name}",
        "description": f"Complete implementation of {feature_name} feature",
        "project_id": "main-project",
        "feature": feature_name.lower().replace(" ", "-")
    })
    
    # Create subtasks for each component
    component_tasks = []
    for component in components:
        task = create_task({
            "title": f"{component['name']} - {feature_name}",
            "description": component['description'],
            "parent_id": feature_task["task_id"],
            "role": component['role'],
            "priority": component.get('priority', 'normal')
        })
        component_tasks.append(task)
    
    # Add dependencies if specified
    for i, component in enumerate(components):
        if 'depends_on' in component:
            depends_on_index = next(
                j for j, c in enumerate(components) 
                if c['name'] == component['depends_on']
            )
            add_task_dependency(
                task_id=component_tasks[i]["task_id"],
                depends_on_task_id=component_tasks[depends_on_index]["task_id"]
            )
    
    return feature_task, component_tasks

# Example usage
feature, tasks = create_feature_workflow(
    "User Authentication",
    [
        {
            "name": "Database Schema",
            "description": "Design user and session tables",
            "role": "database_architect",
            "priority": "high"
        },
        {
            "name": "Backend API",
            "description": "Authentication endpoints and middleware",
            "role": "backend_developer",
            "priority": "high",
            "depends_on": "Database Schema"
        },
        {
            "name": "Frontend Components",
            "description": "Login and registration forms",
            "role": "frontend_developer",
            "priority": "normal",
            "depends_on": "Backend API"
        },
        {
            "name": "Testing",
            "description": "Unit and integration tests",
            "role": "qa_engineer",
            "priority": "normal"
        }
    ]
)
```

### Pattern 2: Sprint-Based Workflow

```python
def create_sprint_workflow(sprint_number, start_date, end_date, stories):
    """Create a complete sprint with user stories and tasks"""
    
    # Sprint container task
    sprint_task = create_task({
        "title": f"Sprint {sprint_number}",
        "description": f"Sprint {sprint_number}: {start_date} to {end_date}",
        "project_id": "agile-project",
        "metadata": {
            "sprint_number": sprint_number,
            "start_date": start_date,
            "end_date": end_date,
            "story_points": sum(story.get('points', 0) for story in stories)
        }
    })
    
    # Create user stories
    story_tasks = []
    for story in stories:
        story_task = create_task({
            "title": story['title'],
            "description": story['description'],
            "parent_id": sprint_task["task_id"],
            "priority": story.get('priority', 'normal'),
            "metadata": {
                "story_points": story.get('points', 0),
                "acceptance_criteria": story.get('acceptance_criteria', [])
            }
        })
        
        # Create implementation tasks for the story
        for task_spec in story.get('tasks', []):
            create_task({
                "title": task_spec['title'],
                "description": task_spec['description'],
                "parent_id": story_task["task_id"],
                "role": task_spec['role'],
                "priority": task_spec.get('priority', 'normal')
            })
        
        story_tasks.append(story_task)
    
    # Set up sprint automation
    create_automation_rule({
        "trigger": "task_status_changed",
        "conditions": {
            "parent_id": sprint_task["task_id"],
            "new_status": "completed"
        },
        "actions": [
            {
                "type": "calculate_sprint_progress",
                "sprint_id": sprint_task["task_id"]
            },
            {
                "type": "update_burndown_chart",
                "sprint_id": sprint_task["task_id"]
            }
        ]
    })
    
    return sprint_task, story_tasks

# Example usage
sprint, stories = create_sprint_workflow(
    sprint_number=15,
    start_date="2025-01-20",
    end_date="2025-02-02",
    stories=[
        {
            "title": "User can reset password",
            "description": "As a user, I want to reset my password so that I can regain access to my account",
            "points": 5,
            "priority": "high",
            "acceptance_criteria": [
                "User can request password reset via email",
                "Reset link expires after 24 hours",
                "User can set new password successfully"
            ],
            "tasks": [
                {
                    "title": "Implement password reset API endpoint",
                    "description": "Create /api/auth/reset-password endpoint",
                    "role": "backend_developer"
                },
                {
                    "title": "Create password reset email template",
                    "description": "Design and implement reset email template",
                    "role": "frontend_developer"
                },
                {
                    "title": "Add password reset form",
                    "description": "Create UI for new password input",
                    "role": "frontend_developer"
                }
            ]
        }
    ]
)
```

### Pattern 3: Bug Triage and Resolution

```python
def create_bug_resolution_workflow(bug_report):
    """Create a structured workflow for bug resolution"""
    
    # Main bug task
    bug_task = create_task({
        "title": f"Bug: {bug_report['title']}",
        "description": bug_report['description'],
        "priority": determine_bug_priority(bug_report['severity']),
        "project_id": bug_report['project_id'],
        "metadata": {
            "bug_id": bug_report['id'],
            "severity": bug_report['severity'],
            "reporter": bug_report['reporter'],
            "environment": bug_report['environment'],
            "steps_to_reproduce": bug_report['steps_to_reproduce']
        }
    })
    
    # Triage task
    triage_task = create_task({
        "title": "Triage and Investigation",
        "description": "Investigate bug, determine root cause, and assign priority",
        "parent_id": bug_task["task_id"],
        "role": "tech_lead",
        "priority": "high"
    })
    
    # Investigation task
    investigation_task = create_task({
        "title": "Root Cause Analysis",
        "description": "Deep dive into the issue to identify root cause",
        "parent_id": bug_task["task_id"],
        "role": "senior_developer",
        "priority": "high"
    })
    
    # Fix implementation (created after triage)
    fix_task = create_task({
        "title": "Implement Fix",
        "description": "Develop and test the bug fix",
        "parent_id": bug_task["task_id"],
        "role": "backend_developer",  # Will be updated after triage
        "priority": "normal",
        "status": "blocked"  # Blocked until triage complete
    })
    
    # Testing task
    testing_task = create_task({
        "title": "Verify Fix",
        "description": "Test the fix and ensure no regressions",
        "parent_id": bug_task["task_id"],
        "role": "qa_engineer",
        "priority": "normal"
    })
    
    # Add dependencies
    add_task_dependency(investigation_task["task_id"], triage_task["task_id"])
    add_task_dependency(fix_task["task_id"], investigation_task["task_id"])
    add_task_dependency(testing_task["task_id"], fix_task["task_id"])
    
    # Set up automation for bug workflow
    create_automation_rule({
        "trigger": "task_completed",
        "conditions": {"task_id": triage_task["task_id"]},
        "actions": [
            {
                "type": "unblock_dependent_tasks",
                "target_task_id": fix_task["task_id"]
            },
            {
                "type": "assign_role_based_on_component",
                "target_task_id": fix_task["task_id"],
                "component_mapping": {
                    "frontend": "frontend_developer",
                    "backend": "backend_developer",
                    "database": "database_specialist"
                }
            }
        ]
    })
    
    return bug_task, [triage_task, investigation_task, fix_task, testing_task]

def determine_bug_priority(severity):
    """Map bug severity to task priority"""
    severity_map = {
        "critical": "critical",
        "high": "high", 
        "medium": "normal",
        "low": "low"
    }
    return severity_map.get(severity.lower(), "normal")
```

## 🔄 Workflow Automation Examples

### Automated Status Updates

```python
def setup_status_automation():
    """Set up automated status updates based on git commits"""
    
    # When code is committed, update task status
    create_automation_rule({
        "trigger": "git_commit",
        "conditions": {
            "commit_message_contains": ["#task-", "fixes #", "closes #"]
        },
        "actions": [
            {
                "type": "extract_task_id_from_commit",
                "pattern": r"#task-(\d+)"
            },
            {
                "type": "update_task_status",
                "new_status": "in_progress",
                "add_comment": "Work started - commit {commit_hash}"
            }
        ]
    })
    
    # When PR is merged, mark task as completed
    create_automation_rule({
        "trigger": "pull_request_merged",
        "conditions": {
            "pr_title_contains": ["task-", "fixes", "closes"]
        },
        "actions": [
            {
                "type": "extract_task_id_from_pr",
                "pattern": r"task-(\d+)"
            },
            {
                "type": "complete_task",
                "output": "PR merged: {pr_url}",
                "artifacts": ["pr_files"]
            }
        ]
    })

def setup_dependency_automation():
    """Automatically manage task dependencies"""
    
    # When a blocking task is completed, notify dependent tasks
    create_automation_rule({
        "trigger": "task_completed",
        "conditions": {"has_dependents": True},
        "actions": [
            {
                "type": "notify_dependent_tasks",
                "message": "Blocking task completed: {task_title}"
            },
            {
                "type": "auto_start_ready_tasks",
                "criteria": "all_dependencies_satisfied"
            }
        ]
    })
    
    # Detect and prevent circular dependencies
    create_automation_rule({
        "trigger": "dependency_added",
        "conditions": {},
        "actions": [
            {
                "type": "check_circular_dependency",
                "action_on_cycle": "reject_with_explanation"
            }
        ]
    })
```

### Team Communication Integration

```python
def setup_team_notifications():
    """Integrate with team communication tools"""
    
    # Slack notifications for important updates
    create_automation_rule({
        "trigger": "task_status_changed",
        "conditions": {"priority": ["high", "critical"]},
        "actions": [
            {
                "type": "slack_notification",
                "channel": "#development",
                "message": "🚨 {priority} task update: {task_title} is now {status}",
                "include_assignee": True
            }
        ]
    })
    
    # Daily standup preparation
    create_automation_rule({
        "trigger": "scheduled",
        "schedule": "0 8 * * MON-FRI",  # 8 AM weekdays
        "actions": [
            {
                "type": "generate_standup_report",
                "team_members": ["dev_team"],
                "include_sections": [
                    "completed_yesterday",
                    "planned_today", 
                    "blockers"
                ]
            },
            {
                "type": "post_to_slack",
                "channel": "#daily-standup",
                "message": "📊 Daily Standup Report:\n{standup_report}"
            }
        ]
    })
    
    # Code review assignment
    create_automation_rule({
        "trigger": "task_status_changed",
        "conditions": {
            "new_status": "review_ready",
            "role": ["frontend_developer", "backend_developer"]
        },
        "actions": [
            {
                "type": "assign_code_reviewer",
                "strategy": "round_robin",
                "exclude_author": True
            },
            {
                "type": "create_review_task",
                "title": "Code Review: {original_task_title}",
                "assignee": "{selected_reviewer}"
            }
        ]
    })
```

## 📊 Analytics and Reporting Workflows

### Project Health Monitoring

```python
def setup_project_health_monitoring():
    """Monitor project health and generate insights"""
    
    # Daily health check
    create_automation_rule({
        "trigger": "scheduled",
        "schedule": "0 9 * * *",  # 9 AM daily
        "actions": [
            {
                "type": "calculate_project_health",
                "metrics": [
                    "completion_rate",
                    "velocity",
                    "quality_score",
                    "risk_level"
                ]
            },
            {
                "type": "generate_health_report",
                "include_recommendations": True
            },
            {
                "type": "email_report",
                "recipients": ["project_managers"],
                "subject": "Daily Project Health Report"
            }
        ]
    })
    
    # Risk detection and alerting
    create_automation_rule({
        "trigger": "metric_threshold_exceeded",
        "conditions": {
            "metric": "blocked_tasks_percentage",
            "threshold": 20  # More than 20% of tasks blocked
        },
        "actions": [
            {
                "type": "escalate_to_management",
                "urgency": "high",
                "message": "Project has {blocked_percentage}% blocked tasks"
            },
            {
                "type": "analyze_blocking_causes",
                "generate_action_plan": True
            }
        ]
    })

def generate_weekly_reports():
    """Generate comprehensive weekly reports"""
    
    dashboard = get_task_dashboard()
    
    # Velocity analysis
    velocity_data = analyze_team_velocity(days=7)
    
    # Completion trends
    completion_trends = analyze_completion_trends(weeks=4)
    
    # Risk assessment
    risks = identify_project_risks()
    
    report = {
        "week_ending": datetime.now().strftime("%Y-%m-%d"),
        "summary": {
            "tasks_completed": dashboard["summary"]["completed_tasks"],
            "velocity": velocity_data["tasks_per_week"],
            "health_score": dashboard["metrics"]["project_health"]["overall_score"]
        },
        "achievements": get_completed_milestones(days=7),
        "challenges": risks["high_priority_risks"],
        "next_week_forecast": forecast_next_week_completion(),
        "recommendations": generate_actionable_recommendations()
    }
    
    return report
```

## 🧪 Testing Workflow Integration

### Automated Testing Workflows

```python
def setup_testing_workflows():
    """Integrate testing into the development workflow"""
    
    # Create testing tasks when development tasks are completed
    create_automation_rule({
        "trigger": "task_completed",
        "conditions": {
            "role": ["frontend_developer", "backend_developer"],
            "has_testing_required": True
        },
        "actions": [
            {
                "type": "create_testing_task",
                "title": "Test: {original_task_title}",
                "description": "Test the implementation of {original_task_title}",
                "role": "qa_engineer",
                "priority": "high",
                "parent_id": "{original_task_parent_id}"
            },
            {
                "type": "add_dependency",
                "testing_task_depends_on": "{original_task_id}"
            }
        ]
    })
    
    # Integration testing coordination
    create_automation_rule({
        "trigger": "multiple_tasks_completed",
        "conditions": {
            "task_group": "feature_implementation",
            "all_development_complete": True
        },
        "actions": [
            {
                "type": "create_integration_test_task",
                "title": "Integration Testing: {feature_name}",
                "role": "qa_engineer",
                "priority": "high"
            },
            {
                "type": "trigger_automated_tests",
                "test_suite": "integration",
                "environment": "staging"
            }
        ]
    })
```

## 🎯 Getting Started

1. **Choose a Workflow**: Select the workflow pattern that matches your needs
2. **Customize**: Adapt the example code to your specific requirements
3. **Test**: Start with a small project to validate the workflow
4. **Scale**: Expand to larger projects and more complex scenarios
5. **Automate**: Add automation rules to reduce manual overhead

## 📚 Additional Resources

- [Workflow Automation Guide](../integration-patterns/workflow-automation.md)
- [API Integration Examples](../integration-patterns/api-integration.md)
- [Team Collaboration Patterns](../integration-patterns/team-collaboration.md)
- [Custom Workflow Development](../integration-patterns/custom-workflows.md)

---

**🎉 Start building powerful workflows with these proven patterns!**

*Explore specific workflow examples in the individual files, or jump to [Integration Patterns](../integration-patterns/) for advanced customization.*