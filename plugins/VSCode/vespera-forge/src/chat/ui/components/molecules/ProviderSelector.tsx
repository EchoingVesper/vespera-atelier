/**
 * Provider Selector molecule component - dropdown for selecting active provider
 */
import * as React from 'react';
import { ProviderIcon } from '../atoms/ProviderIcon';
import { StatusIndicator } from '../atoms/StatusIndicator';
import { ProviderTemplate, ProviderStatus } from '../../../types/provider';

export interface ProviderOption {
  id: string;
  name: string;
  template: ProviderTemplate;
  status: ProviderStatus;
  enabled: boolean;
}

export interface ProviderSelectorProps {
  providers: ProviderOption[];
  selectedProviderId?: string;
  onProviderChange: (providerId: string) => void;
  onProviderConfigure: (providerId: string) => void;
  disabled?: boolean;
  showStatus?: boolean;
  compact?: boolean;
}

export const ProviderSelector: React.FC<ProviderSelectorProps> = ({
  providers,
  selectedProviderId,
  onProviderChange,
  onProviderConfigure,
  disabled = false,
  showStatus = true,
  compact = false
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const selectedProvider = providers.find(p => p.id === selectedProviderId);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleProviderSelect = (providerId: string) => {
    onProviderChange(providerId);
    setIsOpen(false);
  };

  const handleConfigureClick = (e: React.MouseEvent, providerId: string) => {
    e.stopPropagation();
    onProviderConfigure(providerId);
    setIsOpen(false);
  };

  const toggleDropdown = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  const selectorClasses = [
    'provider-selector',
    compact ? 'provider-selector--compact' : '',
    disabled ? 'provider-selector--disabled' : '',
    isOpen ? 'provider-selector--open' : ''
  ].filter(Boolean).join(' ');

  const enabledProviders = providers.filter(p => p.enabled);
  const hasProviders = enabledProviders.length > 0;

  return (
    <div className={selectorClasses} ref={dropdownRef}>
      <button
        className="provider-selector__trigger"
        onClick={toggleDropdown}
        disabled={disabled || !hasProviders}
        aria-label="Select chat provider"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        {selectedProvider ? (
          <div className="provider-selector__selected">
            <ProviderIcon
              providerId={selectedProvider.id}
              providerName={selectedProvider.name}
              status={selectedProvider.status}
              size={compact ? 'small' : 'medium'}
              showTooltip={false}
            />
            {!compact && (
              <span className="provider-selector__name">
                {selectedProvider.name}
              </span>
            )}
            {showStatus && (
              <StatusIndicator
                status={selectedProvider.status}
                variant="inline"
                size={compact ? 'small' : 'medium'}
              />
            )}
          </div>
        ) : (
          <div className="provider-selector__placeholder">
            {hasProviders ? 'Select Provider' : 'No Providers Available'}
          </div>
        )}
        
        {hasProviders && (
          <span className="provider-selector__arrow">
            {isOpen ? '▲' : '▼'}
          </span>
        )}
      </button>

      {isOpen && hasProviders && (
        <div className="provider-selector__dropdown">
          <div className="provider-selector__list" role="listbox">
            {enabledProviders.map((provider) => (
              <div
                key={provider.id}
                className={`provider-selector__option ${
                  provider.id === selectedProviderId ? 'provider-selector__option--selected' : ''
                }`}
                onClick={() => handleProviderSelect(provider.id)}
                role="option"
                aria-selected={provider.id === selectedProviderId}
              >
                <div className="provider-selector__option-content">
                  <ProviderIcon
                    providerId={provider.id}
                    providerName={provider.name}
                    status={provider.status}
                    size="medium"
                    showTooltip={false}
                  />
                  
                  <div className="provider-selector__option-info">
                    <span className="provider-selector__option-name">
                      {provider.name}
                    </span>
                    <span className="provider-selector__option-model">
                      {provider.template.provider_config.model}
                    </span>
                  </div>
                  
                  {showStatus && (
                    <StatusIndicator
                      status={provider.status}
                      variant="dot"
                      size="small"
                    />
                  )}
                </div>
                
                <button
                  className="provider-selector__configure"
                  onClick={(e) => handleConfigureClick(e, provider.id)}
                  title={`Configure ${provider.name}`}
                  aria-label={`Configure ${provider.name}`}
                >
                  ⚙️
                </button>
              </div>
            ))}
          </div>
          
          {enabledProviders.length === 0 && (
            <div className="provider-selector__empty">
              No providers configured
            </div>
          )}
        </div>
      )}
    </div>
  );
};

ProviderSelector.displayName = 'ProviderSelector';