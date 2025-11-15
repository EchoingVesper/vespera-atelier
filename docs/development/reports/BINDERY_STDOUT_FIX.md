# Bindery stdout/stderr Separation Fix

**Issue**: Bindery server sends debug messages to stdout without `id` field, causing console spam

**Location**: `plugins/VSCode/vespera-forge/src/services/bindery.ts:1005-1021`

---

## Current Problem

```typescript
// Current code (BROKEN):
for (const line of lines) {
  if (line.trim()) {
    try {
      const response: BinderyResponse = JSON.parse(line);  // ❌ Assumes ALL lines are JSON-RPC
      this.handleResponse(response).catch(error => {
        this.log('Failed to handle Bindery response:', error);
      });
    } catch (error) {
      this.log('Failed to parse Bindery response:', line, error);
    }
  }
}
```

**What happens**:
1. Bindery sends: `{"jsonrpc":"2.0","id":1,"result":"..."}`  ✅ Valid JSON-RPC response
2. Bindery sends: `Debug: Loaded 3 codices from database`  ❌ Not JSON-RPC, has no `id`

Code tries to parse #2 as JSON, succeeds (because it might be valid JSON or just text), but `response.id` is undefined, causing:
```
[BinderyService] Received response for request ID: undefined
[BinderyService] Received response for unknown request ID: undefined
```

---

## Solution: Filter JSON-RPC Messages

**Option 1: Check for `jsonrpc` field** (Recommended)
```typescript
for (const line of lines) {
  if (line.trim()) {
    try {
      const parsed = JSON.parse(line);

      // Only handle JSON-RPC 2.0 messages
      if (parsed.jsonrpc === '2.0' && typeof parsed.id !== 'undefined') {
        const response: BinderyResponse = parsed;
        this.handleResponse(response).catch(error => {
          this.log('Failed to handle Bindery response:', error);
        });
      } else {
        // It's a log/debug message, just display it
        this.log('[Bindery]', line);
      }
    } catch (error) {
      // Not JSON at all, it's a plain text log
      this.log('[Bindery]', line);
    }
  }
}
```

**Option 2: Regex pre-filter** (Faster)
```typescript
for (const line of lines) {
  const trimmed = line.trim();
  if (trimmed) {
    // Only parse lines that look like JSON-RPC
    if (trimmed.startsWith('{') && trimmed.includes('"jsonrpc"')) {
      try {
        const response: BinderyResponse = JSON.parse(trimmed);
        if (typeof response.id !== 'undefined') {
          this.handleResponse(response).catch(error => {
            this.log('Failed to handle Bindery response:', error);
          });
        }
      } catch (error) {
        this.log('Failed to parse Bindery response:', trimmed, error);
      }
    } else {
      // Plain text log
      this.log('[Bindery]', trimmed);
    }
  }
}
```

---

## Better Long-term Fix: Fix Rust Server

**Rust backend should send logs to stderr**:

```rust
// In packages/vespera-utilities/vespera-bindery/src/bin/server.rs

// BEFORE (WRONG):
println!("Starting Vespera Bindery Server v0.1.0");  // ❌ Goes to stdout, gets parsed as JSON-RPC

// AFTER (CORRECT):
eprintln!("Starting Vespera Bindery Server v0.1.0");  // ✅ Goes to stderr, separate stream
```

Then in TypeScript:
```typescript
this.process.stdout?.on('data', this.handleStdout.bind(this));  // JSON-RPC only
this.process.stderr?.on('data', this.handleStderr.bind(this));  // Logs only
```

---

## Recommended Approach

**Short term** (JavaScript fix):
- Implement Option 1 (jsonrpc field check)
- Handles both JSON-RPC responses and non-JSON logs gracefully

**Long term** (Rust fix):
- Update Bindery server to use `eprintln!` for logs
- Keeps stdout clean for JSON-RPC only
- Better separation of concerns

---

## Implementation

**File to modify**: `plugins/VSCode/vespera-forge/src/services/bindery.ts`

**Lines**: 1002-1014

**Testing**:
1. Build extension: `npm run compile`
2. Launch Extension Development Host (F5)
3. Check console - should see `[Bindery] ...` logs instead of "unknown request ID"
