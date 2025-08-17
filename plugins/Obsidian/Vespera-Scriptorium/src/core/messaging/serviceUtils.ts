import { ServiceInfo } from './serviceManager';

/**
 * Service health status type
 */
export type ServiceHealth = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'UNKNOWN';

/**
 * Service metrics collected from heartbeats
 */
interface ServiceMetrics {
  memoryUsage?: number;
  cpuUsage?: number;
  uptime?: number;
  responseTime?: number;
  errorRate?: number;
  lastUpdated: number;
}

/**
 * Enhanced service information with additional metadata and metrics
 */
export interface EnhancedServiceInfo extends ServiceInfo {
  metrics: ServiceMetrics;
  health: ServiceHealth;
  lastError?: string;
  dependencies?: string[];
  tags?: string[];
}

/**
 * Service discovery options
 */
export interface ServiceDiscoveryOptions {
  /**
   * Time in milliseconds to wait for service discovery
   * @default 5000
   */
  timeout?: number;
  
  /**
   * Maximum number of services to wait for
   * @default 1
   */
  count?: number;
  
  /**
   * Filter services by type
   */
  serviceType?: string;
  
  /**
   * Filter services by capability
   */
  capability?: string;
  
  /**
   * Filter services by tags
   */
  tags?: string[];
}

/**
 * Service health check result
 */
export interface HealthCheckResult {
  status: 'pass' | 'fail' | 'warn';
  timestamp: string;
  serviceId: string;
  serviceType: string;
  metrics?: Record<string, unknown>;
  details?: Record<string, unknown>;
}

/**
 * Service version information
 */
export interface ServiceVersion {
  version: string;
  build?: string;
  commit?: string;
  timestamp?: string;
}

/**
 * Service metadata utilities
 */
export class ServiceMetadata {
  /**
   * Extract version information from service metadata
   */
  static getVersion(metadata: Record<string, unknown>): ServiceVersion {
    return {
      version: metadata.version as string || '0.0.0',
      build: metadata.build as string,
      commit: metadata.commit as string,
      timestamp: metadata.timestamp as string,
    };
  }

  /**
   * Check if a service has all required capabilities
   */
  static hasCapabilities(
    service: ServiceInfo,
    requiredCapabilities: string[]
  ): boolean {
    if (!requiredCapabilities || requiredCapabilities.length === 0) {
      return true;
    }
    
    return requiredCapabilities.every(cap => 
      service.capabilities.includes(cap)
    );
  }

  /**
   * Check if a service has all required tags
   */
  static hasTags(
    service: ServiceInfo & { tags?: string[] },
    requiredTags: string[]
  ): boolean {
    if (!requiredTags || requiredTags.length === 0) {
      return true;
    }
    
    if (!service.tags || service.tags.length === 0) {
      return false;
    }
    
    return requiredTags.every(tag => service.tags?.includes(tag));
  }

  /**
   * Calculate service health based on metrics and status
   */
  static calculateHealth(
    service: ServiceInfo & { metrics?: Partial<ServiceMetrics> }
  ): ServiceHealth {
    if (service.status === 'OFFLINE') {
      return 'UNHEALTHY';
    }

    const metrics = service.metrics || {};
    const now = Date.now();
    
    // Check if metrics are stale (older than 5 minutes)
    if (metrics.lastUpdated && now - metrics.lastUpdated > 5 * 60 * 1000) {
      return 'UNKNOWN';
    }

    // Check memory usage (example threshold: 90%)
    if (metrics.memoryUsage && metrics.memoryUsage > 0.9) {
      return 'DEGRADED';
    }

    // Check error rate (example threshold: 5%)
    if (metrics.errorRate && metrics.errorRate > 0.05) {
      return 'DEGRADED';
    }

    // Check response time (example threshold: 1000ms)
    if (metrics.responseTime && metrics.responseTime > 1000) {
      return 'DEGRADED';
    }

    return 'HEALTHY';
  }
}
