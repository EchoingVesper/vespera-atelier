/**
 * Input Behavior Settings molecule component - configuration for input behavior
 */
import * as React from 'react';
import { InputBehaviorConfig, HotkeyConfig } from '../../../types/config';

export interface InputBehaviorSettingsProps {
  config: InputBehaviorConfig;
  hotkeys: HotkeyConfig;
  onChange: (config: Partial<InputBehaviorConfig>) => void;
  onHotkeyChange: (hotkeys: Partial<HotkeyConfig>) => void;
  disabled?: boolean;
}

export const InputBehaviorSettings: React.FC<InputBehaviorSettingsProps> = ({
  config,
  hotkeys,
  onChange,
  onHotkeyChange,
  disabled = false
}) => {
  const handleToggle = (key: keyof InputBehaviorConfig) => {
    onChange({
      [key]: !config[key]
    });
  };

  const handleNumberChange = (key: keyof InputBehaviorConfig, value: number) => {
    onChange({
      [key]: Math.max(1, Math.min(1000, value)) // Clamp between 1 and 1000
    });
  };

  const handleHotkeyChange = (key: keyof HotkeyConfig, value: string) => {
    onHotkeyChange({
      [key]: value
    });
  };

  return (
    <div className="input-behavior-settings">
      <div className="input-behavior-settings__header">
        <h3 className="input-behavior-settings__title">Input Behavior</h3>
        <p className="input-behavior-settings__description">
          Configure how the message input behaves
        </p>
      </div>

      <div className="input-behavior-settings__section">
        <h4 className="input-behavior-settings__section-title">Send Keys</h4>
        <div className="input-behavior-settings__hotkey-group">
          <div className="input-behavior-settings__field">
            <label className="input-behavior-settings__label">
              Send Message
            </label>
            <select
              className="input-behavior-settings__select"
              value={hotkeys.send}
              onChange={(e) => handleHotkeyChange('send', e.target.value as HotkeyConfig['send'])}
              disabled={disabled}
            >
              <option value="enter">Enter</option>
              <option value="shift_enter">Shift+Enter</option>
              <option value="ctrl_enter">Ctrl+Enter</option>
            </select>
            <div className="input-behavior-settings__field-description">
              Key combination to send messages
            </div>
          </div>

          <div className="input-behavior-settings__field">
            <label className="input-behavior-settings__label">
              New Line
            </label>
            <select
              className="input-behavior-settings__select"
              value={hotkeys.newLine}
              onChange={(e) => handleHotkeyChange('newLine', e.target.value as HotkeyConfig['newLine'])}
              disabled={disabled}
            >
              <option value="shift_enter">Shift+Enter</option>
              <option value="ctrl_enter">Ctrl+Enter</option>
              <option value="alt_enter">Alt+Enter</option>
            </select>
            <div className="input-behavior-settings__field-description">
              Key combination to add new lines
            </div>
          </div>
        </div>
      </div>

      <div className="input-behavior-settings__section">
        <h4 className="input-behavior-settings__section-title">Input Features</h4>
        
        <div className="input-behavior-settings__field">
          <label className="input-behavior-settings__checkbox-wrapper">
            <input
              type="checkbox"
              className="input-behavior-settings__checkbox"
              checked={config.showCharacterCounter}
              onChange={() => handleToggle('showCharacterCounter')}
              disabled={disabled}
            />
            <span className="input-behavior-settings__checkbox-label">
              Show character counter
            </span>
          </label>
          <div className="input-behavior-settings__field-description">
            Display character count and limit
          </div>
        </div>

        <div className="input-behavior-settings__field">
          <label className="input-behavior-settings__checkbox-wrapper">
            <input
              type="checkbox"
              className="input-behavior-settings__checkbox"
              checked={config.sendOnPaste}
              onChange={() => handleToggle('sendOnPaste')}
              disabled={disabled}
            />
            <span className="input-behavior-settings__checkbox-label">
              Send on paste
            </span>
          </label>
          <div className="input-behavior-settings__field-description">
            Automatically send messages when pasting content
          </div>
        </div>

        <div className="input-behavior-settings__field">
          <label className="input-behavior-settings__checkbox-wrapper">
            <input
              type="checkbox"
              className="input-behavior-settings__checkbox"
              checked={config.enableCommandDetection}
              onChange={() => handleToggle('enableCommandDetection')}
              disabled={disabled}
            />
            <span className="input-behavior-settings__checkbox-label">
              Enable command detection
            </span>
          </label>
          <div className="input-behavior-settings__field-description">
            Detect and handle commands starting with "/" (e.g., /clear, /help)
          </div>
        </div>

        <div className="input-behavior-settings__field">
          <label className="input-behavior-settings__checkbox-wrapper">
            <input
              type="checkbox"
              className="input-behavior-settings__checkbox"
              checked={config.enableHistoryNavigation}
              onChange={() => handleToggle('enableHistoryNavigation')}
              disabled={disabled}
            />
            <span className="input-behavior-settings__checkbox-label">
              Enable input history
            </span>
          </label>
          <div className="input-behavior-settings__field-description">
            Navigate previous messages with up/down arrow keys
          </div>
        </div>

        <div className="input-behavior-settings__field">
          <label className="input-behavior-settings__checkbox-wrapper">
            <input
              type="checkbox"
              className="input-behavior-settings__checkbox"
              checked={config.enableDraftPersistence}
              onChange={() => handleToggle('enableDraftPersistence')}
              disabled={disabled}
            />
            <span className="input-behavior-settings__checkbox-label">
              Save drafts automatically
            </span>
          </label>
          <div className="input-behavior-settings__field-description">
            Automatically save and restore message drafts
          </div>
        </div>
      </div>

      <div className="input-behavior-settings__section">
        <h4 className="input-behavior-settings__section-title">Advanced Settings</h4>
        
        <div className="input-behavior-settings__field">
          <label className="input-behavior-settings__label">
            History Size
          </label>
          <input
            type="number"
            className="input-behavior-settings__input"
            value={config.maxHistorySize}
            onChange={(e) => handleNumberChange('maxHistorySize', parseInt(e.target.value) || 50)}
            disabled={disabled}
            min="1"
            max="1000"
          />
          <div className="input-behavior-settings__field-description">
            Maximum number of messages to keep in history (1-1000)
          </div>
        </div>

        <div className="input-behavior-settings__field">
          <label className="input-behavior-settings__label">
            Draft Save Delay (ms)
          </label>
          <input
            type="number"
            className="input-behavior-settings__input"
            value={config.draftSaveDelay}
            onChange={(e) => handleNumberChange('draftSaveDelay', parseInt(e.target.value) || 1000)}
            disabled={disabled}
            min="100"
            max="10000"
            step="100"
          />
          <div className="input-behavior-settings__field-description">
            Delay before automatically saving drafts (100-10000ms)
          </div>
        </div>
      </div>
    </div>
  );
};

InputBehaviorSettings.displayName = 'InputBehaviorSettings';