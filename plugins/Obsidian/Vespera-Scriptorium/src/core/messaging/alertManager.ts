/**
 * Alert management system for A2A messaging
 * 
 * Provides alert triggers, severity levels, and notification mechanisms
 * based on metrics and health status.
 */
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { natsClient, NatsClient } from './natsClient';
import { HealthStatus, healthMonitor } from './healthMonitor';
import { metricsCollector, MetricType } from './metricsCollector';
import { MessageType } from './types';

/**
 * Alert severity levels
 */
export enum AlertSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

/**
 * Alert status
 */
export enum AlertStatus {
  ACTIVE = 'ACTIVE',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  RESOLVED = 'RESOLVED',
  MUTED = 'MUTED'
}

/**
 * Alert trigger types
 */
export enum AlertTriggerType {
  METRIC_THRESHOLD = 'METRIC_THRESHOLD',
  HEALTH_STATUS = 'HEALTH_STATUS',
  ERROR_RATE = 'ERROR_RATE',
  LATENCY = 'LATENCY',
  THROUGHPUT = 'THROUGHPUT',
  CUSTOM = 'CUSTOM'
}

/**
 * Comparison operators for alert conditions
 */
export enum AlertOperator {
  GREATER_THAN = 'GREATER_THAN',
  LESS_THAN = 'LESS_THAN',
  EQUALS = 'EQUALS',
  NOT_EQUALS = 'NOT_EQUALS',
  CONTAINS = 'CONTAINS',
  NOT_CONTAINS = 'NOT_CONTAINS'
}

/**
 * Alert notification channel types
 */
export enum NotificationChannelType {
  CONSOLE = 'CONSOLE',
  EVENT = 'EVENT',
  NATS = 'NATS',
  CUSTOM = 'CUSTOM'
}

/**
 * Alert definition
 */
export interface AlertDefinition {
  id: string;
  name: string;
  description?: string;
  severity: AlertSeverity;
  triggerType: AlertTriggerType;
  condition: AlertCondition;
  notificationChannels: NotificationChannel[];
  enabled: boolean;
  autoResolve?: boolean;
  autoResolveAfter?: number; // Time in ms after which to auto-resolve
  aggregationWindow?: number; // Time window in ms for aggregating alerts
  tags?: Record<string, string>;
}

/**
 * Alert condition definition
 */
export interface AlertCondition {
  operator: AlertOperator;
  threshold?: number | string;
  metricType?: MetricType | string;
  metricTags?: Record<string, string>;
  healthStatus?: HealthStatus;
  componentId?: string;
  componentType?: string;
  duration?: number; // Duration in ms that condition must be true before triggering
  customEvaluator?: (data: any) => boolean;
}

/**
 * Notification channel configuration
 */
export interface NotificationChannel {
  id: string;
  type: NotificationChannelType;
  name: string;
  config: Record<string, any>;
  enabled: boolean;
}

/**
 * Alert instance
 */
export interface Alert {
  id: string;
  definitionId: string;
  name: string;
  description?: string;
  severity: AlertSeverity;
  status: AlertStatus;
  message: string;
  details?: Record<string, any>;
  createdAt: number;
  updatedAt: number;
  acknowledgedAt?: number;
  acknowledgedBy?: string;
  resolvedAt?: number;
  resolvedBy?: string;
  count: number; // Number of times this alert has been triggered
  tags?: Record<string, string>;
}

/**
 * Alert history entry
 */
export interface AlertHistoryEntry {
  alertId: string;
  timestamp: number;
  status: AlertStatus;
  message: string;
  actor?: string;
}

/**
 * Alert manager options
 */
export interface AlertManagerOptions {
  natsClient?: NatsClient;
  checkInterval?: number; // How often to check alert conditions in milliseconds
  maxAlertHistory?: number; // Maximum number of history entries to keep per alert
  enableLogging?: boolean; // Whether to log alert events
}

/**
 * Alert manager events
 */
export interface AlertManagerEvents {
  alertTriggered: (alert: Alert) => void;
  alertResolved: (alert: Alert) => void;
  alertAcknowledged: (alert: Alert, by: string) => void;
  alertMuted: (alert: Alert, by: string) => void;
  alertDefinitionAdded: (definition: AlertDefinition) => void;
  alertDefinitionUpdated: (definition: AlertDefinition) => void;
  alertDefinitionRemoved: (definitionId: string) => void;
  error: (error: Error) => void;
}

/**
 * Alert manager for handling alerts based on metrics and health status
 */
export class AlertManager extends EventEmitter {
  private alertDefinitions: Map<string, AlertDefinition> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private alertHistory: Map<string, AlertHistoryEntry[]> = new Map();
  private notificationChannels: Map<string, NotificationChannel> = new Map();
  private checkTimer: NodeJS.Timeout | null = null;
  private natsClient: NatsClient;
  private readonly options: Required<AlertManagerOptions>;

  constructor(options: AlertManagerOptions = {}) {
	super();
	this.natsClient = options.natsClient || natsClient;
	
	// Set default options
	this.options = {
	  natsClient: this.natsClient,
	  checkInterval: 30000, // 30 seconds
	  maxAlertHistory: 100,
	  enableLogging: false,
	  ...options
	};

	// Register default notification channels
	this.registerDefaultChannels();

	// Start checking for alert conditions
	this.startChecking();

	// Listen for health status changes
	this.listenForHealthChanges();
  }

  /**
   * Register default notification channels
   * 
   * @private
   */
  private registerDefaultChannels(): void {
	// Console notification channel
	this.registerNotificationChannel({
	  id: 'console',
	  type: NotificationChannelType.CONSOLE,
	  name: 'Console',
	  config: {},
	  enabled: true
	});

	// Event notification channel
	this.registerNotificationChannel({
	  id: 'event',
	  type: NotificationChannelType.EVENT,
	  name: 'Event',
	  config: {},
	  enabled: true
	});

	// NATS notification channel
	this.registerNotificationChannel({
	  id: 'nats',
	  type: NotificationChannelType.NATS,
	  name: 'NATS',
	  config: {
		subject: 'alerts'
	  },
	  enabled: true
	});
  }

  /**
   * Listen for health status changes
   * 
   * @private
   */
  private listenForHealthChanges(): void {
	healthMonitor.on('statusChanged', (componentId, oldStatus, newStatus) => {
	  // Check health-based alert definitions
	  for (const definition of this.alertDefinitions.values()) {
		if (
		  definition.enabled &&
		  definition.triggerType === AlertTriggerType.HEALTH_STATUS &&
		  definition.condition.componentId === componentId
		) {
		  this.evaluateHealthAlert(definition, componentId, newStatus);
		}
	  }
	});

	healthMonitor.on('systemStatusChanged', (oldStatus, newStatus) => {
	  // Check system health-based alert definitions
	  for (const definition of this.alertDefinitions.values()) {
		if (
		  definition.enabled &&
		  definition.triggerType === AlertTriggerType.HEALTH_STATUS &&
		  !definition.condition.componentId // System-wide alert
		) {
		  this.evaluateHealthAlert(definition, 'system', newStatus);
		}
	  }
	});
  }

  /**
   * Start checking for alert conditions
   */
  startChecking(): void {
	// Stop existing timer if any
	this.stopChecking();

	// Start new timer
	this.checkTimer = setInterval(() => {
	  this.checkAlertConditions();
	}, this.options.checkInterval);

	// Run initial check
	this.checkAlertConditions();
  }

  /**
   * Stop checking for alert conditions
   */
  stopChecking(): void {
	if (this.checkTimer) {
	  clearInterval(this.checkTimer);
	  this.checkTimer = null;
	}
  }

  /**
   * Check all alert conditions
   * 
   * @private
   */
  private async checkAlertConditions(): Promise<void> {
	for (const definition of this.alertDefinitions.values()) {
	  if (!definition.enabled) {
		continue;
	  }

	  try {
		switch (definition.triggerType) {
		  case AlertTriggerType.METRIC_THRESHOLD:
			await this.evaluateMetricAlert(definition);
			break;
		  case AlertTriggerType.ERROR_RATE:
			await this.evaluateErrorRateAlert(definition);
			break;
		  case AlertTriggerType.LATENCY:
			await this.evaluateLatencyAlert(definition);
			break;
		  case AlertTriggerType.THROUGHPUT:
			await this.evaluateThroughputAlert(definition);
			break;
		  case AlertTriggerType.CUSTOM:
			if (definition.condition.customEvaluator) {
			  await this.evaluateCustomAlert(definition);
			}
			break;
		  // Health status alerts are handled by event listeners
		}
	  } catch (error) {
		this.emit('error', error instanceof Error ? error : new Error(String(error)));
		
		if (this.options.enableLogging) {
		  console.error(`[AlertManager] Error evaluating alert ${definition.name}:`, error);
		}
	  }
	}

	// Check for auto-resolving alerts
	this.checkAutoResolve();
  }

  /**
   * Evaluate a metric-based alert
   * 
   * @param definition - The alert definition
   * @private
   */
  private async evaluateMetricAlert(definition: AlertDefinition): Promise<void> {
	if (!definition.condition.metricType || definition.condition.threshold === undefined) {
	  return;
	}

	// Get the current metric value
	const snapshot = metricsCollector.getMetricsSnapshot();
	const metricKey = this.getMetricKey(definition.condition.metricType, definition.condition.metricTags);
	const metric = snapshot.metrics[metricKey];

	if (!metric) {
	  return;
	}

	// Evaluate the condition
	const threshold = Number(definition.condition.threshold);
	let triggered = false;

	switch (definition.condition.operator) {
	  case AlertOperator.GREATER_THAN:
		triggered = metric.avg > threshold;
		break;
	  case AlertOperator.LESS_THAN:
		triggered = metric.avg < threshold;
		break;
	  case AlertOperator.EQUALS:
		triggered = Math.abs(metric.avg - threshold) < 0.0001; // Approximate equality for floating point
		break;
	  case AlertOperator.NOT_EQUALS:
		triggered = Math.abs(metric.avg - threshold) >= 0.0001;
		break;
	}

	if (triggered) {
	  this.triggerAlert(definition, {
		message: `Metric ${definition.condition.metricType} ${this.getOperatorText(definition.condition.operator)} ${threshold}`,
		details: {
		  metricType: definition.condition.metricType,
		  metricValue: metric.avg,
		  threshold,
		  operator: definition.condition.operator
		}
	  });
	} else {
	  this.resolveAlert(definition.id);
	}
  }

  /**
   * Evaluate a health status-based alert
   * 
   * @param definition - The alert definition
   * @param componentId - The component ID
   * @param status - The health status
   * @private
   */
  private evaluateHealthAlert(
	definition: AlertDefinition,
	componentId: string,
	status: HealthStatus
  ): void {
	if (!definition.condition.healthStatus) {
	  return;
	}

	// Evaluate the condition
	let triggered = false;

	switch (definition.condition.operator) {
	  case AlertOperator.EQUALS:
		triggered = status === definition.condition.healthStatus;
		break;
	  case AlertOperator.NOT_EQUALS:
		triggered = status !== definition.condition.healthStatus;
		break;
	}

	if (triggered) {
	  this.triggerAlert(definition, {
		message: `Component ${componentId} health status is ${status}`,
		details: {
		  componentId,
		  healthStatus: status,
		  expectedStatus: definition.condition.healthStatus,
		  operator: definition.condition.operator
		}
	  });
	} else {
	  this.resolveAlert(definition.id);
	}
  }

  /**
   * Evaluate an error rate alert
   * 
   * @param definition - The alert definition
   * @private
   */
  private async evaluateErrorRateAlert(definition: AlertDefinition): Promise<void> {
	if (definition.condition.threshold === undefined) {
	  return;
	}

	// Get error rate from metrics
	const snapshot = metricsCollector.getMetricsSnapshot();
	const sentKey = this.getMetricKey(MetricType.MESSAGES_SENT, definition.condition.metricTags);
	const failedKey = this.getMetricKey(MetricType.MESSAGES_FAILED, definition.condition.metricTags);
	
	const sentMetric = snapshot.metrics[sentKey];
	const failedMetric = snapshot.metrics[failedKey];

	if (!sentMetric || !failedMetric || sentMetric.count === 0) {
	  return;
	}

	// Calculate error rate
	const errorRate = (failedMetric.count / sentMetric.count) * 100;
	const threshold = Number(definition.condition.threshold);
	let triggered = false;

	switch (definition.condition.operator) {
	  case AlertOperator.GREATER_THAN:
		triggered = errorRate > threshold;
		break;
	  case AlertOperator.LESS_THAN:
		triggered = errorRate < threshold;
		break;
	  case AlertOperator.EQUALS:
		triggered = Math.abs(errorRate - threshold) < 0.1; // Within 0.1%
		break;
	  case AlertOperator.NOT_EQUALS:
		triggered = Math.abs(errorRate - threshold) >= 0.1;
		break;
	}

	if (triggered) {
	  this.triggerAlert(definition, {
		message: `Error rate ${this.getOperatorText(definition.condition.operator)} ${threshold}%`,
		details: {
		  errorRate,
		  threshold,
		  operator: definition.condition.operator,
		  messagesSent: sentMetric.count,
		  messagesFailed: failedMetric.count
		}
	  });
	} else {
	  this.resolveAlert(definition.id);
	}
  }

  /**
   * Evaluate a latency alert
   * 
   * @param definition - The alert definition
   * @private
   */
  private async evaluateLatencyAlert(definition: AlertDefinition): Promise<void> {
	if (definition.condition.threshold === undefined) {
	  return;
	}

	// Get average latency from metrics
	const avgLatency = metricsCollector.getAverageLatency();
	const threshold = Number(definition.condition.threshold);
	let triggered = false;

	switch (definition.condition.operator) {
	  case AlertOperator.GREATER_THAN:
		triggered = avgLatency > threshold;
		break;
	  case AlertOperator.LESS_THAN:
		triggered = avgLatency < threshold;
		break;
	  case AlertOperator.EQUALS:
		triggered = Math.abs(avgLatency - threshold) < 1; // Within 1ms
		break;
	  case AlertOperator.NOT_EQUALS:
		triggered = Math.abs(avgLatency - threshold) >= 1;
		break;
	}

	if (triggered) {
	  this.triggerAlert(definition, {
		message: `Average latency ${this.getOperatorText(definition.condition.operator)} ${threshold}ms`,
		details: {
		  avgLatency,
		  threshold,
		  operator: definition.condition.operator
		}
	  });
	} else {
	  this.resolveAlert(definition.id);
	}
  }

  /**
   * Evaluate a throughput alert
   * 
   * @param definition - The alert definition
   * @private
   */
  private async evaluateThroughputAlert(definition: AlertDefinition): Promise<void> {
	if (definition.condition.threshold === undefined) {
	  return;
	}

	// Get throughput from metrics
	const throughput = metricsCollector.getThroughput();
	const threshold = Number(definition.condition.threshold);
	let triggered = false;

	switch (definition.condition.operator) {
	  case AlertOperator.GREATER_THAN:
		triggered = throughput > threshold;
		break;
	  case AlertOperator.LESS_THAN:
		triggered = throughput < threshold;
		break;
	  case AlertOperator.EQUALS:
		triggered = Math.abs(throughput - threshold) < 0.1; // Within 0.1 msg/s
		break;
	  case AlertOperator.NOT_EQUALS:
		triggered = Math.abs(throughput - threshold) >= 0.1;
		break;
	}

	if (triggered) {
	  this.triggerAlert(definition, {
		message: `Throughput ${this.getOperatorText(definition.condition.operator)} ${threshold} messages/second`,
		details: {
		  throughput,
		  threshold,
		  operator: definition.condition.operator
		}
	  });
	} else {
	  this.resolveAlert(definition.id);
	}
  }

  /**
   * Evaluate a custom alert
   * 
   * @param definition - The alert definition
   * @private
   */
  private async evaluateCustomAlert(definition: AlertDefinition): Promise<void> {
	if (!definition.condition.customEvaluator) {
	  return;
	}

	try {
	  // Get data for the evaluator
	  const data = {
		metrics: metricsCollector.getMetricsSnapshot(),
		health: healthMonitor.getSystemHealthStatus()
	  };

	  // Evaluate the condition
	  const triggered = definition.condition.customEvaluator(data);

	  if (triggered) {
		this.triggerAlert(definition, {
		  message: `Custom alert condition triggered: ${definition.name}`,
		  details: {
			data
		  }
		});
	  } else {
		this.resolveAlert(definition.id);
	  }
	} catch (error) {
	  this.emit('error', error instanceof Error ? error : new Error(String(error)));
	  
	  if (this.options.enableLogging) {
		console.error(`[AlertManager] Error evaluating custom alert ${definition.name}:`, error);
	  }
	}
  }

  /**
   * Check for auto-resolving alerts
   * 
   * @private
   */
  private checkAutoResolve(): void {
	const now = Date.now();

	for (const [alertId, alert] of this.activeAlerts.entries()) {
	  const definition = this.alertDefinitions.get(alert.definitionId);

	  if (!definition || !definition.autoResolve || !definition.autoResolveAfter) {
		continue;
	  }

	  // Check if the alert should auto-resolve
	  if (now - alert.updatedAt > definition.autoResolveAfter) {
		this.resolveAlert(alertId, 'auto-resolve');
	  }
	}
  }

  /**
   * Trigger an alert
   * 
   * @param definition - The alert definition
   * @param data - The alert data
   * @private
   */
  private triggerAlert(
	definition: AlertDefinition,
	data: { message: string; details?: Record<string, any> }
  ): void {
	const now = Date.now();
	const alertId = `${definition.id}-${now}`;

	// Check if there's already an active alert for this definition
	const existingAlert = Array.from(this.activeAlerts.values()).find(
	  alert => alert.definitionId === definition.id && alert.status === AlertStatus.ACTIVE
	);

	if (existingAlert) {
	  // Update existing alert
	  existingAlert.count++;
	  existingAlert.updatedAt = now;
	  existingAlert.message = data.message;
	  
	  if (data.details) {
		existingAlert.details = { ...existingAlert.details, ...data.details };
	  }

	  this.activeAlerts.set(existingAlert.id, existingAlert);

	  // Add to history
	  this.addAlertHistory(existingAlert.id, {
		alertId: existingAlert.id,
		timestamp: now,
		status: AlertStatus.ACTIVE,
		message: `Alert triggered again: ${data.message}`
	  });

	  if (this.options.enableLogging) {
		console.log(`[AlertManager] Alert triggered again: ${definition.name} (${existingAlert.id})`);
	  }

	  return;
	}

	// Create new alert
	const alert: Alert = {
	  id: alertId,
	  definitionId: definition.id,
	  name: definition.name,
	  description: definition.description,
	  severity: definition.severity,
	  status: AlertStatus.ACTIVE,
	  message: data.message,
	  details: data.details,
	  createdAt: now,
	  updatedAt: now,
	  count: 1,
	  tags: definition.tags
	};

	this.activeAlerts.set(alertId, alert);

	// Add to history
	this.addAlertHistory(alertId, {
	  alertId,
	  timestamp: now,
	  status: AlertStatus.ACTIVE,
	  message: `Alert triggered: ${data.message}`
	});

	// Emit event
	this.emit('alertTriggered', alert);

	// Send notifications
	this.sendAlertNotifications(alert);

	if (this.options.enableLogging) {
	  console.log(`[AlertManager] Alert triggered: ${definition.name} (${alertId})`);
	}
  }

  /**
   * Resolve an alert
   * 
   * @param alertId - The alert ID or definition ID
   * @param resolvedBy - Who resolved the alert
   * @returns True if the alert was resolved
   */
  resolveAlert(alertId: string, resolvedBy?: string): boolean {
	// Check if this is a definition ID
	if (!this.activeAlerts.has(alertId)) {
	  // Look for active alerts with this definition ID
	  const alertWithDefinition = Array.from(this.activeAlerts.values()).find(
		alert => alert.definitionId === alertId && alert.status === AlertStatus.ACTIVE
	  );

	  if (!alertWithDefinition) {
		return false;
	  }

	  alertId = alertWithDefinition.id;
	}

	const alert = this.activeAlerts.get(alertId);
	if (!alert || alert.status !== AlertStatus.ACTIVE) {
	  return false;
	}

	// Update alert
	alert.status = AlertStatus.RESOLVED;
	alert.resolvedAt = Date.now();
	alert.resolvedBy = resolvedBy;
	alert.updatedAt = Date.now();

	this.activeAlerts.set(alertId, alert);

	// Add to history
	this.addAlertHistory(alertId, {
	  alertId,
	  timestamp: Date.now(),
	  status: AlertStatus.RESOLVED,
	  message: `Alert resolved${resolvedBy ? ` by ${resolvedBy}` : ''}`,
	  actor: resolvedBy
	});

	// Emit event
	this.emit('alertResolved', alert);

	if (this.options.enableLogging) {
	  console.log(`[AlertManager] Alert resolved: ${alert.name} (${alertId})`);
	}

	return true;
  }

  /**
   * Acknowledge an alert
   * 
   * @param alertId - The alert ID
   * @param acknowledgedBy - Who acknowledged the alert
   * @returns True if the alert was acknowledged
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
	const alert = this.activeAlerts.get(alertId);
	if (!alert || alert.status !== AlertStatus.ACTIVE) {
	  return false;
	}

	// Update alert
	alert.status = AlertStatus.ACKNOWLEDGED;
	alert.acknowledgedAt = Date.now();
	alert.acknowledgedBy = acknowledgedBy;
	alert.updatedAt = Date.now();

	this.activeAlerts.set(alertId, alert);

	// Add to history
	this.addAlertHistory(alertId, {
	  alertId,
	  timestamp: Date.now(),
	  status: AlertStatus.ACKNOWLEDGED,
	  message: `Alert acknowledged by ${acknowledgedBy}`,
	  actor: acknowledgedBy
	});

	// Emit event
	this.emit('alertAcknowledged', alert, acknowledgedBy);

	if (this.options.enableLogging) {
	  console.log(`[AlertManager] Alert acknowledged: ${alert.name} (${alertId}) by ${acknowledgedBy}`);
	}

	return true;
  }

  /**
   * Mute an alert
   * 
   * @param alertId - The alert ID
   * @param mutedBy - Who muted the alert
   * @returns True if the alert was muted
   */
  muteAlert(alertId: string, mutedBy: string): boolean {
	const alert = this.activeAlerts.get(alertId);
	if (!alert || alert.status === AlertStatus.RESOLVED) {
	  return false;
	}

	// Update alert
	alert.status = AlertStatus.MUTED;
	alert.updatedAt = Date.now();

	this.activeAlerts.set(alertId, alert);

	// Add to history
	this.addAlertHistory(alertId, {
	  alertId,
	  timestamp: Date.now(),
	  status: AlertStatus.MUTED,
	  message: `Alert muted by ${mutedBy}`,
	  actor: mutedBy
	});

	// Emit event
	this.emit('alertMuted', alert, mutedBy);

	if (this.options.enableLogging) {
	  console.log(`[AlertManager] Alert muted: ${alert.name} (${alertId}) by ${mutedBy}`);
	}

	return true;
  }

  /**
   * Add an alert history entry
   * 
   * @param alertId - The alert ID
   * @param entry - The history entry
   * @private
   */
  private addAlertHistory(alertId: string, entry: AlertHistoryEntry): void {
	if (!this.alertHistory.has(alertId)) {
	  this.alertHistory.set(alertId, []);
	}

	const history = this.alertHistory.get(alertId)!;
	history.push(entry);

	// Trim history if it exceeds the maximum
	if (history.length > this.options.maxAlertHistory) {
	  this.alertHistory.set(alertId, history.slice(-this.options.maxAlertHistory));
	}
  }

  /**
   * Send notifications for an alert
   * 
   * @param alert - The alert to send notifications for
   * @private
   */
  private sendAlertNotifications(alert: Alert): void {
	const definition = this.alertDefinitions.get(alert.definitionId);
	if (!definition) {
	  return;
	}

	for (const channelConfig of definition.notificationChannels) {
	  const channel = this.notificationChannels.get(channelConfig.id);
	  if (!channel || !channel.enabled) {
		continue;
	  }

	  try {
		switch (channel.type) {
		  case NotificationChannelType.CONSOLE:
			this.sendConsoleNotification(alert);
			break;
		  case NotificationChannelType.EVENT:
			this.sendEventNotification(alert);
			break;
		  case NotificationChannelType.NATS:
			this.sendNatsNotification(alert, channel.config);
			break;
		  case NotificationChannelType.CUSTOM:
			// Custom notification would be implemented by the application
			break;
		}
	  } catch (error) {
		this.emit('error', error instanceof Error ? error : new Error(String(error)));
		
		if (this.options.enableLogging) {
		  console.error(`[AlertManager] Error sending notification for alert ${alert.id} to channel ${channel.id}:`, error);
		}
	  }
	}
  }

  /**
   * Send a console notification
   * 
   * @param alert - The alert to send a notification for
   * @private
   */
  private sendConsoleNotification(alert: Alert): void {
	const severity = alert.severity.toUpperCase();
	console.log(`[ALERT:${severity}] ${alert.name}: ${alert.message}`);
  }

  /**
   * Send an event notification
   * 
   * @param alert - The alert to send a notification for
   * @private
   */
  private sendEventNotification(alert: Alert): void {
	// This just emits the event, which was already done in triggerAlert
	// No additional action needed
  }

  /**
   * Send a NATS notification
   * 
   * @param alert - The alert to send a notification for
   * @param config - The channel configuration
   * @private
   */
  private sendNatsNotification(alert: Alert, config: Record<string, any>): void {
	if (!this.natsClient.isConnected) {
	  return;
	}

	const subject = config.subject || 'alerts';
	// Create a proper Message object from the alert
	this.natsClient.publish(`${subject}.${alert.severity.toLowerCase()}`, {
	  type: MessageType.ERROR, // Using ERROR type for alerts
	  headers: {
		correlationId: alert.id,
		messageId: `alert-${alert.id}`,
		timestamp: new Date().toISOString(),
		source: 'alert-manager'
	  },
	  payload: alert
	});
  }

  /**
   * Register a notification channel
   * 
   * @param channel - The notification channel to register
   * @returns The channel ID
   */
  registerNotificationChannel(channel: NotificationChannel): string {
	this.notificationChannels.set(channel.id, channel);
	return channel.id;
  }

  /**
   * Unregister a notification channel
   * 
   * @param channelId - The channel ID to unregister
   * @returns True if the channel was unregistered
   */
  unregisterNotificationChannel(channelId: string): boolean {
	return this.notificationChannels.delete(channelId);
  }

  /**
   * Add an alert definition
   * 
   * @param definition - The alert definition to add
   * @returns The definition ID
   */
  addAlertDefinition(definition: AlertDefinition): string {
	// Generate ID if not provided
	if (!definition.id) {
	  definition.id = uuidv4();
	}

	this.alertDefinitions.set(definition.id, definition);
	this.emit('alertDefinitionAdded', definition);
	
	if (this.options.enableLogging) {
	  console.log(`[AlertManager] Added alert definition: ${definition.name} (${definition.id})`);
	}
	
	return definition.id;
  }

  /**
   * Update an alert definition
   * 
   * @param definition - The alert definition to update
   * @returns True if the definition was updated
   */
  updateAlertDefinition(definition: AlertDefinition): boolean {
	if (!this.alertDefinitions.has(definition.id)) {
	  return false;
	}

	this.alertDefinitions.set(definition.id, definition);
	this.emit('alertDefinitionUpdated', definition);
	
	if (this.options.enableLogging) {
	  console.log(`[AlertManager] Updated alert definition: ${definition.name} (${definition.id})`);
	}
	
	return true;
  }

  /**
   * Remove an alert definition
   * 
   * @param definitionId - The definition ID to remove
   * @returns True if the definition was removed
   */
  removeAlertDefinition(definitionId: string): boolean {
	if (!this.alertDefinitions.has(definitionId)) {
	  return false;
	}

	this.alertDefinitions.delete(definitionId);
	this.emit('alertDefinitionRemoved', definitionId);
	
	if (this.options.enableLogging) {
	  console.log(`[AlertManager] Removed alert definition: ${definitionId}`);
	}
	
	// Resolve any active alerts for this definition
	for (const alert of this.activeAlerts.values()) {
	  if (alert.definitionId === definitionId && alert.status === AlertStatus.ACTIVE) {
		this.resolveAlert(alert.id, 'definition-removed');
	  }
	}
	
	return true;
  }

  /**
   * Get an alert definition
   * 
   * @param definitionId - The definition ID
   * @returns The alert definition or undefined if not found
   */
  getAlertDefinition(definitionId: string): AlertDefinition | undefined {
	return this.alertDefinitions.get(definitionId);
  }

  /**
   * Get all alert definitions
   * 
   * @returns Array of all alert definitions
   */
  getAllAlertDefinitions(): AlertDefinition[] {
	return Array.from(this.alertDefinitions.values());
  }

  /**
   * Get an active alert
   * 
   * @param alertId - The alert ID
   * @returns The alert or undefined if not found
   */
  getAlert(alertId: string): Alert | undefined {
	return this.activeAlerts.get(alertId);
  }

  /**
   * Get all active alerts
   * 
   * @returns Array of all active alerts
   */
  getAllAlerts(): Alert[] {
	return Array.from(this.activeAlerts.values());
  }

  /**
   * Get alert history for an alert
   * 
   * @param alertId - The alert ID
   * @returns Array of history entries or empty array if not found
   */
  getAlertHistory(alertId: string): AlertHistoryEntry[] {
	return this.alertHistory.get(alertId) || [];
  }

  /**
   * Get a notification channel
   * 
   * @param channelId - The channel ID
   * @returns The notification channel or undefined if not found
   */
  getNotificationChannel(channelId: string): NotificationChannel | undefined {
    return this.notificationChannels.get(channelId);
  }

  /**
   * Get all notification channels
   * 
   * @returns Array of all notification channels
   */
  getAllNotificationChannels(): NotificationChannel[] {
    return Array.from(this.notificationChannels.values());
  }

  /**
   * Get a unique key for a metric based on type and tags
   * 
   * @param type - The metric type
   * @param tags - Optional tags for the metric
   * @returns A unique key for the metric
   * @private
   */
  private getMetricKey(type: MetricType | string, tags?: Record<string, string>): string {
    if (!tags || Object.keys(tags).length === 0) {
      return type;
    }
    
    // Sort tags by key for consistent key generation
    const sortedTags = Object.entries(tags)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([key, value]) => `${key}=${value}`)
      .join(',');
    
    return `${type}[${sortedTags}]`;
  }

  /**
   * Get a text representation of an operator
   * 
   * @param operator - The operator
   * @returns Text representation of the operator
   * @private
   */
  private getOperatorText(operator: AlertOperator): string {
    switch (operator) {
      case AlertOperator.GREATER_THAN:
        return 'is greater than';
      case AlertOperator.LESS_THAN:
        return 'is less than';
      case AlertOperator.EQUALS:
        return 'equals';
      case AlertOperator.NOT_EQUALS:
        return 'does not equal';
      case AlertOperator.CONTAINS:
        return 'contains';
      case AlertOperator.NOT_CONTAINS:
        return 'does not contain';
      default:
        return operator;
    }
  }
}

// Create and export a singleton instance
export const alertManager = new AlertManager();
