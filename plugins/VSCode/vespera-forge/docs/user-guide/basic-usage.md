---
title: Basic Usage Guide
category: user-guide
difficulty: beginner
time_estimate: "15 minutes"
prerequisites: ["installation.md"]
last_updated: 2025-01-09
---

# Basic Usage Guide

## Getting Started Workflow

### Opening Vespera Forge

After [installation](installation.md), access Vespera Forge through multiple entry points:

1. **Activity Bar**: Click the Vespera Forge icon (🌟) in the left sidebar
2. **Command Palette**: `Ctrl+Shift+P` → `Vespera Forge: Open Task Manager`  
3. **Status Bar**: Click the connection indicator or task counter

### Initial Interface Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ 🌟 VESPERA FORGE                                               │
├─────────────────────────────────────────────────────────────────┤
│ 📋 TASK TREE                                                   │
│ ├─ 🔄 Implement user authentication (3 subtasks)              │
│ ├─ 📝 Design user interface                                   │  
│ └─ ✅ Setup project structure                                 │
├─────────────────────────────────────────────────────────────────┤
│ 📊 TASK DASHBOARD                                             │
│ │ Total Tasks: 12  │ Completed: 4  │ In Progress: 3         │
│ │ Status Breakdown │ Priority View │ Recent Activity        │
└─────────────────────────────────────────────────────────────────┘
```

## Core Task Management

### Creating Your First Task

**Method 1: Quick Creation via Status Bar**
1. Click `+ New Task` in the status bar
2. Enter task title: "Setup development environment"
3. Press `Enter` to create

**Method 2: Command Palette Creation**
1. Open Command Palette (`Ctrl+Shift+P`)
2. Run `Vespera Forge: Create Content`  
3. Fill in the creation form:
   ```
   Title: Setup development environment
   Description: Install Node.js, VS Code extensions, and configure Git
   Priority: High
   Tags: setup, development, environment
   ```
4. Click `Create Task`

**Method 3: Dashboard Creation**
1. Open Task Dashboard in the Vespera Forge panel
2. Click `+ New Task` button
3. Use the rich form interface:
   - **Title**: Required field
   - **Description**: Markdown supported
   - **Priority**: Critical/High/Normal/Low/Someday
   - **Tags**: Comma-separated
   - **Due Date**: Date picker (optional)
   - **Parent Task**: Select from dropdown

### Task Hierarchy and Organization

**Creating Subtasks**:
1. Right-click any task in the Task Tree
2. Select `Create Subtask`
3. Enter subtask title
4. The subtask appears nested under the parent

**Example Task Structure**:
```
🔄 Implement user authentication
├─ 📝 Design authentication flow  
├─ ⚙️ Setup JWT token handling
├─ 🔐 Implement login/logout endpoints
└─ 🧪 Write authentication tests
```

### Task Status Management

**Status Workflow**:
```
📋 Todo → 🔄 Doing → 👁️ Review → ✅ Done
     ↓         ↓         ↓
   🚫 Cancelled ← ⛔ Blocked ← 📁 Archived
```

**Changing Task Status**:

**Quick Status Change**:
1. Right-click task in Tree View
2. Select `Complete Task` (for Todo/Doing tasks)
3. Task automatically moves to `Done` status

**Dashboard Status Change**:
1. Open task in Dashboard
2. Use status dropdown to select new status
3. Changes save automatically

**Keyboard Shortcuts** (in Tree View):
- `Space`: Toggle between Todo ↔ Done
- `Enter`: Open task details
- `Delete`: Delete selected task (with confirmation)

### Task Priority System

**Priority Levels**:
- 🔴 **Critical**: Urgent, blocking issues  
- 🟡 **High**: Important, time-sensitive
- ⚪ **Normal**: Regular workflow items (default)
- 🔵 **Low**: Nice-to-have improvements
- 🌫️ **Someday**: Future considerations

**Visual Indicators**:
- Task icons use priority colors
- Tree View shows priority in descriptions
- Dashboard includes priority filtering

**Setting Priority**:
1. Right-click task → `Edit Task` 
2. Select priority from dropdown
3. Or use Dashboard task editor

### Tagging and Labels

**Adding Tags**:
```
Tags: frontend, react, authentication, urgent
```

**Tag Benefits**:
- **Filtering**: Find all `frontend` tasks quickly
- **Organization**: Group related tasks
- **Context**: Add additional metadata
- **Search**: Locate tasks by keyword

**Using Tags in Dashboard**:
1. Filter by tags using the search box
2. Click tag buttons for quick filtering
3. Create saved tag filters for common queries

## Working with the Task Tree

### Navigation and Interaction

**Tree View Features**:
- **Expand/Collapse**: Click arrows to show/hide subtasks
- **Icons**: Status indicators with priority colors
- **Context Menus**: Right-click for actions
- **Tooltips**: Hover for detailed task information

**Tooltip Information**:
```
📋 Setup development environment

Status: Doing
Priority: High  
Assignee: John Doe
Due: 2025-01-15
Tags: setup, development

Created: 2025-01-09 10:30 AM
Updated: 2025-01-09 02:15 PM
Subtasks: 4
```

### Task Tree Actions

**Right-Click Context Menu**:
- `Create Subtask`: Add child task
- `Complete Task`: Mark as done (if Todo/Doing)
- `Edit Task`: Open in Dashboard editor
- `Delete Task`: Remove task (with confirmation)
- `Copy Task ID`: Copy unique identifier
- `Export Task`: Save as Markdown

**Bulk Operations** (planned feature):
- Select multiple tasks with `Ctrl+Click`
- Apply status changes to selection
- Bulk tagging and priority changes

### Filtering and Search

**Tree View Filtering**:
- Use search box at top of Tree View
- Filter by status, priority, or tags
- Show/hide completed tasks toggle

**Search Examples**:
```
priority:high            # Show only high priority tasks
status:doing             # Show tasks in progress
tag:frontend             # Show tasks tagged 'frontend'
@john                   # Show tasks assigned to John
due:today               # Show tasks due today
```

## Using the Task Dashboard

### Dashboard Overview

The Task Dashboard provides rich analytics and interactive task management:

**Main Sections**:
1. **Metrics Overview**: Task counts and completion rates
2. **Status Breakdown**: Visual distribution of task statuses  
3. **Priority Analysis**: Priority-based task organization
4. **Recent Activity**: Latest task updates and changes
5. **Quick Actions**: Common task operations

### Task Creation Form

**Rich Task Editor**:
```html
┌─────────────────────────────────────┐
│ 📝 New Task                        │
├─────────────────────────────────────┤
│ Title: [Implement search feature  ] │
│                                     │
│ Description:                        │
│ ┌─────────────────────────────────┐ │
│ │ Add full-text search capability│ │
│ │ with filters and sorting       │ │  
│ └─────────────────────────────────┘ │
│                                     │
│ Priority: [High        ▼]          │
│ Tags: [search, feature, backend   ] │
│ Due Date: [2025-01-20   📅]        │
│ Parent Task: [Select parent... ▼]  │
│                                     │
│ [Cancel] [Create Task]              │
└─────────────────────────────────────┘
```

**Markdown Support**:
The description field supports Markdown formatting:
```markdown
## Implementation Plan

- [ ] Design search API
- [ ] Implement indexing
- [ ] Add UI components
- [ ] Write tests

**Technical Notes:**
- Use Elasticsearch for indexing
- Implement debounced search input
```

### Analytics and Insights

**Completion Metrics**:
- Total tasks: 24
- Completed: 8 (33%)
- In Progress: 6 (25%)
- Pending: 10 (42%)

**Time-based Analysis**:
- Average completion time: 2.5 days
- Tasks completed this week: 12
- Overdue tasks: 2

**Priority Distribution**:
```
Critical: ████ 4 tasks
High:     ████████ 8 tasks  
Normal:   ██████████████ 14 tasks
Low:      ██ 2 tasks
```

### Interactive Features

**Progress Visualization**:
- Real-time progress bars
- Completion trend charts  
- Status distribution pie charts
- Timeline views (planned)

**Quick Actions**:
- `Create Task`: Launch creation form
- `Bulk Complete`: Mark multiple tasks done
- `Archive Old`: Archive completed tasks
- `Export Report`: Generate task summary

## Status Bar Integration

### Status Indicators

**Connection Status**:
- 🟢 `✅ Bindery Connected`: Full backend functionality
- 🟡 `🔄 Connecting...`: Backend connection in progress  
- 🔴 `❌ Bindery Offline`: Using mock mode
- 🟠 `⚠️ Connection Error`: Backend communication failed

**Task Counter**:
- `📋 8 tasks`: Shows active (non-completed) tasks
- Click to open Task Tree View
- Hover for breakdown by status

**Quick Actions**:
- `+ New Task`: Instant task creation
- Updates automatically as tasks change

### Status Bar Usage

**Monitoring Workflow**:
1. Glance at task counter for current workload
2. Check connection status for backend health
3. Use quick actions for immediate task creation
4. Click indicators to open relevant views

## Keyboard Shortcuts and Efficiency

### Global Shortcuts

**Command Palette Integration**:
- `Ctrl+Shift+P` → Type "Vespera" for all commands
- Pin frequently used commands for quick access

**Essential Commands**:
```
Vespera Forge: Initialize Vespera Forge
Vespera Forge: Create Content  
Vespera Forge: Open Task Manager
Vespera Forge: Open Task Dashboard
Vespera Forge: Configure Bindery
```

### Tree View Navigation

**Keyboard Navigation**:
- `↑/↓`: Navigate between tasks
- `→`: Expand task (show subtasks)  
- `←`: Collapse task (hide subtasks)
- `Enter`: Open task details
- `Space`: Toggle task completion
- `Delete`: Delete selected task

**Mouse Interactions**:
- `Click`: Select task
- `Double-click`: Open task details
- `Right-click`: Context menu
- `Hover`: Show tooltip

### Productivity Tips

**Efficient Task Entry**:
1. Use Status Bar `+ New Task` for quick capture
2. Add tags during creation for better organization
3. Set priorities to focus on important work
4. Use parent tasks to group related work

**Workflow Optimization**:
1. Check Dashboard metrics weekly for insights
2. Use priority filtering to focus on urgent tasks
3. Archive completed tasks to reduce clutter
4. Set due dates for time-sensitive work

## Data Management

### Task Persistence

**Mock Mode** (default):
- Tasks stored in memory during VS Code session
- Data resets when VS Code restarts
- Perfect for testing and quick task capture

**Bindery Backend** (full features):
- Persistent task storage across sessions
- Real-time synchronization across devices
- Full backup and recovery capabilities

### Import/Export

**Markdown Export**:
1. Right-click task → `Export Task`
2. Saves as structured Markdown file
3. Includes all metadata and subtasks

**Example Export**:
```markdown
# Setup development environment

**Status:** Doing  
**Priority:** High
**Tags:** setup, development, environment
**Created:** 2025-01-09 10:30 AM

## Description

Install Node.js, VS Code extensions, and configure Git for optimal development workflow.

## Subtasks

- [x] Install Node.js 18+
- [ ] Configure VS Code extensions
- [ ] Setup Git configuration  
- [ ] Create project structure
```

### Backup and Recovery

**Manual Backup** (Bindery mode):
- Task data automatically persisted
- Backend handles backup strategies
- No user action required

**Export Backup** (Mock mode):
- Export all tasks before VS Code restart
- Re-import using task creation workflow
- Consider upgrading to Bindery backend

## Troubleshooting Common Usage Issues

### Task Creation Problems

**Issue**: "Task creation failed"
**Solutions**:
1. Check connection status in status bar
2. Verify task title is not empty
3. Try creating via different method (Dashboard vs Tree)
4. Restart extension: `Ctrl+Shift+P` → `Developer: Reload Window`

### UI Not Responding

**Issue**: Tree View or Dashboard not updating
**Solutions**:
1. Manual refresh: Click refresh button in Tree View
2. Check backend connection status
3. Wait for auto-refresh (30-second intervals)
4. Restart VS Code if issues persist

### Performance Issues

**Issue**: Extension running slowly
**Solutions**:
1. Check task count (performance degrades >1000 tasks)
2. Archive completed tasks regularly
3. Disable auto-start if not needed
4. Monitor VS Code memory usage

## Next Steps

**Explore Advanced Features**:
1. **[Features Overview](features.md)** - Complete feature reference
2. **[API Integration](../api/bindery-service.md)** - Programmatic usage  
3. **[Development Setup](../development/getting-started.md)** - Contribute to the project

**Optimize Your Workflow**:
1. Experiment with different task organization strategies
2. Use tags and priorities to match your workflow
3. Set up custom keyboard shortcuts for frequent actions
4. Consider Bindery backend for persistent task management

---

**Congratulations!** You now understand the core functionality of Vespera Forge. With these basics mastered, you're ready to revolutionize your task management workflow using AI-enhanced orchestration directly within VS Code.