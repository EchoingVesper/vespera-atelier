/**
 * Vespera Forge - Telemetry Service
 * 
 * Basic telemetry service for error tracking and usage analytics.
 * This is a placeholder implementation that can be enhanced later.
 */

import { VesperaError } from '../error-handling/VesperaErrors';

export interface TelemetryEvent {
  name: string;
  properties?: Record<string, any>;
  measurements?: Record<string, number>;
}

/**
 * Basic telemetry service for error tracking and usage analytics
 */
export class VesperaTelemetryService {
  private enabled: boolean = true;

  constructor(enabled: boolean = true) {
    this.enabled = enabled;
  }

  /**
   * Track an error event for analytics
   */
  public trackError(error: VesperaError): void {
    if (!this.enabled) {
      return;
    }

    // For now, just log the error tracking - can be enhanced with real telemetry later
    console.debug('[VesperaTelemetry] Error tracked:', {
      code: error.code,
      category: error.category,
      severity: error.severity,
      timestamp: error.metadata.timestamp
    });
  }

  /**
   * Track a general event
   */
  public trackEvent(_event: TelemetryEvent): void {
    if (!this.enabled) {
      return;
    }

    // console.debug('[VesperaTelemetry] Event tracked:', _event.name, '-', _event.duration ? `${_event.duration}ms` : 'no duration');
  }

  /**
   * Enable or disable telemetry
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if telemetry is enabled
   */
  public isEnabled(): boolean {
    return this.enabled;
  }
}