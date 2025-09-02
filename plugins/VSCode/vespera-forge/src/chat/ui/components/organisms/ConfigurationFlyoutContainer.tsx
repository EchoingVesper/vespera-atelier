/**
 * Configuration Flyout Container - Manages state and WebView integration
 */
import * as React from 'react';
import { ConfigurationFlyout } from './ConfigurationFlyout';
import { ProviderTemplate, ProviderConfig } from '../../../types/provider';

// WebView communication interface
interface WebViewAPI {
  postMessage: (message: { type: string; data?: any; requestId?: string }) => void;
}

// Global WebView API (injected by VS Code)
declare global {
  const vscode: WebViewAPI;
}

export interface ConfigurationFlyoutContainerProps {
  isOpen: boolean;
  isPinned: boolean;
  onClose: () => void;
  onPin: () => void;
  onUnpin: () => void;
}

interface ConfigurationState {
  availableProviders: ProviderTemplate[];
  configuredProviders: Array<{ id: string; template: ProviderTemplate; config: ProviderConfig }>;
  selectedProviderId?: string;
  configurationValues: Record<string, any>;
  validationErrors: Record<string, string>;
  isSubmitting: boolean;
  isLoading: boolean;
}

export const ConfigurationFlyoutContainer: React.FC<ConfigurationFlyoutContainerProps> = ({
  isOpen,
  isPinned,
  onClose,
  onPin,
  onUnpin
}) => {
  const [state, setState] = React.useState<ConfigurationState>({
    availableProviders: [],
    configuredProviders: [],
    selectedProviderId: undefined,
    configurationValues: {},
    validationErrors: {},
    isSubmitting: false,
    isLoading: false
  });
  
  const requestIdRef = React.useRef(0);
  const pendingRequestsRef = React.useRef<Map<string, (response: any) => void>>(new Map());
  
  // Generate unique request ID
  const generateRequestId = () => {
    return `req_${++requestIdRef.current}`;
  };
  
  // Send message to VS Code extension and wait for response
  const sendMessage = <T = any>(type: string, data?: any): Promise<T> => {
    return new Promise((resolve, reject) => {
      const requestId = generateRequestId();
      
      pendingRequestsRef.current.set(requestId, (response) => {
        if (response.success) {
          resolve(response.data);
        } else {
          reject(new Error(response.error || 'Request failed'));
        }
      });
      
      vscode.postMessage({ type, data, requestId });
      
      // Timeout after 30 seconds
      setTimeout(() => {
        const callback = pendingRequestsRef.current.get(requestId);
        if (callback) {
          pendingRequestsRef.current.delete(requestId);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  };
  
  // Handle messages from VS Code extension
  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      
      if (message.requestId && pendingRequestsRef.current.has(message.requestId)) {
        const callback = pendingRequestsRef.current.get(message.requestId);
        if (callback) {
          callback(message);
          pendingRequestsRef.current.delete(message.requestId);
        }
        return;
      }
      
      // Handle non-request messages (events, notifications)
      switch (message.type) {
        case 'configurationChanged':
          loadProviderData();
          break;
        case 'providerConnected':
        case 'providerDisconnected':
          loadProviderData();
          break;
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);
  
  // Load provider data from extension
  const loadProviderData = React.useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      
      const response = await sendMessage<{
        available: ProviderTemplate[];
        configured: Array<{ id: string; template: ProviderTemplate; config: ProviderConfig }>;
      }>('requestAvailableProviders');
      
      setState(prev => ({
        ...prev,
        availableProviders: response.available,
        configuredProviders: response.configured,
        isLoading: false
      }));
    } catch (error) {
      console.error('Failed to load provider data:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);
  
  // Load data when flyout opens
  React.useEffect(() => {
    if (isOpen) {
      loadProviderData();
    }
  }, [isOpen, loadProviderData]);
  
  // Handle provider selection
  const handleProviderSelect = async (providerId: string) => {
    if (!providerId) {
      setState(prev => ({
        ...prev,
        selectedProviderId: undefined,
        configurationValues: {},
        validationErrors: {}
      }));
      return;
    }
    
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      
      const response = await sendMessage<{
        template: ProviderTemplate;
        existingConfig: ProviderConfig;
      }>('requestProviderTemplate', { providerId });
      
      // Initialize form values with existing config or defaults
      const initialValues: Record<string, any> = {};
      for (const field of response.template.ui_schema.config_fields) {
        if (response.existingConfig && response.existingConfig[field.name] !== undefined) {
          initialValues[field.name] = response.existingConfig[field.name];
        } else if (field.default !== undefined) {
          initialValues[field.name] = field.default;
        }
      }
      
      setState(prev => ({
        ...prev,
        selectedProviderId: providerId,
        configurationValues: initialValues,
        validationErrors: {},
        isLoading: false
      }));
    } catch (error) {
      console.error('Failed to get provider template:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };
  
  // Handle configuration field changes with real-time validation
  const handleConfigurationChange = async (fieldName: string, value: any) => {
    const newValues = { ...state.configurationValues, [fieldName]: value };
    
    setState(prev => ({
      ...prev,
      configurationValues: newValues
    }));
    
    // Debounced validation
    if (state.selectedProviderId) {
      try {
        const response = await sendMessage<{
          valid: boolean;
          errors: Record<string, string>;
        }>('validateProviderConfig', {
          providerId: state.selectedProviderId,
          config: newValues
        });
        
        setState(prev => ({
          ...prev,
          validationErrors: response.errors || {}
        }));
      } catch (error) {
        console.error('Validation failed:', error);
      }
    }
  };
  
  // Submit configuration
  const handleSubmitConfiguration = async (providerId: string, config: ProviderConfig) => {
    try {
      setState(prev => ({ ...prev, isSubmitting: true }));
      
      await sendMessage('configureProvider', {
        providerId,
        config,
        scope: 'user'
      });
      
      // Reload provider data to reflect changes
      await loadProviderData();
      
      setState(prev => ({
        ...prev,
        selectedProviderId: undefined,
        configurationValues: {},
        validationErrors: {},
        isSubmitting: false
      }));
    } catch (error) {
      console.error('Failed to save configuration:', error);
      setState(prev => ({ ...prev, isSubmitting: false }));
      throw error; // Let the component handle the error display
    }
  };
  
  // Remove provider
  const handleRemoveProvider = async (providerId: string) => {
    if (!confirm(`Are you sure you want to remove the "${providerId}" provider?`)) {
      return;
    }
    
    try {
      await sendMessage('removeProvider', {
        providerId,
        scope: 'user'
      });
      
      await loadProviderData();
    } catch (error) {
      console.error('Failed to remove provider:', error);
      alert(`Failed to remove provider: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
  
  // Set default provider
  const handleSetDefaultProvider = async (providerId: string) => {
    try {
      await sendMessage('setDefaultProvider', {
        providerId,
        scope: 'user'
      });
      
      await loadProviderData();
    } catch (error) {
      console.error('Failed to set default provider:', error);
      alert(`Failed to set default provider: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
  
  // Test connection
  const handleTestConnection = async (providerId: string, config: ProviderConfig): Promise<boolean> => {
    try {
      const response = await sendMessage<{
        connected: boolean;
        message: string;
      }>('testProviderConnection', {
        providerId,
        config
      });
      
      const success = response.connected;
      const message = response.message;
      
      if (success) {
        alert(`✅ ${message}`);
      } else {
        alert(`❌ ${message}`);
      }
      
      return success;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection test failed';
      alert(`❌ ${message}`);
      return false;
    }
  };
  
  if (!isOpen) {
    return null;
  }
  
  return (
    <ConfigurationFlyout
      isOpen={isOpen}
      isPinned={isPinned}
      availableProviders={state.availableProviders}
      configuredProviders={state.configuredProviders}
      selectedProviderId={state.selectedProviderId}
      configurationValues={state.configurationValues}
      validationErrors={state.validationErrors}
      isSubmitting={state.isSubmitting}
      onClose={onClose}
      onPin={onPin}
      onUnpin={onUnpin}
      onProviderSelect={handleProviderSelect}
      onConfigurationChange={handleConfigurationChange}
      onSubmitConfiguration={handleSubmitConfiguration}
      onRemoveProvider={handleRemoveProvider}
      onSetDefaultProvider={handleSetDefaultProvider}
      onTestConnection={handleTestConnection}
    />
  );
};

ConfigurationFlyoutContainer.displayName = 'ConfigurationFlyoutContainer';