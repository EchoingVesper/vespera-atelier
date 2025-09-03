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
  
  /**
   * Store an encrypted credential securely
   */
  static async storeCredential(
    context: vscode.ExtensionContext,
    providerId: string, 
    credential: string
  ): Promise<void> {
    try {
      // Use VS Code's SecretStorage API for secure credential storage
      if (context.secrets) {
        const key = `${this.ENCRYPTION_KEY}.${providerId}`;
        await context.secrets.store(key, credential);
      } else {
        // Fallback to basic base64 encoding (not secure, for development only)
        console.warn('VS Code SecretStorage not available, using insecure fallback');
        const encrypted = this.simpleEncrypt(credential);
        await context.globalState.update(`${this.ENCRYPTION_KEY}.${providerId}`, encrypted);
      }
    } catch (error) {
      console.error(`Failed to store credential for ${providerId}:`, error);
      throw new Error(`Failed to store credential: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Retrieve a decrypted credential
   */
  static async retrieveCredential(
    context: vscode.ExtensionContext,
    providerId: string
  ): Promise<string | undefined> {
    try {
      // Try VS Code's SecretStorage API first
      if (context.secrets) {
        const key = `${this.ENCRYPTION_KEY}.${providerId}`;
        return await context.secrets.get(key);
      } else {
        // Fallback to global state
        const encrypted = context.globalState.get<string>(`${this.ENCRYPTION_KEY}.${providerId}`);
        if (encrypted) {
          return this.simpleDecrypt(encrypted);
        }
      }
      
      return undefined;
    } catch (error) {
      console.error(`Failed to retrieve credential for ${providerId}:`, error);
      return undefined;
    }
  }
  
  /**
   * Delete a stored credential
   */
  static async deleteCredential(
    context: vscode.ExtensionContext,
    providerId: string
  ): Promise<void> {
    try {
      if (context.secrets) {
        const key = `${this.ENCRYPTION_KEY}.${providerId}`;
        await context.secrets.delete(key);
      } else {
        await context.globalState.update(`${this.ENCRYPTION_KEY}.${providerId}`, undefined);
      }
    } catch (error) {
      console.error(`Failed to delete credential for ${providerId}:`, error);
    }
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
   * Validate that a credential exists and is not empty
   */
  static async validateCredential(
    context: vscode.ExtensionContext,
    providerId: string
  ): Promise<boolean> {
    try {
      const credential = await this.retrieveCredential(context, providerId);
      return credential !== undefined && credential.trim().length > 0;
    } catch (error) {
      console.error(`Failed to validate credential for ${providerId}:`, error);
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