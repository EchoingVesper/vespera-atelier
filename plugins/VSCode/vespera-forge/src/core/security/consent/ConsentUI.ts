/**
 * Consent UI Management
 * 
 * Non-intrusive UI integration for consent management with VS Code.
 * Supports multiple modes: status-bar, panel, modal, and hybrid.
 */

import * as vscode from 'vscode';
import { VesperaLogger } from '../../logging/VesperaLogger';
import { 
  ConsentPurpose, 
  ConsentConfiguration,
  ConsentPurposeGrant,
  ConsentCategory 
} from '../../../types/security';

export interface ConsentUIResponse {
  purposes: Array<{
    id: string;
    granted: boolean;
    conditions?: any;
  }>;
  timestamp: number;
  method: 'ui_interaction';
}

/**
 * Consent status bar item for non-intrusive consent management
 */
class ConsentStatusBarItem implements vscode.Disposable {
  private statusBarItem: vscode.StatusBarItem;
  private disposed = false;

  constructor(private logger: VesperaLogger) {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100 // High priority
    );
    
    this.statusBarItem.command = 'vespera-forge.manageConsent';
    this.updateDisplay('unknown', 0, 0);
    this.statusBarItem.show();
    
    this.logger.debug('ConsentStatusBarItem created');
  }

  /**
   * Update the status bar display
   */
  updateDisplay(status: 'compliant' | 'partial' | 'missing' | 'unknown', grantedCount: number, totalCount: number): void {
    if (this.disposed) return;

    const icons = {
      compliant: '$(shield-check)',
      partial: '$(shield)',  
      missing: '$(alert)',
      unknown: '$(question)'
    };

    const colors = {
      compliant: 'statusBar.foreground',
      partial: new vscode.ThemeColor('notificationsWarningIcon.foreground'),
      missing: new vscode.ThemeColor('notificationsErrorIcon.foreground'), 
      unknown: 'statusBar.foreground'
    };

    this.statusBarItem.text = `${icons[status]} ${grantedCount}/${totalCount}`;
    this.statusBarItem.color = colors[status];
    this.statusBarItem.tooltip = this.buildTooltip(status, grantedCount, totalCount);
  }

  /**
   * Build tooltip text for status bar item
   */
  private buildTooltip(status: string, grantedCount: number, totalCount: number): string {
    const statusMessages = {
      compliant: 'All required consents granted',
      partial: 'Some consents missing',
      missing: 'Required consents missing',
      unknown: 'Consent status unknown'
    };

    return `Privacy Consents: ${statusMessages[status as keyof typeof statusMessages]}\n` +
           `Granted: ${grantedCount}/${totalCount}\n` +
           `Click to manage consent preferences`;
  }

  dispose(): void {
    if (this.disposed) return;
    
    this.statusBarItem.dispose();
    this.disposed = true;
    this.logger.debug('ConsentStatusBarItem disposed');
  }
}

/**
 * Main consent UI manager
 */
export class ConsentUI implements vscode.Disposable {
  private statusBarItem?: ConsentStatusBarItem;
  private disposed = false;

  constructor(
    private uiMode: ConsentConfiguration['uiMode'],
    private logger: VesperaLogger
  ) {
    this.logger = logger.createChild('ConsentUI');
    this.initializeUI();
  }

  /**
   * Request consent from user through UI
   */
  async requestConsent(
    purposes: ConsentPurpose[], 
    context?: Record<string, any>
  ): Promise<ConsentUIResponse> {
    if (this.disposed) {
      throw new Error('ConsentUI has been disposed');
    }

    this.logger.info('Requesting consent from user', {
      purposeCount: purposes.length,
      uiMode: this.uiMode,
      context
    });

    switch (this.uiMode) {
      case 'modal':
        return this.showModalConsentDialog(purposes, context);
      case 'panel':
        return this.showPanelConsentDialog(purposes, context);
      case 'status-bar':
        return this.showStatusBarConsentDialog(purposes, context);
      case 'hybrid':
        return this.showHybridConsentDialog(purposes, context);
      default:
        return this.showModalConsentDialog(purposes, context);
    }
  }

  /**
   * Update consent status in UI
   */
  updateConsentStatus(grantedPurposes: string[], allPurposes: string[]): void {
    if (this.disposed || !this.statusBarItem) return;

    const grantedCount = grantedPurposes.length;
    const totalCount = allPurposes.length;
    
    let status: 'compliant' | 'partial' | 'missing' | 'unknown' = 'unknown';
    
    if (totalCount === 0) {
      status = 'unknown';
    } else if (grantedCount === totalCount) {
      status = 'compliant';
    } else if (grantedCount > 0) {
      status = 'partial';
    } else {
      status = 'missing';
    }

    this.statusBarItem.updateDisplay(status, grantedCount, totalCount);
  }

  /**
   * Show consent preferences panel
   */
  async showConsentPreferences(currentConsents: ConsentPurposeGrant[]): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      'vesperaConsentPreferences',
      'Privacy & Consent Preferences',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    const html = this.generateConsentPreferencesHTML(currentConsents);
    panel.webview.html = html;

    // Handle messages from webview
    panel.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'updateConsent':
            this.handleConsentUpdate(message.purposes);
            break;
          case 'exportData':
            this.handleDataExport(message.userId);
            break;
          case 'withdrawAll':
            this.handleWithdrawAll(message.userId);
            break;
        }
      },
      undefined,
      [] // Add to extension context subscriptions in real implementation
    );
  }

  /**
   * Initialize UI components based on mode
   */
  private initializeUI(): void {
    if (this.uiMode === 'status-bar' || this.uiMode === 'hybrid') {
      this.statusBarItem = new ConsentStatusBarItem(this.logger);
    }
    
    this.logger.info('ConsentUI initialized', { uiMode: this.uiMode });
  }

  /**
   * Show modal consent dialog
   */
  private async showModalConsentDialog(
    purposes: ConsentPurpose[], 
    context?: Record<string, any>
  ): Promise<ConsentUIResponse> {
    const items: vscode.QuickPickItem[] = purposes.map(purpose => ({
      label: purpose.name,
      description: purpose.description,
      detail: `Category: ${purpose.category} | Required: ${purpose.required ? 'Yes' : 'No'}`,
      picked: purpose.required // Pre-select required purposes
    }));

    const options: vscode.QuickPickOptions = {
      title: 'Privacy Consent Required',
      placeHolder: 'Select the data processing purposes you consent to',
      canPickMany: true,
      ignoreFocusOut: true
    };

    const selected = await vscode.window.showQuickPick(items, options);
    
    if (!selected) {
      // User cancelled - only grant essential purposes
      return this.createResponseWithEssentialOnly(purposes);
    }

    return this.createResponse(purposes, Array.isArray(selected) ? selected : [selected]);
  }

  /**
   * Show panel-based consent dialog
   */
  private async showPanelConsentDialog(
    purposes: ConsentPurpose[], 
    context?: Record<string, any>
  ): Promise<ConsentUIResponse> {
    return new Promise((resolve, reject) => {
      const panel = vscode.window.createWebviewPanel(
        'vesperaConsentRequest',
        'Privacy Consent Required',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: false
        }
      );

      const html = this.generateConsentRequestHTML(purposes, context);
      panel.webview.html = html;

      const timeout = setTimeout(() => {
        panel.dispose();
        resolve(this.createResponseWithEssentialOnly(purposes));
      }, 300000); // 5 minute timeout

      panel.webview.onDidReceiveMessage(
        message => {
          clearTimeout(timeout);
          
          if (message.command === 'consent') {
            resolve(this.createResponse(purposes, message.grantedPurposes));
          } else if (message.command === 'cancel') {
            resolve(this.createResponseWithEssentialOnly(purposes));
          }
          
          panel.dispose();
        },
        undefined,
        []
      );

      panel.onDidDispose(() => {
        clearTimeout(timeout);
        resolve(this.createResponseWithEssentialOnly(purposes));
      });
    });
  }

  /**
   * Show status-bar based consent dialog
   */
  private async showStatusBarConsentDialog(
    purposes: ConsentPurpose[], 
    context?: Record<string, any>
  ): Promise<ConsentUIResponse> {
    // For status-bar mode, show a notification with action buttons
    const requiredCount = purposes.filter(p => p.required).length;
    const message = `Privacy consent required for ${requiredCount} purposes`;
    
    const action = await vscode.window.showInformationMessage(
      message,
      { modal: false },
      'Grant All Required',
      'Customize',
      'Deny Optional'
    );

    switch (action) {
      case 'Grant All Required':
        return this.createResponseWithRequiredOnly(purposes);
      case 'Customize':
        return this.showModalConsentDialog(purposes, context);
      case 'Deny Optional':
      default:
        return this.createResponseWithEssentialOnly(purposes);
    }
  }

  /**
   * Show hybrid consent dialog (combines status bar with smart prompting)
   */
  private async showHybridConsentDialog(
    purposes: ConsentPurpose[], 
    context?: Record<string, any>
  ): Promise<ConsentUIResponse> {
    const essentialPurposes = purposes.filter(p => p.category === ConsentCategory.ESSENTIAL);
    const requiredPurposes = purposes.filter(p => p.required && p.category !== ConsentCategory.ESSENTIAL);
    const optionalPurposes = purposes.filter(p => !p.required);

    // Always grant essential
    const response: ConsentUIResponse = {
      purposes: essentialPurposes.map(p => ({ id: p.id, granted: true })),
      timestamp: Date.now(),
      method: 'ui_interaction'
    };

    // Handle required purposes if any
    if (requiredPurposes.length > 0) {
      const requiredAction = await vscode.window.showWarningMessage(
        `This extension requires consent for ${requiredPurposes.length} purposes to function properly.`,
        { modal: false },
        'Grant Required Consents',
        'Learn More',
        'Deny'
      );

      if (requiredAction === 'Grant Required Consents') {
        response.purposes.push(...requiredPurposes.map(p => ({ id: p.id, granted: true })));
      } else if (requiredAction === 'Learn More') {
        // Show detailed modal
        const detailedResponse = await this.showModalConsentDialog(purposes, context);
        return detailedResponse;
      }
      // If denied, continue with just essential
    }

    // Handle optional purposes with less intrusive notification
    if (optionalPurposes.length > 0) {
      const optionalAction = await vscode.window.showInformationMessage(
        `Optional features available with additional consent (${optionalPurposes.length} purposes)`,
        { modal: false },
        'Enable Optional Features',
        'Maybe Later'
      );

      if (optionalAction === 'Enable Optional Features') {
        const optionalResponse = await this.showModalConsentDialog(optionalPurposes, context);
        response.purposes.push(...optionalResponse.purposes);
      }
    }

    return response;
  }

  /**
   * Create response with only essential purposes granted
   */
  private createResponseWithEssentialOnly(purposes: ConsentPurpose[]): ConsentUIResponse {
    return {
      purposes: purposes.map(purpose => ({
        id: purpose.id,
        granted: purpose.category === ConsentCategory.ESSENTIAL
      })),
      timestamp: Date.now(),
      method: 'ui_interaction'
    };
  }

  /**
   * Create response with required purposes granted
   */
  private createResponseWithRequiredOnly(purposes: ConsentPurpose[]): ConsentUIResponse {
    return {
      purposes: purposes.map(purpose => ({
        id: purpose.id,
        granted: purpose.required || purpose.category === ConsentCategory.ESSENTIAL
      })),
      timestamp: Date.now(),
      method: 'ui_interaction'
    };
  }

  /**
   * Create response from selected items
   */
  private createResponse(purposes: ConsentPurpose[], selected: vscode.QuickPickItem[]): ConsentUIResponse {
    const selectedLabels = new Set(selected.map(item => item.label));
    
    return {
      purposes: purposes.map(purpose => ({
        id: purpose.id,
        granted: selectedLabels.has(purpose.name) || purpose.category === ConsentCategory.ESSENTIAL
      })),
      timestamp: Date.now(),
      method: 'ui_interaction'
    };
  }

  /**
   * Generate HTML for consent request webview
   */
  private generateConsentRequestHTML(purposes: ConsentPurpose[], context?: Record<string, any>): string {
    const purposeItems = purposes.map(purpose => `
      <div class="purpose-item ${purpose.required ? 'required' : 'optional'}">
        <label>
          <input type="checkbox" 
                 data-purpose="${purpose.id}" 
                 ${purpose.required || purpose.category === ConsentCategory.ESSENTIAL ? 'checked disabled' : ''}>
          <strong>${purpose.name}</strong>
          ${purpose.required ? '<span class="required-tag">Required</span>' : ''}
          ${purpose.category === ConsentCategory.ESSENTIAL ? '<span class="essential-tag">Essential</span>' : ''}
        </label>
        <p class="purpose-description">${purpose.description}</p>
        <div class="purpose-details">
          <span>Category: ${purpose.category}</span>
          ${purpose.thirdParties.length > 0 ? `<span>Third parties: ${purpose.thirdParties.join(', ')}</span>` : ''}
          <span>Retention: ${Math.ceil(purpose.retentionPeriod / (1000 * 60 * 60 * 24))} days</span>
        </div>
      </div>
    `).join('');

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Privacy Consent</title>
        <style>
            body { 
                font-family: var(--vscode-font-family);
                color: var(--vscode-foreground);
                background: var(--vscode-editor-background);
                padding: 20px;
                line-height: 1.6;
            }
            .header { margin-bottom: 30px; }
            .purpose-item { 
                margin: 20px 0; 
                padding: 15px;
                border: 1px solid var(--vscode-panel-border);
                border-radius: 4px;
                background: var(--vscode-editor-widget-background);
            }
            .purpose-item.required { 
                border-left: 4px solid var(--vscode-notificationsWarningIcon-foreground); 
            }
            .required-tag, .essential-tag { 
                font-size: 12px;
                padding: 2px 6px;
                border-radius: 3px;
                margin-left: 8px;
            }
            .required-tag { 
                background: var(--vscode-notificationsWarningIcon-foreground);
                color: var(--vscode-editor-background);
            }
            .essential-tag {
                background: var(--vscode-notificationsInfoIcon-foreground);
                color: var(--vscode-editor-background);
            }
            .purpose-description { 
                margin: 10px 0;
                color: var(--vscode-descriptionForeground);
            }
            .purpose-details { 
                font-size: 12px;
                color: var(--vscode-descriptionForeground);
            }
            .purpose-details span {
                margin-right: 15px;
            }
            .actions { 
                margin-top: 30px;
                text-align: center;
            }
            button { 
                margin: 0 10px;
                padding: 10px 20px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
            }
            .primary { 
                background: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
            }
            .secondary {
                background: var(--vscode-button-secondaryBackground);
                color: var(--vscode-button-secondaryForeground);
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h2>Privacy Consent Required</h2>
            <p>Vespera Forge needs your consent for the following data processing purposes:</p>
        </div>
        
        <div class="purposes">
            ${purposeItems}
        </div>
        
        <div class="actions">
            <button class="primary" onclick="grantConsent()">Grant Selected Consents</button>
            <button class="secondary" onclick="cancel()">Essential Only</button>
        </div>
        
        <script>
            const vscode = acquireVsCodeApi();
            
            function grantConsent() {
                const checkboxes = document.querySelectorAll('input[type="checkbox"]');
                const granted = Array.from(checkboxes)
                    .filter(cb => cb.checked)
                    .map(cb => cb.dataset.purpose);
                
                vscode.postMessage({
                    command: 'consent',
                    grantedPurposes: granted
                });
            }
            
            function cancel() {
                vscode.postMessage({
                    command: 'cancel'
                });
            }
        </script>
    </body>
    </html>`;
  }

  /**
   * Generate HTML for consent preferences panel
   */
  private generateConsentPreferencesHTML(currentConsents: ConsentPurposeGrant[]): string {
    // Simplified implementation for scaffolding
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Consent Preferences</title>
        <style>
            body { font-family: var(--vscode-font-family); padding: 20px; }
        </style>
    </head>
    <body>
        <h2>Privacy & Consent Preferences</h2>
        <p>Manage your data processing consents here.</p>
        <!-- Full implementation would show current consents and allow modifications -->
    </body>
    </html>`;
  }

  /**
   * Handle consent updates from UI
   */
  private handleConsentUpdate(purposes: any[]): void {
    this.logger.info('Consent update from UI', { purposes });
    // Implementation would update consent records
  }

  /**
   * Handle data export request
   */
  private handleDataExport(userId: string): void {
    this.logger.info('Data export requested', { userId });
    // Implementation would trigger data export
  }

  /**
   * Handle withdraw all consent request
   */
  private handleWithdrawAll(userId: string): void {
    this.logger.info('Withdraw all consent requested', { userId });
    // Implementation would withdraw all consents
  }

  /**
   * Dispose the consent UI
   */
  dispose(): void {
    if (this.disposed) return;
    
    if (this.statusBarItem) {
      this.statusBarItem.dispose();
      this.statusBarItem = undefined;
    }
    
    this.disposed = true;
    this.logger.info('ConsentUI disposed');
  }
}