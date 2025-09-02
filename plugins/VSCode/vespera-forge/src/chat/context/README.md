# File Context Integration for VS Code Extension

## Overview

The File Context system automatically collects relevant file content, selections, and cursor context from VS Code to enhance AI chat conversations. This provides Claude with current file context without manual copy-pasting.

## Architecture

### Core Components

1. **FileContextCollector** (`FileContextCollector.ts`)
   - Collects file content, selections, and cursor area using VS Code APIs
   - Implements smart filtering and exclusion patterns
   - Prioritizes context by relevance (selection > cursor area > full file)

2. **FileContextManager** (`FileContextManager.ts`)
   - Coordinates context collection and formatting
   - Formats context for LLM consumption with syntax highlighting
   - Provides configuration management and event handling

3. **ClaudeCodeProvider Integration** (`../providers/ClaudeCodeProvider.ts`)
   - Integrates file context into message flow
   - Handles context collection before sending to Claude Code SDK
   - Provides UI feedback about context usage

## Features

### Context Collection Types

- **Selected Text**: Highest priority - includes user selection with surrounding context
- **Cursor Area**: Lines around cursor position (configurable, default 10 lines)
- **Active File**: Full file content (when no specific selection/cursor context)
- **Open Tabs**: Content from other visible editors (optional, low priority)

### Smart Limitations

- **Token Limits**: Configurable max file size and total context size
- **Priority-Based Truncation**: Higher priority context preserved first
- **File Exclusions**: Automatic exclusion of build artifacts, dependencies, etc.
- **Overlap Detection**: Prevents duplicate context from overlapping selections

### Configuration Options

```typescript
{
  enabled: boolean,                    // Enable/disable file context
  autoCollect: boolean,                // Auto-collect on message send
  contextOptions: {
    includeActiveFile: boolean,        // Include full active file
    includeSelection: boolean,         // Include selected text
    includeCursorArea: boolean,        // Include cursor area
    includeOpenTabs: boolean,          // Include other open tabs
    cursorContextLines: number,        // Lines around cursor (5-50)
    maxFileSize: number,               // Max chars per file (1k-50k)
    maxTotalSize: number,              // Max total context (5k-200k)
    excludePatterns: string[]          // File patterns to exclude
  },
  formatOptions: {
    includeLineNumbers: boolean,       // Add line numbers to context
    includeLanguageHints: boolean,     // Add syntax highlighting hints
    includeFilePaths: boolean,         // Show file paths
    contextSeparator: string,          // Separator between files
    maxContextPreview: number          // Preview length in summaries
  }
}
```

## Usage Examples

### 1. Code Review Scenario

**User Action**: Select problematic code block  
**User Message**: "What's wrong with this function?"  
**Context Included**: Selected code + surrounding context with line numbers  
**Result**: Claude analyzes specific code with full context understanding

### 2. Documentation Request

**User Action**: Place cursor in function  
**User Message**: "Generate JSDoc for this function"  
**Context Included**: Cursor area (10 lines around function)  
**Result**: Claude generates documentation for the specific function

### 3. Refactoring Discussion

**User Action**: Open multiple related files  
**User Message**: "How should I refactor these components?"  
**Context Included**: Active file + open tabs (with size limits)  
**Result**: Claude analyzes architecture across files

## Integration Points

### VS Code APIs Used

```typescript
// Active editor access
vscode.window.activeTextEditor
vscode.window.visibleTextEditors

// Document content
editor.document.getText()
editor.document.getText(range)

// Selection and cursor
editor.selection
editor.selection.active

// Workspace utilities
vscode.workspace.getWorkspaceFolder()
vscode.workspace.asRelativePath()
```

### Message Flow Integration

1. **User sends message** → ChatPanelWebviewProvider
2. **Context collection** → FileContextManager.createContextualMessage()
3. **Context formatting** → Format with syntax highlighting and metadata
4. **Enhanced prompt** → Send to ClaudeCodeProvider
5. **Response with context info** → Display context usage in UI

## Configuration Interface

The extension provides a comprehensive configuration UI accessible via:
- Chat panel "⚙️ Configure" button
- VS Code command palette: "Vespera Forge: Configure Chat Providers"

### File Context Controls

- **📁 Context Button**: Toggle context collection on/off
- **📋 Info Button**: Show current context summary
- **⚙️ Configure**: Access detailed configuration options

## Implementation Details

### Context Formatting for LLMs

```typescript
// Example formatted context
`File: src/utils/helper.ts (typescript) - Lines 25-35 - USER SELECTION

\`\`\`typescript
25: function calculateTotal(items: Item[]): number {
26:   let total = 0;
27:   for (const item of items) {
28:     total += item.price * item.quantity; // Selected line
29:   }
30:   return total;
31: }
\`\`\`

---

File: src/types/item.ts (typescript) - CURSOR AREA

\`\`\`typescript
interface Item {
  id: string;
  price: number;
  quantity: number;
}
\`\`\``
```

### Performance Considerations

- **Lazy Loading**: Context only collected when needed
- **Caching**: Recent context cached briefly to avoid re-collection
- **Size Limits**: Hard limits prevent excessive token usage
- **Background Processing**: Collection doesn't block UI

## Testing Integration

### Manual Testing Steps

1. **Enable file context** in configuration
2. **Open a TypeScript file** with some code
3. **Select a code block** 
4. **Send message**: "Explain this code"
5. **Verify**: Context info shows in chat, Claude receives file context

### Automated Testing

```typescript
// Example test structure
describe('FileContextCollector', () => {
  it('should collect selection with surrounding context', async () => {
    // Setup mock editor with selection
    // Call collectContext()
    // Verify selection context item with correct priority
  });
  
  it('should respect file size limits', async () => {
    // Setup large file
    // Configure small maxFileSize
    // Verify truncation occurs
  });
  
  it('should exclude specified file patterns', async () => {
    // Setup files matching exclude patterns  
    // Verify excluded files not collected
  });
});
```

## Error Handling

- **Context collection failures**: Graceful fallback to original message
- **Large file handling**: Automatic truncation with user notification  
- **API errors**: Continue without context, log errors for debugging
- **Configuration issues**: Use safe defaults, show warnings

## Future Enhancements

1. **Semantic Context**: Use AST parsing for better code understanding
2. **Project Context**: Include package.json, README for project understanding
3. **Git Context**: Include recent commits, branch info for context
4. **Smart Exclusions**: ML-based detection of irrelevant files
5. **Context Caching**: Persist context between sessions
6. **Multi-Language Support**: Enhanced support for different programming languages

## Troubleshooting

### Common Issues

1. **Context not appearing**: Check if file context is enabled in configuration
2. **Too much context**: Reduce maxTotalSize or maxFileSize limits
3. **Wrong files included**: Update excludePatterns in configuration
4. **Performance issues**: Disable includeOpenTabs, reduce context window size

### Debug Mode

Enable debug logging in VS Code Developer Console:
```typescript
// Check console for file context debug logs
console.log('[FileContextCollector]', '[FileContextManager]', '[ClaudeCodeProvider]')
```