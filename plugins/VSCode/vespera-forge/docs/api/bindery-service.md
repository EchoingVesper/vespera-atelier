---
title: Bindery Service API Reference
category: reference
complexity: advanced
last_updated: 2025-01-09
---

# Bindery Service API Reference

## Overview

The `BinderyService` class provides the primary interface for communicating with the Rust Bindery backend, offering comprehensive task orchestration, CRDT collaboration, and hook system integration.

## Service Architecture

```typescript
import { BinderyService } from '../services/bindery';

// Singleton access pattern
const binderyService = getBinderyService();

// Configuration with options
const binderyService = getBinderyService({
  binderyPath: '/path/to/bindery-server',
  enableLogging: true,
  connectionTimeout: 10000,
  maxRetries: 5
});
```

## Class Definition

### Constructor and Configuration

```typescript
interface BinderyServiceConfig {
  binderyPath?: string;        // Custom path to Bindery executable
  workspaceRoot?: string;      // Workspace directory for relative paths
  enableLogging?: boolean;     // Enable debug logging (default: true)
  connectionTimeout?: number;  // Request timeout in ms (default: 5000)
  maxRetries?: number;         // Connection retry attempts (default: 3)
  retryDelay?: number;         // Delay between retries in ms (default: 1000)
}

class BinderyService extends EventEmitter {
  constructor(config?: Partial<BinderyServiceConfig>);
}
```

### Connection Management

#### `initialize(): Promise<BinderyResult<VersionInfo>>`

Establishes connection to the Bindery backend.

**Parameters**: None

**Returns**: 
```typescript
interface BinderyResult<T> {
  success: boolean;
  data?: T;
  error?: BinderyError;
}

interface VersionInfo {
  version: string;
  build_target: string;
  build_profile: string;
  features: string;
}
```

**Example**:
```typescript
const binderyService = getBinderyService();
const initResult = await binderyService.initialize();

if (initResult.success) {
  console.log('Connected to Bindery:', initResult.data?.version);
} else {
  console.error('Connection failed:', initResult.error?.message);
}
```

**Behavior**:
- Searches for Bindery executable in configured paths
- Spawns subprocess with JSON-RPC communication
- Establishes connection handshake
- Emits `statusChanged` events during connection process
- Falls back to mock mode if backend unavailable

#### `disconnect(): Promise<void>`

Cleanly closes connection to Bindery backend.

**Parameters**: None

**Returns**: `Promise<void>`

**Example**:
```typescript
await binderyService.disconnect();
console.log('Bindery connection closed');
```

**Behavior**:
- Cancels all pending requests
- Sends SIGTERM to backend process
- Force kills process after 3-second timeout
- Updates connection status to Disconnected

#### `getConnectionInfo(): BinderyConnectionInfo`

Returns current connection status information.

**Returns**:
```typescript
interface BinderyConnectionInfo {
  status: BinderyConnectionStatus;
  version?: VersionInfo;
  connected_at?: string;
  process_id?: number;
  last_error?: string;
}

enum BinderyConnectionStatus {
  Disconnected = 'disconnected',
  Connecting = 'connecting', 
  Connected = 'connected',
  Error = 'error'
}
```

**Example**:
```typescript
const info = binderyService.getConnectionInfo();
console.log(`Status: ${info.status}`);
if (info.connected_at) {
  console.log(`Connected since: ${info.connected_at}`);
}
```

#### `isConnected(): boolean`

Quick check for active backend connection.

**Returns**: `boolean`

**Example**:
```typescript
if (binderyService.isConnected()) {
  // Proceed with backend operations
} else {
  // Handle offline mode
}
```

## Task Management API

### Task CRUD Operations

#### `createTask(input: TaskInput): Promise<BinderyResult<CodexId>>`

Creates a new task with specified properties.

**Parameters**:
```typescript
interface TaskInput {
  title: string;                    // Task title (required)
  description: string;              // Markdown description
  parent_id?: CodexId;             // Parent task for hierarchy
  priority?: TaskPriority;         // Task priority level
  due_date?: string;               // ISO 8601 due date
  tags: string[];                  // Task tags for organization
  labels: Record<string, string>;  // Key-value metadata
  subtasks: TaskInput[];           // Nested subtask definitions
}

enum TaskPriority {
  Critical = 'Critical',
  High = 'High', 
  Normal = 'Normal',
  Low = 'Low',
  Someday = 'Someday'
}

type CodexId = string; // Unique task identifier
```

**Returns**: `Promise<BinderyResult<CodexId>>`

**Example**:
```typescript
const taskInput: TaskInput = {
  title: 'Implement user authentication',
  description: '# Authentication System\n\nImplement JWT-based authentication with:\n- Login/logout endpoints\n- Token refresh mechanism\n- Password security',
  priority: TaskPriority.High,
  due_date: '2025-01-20T23:59:59Z',
  tags: ['auth', 'backend', 'security'],
  labels: {
    'epic': 'user-management',
    'team': 'backend-team',
    'estimate': '5 days'
  },
  subtasks: [
    {
      title: 'Design authentication flow',
      description: 'Create sequence diagrams and API specs',
      tags: ['design', 'documentation'],
      labels: {},
      subtasks: []
    },
    {
      title: 'Implement JWT tokens', 
      description: 'Token generation, validation, and refresh',
      tags: ['implementation', 'security'],
      labels: {},
      subtasks: []
    }
  ]
};

const result = await binderyService.createTask(taskInput);
if (result.success) {
  const taskId = result.data;
  console.log('Task created:', taskId);
} else {
  console.error('Failed to create task:', result.error?.message);
}
```

#### `getTask(taskId: CodexId): Promise<BinderyResult<TaskSummary>>`

Retrieves complete task information by ID.

**Parameters**:
- `taskId`: Unique task identifier

**Returns**:
```typescript
interface TaskSummary {
  id: CodexId;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee?: string;
  due_date?: string;
  created_at: string;
  updated_at: string;
  tags: string[];
  child_count: number;
  parent_id?: CodexId;
}

enum TaskStatus {
  Todo = 'Todo',
  Doing = 'Doing',
  Review = 'Review', 
  Done = 'Done',
  Blocked = 'Blocked',
  Cancelled = 'Cancelled',
  Archived = 'Archived'
}
```

**Example**:
```typescript
const result = await binderyService.getTask('task_123456');
if (result.success) {
  const task = result.data;
  console.log(`Task: ${task.title}`);
  console.log(`Status: ${task.status}`);
  console.log(`Priority: ${task.priority}`);
  console.log(`Subtasks: ${task.child_count}`);
} else {
  console.error('Task not found:', result.error?.message);
}
```

#### `updateTask(input: TaskUpdateInput): Promise<BinderyResult<TaskSummary>>`

Updates existing task properties.

**Parameters**:
```typescript
interface TaskUpdateInput {
  task_id: CodexId;                // Task to update (required)
  title?: string;                  // New task title
  description?: string;            // New task description  
  status?: TaskStatus;             // New task status
  priority?: TaskPriority;         // New task priority
  assignee?: string;               // Task assignee
  due_date?: string;               // New due date (ISO 8601)
  tags?: string[];                 // Replace all tags
  labels?: Record<string, string>; // Replace all labels
}
```

**Returns**: `Promise<BinderyResult<TaskSummary>>`

**Example**:
```typescript
// Update task status and priority
const updateResult = await binderyService.updateTask({
  task_id: 'task_123456',
  status: TaskStatus.Doing,
  priority: TaskPriority.Critical
});

// Partial update with new description
const descriptionUpdate = await binderyService.updateTask({
  task_id: 'task_123456', 
  description: '# Updated Requirements\n\nAdded new security requirements:\n- 2FA support\n- Rate limiting'
});

// Add task assignment
const assignmentUpdate = await binderyService.updateTask({
  task_id: 'task_123456',
  assignee: '@alice',
  tags: ['auth', 'backend', 'security', 'assigned']
});
```

#### `deleteTask(taskId: CodexId, deleteSubtasks?: boolean): Promise<BinderyResult<boolean>>`

Removes task from the system.

**Parameters**:
- `taskId`: Task to delete
- `deleteSubtasks`: Whether to delete child tasks (default: false)

**Returns**: `Promise<BinderyResult<boolean>>`

**Example**:
```typescript
// Delete task only (subtasks become orphaned)
const result = await binderyService.deleteTask('task_123456', false);

// Delete task and all subtasks
const cascadeResult = await binderyService.deleteTask('task_123456', true);

if (result.success) {
  console.log('Task deleted successfully');
} else {
  console.error('Deletion failed:', result.error?.message);
}
```

### Task Query and Filtering

#### `listTasks(filters?: TaskListFilters): Promise<BinderyResult<TaskSummary[]>>`

Retrieves filtered list of tasks.

**Parameters**:
```typescript
interface TaskListFilters {
  project_id?: string;      // Filter by project
  parent_id?: CodexId;      // Filter by parent task
  status_filter?: string;   // Filter by status
  priority_filter?: string; // Filter by priority  
  assignee?: string;        // Filter by assignee
  limit?: number;          // Maximum results (default: 100)
}
```

**Returns**: `Promise<BinderyResult<TaskSummary[]>>`

**Example**:
```typescript
// Get all root tasks (no parent)
const rootTasks = await binderyService.listTasks({ 
  parent_id: undefined 
});

// Get high priority tasks in progress
const urgentTasks = await binderyService.listTasks({
  status_filter: 'Doing',
  priority_filter: 'High'
});

// Get tasks assigned to specific user
const myTasks = await binderyService.listTasks({
  assignee: '@john',
  limit: 50
});

// Get subtasks of specific parent
const subtasks = await binderyService.listTasks({
  parent_id: 'task_123456'
});
```

#### `getTaskDashboard(projectId?: string): Promise<BinderyResult<TaskDashboard>>`

Retrieves comprehensive task analytics and metrics.

**Parameters**:
- `projectId`: Optional project scope filter

**Returns**:
```typescript
interface TaskDashboard {
  total_tasks: number;
  status_breakdown: Record<TaskStatus, number>;
  priority_breakdown: Record<TaskPriority, number>;
  recent_tasks: TaskSummary[];
  overdue_tasks: TaskSummary[];
  upcoming_tasks: TaskSummary[];
  project_breakdown: Record<string, number>;
  completion_rate: number;              // Percentage (0-100)
  average_completion_time: number | null; // Days
}
```

**Example**:
```typescript
const dashboard = await binderyService.getTaskDashboard();
if (dashboard.success) {
  const data = dashboard.data;
  
  console.log(`Total tasks: ${data.total_tasks}`);
  console.log(`Completion rate: ${data.completion_rate}%`);
  console.log(`Overdue tasks: ${data.overdue_tasks.length}`);
  
  // Status breakdown
  Object.entries(data.status_breakdown).forEach(([status, count]) => {
    console.log(`${status}: ${count} tasks`);
  });
  
  // Recent activity
  data.recent_tasks.forEach(task => {
    console.log(`Recent: ${task.title} (${task.status})`);
  });
}
```

## Hierarchical Task Management

### Task Tree Operations

#### `createTaskTree(treeTitle: string, treeDescription: string, subtasks: TaskInput[], projectId?: string): Promise<BinderyResult<CodexId>>`

Creates a complete hierarchical task structure in a single operation.

**Parameters**:
- `treeTitle`: Root task title
- `treeDescription`: Root task description
- `subtasks`: Array of subtask definitions
- `projectId`: Optional project association

**Returns**: `Promise<BinderyResult<CodexId>>` (root task ID)

**Example**:
```typescript
const treeResult = await binderyService.createTaskTree(
  'E-commerce Platform Development',
  'Complete e-commerce platform with user management, product catalog, and payment processing',
  [
    {
      title: 'User Authentication System',
      description: 'JWT-based authentication with role management',
      priority: TaskPriority.High,
      tags: ['auth', 'backend'],
      labels: { 'team': 'backend' },
      subtasks: [
        {
          title: 'Login/Logout API',
          description: 'REST endpoints for authentication',
          tags: ['api', 'auth'],
          labels: {},
          subtasks: []
        },
        {
          title: 'Password Security',
          description: 'Hashing, validation, and reset functionality',
          tags: ['security', 'auth'],
          labels: {},
          subtasks: []
        }
      ]
    },
    {
      title: 'Product Catalog',
      description: 'Product listing, search, and management',
      priority: TaskPriority.Normal,
      tags: ['catalog', 'frontend'],
      labels: { 'team': 'frontend' },
      subtasks: [
        {
          title: 'Product Search',
          description: 'Full-text search with filters',
          tags: ['search', 'frontend'],
          labels: {},
          subtasks: []
        }
      ]
    }
  ],
  'ecommerce-project'
);

if (treeResult.success) {
  console.log('Task tree created with root ID:', treeResult.data);
}
```

#### `getTaskTree(taskId: CodexId, maxDepth?: number): Promise<BinderyResult<TaskTree>>`

Retrieves hierarchical task structure with relationships.

**Parameters**:
- `taskId`: Root task ID
- `maxDepth`: Maximum depth to traverse (default: 5)

**Returns**:
```typescript
interface TaskTree {
  task: TaskSummary;
  children: TaskTree[];
  depth: number;
  path: CodexId[];
}
```

**Example**:
```typescript
const treeResult = await binderyService.getTaskTree('root_task_123', 3);
if (treeResult.success) {
  const tree = treeResult.data;
  
  // Recursive function to display tree structure
  function displayTree(node: TaskTree, indent = '') {
    console.log(`${indent}${node.task.title} (${node.task.status})`);
    node.children.forEach(child => {
      displayTree(child, indent + '  ');
    });
  }
  
  displayTree(tree);
}
```

## Role-Based Task Execution

### Role Management

#### `listRoles(): Promise<BinderyResult<Role[]>>`

Retrieves all available execution roles.

**Returns**:
```typescript
interface Role {
  name: string;
  description: string;
  capabilities: string[];
  file_patterns: string[];
  restricted_paths: string[];
}
```

**Example**:
```typescript
const rolesResult = await binderyService.listRoles();
if (rolesResult.success) {
  rolesResult.data.forEach(role => {
    console.log(`Role: ${role.name}`);
    console.log(`Description: ${role.description}`);
    console.log(`Capabilities: ${role.capabilities.join(', ')}`);
    console.log(`File patterns: ${role.file_patterns.join(', ')}`);
  });
}
```

#### `assignRoleToTask(taskId: CodexId, roleName: string): Promise<BinderyResult<void>>`

Assigns execution role to a task for capability-restricted execution.

**Parameters**:
- `taskId`: Task to assign role to
- `roleName`: Name of role to assign

**Returns**: `Promise<BinderyResult<void>>`

**Example**:
```typescript
// Assign backend role to database task
await binderyService.assignRoleToTask('db_task_123', 'backend-developer');

// Assign frontend role to UI task
await binderyService.assignRoleToTask('ui_task_456', 'frontend-developer');

// Assign architect role for system design task
await binderyService.assignRoleToTask('design_task_789', 'solution-architect');
```

### Task Execution

#### `executeTask(taskId: CodexId, dryRun?: boolean): Promise<BinderyResult<TaskExecutionResult>>`

Executes task with assigned role capabilities.

**Parameters**:
- `taskId`: Task to execute
- `dryRun`: Preview execution without making changes (default: false)

**Returns**:
```typescript
interface TaskExecutionResult {
  task_id: CodexId;
  execution_status: 'Success' | 'Failed' | 'Blocked';
  output?: string;
  error_message?: string;
  files_modified: string[];
  execution_time_ms: number;
  role_used: string;
}
```

**Example**:
```typescript
// Dry run execution (preview)
const dryRunResult = await binderyService.executeTask('task_123', true);
if (dryRunResult.success) {
  console.log('Dry run completed:', dryRunResult.data.output);
  console.log('Would modify files:', dryRunResult.data.files_modified);
}

// Actual execution
const execResult = await binderyService.executeTask('task_123', false);
if (execResult.success) {
  const result = execResult.data;
  console.log(`Execution ${result.execution_status}`);
  console.log(`Time: ${result.execution_time_ms}ms`);
  console.log(`Role: ${result.role_used}`);
  
  if (result.files_modified.length > 0) {
    console.log('Modified files:', result.files_modified);
  }
} else {
  console.error('Execution failed:', execResult.error?.message);
}
```

#### `completeTask(taskId: CodexId, output?: string, artifacts?: string[]): Promise<BinderyResult<TaskSummary>>`

Marks task as completed with optional output and artifacts.

**Parameters**:
- `taskId`: Task to complete
- `output`: Completion notes or results
- `artifacts`: Array of file paths or URLs created

**Returns**: `Promise<BinderyResult<TaskSummary>>`

**Example**:
```typescript
const completionResult = await binderyService.completeTask(
  'task_123',
  '# Task Completed\n\nImplemented authentication system with:\n- JWT token generation\n- Password hashing\n- Login/logout endpoints\n\n## Testing\n- All unit tests pass\n- Integration tests validated',
  [
    './src/auth/jwt-service.ts',
    './src/auth/password-utils.ts', 
    './src/routes/auth-routes.ts',
    './tests/auth.test.ts'
  ]
);

if (completionResult.success) {
  console.log('Task completed:', completionResult.data.title);
  console.log('Status:', completionResult.data.status); // Should be 'Done'
}
```

## Dependency Management

#### `analyzeTaskDependencies(taskId: CodexId): Promise<BinderyResult<DependencyAnalysis>>`

Analyzes task dependencies and potential blocking relationships.

**Parameters**:
- `taskId`: Task to analyze

**Returns**:
```typescript
interface DependencyAnalysis {
  task_id: CodexId;
  depends_on: CodexId[];           // Tasks this task depends on
  blocks: CodexId[];               // Tasks blocked by this task
  dependency_chain: CodexId[];     // Full dependency path
  circular_dependencies: CodexId[]; // Circular dependency detection
  estimated_completion: string;     // Projected completion date
  critical_path: boolean;          // Is on critical path
}
```

**Example**:
```typescript
const analysisResult = await binderyService.analyzeTaskDependencies('task_123');
if (analysisResult.success) {
  const analysis = analysisResult.data;
  
  console.log(`Task depends on: ${analysis.depends_on.length} tasks`);
  console.log(`Task blocks: ${analysis.blocks.length} tasks`);
  
  if (analysis.circular_dependencies.length > 0) {
    console.warn('Circular dependencies detected:', analysis.circular_dependencies);
  }
  
  if (analysis.critical_path) {
    console.log('⚠️ Task is on critical path');
  }
  
  console.log(`Estimated completion: ${analysis.estimated_completion}`);
}
```

## Codex Management API

### Content Operations

#### `createCodex(title: string, templateId: string): Promise<BinderyResult<CodexId>>`

Creates new Codex content with specified template.

**Parameters**:
- `title`: Codex title
- `templateId`: Template identifier for content structure

**Returns**: `Promise<BinderyResult<CodexId>>`

#### `getCodex(codexId: CodexId): Promise<BinderyResult<Codex>>`

Retrieves Codex content and metadata.

**Parameters**:
- `codexId`: Codex identifier

**Returns**:
```typescript
interface Codex {
  id: CodexId;
  title: string;
  content: string;
  template_id: string;
  created_at: string;
  updated_at: string;
  metadata: Record<string, any>;
}
```

#### `listCodeices(): Promise<BinderyResult<CodexId[]>>`

Lists all available Codex identifiers.

**Returns**: `Promise<BinderyResult<CodexId[]>>`

#### `deleteCodex(codexId: CodexId): Promise<BinderyResult<boolean>>`

Removes Codex from system.

**Parameters**:
- `codexId`: Codex to delete

**Returns**: `Promise<BinderyResult<boolean>>`

## Hook System Integration

### Hook Agent Management

#### `getHookAgentStatus(): Promise<BinderyResult<HookAgentStatus>>`

Retrieves status of all hook agents and timed agents.

**Returns**:
```typescript
interface HookAgentStatus {
  hook_agents: HookAgent[];
  timed_agents: TimedAgent[];
}

interface HookAgent {
  id: string;
  template_id: string;
  template_name: string;
  trigger_conditions: Record<string, any>;
  last_execution?: string;
  execution_count: number;
  status: 'Active' | 'Paused' | 'Error';
}

interface TimedAgent {
  id: string;
  template_id: string;
  template_name: string;
  schedule_config: Record<string, any>;
  next_execution: string;
  last_execution?: string;
  execution_count: number;
  status: 'Active' | 'Paused' | 'Error';
}
```

**Example**:
```typescript
const statusResult = await binderyService.getHookAgentStatus();
if (statusResult.success) {
  const status = statusResult.data;
  
  console.log(`Active hook agents: ${status.hook_agents.length}`);
  status.hook_agents.forEach(agent => {
    console.log(`- ${agent.template_name}: ${agent.execution_count} executions`);
  });
  
  console.log(`Active timed agents: ${status.timed_agents.length}`);
  status.timed_agents.forEach(agent => {
    console.log(`- ${agent.template_name}: next at ${agent.next_execution}`);
  });
}
```

#### `triggerHookAgent(input: HookTriggerInput): Promise<BinderyResult<any>>`

Manually triggers a hook agent execution.

**Parameters**:
```typescript
interface HookTriggerInput {
  hook_id: string;
  trigger_context: Record<string, any>;
  force_execute?: boolean;
}
```

**Returns**: `Promise<BinderyResult<any>>`

**Example**:
```typescript
const triggerResult = await binderyService.triggerHookAgent({
  hook_id: 'task_completion_hook_123',
  trigger_context: {
    task_id: 'task_456',
    status: 'Done',
    completion_time: new Date().toISOString()
  },
  force_execute: true
});

if (triggerResult.success) {
  console.log('Hook agent triggered successfully');
}
```

## Utility Methods

### System Information

#### `getVersionInfo(): Promise<BinderyResult<VersionInfo>>`

Retrieves backend version and build information.

**Returns**: `Promise<BinderyResult<VersionInfo>>`

#### `hotReload(): Promise<BinderyResult<void>>`

Hot reloads Bindery server (development only).

**Returns**: `Promise<BinderyResult<void>>`

**Example**:
```typescript
// Development workflow
if (process.env.NODE_ENV === 'development') {
  const reloadResult = await binderyService.hotReload();
  if (reloadResult.success) {
    console.log('Bindery server reloaded');
  }
}
```

## Event System

### Event Listeners

The `BinderyService` extends `EventEmitter` and provides real-time status updates:

```typescript
binderyService.on('statusChanged', (info: BinderyConnectionInfo) => {
  console.log('Connection status:', info.status);
  
  switch (info.status) {
    case BinderyConnectionStatus.Connected:
      console.log('Backend connected:', info.version?.version);
      break;
    case BinderyConnectionStatus.Disconnected:
      console.log('Backend disconnected');
      break;
    case BinderyConnectionStatus.Error:
      console.error('Connection error:', info.last_error);
      break;
  }
});

// Custom events (if implemented)
binderyService.on('taskUpdated', (taskId: CodexId) => {
  console.log('Task updated:', taskId);
});

binderyService.on('taskCreated', (taskId: CodexId) => {
  console.log('Task created:', taskId);
});
```

## Error Handling

### Error Types

```typescript
interface BinderyError {
  code: number;
  message: string;
}

// Common error codes
const ErrorCodes = {
  CONNECTION_FAILED: -1,
  REQUEST_TIMEOUT: -2,
  INVALID_PARAMS: -3,
  TASK_NOT_FOUND: 404,
  PERMISSION_DENIED: 403,
  BACKEND_ERROR: 500
};
```

### Error Handling Patterns

```typescript
// Result pattern with error handling
const result = await binderyService.createTask(taskInput);
if (!result.success) {
  switch (result.error?.code) {
    case ErrorCodes.CONNECTION_FAILED:
      // Handle connection issues
      console.log('Using mock mode due to connection failure');
      break;
    case ErrorCodes.INVALID_PARAMS:
      // Handle validation errors  
      console.error('Invalid task data:', result.error.message);
      break;
    case ErrorCodes.BACKEND_ERROR:
      // Handle server errors
      console.error('Backend error:', result.error.message);
      break;
    default:
      console.error('Unexpected error:', result.error?.message);
  }
  return;
}

// Success path
console.log('Task created:', result.data);
```

## Mock Mode Implementation

When Bindery backend is unavailable, the service automatically switches to mock mode:

```typescript
// Mock mode provides realistic data for development
const mockResult = await binderyService.getTaskDashboard();
// Returns simulated dashboard data with delays

// Check if running in mock mode
const connectionInfo = binderyService.getConnectionInfo();
if (connectionInfo.status === BinderyConnectionStatus.Disconnected) {
  console.log('Running in mock mode');
}
```

**Mock Mode Features**:
- Simulated async delays (100-300ms)
- Realistic test data generation
- Full API compatibility  
- Deterministic responses for testing
- Memory-based task storage during session

---

The Bindery Service API provides comprehensive task orchestration capabilities with full TypeScript type safety, robust error handling, and seamless mock mode fallback for optimal development experience.