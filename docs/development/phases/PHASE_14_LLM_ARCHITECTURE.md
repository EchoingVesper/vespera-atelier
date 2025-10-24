# Phase 14: LLM Provider Architecture for Codex-Based AI Chat

**Date**: 2025-10-22
**Status**: 🚧 IN PROGRESS - Phase 14a Complete ✅
**Branch**: `feat/codex-ui-framework`

## Progress Summary

- ✅ **Phase 14a Complete**: Rust LLM provider module fully implemented and compiling
  - Claude Code CLI provider (uses Claude Max subscription)
  - Ollama provider (local LLMs, cost-free)
  - Secret vault system for API keys
  - Codex integration via `ProviderType::from_codex()`
- 🔄 **Phase 14b Next**: Create Codex templates and system prompt files
- ⏳ **Phase 14c Pending**: Extension cleanup and Channel List UI
- ⏳ **Phase 14d Pending**: Testing and documentation

---

## Architecture Vision

The AI Assistant becomes a **Codex editor in chat mode**, where:
- **Chat sessions are Codices** (type: `ai-chat`)
- **Provider configs are Codices** (type: `llm-provider`)
- **Task Codices reference provider Codices** for agent spawning
- **Everything is template-driven** - no hardcoded types
- **Codexes are generic containers** - creating data trails for undo/redo, database storage, embeddings, and graph relationships

### Multi-Agent Orchestration

```
Task Codex: "Orchestrator"
├── template_id: "task-orchestrator"
├── provider_ref: "codex://providers/claude-4.5-sonnet"
├── available_tools: ["read", "search", "spawn_task"]
├── system_prompt: "codex://prompts/task-orchestrator-specialist.md"
└── spawns ↓

    Task Codex: "Code Writer"
    ├── template_id: "task-code-writer"
    ├── provider_ref: "codex://providers/local-llama3-70b"
    ├── available_tools: ["read", "write", "edit", "bash"]
    ├── system_prompt_ref: "codex://prompts/code-writer-specialist.md"
    └── tags: ["agent", "code-writer", "automated"]

    Task Codex: "Documentation Writer"
    ├── template_id: "task-docs-writer"
    ├── provider_ref: "codex://providers/local-llama3-8b"
    ├── available_tools: ["read", "write"]
    ├── system_prompt_ref: "codex://prompts/docs-writer-specialist.md"
    └── tags: ["agent", "docs-writer", "automated"]
```

**Key Benefits:**
- **Cost optimization**: Expensive models (Claude 4.5) for orchestration, cheap/local models for specialized tasks
- **Tool isolation**: Each task type has specific tool access (security)
- **Template-driven**: Users define task types, providers, and tool permissions via JSON5 templates
- **Codex references**: `provider_ref` and `system_prompt_ref` link to other Codices, allowing runtime config updates
- **System prompts as files**: Verbose .md files linked via Codex references, not inline strings
- **Tags for organization**: Agents tagged for filtering, searching, and automation rules

---

## System Architecture

### 1. Bindery Rust Backend (New Module)

**Add**: `packages/vespera-utilities/vespera-bindery/src/llm/`

```rust
// src/llm/mod.rs
pub mod provider;
pub mod streaming;
pub mod types;

pub use provider::{LlmProvider, ProviderType};
pub use streaming::StreamingResponse;
pub use types::{ChatMessage, ChatRequest, ChatResponse, ToolCall};
```

**Provider Interface** (`src/llm/provider.rs`):
```rust
#[async_trait]
pub trait LlmProvider {
    /// Send a chat message and get streaming response
    async fn send_message(&self, request: ChatRequest) -> Result<StreamingResponse>;

    /// Get provider capabilities (max tokens, supports tools, etc.)
    fn capabilities(&self) -> ProviderCapabilities;

    /// Validate provider configuration
    async fn validate_config(&self) -> Result<()>;
}

/// Supported provider types
pub enum ProviderType {
    /// Claude Code CLI - uses Claude Max subscription (PRIORITY)
    /// Spawns `claude` CLI process, requires authentication via `claude login`
    ClaudeCode {
        model: String,  // "claude-sonnet-4.5-20250929"
        cli_path: Option<String>,  // Path to `claude` binary
        max_turns: u32,
        custom_system_prompt: Option<String>,
        allowed_tools: Vec<String>,
    },
    /// Direct Anthropic REST API - uses API key (SECONDARY)
    Anthropic {
        api_key: String,
        model: String,  // "claude-sonnet-4.5-20250929"
        base_url: Option<String>,
    },
    /// OpenAI REST API - uses API key (SECONDARY)
    OpenAI {
        api_key: String,
        model: String,  // "gpt-4-turbo-preview"
        base_url: Option<String>,
    },
    /// Ollama local LLM server (PRIORITY for cost-effective tasks)
    Ollama {
        endpoint: String,  // "http://localhost:11434/v1"
        model: String,     // "llama3:70b"
    },
}

impl ProviderType {
    /// Create provider from Codex template
    pub async fn from_codex(codex: &Codex) -> Result<Self> {
        // Parse Codex metadata to extract provider config
        // e.g., codex.metadata["provider_type"] = "anthropic"
        // e.g., codex.metadata["api_key_ref"] = "vault://anthropic/key"
        todo!()
    }
}
```

**Streaming Support** (`src/llm/streaming.rs`):
```rust
pub struct StreamingResponse {
    pub stream: Pin<Box<dyn Stream<Item = Result<ChatChunk>> + Send>>,
    pub metadata: ResponseMetadata,
}

pub struct ChatChunk {
    pub delta: String,
    pub finish_reason: Option<FinishReason>,
    pub tool_calls: Vec<ToolCall>,
}
```

**Integration with Task System**:
```rust
// src/task_management/executor.rs

impl TaskExecutor {
    pub async fn execute_with_llm(&self, task_id: &CodexId) -> Result<TaskExecutionResult> {
        // 1. Load task Codex
        let task = self.task_service.get_task(task_id).await?;

        // 2. Resolve provider from task metadata
        let provider_ref = task.metadata.get("provider_ref")
            .ok_or_else(|| BinderyError::MissingField("provider_ref"))?;

        let provider_codex = self.codex_service.get_codex(provider_ref).await?;
        let provider = ProviderType::from_codex(&provider_codex).await?;

        // 3. Build chat request with tool access based on task template
        let tools = self.get_allowed_tools_for_task(&task)?;
        let chat_request = ChatRequest {
            messages: self.build_message_history(&task)?,
            tools,
            system_prompt: task.metadata.get("system_prompt"),
            max_tokens: task.metadata.get("max_tokens").unwrap_or(4096),
        };

        // 4. Execute with streaming
        let mut stream = provider.send_message(chat_request).await?;
        let mut full_response = String::new();

        while let Some(chunk) = stream.stream.next().await {
            let chunk = chunk?;
            full_response.push_str(&chunk.delta);

            // Emit chunk event for real-time UI updates
            self.emit_task_event(TaskEvent::LlmChunk {
                task_id: task_id.clone(),
                chunk: chunk.delta,
            }).await?;

            // Handle tool calls
            for tool_call in chunk.tool_calls {
                self.execute_tool_call(task_id, &tool_call).await?;
            }
        }

        // 5. Save response to task history
        self.save_task_response(task_id, &full_response).await?;

        Ok(TaskExecutionResult {
            task_id: task_id.clone(),
            output: full_response,
            status: ExecutionStatus::Completed,
            execution_time: Utc::now(),
        })
    }
}
```

---

### 2. Codex Templates

**LLM Provider Template** (`.vespera/templates/llm-provider.json5`):
```json5
{
  id: "llm-provider",
  name: "LLM Provider Configuration",
  description: "Configuration for AI model providers (Anthropic, OpenAI, local)",
  version: "1.0.0",

  fields: [
    {
      name: "provider_type",
      type: "select",
      required: true,
      options: ["claude-code", "anthropic", "openai", "ollama"],
      default: "claude-code",
      description: "Provider type (claude-code uses Claude Max subscription)"
    },
    {
      name: "model",
      type: "text",
      required: true,
      description: "Model identifier (e.g., 'claude-sonnet-4.5-20250929', 'gpt-4-turbo')",
      placeholder: "claude-sonnet-4.5-20250929"
    },
    {
      name: "api_key_ref",
      type: "text",
      description: "Reference to API key in vault (e.g., 'vault://anthropic/api_key')",
      placeholder: "vault://anthropic/api_key",
      conditional: {
        field: "provider_type",
        value: ["anthropic", "openai"]
      }
    },
    {
      name: "cli_path",
      type: "text",
      description: "Path to claude CLI binary (auto-detected if not specified)",
      placeholder: "/usr/local/bin/claude",
      conditional: {
        field: "provider_type",
        value: "claude-code"
      }
    },
    {
      name: "endpoint",
      type: "url",
      description: "API endpoint for Ollama or custom providers",
      placeholder: "http://localhost:11434/v1",
      default: "http://localhost:11434/v1",
      conditional: {
        field: "provider_type",
        value: "ollama"
      }
    },
    {
      name: "max_tokens",
      type: "number",
      default: 4096,
      min: 1,
      max: 200000
    },
    {
      name: "temperature",
      type: "number",
      default: 0.7,
      min: 0,
      max: 2.0,
      step: 0.1
    },
    {
      name: "supports_streaming",
      type: "boolean",
      default: true
    },
    {
      name: "supports_tools",
      type: "boolean",
      default: true
    }
  ],

  metadata: {
    icon: "🤖",
    color: "#7C3AED"
  }
}
```

**AI Chat Session Template** (`.vespera/templates/ai-chat.json5`):
```json5
{
  id: "ai-chat",
  name: "AI Chat Session",
  description: "Interactive chat session with AI assistant",
  version: "1.0.0",

  fields: [
    {
      name: "provider_ref",
      type: "codex_reference",
      required: true,
      template_filter: "llm-provider",
      description: "Reference to LLM provider Codex",
      placeholder: "Select a provider..."
    },
    {
      name: "system_prompt_ref",
      type: "codex_reference",
      template_filter: "markdown",
      description: "Reference to .md file containing system prompt",
      placeholder: "Select prompt file...",
      default: "codex://prompts/default-assistant.md"
    },
    {
      name: "system_prompt_override",
      type: "textarea",
      description: "Optional inline prompt override (if not using file reference)",
      placeholder: "You are Claude, a helpful AI assistant."
    },
    {
      name: "messages",
      type: "array",
      items: {
        type: "object",
        properties: {
          role: { type: "select", options: ["user", "assistant", "system"] },
          content: { type: "textarea" },
          timestamp: { type: "datetime", auto: true }
        }
      }
    },
    {
      name: "context_files",
      type: "array",
      items: { type: "file_reference" },
      description: "Files to include in conversation context"
    },
    {
      name: "available_tools",
      type: "array",
      items: { type: "text" },
      default: ["read", "write", "search"],
      description: "Tools available to the assistant"
    }
  ],

  automation: {
    hooks: [
      {
        trigger: "field_change",
        field: "messages",
        action: "send_to_llm",
        conditions: [
          { field: "messages[-1].role", equals: "user" }
        ]
      }
    ]
  },

  metadata: {
    icon: "💬",
    color: "#10B981"
  }
}
```

**Task Orchestrator Template** (`.vespera/templates/task-orchestrator.json5`):
```json5
{
  id: "task-orchestrator",
  name: "AI Task Orchestrator",
  description: "High-level orchestrator that delegates to specialist agents",
  version: "1.0.0",
  parent_template: "task",  // Inherits from base task template

  fields: [
    {
      name: "provider_ref",
      type: "codex_reference",
      template_filter: "llm-provider",
      default: "codex://providers/claude-4.5-sonnet",
      description: "Use powerful model for orchestration"
    },
    {
      name: "system_prompt_ref",
      type: "codex_reference",
      template_filter: "markdown",
      default: "codex://prompts/orchestrator-agent.md",
      description: "Reference to verbose .md file with orchestrator instructions"
    },
    {
      name: "tags",
      type: "array",
      items: { type: "text" },
      default: ["agent", "orchestrator", "meta"],
      description: "Tags for filtering and organization"
    },
    {
      name: "available_tools",
      type: "array",
      items: { type: "text" },
      default: ["read", "search", "spawn_task"],
      locked: true  // Orchestrators have limited tools for security
    },
    {
      name: "max_spawned_tasks",
      type: "number",
      default: 5,
      description: "Maximum number of subtasks this orchestrator can spawn"
    }
  ]
}
```

**Code Writer Template** (`.vespera/templates/task-code-writer.json5`):
```json5
{
  id: "task-code-writer",
  name: "Code Writer Agent",
  description: "Specialist agent for writing and editing code",
  parent_template: "task",

  fields: [
    {
      name: "provider_ref",
      type: "codex_reference",
      template_filter: "llm-provider",
      default: "codex://providers/local-llama3-70b",  // Use cheaper local model
      description: "Local model for cost-effective code writing"
    },
    {
      name: "system_prompt_ref",
      type: "codex_reference",
      template_filter: "markdown",
      default: "codex://prompts/code-writer-specialist.md",
      description: "Reference to verbose .md file with code writing instructions"
    },
    {
      name: "tags",
      type: "array",
      items: { type: "text" },
      default: ["agent", "code-writer", "specialist"],
      description: "Tags for filtering and organization"
    },
    {
      name: "available_tools",
      type: "array",
      default: ["read", "write", "edit", "bash", "search"],
      description: "Full access to file operations and testing"
    },
    {
      name: "language",
      type: "select",
      options: ["typescript", "rust", "python", "javascript"],
      description: "Primary programming language for this task"
    }
  ]
}
```

---

### 3. API Key Management (Vault System)

**Security Consideration**: API keys should NEVER be in Codex content. Use a vault reference system:

```rust
// src/vault/mod.rs

pub struct SecretVault {
    /// Map of vault_key -> encrypted_value
    secrets: HashMap<String, EncryptedSecret>,
}

impl SecretVault {
    /// Resolve a vault reference like "vault://anthropic/api_key"
    pub async fn resolve(&self, reference: &str) -> Result<String> {
        // Parse: vault://provider/key_name
        let (provider, key_name) = parse_vault_ref(reference)?;

        // Decrypt and return
        self.get_secret(provider, key_name).await
    }

    /// Store a secret with encryption
    pub async fn store(&mut self, provider: &str, key_name: &str, value: &str) -> Result<()> {
        let encrypted = self.encrypt(value)?;
        self.secrets.insert(
            format!("{}/{}", provider, key_name),
            encrypted
        );
        self.save_to_disk().await
    }
}
```

**User Experience**:
```typescript
// Extension command: vespera-forge.configureProviderKey
vscode.commands.registerCommand('vespera-forge.configureProviderKey', async () => {
  const provider = await vscode.window.showQuickPick(['Anthropic', 'OpenAI']);
  const apiKey = await vscode.window.showInputBox({
    prompt: `Enter your ${provider} API key`,
    password: true  // Mask input
  });

  // Store in Bindery vault
  await binderyService.request('vault_store', {
    provider: provider.toLowerCase(),
    key_name: 'api_key',
    value: apiKey
  });

  vscode.window.showInformationMessage('API key stored securely');
});
```

---

### 4. VS Code Extension (Simplified)

**Remove**:
- `src/chat/providers/ClaudeCodeProvider.ts` (entire file)
- `src/chat/providers/ProviderFactory.ts`
- Provider-specific logic from `ConfigurationManager` (keep UI/settings management)
- All provider authentication code (moved to Bindery vault)

**Add Channel List UI**:
```typescript
// src/views/chat-channel-list.ts

/**
 * Channel list for AI Assistant - shows user chats and spawned agent tasks
 * Similar to Slack/Discord channel list
 */
export class ChatChannelListProvider implements vscode.TreeDataProvider<ChatChannel> {
  // User-created chats
  private userChats: ChatChannel[] = [];
  // Agent-spawned tasks (from orchestrators)
  private agentTasks: ChatChannel[] = [];

  async getChildren(element?: ChatChannel): Promise<ChatChannel[]> {
    if (!element) {
      // Root level: show folders
      return [
        new ChatChannelFolder('User Chats', this.userChats),
        new ChatChannelFolder('Agent Tasks', this.agentTasks)
      ];
    }
    return element.children || [];
  }

  // Load from Bindery
  async refresh(): Promise<void> {
    const chats = await binderyService.request('list_codices', {
      template_id: 'ai-chat',
      sort: { field: 'updated_at', order: 'desc' }
    });

    const tasks = await binderyService.request('list_codices', {
      template_id: 'task',
      filter: {
        tags: { contains: 'agent' },
        spawned_by: { exists: true }
      },
      sort: { field: 'created_at', order: 'desc' }
    });

    this.userChats = chats.filter(c => !c.metadata.spawned_by);
    this.agentTasks = tasks;

    this._onDidChangeTreeData.fire();
  }
}

class ChatChannel extends vscode.TreeItem {
  constructor(
    public readonly codexId: string,
    public readonly label: string,
    public readonly status: 'active' | 'idle' | 'archived',
    public readonly children?: ChatChannel[]
  ) {
    super(label, children ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);

    // Activity indicator icons
    this.iconPath = new vscode.ThemeIcon(
      status === 'active' ? 'loading~spin' :
      status === 'idle' ? 'circle-outline' :
      'archive'
    );
  }
}
```

**Simplify AI Assistant**:
```typescript
// src/views/ai-assistant.ts

export class AIAssistantWebviewProvider implements vscode.WebviewViewProvider {
  private currentChatCodexId?: string;
  private channelListProvider: ChatChannelListProvider;

  constructor(context: vscode.ExtensionContext) {
    this.channelListProvider = new ChatChannelListProvider();

    // Register channel list tree view
    vscode.window.createTreeView('vespera-forge.chatChannels', {
      treeDataProvider: this.channelListProvider
    });
  }

  async resolveWebviewView(webviewView: vscode.WebviewView) {
    // Create or load chat session Codex
    const chatCodex = await this.getOrCreateChatSession();
    this.currentChatCodexId = chatCodex.id;

    // Set up message handler
    webviewView.webview.onDidReceiveMessage(async (message) => {
      if (message.type === 'sendMessage') {
        await this.handleUserMessage(message.content);
      }
    });

    // Render chat UI
    webviewView.webview.html = this.getChatHtml();
  }

  private async getOrCreateChatSession(): Promise<Codex> {
    // Check if active chat session exists
    const existingSessions = await binderyService.request('list_codices', {
      template_id: 'ai-chat',
      filter: { active: true }
    });

    if (existingSessions.length > 0) {
      return existingSessions[0];
    }

    // Create new chat session
    return await binderyService.request('create_codex', {
      template_id: 'ai-chat',
      metadata: {
        title: `Chat - ${new Date().toLocaleString()}`,
        provider_ref: 'codex://providers/default-claude',
        system_prompt: 'You are Claude, a helpful AI assistant.',
        messages: [],
        active: true
      }
    });
  }

  private async handleUserMessage(content: string) {
    // Add user message to Codex
    await binderyService.request('update_codex', {
      codex_id: this.currentChatCodexId,
      operation: 'append_array',
      field: 'messages',
      value: {
        role: 'user',
        content,
        timestamp: new Date().toISOString()
      }
    });

    // Bindery automation hook will trigger LLM call
    // (see template automation section above)

    // Listen for streaming response
    this.subscribeToLlmStream();
  }

  private subscribeToLlmStream() {
    binderyService.on('llm_chunk', (event) => {
      if (event.codex_id === this.currentChatCodexId) {
        // Send chunk to webview for real-time rendering
        this.webview.postMessage({
          type: 'chatChunk',
          content: event.chunk
        });
      }
    });

    binderyService.on('llm_complete', (event) => {
      if (event.codex_id === this.currentChatCodexId) {
        // Final message saved to Codex
        this.webview.postMessage({
          type: 'chatComplete',
          message: event.full_message
        });
      }
    });
  }
}
```

---

## Implementation Phases

### Phase 14a: Bindery LLM Provider (Rust)
**Time Estimate**: 4-5 hours

1. Create `src/llm/` module with provider trait
2. **PRIORITY**: Implement `ClaudeCodeProvider` (spawns `claude` CLI, uses Claude Max subscription)
   - Parse CLI output for streaming chunks
   - Handle authentication state
   - Tool calling via CLI arguments
3. **PRIORITY**: Implement `OllamaProvider` (local LLM, cost-free)
4. **SECONDARY**: Implement `AnthropicProvider` (REST API, uses API key)
5. **SECONDARY**: Implement `OpenAIProvider` (REST API, uses API key)
6. Add vault system for API key storage (only needed for Anthropic/OpenAI)
7. Integrate with `TaskExecutor`
8. Add JSON-RPC methods: `llm_send_message`, `vault_store`, `vault_get`

**Note**: Bindery runs as native process (not in Flatpak), so can spawn `claude` CLI successfully

### Phase 14b: Codex Templates & System Prompts
**Time Estimate**: 1 hour

1. Create `.vespera/templates/llm-provider.json5`
2. Create `.vespera/templates/ai-chat.json5`
3. Create `.vespera/templates/task-orchestrator.json5`
4. Create `.vespera/templates/task-code-writer.json5`
5. Create system prompt files:
   - `.vespera/prompts/default-assistant.md`
   - `.vespera/prompts/orchestrator-agent.md`
   - `.vespera/prompts/code-writer-specialist.md`
   - `.vespera/prompts/docs-writer-specialist.md`

### Phase 14c: Extension Cleanup & Channel List UI
**Time Estimate**: 2 hours

1. **Add Channel List UI** (new component)
   - Create `ChatChannelListProvider` tree view
   - Separate folders for user chats and agent tasks
   - Activity indicators (active/idle/archived)
   - Allow user to monitor/interrupt spawned agents
2. Remove legacy chat provider system
3. Simplify `AIAssistantWebviewProvider`
4. Wire to Bindery Codex system
5. Keep `ConfigurationManager` for UI/settings (remove provider logic only)
6. Add command: `vespera-forge.configureProviderKey` (for Anthropic/OpenAI keys)
7. Add command: `vespera-forge.checkClaudeCodeAuth` (verify `claude login` status)

### Phase 14d: Testing & Documentation
**Time Estimate**: 1-2 hours

1. **Test Claude Code provider** (PRIORITY - uses Claude Max subscription)
2. **Test Ollama provider** (PRIORITY - local, cost-free)
3. Test multi-agent orchestration (orchestrator → code-writer)
4. Test channel list UI (user can monitor/interrupt agents)
5. Test Anthropic/OpenAI providers (SECONDARY - minimize usage due to cost)
6. Update documentation

**Total Estimate**: 8-10 hours

---

## Success Criteria

- [ ] Chat works via Codex system (no legacy provider code)
- [ ] API keys stored securely in vault (not in Codex content)
- [ ] Streaming responses render in real-time
- [ ] Provider switching works (Anthropic ↔ OpenAI ↔ Local)
- [ ] Task orchestrator can spawn code-writer subtasks
- [ ] Different task types use different models (cost optimization)
- [ ] No Flatpak PATH issues (Bindery handles all LLM calls)
- [ ] Codex templates fully user-extensible

---

## Next Steps

**Ready to implement?** Let me know and I'll start with:
1. **Phase 14a**: Rust LLM provider module
2. Fix Bindery stdout spam (quick win during dev)
3. Proceed to templates and extension cleanup

**Implementation Priority:**
1. **Claude Code CLI provider** (uses Claude Max subscription - unlimited usage)
2. **Ollama provider** (local LLMs - cost-free)
3. **Anthropic/OpenAI REST APIs** (paid, minimize testing)

**User Constraints:**
- Has Anthropic/OpenAI/OpenRouter API keys, but minimize usage (cost)
- Claude Max subscription via Claude Code CLI - UNLIMITED, use primarily
- Ollama installed for local LLMs
- Wants custom settings UI (not default VS Code settings)

**Key Insight:**
Bindery runs as native process outside Flatpak, so it CAN spawn `claude` CLI successfully (unlike extension which is sandboxed).
