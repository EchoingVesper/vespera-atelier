/**
 * Configuration Flyout - Non-modal, pinnable flyout for provider configuration
 */
import * as React from 'react';
import { ProviderTemplate, ConfigField, ProviderConfig } from '../../../types/provider';
import { InputBehaviorConfig, HotkeyConfig } from '../../../types/config';
import { InputBehaviorSettings } from '../molecules/InputBehaviorSettings';

export interface ConfigurationFlyoutProps {
  // State
  isOpen: boolean;
  isPinned: boolean;
  availableProviders: ProviderTemplate[];
  configuredProviders: Array<{ id: string; template: ProviderTemplate; config: ProviderConfig }>;
  
  // Current configuration state
  selectedProviderId?: string;
  configurationValues: Record<string, any>;
  validationErrors: Record<string, string>;
  isSubmitting: boolean;
  
  // Input behavior configuration
  inputBehaviorConfig?: InputBehaviorConfig;
  hotkeyConfig?: HotkeyConfig;
  
  // Handlers
  onClose: () => void;
  onPin: () => void;
  onUnpin: () => void;
  onProviderSelect: (providerId: string) => void;
  onConfigurationChange: (fieldName: string, value: any) => void;
  onSubmitConfiguration: (providerId: string, config: ProviderConfig) => Promise<void>;
  onRemoveProvider: (providerId: string) => void;
  onSetDefaultProvider: (providerId: string) => void;
  onTestConnection: (providerId: string, config: ProviderConfig) => Promise<boolean>;
  onInputBehaviorChange?: (config: Partial<InputBehaviorConfig>) => void;
  onHotkeyChange?: (hotkeys: Partial<HotkeyConfig>) => void;
}

interface FieldProps {
  field: ConfigField;
  value: any;
  error?: string;
  onChange: (value: any) => void;
  disabled?: boolean;
}

const ConfigField: React.FC<FieldProps> = ({ field, value, error, onChange, disabled = false }) => {
  const [showPassword, setShowPassword] = React.useState(false);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    let newValue: any = e.target.value;
    
    if (field.type === 'number') {
      newValue = newValue === '' ? undefined : Number(newValue);
    } else if (field.type === 'checkbox') {
      newValue = (e.target as HTMLInputElement).checked;
    }
    
    onChange(newValue);
  };
  
  const fieldClasses = [
    'config-field',
    `config-field--${field.type}`,
    error ? 'config-field--error' : '',
    disabled ? 'config-field--disabled' : ''
  ].filter(Boolean).join(' ');
  
  const inputClasses = [
    'config-field__input',
    error ? 'config-field__input--error' : ''
  ].filter(Boolean).join(' ');
  
  const renderInput = () => {
    switch (field.type) {
      case 'password':
        return (
          <div className="config-field__password-wrapper">
            <input
              type={showPassword ? 'text' : 'password'}
              className={inputClasses}
              value={value || ''}
              placeholder={field.placeholder}
              onChange={handleChange}
              disabled={disabled}
              required={field.required}
            />
            <button
              type="button"
              className="config-field__password-toggle"
              onClick={() => setShowPassword(!showPassword)}
              disabled={disabled}
              tabIndex={-1}
            >
              {showPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
        );
        
      case 'textarea':
        return (
          <textarea
            className={inputClasses}
            value={value || ''}
            placeholder={field.placeholder}
            onChange={handleChange}
            disabled={disabled}
            required={field.required}
            rows={4}
          />
        );
        
      case 'select':
        return (
          <select
            className={inputClasses}
            value={value || field.default || ''}
            onChange={handleChange}
            disabled={disabled}
            required={field.required}
          >
            {!field.required && (
              <option value="">-- Select --</option>
            )}
            {field.validation?.options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );
        
      case 'checkbox':
        return (
          <label className="config-field__checkbox-wrapper">
            <input
              type="checkbox"
              className="config-field__checkbox"
              checked={value || false}
              onChange={handleChange}
              disabled={disabled}
            />
            <span className="config-field__checkbox-label">{field.label}</span>
          </label>
        );
        
      case 'number':
        return (
          <input
            type="number"
            className={inputClasses}
            value={value !== undefined ? value : ''}
            placeholder={field.placeholder}
            onChange={handleChange}
            disabled={disabled}
            required={field.required}
            min={field.validation?.min}
            max={field.validation?.max}
            step={field.validation?.step || 'any'}
          />
        );
        
      default: // 'text'
        return (
          <input
            type="text"
            className={inputClasses}
            value={value || ''}
            placeholder={field.placeholder}
            onChange={handleChange}
            disabled={disabled}
            required={field.required}
          />
        );
    }
  };
  
  return (
    <div className={fieldClasses}>
      {field.type !== 'checkbox' && (
        <label className="config-field__label">
          {field.label}
          {field.required && <span className="config-field__required">*</span>}
        </label>
      )}
      
      {renderInput()}
      
      {field.description && (
        <div className="config-field__description">
          {field.description}
        </div>
      )}
      
      {error && (
        <div className="config-field__error">
          {error}
        </div>
      )}
    </div>
  );
};

const ProviderCard: React.FC<{
  provider: { id: string; template: ProviderTemplate; config: ProviderConfig };
  isDefault: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onSetDefault: () => void;
  onTest: () => void;
}> = ({ provider, isDefault, onEdit, onRemove, onSetDefault, onTest }) => {
  return (
    <div className={`provider-card ${isDefault ? 'provider-card--default' : ''}`}>
      <div className="provider-card__header">
        <div className="provider-card__info">
          <h4 className="provider-card__name">{provider.template.name}</h4>
          <div className="provider-card__id">{provider.id}</div>
          {isDefault && (
            <div className="provider-card__default-badge">Default</div>
          )}
        </div>
        
        <div className="provider-card__actions">
          <button
            className="provider-card__action provider-card__action--test"
            onClick={onTest}
            title="Test connection"
          >
            🔗
          </button>
          <button
            className="provider-card__action provider-card__action--edit"
            onClick={onEdit}
            title="Edit configuration"
          >
            ✏️
          </button>
          {!isDefault && (
            <button
              className="provider-card__action provider-card__action--default"
              onClick={onSetDefault}
              title="Set as default"
            >
              ⭐
            </button>
          )}
          <button
            className="provider-card__action provider-card__action--remove"
            onClick={onRemove}
            title="Remove provider"
          >
            🗑️
          </button>
        </div>
      </div>
      
      <div className="provider-card__description">
        {provider.template.description}
      </div>
      
      <div className="provider-card__capabilities">
        {provider.template.capabilities.streaming && (
          <div className="capability-badge">Streaming</div>
        )}
        {provider.template.capabilities.function_calling && (
          <div className="capability-badge">Functions</div>
        )}
        {provider.template.capabilities.image_analysis && (
          <div className="capability-badge">Images</div>
        )}
      </div>
    </div>
  );
};

export const ConfigurationFlyout: React.FC<ConfigurationFlyoutProps> = ({
  isOpen,
  isPinned,
  availableProviders,
  configuredProviders,
  selectedProviderId,
  configurationValues,
  validationErrors,
  isSubmitting,
  inputBehaviorConfig,
  hotkeyConfig,
  onClose,
  onPin,
  onUnpin,
  onProviderSelect,
  onConfigurationChange,
  onSubmitConfiguration,
  onRemoveProvider,
  onSetDefaultProvider,
  onTestConnection,
  onInputBehaviorChange,
  onHotkeyChange
}) => {
  const [activeTab, setActiveTab] = React.useState<'configured' | 'available' | 'settings'>('configured');
  const [testingProvider, setTestingProvider] = React.useState<string | null>(null);
  
  // Get currently selected provider template
  const selectedTemplate = React.useMemo(() => {
    return availableProviders.find(p => p.template_id === selectedProviderId);
  }, [availableProviders, selectedProviderId]);
  
  // Auto-hide on unmount if not pinned
  React.useEffect(() => {
    if (!isOpen || isPinned) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      const flyout = document.querySelector('.configuration-flyout');
      if (flyout && !flyout.contains(e.target as Node)) {
        onClose();
      }
    };
    
    const timeout = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);
    
    return () => {
      clearTimeout(timeout);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, isPinned, onClose]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedProviderId || !selectedTemplate || isSubmitting) {
      return;
    }
    
    try {
      await onSubmitConfiguration(selectedProviderId, configurationValues);
      // Reset form after successful submission
      onProviderSelect('');
    } catch (error) {
      console.error('Failed to submit configuration:', error);
    }
  };
  
  const handleTest = async (providerId: string, config: ProviderConfig) => {
    if (testingProvider) return;
    
    setTestingProvider(providerId);
    try {
      const success = await onTestConnection(providerId, config);
      // Show success/failure feedback
      console.log(`Connection test ${success ? 'passed' : 'failed'} for ${providerId}`);
    } catch (error) {
      console.error('Connection test failed:', error);
    } finally {
      setTestingProvider(null);
    }
  };
  
  const getDefaultProvider = () => {
    return configuredProviders.find(p => 
      configuredProviders.length === 1 || // Single provider is default
      p.config['isDefault'] === true
    );
  };
  
  const defaultProvider = getDefaultProvider();
  
  const flyoutClasses = [
    'configuration-flyout',
    isOpen ? 'configuration-flyout--open' : '',
    isPinned ? 'configuration-flyout--pinned' : '',
    selectedProviderId ? 'configuration-flyout--configuring' : ''
  ].filter(Boolean).join(' ');
  
  if (!isOpen) {
    return null;
  }
  
  return (
    <div className={flyoutClasses}>
      <div className="configuration-flyout__header">
        <div className="configuration-flyout__title">
          {selectedProviderId ? 'Configure Provider' : 'Provider Configuration'}
        </div>
        
        <div className="configuration-flyout__controls">
          <button
            className={`configuration-flyout__pin ${isPinned ? 'configuration-flyout__pin--active' : ''}`}
            onClick={isPinned ? onUnpin : onPin}
            title={isPinned ? 'Unpin flyout' : 'Pin flyout open'}
          >
            📌
          </button>
          <button
            className="configuration-flyout__close"
            onClick={onClose}
            title="Close flyout"
          >
            ✕
          </button>
        </div>
      </div>
      
      <div className="configuration-flyout__content">
        {selectedProviderId && selectedTemplate ? (
          // Configuration form
          <div className="configuration-form">
            <div className="configuration-form__header">
              <button
                className="configuration-form__back"
                onClick={() => onProviderSelect('')}
              >
                ← Back
              </button>
              <div className="configuration-form__provider">
                <h3>{selectedTemplate.name}</h3>
                <div className="configuration-form__provider-description">
                  {selectedTemplate.description}
                </div>
              </div>
            </div>
            
            <form onSubmit={handleSubmit} className="configuration-form__form">
              <div className="configuration-form__fields">
                {selectedTemplate.ui_schema.config_fields.map((field) => (
                  <ConfigField
                    key={field.name}
                    field={field}
                    value={configurationValues[field.name] ?? field.default}
                    error={validationErrors[field.name]}
                    onChange={(value) => onConfigurationChange(field.name, value)}
                    disabled={isSubmitting}
                  />
                ))}
              </div>
              
              <div className="configuration-form__actions">
                <button
                  type="submit"
                  className="configuration-form__submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : 'Save Configuration'}
                </button>
                <button
                  type="button"
                  className="configuration-form__cancel"
                  onClick={() => onProviderSelect('')}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        ) : (
          // Provider list
          <div className="provider-management">
            <div className="provider-tabs">
              <button
                className={`provider-tab ${activeTab === 'configured' ? 'provider-tab--active' : ''}`}
                onClick={() => setActiveTab('configured')}
              >
                Configured ({configuredProviders.length})
              </button>
              <button
                className={`provider-tab ${activeTab === 'available' ? 'provider-tab--active' : ''}`}
                onClick={() => setActiveTab('available')}
              >
                Available ({availableProviders.length})
              </button>
              <button
                className={`provider-tab ${activeTab === 'settings' ? 'provider-tab--active' : ''}`}
                onClick={() => setActiveTab('settings')}
              >
                Settings
              </button>
            </div>
            
            <div className="provider-content">
              {activeTab === 'configured' ? (
                <div className="configured-providers">
                  {configuredProviders.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-state__icon">🔧</div>
                      <div className="empty-state__title">No Providers Configured</div>
                      <div className="empty-state__description">
                        Add a provider from the Available tab to get started.
                      </div>
                    </div>
                  ) : (
                    <div className="provider-list">
                      {configuredProviders.map((provider) => (
                        <ProviderCard
                          key={provider.id}
                          provider={provider}
                          isDefault={provider === defaultProvider}
                          onEdit={() => onProviderSelect(provider.id)}
                          onRemove={() => onRemoveProvider(provider.id)}
                          onSetDefault={() => onSetDefaultProvider(provider.id)}
                          onTest={() => handleTest(provider.id, provider.config)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : activeTab === 'settings' ? (
                <div className="configuration-settings">
                  {inputBehaviorConfig && hotkeyConfig && onInputBehaviorChange && onHotkeyChange ? (
                    <InputBehaviorSettings
                      config={inputBehaviorConfig}
                      hotkeys={hotkeyConfig}
                      onChange={onInputBehaviorChange}
                      onHotkeyChange={onHotkeyChange}
                      disabled={isSubmitting}
                    />
                  ) : (
                    <div className="empty-state">
                      <div className="empty-state__icon">⚙️</div>
                      <div className="empty-state__title">Settings Unavailable</div>
                      <div className="empty-state__description">
                        Settings configuration is not available at this time.
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="available-providers">
                  <div className="available-providers__description">
                    Select a provider template to configure:
                  </div>
                  <div className="provider-templates">
                    {availableProviders.map((template) => {
                      const isConfigured = configuredProviders.some(p => p.id === template.template_id);
                      
                      return (
                        <div
                          key={template.template_id}
                          className={`provider-template ${isConfigured ? 'provider-template--configured' : ''}`}
                          onClick={() => !isConfigured && onProviderSelect(template.template_id)}
                        >
                          <div className="provider-template__header">
                            <h4 className="provider-template__name">{template.name}</h4>
                            {isConfigured && (
                              <div className="provider-template__configured-badge">
                                Configured
                              </div>
                            )}
                          </div>
                          
                          <div className="provider-template__description">
                            {template.description}
                          </div>
                          
                          <div className="provider-template__capabilities">
                            {template.capabilities.streaming && (
                              <div className="capability-badge">Streaming</div>
                            )}
                            {template.capabilities.function_calling && (
                              <div className="capability-badge">Functions</div>
                            )}
                            {template.capabilities.image_analysis && (
                              <div className="capability-badge">Images</div>
                            )}
                          </div>
                          
                          {!isConfigured && (
                            <button className="provider-template__configure">
                              Configure →
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

ConfigurationFlyout.displayName = 'ConfigurationFlyout';