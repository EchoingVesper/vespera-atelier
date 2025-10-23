# Phase 14 Progress Tracker

**Phase**: Codex-Based AI Chat Architecture
**Branch**: `feat/codex-ui-framework`
**Started**: 2025-10-22
**Current Status**: Phase 14c In Progress 🚧

---

## Phase 14a: Rust LLM Provider Module ✅ COMPLETE

### Implemented Components

**1. Core Type System** (`src/llm/types.rs`)
- `ChatMessage`, `ChatRequest`, `ChatResponse`, `ChatRole`
- `ToolCall`, `ToolDefinition`, `FinishReason`
- `ProviderCapabilities`, `UsageStats`

**2. Streaming Infrastructure** (`src/llm/streaming.rs`)
- `StreamingResponse` with async `Stream<Item = Result<ChatChunk>>`
- `ChatChunk` with text deltas and metadata
- `ResponseMetadata` for tracking requests

**3. Provider Trait** (`src/llm/provider.rs`)
- `LlmProvider` trait with async methods:
  - `send_message_streaming()` - streaming responses
  - `send_message()` - complete responses
  - `capabilities()` - provider info
  - `validate_config()` - auth/connectivity checks
- `ProviderType` enum:
  - `ClaudeCode` (PRIORITY)
  - `Ollama` (PRIORITY)
  - `Anthropic` (SECONDARY)
  - `OpenAI` (SECONDARY)
- `ProviderType::from_codex()` - parses Codex template fields

**4. Claude Code CLI Provider** (`src/llm/claude_code.rs`) ⭐ PRIORITY
- Spawns `claude` CLI process
- Parses stdout for streaming chunks
- Auth checking via `check_auth()`
- Tool whitelisting via `--allowed-tools`
- Uses Claude Max subscription (unlimited)
- **Key Advantage**: Bindery runs outside Flatpak, can spawn CLI successfully

**5. Ollama Provider** (`src/llm/ollama.rs`) ⭐ PRIORITY
- REST API integration (`/api/chat`)
- Streaming and non-streaming modes
- OpenAI-compatible format
- Local LLM execution (cost-free)
- Server health checking

**6. Secret Vault** (`src/llm/vault.rs`)
- Stores API keys with vault references: `vault://anthropic/api_key`
- Base64 encoding (TODO: upgrade to encryption)
- File permissions: 0o600 (owner-only on Unix)
- Methods: `resolve()`, `store()`, `delete()`, `list_keys()`

### Cargo Dependencies Added

```toml
which = "6.0"
async-trait = "0.1"
base64 = "0.22"
reqwest = { version = "0.12", features = ["json", "rustls-tls", "stream"] }
```

### Build Status

✅ **Compiles successfully** with 53 warnings (mostly async trait warnings)

---

## Phase 14b: Codex Templates ✅ COMPLETE

### Templates Created

**Location**: `.vespera/templates/` (temporary - will move to source)

1. **`llm-provider.json5`** ✅
   - Fields: `provider_type`, `model`, `api_key_ref`, `cli_path`, `endpoint`
   - Conditional fields based on provider type
   - Supports: claude-code, ollama, anthropic, openai
   - Default: `claude-code`
   - Icon: 🤖, Color: #7C3AED

2. **`ai-chat.json5`** ✅
   - Fields: `provider_ref`, `system_prompt_ref`, `channel_name`, `channel_type`, `status`
   - Content sections: `messages` (structured), `summary` (markdown)
   - Automation hooks: trigger LLM on user message, initialize chat, archive on delete
   - Activity tracking: idle threshold, auto-archive
   - Icon: 💬, Color: #10B981

3. **`task-orchestrator.json5`** ✅
   - Extends base `task` template
   - Fields: `task_name`, `provider_ref`, `system_prompt_ref`, `allowed_tools`, `spawned_subtasks`
   - Allowed tools: `read`, `search`, `spawn_task`, `list_tasks`, `get_task_status`
   - Resource limits: max 10 subtasks, depth 3, 100 LLM calls, 60min timeout
   - Tags: `agent`, `orchestrator`, `meta`, `task`
   - Icon: 🎯, Color: #F59E0B

4. **`task-code-writer.json5`** ✅
   - Extends base `task` template
   - Fields: `task_name`, `provider_ref`, `system_prompt_ref`, `target_files`, `test_command`
   - Allowed tools: `read`, `write`, `edit`, `search`, `glob`, `bash`, `git_diff`, `git_commit`
   - Content sections: `implementation_plan`, `code_changes`, `test_results`
   - Auto-test functionality, syntax highlighting UI hints
   - Tags: `agent`, `code-writer`, `specialist`, `task`
   - Icon: 💻, Color: #3B82F6

### System Prompts Created

**Location**: `.vespera/prompts/` (temporary - will move to source)

1. **`default-assistant.md`** ✅
   - General-purpose helpful assistant
   - Creative + technical capabilities
   - Context-aware, adaptive tone
   - Respects user workflow and boundaries

2. **`orchestrator-agent.md`** ✅
   - Meta-agent for task coordination
   - Task analysis and decomposition strategies
   - Specialist selection and delegation patterns
   - Cost optimization (expensive orchestrator, cheap specialists)
   - Resource management and monitoring

3. **`code-writer-specialist.md`** ✅
   - Code writing best practices
   - Testing and validation workflows
   - Language-specific guidance (TS, Python, Rust)
   - Git workflow patterns
   - Focus on execution excellence

4. **`docs-writer-specialist.md`** ✅
   - Documentation standards and structure
   - Markdown formatting best practices
   - Example patterns (API docs, user guides, README)
   - Clear, concise writing style
   - Visual aids and code snippets

### Notes

**Template Location Migration** (TODO for later):
- Current location: `.vespera/templates/` and `.vespera/prompts/`
- Future location: `packages/vespera-utilities/vespera-bindery/templates/` (or similar in source)
- Reason: `.vespera` is project-specific, created on init
- Templates should be in source, then copied to `.vespera/` during project initialization

---

## Phase 14c: Extension Cleanup 🚧 IN PROGRESS

### Part 1: Provider Removal ✅ COMPLETE

**Git Commit**: `6299161` - "refactor(vespera-forge): Remove legacy provider system"

**Files Removed** (7 providers + 2 test files):
- `src/chat/providers/ClaudeCodeProvider.ts` (26KB, 753 lines)
- `src/chat/providers/ProviderFactory.ts` (3.4KB, 98 lines)
- `src/chat/providers/AnthropicProvider.ts` (11KB, 320 lines)
- `src/chat/providers/OpenAIProvider.ts` (11.5KB, 333 lines)
- `src/chat/providers/LMStudioProvider.ts` (15KB, 432 lines)
- `src/chat/providers/BaseProvider.ts` (7.9KB, 227 lines)
- `src/chat/providers/SecureChatProviderClient.ts` (20KB, 574 lines)
- `src/chat/test-claude-code-provider.ts` (deleted)
- `src/chat/test-secure-providers.ts` (deleted)

**Total Lines Removed**: ~2,945 lines of legacy code

**Files Modified**:
- `src/chat/providers/index.ts`: Migration notice pointing to Bindery
- `src/chat/index.ts`: Deprecated 6 VesperaChatSystem methods with TODO comments

**Methods Deprecated**:
1. `createAndRegisterProvider()` - Returns stub, TODO for Bindery
2. `setActiveProvider()` - Simplified, TODO for Bindery
3. `streamMessage()` - Returns migration notice
4. `updateConfiguration()` - Stubbed
5. `testConnection()` - Returns false
6. `showProviderConfigurationDialog()` - Shows info message

### Part 1.5: Console Spam Fix ✅ COMPLETE

**Git Commit**: `2c37db5` - "fix(vespera-forge): Eliminate console spam"

**Problem 1: Bindery stdout spam** (~95% reduction)
- Hundreds of "Received response for unknown request ID: undefined"
- Root cause: Bindery logs sent to stdout instead of stderr
- **Fix**: Filter non-JSON-RPC messages (check for `jsonrpc` field)
- Location: `src/services/bindery.ts:1007-1013`

**Problem 2: Object logging spam**
- Messages printing "[object Object]"
- **Fixed 3 locations**:
  - `src/config/tool-management.ts:113` - Commented out policy log
  - `src/security/file-operations-security.ts:103` - Commented out policy log
  - `src/core/telemetry/VesperaTelemetryService.ts:51` - Commented out event log

**Impact**:
- Console log reduced from ~400 lines to ~70 lines (82% reduction)
- Actual errors and warnings now visible
- Debugging significantly easier

### Part 2: Chat Channel List UI ✅ COMPLETE

**Git Status**: Ready for commit

**Files Created**:
1. `src/views/ChatChannelListProvider.ts` (263 lines)
   - Tree view with folders: "User Chats", "Agent Tasks"
   - Activity indicators: 🟢 active / 🟡 idle / ⚪ archived
   - Channel info: message count, last activity time
   - Loads ai-chat Codices from Bindery
   - CRUD operations: create, delete, archive channels

**Files Modified**:
2. `src/commands/index.ts` - Added 7 command handlers:
   - `createChatChannelCommand` - Create new chat channel
   - `selectChatChannelCommand` - Switch AI Assistant to channel
   - `deleteChatChannelCommand` - Delete channel with confirmation
   - `archiveChatChannelCommand` - Archive inactive channels
   - `refreshChatChannelsCommand` - Refresh channel list
   - `configureProviderKeyCommand` - Store API keys in vault (stub)
   - `checkClaudeCodeAuthCommand` - Verify `claude login` status (stub)

3. `src/views/ai-assistant.ts` - Channel switching support:
   - `switchChannel()` method - Switch between channels
   - Channel header - Shows active channel name with status
   - Global provider storage for command access
   - TODO: Load/save messages to Codex content

4. `src/views/index.ts` - View registration:
   - Registered `ChatChannelListProvider` tree view
   - Exported in `VesperaViewContext`
   - Global provider storage for commands

5. `package.json` - UI integration:
   - New view: `vesperaForge.chatChannelList` in assistant sidebar
   - 8 new commands registered
   - View title menus: + and refresh buttons
   - Context menus: Archive option for channels

**Bug Fixes**:
- Fixed `codices.filter is not a function` - Unwrap service result object
- Fixed `claudeProvider.connect is not a function` - Removed deprecated provider init

### Components to Keep

- `ConfigurationManager` - UI/settings only (provider logic removed)
- Hotkeys, theme, layout settings
- Session persistence

---

## Phase 14d: Testing ⏳ PENDING

### Test Plan

1. **Claude Code Provider** (PRIORITY)
   - Verify `claude` CLI spawning
   - Test streaming output parsing
   - Validate authentication check
   - Test tool whitelisting

2. **Ollama Provider** (PRIORITY)
   - Verify REST API connection
   - Test streaming vs non-streaming
   - Validate local model execution

3. **Multi-Agent Orchestration**
   - Orchestrator spawns code-writer
   - Code-writer uses local model
   - Orchestrator uses Claude 4.5
   - Task results coordinated

4. **Channel List UI**
   - User chats displayed
   - Agent tasks shown separately
   - Activity indicators update
   - User can select/monitor channels

5. **Anthropic/OpenAI** (SECONDARY - minimize usage)
   - Basic connectivity test only
   - Vault key resolution
   - API call success

---

## Deferred Items

These will be implemented after core functionality works:

1. **Template Location Migration**
   - Move templates from `.vespera/templates/` to source (e.g., `packages/vespera-utilities/vespera-bindery/templates/`)
   - Move prompts from `.vespera/prompts/` to source
   - Create initialization logic to copy templates to `.vespera/` on project init
   - Update template loading to check source location

2. **TaskExecutor Integration**
   - `execute_with_llm()` method
   - Tool execution handling
   - Task history management

3. **JSON-RPC Methods**
   - `llm_send_message`
   - `vault_store`
   - `vault_get`
   - Event emission for streaming

4. **Anthropic REST Provider** (SECONDARY)
5. **OpenAI REST Provider** (SECONDARY)
6. **Bindery stdout/stderr Separation Fix**

---

## Architecture Decisions

### Key Insights

1. **Bindery runs outside Flatpak** → Can spawn `claude` CLI successfully
2. **Codex template fields** → Not metadata, use `content.template_fields`
3. **System prompts as files** → Link via `system_prompt_ref`, not inline
4. **Tags for organization** → Enable filtering, automation rules
5. **Cost optimization** → Claude 4.5 for orchestration, local for tasks

### Template-Driven Design

- No hardcoded `CodexType` enums
- Dynamic type registration via JSON5 templates
- User-extensible provider configurations
- Runtime config updates via Codex references

---

## Files Created/Modified

**Rust Backend** (Phase 14a):
- `packages/vespera-utilities/vespera-bindery/Cargo.toml` - Dependencies
- `packages/vespera-utilities/vespera-bindery/src/lib.rs` - Module export
- 7 new files in `src/llm/` directory:
  - `mod.rs`, `types.rs`, `streaming.rs`, `provider.rs`
  - `claude_code.rs`, `ollama.rs`, `vault.rs`

**Codex Templates** (Phase 14b):
- `.vespera/templates/llm-provider.json5` - LLM provider configuration
- `.vespera/templates/ai-chat.json5` - AI chat session
- `.vespera/templates/task-orchestrator.json5` - Orchestrator agent task
- `.vespera/templates/task-code-writer.json5` - Code writer specialist task

**System Prompts** (Phase 14b):
- `.vespera/prompts/default-assistant.md` - Default chat assistant
- `.vespera/prompts/orchestrator-agent.md` - Task orchestrator agent
- `.vespera/prompts/code-writer-specialist.md` - Code writer specialist
- `.vespera/prompts/docs-writer-specialist.md` - Documentation writer specialist

**Extension Cleanup** (Phase 14c):
- Deleted 9 files (~2,945 lines): 7 provider implementations, 2 test files
- `plugins/VSCode/vespera-forge/src/chat/providers/index.ts` - Migration notice
- `plugins/VSCode/vespera-forge/src/chat/index.ts` - Deprecated provider methods
- `plugins/VSCode/vespera-forge/src/services/bindery.ts` - JSON-RPC filter
- `plugins/VSCode/vespera-forge/src/config/tool-management.ts` - Removed log spam
- `plugins/VSCode/vespera-forge/src/security/file-operations-security.ts` - Removed log spam
- `plugins/VSCode/vespera-forge/src/core/telemetry/VesperaTelemetryService.ts` - Removed log spam

**Documentation**:
- `PHASE_14_LLM_ARCHITECTURE.md` - Architecture design
- `PHASE_14_DECISION_POINT.md` - Decision rationale
- `BINDERY_STDOUT_FIX.md` - Future fix documentation (implemented in Phase 14c)
- `INTEGRATION_STATUS.md` - Progress tracking
- `PHASE_14_PROGRESS.md` (this file)

---

## Context Notes

- Token usage approaching limits (~125k/200k)
- Consider checkpoint/commit before Phase 14b
- Architecture solid, ready for templates
- No blocking issues found
