/**
 * Send Button atom component
 */
import * as React from 'react';

export interface SendButtonProps {
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
  size?: 'small' | 'medium' | 'large';
  title?: string;
  loadingText?: string;
  showIcon?: boolean;
  showText?: boolean;
  ariaLabel?: string;
}

export const SendButton: React.FC<SendButtonProps> = ({
  disabled = false,
  loading = false,
  onClick,
  variant = 'primary',
  size = 'medium',
  title,
  loadingText = 'Sending...',
  showIcon = true,
  showText = true,
  ariaLabel
}) => {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!disabled && !loading && onClick) {
      onClick();
    }
  };

  const buttonClasses = [
    'send-button',
    `send-button--${variant}`,
    `send-button--${size}`,
    disabled ? 'send-button--disabled' : '',
    loading ? 'send-button--loading' : ''
  ].filter(Boolean).join(' ');

  const getButtonContent = () => {
    if (loading) {
      return (
        <>
          {showIcon && <span className="send-button__spinner" aria-hidden="true">⟳</span>}
          {showText && <span className="send-button__text">{loadingText}</span>}
        </>
      );
    }
    
    return (
      <>
        {showIcon && <span className="send-button__icon" aria-hidden="true">➤</span>}
        {showText && <span className="send-button__text">Send</span>}
      </>
    );
  };

  // Dynamic title generation
  const getTitle = () => {
    if (title) return title;
    if (loading) return loadingText;
    if (disabled) return 'Cannot send message';
    return 'Send message';
  };

  // Dynamic aria-label generation
  const getAriaLabel = () => {
    if (ariaLabel) return ariaLabel;
    if (loading) return `Sending message: ${loadingText}`;
    if (disabled) return 'Send button disabled';
    return 'Send message';
  };

  return (
    <button
      className={buttonClasses}
      onClick={handleClick}
      disabled={disabled || loading}
      type="button"
      aria-label={getAriaLabel()}
      title={getTitle()}
      aria-pressed={loading}
      aria-busy={loading}
    >
      {getButtonContent()}
    </button>
  );
};

SendButton.displayName = 'SendButton';