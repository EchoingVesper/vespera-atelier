/**
 * Vespera Forge Chat WebView JavaScript
 * Handles UI interactions and communication with VS Code extension
 */

(function() {
  'use strict';

  // Get VS Code API
  const vscode = acquireVsCodeApi();
  
  // Application state
  let state = {
    messages: [],
    providers: [],
    selectedProviderId: null,
    loading: false,
    streaming: false,
    config: {
      showTimestamps: true,
      compactMode: false,
      hotkeys: {
        send: 'enter',
        newLine: 'shift_enter'
      }
    }
  };

  // DOM elements
  let elements = {};

  // Initialize the chat interface
  function initialize() {
    console.log('[Chat] Initializing chat interface...');
    
    createChatInterface();
    bindEventListeners();
    setupMessageListener();
    
    // Request initial data
    sendMessage('requestProviders');
    sendMessage('requestHistory');
    
    console.log('[Chat] Chat interface initialized');
  }

  // Create the main chat interface
  function createChatInterface() {
    const root = document.getElementById('chat-root');
    if (!root) return;

    root.innerHTML = `
      <div class="chat-window">
        <div class="chat-window__header">
          <div class="chat-window__title">Chat</div>
          <div class="chat-window__controls">
            <div class="provider-selector" id="provider-selector">
              <button class="provider-selector__trigger" id="provider-trigger">
                <div class="provider-selector__placeholder">Loading providers...</div>
              </button>
            </div>
            <div class="chat-window__actions">
              <button class="chat-window__action" id="clear-history" title="Clear chat history">🗑️</button>
              <button class="chat-window__action" id="export-history" title="Export chat history">📤</button>
            </div>
          </div>
        </div>
        
        <div class="chat-window__messages" id="messages-container">
          <div class="chat-window__empty">
            <div class="chat-window__empty-content">
              <div class="chat-window__empty-icon">💬</div>
              <div class="chat-window__empty-title">Start a conversation</div>
              <div class="chat-window__empty-description">Configure a provider and type a message below to begin</div>
            </div>
          </div>
        </div>
        
        <div class="chat-window__input">
          <div class="message-input">
            <div class="message-input__container">
              <textarea 
                class="message-input__textarea" 
                id="message-input"
                placeholder="Type your message..."
                rows="3"
              ></textarea>
              <div class="message-input__send">
                <button class="send-button" id="send-button">
                  <span class="send-button__icon">➤</span>
                  <span class="send-button__text">Send</span>
                </button>
              </div>
            </div>
            <div class="message-input__footer">
              <div class="message-input__hints">
                <span class="message-input__hint">Enter to send</span>
                <span class="message-input__hint">Shift+Enter for new line</span>
              </div>
              <div class="message-input__counter" id="character-counter">0 / 4000</div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Cache DOM elements
    elements = {
      root: root,
      messagesContainer: document.getElementById('messages-container'),
      messageInput: document.getElementById('message-input'),
      sendButton: document.getElementById('send-button'),
      characterCounter: document.getElementById('character-counter'),
      providerSelector: document.getElementById('provider-selector'),
      providerTrigger: document.getElementById('provider-trigger'),
      clearHistory: document.getElementById('clear-history'),
      exportHistory: document.getElementById('export-history')
    };
  }

  // Bind event listeners
  function bindEventListeners() {
    // Message input events
    if (elements.messageInput) {
      elements.messageInput.addEventListener('input', handleInputChange);
      elements.messageInput.addEventListener('keydown', handleInputKeydown);
    }

    // Send button
    if (elements.sendButton) {
      elements.sendButton.addEventListener('click', handleSendMessage);
    }

    // Action buttons
    if (elements.clearHistory) {
      elements.clearHistory.addEventListener('click', handleClearHistory);
    }
    
    if (elements.exportHistory) {
      elements.exportHistory.addEventListener('click', handleExportHistory);
    }

    // Provider selector
    if (elements.providerTrigger) {
      elements.providerTrigger.addEventListener('click', handleProviderSelectorToggle);
    }

    // Auto-resize textarea
    if (elements.messageInput) {
      autoResizeTextarea(elements.messageInput);
    }
  }

  // Setup message listener for communication with extension
  function setupMessageListener() {
    window.addEventListener('message', event => {
      const message = event.data;
      console.log('[Chat] Received message from extension:', message.type, message.data);

      switch (message.type) {
        case 'providersUpdated':
          handleProvidersUpdated(message.data);
          break;
        case 'historyUpdated':
          handleHistoryUpdated(message.data);
          break;
        case 'messageReceived':
          handleMessageReceived(message.data);
          break;
        case 'configurationChanged':
          handleConfigurationChanged(message.data);
          break;
        case 'providerConnected':
          handleProviderStatusChanged(message.data.providerId, 'connected');
          break;
        case 'providerDisconnected':
          handleProviderStatusChanged(message.data.providerId, 'disconnected');
          break;
        default:
          console.log('[Chat] Unknown message type:', message.type);
      }
    });
  }

  // Handle input changes
  function handleInputChange() {
    const input = elements.messageInput;
    if (!input) return;

    const value = input.value;
    const maxLength = 4000;
    
    // Update character counter
    updateCharacterCounter(value.length, maxLength);
    
    // Update send button state
    updateSendButtonState();
    
    // Auto-resize
    autoResizeTextarea(input);
  }

  // Handle input keydown events
  function handleInputKeydown(event) {
    const { hotkeys } = state.config;
    
    const isEnter = event.key === 'Enter';
    const isShift = event.shiftKey;
    const isCtrl = event.ctrlKey || event.metaKey;

    // Determine if this should send the message
    const shouldSend = 
      (hotkeys.send === 'enter' && isEnter && !isShift && !isCtrl) ||
      (hotkeys.send === 'shift_enter' && isEnter && isShift) ||
      (hotkeys.send === 'ctrl_enter' && isEnter && isCtrl);

    if (shouldSend) {
      event.preventDefault();
      handleSendMessage();
    }
  }

  // Handle send message
  function handleSendMessage() {
    const input = elements.messageInput;
    if (!input) return;

    const content = input.value.trim();
    if (!content || state.loading) return;

    // Clear input
    input.value = '';
    handleInputChange();

    // Add user message to UI immediately
    addMessageToUI({
      id: `msg_${Date.now()}`,
      role: 'user',
      content: content,
      timestamp: new Date(),
      threadId: 'current'
    });

    // Send to extension
    sendMessage('sendMessage', {
      content: content,
      providerId: state.selectedProviderId
    });

    // Update state
    state.loading = true;
    updateSendButtonState();
  }

  // Handle provider selector toggle
  function handleProviderSelectorToggle() {
    // TODO: Implement provider dropdown
    console.log('[Chat] Provider selector clicked');
  }

  // Handle clear history
  function handleClearHistory() {
    if (confirm('Are you sure you want to clear the chat history?')) {
      sendMessage('clearHistory');
      clearMessagesUI();
    }
  }

  // Handle export history
  function handleExportHistory() {
    sendMessage('exportHistory');
  }

  // Handle providers updated
  function handleProvidersUpdated(data) {
    state.providers = data.providers || [];
    updateProviderSelector();
    
    // Select first available provider if none selected
    if (!state.selectedProviderId && state.providers.length > 0) {
      const firstProvider = state.providers.find(p => p.enabled);
      if (firstProvider) {
        state.selectedProviderId = firstProvider.id;
        updateProviderSelector();
      }
    }
  }

  // Handle history updated
  function handleHistoryUpdated(data) {
    state.messages = data.messages || [];
    renderMessages();
  }

  // Handle message received
  function handleMessageReceived(data) {
    addMessageToUI({
      id: data.messageId || `msg_${Date.now()}`,
      role: 'assistant',
      content: data.content,
      timestamp: new Date(data.timestamp || Date.now()),
      threadId: 'current',
      metadata: data.metadata
    });
    
    state.loading = false;
    updateSendButtonState();
  }

  // Handle configuration changed
  function handleConfigurationChanged(data) {
    Object.assign(state.config, data.config);
    applyConfiguration();
  }

  // Handle provider status changed
  function handleProviderStatusChanged(providerId, status) {
    const provider = state.providers.find(p => p.id === providerId);
    if (provider) {
      provider.status = status;
      updateProviderSelector();
    }
  }

  // Update character counter
  function updateCharacterCounter(current, max) {
    if (!elements.characterCounter) return;
    
    elements.characterCounter.textContent = `${current} / ${max}`;
    elements.characterCounter.className = 'message-input__counter';
    
    if (current > max * 0.8) {
      elements.characterCounter.classList.add('message-input__counter--warning');
    }
    if (current > max) {
      elements.characterCounter.classList.add('message-input__counter--error');
    }
  }

  // Update send button state
  function updateSendButtonState() {
    if (!elements.sendButton || !elements.messageInput) return;
    
    const hasContent = elements.messageInput.value.trim().length > 0;
    const canSend = hasContent && !state.loading && state.selectedProviderId;
    
    elements.sendButton.disabled = !canSend;
    
    if (state.loading) {
      elements.sendButton.innerHTML = `
        <span class="send-button__spinner">⟳</span>
        <span class="send-button__text">Sending...</span>
      `;
      elements.sendButton.classList.add('send-button--loading');
    } else {
      elements.sendButton.innerHTML = `
        <span class="send-button__icon">➤</span>
        <span class="send-button__text">Send</span>
      `;
      elements.sendButton.classList.remove('send-button--loading');
    }
  }

  // Update provider selector
  function updateProviderSelector() {
    if (!elements.providerTrigger) return;
    
    const selectedProvider = state.providers.find(p => p.id === state.selectedProviderId);
    
    if (selectedProvider) {
      elements.providerTrigger.innerHTML = `
        <div class="provider-selector__selected">
          <div class="provider-icon provider-icon--medium">
            <span class="provider-icon__main">${getProviderIcon(selectedProvider.id)}</span>
            <span class="provider-icon__status">${getStatusIcon(selectedProvider.status)}</span>
          </div>
          <span class="provider-selector__name">${selectedProvider.name}</span>
        </div>
        <span class="provider-selector__arrow">▼</span>
      `;
    } else if (state.providers.length > 0) {
      elements.providerTrigger.innerHTML = `
        <div class="provider-selector__placeholder">Select Provider</div>
        <span class="provider-selector__arrow">▼</span>
      `;
    } else {
      elements.providerTrigger.innerHTML = `
        <div class="provider-selector__placeholder">No Providers Available</div>
      `;
    }
  }

  // Add message to UI
  function addMessageToUI(message) {
    state.messages.push(message);
    renderMessages();
    scrollToBottom();
  }

  // Render messages
  function renderMessages() {
    if (!elements.messagesContainer) return;
    
    if (state.messages.length === 0) {
      elements.messagesContainer.innerHTML = `
        <div class="chat-window__empty">
          <div class="chat-window__empty-content">
            <div class="chat-window__empty-icon">💬</div>
            <div class="chat-window__empty-title">Start a conversation</div>
            <div class="chat-window__empty-description">Type a message below to begin</div>
          </div>
        </div>
      `;
      return;
    }

    const messagesHtml = state.messages.map(message => createMessageElement(message)).join('');
    elements.messagesContainer.innerHTML = `<div class="chat-window__message-list">${messagesHtml}</div>`;
  }

  // Create message element
  function createMessageElement(message) {
    const timestamp = new Date(message.timestamp);
    const timeString = timestamp.toLocaleTimeString(undefined, { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    const showRetry = message.role === 'assistant';
    const errorHtml = message.metadata?.error ? 
      `<div class="message__error">Error: ${message.metadata.error}</div>` : '';
    const usageHtml = message.metadata?.usage ? 
      `<div class="message__usage">Tokens: ${message.metadata.usage.total_tokens || 'Unknown'}</div>` : '';

    return `
      <div class="message message--${message.role}" data-message-id="${message.id}">
        <div class="message__header">
          <span class="message__role">${message.role}</span>
          ${state.config.showTimestamps ? `<span class="message__timestamp">${timeString}</span>` : ''}
          ${message.metadata?.provider ? `<span class="message__provider">${message.metadata.provider}</span>` : ''}
        </div>
        <div class="message__content">
          <div class="message__text">${escapeHtml(message.content)}</div>
          ${errorHtml}
          ${usageHtml}
        </div>
        <div class="message__actions">
          <button class="message__action message__action--copy" onclick="copyMessage('${message.id}')" title="Copy message">📋</button>
          ${showRetry ? `<button class="message__action message__action--retry" onclick="retryMessage('${message.id}')" title="Retry message">🔄</button>` : ''}
        </div>
      </div>
    `;
  }

  // Clear messages UI
  function clearMessagesUI() {
    state.messages = [];
    renderMessages();
  }

  // Auto-resize textarea
  function autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.max(textarea.scrollHeight, 60) + 'px';
  }

  // Apply configuration
  function applyConfiguration() {
    const { compactMode, showTimestamps } = state.config;
    
    if (elements.root) {
      elements.root.classList.toggle('chat-window--compact', compactMode);
    }
    
    // Re-render messages to apply timestamp visibility
    renderMessages();
  }

  // Scroll to bottom
  function scrollToBottom() {
    if (elements.messagesContainer) {
      elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
    }
  }

  // Send message to extension
  function sendMessage(type, data = {}) {
    const message = {
      type: type,
      data: data,
      requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    console.log('[Chat] Sending message to extension:', message);
    vscode.postMessage(message);
  }

  // Utility functions
  function getProviderIcon(providerId) {
    switch (providerId.toLowerCase()) {
      case 'openai': return '🤖';
      case 'anthropic': return '🧠';
      case 'lmstudio': return '🏠';
      default: return '💬';
    }
  }

  function getStatusIcon(status) {
    switch (status) {
      case 'connected': return '🟢';
      case 'connecting': return '🟡';
      case 'error': return '🔴';
      case 'disconnected':
      default: return '⚫';
    }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Global functions for message actions
  window.copyMessage = function(messageId) {
    const message = state.messages.find(m => m.id === messageId);
    if (message) {
      navigator.clipboard.writeText(message.content);
      console.log('[Chat] Message copied to clipboard');
    }
  };

  window.retryMessage = function(messageId) {
    console.log('[Chat] Retrying message:', messageId);
    // TODO: Implement message retry
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

})();