/**
 * Unit tests for the alert management system
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AlertManager, AlertDefinition, AlertSeverity, AlertTriggerType, AlertOperator, AlertStatus, NotificationChannelType, AlertManagerOptions } from '../../../src/core/messaging/alertManager';
import { MetricType } from '../../../src/core/messaging/metricsCollector';
import { HealthStatus } from '../../../src/core/messaging/healthMonitor';

describe('AlertManager', () => {
  let alertManager: AlertManager;
  let options: AlertManagerOptions;
  
  beforeEach(() => {
    // Create options for testing with faster intervals
    options = {
      checkInterval: 100, // 100ms for faster tests
      maxAlertHistory: 50,
      enableLogging: false
    };
    
    alertManager = new AlertManager(options);
  });
  
  afterEach(() => {
    // Clean up
    alertManager.stopChecking();
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  describe('Alert Definition Management', () => {
    it('should add an alert definition', () => {
      const definition: AlertDefinition = {
        id: 'test-alert',
        name: 'Test Alert',
        description: 'A test alert',
        severity: AlertSeverity.WARNING,
        triggerType: AlertTriggerType.METRIC_THRESHOLD,
        condition: {
          operator: AlertOperator.GREATER_THAN,
          threshold: 100,
          metricType: MetricType.MESSAGES_SENT
        },
        notificationChannels: [],
        enabled: true
      };

      const addedId = alertManager.addAlertDefinition(definition);
      expect(addedId).toBe('test-alert');
      
      const retrieved = alertManager.getAlertDefinition('test-alert');
      expect(retrieved).toEqual(definition);
    });

    it('should update an alert definition', () => {
      const definition: AlertDefinition = {
        id: 'test-alert',
        name: 'Test Alert',
        severity: AlertSeverity.WARNING,
        triggerType: AlertTriggerType.METRIC_THRESHOLD,
        condition: { operator: AlertOperator.GREATER_THAN, threshold: 100 },
        notificationChannels: [],
        enabled: true
      };

      alertManager.addAlertDefinition(definition);
      
      const updatedDefinition = { ...definition, name: 'Updated Alert' };
      const updated = alertManager.updateAlertDefinition(updatedDefinition);
      
      expect(updated).toBe(true);
      expect(alertManager.getAlertDefinition('test-alert')?.name).toBe('Updated Alert');
    });
  });

  describe('Alert Management', () => {
    it('should acknowledge an alert', () => {
      // First create an alert definition and trigger an alert
      const definition: AlertDefinition = {
        id: 'test-alert',
        name: 'Test Alert',
        severity: AlertSeverity.WARNING,
        triggerType: AlertTriggerType.CUSTOM,
        condition: { operator: AlertOperator.EQUALS, customEvaluator: () => true },
        notificationChannels: [],
        enabled: true
      };

      alertManager.addAlertDefinition(definition);
      
      // Manually trigger alert for testing
      const mockAlert = {
        id: 'alert-1',
        definitionId: 'test-alert',
        name: 'Test Alert',
        severity: AlertSeverity.WARNING,
        status: AlertStatus.ACTIVE,
        message: 'Test alert triggered',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        count: 1
      };

      // Simulate active alert by directly setting it
      (alertManager as any).activeAlerts.set('alert-1', mockAlert);
      
      const acknowledged = alertManager.acknowledgeAlert('alert-1', 'test-user');
      expect(acknowledged).toBe(true);
    });

    it('should mute an alert', () => {
      const mockAlert = {
        id: 'alert-1',
        definitionId: 'test-alert',
        name: 'Test Alert',
        severity: AlertSeverity.WARNING,
        status: AlertStatus.ACTIVE,
        message: 'Test alert triggered',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        count: 1
      };

      (alertManager as any).activeAlerts.set('alert-1', mockAlert);
      
      const muted = alertManager.muteAlert('alert-1', 'test-user');
      expect(muted).toBe(true);
    });
  });
});
