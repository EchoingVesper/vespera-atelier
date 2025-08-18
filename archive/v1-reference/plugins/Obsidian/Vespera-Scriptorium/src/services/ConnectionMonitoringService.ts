/**
 * ConnectionMonitoringService
 * 
 * A service for monitoring the connection status of the LLM provider.
 * It tests the connection on initialization and periodically thereafter,
 * stores the connection state persistently, and provides methods to
 * subscribe to connection status changes.
 */

import { App, Notice } from 'obsidian';
import { LLMClient } from '../LLMClient';
import { ErrorHandler } from '../utils/ErrorHandler';

/**
 * Interface for connection status details
 */
export interface ConnectionStatus {
  isConnected: boolean;
  lastChecked: number;
  lastSuccessful: number | null;
  consecutiveFailures: number;
  provider: string;
  endpoint: string;
  error?: string;
}

/**
 * Type for connection status callback function
 */
export type ConnectionStatusCallback = (status: ConnectionStatus) => void;

/**
 * ConnectionMonitoringService class
 */
export class ConnectionMonitoringService {
  private app: App;
  private llmClient: LLMClient;
  private status: ConnectionStatus;
  private callbacks: ConnectionStatusCallback[] = [];
  private checkInterval: number = 5 * 60 * 1000; // 5 minutes by default
  private intervalId: number | null = null;
  private errorHandler: ErrorHandler = ErrorHandler.getInstance();
  
  /**
   * Create a new ConnectionMonitoringService
   * 
   * @param app The Obsidian app instance
   * @param llmClient The LLM client
   * @param initialCheckInterval Optional initial check interval in milliseconds
   */
  constructor(app: App, llmClient: LLMClient, initialCheckInterval?: number) {
    this.app = app;
    this.llmClient = llmClient;
    
    if (initialCheckInterval) {
      this.checkInterval = initialCheckInterval;
    }
    
    // Initialize status with default values
    this.status = {
      isConnected: false,
      lastChecked: 0,
      lastSuccessful: null,
      consecutiveFailures: 0,
      provider: llmClient.getProviderType(),
      endpoint: llmClient.getEndpoint(),
      error: undefined
    };
    
    // Load persisted status if available
    this.loadStatus();
  }
  
  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    try {
      console.log("ConnectionMonitoringService: Initializing");
      
      // Check connection immediately
      await this.checkConnection();
      
      // Start periodic checking
      this.startPeriodicChecking();
      
      console.log("ConnectionMonitoringService: Initialized successfully");
    } catch (error) {
      this.errorHandler.handleError(error instanceof Error ? error : String(error), false);
      console.error("ConnectionMonitoringService: Failed to initialize", error);
    }
  }
  
  /**
   * Clean up the service
   */
  cleanup(): void {
    this.stopPeriodicChecking();
  }
  
  /**
   * Check the connection to the LLM provider
   */
  async checkConnection(): Promise<boolean> {
    try {
      console.log("ConnectionMonitoringService: Checking connection");
      
      // Update last checked timestamp
      this.status.lastChecked = Date.now();
      
      // Test connection
      const isConnected = await this.llmClient.testConnection();
      
      // Update status
      if (isConnected) {
        this.status.isConnected = true;
        this.status.lastSuccessful = Date.now();
        this.status.consecutiveFailures = 0;
        this.status.error = undefined;
        console.log("ConnectionMonitoringService: Connection successful");
      } else {
        this.status.isConnected = false;
        this.status.consecutiveFailures++;
        this.status.error = "Connection test failed";
        console.warn("ConnectionMonitoringService: Connection test failed");
        
        // Show notice if this is a new failure (was previously connected)
        if (this.status.consecutiveFailures === 1 && this.status.lastSuccessful !== null) {
          new Notice("Vespera Scriptorium: Lost connection to LLM provider. Some features may not work correctly.");
        }
      }
      
      // Persist status
      this.saveStatus();
      
      // Notify callbacks
      this.notifyCallbacks();
      
      return isConnected;
    } catch (error) {
      this.errorHandler.handleError(error instanceof Error ? error : String(error), false);
      console.error("ConnectionMonitoringService: Error checking connection", error);
      
      // Update status
      this.status.isConnected = false;
      this.status.consecutiveFailures++;
      this.status.error = error instanceof Error ? error.message : String(error);
      
      // Persist status
      this.saveStatus();
      
      // Notify callbacks
      this.notifyCallbacks();
      
      return false;
    }
  }
  
  /**
   * Start periodic connection checking
   */
  startPeriodicChecking(): void {
    if (this.intervalId !== null) {
      // Already running
      return;
    }
    
    console.log(`ConnectionMonitoringService: Starting periodic checking every ${this.checkInterval / 1000} seconds`);
    
    this.intervalId = window.setInterval(() => {
      this.checkConnection().catch(error => {
        console.error("ConnectionMonitoringService: Error in periodic check", error);
      });
    }, this.checkInterval);
  }
  
  /**
   * Stop periodic connection checking
   */
  stopPeriodicChecking(): void {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("ConnectionMonitoringService: Stopped periodic checking");
    }
  }
  
  /**
   * Set the check interval
   * 
   * @param interval The check interval in milliseconds
   */
  setCheckInterval(interval: number): void {
    this.checkInterval = interval;
    
    // Restart periodic checking with new interval
    if (this.intervalId !== null) {
      this.stopPeriodicChecking();
      this.startPeriodicChecking();
    }
  }
  
  /**
   * Get the current connection status
   */
  getStatus(): ConnectionStatus {
    return { ...this.status }; // Return a copy to prevent modification
  }
  
  /**
   * Register a callback to be notified when the connection status changes
   * 
   * @param callback The callback function
   * @returns A function to unregister the callback
   */
  onConnectionStatusChange(callback: ConnectionStatusCallback): () => void {
    this.callbacks.push(callback);
    
    // Immediately notify with current status
    try {
      callback(this.getStatus());
    } catch (error) {
      console.error("ConnectionMonitoringService: Error in callback", error);
    }
    
    // Return unsubscribe function
    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callback);
    };
  }
  
  /**
   * Notify all registered callbacks of the current status
   */
  private notifyCallbacks(): void {
    const status = this.getStatus();
    
    for (const callback of this.callbacks) {
      try {
        callback(status);
      } catch (error) {
        console.error("ConnectionMonitoringService: Error in callback", error);
      }
    }
  }
  
  /**
   * Save the connection status to plugin data
   */
  private saveStatus(): void {
    try {
      // Store in localStorage for persistence
      localStorage.setItem('vespera-connection-status', JSON.stringify(this.status));
    } catch (error) {
      console.error("ConnectionMonitoringService: Failed to save status", error);
    }
  }
  
  /**
   * Load the connection status from plugin data
   */
  private loadStatus(): void {
    try {
      const savedStatus = localStorage.getItem('vespera-connection-status');
      
      if (savedStatus) {
        const parsedStatus = JSON.parse(savedStatus) as ConnectionStatus;
        
        // Update status with saved values, but keep current provider and endpoint
        this.status = {
          ...parsedStatus,
          provider: this.llmClient.getProviderType(),
          endpoint: this.llmClient.getEndpoint()
        };
        
        console.log("ConnectionMonitoringService: Loaded saved status", this.status);
      }
    } catch (error) {
      console.error("ConnectionMonitoringService: Failed to load status", error);
    }
  }
}