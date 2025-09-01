# Template Hook Agent and Timed Agent Examples

This document provides comprehensive examples of how to define hook agents and timed agents within templates using the new Template-Driven Hook Agent System.

## Hook Agent Template Examples

### Example 1: Implementation Template with GitHub Worktree Setup

```json5
// implementation_task.json5
{
  "template_id": "implementation_task_v1",
  "name": "Implementation Task with Pre/Post Hooks",
  "description": "Software implementation task with automated GitHub worktree management",
  "extends": "base_task_v1",
  
  "field_schema": {
    "implementation_type": {
      "type": "select",
      "options": ["feature", "bugfix", "refactor", "enhancement"],
      "required": true
    },
    "github_repo": {
      "type": "string",
      "display_name": "GitHub Repository",
      "placeholder": "owner/repository-name"
    },
    "branch_name": {
      "type": "string",
      "display_name": "Feature Branch Name",
      "placeholder": "feature/new-feature-name"
    },
    "estimated_complexity": {
      "type": "select",
      "options": ["simple", "moderate", "complex", "epic"]
    }
  },
  
  "automation_rules": [
    {
      "name": "pre_implementation_setup",
      "trigger": "pre_task_execution",
      "condition": "task_status == 'in_progress' AND github_repo != null",
      "action": "spawn_hook_agent",
      "hook_agent": {
        "name": "GitHub Worktree Setup Agent",
        "spawn_mode": "hybrid",
        "priority": 2,
        "max_execution_time": 300,
        "allowed_operations": [
          "git_operations",
          "file_system_operations",
          "github_api_calls"
        ],
        "file_patterns": [
          ".git/**",
          "src/**",
          "docs/**"
        ],
        "trigger_conditions": [
          "github_repo_accessible",
          "branch_name_valid"
        ]
      },
      "params": {
        "hook_instructions": [
          {
            "step": "validate_github_access",
            "action": "check_repository_access",
            "repository": "{{github_repo}}",
            "required_permissions": ["read", "write"]
          },
          {
            "step": "create_worktree",
            "action": "git_worktree_add",
            "branch_name": "{{branch_name}}",
            "base_branch": "main",
            "worktree_path": "./worktrees/{{branch_name}}"
          },
          {
            "step": "setup_development_environment",
            "action": "run_setup_scripts",
            "working_directory": "./worktrees/{{branch_name}}",
            "scripts": ["npm install", "pip install -r requirements.txt"]
          },
          {
            "step": "create_initial_commit",
            "action": "git_commit",
            "message": "feat: initialize {{implementation_type}} implementation for {{task_title}}",
            "allow_empty": true
          }
        ]
      }
    },
    {
      "name": "post_implementation_cleanup",
      "trigger": "post_task_completion",
      "condition": "task_status == 'completed' AND github_repo != null",
      "action": "spawn_hook_agent",
      "hook_agent": {
        "name": "Documentation Update Agent",
        "spawn_mode": "llm_driven",
        "priority": 1,
        "max_execution_time": 600,
        "allowed_operations": [
          "file_read_write",
          "documentation_generation",
          "git_operations"
        ],
        "file_patterns": [
          "docs/**",
          "README.md",
          "CHANGELOG.md",
          "src/**/*.md"
        ]
      },
      "params": {
        "hook_instructions": [
          {
            "step": "analyze_implementation_changes",
            "action": "analyze_git_diff",
            "branch": "{{branch_name}}",
            "base_branch": "main",
            "focus": ["new_features", "api_changes", "breaking_changes"]
          },
          {
            "step": "update_documentation",
            "action": "llm_documentation_update",
            "files_to_update": ["docs/API.md", "README.md"],
            "update_strategy": "intelligent_merge",
            "preserve_user_content": true
          },
          {
            "step": "generate_changelog_entry",
            "action": "llm_changelog_generation",
            "file": "CHANGELOG.md",
            "entry_type": "{{implementation_type}}",
            "description": "{{task_description}}"
          },
          {
            "step": "create_documentation_pr",
            "action": "github_create_pull_request",
            "title": "docs: update documentation for {{task_title}}",
            "body": "Automated documentation update following completion of {{implementation_type}} task.",
            "base_branch": "main",
            "head_branch": "docs/update-{{branch_name}}"
          }
        ]
      }
    },
    {
      "name": "failure_recovery_hook",
      "trigger": "post_task_failure",
      "condition": "task_status == 'failed' AND github_repo != null",
      "action": "spawn_hook_agent",
      "hook_agent": {
        "name": "Failure Analysis Agent",
        "spawn_mode": "hybrid",
        "priority": 3,
        "max_execution_time": 300,
        "allowed_operations": [
          "log_analysis",
          "git_operations",
          "notification_services"
        ]
      },
      "params": {
        "hook_instructions": [
          {
            "step": "collect_failure_information",
            "action": "gather_error_context",
            "sources": ["task_logs", "git_status", "build_outputs"]
          },
          {
            "step": "analyze_failure_cause",
            "action": "llm_failure_analysis",
            "context": "{{failure_information}}",
            "focus": ["root_cause", "potential_fixes", "prevention_strategies"]
          },
          {
            "step": "create_recovery_task",
            "action": "create_template_instance",
            "template_type": "recovery_task_v1",
            "instance_data": {
              "failed_task_id": "{{task_id}}",
              "failure_analysis": "{{failure_analysis}}",
              "priority": "high",
              "assigned_to": "{{task_assignee}}"
            }
          }
        ]
      }
    }
  ]
}
```

### Example 2: Fantasy Scene Template with Music Integration

```json5
// fantasy_scene_with_hooks.json5
{
  "template_id": "fantasy_scene_with_hooks_v1",
  "name": "Fantasy Scene with Immersive Hooks",
  "description": "Scene template with automated music and environment management",
  "extends": "base_scene_v1",
  
  "field_schema": {
    "scene_mood": {
      "type": "select",
      "options": ["peaceful", "tense", "mysterious", "epic", "melancholy", "joyful"]
    },
    "time_of_day": {
      "type": "select", 
      "options": ["dawn", "morning", "midday", "afternoon", "dusk", "night", "midnight"]
    },
    "weather": {
      "type": "select",
      "options": ["clear", "cloudy", "rainy", "stormy", "foggy", "snowy"]
    },
    "characters_present": {
      "type": "array",
      "subtype": "codex_reference",
      "filter": {"template_id": ["fantasy_character_v1"]}
    }
  },
  
  "automation_rules": [
    {
      "name": "mood_environment_synchronization",
      "trigger": "template_field_change",
      "field": "scene_mood",
      "action": "spawn_hook_agent",
      "hook_agent": {
        "name": "Immersive Environment Controller",
        "spawn_mode": "hybrid",
        "priority": 1,
        "max_execution_time": 180,
        "allowed_operations": [
          "audio_control",
          "lighting_control",
          "ui_theming",
          "template_updates"
        ]
      },
      "params": {
        "hook_instructions": [
          {
            "step": "analyze_mood_transition",
            "action": "llm_mood_analysis",
            "old_mood": "{{old_value}}",
            "new_mood": "{{new_value}}",
            "scene_context": "{{scene_description}}",
            "character_context": "{{characters_present}}"
          },
          {
            "step": "update_ambient_music",
            "action": "update_linked_templates",
            "target_template_type": "ambient_music_v1",
            "link_field": "scene_music",
            "field_mapping": {
              "peaceful": {
                "track_type": "nature_sounds",
                "intensity": "low",
                "transition_style": "gentle_fade"
              },
              "tense": {
                "track_type": "dramatic_tension",
                "intensity": "high", 
                "transition_style": "immediate_cut"
              },
              "mysterious": {
                "track_type": "ambient_mystery",
                "intensity": "medium",
                "transition_style": "gradual_fade"
              }
            }
          },
          {
            "step": "adapt_lighting",
            "action": "environmental_lighting_control",
            "lighting_profiles": {
              "peaceful": {"color": "#F7FAFC", "brightness": 80, "warmth": 70},
              "tense": {"color": "#4A5568", "brightness": 40, "warmth": 20},
              "mysterious": {"color": "#2D3748", "brightness": 30, "warmth": 30}
            },
            "transition_duration": "3s"
          },
          {
            "step": "update_character_states",
            "action": "llm_character_mood_sync",
            "characters": "{{characters_present}}",
            "new_scene_mood": "{{new_value}}",
            "update_fields": ["emotional_state", "current_mood", "scene_reactions"]
          }
        ]
      }
    },
    {
      "name": "scene_completion_workflow",
      "trigger": "template_field_change",
      "field": "scene_status",
      "condition": "new_value == 'complete'",
      "action": "spawn_hook_agent",
      "hook_agent": {
        "name": "Scene Completion Agent",
        "spawn_mode": "llm_driven",
        "priority": 2,
        "max_execution_time": 300,
        "allowed_operations": [
          "template_creation",
          "relationship_analysis",
          "story_progression",
          "character_development"
        ]
      },
      "params": {
        "hook_instructions": [
          {
            "step": "analyze_scene_impact",
            "action": "llm_scene_analysis",
            "scene_content": "{{scene_description}}",
            "character_interactions": "{{characters_present}}",
            "mood_progression": "{{mood_change_history}}",
            "focus": ["character_development", "plot_advancement", "relationship_changes"]
          },
          {
            "step": "update_character_arcs",
            "action": "update_linked_templates",
            "target_template_type": "fantasy_character_v1",
            "selection_criteria": {"codex_id": "{{characters_present}}"},
            "updates": {
              "scenes_participated": "{{append(current_scene_id)}}",
              "character_development_notes": "{{scene_impact_analysis.character_development}}",
              "relationship_updates": "{{scene_impact_analysis.relationship_changes}}"
            }
          },
          {
            "step": "generate_follow_up_scenes",
            "action": "llm_scene_generation",
            "context": "{{scene_impact_analysis}}",
            "generation_params": {
              "scene_count": "1-3",
              "scene_types": ["character_development", "plot_progression", "relationship_resolution"],
              "maintain_consistency": true,
              "character_continuity": true
            }
          },
          {
            "step": "create_scene_reflection_notes",
            "action": "create_template_instance",
            "template_type": "scene_notes_v1",
            "instance_data": {
              "source_scene": "{{codex_id}}",
              "completion_analysis": "{{scene_impact_analysis}}",
              "generated_follow_ups": "{{generated_scenes}}",
              "mood_journey": "{{mood_change_history}}"
            }
          }
        ]
      }
    }
  ]
}
```

## Timed Agent Template Examples

### Example 1: Daily Standup Reminder Agent

```json5
// daily_standup_template.json5
{
  "template_id": "daily_standup_v1",
  "name": "Daily Standup with Automated Reminders",
  "description": "Team standup template with intelligent reminder system",
  
  "field_schema": {
    "team_members": {
      "type": "array",
      "subtype": "string",
      "display_name": "Team Members",
      "required": true
    },
    "standup_time": {
      "type": "string",
      "display_name": "Daily Standup Time",
      "placeholder": "09:00",
      "pattern": "^([01]?[0-9]|2[0-3]):[0-5][0-9]$"
    },
    "timezone": {
      "type": "string",
      "display_name": "Team Timezone",
      "default": "UTC"
    },
    "project_phase": {
      "type": "select",
      "options": ["planning", "development", "testing", "deployment", "maintenance"]
    }
  },
  
  "automation_rules": [
    {
      "name": "daily_standup_preparation",
      "trigger": "timed_schedule",
      "action": "spawn_timed_agent",
      "timed_agent": {
        "name": "Standup Preparation Agent",
        "spawn_mode": "hybrid",
        "priority": 1,
        "max_execution_time": 300,
        "allowed_operations": [
          "task_analysis",
          "progress_tracking",
          "notification_services",
          "document_generation"
        ],
        "schedule": {
          "type": "cron",
          "expression": "0 {{subtract(standup_time, '30m')}} * * 1-5",
          "timezone": "{{timezone}}",
          "description": "30 minutes before daily standup, weekdays only"
        }
      },
      "params": {
        "agent_instructions": [
          {
            "step": "analyze_team_progress",
            "action": "task_progress_analysis",
            "team_members": "{{team_members}}",
            "project_phase": "{{project_phase}}",
            "time_period": "since_last_standup",
            "metrics": ["completed_tasks", "blocked_tasks", "overdue_items", "new_issues"]
          },
          {
            "step": "generate_standup_agenda",
            "action": "llm_agenda_generation",
            "progress_data": "{{team_progress_analysis}}",
            "template_structure": {
              "yesterdays_accomplishments": "{{completed_tasks}}",
              "todays_priorities": "{{planned_tasks}}",
              "blockers_and_issues": "{{blocked_tasks}}",
              "team_announcements": "{{generated_announcements}}"
            }
          },
          {
            "step": "create_preparation_notifications",
            "action": "send_team_notifications",
            "recipients": "{{team_members}}",
            "notification_type": "standup_preparation",
            "message_template": "Daily standup in 30 minutes! Today's focus: {{todays_priorities}}. Blockers to discuss: {{blockers_count}}",
            "include_agenda": true
          },
          {
            "step": "update_standup_document",
            "action": "create_template_instance",
            "template_type": "standup_notes_v1",
            "instance_data": {
              "date": "{{current_date}}",
              "agenda": "{{generated_agenda}}",
              "team_metrics": "{{team_progress_analysis}}",
              "pre_populated": true
            }
          }
        ]
      }
    },
    {
      "name": "weekly_retrospective_trigger",
      "trigger": "timed_schedule", 
      "action": "spawn_timed_agent",
      "timed_agent": {
        "name": "Weekly Retrospective Agent",
        "spawn_mode": "llm_driven",
        "priority": 2,
        "max_execution_time": 600,
        "schedule": {
          "type": "cron",
          "expression": "0 16 * * 5",
          "timezone": "{{timezone}}",
          "description": "Friday 4 PM - end of week retrospective"
        }
      },
      "params": {
        "agent_instructions": [
          {
            "step": "collect_week_data",
            "action": "weekly_metrics_collection",
            "data_sources": ["standup_notes", "task_completions", "team_feedback"],
            "metrics": ["velocity", "quality", "team_satisfaction", "blocker_resolution_time"]
          },
          {
            "step": "analyze_team_performance", 
            "action": "llm_performance_analysis",
            "week_data": "{{collected_metrics}}",
            "analysis_focus": ["productivity_trends", "recurring_issues", "improvement_opportunities", "team_dynamics"]
          },
          {
            "step": "generate_retrospective_agenda",
            "action": "llm_retrospective_planning",
            "performance_analysis": "{{team_performance_analysis}}",
            "agenda_sections": ["what_went_well", "what_could_improve", "action_items", "team_appreciation"]
          },
          {
            "step": "create_retrospective_task",
            "action": "create_template_instance", 
            "template_type": "team_retrospective_v1",
            "instance_data": {
              "week_ending": "{{current_date}}",
              "agenda": "{{retrospective_agenda}}",
              "metrics_summary": "{{team_performance_analysis}}",
              "team_members": "{{team_members}}"
            }
          }
        ]
      }
    }
  ]
}
```

### Example 2: Character Development Tracking Agent

```json5
// character_development_monitor.json5
{
  "template_id": "character_dev_monitor_v1", 
  "name": "Character Development Monitor",
  "description": "Automated character consistency and development tracking",
  
  "field_schema": {
    "monitored_characters": {
      "type": "array",
      "subtype": "codex_reference",
      "filter": {"template_id": ["fantasy_character_v1"]},
      "display_name": "Characters to Monitor"
    },
    "development_goals": {
      "type": "array",
      "subtype": "object",
      "fields": {
        "character_id": {"type": "codex_reference", "filter": {"template_id": ["fantasy_character_v1"]}},
        "goal_description": {"type": "text"},
        "target_deadline": {"type": "date"},
        "progress_milestones": {"type": "array", "subtype": "string"}
      }
    },
    "consistency_check_frequency": {
      "type": "select",
      "options": ["daily", "weekly", "bi_weekly"],
      "default": "weekly"
    }
  },
  
  "automation_rules": [
    {
      "name": "character_consistency_check",
      "trigger": "timed_interval",
      "action": "spawn_timed_agent",
      "timed_agent": {
        "name": "Character Consistency Agent",
        "spawn_mode": "llm_driven",
        "priority": 1,
        "max_execution_time": 900,
        "allowed_operations": [
          "character_analysis",
          "consistency_checking", 
          "narrative_analysis",
          "report_generation"
        ],
        "schedule": {
          "type": "interval",
          "interval_seconds": "{{consistency_frequency_to_seconds(consistency_check_frequency)}}",
          "description": "Regular character consistency analysis"
        }
      },
      "params": {
        "agent_instructions": [
          {
            "step": "collect_character_appearances",
            "action": "character_scene_analysis",
            "characters": "{{monitored_characters}}",
            "time_period": "since_last_check",
            "data_points": ["dialogue", "actions", "personality_traits", "relationships", "character_growth"]
          },
          {
            "step": "analyze_character_consistency",
            "action": "llm_consistency_analysis", 
            "character_data": "{{character_appearances}}",
            "consistency_criteria": [
              "personality_stability",
              "speech_patterns",
              "behavioral_consistency", 
              "relationship_continuity",
              "character_arc_progression"
            ]
          },
          {
            "step": "identify_development_progress",
            "action": "llm_development_tracking",
            "characters": "{{monitored_characters}}",
            "development_goals": "{{development_goals}}",
            "progress_assessment": "{{character_appearances}}",
            "focus": ["goal_achievement", "unexpected_development", "stalled_progress"]
          },
          {
            "step": "generate_inconsistency_reports",
            "action": "llm_report_generation",
            "consistency_analysis": "{{character_consistency_analysis}}",
            "development_progress": "{{character_development_progress}}",
            "report_sections": ["consistency_issues", "development_recommendations", "character_arc_suggestions"]
          },
          {
            "step": "create_development_tasks",
            "action": "conditional_task_creation",
            "conditions": [
              {"if": "consistency_issues.length > 0", "create": "character_revision_task"},
              {"if": "stalled_development.length > 0", "create": "character_development_task"},
              {"if": "arc_completion_detected", "create": "character_arc_conclusion_task"}
            ],
            "task_template_mapping": {
              "character_revision_task": "character_revision_v1",
              "character_development_task": "character_development_v1", 
              "character_arc_conclusion_task": "story_conclusion_v1"
            }
          },
          {
            "step": "update_character_profiles",
            "action": "update_linked_templates",
            "target_template_type": "fantasy_character_v1",
            "selection_criteria": {"codex_id": "{{monitored_characters}}"},
            "updates": {
              "last_consistency_check": "{{current_datetime}}",
              "consistency_score": "{{consistency_analysis.score}}",
              "development_status": "{{development_progress.status}}",
              "analysis_notes": "{{generated_reports.character_notes}}"
            }
          }
        ]
      }
    },
    {
      "name": "monthly_character_review",
      "trigger": "timed_schedule",
      "action": "spawn_timed_agent", 
      "timed_agent": {
        "name": "Monthly Character Review Agent",
        "spawn_mode": "hybrid",
        "priority": 2,
        "max_execution_time": 1200,
        "schedule": {
          "type": "cron",
          "expression": "0 10 1 * *",
          "description": "First day of each month at 10 AM"
        }
      },
      "params": {
        "agent_instructions": [
          {
            "step": "compile_monthly_character_data",
            "action": "comprehensive_character_analysis",
            "characters": "{{monitored_characters}}",
            "time_period": "last_month", 
            "analysis_depth": "comprehensive",
            "include_metrics": ["scene_appearances", "dialogue_count", "relationship_changes", "arc_progression"]
          },
          {
            "step": "generate_character_evolution_report",
            "action": "llm_evolution_analysis",
            "monthly_data": "{{character_monthly_data}}",
            "report_focus": ["character_growth", "relationship_dynamics", "story_impact", "reader_engagement"]
          },
          {
            "step": "create_development_recommendations",
            "action": "llm_recommendation_engine",
            "evolution_report": "{{character_evolution_analysis}}",
            "development_goals": "{{development_goals}}",
            "recommendation_types": ["character_scenes", "relationship_development", "arc_milestones", "conflict_opportunities"]
          },
          {
            "step": "schedule_recommended_activities",
            "action": "create_template_instances",
            "recommendations": "{{development_recommendations}}",
            "template_mapping": {
              "character_scenes": "scene_planning_v1",
              "relationship_development": "relationship_scene_v1", 
              "arc_milestones": "character_milestone_v1",
              "conflict_opportunities": "conflict_scene_v1"
            },
            "auto_schedule": true,
            "priority": "normal"
          }
        ]
      }
    }
  ]
}
```

## Template Hook Integration Patterns

### Pattern 1: Implementation Workflow with Full Lifecycle Hooks

```json5
{
  "template_id": "full_lifecycle_implementation_v1",
  "automation_rules": [
    // Pre-execution setup
    {
      "name": "pre_implementation_environment_setup",
      "trigger": "pre_task_execution",
      "hook_agent": {
        "name": "Environment Setup Agent",
        "spawn_mode": "programmatic",
        "allowed_operations": ["git_operations", "environment_setup", "dependency_management"]
      }
    },
    
    // Mid-execution monitoring
    {
      "name": "implementation_progress_monitor", 
      "trigger": "timed_interval",
      "timed_agent": {
        "schedule": {"type": "interval", "interval_seconds": 1800},
        "name": "Progress Monitor Agent",
        "spawn_mode": "hybrid"
      }
    },
    
    // Post-completion integration
    {
      "name": "post_implementation_integration",
      "trigger": "post_task_completion",
      "hook_agent": {
        "name": "Integration Agent",
        "spawn_mode": "llm_driven",
        "allowed_operations": ["testing", "documentation", "deployment"]
      }
    },
    
    // Failure recovery
    {
      "name": "failure_recovery_workflow",
      "trigger": "post_task_failure", 
      "hook_agent": {
        "name": "Recovery Agent",
        "spawn_mode": "hybrid",
        "allowed_operations": ["diagnostics", "rollback", "issue_creation"]
      }
    }
  ]
}
```

### Pattern 2: Cross-Template Automation Chain

```json5
{
  "template_id": "story_chapter_v1",
  "automation_rules": [
    {
      "name": "chapter_completion_cascade",
      "trigger": "template_field_change",
      "field": "chapter_status", 
      "condition": "new_value == 'complete'",
      "hook_agent": {
        "name": "Chapter Completion Cascade Agent",
        "spawn_mode": "llm_driven",
        "context_filters": {
          "linked_characters": "any",
          "story_arc": "active"
        }
      },
      "params": {
        "cross_template_actions": [
          {
            "target_template": "fantasy_character_v1",
            "action": "update_character_progression",
            "selection": "characters_in_chapter"
          },
          {
            "target_template": "story_arc_v1", 
            "action": "advance_arc_progress",
            "selection": "current_story_arc"
          },
          {
            "target_template": "next_chapter_v1",
            "action": "create_next_chapter_outline",
            "generation_mode": "llm_assisted"
          }
        ]
      }
    }
  ]
}
```

## Best Practices for Template Hook Agents

### 1. Agent Capability Restrictions

Always define specific capabilities for security:

```json5
{
  "hook_agent": {
    "allowed_operations": [
      "file_read_write",
      "git_operations", 
      "template_updates"
    ],
    "file_patterns": [
      "src/**/*.js",
      "docs/**/*.md",
      "tests/**/*.test.js"
    ]
  }
}
```

### 2. Context Inheritance Configuration

Enable rich context passing from templates:

```json5
{
  "hook_agent": {
    "context_inheritance": {
      "include_template_data": true,
      "include_linked_templates": true,
      "include_user_patterns": true,
      "include_environmental_state": true,
      "execution_chain_tracking": true
    }
  }
}
```

### 3. Error Handling and Recovery

Define recovery strategies for agent failures:

```json5
{
  "hook_agent": {
    "error_handling": {
      "max_retries": 2,
      "retry_delay_seconds": 30,
      "fallback_mode": "programmatic",
      "failure_notification": true,
      "create_recovery_task": true
    }
  }
}
```

### 4. Performance and Resource Management

Set appropriate limits:

```json5
{
  "hook_agent": {
    "performance_limits": {
      "max_execution_time": 300,
      "memory_limit_mb": 512,
      "cpu_priority": "normal",
      "concurrent_limit": 3
    }
  }
}
```

## Advanced Hook Agent Features

### LLM-Enhanced Hook Execution

```json5
{
  "hook_agent": {
    "spawn_mode": "llm_driven",
    "llm_configuration": {
      "model_preference": "claude-3-haiku",
      "context_analysis": true,
      "creative_enhancement": true,
      "constraint_validation": true,
      "reasoning_transparency": true
    }
  }
}
```

### Environmental System Integration

```json5
{
  "hook_agent": {
    "environmental_integration": {
      "music_control": true,
      "lighting_adaptation": true, 
      "ui_theme_switching": true,
      "immersive_feedback": true
    }
  }
}
```

This comprehensive example system demonstrates how users can define sophisticated hook agents and timed agents entirely through template JSON5 files, enabling unprecedented workflow automation and customization without requiring system code changes.