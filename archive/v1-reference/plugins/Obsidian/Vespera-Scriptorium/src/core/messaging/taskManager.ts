/**
 * Task Manager for handling task-related messages in the A2A communication layer
 */
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { 
  Message, 
  MessageType, 
  BaseTaskPayload,
  TaskCreatePayload,
  TaskUpdatePayload,
  TaskCompletePayload,
  TaskFailPayload,
  TaskRequestPayload,
  TaskCancelPayload,
  TaskAssignPayload,
  TaskStatus,
  ErrorPayload
} from './types';
import { natsClient, NatsClient } from './natsClient';

// Define event types for the task manager
export interface TaskManagerEvents {
  taskCreated: (taskId: string, payload: TaskCreatePayload) => void;
  taskUpdated: (taskId: string, payload: TaskUpdatePayload) => void;
  taskCompleted: (taskId: string, payload: TaskCompletePayload) => void;
  taskFailed: (taskId: string, payload: TaskFailPayload) => void;
  taskCancelled: (taskId: string, payload: TaskCancelPayload) => void;
  taskAssigned: (taskId: string, assignedTo: string) => void;
  taskRequested: (taskId: string, payload: TaskRequestPayload) => void;
  error: (error: Error | ErrorPayload) => void;
}

export interface TaskManagerOptions {
  serviceId: string;
  capabilities: string[];
  maxConcurrentTasks?: number;
  taskTimeout?: number;
  retryStrategy?: RetryStrategy;
  natsClient?: NatsClient;
}

export interface RetryStrategy {
  maxRetries: number;
  initialDelay: number; // in milliseconds
  maxDelay: number; // in milliseconds
  backoffFactor: number;
}

export interface TaskInfo {
  taskId: string;
  taskType: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  assignedTo?: string;
  priority: number;
  parameters: Record<string, unknown>;
  result?: unknown;
  error?: ErrorPayload;
  progress?: number;
  metadata?: Record<string, unknown>;
  timeout?: number;
  dependencies?: string[];
  retryCount?: number;
}

/**
 * TaskManager handles task-related messages and provides an API for task management
 */
export class TaskManager extends EventEmitter {
  private serviceId: string;
  private capabilities: string[];
  private maxConcurrentTasks: number;
  private taskTimeout: number;
  private retryStrategy: RetryStrategy;
  private natsClient: NatsClient;
  private tasks: Map<string, TaskInfo> = new Map();
  private activeTasks: Set<string> = new Set();
  private subscriptions: string[] = [];
  private taskHandlers: Map<string, (task: TaskInfo) => Promise<unknown>> = new Map();

  constructor(options: TaskManagerOptions) {
    super();
    this.serviceId = options.serviceId;
    this.capabilities = options.capabilities;
    this.maxConcurrentTasks = options.maxConcurrentTasks || 10;
    this.taskTimeout = options.taskTimeout || 60000; // 60 seconds
    this.retryStrategy = options.retryStrategy || {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 30000,
      backoffFactor: 2
    };
    this.natsClient = options.natsClient || natsClient;
  }

  /**
   * Initialize the task manager
   */
  async initialize(): Promise<void> {
    try {
      // Subscribe to task-related messages
      await this.setupSubscriptions();
      console.log(`Task manager initialized for service ${this.serviceId}`);
    } catch (error) {
      console.error('Failed to initialize task manager:', error);
      throw error;
    }
  }

  /**
   * Clean up resources
   */
  async shutdown(): Promise<void> {
    // Unsubscribe from all subscriptions
    await Promise.all(
      this.subscriptions.map(subId => 
        this.natsClient.unsubscribe(subId).catch(console.error)
      )
    );

    // Cancel all active tasks
    const cancelPromises = Array.from(this.activeTasks).map(taskId => 
      this.cancelTask(taskId, 'Service shutdown')
    );
    await Promise.all(cancelPromises);

    console.log(`Task manager for service ${this.serviceId} shut down`);
  }

  /**
   * Set up message subscriptions
   */
  private async setupSubscriptions(): Promise<void> {
    // Subscribe to task creation messages
    const createSubId = await this.natsClient.subscribe(
      'task.create',
      async (msg: Message<TaskCreatePayload>) => {
        await this.handleTaskCreate(msg);
      }
    );
    this.subscriptions.push(createSubId);

    // Subscribe to task update messages
    const updateSubId = await this.natsClient.subscribe(
      'task.update',
      async (msg: Message<TaskUpdatePayload>) => {
        await this.handleTaskUpdate(msg);
      }
    );
    this.subscriptions.push(updateSubId);

    // Subscribe to task complete messages
    const completeSubId = await this.natsClient.subscribe(
      'task.complete',
      async (msg: Message<TaskCompletePayload>) => {
        await this.handleTaskComplete(msg);
      }
    );
    this.subscriptions.push(completeSubId);

    // Subscribe to task fail messages
    const failSubId = await this.natsClient.subscribe(
      'task.fail',
      async (msg: Message<TaskFailPayload>) => {
        await this.handleTaskFail(msg);
      }
    );
    this.subscriptions.push(failSubId);

    // Subscribe to task request messages
    const requestSubId = await this.natsClient.subscribe(
      'task.request',
      async (msg: Message<TaskRequestPayload>) => {
        await this.handleTaskRequest(msg);
      }
    );
    this.subscriptions.push(requestSubId);

    // Subscribe to task cancel messages
    const cancelSubId = await this.natsClient.subscribe(
      'task.cancel',
      async (msg: Message<TaskCancelPayload>) => {
        await this.handleTaskCancel(msg);
      }
    );
    this.subscriptions.push(cancelSubId);

    // Subscribe to task assign messages
    const assignSubId = await this.natsClient.subscribe(
      'task.assign',
      async (msg: Message<TaskAssignPayload>) => {
        await this.handleTaskAssign(msg);
      }
    );
    this.subscriptions.push(assignSubId);

    console.log('Task manager subscriptions set up');
  }

  /**
   * Register a handler for a specific task type
   * @param taskType The type of task to handle
   * @param handler The handler function
   */
  registerTaskHandler(taskType: string, handler: (task: TaskInfo) => Promise<unknown>): void {
    this.taskHandlers.set(taskType, handler);
    console.log(`Registered handler for task type: ${taskType}`);
  }

  /**
   * Create a new task
   * @param taskType The type of task to create
   * @param parameters The task parameters
   * @param options Additional task options
   */
  async createTask(
    taskType: string, 
    parameters: Record<string, unknown>, 
    options?: {
      priority?: number;
      timeout?: number;
      metadata?: Record<string, unknown>;
      assignTo?: string;
      dependencies?: string[];
    }
  ): Promise<string> {
    const taskId = `task-${uuidv4()}`;
    const now = new Date().toISOString();
    
    const taskInfo: TaskInfo = {
      taskId,
      taskType,
      status: TaskStatus.PENDING,
      createdAt: now,
      updatedAt: now,
      priority: options?.priority || 0,
      parameters,
      metadata: options?.metadata,
      timeout: options?.timeout || this.taskTimeout,
      dependencies: options?.dependencies,
      assignedTo: options?.assignTo
    };
    
    this.tasks.set(taskId, taskInfo);
    
    const payload: TaskCreatePayload = {
      taskId,
      taskType,
      parameters,
      priority: options?.priority,
      timeout: options?.timeout,
      metadata: options?.metadata,
      assignTo: options?.assignTo,
      dependencies: options?.dependencies
    };
    
    const message: Message<TaskCreatePayload> = {
      type: MessageType.TASK_CREATE,
      headers: {
        correlationId: uuidv4(),
        messageId: uuidv4(),
        timestamp: now,
        source: this.serviceId
      },
      payload
    };
    
    await this.natsClient.publish('task.create', message);
    this.emit('taskCreated', taskId, payload);
    
    console.log(`Task created: ${taskId} (${taskType})`);
    return taskId;
  }

  /**
   * Update a task's status
   * @param taskId The ID of the task to update
   * @param status The new status
   * @param options Additional update options
   */
  async updateTask(
    taskId: string, 
    status: TaskStatus, 
    options?: {
      progress?: number;
      statusMessage?: string;
      estimatedCompletion?: string;
      updatedParameters?: Record<string, unknown>;
    }
  ): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    
    const now = new Date().toISOString();
    
    // Update task info
    task.status = status;
    task.updatedAt = now;
    if (options?.progress !== undefined) {
      task.progress = options.progress;
    }
    if (options?.updatedParameters) {
      task.parameters = { ...task.parameters, ...options.updatedParameters };
    }
    
    const payload: TaskUpdatePayload = {
      taskId,
      taskType: task.taskType,
      status,
      progress: options?.progress,
      statusMessage: options?.statusMessage,
      estimatedCompletion: options?.estimatedCompletion,
      updatedParameters: options?.updatedParameters,
      metadata: task.metadata
    };
    
    const message: Message<TaskUpdatePayload> = {
      type: MessageType.TASK_UPDATE,
      headers: {
        correlationId: uuidv4(),
        messageId: uuidv4(),
        timestamp: now,
        source: this.serviceId
      },
      payload
    };
    
    await this.natsClient.publish('task.update', message);
    this.emit('taskUpdated', taskId, payload);
    
    console.log(`Task updated: ${taskId} (${status})`);
  }

  /**
   * Complete a task with results
   * @param taskId The ID of the task to complete
   * @param result The task result
   * @param options Additional completion options
   */
  async completeTask(
    taskId: string, 
    result: unknown, 
    options?: {
      processingTime?: number;
      metrics?: Record<string, number>;
    }
  ): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    
    const now = new Date().toISOString();
    
    // Update task info
    task.status = TaskStatus.COMPLETED;
    task.updatedAt = now;
    task.result = result;
    
    // Remove from active tasks
    this.activeTasks.delete(taskId);
    
    const payload: TaskCompletePayload = {
      taskId,
      taskType: task.taskType,
      result,
      processingTime: options?.processingTime,
      metrics: options?.metrics,
      metadata: task.metadata
    };
    
    const message: Message<TaskCompletePayload> = {
      type: MessageType.TASK_COMPLETE,
      headers: {
        correlationId: uuidv4(),
        messageId: uuidv4(),
        timestamp: now,
        source: this.serviceId
      },
      payload
    };
    
    await this.natsClient.publish('task.complete', message);
    this.emit('taskCompleted', taskId, payload);
    
    console.log(`Task completed: ${taskId}`);
  }

  /**
   * Mark a task as failed
   * @param taskId The ID of the task that failed
   * @param error The error that caused the failure
   * @param options Additional failure options
   */
  async failTask(
    taskId: string, 
    error: ErrorPayload, 
    options?: {
      partialResult?: unknown;
      retryable?: boolean;
    }
  ): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    
    const now = new Date().toISOString();
    
    // Update task info
    task.status = TaskStatus.FAILED;
    task.updatedAt = now;
    task.error = error;
    task.retryCount = (task.retryCount || 0) + 1;
    
    // Remove from active tasks
    this.activeTasks.delete(taskId);
    
    const retryable = options?.retryable !== undefined ? 
      options.retryable : 
      task.retryCount < this.retryStrategy.maxRetries;
    
    const payload: TaskFailPayload = {
      taskId,
      taskType: task.taskType,
      error,
      partialResult: options?.partialResult,
      retryable,
      attemptCount: task.retryCount,
      metadata: task.metadata
    };
    
    const message: Message<TaskFailPayload> = {
      type: MessageType.TASK_FAIL,
      headers: {
        correlationId: uuidv4(),
        messageId: uuidv4(),
        timestamp: now,
        source: this.serviceId
      },
      payload
    };
    
    await this.natsClient.publish('task.fail', message);
    this.emit('taskFailed', taskId, payload);
    
    console.log(`Task failed: ${taskId} (${error.message})`);
    
    // Retry if applicable
    if (retryable) {
      await this.scheduleRetry(task);
    }
  }

  /**
   * Request a task to be performed by another service
   * @param taskType The type of task to request
   * @param parameters The task parameters
   * @param options Additional request options
   */
  async requestTask(
    taskType: string, 
    parameters: Record<string, unknown>, 
    options?: {
      priority?: number;
      timeout?: number;
      requiredCapabilities?: string[];
      metadata?: Record<string, unknown>;
    }
  ): Promise<string> {
    const taskId = `task-${uuidv4()}`;
    const now = new Date().toISOString();
    
    const payload: TaskRequestPayload = {
      taskId,
      taskType,
      parameters,
      priority: options?.priority,
      timeout: options?.timeout,
      requiredCapabilities: options?.requiredCapabilities,
      metadata: options?.metadata
    };
    
    const message: Message<TaskRequestPayload> = {
      type: MessageType.TASK_REQUEST,
      headers: {
        correlationId: uuidv4(),
        messageId: uuidv4(),
        timestamp: now,
        source: this.serviceId,
        replyTo: `service.${this.serviceId}.task.response.${taskId}`
      },
      payload
    };
    
    await this.natsClient.publish('task.request', message);
    this.emit('taskRequested', taskId, payload);
    
    console.log(`Task requested: ${taskId} (${taskType})`);
    return taskId;
  }

  /**
   * Cancel a task
   * @param taskId The ID of the task to cancel
   * @param reason The reason for cancellation
   * @param force Whether to force cancellation
   */
  async cancelTask(taskId: string, reason?: string, force: boolean = false): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    
    const now = new Date().toISOString();
    
    // Update task info
    task.status = TaskStatus.CANCELLED;
    task.updatedAt = now;
    
    // Remove from active tasks
    this.activeTasks.delete(taskId);
    
    const payload: TaskCancelPayload = {
      taskId,
      taskType: task.taskType,
      reason,
      force,
      metadata: task.metadata
    };
    
    const message: Message<TaskCancelPayload> = {
      type: MessageType.TASK_CANCEL,
      headers: {
        correlationId: uuidv4(),
        messageId: uuidv4(),
        timestamp: now,
        source: this.serviceId
      },
      payload
    };
    
    await this.natsClient.publish('task.cancel', message);
    this.emit('taskCancelled', taskId, payload);
    
    console.log(`Task cancelled: ${taskId} (${reason || 'No reason provided'})`);
  }

  /**
   * Handle task create messages
   */
  private async handleTaskCreate(msg: Message<TaskCreatePayload>): Promise<void> {
    const { taskId, taskType, parameters, assignTo } = msg.payload;
    
    // Check if this task is for us
    if (assignTo && assignTo !== this.serviceId) {
      return; // Not for us
    }
    
    console.log(`Received task create: ${taskId} (${taskType})`);
    
    const now = new Date().toISOString();
    
    // Create task info
    const taskInfo: TaskInfo = {
      taskId,
      taskType,
      status: TaskStatus.PENDING,
      createdAt: now,
      updatedAt: now,
      priority: msg.payload.priority || 0,
      parameters,
      metadata: msg.payload.metadata,
      timeout: msg.payload.timeout || this.taskTimeout,
      dependencies: msg.payload.dependencies
    };
    
    // Store task
    this.tasks.set(taskId, taskInfo);
    
    // Emit event
    this.emit('taskCreated', taskId, msg.payload);
    
    // Process task if we have a handler for it
    if (this.taskHandlers.has(taskType)) {
      await this.processTask(taskInfo);
    }
  }

  /**
   * Handle task update messages
   */
  private async handleTaskUpdate(msg: Message<TaskUpdatePayload>): Promise<void> {
    const { taskId, status } = msg.payload;
    
    // Check if we have this task
    const task = this.tasks.get(taskId);
    if (!task) {
      return; // Not our task
    }
    
    console.log(`Received task update: ${taskId} (${status})`);
    
    // Update task info
    task.status = status;
    task.updatedAt = new Date().toISOString();
    if (msg.payload.progress !== undefined) {
      task.progress = msg.payload.progress;
    }
    if (msg.payload.updatedParameters) {
      task.parameters = { ...task.parameters, ...msg.payload.updatedParameters };
    }
    
    // Emit event
    this.emit('taskUpdated', taskId, msg.payload);
  }

  /**
   * Handle task complete messages
   */
  private async handleTaskComplete(msg: Message<TaskCompletePayload>): Promise<void> {
    const { taskId, result } = msg.payload;
    
    // Check if we have this task
    const task = this.tasks.get(taskId);
    if (!task) {
      return; // Not our task
    }
    
    console.log(`Received task complete: ${taskId}`);
    
    // Update task info
    task.status = TaskStatus.COMPLETED;
    task.updatedAt = new Date().toISOString();
    task.result = result;
    
    // Remove from active tasks
    this.activeTasks.delete(taskId);
    
    // Emit event
    this.emit('taskCompleted', taskId, msg.payload);
  }

  /**
   * Handle task fail messages
   */
  private async handleTaskFail(msg: Message<TaskFailPayload>): Promise<void> {
    const { taskId, error } = msg.payload;
    
    // Check if we have this task
    const task = this.tasks.get(taskId);
    if (!task) {
      return; // Not our task
    }
    
    console.log(`Received task fail: ${taskId} (${error.message})`);
    
    // Update task info
    task.status = TaskStatus.FAILED;
    task.updatedAt = new Date().toISOString();
    task.error = error;
    
    // Remove from active tasks
    this.activeTasks.delete(taskId);
    
    // Emit event
    this.emit('taskFailed', taskId, msg.payload);
  }

  /**
   * Handle task request messages
   */
  private async handleTaskRequest(msg: Message<TaskRequestPayload>): Promise<void> {
    const { taskId, taskType, requiredCapabilities } = msg.payload;
    
    // Check if we can handle this task
    if (requiredCapabilities && !this.hasCapabilities(requiredCapabilities)) {
      return; // We don't have the required capabilities
    }
    
    if (!this.taskHandlers.has(taskType)) {
      return; // We don't have a handler for this task type
    }
    
    console.log(`Received task request: ${taskId} (${taskType})`);
    
    const now = new Date().toISOString();
    
    // Create task info
    const taskInfo: TaskInfo = {
      taskId,
      taskType,
      status: TaskStatus.PENDING,
      createdAt: now,
      updatedAt: now,
      priority: msg.payload.priority || 0,
      parameters: msg.payload.parameters,
      metadata: msg.payload.metadata,
      timeout: msg.payload.timeout || this.taskTimeout,
      assignedTo: this.serviceId
    };
    
    // Store task
    this.tasks.set(taskId, taskInfo);
    
    // Emit event
    this.emit('taskRequested', taskId, msg.payload);
    
    // Process task
    await this.processTask(taskInfo);
  }

  /**
   * Handle task cancel messages
   */
  private async handleTaskCancel(msg: Message<TaskCancelPayload>): Promise<void> {
    const { taskId, reason, force } = msg.payload;
    
    // Check if we have this task
    const task = this.tasks.get(taskId);
    if (!task) {
      return; // Not our task
    }
    
    console.log(`Received task cancel: ${taskId} (${reason || 'No reason provided'})`);
    
    // Update task info
    task.status = TaskStatus.CANCELLED;
    task.updatedAt = new Date().toISOString();
    
    // Remove from active tasks
    this.activeTasks.delete(taskId);
    
    // Emit event
    this.emit('taskCancelled', taskId, msg.payload);
  }

  /**
   * Handle task assign messages
   */
  private async handleTaskAssign(msg: Message<TaskAssignPayload>): Promise<void> {
    const { taskId, assignedTo } = msg.payload;
    
    // Check if this task is for us
    if (assignedTo !== this.serviceId) {
      return; // Not for us
    }
    
    // Check if we already have this task
    const task = this.tasks.get(taskId);
    if (task) {
      // Update assignment
      task.assignedTo = assignedTo;
      task.updatedAt = new Date().toISOString();
    } else {
      // We don't have this task yet, wait for the create message
      console.log(`Received assignment for unknown task: ${taskId}`);
    }
    
    console.log(`Received task assign: ${taskId} (assigned to ${assignedTo})`);
    
    // Emit event
    this.emit('taskAssigned', taskId, assignedTo);
  }

  /**
   * Process a task using the registered handler
   */
  private async processTask(task: TaskInfo): Promise<void> {
    // Check if we're already at max concurrent tasks
    if (this.activeTasks.size >= this.maxConcurrentTasks) {
      console.log(`Max concurrent tasks reached, queuing task: ${task.taskId}`);
      return; // Will be processed when another task completes
    }
    
    // Check if we have a handler for this task type
    const handler = this.taskHandlers.get(task.taskType);
    if (!handler) {
      await this.failTask(task.taskId, {
        code: 'NO_HANDLER',
        message: `No handler registered for task type: ${task.taskType}`,
        retryable: false
      });
      return;
    }
    
    // Mark task as in progress
    this.activeTasks.add(task.taskId);
    await this.updateTask(task.taskId, TaskStatus.IN_PROGRESS);
    
    // Set up timeout
    const timeoutId = setTimeout(() => {
      this.handleTaskTimeout(task.taskId);
    }, task.timeout || this.taskTimeout);
    
    try {
      // Execute handler
      const result = await handler(task);
      
      // Clear timeout
      clearTimeout(timeoutId);
      
      // Complete task
      await this.completeTask(task.taskId, result);
    } catch (error) {
      // Clear timeout
      clearTimeout(timeoutId);
      
      // Fail task
      const errorPayload: ErrorPayload = {
        code: 'TASK_EXECUTION_ERROR',
        message: error instanceof Error ? error.message : String(error),
        details: error,
        retryable: true,
        source: this.serviceId,
        timestamp: new Date().toISOString(),
        severity: 'ERROR'
      };
      
      await this.failTask(task.taskId, errorPayload);
    }
  }

  /**
   * Handle task timeout
   */
  private async handleTaskTimeout(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== TaskStatus.IN_PROGRESS) {
      return; // Task is not in progress
    }
    
    console.log(`Task timed out: ${taskId}`);
    
    const errorPayload: ErrorPayload = {
      code: 'TASK_TIMEOUT',
      message: `Task execution exceeded timeout of ${task.timeout || this.taskTimeout}ms`,
      retryable: true,
      source: this.serviceId,
      timestamp: new Date().toISOString(),
      severity: 'ERROR',
      errorType: 'TIMEOUT'
    };
    
    await this.failTask(taskId, errorPayload);
  }

  /**
   * Schedule a task retry with exponential backoff
   */
  private async scheduleRetry(task: TaskInfo): Promise<void> {
    const retryCount = task.retryCount || 0;
    if (retryCount >= this.retryStrategy.maxRetries) {
      console.log(`Max retries (${this.retryStrategy.maxRetries}) reached for task: ${task.taskId}`);
      return;
    }
    
    const delay = Math.min(
      this.retryStrategy.initialDelay * Math.pow(this.retryStrategy.backoffFactor, retryCount),
      this.retryStrategy.maxDelay
    );
    
    console.log(`Scheduling retry for task ${task.taskId} in ${delay}ms (attempt ${retryCount + 1})`);
    
    setTimeout(async () => {
      // Reset task status to pending
      task.status = TaskStatus.PENDING;
      task.updatedAt = new Date().toISOString();
      
      // Process task again
      await this.processTask(task);
    }, delay);
  }

  /**
   * Check if this service has all the required capabilities
   */
  private hasCapabilities(requiredCapabilities: string[]): boolean {
    return requiredCapabilities.every(cap => this.capabilities.includes(cap));
  }

  /**
   * Get a task by ID
   */
  getTask(taskId: string): TaskInfo | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get all tasks
   */
  getAllTasks(): TaskInfo[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get active tasks
   */
  getActiveTasks(): TaskInfo[] {
    return Array.from(this.activeTasks).map(taskId => this.tasks.get(taskId)).filter(Boolean) as TaskInfo[];
  }
}

// Singleton instance
export const taskManager = new TaskManager({
  serviceId: `taskmanager-${uuidv4()}`,
  capabilities: ['task.management'],
});
