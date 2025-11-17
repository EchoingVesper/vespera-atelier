# ADR-019: Logging Infrastructure & Error Handling Standardization

**Status**: Accepted
**Date**: 2025-01-16
**Deciders**: Development Team
**Related**: [Phase 18](../phases/PHASE_18_COMPLETE.md), [ADR-018](ADR-018-provider-system-unification.md)

## Context

Phase 17 and 17.5 identified critical issues with the logging and error handling systems:

1. **Console Spam**: "Critical Security Event" toasts appearing for normal operations
2. **Verbose Logging**: Excessive `console.log` and `eprintln!` statements cluttering console
3. **No Persistence**: Logs disappeared on extension reload, making debugging difficult
4. **Inconsistent Methods**: Multiple logging approaches (console.log, VesperaLogger, security audit)
5. **No User Control**: No way for users to adjust verbosity or filter logs
6. **Context Window Overhead**: Manual log copying for AI agents consumed context rapidly

These issues severely impacted developer experience and user satisfaction.

## Decision

We will implement a **comprehensive, event-driven logging infrastructure** with:

### 1. Event Bus Integration

**Decision**: Extend VesperaEventBus with 5 new logging event types.

**Rationale**:
- Loose coupling between logging and consumers
- Future log viewer can subscribe to events
- Enables log aggregation and search
- Consistent with existing event patterns

**Event Types**:
- `logEntryCreated` - Log messages with metadata
- `logLevelChanged` - Runtime verbosity changes
- `logFileRotated` - Maintenance events
- `criticalErrorOccurred` - User-facing errors
- `securityEventLogged` - Security audit events

### 2. File-Based Logging with Rotation

**Decision**: Implement persistent logging to `.vespera/logs/` with automatic rotation.

**Rationale**:
- Survives extension reloads and crashes
- Enables post-mortem debugging
- Reduces manual log copying overhead
- Follows industry standard practices

**Rotation Strategies**:
- `daily` - New file per day (default)
- `hourly` - New file per hour
- `size-based` - Rotate at configurable size threshold

**Retention Policy**:
- Configurable max files (default: 30 days)
- Automatic cleanup of old logs
- Sorted by modification time

### 3. Configuration-Driven System

**Decision**: Use JSON5 configuration files with VS Code settings integration.

**Rationale**:
- User-friendly settings UI in VS Code preferences
- File-based config for automation/deployment
- Hot-reload without extension restart
- Per-component log level control

**Configuration Hierarchy**:
1. VS Code settings (highest priority)
2. Workspace `.vespera/config/logging-config.json5`
3. User-level `~/.vespera/config/logging-config.json5`
4. Default configuration

### 4. Development Mode Auto-Detection

**Decision**: Use `context.extensionMode === vscode.ExtensionMode.Development` for mode detection.

**Rationale**:
- Reliable detection (no heuristics like "Insiders" in name)
- Native VS Code API
- Consistent across all logging components

**Behavior**:
- **Development**: Verbose logging, show security toasts, source locations
- **Production**: Info-level logging, suppress toasts, emit events only

### 5. Security Event Handling

**Decision**: Suppress security toast notifications in production, emit events always.

**Rationale**:
- Users don't need "Critical Security Event" for viewing chat channels
- Events still logged for forensics
- Future log viewer can show security tab
- Reduces alert fatigue

**Implementation**:
- VesperaSecurityAuditLogger accepts `suppressNotifications` option
- Emits `securityEventLogged` events regardless of mode
- Development mode shows toasts for debugging
- Production mode logs to file and event bus only

### 6. Per-Component Verbosity

**Decision**: Support component-specific log levels independent of global level.

**Rationale**:
- Debug specific components without noise from others
- Different teams can adjust their component verbosity
- Performance optimization (skip debug logs for stable components)

**Implementation**:
- `createChild(componentName)` creates child loggers
- Configuration specifies per-component levels
- Falls back to global level if component not configured

## Implementation

### File Structure

```
.vespera/
├── logs/
│   ├── frontend/
│   │   ├── vespera-forge-2025-01-16.log
│   │   ├── vespera-forge-bindery-2025-01-16.log  # Per-component
│   │   └── security-audit-2025-01-16.log
│   └── backend/
│       ├── bindery-2025-01-16.log
│       └── audit-2025-01-16.log
└── config/
    └── logging-config.json5
```

### Configuration Schema

```json5
{
  version: "1.0.0",
  levels: {
    global: "info",
    components: {
      bindery: "debug",
      security: "warn",
      aiAssistant: "info"
    }
  },
  outputs: {
    console: { enabled: true, userFacingOnly: true },
    file: { enabled: true, rotation: "daily", maxFiles: 30 },
    events: { enabled: true, minLevel: "warn" }
  },
  development: {
    autoEnable: true,
    verboseLogging: true,
    showSourceLocation: true
  },
  production: {
    suppressNotifications: true,
    samplingRate: 0.1
  }
}
```

### VS Code Settings

```json
"vesperaForge.logging.globalLevel": "info",
"vesperaForge.logging.enableFileLogging": true,
"vesperaForge.logging.fileRotationStrategy": "daily",
"vesperaForge.logging.maxLogFiles": 30,
"vesperaForge.logging.componentLevels": {
  "bindery": "debug",
  "security": "warn"
},
"vesperaForge.logging.suppressSecurityNotifications": false
```

### Code Changes

**New Files**:
- `src/core/logging/LoggingConfiguration.ts` - Type-safe configuration schema
- `src/core/logging/LoggingConfigurationManager.ts` - Configuration management with hot-reload

**Modified Files**:
- `src/utils/events.ts` - Added 5 logging event types
- `src/core/logging/VesperaLogger.ts` - File logging, rotation, event emission
- `src/core/security/audit/VesperaSecurityAuditLogger.ts` - Suppress notifications, emit events
- `package.json` - VS Code settings contributions

## Consequences

### Positive

1. **User Experience**: No more annoying security toasts in production
2. **Debuggability**: Persistent logs survive crashes and reloads
3. **Performance**: Per-component levels reduce noise, sampling in production
4. **Flexibility**: Users can adjust verbosity without code changes
5. **Future-Proof**: Event bus enables log viewer and aggregation
6. **AI-Friendly**: Structured logs in atomic files reduce context overhead

### Negative

1. **Disk Usage**: Log files consume disk space (mitigated by rotation/retention)
2. **Complexity**: More moving parts (config manager, file rotation, event bus)
3. **Migration**: Existing code using raw console.log needs gradual refactoring

### Neutral

1. **Configuration Overhead**: Users must understand logging concepts
2. **Two Config Sources**: File-based and VS Code settings can be confusing

## Alternatives Considered

### Alternative 1: Use Third-Party Logging Library

**Considered**: winston, pino, bunyan

**Rejected Because**:
- Heavy dependencies
- Overkill for extension use case
- Doesn't integrate with VS Code Output Channel
- No event bus integration

### Alternative 2: Single Global Log Level

**Considered**: One verbosity setting for all components

**Rejected Because**:
- Can't debug specific components without noise
- All-or-nothing approach too coarse
- Performance impact when debugging one component

### Alternative 3: Always Show Security Toasts

**Considered**: Keep current behavior

**Rejected Because**:
- User complaints about alert fatigue
- "Critical Security Event" for normal operations is misleading
- Production users don't need security debugging info

## Notes

### Future Enhancements

1. **Log Viewer UI**: WebView panel for browsing/searching logs
2. **Log Streaming**: Real-time log following in UI
3. **Remote Logging**: Send logs to external service
4. **PII Redaction**: Automatic scrubbing of sensitive data
5. **Sampling Strategies**: Adaptive sampling based on error rates

### Migration Plan

**Phase 18** (Current):
- ✅ Core infrastructure
- ✅ Event bus integration
- ✅ File logging with rotation
- ✅ VS Code settings
- ⏸️ Gradual console.log refactoring (deferred)

**Phase 19+** (Future):
- Log viewer UI
- Comprehensive console.log standardization
- Request correlation IDs
- Performance monitoring integration

### Related Issues

- Fixes: Phase 17 "Intermittent Critical Security Errors"
- Fixes: Phase 17 "Verbose Console Logging"
- Enables: Future log viewer (Issue #37)
- Enables: Better debugging workflow

## References

- [VesperaEventBus](../../packages/vespera-forge/src/utils/events.ts)
- [LoggingConfiguration](../../packages/vespera-forge/src/core/logging/LoggingConfiguration.ts)
- [Phase 18 Complete](../phases/PHASE_18_COMPLETE.md)
- [VS Code Extension Guide - Output Channels](https://code.visualstudio.com/api/extension-guides/output-channel)
