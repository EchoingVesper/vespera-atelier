import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  MessageType,
  isTaskMessage,
  isErrorMessage,
  isStorageMessage,
  isDataMessage,
  isTaskCreateMessage,
  isStorageSetMessage,
  isDataRequestMessage,
  Message,
  TaskCreatePayload,
  StorageSetPayload,
  DataRequestPayload,
  ErrorPayload
} from '../../../src/core/messaging/types';

describe('Message Types', () => {
  describe('Type Guards', () => {
    it('should correctly identify task messages', () => {
      const taskCreateMsg: Message<TaskCreatePayload> = {
        type: MessageType.TASK_CREATE,
        headers: {
          correlationId: 'test-corr-id',
          messageId: 'test-msg-id',
          timestamp: new Date().toISOString(),
          source: 'test-service'
        },
        payload: {
          taskId: 'test-task-123',
          taskType: 'test.task',
          parameters: { test: 'param' }
        }
      };

      const taskUpdateMsg: Message = {
        type: MessageType.TASK_UPDATE,
        headers: {
          correlationId: 'test-corr-id',
          messageId: 'test-msg-id',
          timestamp: new Date().toISOString(),
          source: 'test-service'
        },
        payload: {
          taskId: 'test-task-123',
          taskType: 'test.task',
          status: 'IN_PROGRESS'
        }
      };

      const errorMsg: Message<ErrorPayload> = {
        type: MessageType.ERROR,
        headers: {
          correlationId: 'test-corr-id',
          messageId: 'test-msg-id',
          timestamp: new Date().toISOString(),
          source: 'test-service'
        },
        payload: {
          code: 'TEST_ERROR',
          message: 'Test error message'
        }
      };

      expect(isTaskMessage(taskCreateMsg)).toBe(true);
      expect(isTaskMessage(taskUpdateMsg)).toBe(true);
      expect(isTaskMessage(errorMsg)).toBe(false);
    });

    it('should correctly identify error messages', () => {
      const errorMsg: Message<ErrorPayload> = {
        type: MessageType.ERROR,
        headers: {
          correlationId: 'test-corr-id',
          messageId: 'test-msg-id',
          timestamp: new Date().toISOString(),
          source: 'test-service'
        },
        payload: {
          code: 'TEST_ERROR',
          message: 'Test error message'
        }
      };

      const errorRetryMsg: Message<ErrorPayload> = {
        type: MessageType.ERROR_RETRY,
        headers: {
          correlationId: 'test-corr-id',
          messageId: 'test-msg-id',
          timestamp: new Date().toISOString(),
          source: 'test-service'
        },
        payload: {
          code: 'TEST_ERROR',
          message: 'Test error message',
          retryable: true
        }
      };

      const taskMsg: Message = {
        type: MessageType.TASK_CREATE,
        headers: {
          correlationId: 'test-corr-id',
          messageId: 'test-msg-id',
          timestamp: new Date().toISOString(),
          source: 'test-service'
        },
        payload: {
          taskId: 'test-task-123',
          taskType: 'test.task',
          parameters: { test: 'param' }
        }
      };

      expect(isErrorMessage(errorMsg)).toBe(true);
      expect(isErrorMessage(errorRetryMsg)).toBe(true);
      expect(isErrorMessage(taskMsg)).toBe(false);
    });

    it('should correctly identify storage messages', () => {
      const storageSetMsg: Message<StorageSetPayload> = {
        type: MessageType.STORAGE_SET,
        headers: {
          correlationId: 'test-corr-id',
          messageId: 'test-msg-id',
          timestamp: new Date().toISOString(),
          source: 'test-service'
        },
        payload: {
          key: 'test-key',
          value: { test: 'data' }
        }
      };

      const storageGetMsg: Message = {
        type: MessageType.STORAGE_GET,
        headers: {
          correlationId: 'test-corr-id',
          messageId: 'test-msg-id',
          timestamp: new Date().toISOString(),
          source: 'test-service'
        },
        payload: {
          key: 'test-key'
        }
      };

      const taskMsg: Message = {
        type: MessageType.TASK_CREATE,
        headers: {
          correlationId: 'test-corr-id',
          messageId: 'test-msg-id',
          timestamp: new Date().toISOString(),
          source: 'test-service'
        },
        payload: {
          taskId: 'test-task-123',
          taskType: 'test.task',
          parameters: { test: 'param' }
        }
      };

      expect(isStorageMessage(storageSetMsg)).toBe(true);
      expect(isStorageMessage(storageGetMsg)).toBe(true);
      expect(isStorageMessage(taskMsg)).toBe(false);
    });

    it('should correctly identify data messages', () => {
      const dataRequestMsg: Message<DataRequestPayload> = {
        type: MessageType.DATA_REQUEST,
        headers: {
          correlationId: 'test-corr-id',
          messageId: 'test-msg-id',
          timestamp: new Date().toISOString(),
          source: 'test-service'
        },
        payload: {
          requestId: 'test-req-123',
          dataType: 'test.data',
          parameters: { test: 'param' }
        }
      };

      const dataResponseMsg: Message = {
        type: MessageType.DATA_RESPONSE,
        headers: {
          correlationId: 'test-corr-id',
          messageId: 'test-msg-id',
          timestamp: new Date().toISOString(),
          source: 'test-service'
        },
        payload: {
          requestId: 'test-req-123',
          data: { test: 'result' }
        }
      };

      const taskMsg: Message = {
        type: MessageType.TASK_CREATE,
        headers: {
          correlationId: 'test-corr-id',
          messageId: 'test-msg-id',
          timestamp: new Date().toISOString(),
          source: 'test-service'
        },
        payload: {
          taskId: 'test-task-123',
          taskType: 'test.task',
          parameters: { test: 'param' }
        }
      };

      expect(isDataMessage(dataRequestMsg)).toBe(true);
      expect(isDataMessage(dataResponseMsg)).toBe(true);
      expect(isDataMessage(taskMsg)).toBe(false);
    });

    it('should correctly identify specific message types', () => {
      const taskCreateMsg: Message<TaskCreatePayload> = {
        type: MessageType.TASK_CREATE,
        headers: {
          correlationId: 'test-corr-id',
          messageId: 'test-msg-id',
          timestamp: new Date().toISOString(),
          source: 'test-service'
        },
        payload: {
          taskId: 'test-task-123',
          taskType: 'test.task',
          parameters: { test: 'param' }
        }
      };

      const storageSetMsg: Message<StorageSetPayload> = {
        type: MessageType.STORAGE_SET,
        headers: {
          correlationId: 'test-corr-id',
          messageId: 'test-msg-id',
          timestamp: new Date().toISOString(),
          source: 'test-service'
        },
        payload: {
          key: 'test-key',
          value: { test: 'data' }
        }
      };

      const dataRequestMsg: Message<DataRequestPayload> = {
        type: MessageType.DATA_REQUEST,
        headers: {
          correlationId: 'test-corr-id',
          messageId: 'test-msg-id',
          timestamp: new Date().toISOString(),
          source: 'test-service'
        },
        payload: {
          requestId: 'test-req-123',
          dataType: 'test.data',
          parameters: { test: 'param' }
        }
      };

      expect(isTaskCreateMessage(taskCreateMsg)).toBe(true);
      expect(isTaskCreateMessage(storageSetMsg)).toBe(false);

      expect(isStorageSetMessage(storageSetMsg)).toBe(true);
      expect(isStorageSetMessage(taskCreateMsg)).toBe(false);

      expect(isDataRequestMessage(dataRequestMsg)).toBe(true);
      expect(isDataRequestMessage(taskCreateMsg)).toBe(false);
    });
  });
});
