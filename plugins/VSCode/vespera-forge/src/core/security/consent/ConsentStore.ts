/**
 * Consent Store
 * 
 * Secure storage and retrieval of consent records with encryption support
 * and GDPR-compliant data lifecycle management.
 */

import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { VesperaLogger } from '../../logging/VesperaLogger';
import { 
  ConsentRecord, 
  ConsentStatus,
  ConsentConfiguration 
} from '../../../types/security';
import { VesperaConsentError } from '../VesperaSecurityErrors';
import { VesperaSecurityErrorCode } from '../../../types/security';
import { VesperaSeverity } from '../../error-handling/VesperaErrors';

interface EncryptedConsentRecord {
  id: string;
  userId: string; // Not encrypted for indexing
  encryptedData: string;
  iv: string;
  timestamp: number;
  version: string;
  checksum: string;
}

/**
 * Secure consent storage with encryption and audit capabilities
 */
export class ConsentStore implements vscode.Disposable {
  private readonly STORAGE_KEY = 'vespera.consent.records';
  private readonly AUDIT_KEY = 'vespera.consent.audit';
  private readonly encryptionKey: Buffer;
  private disposed = false;

  constructor(
    private storage: vscode.Memento,
    private logger: VesperaLogger,
    private encryptionConfig: ConsentConfiguration['encryption']
  ) {
    this.logger = logger.createChild('ConsentStore');
    
    // Initialize encryption key
    this.encryptionKey = this.initializeEncryptionKey();
    
    this.logger.info('ConsentStore initialized', {
      encryptionEnabled: encryptionConfig.enabled,
      algorithm: encryptionConfig.algorithm
    });
  }

  /**
   * Store a consent record securely
   */
  async store(record: ConsentRecord): Promise<void> {
    if (this.disposed) {
      throw new VesperaConsentError(
        'ConsentStore has been disposed',
        VesperaSecurityErrorCode.CONSENT_REQUIRED,
        record.userId,
        []
      );
    }

    try {
      const existingRecords = await this.loadAllRecords();
      
      // Encrypt the record if encryption is enabled
      const storedRecord = this.encryptionConfig.enabled 
        ? this.encryptRecord(record)
        : this.convertToStorageFormat(record);

      // Add to existing records
      existingRecords.push(storedRecord);

      // Store updated records
      await this.storage.update(this.STORAGE_KEY, existingRecords);
      
      // Add to audit log
      await this.addToAuditLog(record, 'stored');
      
      this.logger.debug('Consent record stored', {
        recordId: record.id,
        userId: record.userId,
        purposes: record.purposes.length,
        encrypted: this.encryptionConfig.enabled
      });

    } catch (error) {
      this.logger.error('Failed to store consent record', error, { recordId: record.id });
      throw new VesperaConsentError(
        'Failed to store consent record',
        VesperaSecurityErrorCode.CONSENT_REQUIRED,
        record.userId,
        record.purposes.map(p => p.purposeId),
        VesperaSeverity.HIGH,
        { originalError: error }
      );
    }
  }

  /**
   * Load all consent records for processing
   */
  async loadAllConsents(): Promise<ConsentRecord[]> {
    if (this.disposed) return [];

    try {
      const storedRecords = await this.loadAllRecords();
      const decryptedRecords: ConsentRecord[] = [];

      for (const storedRecord of storedRecords) {
        try {
          const record = this.isEncryptedRecord(storedRecord)
            ? this.decryptRecord(storedRecord)
            : this.convertFromStorageFormat(storedRecord);
          
          decryptedRecords.push(record);
        } catch (error) {
          this.logger.error('Failed to decrypt consent record', error, {
            recordId: storedRecord.id
          });
          // Continue with other records rather than failing completely
        }
      }

      this.logger.debug('Consent records loaded', { 
        count: decryptedRecords.length,
        stored: storedRecords.length 
      });

      return decryptedRecords;

    } catch (error) {
      this.logger.error('Failed to load consent records', error);
      return [];
    }
  }

  /**
   * Get consent records for a specific user
   */
  async getUserConsents(userId: string): Promise<ConsentRecord[]> {
    const allConsents = await this.loadAllConsents();
    return allConsents.filter(consent => 
      consent.userId === userId && 
      consent.status === ConsentStatus.ACTIVE
    );
  }

  /**
   * Get audit trail for a user (for GDPR compliance)
   */
  async getAuditTrail(userId: string): Promise<ConsentRecord[]> {
    try {
      const auditRecords = await this.storage.get(this.AUDIT_KEY, []) as any[];
      return auditRecords
        .filter(record => record.userId === userId)
        .map(record => this.isEncryptedRecord(record) 
          ? this.decryptRecord(record) 
          : this.convertFromStorageFormat(record)
        );
    } catch (error) {
      this.logger.error('Failed to get audit trail', error, { userId });
      return [];
    }
  }

  /**
   * Delete consent records for a user (for right to be forgotten)
   */
  async deleteUserData(userId: string): Promise<void> {
    if (this.disposed) return;

    try {
      // Load all records
      const storedRecords = await this.loadAllRecords();
      
      // Filter out records for this user
      const remainingRecords = storedRecords.filter(record => record.userId !== userId);
      
      // Update storage
      await this.storage.update(this.STORAGE_KEY, remainingRecords);
      
      // Also clean audit log
      const auditRecords = await this.storage.get(this.AUDIT_KEY, []) as any[];
      const remainingAudit = auditRecords.filter(record => record.userId !== userId);
      await this.storage.update(this.AUDIT_KEY, remainingAudit);
      
      const deletedCount = storedRecords.length - remainingRecords.length;
      
      this.logger.info('User consent data deleted', {
        userId,
        recordsDeleted: deletedCount,
        auditRecordsDeleted: auditRecords.length - remainingAudit.length
      });

    } catch (error) {
      this.logger.error('Failed to delete user consent data', error, { userId });
      throw error;
    }
  }

  /**
   * Clean up expired consent records
   */
  async cleanupExpiredRecords(): Promise<void> {
    if (this.disposed) return;

    try {
      const storedRecords = await this.loadAllRecords();
      const now = Date.now();
      let expiredCount = 0;

      const activeRecords = storedRecords.filter(record => {
        const consent = this.isEncryptedRecord(record) 
          ? this.decryptRecord(record) 
          : this.convertFromStorageFormat(record);
        
        const expired = consent.expiresAt && consent.expiresAt < now;
        if (expired) {
          expiredCount++;
          // Mark as expired in audit log
          this.addToAuditLog({
            ...consent,
            status: ConsentStatus.EXPIRED
          }, 'expired');
        }
        
        return !expired;
      });

      if (expiredCount > 0) {
        await this.storage.update(this.STORAGE_KEY, activeRecords);
        
        this.logger.info('Expired consent records cleaned up', {
          expiredCount,
          remainingCount: activeRecords.length
        });
      }

    } catch (error) {
      this.logger.error('Failed to cleanup expired records', error);
    }
  }

  /**
   * Export all consent data for a user (GDPR data portability)
   */
  async exportUserData(userId: string): Promise<{
    consents: ConsentRecord[];
    auditTrail: ConsentRecord[];
    exportTimestamp: number;
  }> {
    const consents = await this.getUserConsents(userId);
    const auditTrail = await this.getAuditTrail(userId);
    
    return {
      consents,
      auditTrail,
      exportTimestamp: Date.now()
    };
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{
    totalRecords: number;
    auditRecords: number;
    encryptedRecords: number;
    storageSize: number;
  }> {
    try {
      const storedRecords = await this.loadAllRecords();
      const auditRecords = await this.storage.get(this.AUDIT_KEY, []) as any[];
      
      const encryptedCount = storedRecords.filter(this.isEncryptedRecord).length;
      const storageSize = JSON.stringify(storedRecords).length + JSON.stringify(auditRecords).length;

      return {
        totalRecords: storedRecords.length,
        auditRecords: auditRecords.length,
        encryptedRecords: encryptedCount,
        storageSize
      };
    } catch (error) {
      this.logger.error('Failed to get storage stats', error);
      return {
        totalRecords: 0,
        auditRecords: 0,
        encryptedRecords: 0,
        storageSize: 0
      };
    }
  }

  /**
   * Load all raw records from storage
   */
  private async loadAllRecords(): Promise<any[]> {
    return await this.storage.get(this.STORAGE_KEY, []);
  }

  /**
   * Initialize encryption key
   */
  private initializeEncryptionKey(): Buffer {
    if (!this.encryptionConfig.enabled) {
      return Buffer.alloc(32); // Dummy key
    }

    // In production, this should be derived from a secure key management system
    // For now, we'll use a deterministic key based on the workspace
    const keySource = `vespera-consent-${vscode.env.machineId}`;
    return crypto.scryptSync(keySource, 'salt', 32);
  }

  /**
   * Encrypt a consent record
   */
  private encryptRecord(record: ConsentRecord): EncryptedConsentRecord {
    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, this.encryptionKey);
    
    const data = JSON.stringify(record);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const checksum = crypto.createHash('sha256').update(data).digest('hex');

    return {
      id: record.id,
      userId: record.userId, // Keep unencrypted for indexing
      encryptedData: encrypted,
      iv: iv.toString('hex'),
      timestamp: record.timestamp,
      version: record.version,
      checksum
    };
  }

  /**
   * Decrypt a consent record
   */
  private decryptRecord(encryptedRecord: EncryptedConsentRecord): ConsentRecord {
    const algorithm = 'aes-256-gcm';
    const decipher = crypto.createDecipher(algorithm, this.encryptionKey);
    
    let decrypted = decipher.update(encryptedRecord.encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    const record = JSON.parse(decrypted) as ConsentRecord;
    
    // Verify checksum
    const checksum = crypto.createHash('sha256').update(decrypted).digest('hex');
    if (checksum !== encryptedRecord.checksum) {
      throw new Error('Consent record checksum mismatch - possible tampering');
    }
    
    return record;
  }

  /**
   * Check if a record is encrypted
   */
  private isEncryptedRecord(record: any): record is EncryptedConsentRecord {
    return 'encryptedData' in record && 'iv' in record;
  }

  /**
   * Convert consent record to unencrypted storage format
   */
  private convertToStorageFormat(record: ConsentRecord): any {
    return {
      ...record,
      checksum: crypto.createHash('sha256').update(JSON.stringify(record)).digest('hex')
    };
  }

  /**
   * Convert from unencrypted storage format
   */
  private convertFromStorageFormat(stored: any): ConsentRecord {
    // Verify checksum if present
    if (stored.checksum) {
      const { checksum, ...recordData } = stored;
      const calculatedChecksum = crypto.createHash('sha256').update(JSON.stringify(recordData)).digest('hex');
      if (checksum !== calculatedChecksum) {
        throw new Error('Stored record checksum mismatch');
      }
      return recordData as ConsentRecord;
    }
    
    return stored as ConsentRecord;
  }

  /**
   * Add record to audit log
   */
  private async addToAuditLog(record: ConsentRecord, action: string): Promise<void> {
    try {
      const auditRecords = await this.storage.get(this.AUDIT_KEY, []) as any[];
      
      const auditEntry = {
        ...record,
        auditAction: action,
        auditTimestamp: Date.now()
      };

      const storedEntry = this.encryptionConfig.enabled 
        ? this.encryptRecord(auditEntry as ConsentRecord)
        : this.convertToStorageFormat(auditEntry);

      auditRecords.push(storedEntry);
      
      // Keep audit log size manageable (keep last 1000 entries)
      const maxAuditEntries = 1000;
      if (auditRecords.length > maxAuditEntries) {
        auditRecords.splice(0, auditRecords.length - maxAuditEntries);
      }

      await this.storage.update(this.AUDIT_KEY, auditRecords);
      
    } catch (error) {
      this.logger.error('Failed to add audit log entry', error);
      // Don't throw - audit logging failure shouldn't break consent operations
    }
  }

  /**
   * Dispose the consent store
   */
  dispose(): void {
    if (this.disposed) return;
    
    // Clear encryption key from memory
    this.encryptionKey.fill(0);
    
    this.disposed = true;
    this.logger.info('ConsentStore disposed');
  }
}