# Configuration Flyout System

This directory contains the provider configuration flyout system for the Vespera Forge chat system.

## Components

### ConfigurationFlyout.tsx
The main React component that renders the non-modal, pinnable flyout for provider configuration.

**Features:**
- Non-modal design that doesn't block other functionality
- Pinnable - users can pin it open or let it auto-hide
- Template-driven configuration forms
- Real-time validation with error feedback
- Provider management (add, remove, set default)
- Connection testing
- Support for multiple provider types (OpenAI, Anthropic, LM Studio, custom)

### ConfigurationFlyoutContainer.tsx
The container component that manages state and handles WebView communication with the VS Code extension.

**Responsibilities:**
- State management for the flyout
- WebView message handling
- Real-time form validation
- Provider data loading
- Event handling for configuration changes

### Usage

The configuration flyout is integrated into the ChatWindow component and can be opened by clicking the settings (⚙️) button in the chat interface.

```tsx
import { ConfigurationFlyoutContainer } from './ConfigurationFlyoutContainer';

// In your ChatWindow or similar component
<ConfigurationFlyoutContainer
  isOpen={isConfigFlyoutOpen}
  isPinned={isConfigFlyoutPinned}
  onClose={() => setIsConfigFlyoutOpen(false)}
  onPin={() => setIsConfigFlyoutPinned(true)}
  onUnpin={() => setIsConfigFlyoutPinned(false)}
/>
```

## Configuration Flow

1. **Template Loading**: Provider templates are loaded from JSON5 files in the `templates/providers/` directory
2. **Form Generation**: UI forms are dynamically generated based on template `ui_schema`
3. **Validation**: Real-time validation using template `config_schema` or UI validation rules
4. **Persistence**: Configurations are saved to VS Code settings with sensitive data encrypted
5. **Events**: Configuration changes emit VesperaEvents for cross-system integration

## Provider Templates

Provider templates define:
- Provider metadata (name, description, capabilities)
- Authentication configuration
- UI schema for configuration forms
- JSON schema for validation
- Default values and validation rules

See `templates/providers/` for examples.

## Styling

The flyout uses VS Code theming variables and is styled in `../styles/configuration-flyout.css`.

The design follows VS Code's design language:
- Uses native VS Code colors and fonts
- Respects user's theme (light/dark)
- Consistent with VS Code's UI patterns
- Accessible focus states and keyboard navigation

## Integration

The configuration system integrates with:
- **VesperaEvents**: Cross-component communication
- **VS Code Settings**: Persistent configuration storage
- **Template Registry**: Dynamic provider template loading
- **Configuration Manager**: Validation and encryption
- **Chat System**: Provider selection and usage