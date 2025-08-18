/**
 * ConnectionStatusIndicator
 * 
 * A UI component that displays the connection status of the LLM provider.
 * It shows a green indicator when connected, a red indicator when disconnected,
 * and provides detailed status information on hover.
 */

import { ConnectionStatus } from '../services/ConnectionMonitoringService';

/**
 * Options for the connection status indicator
 */
export interface ConnectionStatusIndicatorOptions {
  /**
   * The parent element to attach the indicator to
   */
  parent: HTMLElement;
  
  /**
   * The position of the indicator
   * @default 'bottom-right'
   */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  
  /**
   * The size of the indicator in pixels
   * @default 12
   */
  size?: number;
  
  /**
   * Whether to show a tooltip on hover
   * @default true
   */
  showTooltip?: boolean;
  
  /**
   * Initial connection status
   */
  initialStatus?: ConnectionStatus;
  
  /**
   * Whether to add a yellow outline on hover
   * @default true
   */
  highlightOnHover?: boolean;
  
  /**
   * Z-index for the indicator
   * @default 1000
   */
  zIndex?: number;
}

/**
 * ConnectionStatusIndicator class
 */
export class ConnectionStatusIndicator {
  private options: Required<ConnectionStatusIndicatorOptions>;
  private indicator: HTMLElement;
  private tooltip: HTMLElement | null = null;
  private status: ConnectionStatus;
  
  /**
   * Create a new ConnectionStatusIndicator
   * 
   * @param options The options for the indicator
   */
  constructor(options: ConnectionStatusIndicatorOptions) {
    // Set default options
    this.options = {
      parent: options.parent,
      position: options.position || 'bottom-right',
      size: options.size || 12,
      showTooltip: options.showTooltip !== undefined ? options.showTooltip : true,
      initialStatus: options.initialStatus || {
        isConnected: false,
        lastChecked: 0,
        lastSuccessful: null,
        consecutiveFailures: 0,
        provider: 'unknown',
        endpoint: '',
        error: undefined
      },
      highlightOnHover: options.highlightOnHover !== undefined ? options.highlightOnHover : true,
      zIndex: options.zIndex || 1000
    };
    
    this.status = this.options.initialStatus;
    
    // Create the indicator element
    this.indicator = this.createIndicator();
    
    // Create the tooltip if enabled
    if (this.options.showTooltip) {
      this.tooltip = this.createTooltip();
    }
    
    // Add the indicator to the parent element
    this.options.parent.appendChild(this.indicator);
    
    // Update the indicator with the initial status
    this.updateStatus(this.status);
  }
  
  /**
   * Create the indicator element
   */
  private createIndicator(): HTMLElement {
    const indicator = document.createElement('div');
    indicator.className = 'vespera-connection-indicator';
    indicator.style.position = 'absolute';
    indicator.style.width = `${this.options.size}px`;
    indicator.style.height = `${this.options.size}px`;
    indicator.style.borderRadius = '50%';
    indicator.style.backgroundColor = '#888'; // Default gray
    indicator.style.zIndex = this.options.zIndex.toString();
    indicator.style.cursor = 'pointer';
    indicator.style.transition = 'all 0.3s ease';
    indicator.setAttribute('aria-label', 'LLM Connection Status');
    indicator.setAttribute('role', 'status');
    
    // Set position
    switch (this.options.position) {
      case 'bottom-right':
        indicator.style.bottom = '8px';
        indicator.style.right = '8px';
        break;
      case 'bottom-left':
        indicator.style.bottom = '8px';
        indicator.style.left = '8px';
        break;
      case 'top-right':
        indicator.style.top = '8px';
        indicator.style.right = '8px';
        break;
      case 'top-left':
        indicator.style.top = '8px';
        indicator.style.left = '8px';
        break;
    }
    
    // Add hover effect
    if (this.options.highlightOnHover) {
      indicator.addEventListener('mouseenter', () => {
        indicator.style.boxShadow = '0 0 0 2px rgba(255, 255, 0, 0.7)';
        indicator.style.transform = 'scale(1.1)';
        
        // Show tooltip if enabled
        if (this.tooltip) {
          this.tooltip.style.display = 'block';
          this.tooltip.style.opacity = '1';
        }
      });
      
      indicator.addEventListener('mouseleave', () => {
        indicator.style.boxShadow = 'none';
        indicator.style.transform = 'scale(1)';
        
        // Hide tooltip if enabled
        if (this.tooltip) {
          this.tooltip.style.opacity = '0';
          setTimeout(() => {
            if (this.tooltip) {
              this.tooltip.style.display = 'none';
            }
          }, 300);
        }
      });
    }
    
    return indicator;
  }
  
  /**
   * Create the tooltip element
   */
  private createTooltip(): HTMLElement {
    const tooltip = document.createElement('div');
    tooltip.className = 'vespera-connection-tooltip';
    tooltip.style.position = 'absolute';
    tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    tooltip.style.color = 'white';
    tooltip.style.padding = '8px 12px';
    tooltip.style.borderRadius = '4px';
    tooltip.style.fontSize = '12px';
    tooltip.style.lineHeight = '1.4';
    tooltip.style.maxWidth = '250px';
    tooltip.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.2)';
    tooltip.style.zIndex = (this.options.zIndex + 1).toString();
    tooltip.style.display = 'none';
    tooltip.style.opacity = '0';
    tooltip.style.transition = 'opacity 0.3s ease';
    tooltip.style.pointerEvents = 'none';
    
    // Set position based on indicator position
    switch (this.options.position) {
      case 'bottom-right':
        tooltip.style.bottom = `${this.options.size + 16}px`;
        tooltip.style.right = '8px';
        break;
      case 'bottom-left':
        tooltip.style.bottom = `${this.options.size + 16}px`;
        tooltip.style.left = '8px';
        break;
      case 'top-right':
        tooltip.style.top = `${this.options.size + 16}px`;
        tooltip.style.right = '8px';
        break;
      case 'top-left':
        tooltip.style.top = `${this.options.size + 16}px`;
        tooltip.style.left = '8px';
        break;
    }
    
    // Add to parent
    this.options.parent.appendChild(tooltip);
    
    return tooltip;
  }
  
  /**
   * Update the status of the indicator
   * 
   * @param status The new connection status
   */
  updateStatus(status: ConnectionStatus): void {
    this.status = status;
    
    // Update indicator color
    if (status.isConnected) {
      this.indicator.style.backgroundColor = '#4CAF50'; // Green
      this.indicator.setAttribute('aria-label', 'LLM Connected');
    } else {
      this.indicator.style.backgroundColor = '#F44336'; // Red
      this.indicator.setAttribute('aria-label', 'LLM Disconnected');
    }
    
    // Update tooltip content if enabled
    if (this.tooltip) {
      this.updateTooltipContent();
    }
  }
  
  /**
   * Update the tooltip content
   */
  private updateTooltipContent(): void {
    if (!this.tooltip) return;
    
    const { isConnected, lastChecked, lastSuccessful, consecutiveFailures, provider, endpoint, error } = this.status;
    
    // Format timestamps
    const lastCheckedStr = lastChecked ? new Date(lastChecked).toLocaleString() : 'Never';
    const lastSuccessfulStr = lastSuccessful ? new Date(lastSuccessful).toLocaleString() : 'Never';
    
    // Build tooltip content
    let content = `<div style="font-weight: bold; margin-bottom: 5px;">LLM Connection Status</div>`;
    content += `<div>Status: <span style="color: ${isConnected ? '#4CAF50' : '#F44336'}">${isConnected ? 'Connected' : 'Disconnected'}</span></div>`;
    content += `<div>Provider: ${provider}</div>`;
    content += `<div>Endpoint: ${endpoint}</div>`;
    content += `<div>Last Checked: ${lastCheckedStr}</div>`;
    
    if (isConnected) {
      content += `<div>Connected Since: ${lastSuccessfulStr}</div>`;
    } else {
      content += `<div>Last Connected: ${lastSuccessfulStr}</div>`;
      content += `<div>Failed Attempts: ${consecutiveFailures}</div>`;
      
      if (error) {
        content += `<div style="color: #F44336; margin-top: 5px;">Error: ${error}</div>`;
      }
    }
    
    this.tooltip.innerHTML = content;
  }
  
  /**
   * Remove the indicator from the DOM
   */
  remove(): void {
    if (this.indicator && this.indicator.parentNode) {
      this.indicator.parentNode.removeChild(this.indicator);
    }
    
    if (this.tooltip && this.tooltip.parentNode) {
      this.tooltip.parentNode.removeChild(this.tooltip);
    }
  }
}