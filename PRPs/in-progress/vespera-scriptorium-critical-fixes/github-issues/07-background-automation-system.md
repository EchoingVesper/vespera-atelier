# [MEDIUM] Implement background automation system for routine tasks

**Severity**: Medium (P2)  
**Component**: Architecture Enhancement  
**Orchestrator Task**: Will be linked to architecture agent task  
**Meta-PRP**: `PRPs/in-progress/vespera-scriptorium-critical-fixes/`

## 🏗️ Architecture Enhancement: Background Automation for Improved UX

## Problem Description

Currently, several routine tasks require explicit MCP tool calls that would be better handled automatically in the background. The audit identified multiple tools that should be converted from manual MCP tools to background automation for better user experience.

## Current Manual Operations That Should Be Automatic

### Session Management
- **Manual**: `orchestrator_cleanup_sessions` requires explicit user action
- **Should be**: Automatic cleanup after session inactivity threshold
- **Benefit**: Prevents database bloat without user intervention

### Template System  
- **Manual**: `template_install_default_library` requires explicit installation
- **Should be**: Auto-install default templates on first session initialization
- **Benefit**: New users get templates automatically without setup steps

### Health Monitoring
- **Manual**: `orchestrator_health_check` requires explicit calls
- **Should be**: Background monitoring with alert thresholds + manual override
- **Benefit**: Proactive issue detection with admin control when needed

### Validation Processes
- **Manual**: `template_validate_all` requires explicit validation calls  
- **Should be**: Automatic validation on template save/load operations
- **Benefit**: Always-valid templates without user maintenance

## Proposed Architecture

### Background Service System
```python
# Background automation framework
class BackgroundServiceManager:
    - session_cleanup_service: Auto-cleanup inactive sessions
    - template_installation_service: Auto-install on new workspaces  
    - health_monitoring_service: Continuous health checks
    - validation_service: Auto-validate on template operations
```

### Hybrid MCP + Background Approach
- **Keep MCP tools** for administrative override and explicit control
- **Add background processes** for routine automation
- **Provide configuration** to enable/disable background features

## Implementation Required

### Phase 1: Session Cleanup Automation
- **Background service**: Auto-cleanup sessions after configurable inactivity period
- **Configuration**: `auto_cleanup_after_hours` setting
- **MCP tool retention**: Keep manual cleanup for administrative control

### Phase 2: Template Auto-Installation  
- **Session initialization hook**: Auto-install default templates on new workspace detection
- **Smart detection**: Only install if no templates exist
- **User control**: Configuration to disable auto-installation

### Phase 3: Health Monitoring Background
- **Continuous monitoring**: Background health checks every N minutes
- **Alert thresholds**: Configurable warning/error conditions
- **MCP tool enhancement**: Manual health check still available for diagnostics

### Phase 4: Validation Hooks
- **Template save hooks**: Auto-validate on template creation/update
- **Load-time validation**: Validate templates on instantiation
- **Error handling**: Graceful degradation with user notification

## Benefits

### User Experience
- **Reduced cognitive load**: Less manual maintenance required
- **Automatic best practices**: System maintains itself
- **Faster onboarding**: New users get working system immediately

### System Reliability  
- **Proactive issue detection**: Problems caught before user impact
- **Consistent validation**: Always-valid templates and configurations
- **Resource management**: Automatic cleanup prevents bloat

### Developer Experience
- **Focus on core work**: Less time on system maintenance
- **Reliable automation**: Background processes handle routine tasks
- **Administrative control**: Manual override when needed

## Technical Context

- Files:
  - Background services: New `vespera_scriptorium/background/` module needed
  - Session management: `vespera_scriptorium/orchestrator/orchestration_state_manager.py`
  - Template system: `vespera_scriptorium/infrastructure/template_system/`
- Architecture: New background service layer + MCP tool enhancements
- Integration: Hook into session initialization and template operations

## Configuration Design

```yaml
# Background automation settings
background_automation:
  enabled: true
  session_cleanup:
    enabled: true
    inactive_threshold_hours: 24
  template_installation:
    enabled: true
    auto_install_defaults: true
  health_monitoring:
    enabled: true
    check_interval_minutes: 15
  validation_hooks:
    enabled: true
    auto_validate_templates: true
```

## Acceptance Criteria

- [ ] Background service framework implemented
- [ ] Session cleanup automation working
- [ ] Template auto-installation on new workspaces  
- [ ] Health monitoring background service with alerts
- [ ] Template validation hooks on save/load
- [ ] Configuration system for enabling/disabling features
- [ ] MCP tools retained for manual administrative control
- [ ] User documentation for background automation features

## Labels

`medium`, `enhancement`, `architecture`, `background-automation`, `user-experience`, `vespera-scriptorium`