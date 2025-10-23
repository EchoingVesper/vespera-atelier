/**
 * Template and Prompt Exports
 * Central export point for all embedded templates and prompts
 */

// Import templates and prompts so we can use them in DEFAULT_TEMPLATES array
import { LLM_PROVIDER_TEMPLATE } from './providers/llm-provider.template';
import { AI_CHAT_TEMPLATE } from './chat/ai-chat.template';
import { TASK_ORCHESTRATOR_TEMPLATE } from './agents/task-orchestrator.template';
import { TASK_CODE_WRITER_TEMPLATE } from './agents/task-code-writer.template';
import { DEFAULT_ASSISTANT_PROMPT } from './prompts/default-assistant.prompt';
import { ORCHESTRATOR_AGENT_PROMPT } from './prompts/orchestrator-agent.prompt';
import { CODE_WRITER_SPECIALIST_PROMPT } from './prompts/code-writer-specialist.prompt';
import { DOCS_WRITER_SPECIALIST_PROMPT } from './prompts/docs-writer-specialist.prompt';

// Re-export for external consumers
export {
  LLM_PROVIDER_TEMPLATE,
  AI_CHAT_TEMPLATE,
  TASK_ORCHESTRATOR_TEMPLATE,
  TASK_CODE_WRITER_TEMPLATE,
  DEFAULT_ASSISTANT_PROMPT,
  ORCHESTRATOR_AGENT_PROMPT,
  CODE_WRITER_SPECIALIST_PROMPT,
  DOCS_WRITER_SPECIALIST_PROMPT
};

/**
 * Template definitions for workspace initialization
 */
export interface TemplateDefinition {
  filename: string;
  content: string;
  subdirectory: string; // Subdirectory within .vespera (e.g., 'templates/providers', 'prompts')
}

export const DEFAULT_TEMPLATES: TemplateDefinition[] = [
  // Provider templates
  {
    filename: 'llm-provider.json5',
    content: LLM_PROVIDER_TEMPLATE,
    subdirectory: 'templates/providers'
  },

  // Chat templates
  {
    filename: 'ai-chat.json5',
    content: AI_CHAT_TEMPLATE,
    subdirectory: 'templates/chat'
  },

  // Agent templates
  {
    filename: 'task-orchestrator.json5',
    content: TASK_ORCHESTRATOR_TEMPLATE,
    subdirectory: 'templates/agents'
  },
  {
    filename: 'task-code-writer.json5',
    content: TASK_CODE_WRITER_TEMPLATE,
    subdirectory: 'templates/agents'
  },

  // System prompts
  {
    filename: 'default-assistant.md',
    content: DEFAULT_ASSISTANT_PROMPT,
    subdirectory: 'prompts'
  },
  {
    filename: 'orchestrator-agent.md',
    content: ORCHESTRATOR_AGENT_PROMPT,
    subdirectory: 'prompts'
  },
  {
    filename: 'code-writer-specialist.md',
    content: CODE_WRITER_SPECIALIST_PROMPT,
    subdirectory: 'prompts'
  },
  {
    filename: 'docs-writer-specialist.md',
    content: DOCS_WRITER_SPECIALIST_PROMPT,
    subdirectory: 'prompts'
  }
];
