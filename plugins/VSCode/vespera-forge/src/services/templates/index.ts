/**
 * Template and Prompt Exports
 * Central export point for all embedded templates and prompts
 */

// Provider templates
export { LLM_PROVIDER_TEMPLATE } from './providers/llm-provider.template';

// Chat templates
export { AI_CHAT_TEMPLATE } from './chat/ai-chat.template';

// Agent templates
export { TASK_ORCHESTRATOR_TEMPLATE } from './agents/task-orchestrator.template';
export { TASK_CODE_WRITER_TEMPLATE } from './agents/task-code-writer.template';

// Prompt templates
export { DEFAULT_ASSISTANT_PROMPT } from './prompts/default-assistant.prompt';
export { ORCHESTRATOR_AGENT_PROMPT } from './prompts/orchestrator-agent.prompt';
export { CODE_WRITER_SPECIALIST_PROMPT } from './prompts/code-writer-specialist.prompt';
export { DOCS_WRITER_SPECIALIST_PROMPT } from './prompts/docs-writer-specialist.prompt';

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
