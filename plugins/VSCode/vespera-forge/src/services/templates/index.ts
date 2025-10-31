/**
 * Template and Prompt Exports
 * Central export point for all embedded templates and prompts
 */

// Import templates and prompts so we can use them in DEFAULT_TEMPLATES array
import { LLM_PROVIDER_TEMPLATE } from './providers/llm-provider.template';
import { CLAUDE_CODE_CLI_PROVIDER_TEMPLATE } from './providers/claude-code-cli.template';
import { OLLAMA_PROVIDER_TEMPLATE } from './providers/ollama.template';
import { AI_CHAT_TEMPLATE } from './chat/ai-chat.template';
import { TASK_ORCHESTRATOR_TEMPLATE } from './agents/task-orchestrator.template';
import { TASK_CODE_WRITER_TEMPLATE } from './agents/task-code-writer.template';
import { DEFAULT_ASSISTANT_PROMPT } from './prompts/default-assistant.prompt';
import { ORCHESTRATOR_AGENT_PROMPT } from './prompts/orchestrator-agent.prompt';
import { CODE_WRITER_SPECIALIST_PROMPT } from './prompts/code-writer-specialist.prompt';
import { DOCS_WRITER_SPECIALIST_PROMPT } from './prompts/docs-writer-specialist.prompt';

// Codex content templates
import { NOTE_TEMPLATE } from './codex/note.template';
import { SCENE_TEMPLATE } from './codex/scene.template';
import { CHARACTER_TEMPLATE } from './codex/character.template';
import { LOCATION_TEMPLATE } from './codex/location.template';
import { TASK_TEMPLATE } from './codex/task.template';

// Re-export for external consumers
export {
  LLM_PROVIDER_TEMPLATE,
  CLAUDE_CODE_CLI_PROVIDER_TEMPLATE,
  OLLAMA_PROVIDER_TEMPLATE,
  AI_CHAT_TEMPLATE,
  TASK_ORCHESTRATOR_TEMPLATE,
  TASK_CODE_WRITER_TEMPLATE,
  DEFAULT_ASSISTANT_PROMPT,
  ORCHESTRATOR_AGENT_PROMPT,
  CODE_WRITER_SPECIALIST_PROMPT,
  DOCS_WRITER_SPECIALIST_PROMPT,
  NOTE_TEMPLATE,
  SCENE_TEMPLATE,
  CHARACTER_TEMPLATE,
  LOCATION_TEMPLATE,
  TASK_TEMPLATE
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
  // Codex content templates
  {
    filename: 'note.json5',
    content: NOTE_TEMPLATE,
    subdirectory: 'templates/codex'
  },
  {
    filename: 'scene.json5',
    content: SCENE_TEMPLATE,
    subdirectory: 'templates/codex'
  },
  {
    filename: 'character.json5',
    content: CHARACTER_TEMPLATE,
    subdirectory: 'templates/codex'
  },
  {
    filename: 'location.json5',
    content: LOCATION_TEMPLATE,
    subdirectory: 'templates/codex'
  },
  {
    filename: 'task.json5',
    content: TASK_TEMPLATE,
    subdirectory: 'templates/codex'
  },

  // Provider templates
  {
    filename: 'llm-provider.json5',
    content: LLM_PROVIDER_TEMPLATE,
    subdirectory: 'templates/providers'
  },
  {
    filename: 'claude-code-cli.json5',
    content: CLAUDE_CODE_CLI_PROVIDER_TEMPLATE,
    subdirectory: 'templates/providers'
  },
  {
    filename: 'ollama.json5',
    content: OLLAMA_PROVIDER_TEMPLATE,
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
