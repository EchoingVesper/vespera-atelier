/**
 * Message filtering system for A2A messaging
 * 
 * Provides functionality to filter messages based on content and metadata
 * before they are processed by the application.
 */
import { EventEmitter } from 'events';
import { Message, MessageType } from './types';
import { natsClient, NatsClient } from './natsClient';

/**
 * Filter rule types
 */
export enum FilterRuleType {
  INCLUDE = 'INCLUDE', // Only process messages that match this rule
  EXCLUDE = 'EXCLUDE', // Skip messages that match this rule
  TRANSFORM = 'TRANSFORM' // Transform messages that match this rule
}

/**
 * Filter rule comparison operators
 */
export enum FilterOperator {
  EQUALS = 'EQUALS',
  NOT_EQUALS = 'NOT_EQUALS',
  CONTAINS = 'CONTAINS',
  NOT_CONTAINS = 'NOT_CONTAINS',
  STARTS_WITH = 'STARTS_WITH',
  ENDS_WITH = 'ENDS_WITH',
  GREATER_THAN = 'GREATER_THAN',
  LESS_THAN = 'LESS_THAN',
  REGEX = 'REGEX'
}

/**
 * Target field to apply the filter rule to
 */
export enum FilterTarget {
  MESSAGE_TYPE = 'MESSAGE_TYPE',
  SOURCE = 'SOURCE',
  DESTINATION = 'DESTINATION',
  CORRELATION_ID = 'CORRELATION_ID',
  HEADER = 'HEADER',
  PAYLOAD = 'PAYLOAD'
}

/**
 * Filter rule definition
 */
export interface FilterRule {
  id: string;
  name: string;
  type: FilterRuleType;
  target: FilterTarget;
  field?: string; // Required for HEADER and PAYLOAD targets
  operator: FilterOperator;
  value: string | number | boolean | RegExp;
  priority?: number; // Higher priority rules are evaluated first
  description?: string;
  enabled: boolean;
  transform?: (message: Message) => Message; // Function to transform the message (only for TRANSFORM type)
}

/**
 * Filter result with metadata
 */
export interface FilterResult {
  passed: boolean;
  message: Message;
  matchedRules: string[]; // IDs of rules that matched
  transformed: boolean;
  originalMessage?: Message; // Original message before transformation
}

/**
 * Message filter events
 */
export interface MessageFilterEvents {
  filtered: (result: FilterResult) => void;
  ruleAdded: (rule: FilterRule) => void;
  ruleRemoved: (ruleId: string) => void;
  ruleUpdated: (rule: FilterRule) => void;
  error: (error: Error) => void;
}

/**
 * Message filter options
 */
export interface MessageFilterOptions {
  natsClient?: NatsClient;
  initialRules?: FilterRule[];
  enableLogging?: boolean;
}

/**
 * Message Filter class for filtering messages based on content and metadata
 */
export class MessageFilter extends EventEmitter {
  private rules: Map<string, FilterRule> = new Map();
  private natsClient: NatsClient;
  private enableLogging: boolean;

  constructor(options: MessageFilterOptions = {}) {
    super();
    this.natsClient = options.natsClient || natsClient;
    this.enableLogging = options.enableLogging || false;

    // Initialize with any provided rules
    if (options.initialRules) {
      options.initialRules.forEach(rule => this.addRule(rule));
    }
  }

  /**
   * Add a new filter rule
   * 
   * @param rule - The filter rule to add
   * @returns The ID of the added rule
   */
  addRule(rule: FilterRule): string {
    if (this.rules.has(rule.id)) {
      throw new Error(`Rule with ID ${rule.id} already exists`);
    }

    this.rules.set(rule.id, rule);
    this.emit('ruleAdded', rule);
    
    if (this.enableLogging) {
      console.log(`Added filter rule: ${rule.name} (${rule.id})`);
    }
    
    return rule.id;
  }

  /**
   * Remove a filter rule
   * 
   * @param ruleId - The ID of the rule to remove
   * @returns True if the rule was removed, false if it didn't exist
   */
  removeRule(ruleId: string): boolean {
    const exists = this.rules.has(ruleId);
    
    if (exists) {
      this.rules.delete(ruleId);
      this.emit('ruleRemoved', ruleId);
      
      if (this.enableLogging) {
        console.log(`Removed filter rule: ${ruleId}`);
      }
    }
    
    return exists;
  }

  /**
   * Update an existing filter rule
   * 
   * @param rule - The updated rule
   * @returns True if the rule was updated, false if it didn't exist
   */
  updateRule(rule: FilterRule): boolean {
    if (!this.rules.has(rule.id)) {
      return false;
    }

    this.rules.set(rule.id, rule);
    this.emit('ruleUpdated', rule);
    
    if (this.enableLogging) {
      console.log(`Updated filter rule: ${rule.name} (${rule.id})`);
    }
    
    return true;
  }

  /**
   * Get a filter rule by ID
   * 
   * @param ruleId - The ID of the rule to get
   * @returns The rule or undefined if not found
   */
  getRule(ruleId: string): FilterRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * Get all filter rules
   * 
   * @returns Array of all filter rules
   */
  getAllRules(): FilterRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Enable a filter rule
   * 
   * @param ruleId - The ID of the rule to enable
   * @returns True if the rule was enabled, false if it didn't exist
   */
  enableRule(ruleId: string): boolean {
    const rule = this.rules.get(ruleId);
    
    if (!rule) {
      return false;
    }

    rule.enabled = true;
    this.rules.set(ruleId, rule);
    this.emit('ruleUpdated', rule);
    
    return true;
  }

  /**
   * Disable a filter rule
   * 
   * @param ruleId - The ID of the rule to disable
   * @returns True if the rule was disabled, false if it didn't exist
   */
  disableRule(ruleId: string): boolean {
    const rule = this.rules.get(ruleId);
    
    if (!rule) {
      return false;
    }

    rule.enabled = false;
    this.rules.set(ruleId, rule);
    this.emit('ruleUpdated', rule);
    
    return true;
  }

  /**
   * Apply filter rules to a message
   * 
   * @param message - The message to filter
   * @returns Filter result with metadata
   */
  filterMessage(message: Message): FilterResult {
    const result: FilterResult = {
      passed: true,
      message: { ...message },
      matchedRules: [],
      transformed: false
    };

    // Get enabled rules sorted by priority (highest first)
    const enabledRules = Array.from(this.rules.values())
      .filter(rule => rule.enabled)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));

    // Apply each rule in order
    for (const rule of enabledRules) {
      const matches = this.evaluateRule(rule, result.message);
      
      if (matches) {
        result.matchedRules.push(rule.id);
        
        // Handle rule based on type
        if (rule.type === FilterRuleType.EXCLUDE) {
          result.passed = false;
          break;
        } else if (rule.type === FilterRuleType.TRANSFORM && rule.transform) {
          if (!result.originalMessage) {
            result.originalMessage = { ...message };
          }
          result.message = rule.transform(result.message);
          result.transformed = true;
        }
      }
    }

    // Emit filtered event
    this.emit('filtered', result);
    
    return result;
  }

  /**
   * Evaluate if a message matches a filter rule
   * 
   * @param rule - The rule to evaluate
   * @param message - The message to check
   * @returns True if the message matches the rule
   */
  private evaluateRule(rule: FilterRule, message: Message): boolean {
    let targetValue: any;

    // Extract the target value based on the filter target
    switch (rule.target) {
      case FilterTarget.MESSAGE_TYPE:
        targetValue = message.type;
        break;
      case FilterTarget.SOURCE:
        targetValue = message.headers.source;
        break;
      case FilterTarget.DESTINATION:
        targetValue = message.headers.destination;
        break;
      case FilterTarget.CORRELATION_ID:
        targetValue = message.headers.correlationId;
        break;
      case FilterTarget.HEADER:
        if (!rule.field) {
          throw new Error('Field is required for HEADER target');
        }
        targetValue = message.headers[rule.field];
        break;
      case FilterTarget.PAYLOAD:
        if (!rule.field) {
          throw new Error('Field is required for PAYLOAD target');
        }
        // Support nested fields with dot notation (e.g., 'user.name')
        targetValue = this.getNestedValue(message.payload, rule.field);
        break;
      default:
        throw new Error(`Unsupported filter target: ${rule.target}`);
    }

    // If target value is undefined, it doesn't match
    if (targetValue === undefined) {
      return false;
    }

    // Evaluate based on the operator
    return this.evaluateOperator(rule.operator, targetValue, rule.value);
  }

  /**
   * Get a nested value from an object using dot notation
   * 
   * @param obj - The object to extract from
   * @param path - The path to the value (e.g., 'user.name')
   * @returns The value or undefined if not found
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((prev, curr) => {
      return prev && prev[curr] !== undefined ? prev[curr] : undefined;
    }, obj);
  }

  /**
   * Evaluate an operator against a target value and rule value
   * 
   * @param operator - The operator to use
   * @param targetValue - The value from the message
   * @param ruleValue - The value from the rule
   * @returns True if the condition is met
   */
  private evaluateOperator(
    operator: FilterOperator,
    targetValue: any,
    ruleValue: string | number | boolean | RegExp
  ): boolean {
    // Convert to string for string operations if needed
    const targetString = typeof targetValue === 'string' 
      ? targetValue 
      : typeof targetValue === 'object' 
        ? JSON.stringify(targetValue) 
        : String(targetValue);

    const ruleString = typeof ruleValue === 'string' 
      ? ruleValue 
      : ruleValue instanceof RegExp 
        ? ruleValue.toString() 
        : String(ruleValue);

    switch (operator) {
      case FilterOperator.EQUALS:
        return targetValue === ruleValue;
      case FilterOperator.NOT_EQUALS:
        return targetValue !== ruleValue;
      case FilterOperator.CONTAINS:
        return targetString.includes(ruleString);
      case FilterOperator.NOT_CONTAINS:
        return !targetString.includes(ruleString);
      case FilterOperator.STARTS_WITH:
        return targetString.startsWith(ruleString);
      case FilterOperator.ENDS_WITH:
        return targetString.endsWith(ruleString);
      case FilterOperator.GREATER_THAN:
        return typeof targetValue === 'number' && typeof ruleValue === 'number' 
          ? targetValue > ruleValue 
          : targetString > ruleString;
      case FilterOperator.LESS_THAN:
        return typeof targetValue === 'number' && typeof ruleValue === 'number' 
          ? targetValue < ruleValue 
          : targetString < ruleString;
      case FilterOperator.REGEX:
        const regex = ruleValue instanceof RegExp 
          ? ruleValue 
          : new RegExp(ruleString);
        return regex.test(targetString);
      default:
        throw new Error(`Unsupported filter operator: ${operator}`);
    }
  }
}

// Create and export a singleton instance
export const messageFilter = new MessageFilter();
