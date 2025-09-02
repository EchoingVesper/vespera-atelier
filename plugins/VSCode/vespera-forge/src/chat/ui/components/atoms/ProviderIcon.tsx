/**
 * Provider Icon atom component
 */
import * as React from 'react';
import { ProviderStatus } from '../../../types/provider';

export interface ProviderIconProps {
  providerId: string;
  providerName: string;
  status: ProviderStatus;
  size?: 'small' | 'medium' | 'large';
  showTooltip?: boolean;
}

export const ProviderIcon: React.FC<ProviderIconProps> = ({
  providerId,
  providerName,
  status,
  size = 'medium',
  showTooltip = true
}) => {
  const getProviderIcon = (providerId: string): string => {
    // TODO: Use actual provider icons from media/chat/icons/
    switch (providerId.toLowerCase()) {
      case 'openai':
        return '🤖';
      case 'anthropic':
        return '🧠';
      case 'lmstudio':
        return '🏠';
      default:
        return '💬';
    }
  };

  const getStatusIndicator = (status: ProviderStatus): string => {
    switch (status) {
      case ProviderStatus.Connected:
        return '🟢';
      case ProviderStatus.Connecting:
        return '🟡';
      case ProviderStatus.Error:
        return '🔴';
      case ProviderStatus.Disconnected:
      default:
        return '⚫';
    }
  };

  const getStatusText = (status: ProviderStatus): string => {
    switch (status) {
      case ProviderStatus.Connected:
        return 'Connected';
      case ProviderStatus.Connecting:
        return 'Connecting...';
      case ProviderStatus.Error:
        return 'Error';
      case ProviderStatus.Disconnected:
      default:
        return 'Disconnected';
    }
  };

  const iconClasses = [
    'provider-icon',
    `provider-icon--${size}`,
    `provider-icon--${status}`
  ].join(' ');

  const tooltipText = showTooltip 
    ? `${providerName} - ${getStatusText(status)}`
    : undefined;

  return (
    <div 
      className={iconClasses}
      title={tooltipText}
      data-provider-id={providerId}
      data-provider-status={status}
    >
      <span className="provider-icon__main">
        {getProviderIcon(providerId)}
      </span>
      <span className="provider-icon__status">
        {getStatusIndicator(status)}
      </span>
    </div>
  );
};

ProviderIcon.displayName = 'ProviderIcon';