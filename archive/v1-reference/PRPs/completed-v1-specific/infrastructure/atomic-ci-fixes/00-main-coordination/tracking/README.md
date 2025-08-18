# Tracking Directory - Progress and Session Management

This directory tracks Meta-PRP execution progress and orchestrator sessions.

## Contents

**Manual Tracking**:

- `checklist.md` - Master tracking checklist (manually maintained)
- `milestone-notes.md` - Important milestones and decisions
- `issues-log.md` - Problems encountered and resolutions

**Session Management** (Auto-Generated):

- `session-logs/` - Orchestrator session records
- `progress-reports/` - Periodic progress summaries
- `artifacts/` - References to orchestrator artifacts

**Error Tracking** (As Needed):

- `errors/` - Error logs and recovery information
- `rollback-points/` - Known good states for recovery

## Session Management

Each orchestrator session creates a log file:

- `session_{id}_{timestamp}.json` - Full session record
- `session_{id}_artifacts.md` - Artifact references  
- `session_{id}_status.md` - Final status report

## Progress Reporting

**Frequency**: Progress reports generated:

- At the completion of each priority area
- When significant milestones are reached
- On request via orchestrator maintenance tools

**Format**: Reports include:

- Quantitative progress metrics
- Qualitative assessment of work quality
- Risk factors and mitigation strategies
- Resource utilization analysis

## Maintenance

**Regular Updates**:

- Update `checklist.md` as tasks complete
- Review and update `issues-log.md` when problems arise
- Archive completed session logs periodically

**Cleanup**: Old session logs moved to archives after meta-PRP completion

## Integration

**Orchestrator Tools**:

- Use `orchestrator_get_status` for current progress
- Use `orchestrator_maintenance_coordinator` for cleanup
- Reference orchestrator artifacts for detailed work records

**Cross-References**:

- Links to specific priority tracking directories
- References to main coordination status
- Connections to related meta-PRPs or planning documents
