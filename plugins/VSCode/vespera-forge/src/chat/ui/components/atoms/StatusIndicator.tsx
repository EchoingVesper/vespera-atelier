/**
 * Status Indicator atom component
 */
import * as React from 'react';
import { ProviderStatus } from '../../../types/provider';

export interface StatusIndicatorProps {
  status: ProviderStatus;
  text?: string;
  variant?: 'dot' | 'badge' | 'inline';
  size?: 'small' | 'medium' | 'large';
  animated?: boolean;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  text,
  variant = 'dot',
  size = 'medium',
  animated = true
}) => {
  const getStatusColor = (status: ProviderStatus): 'success' | 'warning' | 'error' | 'inactive' => {
    switch (status) {
      case ProviderStatus.Connected:
        return 'success';
      case ProviderStatus.Connecting:
        return 'warning';
      case ProviderStatus.Error:
        return 'error';
      case ProviderStatus.Disconnected:
      default:
        return 'inactive';
    }
  };

  const getStatusText = (status: ProviderStatus): string => {
    if (text) return text;
    
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

  const indicatorClasses = [
    'status-indicator',
    `status-indicator--${variant}`,
    `status-indicator--${size}`,
    `status-indicator--${getStatusColor(status)}`,
    animated && status === ProviderStatus.Connecting ? 'status-indicator--animated' : ''
  ].filter(Boolean).join(' ');

  const renderDot = () => (
    <div className={indicatorClasses}>
      <div className="status-indicator__dot" />
      {variant !== 'dot' && (
        <span className="status-indicator__text">
          {getStatusText(status)}
        </span>
      )}
    </div>
  );

  const renderBadge = () => (
    <div className={indicatorClasses}>
      <div className="status-indicator__badge">
        <div className="status-indicator__dot" />
        <span className="status-indicator__text">
          {getStatusText(status)}
        </span>
      </div>
    </div>
  );

  const renderInline = () => (
    <span className={indicatorClasses}>
      <span className="status-indicator__dot" />
      <span className="status-indicator__text">
        {getStatusText(status)}
      </span>
    </span>
  );

  switch (variant) {
    case 'badge':
      return renderBadge();
    case 'inline':
      return renderInline();
    case 'dot':
    default:
      return renderDot();
  }
};

StatusIndicator.displayName = 'StatusIndicator';