import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestService, waitForCondition } from './__mocks__/service-utils';
import { ServiceManager } from '../../src/core/messaging/serviceManager';

describe('End-to-End Message Flow', () => {
  // Service instances
  let orchestrator: ReturnType<typeof createTestService>;
  let worker1: ReturnType<typeof createTestService>;
  let worker2: ReturnType<typeof createTestService>;
  let storage: ReturnType<typeof createTestService>;
  let serviceManager: ServiceManager;

  // Test data
  const testTask = {
    id: 'task-123',
    type: 'data-processing',
    payload: { data: 'test-data' },
    priority: 1,
  };

  beforeEach(async () => {
    // Create test services
    orchestrator = createTestService({
      serviceType: 'orchestrator',
      capabilities: ['task-distribution', 'workflow-management'],
    });

    worker1 = createTestService({
      serviceType: 'worker',
      capabilities: ['data-processing', 'task-execution'],
      metadata: { workerId: 'worker-1' },
    });

    worker2 = createTestService({
      serviceType: 'worker',
      capabilities: ['data-processing', 'task-execution'],
      metadata: { workerId: 'worker-2' },
    });

    storage = createTestService({
      serviceType: 'storage',
      capabilities: ['data-persistence', 'file-storage'],
    });

    // Create service manager for test assertions
    serviceManager = new ServiceManager({
      serviceType: 'test-manager',
      capabilities: ['monitoring'],
    });

    // Start all services
    await Promise.all([
      orchestrator.start(),
      worker1.start(),
      worker2.start(),
      storage.start(),
      serviceManager.initialize(),
    ]);

    // Set up task processing on workers
    await Promise.all([
      setupWorker(worker1, 'worker-1'),
      setupWorker(worker2, 'worker-2'),
    ]);

    // Set up storage service
    await setupStorageService(storage);

    // Set up orchestrator
    await setupOrchestrator(orchestrator);

    // Wait for services to discover each other
    await waitForCondition(
      () => serviceManager.getServices().length >= 4,
      5000,
      200
    );
  });

  afterEach(async () => {
    // Clean up all services
    await Promise.all([
      orchestrator.stop(),
      worker1.stop(),
      worker2.stop(),
      storage.stop(),
      serviceManager.shutdown(),
    ]);
  });

  it('should distribute tasks to available workers', async () => {
    // Submit a task to the orchestrator
    await orchestrator.sendMessage('orchestrator.tasks.submit', {
      ...testTask,
    });

    // Wait for task to be processed
    const taskProcessed = await waitForCondition(
      () => orchestrator.getMessagesForSubject('orchestrator.tasks.completed').length > 0,
      5000
    );

    expect(taskProcessed).toBe(true);

    // Verify the task was processed by one of the workers
    const completedTasks = orchestrator.getMessagesForSubject('orchestrator.tasks.completed');
    expect(completedTasks).toHaveLength(1);
    expect(completedTasks[0].payload).toMatchObject({
      taskId: testTask.id,
      status: 'completed',
    });
  });

  it('should handle worker failures', async () => {
    // Submit multiple tasks
    const tasks = Array(5).fill(0).map((_, i) => ({
      ...testTask,
      id: `task-${i}`,
    }));

    // Submit all tasks
    await Promise.all(
      tasks.map(task => 
        orchestrator.sendMessage('orchestrator.tasks.submit', task)
      )
    );

    // Simulate worker failure after a short delay
    setTimeout(() => worker1.stop(), 500);

    // Wait for all tasks to be completed
    const allTasksCompleted = await waitForCondition(
      () => orchestrator.getMessagesForSubject('orchestrator.tasks.completed').length >= tasks.length,
      10000
    );

    expect(allTasksCompleted).toBe(true);

    // Verify all tasks were processed
    const completedTasks = orchestrator.getMessagesForSubject('orchestrator.tasks.completed');
    const completedTaskIds = completedTasks.map(t => t.payload.taskId);
    
    tasks.forEach(task => {
      expect(completedTaskIds).toContain(task.id);
    });
  });

  it('should persist task results', async () => {
    // Submit a task with result persistence
    const taskWithStorage = {
      ...testTask,
      persistResult: true,
      storageKey: `results/${testTask.id}.json`,
    };

    await orchestrator.sendMessage('orchestrator.tasks.submit', taskWithStorage);

    // Wait for task completion and result storage
    const [resultStored] = await Promise.all([
      waitForCondition(
        () => storage.getMessagesForSubject('storage.results.stored').length > 0,
        5000
      ),
      waitForCondition(
        () => orchestrator.getMessagesForSubject('orchestrator.tasks.completed').length > 0,
        5000
      )
    ]);

    expect(resultStored).toBe(true);

    // Verify the result was stored
    const storedResults = storage.getMessagesForSubject('storage.results.stored');
    expect(storedResults).toHaveLength(1);
    expect(storedResults[0].payload).toMatchObject({
      key: taskWithStorage.storageKey,
      status: 'success',
    });
  });

  // Helper functions for service setup
  async function setupWorker(worker: any, workerId: string) {
    await worker.subscribe(`worker.${workerId}.tasks`);
    
    // Handle task assignment
    worker.serviceManager.subscribe(`worker.${workerId}.tasks`, async (msg: any) => {
      if (msg.type === 'TASK_ASSIGNED') {
        // Simulate work
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Notify completion
        await worker.sendMessage('orchestrator.tasks.completed', {
          taskId: msg.payload.taskId,
          workerId,
          status: 'completed',
          result: { processed: true, worker: workerId },
        });
      }
    });
  }

  async function setupStorageService(storageService: any) {
    await storageService.subscribe('storage.results.store');
    
    // Handle storage requests
    storageService.serviceManager.subscribe('storage.results.store', async (msg: any) => {
      if (msg.type === 'STORE_REQUEST') {
        // Simulate storage operation
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Notify storage completion
        await storageService.sendMessage('storage.results.stored', {
          key: msg.payload.key,
          status: 'success',
          timestamp: new Date().toISOString(),
        });
      }
    });
  }

  async function setupOrchestrator(orch: any) {
    // Track available workers
    const availableWorkers = new Set<string>();
    const taskQueue: Array<{id: string, data: any}> = [];

    // Subscribe to worker heartbeats
    await orch.subscribe('service.heartbeat.>');
    
    // Handle worker heartbeats
    orch.serviceManager.subscribe('service.heartbeat.>', (msg: any) => {
      if (msg.headers.source.startsWith('worker-')) {
        availableWorkers.add(msg.headers.source);
      }
    });

    // Handle task submission
    await orch.subscribe('orchestrator.tasks.submit');
    orch.serviceManager.subscribe('orchestrator.tasks.submit', (msg: any) => {
      if (msg.type === 'TASK_SUBMITTED') {
        taskQueue.push({
          id: msg.payload.id || `task-${Date.now()}`,
          data: msg.payload,
        });
        processTaskQueue();
      }
    });

    // Process task queue
    async function processTaskQueue() {
      if (taskQueue.length === 0 || availableWorkers.size === 0) return;
      
      const task = taskQueue.shift();
      if (!task) return;

      const workerId = Array.from(availableWorkers)[0];
      availableWorkers.delete(workerId);

      // Assign task to worker
      await orch.sendMessage(`worker.${workerId}.tasks`, {
        type: 'TASK_ASSIGNED',
        payload: {
          taskId: task.id,
          ...task.data,
        },
      });

      // Handle task completion
      const completionListener = async (msg: any) => {
        if (msg.type === 'TASK_COMPLETED' && msg.payload.taskId === task.id) {
          // Return worker to available pool
          availableWorkers.add(workerId);
          
          // Store result if needed
          if (task.data.persistResult) {
            await orch.sendMessage('storage.results.store', {
              type: 'STORE_REQUEST',
              payload: {
                key: task.data.storageKey,
                data: msg.payload.result,
              },
            });
          }
          
          // Notify task completion
          await orch.sendMessage('orchestrator.tasks.completed', {
            taskId: task.id,
            status: 'completed',
            result: msg.payload.result,
          });

          // Clean up listener
          orch.serviceManager.unsubscribe(`worker.${workerId}.tasks.completed`, completionListener);
          
          // Process next task
          processTaskQueue();
        }
      };

      // Listen for task completion
      await orch.subscribe(`worker.${workerId}.tasks.completed`);
      orch.serviceManager.subscribe(`worker.${workerId}.tasks.completed`, completionListener);
    }
  }
});
