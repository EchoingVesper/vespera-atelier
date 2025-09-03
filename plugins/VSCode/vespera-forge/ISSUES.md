# Vespera Forge Issues & Improvements

## Context System Issues

### Issue #1: Context Information Being Injected Into Agent Replies
**Priority: High**  
**Status: Identified**

The "Conversation Context + File Context" information is currently being injected directly into the agent reply text, making it appear as if the agent is providing this context information rather than it being system-provided context.

**Current Problem:**
- Context injection appears as part of the agent's response 
- Confuses the agent and makes responses less clear
- No visual separation between agent content and context metadata

**Proposed Solution:**
- Move context information to a separate visual component/div
- Only show context availability indicator when agent needs to reference context
- Context should be tools that the agent can call, not automatic injection
- System prompts can remain automatic, but file content should be on-demand

### Issue #2: Poor Context UI/UX Design
**Priority: High**  
**Status: Identified**

The current context injection lacks proper visual hierarchy and user control.

**Proposed Solution:**
- Create a collapsible foldout section for context information
- Section should contain clickable links to:
  - Jump to specific file locations
  - Open files in editor
  - Navigate to specific line numbers
- Foldout state should be persistent per session
- Once opened, subsequent messages should maintain the open state until user closes it
- Provide toggle to shut/open the context display

**Implementation Details:**
- Separate div/component for context metadata
- Expandable/collapsible interface using details/summary or custom toggle
- Store foldout state in VS Code extension state
- Links should use VS Code commands to open files and navigate to locations

### Issue #3: Context Injection Should Be Tool-Based, Not Automatic
**Priority: Medium**  
**Status: Identified**

Currently, context is automatically injected into every prompt with file information around the cursor. This should be converted to a tool-based approach where the agent can request context when needed.

**Proposed Solution:**
- Convert automatic context injection to callable tools
- Agent can request file context, selection context, or cursor area context via tools
- Remove automatic file content injection from prompts
- Keep system-level context (like file availability) in system prompts

## Bindery Integration Issues

### Issue #4: Custom File Tools Not Integrated with Bindery
**Priority: High**  
**Status: Needs Investigation**

The extension has custom file operation tools that exist to support the Bindery and RAG operations, but they may not be properly hooked in.

**Investigation Needed:**
- Verify status of custom file operations implementation
- Check if Bindery integration is working for file operations
- Ensure RAG system is receiving file operations data
- Test end-to-end workflow from VS Code → Bindery → RAG

**Current State:**
- BinderyService class exists with comprehensive API
- File operations appear to be planned but implementation status unclear
- Mock mode is available for development
- Need to verify actual Bindery executable integration

### Issue #5: Missing MCP File Tools Integration
**Priority: Medium**  
**Status: Identified from Context**

Based on the CLAUDE.md context, there should be integration with MCP file tools for high-performance file operations.

**Expected Tools:**
- `mcp_read_file` - High-performance file reading with automatic artifact creation
- `mcp_write_file` - High-performance file writing with atomic operations  
- `mcp_append_file` - High-performance file appending
- `mcp_list_files` - High-performance file listing with glob patterns
- `mcp_file_info` - Get detailed file information
- `mcp_read_file_lines` - Line-by-line file reading with automatic artifact creation

**Action Required:**
- Check if these MCP tools are exposed to the agent in the VS Code context
- Ensure proper integration between VS Code extension and Bindery MCP server
- Test that file operations flow through to RAG system

## UI/UX Improvements

### Issue #6: Chat Context Toggle Missing Visual Feedback
**Priority: Low**  
**Status: Based on README Documentation**

The README mentions context toggle controls, but implementation status is unclear.

**Expected Features:**
- 📁 Context Button: Toggle context collection on/off
- 📋 Info Button: Show current context summary  
- ⚙️ Configure: Access detailed configuration options

**Action Required:**
- Verify these UI controls exist and function properly
- Ensure visual feedback for context state
- Test configuration interface accessibility

## Development & Testing Issues

### Issue #7: Multiple TODOs in Provider Implementations
**Priority: Medium**  
**Status: Identified from Code Scan**

Many provider classes have TODO comments for missing implementations:

**AnthropicProvider TODOs:**
- Line 50: Implement actual HTTP request to Anthropic Messages API
- Line 86: Implement actual streaming request to Anthropic
- Line 108: Implement proper Anthropic Messages API request body
- Line 154: Implement actual connection test for Anthropic

**OpenAIProvider TODOs:**
- Line 49: Implement actual HTTP request
- Line 84: Implement actual streaming request  
- Line 106: Implement proper request body construction
- Line 136: Implement actual connection test

**LMStudioProvider TODOs:**
- Line 48: Implement actual HTTP request to LM Studio
- Line 87: Implement actual streaming request to LM Studio
- Line 114: Implement actual model listing from LM Studio
- Line 131: Implement proper request body for LM Studio
- Line 162: Implement actual connection test for LM Studio

### Issue #8: WebView Provider Implementation Gaps
**Priority: Medium**  
**Status: Identified from Code Scan**

ChatWebViewProvider has several TODO items:

- Line 336: Implement actual message sending logic
- Line 359: Implement provider switching logic
- Line 482: Implement actual connection test with provider
- Line 609: Implement history clearing logic
- Line 616: Implement history export logic
- Line 629: Implement settings update logic
- Line 645: Get actual providers from provider manager
- Line 668: Get actual chat history

## Priority Action Items

### Immediate (High Priority)
1. **Fix Context Injection UI** - Separate context display from agent responses
2. **Implement Context Foldout** - Collapsible context section with persistent state
3. **Investigate Bindery Integration** - Verify custom file tools are working

### Short Term (Medium Priority)  
4. **Convert to Tool-Based Context** - Make context collection tool-based rather than automatic
5. **Complete Provider Implementations** - Fill in TODO items for HTTP requests and streaming
6. **Verify MCP Integration** - Ensure MCP file tools are available to agents

### Long Term (Low Priority)
7. **UI Polish** - Implement context toggle controls and configuration interface  
8. **Enhanced File Operations** - Full RAG integration testing and optimization

---

## Notes
- This document was created based on conversation analysis and code review
- Some issues may already be partially implemented
- Priority levels can be adjusted based on user feedback and testing
- Each issue should be converted to individual GitHub issues or project tasks as appropriate