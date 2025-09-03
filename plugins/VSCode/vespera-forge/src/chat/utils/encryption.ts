/**
 * Credential encryption utilities for secure API key storage
 */
import * as vscode from 'vscode';

/**
 * DEPRECATED - These functions are no longer available for security reasons
 * Use CredentialManager.storeCredential() and CredentialManager.retrieveCredential() instead
 */
export async function encrypt(_value: string): Promise<string> {
  throw new Error('DEPRECATED: encrypt() function removed for security reasons. Use CredentialManager.storeCredential() instead.');
}

export async function decrypt(_encrypted: string): Promise<string> {
  throw new Error('DEPRECATED: decrypt() function removed for security reasons. Use CredentialManager.retrieveCredential() instead.');
}

export class CredentialManager {
  private static readonly ENCRYPTION_KEY = 'vespera-chat-credentials';
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY = 1000; // 1 second
  
  /**
   * Store an encrypted credential securely with retry logic and validation
   */
  static async storeCredential(
    context: vscode.ExtensionContext,
    providerId: string, 
    credential: string
  ): Promise<void> {
    // Input validation
    if (!providerId || providerId.trim().length === 0) {
      throw new Error('Provider ID cannot be empty');
    }
    
    if (!credential || credential.trim().length === 0) {
      throw new Error('Credential cannot be empty');
    }
    
    // Sanitize provider ID to prevent path traversal
    const sanitizedProviderId = providerId.replace(/[^a-zA-Z0-9._-]/g, '');
    if (sanitizedProviderId !== providerId) {
      console.warn(`[CredentialManager] Provider ID sanitized: ${providerId} -> ${sanitizedProviderId}`);
    }
    
    let lastError: Error | undefined;
    
    // Retry logic for reliability
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        // Use VS Code's SecretStorage API for secure credential storage
        if (context.secrets) {
          const key = `${this.ENCRYPTION_KEY}.${sanitizedProviderId}`;
          await context.secrets.store(key, credential);
          
          // Verify the credential was stored successfully
          const verification = await context.secrets.get(key);
          if (verification !== credential) {
            throw new Error('Credential verification failed after storage');
          }
          
          console.log(`[CredentialManager] Credential stored securely for ${sanitizedProviderId}`);
          return; // Success
          
        } else {
          // Fallback to basic base64 encoding (not secure, for development only)
          console.warn('VS Code SecretStorage not available, using insecure fallback');
          const encrypted = this.simpleEncrypt(credential);
          await context.globalState.update(`${this.ENCRYPTION_KEY}.${sanitizedProviderId}`, encrypted);
          return; // Success
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`[CredentialManager] Store attempt ${attempt}/${this.MAX_RETRIES} failed for ${sanitizedProviderId}:`, lastError.message);
        
        if (attempt < this.MAX_RETRIES) {
          // Wait before retry with exponential backoff
          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * attempt));
        }
      }
    }
    
    // All attempts failed
    const finalError = new Error(`Failed to store credential after ${this.MAX_RETRIES} attempts: ${lastError?.message || 'Unknown error'}`);
    console.error(`[CredentialManager] Failed to store credential for ${sanitizedProviderId}:`, finalError);
    throw finalError;
  }
  
  /**
   * Retrieve a decrypted credential with integrity checks
   */
  static async retrieveCredential(
    context: vscode.ExtensionContext,
    providerId: string
  ): Promise<string | undefined> {
    if (!providerId || providerId.trim().length === 0) {
      console.error('[CredentialManager] Provider ID cannot be empty for retrieval');
      return undefined;
    }
    
    // Sanitize provider ID
    const sanitizedProviderId = providerId.replace(/[^a-zA-Z0-9._-]/g, '');
    
    let lastError: Error | undefined;
    
    // Retry logic for reliability
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        // Try VS Code's SecretStorage API first
        if (context.secrets) {
          const key = `${this.ENCRYPTION_KEY}.${sanitizedProviderId}`;
          const credential = await context.secrets.get(key);
          
          if (credential) {
            // Basic integrity check
            if (credential.trim().length === 0) {
              console.warn(`[CredentialManager] Retrieved empty credential for ${sanitizedProviderId}`);
              return undefined;
            }
            
            console.log(`[CredentialManager] Credential retrieved securely for ${sanitizedProviderId}`);
            return credential;
          }
        } else {
          // Fallback to global state
          const encrypted = context.globalState.get<string>(`${this.ENCRYPTION_KEY}.${sanitizedProviderId}`);
          if (encrypted) {
            const decrypted = this.simpleDecrypt(encrypted);
            if (decrypted && decrypted.trim().length > 0) {
              return decrypted;
            }
          }
        }
        
        return undefined; // Not found
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`[CredentialManager] Retrieve attempt ${attempt}/${this.MAX_RETRIES} failed for ${sanitizedProviderId}:`, lastError.message);
        
        if (attempt < this.MAX_RETRIES) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
        }
      }
    }
    
    // All attempts failed
    console.error(`[CredentialManager] Failed to retrieve credential for ${sanitizedProviderId} after ${this.MAX_RETRIES} attempts:`, lastError?.message);
    return undefined;
  }
  
  /**
   * Delete a stored credential with verification
   */
  static async deleteCredential(
    context: vscode.ExtensionContext,
    providerId: string
  ): Promise<void> {
    if (!providerId || providerId.trim().length === 0) {
      console.error('[CredentialManager] Provider ID cannot be empty for deletion');
      return;
    }
    
    // Sanitize provider ID
    const sanitizedProviderId = providerId.replace(/[^a-zA-Z0-9._-]/g, '');
    
    let lastError: Error | undefined;
    
    // Retry logic for reliability
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        if (context.secrets) {
          const key = `${this.ENCRYPTION_KEY}.${sanitizedProviderId}`;
          await context.secrets.delete(key);
          
          // Verify deletion by attempting to retrieve
          const verification = await context.secrets.get(key);
          if (verification !== undefined) {
            throw new Error('Credential deletion verification failed');
          }
        } else {
          await context.globalState.update(`${this.ENCRYPTION_KEY}.${sanitizedProviderId}`, undefined);
          
          // Verify deletion
          const verification = context.globalState.get(`${this.ENCRYPTION_KEY}.${sanitizedProviderId}`);
          if (verification !== undefined) {
            throw new Error('Credential deletion verification failed');
          }
        }
        
        console.log(`[CredentialManager] Credential deleted for ${sanitizedProviderId}`);
        return; // Success
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`[CredentialManager] Delete attempt ${attempt}/${this.MAX_RETRIES} failed for ${sanitizedProviderId}:`, lastError.message);
        
        if (attempt < this.MAX_RETRIES) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
        }
      }
    }
    
    // All attempts failed
    const finalError = new Error(`Failed to delete credential after ${this.MAX_RETRIES} attempts: ${lastError?.message || 'Unknown error'}`);
    console.error(`[CredentialManager] Failed to delete credential for ${sanitizedProviderId}:`, finalError);
    throw finalError;
  }
  
  /**
   * List all stored credential provider IDs
   */
  static async listStoredProviders(context: vscode.ExtensionContext): Promise<string[]> {
    try {
      if (context.secrets) {
        // VS Code SecretStorage doesn't provide a way to list keys
        // We'd need to maintain a separate index
        // For now, return empty array
        return [];
      } else {
        // For global state, we can iterate through keys
        const keys = context.globalState.keys();
        const prefix = `${this.ENCRYPTION_KEY}.`;
        return keys
          .filter(key => key.startsWith(prefix))
          .map(key => key.substring(prefix.length));
      }
    } catch (error) {
      console.error('Failed to list stored providers:', error);
      return [];
    }
  }
  
  /**
   * Validate that a credential exists, is not empty, and has reasonable format
   */
  static async validateCredential(
    context: vscode.ExtensionContext,
    providerId: string,
    options?: { 
      minLength?: number; 
      maxLength?: number;
      pattern?: RegExp;
      allowEmpty?: boolean;
    }
  ): Promise<boolean> {
    try {
      const credential = await this.retrieveCredential(context, providerId);
      
      if (!credential) {
        return options?.allowEmpty === true;
      }
      
      const trimmed = credential.trim();
      
      // Basic validation
      if (trimmed.length === 0) {
        return options?.allowEmpty === true;
      }
      
      // Length validation
      if (options?.minLength && trimmed.length < options.minLength) {
        console.warn(`[CredentialManager] Credential too short for ${providerId}: ${trimmed.length} < ${options.minLength}`);
        return false;
      }
      
      if (options?.maxLength && trimmed.length > options.maxLength) {
        console.warn(`[CredentialManager] Credential too long for ${providerId}: ${trimmed.length} > ${options.maxLength}`);
        return false;
      }
      
      // Pattern validation
      if (options?.pattern && !options.pattern.test(trimmed)) {
        console.warn(`[CredentialManager] Credential format invalid for ${providerId}`);
        return false;
      }
      
      // Check for obviously invalid credentials
      const invalidPatterns = [
        /^(password|123456|qwerty|admin|test)$/i,
        /^(..)\1{3,}/, // Repeated patterns like 'abababab'
        /^\d{4,6}$/ // Simple PIN-like numbers
      ];
      
      for (const pattern of invalidPatterns) {
        if (pattern.test(trimmed)) {
          console.warn(`[CredentialManager] Credential appears to be weak or invalid for ${providerId}`);
          return false;
        }
      }
      
      return true;
      
    } catch (error) {
      console.error(`[CredentialManager] Failed to validate credential for ${providerId}:`, error);
      return false;
    }
  }
  
  /**
   * Prompt user to enter and store a credential
   */
  static async promptAndStoreCredential(
    context: vscode.ExtensionContext,
    providerId: string,
    providerName: string
  ): Promise<string | undefined> {
    try {
      const credential = await vscode.window.showInputBox({
        prompt: `Enter API key for ${providerName}`,
        password: true,
        placeHolder: 'sk-...' // OpenAI-style placeholder
      });
      
      if (credential && credential.trim()) {
        await this.storeCredential(context, providerId, credential.trim());
        return credential.trim();
      }
      
      return undefined;
    } catch (error) {
      console.error(`Failed to prompt and store credential for ${providerId}:`, error);
      vscode.window.showErrorMessage(`Failed to store credential: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return undefined;
    }
  }
  
  // Simple encryption/decryption for fallback (NOT SECURE - for development only)
  private static simpleEncrypt(value: string): string {
    console.warn('Using insecure credential storage - this should only be used in development');
    return Buffer.from(value).toString('base64');
  }
  
  private static simpleDecrypt(encrypted: string): string {
    return Buffer.from(encrypted, 'base64').toString();
  }
}