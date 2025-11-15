/**
 * Task Orchestrator Agent Configuration Template
 * Embedded template for orchestrator agent configuration
 */

export const TASK_ORCHESTRATOR_TEMPLATE = `{
  // Task Orchestrator Agent Template
  // Defines an orchestrator agent that delegates work to specialist agents

  template_id: "task-orchestrator",
  version: "1.0.0",
  name: "Task Orchestrator Agent",
  description: "Meta-agent that coordinates and delegates tasks to specialist agents",
  icon: "🎯",
  color: "#F59E0B",

  // Inherits from base task template (if available)
  extends: "task", // Optional: inherit base task fields

  // Tags for organization and automation
  tags: ["agent", "orchestrator", "meta", "task"],

  // Template fields
  fields: {
    task_name: {
      type: "text",
      label: "Task Name",
      description: "Name of the orchestration task",
      required: true,
      default: "New Orchestration Task"
    },

    task_description: {
      type: "text",
      label: "Task Description",
      description: "Detailed description of what needs to be accomplished",
      required: true,
      default: ""
    },

    provider_ref: {
      type: "codex_reference",
      label: "LLM Provider",
      description: "LLM provider to use (should be powerful model like Claude 4.5)",
      required: true,
      default: "codex://providers/claude-code-max",
      filter: {
        template_id: "llm-provider"
      }
    },

    system_prompt_ref: {
      type: "codex_reference",
      label: "System Prompt",
      description: "Orchestrator agent system prompt",
      required: true,
      default: "codex://prompts/orchestrator-agent.md",
      filter: {
        content_type: "text/markdown",
        tags: ["system-prompt", "orchestrator"]
      }
    },

    allowed_tools: {
      type: "list",
      label: "Allowed Tools",
      description: "Tools the orchestrator is allowed to use (limited set)",
      required: true,
      default: ["read", "search", "spawn_task", "list_tasks", "get_task_status"],
      item_type: "text"
    },

    status: {
      type: "select",
      label: "Status",
      description: "Current status of the orchestration task",
      required: true,
      default: "pending",
      options: [
        { value: "pending", label: "Pending (Not started)" },
        { value: "in_progress", label: "In Progress (Active)" },
        { value: "delegated", label: "Delegated (Waiting for subtasks)" },
        { value: "completed", label: "Completed (Finished successfully)" },
        { value: "failed", label: "Failed (Encountered error)" },
        { value: "cancelled", label: "Cancelled (Stopped by user)" }
      ]
    },

    priority: {
      type: "select",
      label: "Priority",
      description: "Task priority level",
      required: true,
      default: "normal",
      options: [
        { value: "low", label: "Low" },
        { value: "normal", label: "Normal" },
        { value: "high", label: "High" },
        { value: "urgent", label: "Urgent" }
      ]
    },

    spawned_subtasks: {
      type: "list",
      label: "Spawned Subtasks",
      description: "References to specialist tasks spawned by this orchestrator",
      required: false,
      default: [],
      item_type: "codex_reference",
      filter: {
        template_id: ["task-code-writer", "task-docs-writer", "task-orchestrator"]
      }
    },

    context_files: {
      type: "list",
      label: "Context Files",
      description: "Files or Codex references to include in context",
      required: false,
      default: [],
      item_type: "text"
    },

    max_delegation_depth: {
      type: "number",
      label: "Max Delegation Depth",
      description: "Maximum depth of task delegation (prevent infinite recursion)",
      required: false,
      default: 3,
      validation: {
        min: 1,
        max: 5
      }
    }
  },

  // Content sections
  content_sections: {
    reasoning: {
      type: "markdown",
      label: "Orchestrator Reasoning",
      description: "Orchestrator's analysis and delegation strategy",
      required: false
    },

    execution_log: {
      type: "structured",
      label: "Execution Log",
      description: "Log of orchestrator actions and decisions",
      required: false,
      schema: {
        type: "array",
        items: {
          type: "object",
          properties: {
            timestamp: { type: "string", format: "date-time" },
            action: { type: "string" },
            details: { type: "string" },
            subtask_refs: { type: "array", items: { type: "string" } }
          }
        }
      }
    },

    results: {
      type: "markdown",
      label: "Task Results",
      description: "Final results and summary of completed task",
      required: false
    }
  },

  // Automation hooks
  hooks: {
    on_create: [
      {
        action: "initialize_orchestrator",
        description: "Initialize orchestrator agent with task context"
      }
    ],

    on_update: [
      {
        trigger: "field_changed:status",
        condition: "status === 'in_progress'",
        action: "start_orchestration",
        description: "Begin orchestrating task and spawning subtasks"
      },
      {
        trigger: "subtask_completed",
        action: "aggregate_results",
        description: "Aggregate results from completed subtasks"
      }
    ],

    on_delete: [
      {
        action: "cancel_subtasks",
        description: "Cancel all spawned subtasks before deletion"
      }
    ]
  },

  // UI rendering hints
  ui_hints: {
    form_layout: "vertical",
    show_preview: true,
    custom_renderer: "TaskOrchestratorRenderer",
    collapsible_sections: ["execution_log", "results"],
    show_subtask_tree: true
  },

  // Resource limits (prevent runaway costs)
  resource_limits: {
    max_llm_calls: 100,
    max_tokens_per_call: 8192,
    max_subtasks: 10,
    timeout_minutes: 60
  }
}`;
