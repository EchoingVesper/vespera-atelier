# Alert Management System

The alert management system provides alert triggers, severity levels, and notification mechanisms based on metrics and health status.

## Overview

The AlertManager class handles:
- Alert definition management
- Condition monitoring
- Alert triggering and resolution
- Notification delivery
- Alert history tracking

## Alert Severity Levels

```typescript
enum AlertSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}
```

## Usage Example

```typescript
import { alertManager, AlertSeverity, AlertTriggerType, AlertOperator } from '../core/messaging/alertManager';
import { MetricType } from '../core/messaging/metricsCollector';

// Define an alert for high message failure rate
const alertDefinition = {
  id: 'high-failure-rate',
  name: 'High Message Failure Rate',
  severity: AlertSeverity.ERROR,
  triggerType: AlertTriggerType.ERROR_RATE,
  condition: {
    operator: AlertOperator.GREATER_THAN,
    threshold: 5.0  // 5% failure rate
  },
  notificationChannels: ['console', 'nats'],
  enabled: true,
  autoResolve: true,
  autoResolveAfter: 300000  // Auto-resolve after 5 minutes
};

alertManager.addAlertDefinition(alertDefinition);

// Handle alert events
alertManager.on('alertTriggered', (alert) => {
  console.log(`Alert triggered: ${alert.name}`);
});
```

**Last Updated**: 2025-05-26
