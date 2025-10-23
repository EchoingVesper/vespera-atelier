/**
 * Task Code Writer Specialist Agent Configuration Template
 * Embedded template for code writer specialist agent configuration
 */

export const TASK_CODE_WRITER_TEMPLATE = `{
  // Task Code Writer Specialist Template
  // Defines a specialist agent focused on writing and modifying code

  template_id: "task-code-writer",
  version: "1.0.0",
  name: "Code Writer Specialist Agent",
  description: "Specialist agent that writes, modifies, and refactors code",
  icon: "💻",
  color: "#3B82F6",

  // Inherits from base task template (if available)
  extends: "task", // Optional: inherit base task fields

  // Tags for organization and automation
  tags: ["agent", "code-writer", "specialist", "task"],

  // Template fields
  fields: {
    task_name: {
      type: "text",
      label: "Task Name",
      description: "Name of the coding task",
      required: true,
      default: "New Code Writing Task"
    },

    task_description: {
      type: "text",
      label: "Task Description",
      description: "Detailed description of the code to write or modify",
      required: true,
      default: ""
    },

    provider_ref: {
      type: "codex_reference",
      label: "LLM Provider",
      description: "LLM provider to use (prefer local models like Ollama for cost efficiency)",
      required: true,
      default: "codex://providers/ollama-llama70b",
      filter: {
        template_id: "llm-provider"
      }
    },

    system_prompt_ref: {
      type: "codex_reference",
      label: "System Prompt",
      description: "Code writer specialist system prompt",
      required: true,
      default: "codex://prompts/code-writer-specialist.md",
      filter: {
        content_type: "text/markdown",
        tags: ["system-prompt", "code-writer"]
      }
    },

    allowed_tools: {
      type: "list",
      label: "Allowed Tools",
      description: "Tools the code writer is allowed to use (full file operations)",
      required: true,
      default: [
        "read",
        "write",
        "edit",
        "search",
        "glob",
        "bash",
        "git_diff",
        "git_commit",
        "list_files"
      ],
      item_type: "text"
    },

    status: {
      type: "select",
      label: "Status",
      description: "Current status of the coding task",
      required: true,
      default: "pending",
      options: [
        { value: "pending", label: "Pending (Not started)" },
        { value: "in_progress", label: "In Progress (Writing code)" },
        { value: "testing", label: "Testing (Running tests)" },
        { value: "completed", label: "Completed (Code written and tested)" },
        { value: "failed", label: "Failed (Encountered error)" },
        { value: "cancelled", label: "Cancelled (Stopped by orchestrator)" }
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

    parent_task_ref: {
      type: "codex_reference",
      label: "Parent Task",
      description: "Reference to orchestrator task that spawned this specialist",
      required: false,
      default: "",
      filter: {
        template_id: "task-orchestrator"
      }
    },

    target_files: {
      type: "list",
      label: "Target Files",
      description: "List of files to create or modify",
      required: false,
      default: [],
      item_type: "text"
    },

    context_files: {
      type: "list",
      label: "Context Files",
      description: "Files to read for context (related code, tests, docs)",
      required: false,
      default: [],
      item_type: "text"
    },

    language: {
      type: "text",
      label: "Programming Language",
      description: "Primary programming language for this task",
      required: false,
      default: "typescript"
    },

    test_command: {
      type: "text",
      label: "Test Command",
      description: "Command to run tests after code changes",
      required: false,
      default: "npm test"
    },

    auto_test: {
      type: "boolean",
      label: "Auto-Run Tests",
      description: "Automatically run tests after writing code",
      required: false,
      default: true
    }
  },

  // Content sections
  content_sections: {
    implementation_plan: {
      type: "markdown",
      label: "Implementation Plan",
      description: "Agent's plan for implementing the code",
      required: false
    },

    code_changes: {
      type: "structured",
      label: "Code Changes",
      description: "Log of code modifications made by the agent",
      required: false,
      schema: {
        type: "array",
        items: {
          type: "object",
          properties: {
            timestamp: { type: "string", format: "date-time" },
            file_path: { type: "string" },
            action: { type: "string", enum: ["created", "modified", "deleted"] },
            lines_added: { type: "number" },
            lines_removed: { type: "number" },
            diff_summary: { type: "string" }
          }
        }
      }
    },

    test_results: {
      type: "structured",
      label: "Test Results",
      description: "Results from running tests",
      required: false,
      schema: {
        type: "object",
        properties: {
          passed: { type: "boolean" },
          total_tests: { type: "number" },
          passed_tests: { type: "number" },
          failed_tests: { type: "number" },
          error_output: { type: "string" }
        }
      }
    },

    results: {
      type: "markdown",
      label: "Task Results",
      description: "Summary of code changes and outcomes",
      required: false
    }
  },

  // Automation hooks
  hooks: {
    on_create: [
      {
        action: "initialize_code_writer",
        description: "Initialize code writer with task context and read relevant files"
      }
    ],

    on_update: [
      {
        trigger: "field_changed:status",
        condition: "status === 'in_progress'",
        action: "start_code_writing",
        description: "Begin writing code according to task description"
      },
      {
        trigger: "field_changed:status",
        condition: "status === 'testing' && auto_test === true",
        action: "run_tests",
        description: "Automatically run tests after code changes"
      },
      {
        trigger: "code_changes_made",
        condition: "auto_test === true",
        action: "run_tests",
        description: "Run tests after any code modification"
      }
    ],

    on_delete: [
      {
        action: "report_to_orchestrator",
        description: "Report final status to orchestrator before deletion"
      }
    ]
  },

  // UI rendering hints
  ui_hints: {
    form_layout: "vertical",
    show_preview: true,
    custom_renderer: "TaskCodeWriterRenderer",
    collapsible_sections: ["implementation_plan", "code_changes", "test_results"],
    show_file_diff: true,
    syntax_highlighting: true
  },

  // Resource limits
  resource_limits: {
    max_llm_calls: 50,
    max_tokens_per_call: 4096,
    max_files_modified: 20,
    timeout_minutes: 30
  }
}`;
