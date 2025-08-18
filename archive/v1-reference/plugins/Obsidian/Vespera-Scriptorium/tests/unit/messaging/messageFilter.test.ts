/**
 * Unit tests for the message filtering system
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MessageFilter, FilterRuleType, FilterOperator, FilterTarget, FilterRule } from '../../../src/core/messaging/messageFilter';
import { Message, MessageType } from '../../../src/core/messaging/types';

describe('MessageFilter', () => {
  let messageFilter: MessageFilter;
  
  beforeEach(() => {
    // Create a new instance for each test
    messageFilter = new MessageFilter();
  });
  
  afterEach(() => {
    // Clean up after each test
    // Using vi from Vitest instead of jest
    vi.clearAllMocks();
  });
  
  describe('Rule Management', () => {
    it('should add a rule', () => {
      const rule: FilterRule = {
        id: 'test-rule-1',
        name: 'Test Rule 1',
        type: FilterRuleType.INCLUDE,
        target: FilterTarget.MESSAGE_TYPE,
        operator: FilterOperator.EQUALS,
        value: MessageType.HEARTBEAT,
        enabled: true
      };
      
      const ruleId = messageFilter.addRule(rule);
      expect(ruleId).toBe('test-rule-1');
      expect(messageFilter.getRule('test-rule-1')).toEqual(rule);
    });
    
    it('should remove a rule', () => {
      const rule: FilterRule = {
        id: 'test-rule-2',
        name: 'Test Rule 2',
        type: FilterRuleType.EXCLUDE,
        target: FilterTarget.SOURCE,
        operator: FilterOperator.EQUALS,
        value: 'test-service',
        enabled: true
      };
      
      messageFilter.addRule(rule);
      const removed = messageFilter.removeRule('test-rule-2');
      expect(removed).toBe(true);
      expect(messageFilter.getRule('test-rule-2')).toBeUndefined();
    });
    
    it('should update a rule', () => {
      const rule: FilterRule = {
        id: 'test-rule-3',
        name: 'Test Rule 3',
        type: FilterRuleType.INCLUDE,
        target: FilterTarget.DESTINATION,
        operator: FilterOperator.EQUALS,
        value: 'service-a',
        enabled: true
      };
      
      messageFilter.addRule(rule);
      
      const updatedRule: FilterRule = {
        ...rule,
        name: 'Updated Rule 3',
        value: 'service-b'
      };
      
      const updated = messageFilter.updateRule(updatedRule);
      expect(updated).toBe(true);
      expect(messageFilter.getRule('test-rule-3')).toEqual(updatedRule);
    });
    
    it('should enable and disable a rule', () => {
      const rule: FilterRule = {
        id: 'test-rule-4',
        name: 'Test Rule 4',
        type: FilterRuleType.INCLUDE,
        target: FilterTarget.MESSAGE_TYPE,
        operator: FilterOperator.EQUALS,
        value: MessageType.REGISTER,
        enabled: false
      };
      
      messageFilter.addRule(rule);
      
      const enabled = messageFilter.enableRule('test-rule-4');
      expect(enabled).toBe(true);
      expect(messageFilter.getRule('test-rule-4')?.enabled).toBe(true);
      
      const disabled = messageFilter.disableRule('test-rule-4');
      expect(disabled).toBe(true);
      expect(messageFilter.getRule('test-rule-4')?.enabled).toBe(false);
    });
  });
  
  describe('Message Filtering', () => {
    it('should filter messages based on message type', () => {
      const rule: FilterRule = {
        id: 'filter-type',
        name: 'Filter by Type',
        type: FilterRuleType.EXCLUDE,
        target: FilterTarget.MESSAGE_TYPE,
        operator: FilterOperator.EQUALS,
        value: MessageType.ERROR,
        enabled: true
      };
      
      messageFilter.addRule(rule);
      
      const message1: Message = {
        type: MessageType.HEARTBEAT,
        headers: {
          correlationId: '123',
          messageId: '456',
          timestamp: new Date().toISOString(),
          source: 'test-service'
        },
        payload: {}
      };
      
      const message2: Message = {
        type: MessageType.ERROR,
        headers: {
          correlationId: '789',
          messageId: '012',
          timestamp: new Date().toISOString(),
          source: 'test-service'
        },
        payload: {}
      };
      
      const result1 = messageFilter.filterMessage(message1);
      const result2 = messageFilter.filterMessage(message2);
      
      expect(result1.passed).toBe(true);
      expect(result2.passed).toBe(false);
      expect(result2.matchedRules).toContain('filter-type');
    });
    
    it('should filter messages based on source', () => {
      const rule: FilterRule = {
        id: 'filter-source',
        name: 'Filter by Source',
        type: FilterRuleType.INCLUDE,
        target: FilterTarget.SOURCE,
        operator: FilterOperator.CONTAINS,
        value: 'service-a',
        enabled: true
      };
      
      messageFilter.addRule(rule);
      
      const message1: Message = {
        type: MessageType.HEARTBEAT,
        headers: {
          correlationId: '123',
          messageId: '456',
          timestamp: new Date().toISOString(),
          source: 'service-a-1'
        },
        payload: {}
      };
      
      const message2: Message = {
        type: MessageType.HEARTBEAT,
        headers: {
          correlationId: '789',
          messageId: '012',
          timestamp: new Date().toISOString(),
          source: 'service-b-1'
        },
        payload: {}
      };
      
      const result1 = messageFilter.filterMessage(message1);
      const result2 = messageFilter.filterMessage(message2);
      
      expect(result1.passed).toBe(true);
      expect(result1.matchedRules).toContain('filter-source');
      expect(result2.passed).toBe(true);
      expect(result2.matchedRules).toHaveLength(0);
    });
    
    it('should filter messages based on payload content', () => {
      const rule: FilterRule = {
        id: 'filter-payload',
        name: 'Filter by Payload',
        type: FilterRuleType.EXCLUDE,
        target: FilterTarget.PAYLOAD,
        field: 'status',
        operator: FilterOperator.EQUALS,
        value: 'error',
        enabled: true
      };
      
      messageFilter.addRule(rule);
      
      const message1: Message = {
        type: MessageType.TASK_UPDATE,
        headers: {
          correlationId: '123',
          messageId: '456',
          timestamp: new Date().toISOString(),
          source: 'test-service'
        },
        payload: {
          taskId: 'task-1',
          status: 'in-progress'
        }
      };
      
      const message2: Message = {
        type: MessageType.TASK_UPDATE,
        headers: {
          correlationId: '789',
          messageId: '012',
          timestamp: new Date().toISOString(),
          source: 'test-service'
        },
        payload: {
          taskId: 'task-2',
          status: 'error'
        }
      };
      
      const result1 = messageFilter.filterMessage(message1);
      const result2 = messageFilter.filterMessage(message2);
      
      expect(result1.passed).toBe(true);
      expect(result2.passed).toBe(false);
      expect(result2.matchedRules).toContain('filter-payload');
    });
    
    it('should transform messages when rule type is TRANSFORM', () => {
      const transformFn = vi.fn((message: Message): Message => {
        return {
          ...message,
          headers: {
            ...message.headers,
            transformed: true
          }
        };
      });
      
      const rule: FilterRule = {
        id: 'transform-rule',
        name: 'Transform Message',
        type: FilterRuleType.TRANSFORM,
        target: FilterTarget.MESSAGE_TYPE,
        operator: FilterOperator.EQUALS,
        value: MessageType.HEARTBEAT,
        enabled: true,
        transform: transformFn
      };
      
      messageFilter.addRule(rule);
      
      const message: Message = {
        type: MessageType.HEARTBEAT,
        headers: {
          correlationId: '123',
          messageId: '456',
          timestamp: new Date().toISOString(),
          source: 'test-service'
        },
        payload: {}
      };
      
      const result = messageFilter.filterMessage(message);
      
      expect(result.passed).toBe(true);
      expect(result.transformed).toBe(true);
      expect(result.matchedRules).toContain('transform-rule');
      expect(transformFn).toHaveBeenCalledTimes(1);
      expect(result.message.headers).toHaveProperty('transformed', true);
      expect(result.originalMessage).toEqual(message);
    });
  });
});
