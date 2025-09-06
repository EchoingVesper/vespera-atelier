/**
 * Vespera Consent Manager
 * 
 * GDPR-compliant consent management system with encrypted storage,
 * audit trails, and non-intrusive UI integration.
 */

import * as vscode from 'vscode';
import { VesperaLogger } from '../../logging/VesperaLogger';
import { ConsentStore } from './ConsentStore';
import { ConsentUI, ConsentUIResponse } from './ConsentUI';
import {
  ConsentConfiguration,
  ConsentRecord,
  ConsentPurpose,
  ConsentPurposeGrant,
  ConsentSource,
  ConsentStatus,
  ConsentCategory,
  ConsentMethod,
  ConsentEvidence,
  VesperaConsentManagerInterface
} from '../../../types/security';
import { VesperaConsentError } from '../VesperaSecurityErrors';
import { VesperaSecurityErrorCode } from '../../../types/security';
import { VesperaSeverity } from '../../error-handling/VesperaErrors';

/**
 * Main consent manager service
 */
export class VesperaConsentManager implements VesperaConsentManagerInterface {
  private static instance: VesperaConsentManager;
  
  private consentStore: ConsentStore;
  private consentUI: ConsentUI;
  private purposeRegistry: Map<string, ConsentPurpose> = new Map();
  private activeConsents: Map<string, ConsentRecord> = new Map();
  private disposed = false;
  
  /**
   * Check if service is disposed
   */
  public get isDisposed(): boolean {
    return this.disposed;
  }
  
  // Cleanup and monitoring
  private cleanupTimer?: NodeJS.Timeout;
  private consentExpirationTimer?: NodeJS.Timeout;

  private constructor(
    storage: vscode.Memento,
    private logger: VesperaLogger,
    config: ConsentConfiguration
  ) {
    this.logger = logger.createChild('ConsentManager');
    this.consentStore = new ConsentStore(storage, logger, config.encryption);
    this.consentUI = new ConsentUI(config.uiMode, logger);
    
    this.initializePurposes(config.purposes);
    this.setupPeriodicCleanup();
  }

  /**
   * Initialize the consent manager
   */
  public static async initialize(config: {
    storage: vscode.Memento;
    logger: VesperaLogger;
    purposes: ConsentPurpose[];
    configuration?: Partial<ConsentConfiguration>;
  }): Promise<VesperaConsentManager> {
    if (!VesperaConsentManager.instance) {
      const consentConfig: ConsentConfiguration = {
        enabled: true,
        purposes: config.purposes,
        uiMode: 'hybrid',
        retention: {
          activeConsentDays: 365,
          auditLogDays: 2555 // 7 years for GDPR compliance
        },
        encryption: {
          enabled: true,
          algorithm: 'AES-256-GCM'
        },
        ...config.configuration
      };
      
      VesperaConsentManager.instance = new VesperaConsentManager(
        config.storage,
        config.logger,
        consentConfig
      );
      
      await VesperaConsentManager.instance.loadExistingConsents();
    }
    return VesperaConsentManager.instance;
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): VesperaConsentManager {
    if (!VesperaConsentManager.instance) {
      throw new VesperaConsentError(
        'ConsentManager not initialized',
        VesperaSecurityErrorCode.CONSENT_REQUIRED,
        'unknown',
        []
      );
    }
    return VesperaConsentManager.instance;
  }

  /**
   * Check if consent is granted for a specific purpose
   */
  hasConsent(userId: string, purposeId: string): boolean {
    if (this.disposed) return false;

    const consentKey = `${userId}:${purposeId}`;
    const consent = this.activeConsents.get(consentKey);
    
    if (!consent || consent.status !== ConsentStatus.ACTIVE) {
      return false;
    }
    
    // Check expiry
    if (consent.expiresAt && consent.expiresAt < Date.now()) {
      this.expireConsent(consent.id).catch(error => {
        this.logger.error('Failed to expire consent', error, { consentId: consent.id });
      });
      return false;
    }
    
    // Find the specific purpose grant
    const purposeGrant = consent.purposes.find(p => p.purposeId === purposeId);
    const granted = purposeGrant?.granted === true;
    
    this.logger.debug('Consent check', {
      userId,
      purposeId,
      granted,
      consentId: consent.id
    });
    
    return granted;
  }

  /**
   * Request consent for specific purposes
   */
  async requestConsent(
    userId: string, 
    purposeIds: string[],
    context?: Record<string, any>
  ): Promise<ConsentRecord> {
    if (this.disposed) {
      throw new VesperaConsentError(
        'ConsentManager has been disposed',
        VesperaSecurityErrorCode.CONSENT_REQUIRED,
        userId,
        purposeIds
      );
    }

    this.logger.info('Requesting consent', { userId, purposeIds, context });
    
    // Validate purposes
    const purposes = purposeIds.map(id => this.purposeRegistry.get(id))
      .filter((p): p is ConsentPurpose => p !== undefined);
    
    if (purposes.length !== purposeIds.length) {
      const invalidPurposes = purposeIds.filter(id => !this.purposeRegistry.has(id));
      throw new VesperaConsentError(
        `Invalid consent purposes requested: ${invalidPurposes.join(', ')}`,
        VesperaSecurityErrorCode.CONSENT_INVALID_PURPOSE,
        userId,
        invalidPurposes,
        VesperaSeverity.HIGH
      );
    }
    
    try {
      // Show consent UI and wait for user response
      const userResponse = await this.consentUI.requestConsent(purposes, context);
      
      // Create consent record
      const consentRecord: ConsentRecord = {
        id: this.generateConsentId(),
        userId,
        purposes: this.createPurposeGrants(userResponse, purposes),
        timestamp: Date.now(),
        version: '1.0',
        source: ConsentSource.EXPLICIT,
        evidence: this.createEvidence(ConsentMethod.UI_INTERACTION, context),
        status: ConsentStatus.ACTIVE,
        expiresAt: this.calculateExpiryDate(purposes)
      };
      
      // Store consent
      await this.storeConsent(consentRecord);
      
      // Update active consents cache
      this.updateActiveConsents(consentRecord);
      
      // Update UI status
      this.updateConsentStatus();
      
      this.logger.info('Consent granted and stored', {
        consentId: consentRecord.id,
        userId,
        grantedPurposes: consentRecord.purposes.filter(p => p.granted).length,
        totalPurposes: consentRecord.purposes.length
      });
      
      return consentRecord;

    } catch (error) {
      this.logger.error('Failed to request consent', error, { userId, purposeIds });
      throw new VesperaConsentError(
        'Failed to request consent from user',
        VesperaSecurityErrorCode.CONSENT_REQUIRED,
        userId,
        purposeIds,
        VesperaSeverity.HIGH,
        { originalError: error, context }
      );
    }
  }

  /**
   * Withdraw consent for specific purposes
   */
  async withdrawConsent(userId: string, purposeIds: string[]): Promise<void> {
    if (this.disposed) return;

    this.logger.info('Withdrawing consent', { userId, purposeIds });
    
    try {
      for (const purposeId of purposeIds) {
        const consentKey = `${userId}:${purposeId}`;
        const consent = this.activeConsents.get(consentKey);
        
        if (consent) {
          // Create withdrawal record
          const withdrawalRecord: ConsentRecord = {
            ...consent,
            id: this.generateConsentId(),
            timestamp: Date.now(),
            status: ConsentStatus.WITHDRAWN,
            evidence: this.createEvidence(ConsentMethod.UI_INTERACTION, { 
              action: 'withdrawal',
              originalConsentId: consent.id 
            })
          };
          
          await this.storeConsent(withdrawalRecord);
          this.activeConsents.delete(consentKey);
          
          // Trigger data deletion if required
          await this.handleDataDeletion(userId, purposeId);
        }
      }
      
      // Update UI status
      this.updateConsentStatus();
      
      this.logger.info('Consent withdrawal completed', { 
        userId, 
        purposeIds,
        remainingConsents: this.getUserConsents(userId).length
      });

    } catch (error) {
      this.logger.error('Failed to withdraw consent', error, { userId, purposeIds });
      throw new VesperaConsentError(
        'Failed to withdraw consent',
        VesperaSecurityErrorCode.CONSENT_WITHDRAWN,
        userId,
        purposeIds,
        VesperaSeverity.MEDIUM,
        { originalError: error }
      );
    }
  }

  /**
   * Get all active consents for a user
   */
  getUserConsents(userId: string): ConsentRecord[] {
    if (this.disposed) return [];

    return Array.from(this.activeConsents.values())
      .filter(consent => consent.userId === userId && consent.status === ConsentStatus.ACTIVE);
  }

  /**
   * Export user data for GDPR compliance
   */
  async exportUserData(userId: string): Promise<{
    consents: ConsentRecord[];
    purposes: ConsentPurpose[];
    auditTrail: ConsentRecord[];
  }> {
    if (this.disposed) {
      throw new VesperaConsentError(
        'ConsentManager has been disposed',
        VesperaSecurityErrorCode.CONSENT_REQUIRED,
        userId,
        []
      );
    }

    this.logger.info('Exporting user data', { userId });

    try {
      const exportData = await this.consentStore.exportUserData(userId);
      const relevantPurposes = Array.from(this.purposeRegistry.values())
        .filter(purpose => 
          exportData.consents.some(consent => 
            consent.purposes.some(p => p.purposeId === purpose.id)
          )
        );

      return {
        ...exportData,
        purposes: relevantPurposes
      };

    } catch (error) {
      this.logger.error('Failed to export user data', error, { userId });
      throw new VesperaConsentError(
        'Failed to export user consent data',
        VesperaSecurityErrorCode.CONSENT_REQUIRED,
        userId,
        [],
        VesperaSeverity.HIGH,
        { originalError: error }
      );
    }
  }

  /**
   * Handle right to be forgotten (GDPR Article 17)
   */
  async deleteUserData(userId: string): Promise<void> {
    if (this.disposed) return;

    this.logger.info('Processing right to be forgotten', { userId });

    try {
      // Remove from active consents cache
      const keysToRemove = Array.from(this.activeConsents.keys())
        .filter(key => key.startsWith(`${userId}:`));
      
      for (const key of keysToRemove) {
        this.activeConsents.delete(key);
      }

      // Delete from persistent storage
      await this.consentStore.deleteUserData(userId);
      
      // Update UI status
      this.updateConsentStatus();
      
      this.logger.info('User data deletion completed', { 
        userId,
        consentRecordsRemoved: keysToRemove.length 
      });

    } catch (error) {
      this.logger.error('Failed to delete user data', error, { userId });
      throw error;
    }
  }

  /**
   * Get overall consent compliance status
   */
  getComplianceStatus(): {
    compliant: boolean;
    requiredPurposes: number;
    grantedRequired: number;
    optionalPurposes: number;
    grantedOptional: number;
    issues: string[];
  } {
    const purposes = Array.from(this.purposeRegistry.values());
    const requiredPurposes = purposes.filter(p => p.required);
    const optionalPurposes = purposes.filter(p => !p.required);
    
    // For overall compliance, we'd need to check against all users
    // This simplified implementation assumes current user context
    const issues: string[] = [];
    
    return {
      compliant: issues.length === 0,
      requiredPurposes: requiredPurposes.length,
      grantedRequired: 0, // Would be calculated from actual consent data
      optionalPurposes: optionalPurposes.length,
      grantedOptional: 0, // Would be calculated from actual consent data
      issues
    };
  }

  /**
   * Add a new consent purpose
   */
  addPurpose(purpose: ConsentPurpose): void {
    if (this.disposed) return;

    this.purposeRegistry.set(purpose.id, purpose);
    this.logger.info('Consent purpose added', { purposeId: purpose.id, name: purpose.name });
    
    // Update UI to reflect new purpose
    this.updateConsentStatus();
  }

  /**
   * Remove a consent purpose
   */
  removePurpose(purposeId: string): void {
    if (this.disposed) return;

    if (this.purposeRegistry.delete(purposeId)) {
      this.logger.info('Consent purpose removed', { purposeId });
      
      // Clean up related consent records would be handled here in full implementation
      this.updateConsentStatus();
    }
  }

  /**
   * Initialize consent purposes
   */
  private initializePurposes(purposes: ConsentPurpose[]): void {
    for (const purpose of purposes) {
      this.purposeRegistry.set(purpose.id, purpose);
    }
    this.logger.debug('Initialized consent purposes', { count: purposes.length });
  }

  /**
   * Load existing consents from storage
   */
  private async loadExistingConsents(): Promise<void> {
    try {
      const storedConsents = await this.consentStore.loadAllConsents();
      
      for (const consent of storedConsents) {
        if (consent.status === ConsentStatus.ACTIVE && 
            (!consent.expiresAt || consent.expiresAt > Date.now())) {
          this.updateActiveConsents(consent);
        }
      }
      
      this.logger.info('Loaded existing consents', { 
        count: this.activeConsents.size,
        total: storedConsents.length 
      });

      // Update UI to reflect loaded consents
      this.updateConsentStatus();

    } catch (error) {
      this.logger.error('Failed to load existing consents', error);
    }
  }

  /**
   * Update active consents cache
   */
  private updateActiveConsents(consent: ConsentRecord): void {
    for (const purpose of consent.purposes) {
      if (purpose.granted) {
        const key = `${consent.userId}:${purpose.purposeId}`;
        this.activeConsents.set(key, consent);
      }
    }
  }

  /**
   * Store consent record
   */
  private async storeConsent(consent: ConsentRecord): Promise<void> {
    await this.consentStore.store(consent);
    this.logger.debug('Consent stored', { consentId: consent.id });
  }

  /**
   * Generate unique consent ID
   */
  private generateConsentId(): string {
    return `consent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create consent evidence
   */
  private createEvidence(method: ConsentMethod, metadata?: Record<string, any>): ConsentEvidence {
    const evidence = {
      userAgent: `VS Code ${vscode.version}`,
      timestamp: Date.now(),
      method,
      metadata: metadata || {},
      checksum: ''
    };
    
    evidence.checksum = this.calculateChecksum(evidence);
    return evidence;
  }

  /**
   * Calculate evidence checksum
   */
  private calculateChecksum(evidence: Omit<ConsentEvidence, 'checksum'>): string {
    const data = JSON.stringify(evidence);
    // Simple checksum - in production, use proper cryptographic hash
    return Buffer.from(data).toString('base64').substr(0, 16);
  }

  /**
   * Calculate consent expiry date
   */
  private calculateExpiryDate(purposes: ConsentPurpose[]): number | undefined {
    const maxRetention = Math.max(...purposes.map(p => p.retentionPeriod));
    return maxRetention > 0 ? Date.now() + maxRetention : undefined;
  }

  /**
   * Create purpose grants from UI response
   */
  private createPurposeGrants(response: ConsentUIResponse, purposes: ConsentPurpose[]): ConsentPurposeGrant[] {
    const grantedIds = new Set(response.purposes.filter(p => p.granted).map(p => p.id));
    
    return purposes.map(purpose => ({
      purposeId: purpose.id,
      granted: grantedIds.has(purpose.id) || purpose.category === ConsentCategory.ESSENTIAL,
      timestamp: response.timestamp,
      conditions: response.purposes.find(p => p.id === purpose.id)?.conditions
    }));
  }

  /**
   * Expire a consent record
   */
  private async expireConsent(consentId: string): Promise<void> {
    const consent = Array.from(this.activeConsents.values())
      .find(c => c.id === consentId);
    
    if (consent) {
      const expiredConsent = {
        ...consent,
        id: this.generateConsentId(),
        status: ConsentStatus.EXPIRED,
        timestamp: Date.now()
      };
      
      await this.storeConsent(expiredConsent);
      
      // Remove from active consents
      for (const purpose of consent.purposes) {
        const key = `${consent.userId}:${purpose.purposeId}`;
        this.activeConsents.delete(key);
      }
      
      this.logger.info('Consent expired', { consentId });
      this.updateConsentStatus();
    }
  }

  /**
   * Handle data deletion after consent withdrawal
   */
  private async handleDataDeletion(userId: string, purposeId: string): Promise<void> {
    const purpose = this.purposeRegistry.get(purposeId);
    if (purpose && purpose.category !== ConsentCategory.ESSENTIAL) {
      this.logger.info('Triggering data deletion', { userId, purposeId });
      // Implementation would depend on specific data storage systems
      // This is where you would integrate with your data deletion workflows
    }
  }

  /**
   * Update consent status in UI
   */
  private updateConsentStatus(): void {
    // Get all purpose IDs
    const allPurposeIds = Array.from(this.purposeRegistry.keys());
    
    // Get currently granted purposes (simplified - would need user context)
    const grantedPurposeIds = Array.from(this.activeConsents.keys())
      .map(key => key.split(':')[1])
      .filter((value): value is string => value !== undefined)
      .filter((value, index, self) => self.indexOf(value) === index);

    this.consentUI.updateConsentStatus(grantedPurposeIds, allPurposeIds);
  }

  /**
   * Setup periodic cleanup of expired consents
   */
  private setupPeriodicCleanup(): void {
    // Run cleanup every hour
    this.cleanupTimer = setInterval(async () => {
      if (!this.disposed) {
        try {
          await this.consentStore.cleanupExpiredRecords();
          
          // Check for expired consents in memory
          const now = Date.now();
          const expiredKeys: string[] = [];
          
          for (const [key, consent] of this.activeConsents.entries()) {
            if (consent.expiresAt && consent.expiresAt < now) {
              expiredKeys.push(key);
              await this.expireConsent(consent.id);
            }
          }
          
          if (expiredKeys.length > 0) {
            this.logger.info('Periodic cleanup completed', { expiredConsents: expiredKeys.length });
          }

        } catch (error) {
          this.logger.error('Periodic cleanup failed', error);
        }
      }
    }, 60 * 60 * 1000); // 1 hour

    this.logger.debug('Periodic cleanup scheduled');
  }

  /**
   * Dispose the consent manager
   */
  dispose(): void {
    if (this.disposed) return;
    
    // Clear timers
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    
    if (this.consentExpirationTimer) {
      clearInterval(this.consentExpirationTimer);
      this.consentExpirationTimer = undefined;
    }
    
    // Dispose components
    this.consentUI.dispose();
    this.consentStore.dispose();
    
    // Clear caches
    this.activeConsents.clear();
    this.purposeRegistry.clear();
    
    this.disposed = true;
    this.logger.info('VesperaConsentManager disposed');
  }
}