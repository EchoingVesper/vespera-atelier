/**
 * @fileoverview Lifecycle management module for disposable resources
 * @module @vespera/typescript-shared/lifecycle
 *
 * Comprehensive lifecycle management with:
 * - Enhanced disposable interfaces with state tracking
 * - Base disposable implementation with template method pattern
 * - Coordinated disposal manager with priority ordering
 * - Resource tracker with memory monitoring
 * - Lifecycle hooks for disposal events
 *
 * @example Basic usage
 * ```typescript
 * import { DisposalManager } from '@vespera/typescript-shared/lifecycle';
 *
 * const manager = new DisposalManager();
 * const resource = manager.add(new MyResource());
 * await manager.dispose();
 * ```
 *
 * @example Advanced usage with tracking
 * ```typescript
 * import { ResourceTracker } from '@vespera/typescript-shared/lifecycle';
 *
 * const tracker = new ResourceTracker();
 * tracker.registerResource('db', dbConnection, 1024 * 1024); // 1MB
 *
 * const stats = tracker.getMemoryStats();
 * console.log(`Memory: ${stats.totalBytes} bytes`);
 *
 * const cleaned = await tracker.cleanupStaleResources(60 * 60 * 1000);
 * ```
 */

// Core disposable interfaces and base implementation
export { BaseDisposable } from './disposable';
export type { EnhancedDisposable, DisposalHooks, DisposalResult } from './disposable';

// Disposal manager for coordinated resource cleanup
export { DisposalManager } from './manager';
export type { DisposalStats } from './manager';

// Resource tracker with memory monitoring
export { ResourceTracker } from './tracker';
export type { MemoryStats, StaleResourceInfo } from './tracker';
