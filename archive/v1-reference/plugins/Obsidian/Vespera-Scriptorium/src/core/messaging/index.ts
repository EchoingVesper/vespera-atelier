/**
 * Core messaging module for A2A (Agent-to-Agent) communication
 * 
 * This module provides the foundation for the Protocol-Based Architecture,
 * enabling communication between agents through a standardized message format.
 */

// Core messaging types and interfaces
export * from './types';

// NATS client implementation
export { natsClient, NatsClient } from './natsClient';

// Service management
export { ServiceManager, type ServiceStatus, SERVICE_STATUS } from './serviceManager';

// Task management
export { TaskManager, taskManager } from './taskManager';
export { TaskStatus } from './types';

// Storage operations
export { StorageManager, storageManager, type StorageValue } from './storageManager';

// Data exchange
export { DataExchange, dataExchange } from './dataExchange';

// Advanced messaging features
export { messagePersistence, type PersistedMessage, type PersistenceOptions } from './messagePersistence';
export { loadBalancer, LoadBalancingStrategy, type LoadBalancingOptions, type ServiceLoadMetrics } from './loadBalancer';
export { 
  messagePrioritization, 
  MessagePriority, 
  type PrioritizedMessage, 
  type PrioritizationOptions 
} from './messagePrioritization';

// Monitoring features
export { 
  messageFilter, 
  MessageFilter, 
  FilterRuleType, 
  FilterOperator, 
  FilterTarget,
  type FilterRule,
  type FilterResult
} from './messageFilter';

export { 
  circuitBreakerRegistry, 
  CircuitBreaker, 
  CircuitBreakerRegistry, 
  CircuitState 
} from './circuitBreaker';

export { 
  metricsCollector, 
  MetricsCollector, 
  MetricType,
  type MetricsSnapshot
} from './metricsCollector';

export { 
  healthMonitor, 
  HealthMonitor, 
  HealthStatus, 
  ComponentType,
  type HealthCheckResult
} from './healthMonitor';

export { 
  alertManager, 
  AlertManager, 
  AlertSeverity, 
  AlertStatus, 
  AlertTriggerType,
  type AlertDefinition,
  type AlertCondition,
  type Alert
} from './alertManager';

// Re-export commonly used types for convenience
export type { 
  MessageHeaders, 
  Message, 
  ServiceInfo,
  TaskCreatePayload,
  TaskUpdatePayload,
  TaskCompletePayload,
  TaskFailPayload,
  TaskRequestPayload,
  StorageSetPayload,
  StorageGetPayload,
  DataRequestPayload,
  DataResponsePayload,
  ErrorPayload
} from './types';
