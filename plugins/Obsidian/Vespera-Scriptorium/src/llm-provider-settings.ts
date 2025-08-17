// This file contains the refactored LLM provider settings UI components
// It's meant to be used as a reference for updating the main.ts file

import { Setting, TextComponent, ButtonComponent, Notice } from 'obsidian';
import { debounce } from 'obsidian';

/**
 * Interface for the plugin instance
 */
interface PluginInstance {
  settings: {
    llm: {
      provider: string;
      endpoint: string;
      defaultEndpoint: string;
      [key: string]: any;
    };
    [key: string]: any;
  };
  saveSettings: () => Promise<void>;
  initializeLLMClient: () => void;
  llmClient: {
    testConnection: () => Promise<boolean>;
  };
}

/**
 * Interface for endpoint change callback
 */
type EndpointChangeCallback = (provider: string, endpoint: string) => void;

/**
 * Renders the LLM provider settings UI components
 * @param containerEl The container element to render the settings in
 * @param plugin The plugin instance
 * @param getDefaultEndpoint Function to get the default endpoint for a provider
 * @param onEndpointChange Optional callback for when the endpoint changes
 */
export function renderLLMProviderSettings(
  containerEl: HTMLElement,
  plugin: PluginInstance,
  getDefaultEndpoint: (provider: string) => string,
  onEndpointChange?: EndpointChangeCallback
): void {
    // LLM settings
    containerEl.createEl('h3', { text: 'LLM Options' });

    // Define component references
    let endpointTextComponent: TextComponent;
    let resetButtonComponent: ButtonComponent;
    
    // Create a debounced save function to prevent saving on every keystroke
    const debouncedSave = debounce(async (value: string) => {
      plugin.settings.llm.endpoint = value;
      await plugin.saveSettings();
      
      // Call the endpoint change callback if provided
      if (onEndpointChange) {
        onEndpointChange(plugin.settings.llm.provider, value);
      }
    }, 500);

    // Function to update reset button visibility
    const updateResetButtonVisibility = (currentValue: string) => {
      if (!resetButtonComponent) return;
      
      const defaultEndpoint = getDefaultEndpoint(plugin.settings.llm.provider);
      resetButtonComponent.buttonEl.style.display =
        currentValue === defaultEndpoint ? 'none' : 'inline-block';
    };

    // Provider dropdown
    new Setting(containerEl)
      .setName('LLM Provider')
      .setDesc('Select your LLM provider')
      .addDropdown(dropdown => dropdown
        .addOption('ollama', 'Ollama')
        .addOption('lm_studio', 'LM Studio')
        .setValue(plugin.settings.llm.provider)
        .onChange(async (value) => {
          // Update provider in settings
          plugin.settings.llm.provider = value;
          
          // Get default endpoint for the selected provider
          const defaultEndpoint = getDefaultEndpoint(value);
          plugin.settings.llm.defaultEndpoint = defaultEndpoint;

          // Always use the hardcoded default endpoint when switching providers
          // This ensures we use the correct port (e.g., 1234 for LM Studio) instead of any outdated saved value
          plugin.settings.llm.endpoint = defaultEndpoint;
          
          // Update input field without losing focus
          if (endpointTextComponent) {
            endpointTextComponent.setValue(defaultEndpoint);
          }

          // Save settings
          await plugin.saveSettings();

          // Update reset button visibility
          updateResetButtonVisibility(defaultEndpoint);
          
          // Re-initialize LLM client with new settings
          plugin.initializeLLMClient();
          
          // Call the endpoint change callback if provided
          if (onEndpointChange) {
            onEndpointChange(value, defaultEndpoint);
          }
        }));

    // Endpoint setting with reset button and input field
    const endpointSetting = new Setting(containerEl)
      .setName('LLM Endpoint')
      .setDesc('The endpoint URL for your LLM provider');

    // Add Reset to Default button BEFORE the endpoint input field
    endpointSetting.addButton(button => {
      resetButtonComponent = button;
      button
        .setButtonText('Reset to Default')
        .setCta()
        .onClick(async () => {
          const defaultEndpoint = getDefaultEndpoint(plugin.settings.llm.provider);
          plugin.settings.llm.endpoint = defaultEndpoint;
          
          // Update input field using the API method
          if (endpointTextComponent) {
            endpointTextComponent.setValue(defaultEndpoint);
          }
          
          await plugin.saveSettings();
          
          // Hide button after resetting
          button.buttonEl.style.display = 'none';
          
          // Call the endpoint change callback if provided
          if (onEndpointChange) {
            onEndpointChange(plugin.settings.llm.provider, defaultEndpoint);
          }
        });
    });

    // Add Endpoint input field
    endpointSetting.addText(text => {
      endpointTextComponent = text;
      text
        .setPlaceholder('e.g., http://localhost:11434')
        .setValue(plugin.settings.llm.endpoint)
        .onChange((value) => {
          // Update reset button visibility immediately for responsive UI
          updateResetButtonVisibility(value);
          
          // Use debounced save to prevent saving on every keystroke
          debouncedSave(value);
        });
        
      // Add event listeners for immediate save on blur or Enter key
      const inputEl = text.inputEl;
      
      // Save on blur (when focus leaves the input field)
      inputEl.addEventListener('blur', async () => {
        debouncedSave.cancel(); // Cancel any pending debounced saves
        plugin.settings.llm.endpoint = inputEl.value;
        await plugin.saveSettings();
        
        // Call the endpoint change callback if provided
        if (onEndpointChange) {
          onEndpointChange(plugin.settings.llm.provider, inputEl.value);
        }
      });
      
      // Save on Enter key
      inputEl.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
          debouncedSave.cancel(); // Cancel any pending debounced saves
          plugin.settings.llm.endpoint = inputEl.value;
          await plugin.saveSettings();
          
          // Call the endpoint change callback if provided
          if (onEndpointChange) {
            onEndpointChange(plugin.settings.llm.provider, inputEl.value);
          }
          
          // Remove focus from the input field
          inputEl.blur();
        }
      });
    });

    // Initial state for the reset button - set immediately after components are initialized
    setTimeout(() => {
      updateResetButtonVisibility(plugin.settings.llm.endpoint);
    }, 0);

    // Add Test Connection button
    new Setting(containerEl)
      .addButton(button => {
        button
          .setButtonText('Test Connection')
          .onClick(async () => {
            new Notice('Testing connection...');
            try {
              const success = await plugin.llmClient.testConnection();
              if (success) {
                new Notice('Connection successful!');
              } else {
                new Notice('Connection failed. Please check your endpoint and provider settings.');
              }
            } catch (error: any) {
              console.error('Connection test failed:', error);
              new Notice(`Connection test failed: ${error.message}`);
            }
          });
      });
}