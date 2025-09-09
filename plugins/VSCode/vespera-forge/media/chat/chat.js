/**
 * Vespera Forge Chat WebView JavaScript
 * Handles UI interactions and communication with VS Code extension
 */

(function() {
  'use strict';

  // Get VS Code API
  const vscode = acquireVsCodeApi();
  
  // Application state with persistent preferences
  let state = {
    messages: [],
    providers: [],
    selectedProviderId: null,
    loading: false,
    streaming: false,
    contextData: new Map(), // Store context data by contextId
    contextVisibility: new Map(), // Track context visibility state
    contextItemExpansion: new Map(), // Track individual item expansion state
    config: {
      showTimestamps: true,
      compactMode: false,
      showContext: true,
      contextCollapsed: false,
      contextPreferences: {
        defaultExpanded: true,
        showFileIcons: true,
        showSecurityIndicators: true,
        enableAnimations: true,
        staggerAnimationDelay: 50
      },
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
    console.log('[Chat] Initializing enhanced chat interface...');
    
    // Initialize state management first
    initializeStateManagement();
    
    // Update theme variables
    updateThemeVariables();
    
    // Create interface
    createChatInterface();
    bindEventListeners();
    setupMessageListener();
    
    // Initialize performance optimizations
    optimizeContextPerformance();
    
    // Request initial data
    sendMessage('requestProviders');
    sendMessage('requestHistory');
    
    // Listen for theme changes
    window.addEventListener('message', (event) => {
      if (event.data.type === 'themeChanged') {
        updateThemeVariables();
      }
    });
    
    console.log('[Chat] Enhanced chat interface initialized');
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
        case 'contextDataReceived':
          handleContextDataReceived(message.data);
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

  // Handle context data received
  function handleContextDataReceived(data) {
    console.log('[Chat] Context data received:', data);
    
    // Store context data
    state.contextData.set(data.contextId, data);
    
    // Set initial visibility state
    state.contextVisibility.set(data.contextId, !state.config.contextCollapsed);
    
    // Display context in UI
    displayContextInUI(data);
  }

  // Display context data in UI with enhanced collapsible section
  function displayContextInUI(contextData) {
    if (!state.config.showContext || !contextData) return;

    const messagesContainer = elements.messagesContainer;
    if (!messagesContainer) return;

    // Find or create context container using template
    let contextContainer = document.getElementById(`context-${contextData.contextId}`);
    if (!contextContainer) {
      contextContainer = createContextContainerFromTemplate(contextData);
      messagesContainer.appendChild(contextContainer);
      
      // Add smooth entrance animation
      contextContainer.style.opacity = '0';
      contextContainer.style.transform = 'translateY(-10px)';
      requestAnimationFrame(() => {
        contextContainer.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        contextContainer.style.opacity = '1';
        contextContainer.style.transform = 'translateY(0)';
      });
    }

    // Update existing container with new data
    updateContextContainer(contextContainer, contextData);
    
    // Bind enhanced event handlers with animation support
    bindEnhancedContextEventHandlers(contextData.contextId);
    
    // Apply accessibility enhancements
    enhanceContextAccessibility(contextContainer, contextData);
    
    // Apply saved expansion states
    setTimeout(() => {
      applySavedExpansionStates(contextData.contextId);
    }, 100);
  }

  // Create secure context HTML with CSP compliance
  function createContextHTML(contextData, isVisible) {
    const itemCount = contextData.contextItems ? contextData.contextItems.length : 0;
    const sanitizedIndicator = contextData.sanitized ? '🛡️' : '';
    const threatWarning = contextData.threatCount > 0 ? ` ⚠️ ${contextData.threatCount} threats detected` : '';
    
    return `
      <div class="context-header" data-context-id="${escapeHtml(contextData.contextId)}">
        <div class="context-title">
          <span class="context-toggle ${isVisible ? 'expanded' : 'collapsed'}" 
                data-context-id="${escapeHtml(contextData.contextId)}">
            ${isVisible ? '▼' : '▶'}
          </span>
          <span class="context-label">File Context ${sanitizedIndicator}</span>
          <span class="context-summary">${escapeHtml(contextData.contextSummary)}</span>
        </div>
        <div class="context-metadata">
          <span class="context-count">${itemCount} items</span>
          ${threatWarning ? `<span class="context-threats">${threatWarning}</span>` : ''}
          <span class="context-timestamp">${new Date(contextData.timestamp).toLocaleTimeString()}</span>
        </div>
      </div>
      <div class="context-content ${isVisible ? 'visible' : 'hidden'}" 
           data-context-id="${escapeHtml(contextData.contextId)}">
        ${createContextItemsHTML(contextData.contextItems, contextData.contextId)}
      </div>
    `;
  }

  // Create HTML for context items
  function createContextItemsHTML(contextItems, contextId) {
    if (!contextItems || contextItems.length === 0) {
      return '<div class="context-empty">No context items available</div>';
    }

    return contextItems.map(item => `
      <div class="context-item" data-type="${escapeHtml(item.type)}">
        <div class="context-item-header">
          <span class="context-item-path" title="${escapeHtml(item.filepath)}">
            ${escapeHtml(getFileBasename(item.filepath))}
          </span>
          ${item.language ? `<span class="context-item-language">${escapeHtml(item.language)}</span>` : ''}
          ${item.startLine && item.endLine ? `<span class="context-item-lines">Lines ${item.startLine}-${item.endLine}</span>` : ''}
          ${item.type ? `<span class="context-item-type">${escapeHtml(item.type)}</span>` : ''}
        </div>
        <div class="context-item-preview">
          <pre><code>${escapeHtml(item.contentPreview || item.fullContent || '')}</code></pre>
        </div>
        ${item.contentPreview && item.fullContent && item.contentPreview !== item.fullContent ? 
          `<button class="context-item-expand" data-context-id="${escapeHtml(contextId)}" data-filepath="${escapeHtml(item.filepath)}">
            Show full content
          </button>` : ''}
      </div>
    `).join('');
  }

  // Bind event handlers for context interactions
  function bindContextEventHandlers(contextId) {
    const toggleButton = document.querySelector(`[data-context-id="${contextId}"].context-toggle`);
    if (toggleButton) {
      toggleButton.addEventListener('click', () => toggleContextVisibility(contextId));
    }
    
    // Bind expand buttons using event delegation
    const contextContainer = document.getElementById(`context-${contextId}`);
    if (contextContainer) {
      contextContainer.addEventListener('click', (event) => {
        if (event.target.classList.contains('context-item-expand')) {
          const targetContextId = event.target.getAttribute('data-context-id');
          const filepath = event.target.getAttribute('data-filepath');
          if (targetContextId && filepath) {
            expandContextItem(targetContextId, filepath);
          }
        }
      });
    }
  }

  // Toggle context visibility with state persistence
  function toggleContextVisibility(contextId) {
    const currentVisibility = state.contextVisibility.get(contextId) || false;
    const newVisibility = !currentVisibility;
    
    // Update state
    state.contextVisibility.set(contextId, newVisibility);
    
    // Update UI
    const contextContent = document.querySelector(`[data-context-id="${contextId}"].context-content`);
    const toggleButton = document.querySelector(`[data-context-id="${contextId}"].context-toggle`);
    
    if (contextContent && toggleButton) {
      contextContent.className = `context-content ${newVisibility ? 'visible' : 'hidden'}`;
      toggleButton.textContent = newVisibility ? '▼' : '▶';
      toggleButton.className = `context-toggle ${newVisibility ? 'expanded' : 'collapsed'}`;
    }
    
    // Notify extension of visibility change
    sendMessage('toggleContextVisibility', {
      contextId: contextId,
      visible: newVisibility
    });
    
    console.log('[Chat] Context visibility toggled:', contextId, newVisibility);
  }

  // Expand context item to show full content
  function expandContextItem(contextId, filepath) {
    const contextData = state.contextData.get(contextId);
    if (!contextData) return;
    
    const item = contextData.contextItems.find(i => i.filepath === filepath);
    if (!item || !item.fullContent) return;
    
    // Find the item element and update it
    const itemElements = document.querySelectorAll('.context-item');
    for (const itemElement of itemElements) {
      const pathElement = itemElement.querySelector('.context-item-path');
      if (pathElement && pathElement.title === filepath) {
        const previewElement = itemElement.querySelector('.context-item-preview pre code');
        const expandButton = itemElement.querySelector('.context-item-expand');
        
        if (previewElement) {
          previewElement.textContent = item.fullContent;
        }
        if (expandButton) {
          expandButton.remove();
        }
        break;
      }
    }
  };

  // === Enhanced Context UI Functions ===
  
  // Create context container from template with accessibility
  function createContextContainerFromTemplate(contextData) {
    const template = document.getElementById('context-container-template');
    if (!template) return createLegacyContextContainer(contextData);
    
    const containerClone = template.content.cloneNode(true);
    const container = containerClone.querySelector('.context-display');
    
    // Set unique identifiers
    const contextId = contextData.contextId;
    const headerId = `context-header-${contextId}`;
    const contentId = `context-content-${contextId}`;
    
    container.id = `context-${contextId}`;
    container.setAttribute('data-context-id', contextId);
    container.setAttribute('aria-labelledby', headerId);
    
    const header = container.querySelector('.context-header');
    const content = container.querySelector('.context-content');
    
    header.id = headerId;
    header.setAttribute('aria-controls', contentId);
    content.id = contentId;
    content.setAttribute('data-context-id', contextId);
    content.setAttribute('aria-labelledby', headerId);
    
    return container;
  }
  
  // Fallback for legacy context container creation
  function createLegacyContextContainer(contextData) {
    const container = document.createElement('div');
    container.id = `context-${contextData.contextId}`;
    container.className = 'context-display';
    container.setAttribute('data-context-id', contextData.contextId);
    container.setAttribute('role', 'region');
    return container;
  }
  
  // Update context container with fresh data and animations
  function updateContextContainer(container, contextData) {
    const isVisible = state.contextVisibility.get(contextData.contextId) ?? true;
    
    // Update metadata
    updateContextMetadata(container, contextData);
    
    // Update security indicators
    updateSecurityIndicators(container, contextData);
    
    // Update context items with smooth transitions
    updateContextItems(container, contextData, isVisible);
    
    // Update toggle state
    updateContextToggleState(container, contextData.contextId, isVisible);
  }
  
  // Update context metadata (counts, timestamps, etc.)
  function updateContextMetadata(container, contextData) {
    const itemCount = contextData.contextItems ? contextData.contextItems.length : 0;
    const countElement = container.querySelector('.context-count');
    const timestampElement = container.querySelector('.context-timestamp');
    const summaryElement = container.querySelector('.context-summary');
    const threatsElement = container.querySelector('.context-threats');
    
    if (countElement) {
      countElement.textContent = `${itemCount} item${itemCount !== 1 ? 's' : ''}`;
      countElement.setAttribute('aria-label', `${itemCount} context items`);
    }
    
    if (timestampElement) {
      const timestamp = new Date(contextData.timestamp || Date.now());
      timestampElement.textContent = timestamp.toLocaleTimeString();
      timestampElement.setAttribute('aria-label', `Context created at ${timestamp.toLocaleString()}`);
    }
    
    if (summaryElement && contextData.contextSummary) {
      summaryElement.textContent = contextData.contextSummary;
    }
    
    if (threatsElement && contextData.threatCount > 0) {
      threatsElement.textContent = `⚠️ ${contextData.threatCount} threat${contextData.threatCount !== 1 ? 's' : ''} detected`;
      threatsElement.style.display = 'inline';
      threatsElement.setAttribute('aria-label', `${contextData.threatCount} security threats detected`);
    } else if (threatsElement) {
      threatsElement.style.display = 'none';
    }
  }
  
  // Update security indicators with visual feedback
  function updateSecurityIndicators(container, contextData) {
    const securityIndicator = container.querySelector('.context-security-indicator');
    
    container.setAttribute('data-sanitized', contextData.sanitized ? 'true' : 'false');
    container.setAttribute('data-threats', (contextData.threatCount > 0) ? 'true' : 'false');
    container.setAttribute('data-blocked', contextData.blocked ? 'true' : 'false');
    
    if (securityIndicator) {
      let securityText = '';
      let securityTitle = '';
      
      if (contextData.sanitized) {
        securityText = '🛡️';
        securityTitle = 'Content has been sanitized for security';
      }
      
      if (contextData.threatCount > 0) {
        securityText += ' ⚠️';
        securityTitle = `Security threats detected. ${securityTitle}`.trim();
      }
      
      if (contextData.blocked) {
        securityText += ' 🚫';
        securityTitle = `Content blocked due to security policy. ${securityTitle}`.trim();
      }
      
      securityIndicator.textContent = securityText;
      securityIndicator.title = securityTitle;
      securityIndicator.setAttribute('aria-label', securityTitle);
    }
  }
  
  // Update context items with smooth transitions
  function updateContextItems(container, contextData, isVisible) {
    const contentElement = container.querySelector('.context-content');
    if (!contentElement) return;
    
    const items = contextData.contextItems || [];
    
    if (items.length === 0) {
      const emptyTemplate = document.getElementById('context-empty-template');
      if (emptyTemplate) {
        contentElement.innerHTML = '';
        contentElement.appendChild(emptyTemplate.content.cloneNode(true));
      } else {
        contentElement.innerHTML = '<div class="context-empty">No context items available</div>';
      }
      return;
    }
    
    // Create items with templates
    contentElement.innerHTML = '';
    items.forEach((item, index) => {
      const itemElement = createContextItemFromTemplate(item, contextData.contextId, index);
      contentElement.appendChild(itemElement);
    });
    
    // Add staggered animation for new items
    if (isVisible) {
      const itemElements = contentElement.querySelectorAll('.context-item');
      itemElements.forEach((element, index) => {
        element.style.opacity = '0';
        element.style.transform = 'translateX(-10px)';
        setTimeout(() => {
          element.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
          element.style.opacity = '1';
          element.style.transform = 'translateX(0)';
        }, index * 50);
      });
    }
  }
  
  // Create individual context item from template
  function createContextItemFromTemplate(item, contextId, index) {
    const template = document.getElementById('context-item-template');
    if (!template) return createLegacyContextItem(item, contextId);
    
    const itemClone = template.content.cloneNode(true);
    const itemElement = itemClone.querySelector('.context-item');
    
    // Set item data
    itemElement.setAttribute('data-type', item.type || 'file');
    itemElement.setAttribute('data-filepath', item.filepath || '');
    
    // Set accessibility labels
    const itemId = `context-item-${contextId}-${index}`;
    const previewId = `context-preview-${contextId}-${index}`;
    
    itemElement.setAttribute('aria-labelledby', itemId);
    
    const header = itemElement.querySelector('.context-item-header');
    const preview = itemElement.querySelector('.context-item-preview');
    
    header.id = itemId;
    header.setAttribute('aria-controls', previewId);
    preview.id = previewId;
    preview.setAttribute('aria-labelledby', itemId);
    
    // Populate content
    populateContextItemContent(itemElement, item);
    
    // Add file type icon
    addFileTypeIcon(itemElement, item);
    
    return itemElement;
  }
  
  // Populate context item with data
  function populateContextItemContent(itemElement, item) {
    const pathElement = itemElement.querySelector('.context-item-path');
    const languageElement = itemElement.querySelector('.context-item-language');
    const linesElement = itemElement.querySelector('.context-item-lines');
    const typeElement = itemElement.querySelector('.context-item-type');
    const codeElement = itemElement.querySelector('.context-item-content code');
    const sizeElement = itemElement.querySelector('.context-item-size');
    const modifiedElement = itemElement.querySelector('.context-item-modified');
    
    if (pathElement && item.filepath) {
      const fileName = getFileBasename(item.filepath);
      pathElement.textContent = fileName;
      pathElement.setAttribute('title', item.filepath);
    }
    
    if (languageElement && item.language) {
      languageElement.textContent = item.language;
      languageElement.style.display = 'inline';
    }
    
    if (linesElement && item.startLine && item.endLine) {
      linesElement.textContent = `Lines ${item.startLine}-${item.endLine}`;
      linesElement.style.display = 'inline';
    }
    
    if (typeElement && item.type) {
      typeElement.textContent = item.type;
      typeElement.style.display = 'inline';
      typeElement.setAttribute('data-type', item.type);
    }
    
    if (codeElement && item.content) {
      codeElement.textContent = item.content;
      // Add syntax highlighting class if language is available
      if (item.language) {
        codeElement.className = `language-${item.language.toLowerCase()}`;
      }
    }
    
    if (sizeElement && item.size) {
      sizeElement.textContent = formatFileSize(item.size);
    }
    
    if (modifiedElement && item.lastModified) {
      const modDate = new Date(item.lastModified);
      modifiedElement.textContent = `Modified ${modDate.toLocaleDateString()}`;
    }
  }
  
  // Add appropriate file type icon
  function addFileTypeIcon(itemElement, item) {
    const iconElement = itemElement.querySelector('.file-type-icon');
    if (!iconElement || !item.filepath) return;
    
    const extension = item.filepath.split('.').pop()?.toLowerCase();
    const iconMap = {
      'js': '🟨', 'ts': '🔵', 'jsx': '⚛️', 'tsx': '⚛️',
      'py': '🐍', 'java': '☕', 'cpp': '⚙️', 'c': '⚙️',
      'html': '🌐', 'css': '🎨', 'scss': '🎨', 'sass': '🎨',
      'json': '📋', 'xml': '📄', 'yaml': '📝', 'yml': '📝',
      'md': '📖', 'txt': '📄', 'log': '📊',
      'png': '🖼️', 'jpg': '🖼️', 'jpeg': '🖼️', 'gif': '🖼️', 'svg': '🎨'
    };
    
    iconElement.textContent = iconMap[extension] || '📄';
  }
  
  // Update toggle state with animation
  function updateContextToggleState(container, contextId, isVisible) {
    const toggleButton = container.querySelector('.context-toggle');
    const toggleIcon = container.querySelector('.context-toggle__icon');
    const header = container.querySelector('.context-header');
    const content = container.querySelector('.context-content');
    
    if (toggleButton) {
      toggleButton.className = `context-toggle ${isVisible ? 'expanded' : 'collapsed'}`;
      toggleButton.setAttribute('aria-expanded', isVisible.toString());
      toggleButton.setAttribute('data-context-id', contextId);
    }
    
    if (toggleIcon) {
      toggleIcon.textContent = isVisible ? '▼' : '▶';
      toggleIcon.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(-90deg)';
      toggleIcon.style.transition = 'transform 0.2s ease';
    }
    
    if (header) {
      header.setAttribute('aria-expanded', isVisible.toString());
    }
    
    if (content) {
      content.className = `context-content ${isVisible ? 'visible' : 'hidden'}`;
      content.style.maxHeight = isVisible ? `${content.scrollHeight}px` : '0';
      content.style.transition = 'max-height 0.3s ease-out, opacity 0.2s ease';
      content.style.opacity = isVisible ? '1' : '0';
    }
  }
  
  // Enhanced context accessibility
  function enhanceContextAccessibility(container, contextData) {
    const header = container.querySelector('.context-header');
    const items = container.querySelectorAll('.context-item-header');
    
    // Add keyboard navigation support
    if (header) {
      header.addEventListener('keydown', handleContextHeaderKeyDown);
    }
    
    items.forEach(item => {
      item.addEventListener('keydown', handleContextItemKeyDown);
    });
    
    // Add focus management
    const focusableElements = container.querySelectorAll(
      'button, [tabindex]:not([tabindex="-1"]), [role="button"]'
    );
    
    focusableElements.forEach((element, index) => {
      element.addEventListener('keydown', (e) => handleContextFocusNavigation(e, focusableElements, index));
    });
  }
  
  // Handle keyboard navigation for context headers
  function handleContextHeaderKeyDown(event) {
    const { key, target } = event;
    
    if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      const contextId = target.getAttribute('data-context-id') || 
                       target.closest('[data-context-id]')?.getAttribute('data-context-id');
      if (contextId) {
        toggleContextVisibilityWithAnimation(contextId);
      }
    }
  }
  
  // Handle keyboard navigation for context items
  function handleContextItemKeyDown(event) {
    const { key, target } = event;
    
    if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      toggleContextItemExpansion(target);
    }
  }
  
  // Handle focus navigation within context
  function handleContextFocusNavigation(event, focusableElements, currentIndex) {
    const { key } = event;
    
    if (key === 'ArrowDown') {
      event.preventDefault();
      const nextIndex = (currentIndex + 1) % focusableElements.length;
      focusableElements[nextIndex].focus();
    } else if (key === 'ArrowUp') {
      event.preventDefault();
      const prevIndex = (currentIndex - 1 + focusableElements.length) % focusableElements.length;
      focusableElements[prevIndex].focus();
    }
  }

  // Enhanced toggle with animations
  function toggleContextVisibilityWithAnimation(contextId) {
    const currentVisibility = state.contextVisibility.get(contextId) ?? false;
    const newVisibility = !currentVisibility;
    
    // Update state
    state.contextVisibility.set(contextId, newVisibility);
    
    // Update UI with animation
    const container = document.getElementById(`context-${contextId}`);
    if (container) {
      updateContextToggleState(container, contextId, newVisibility);
    }
    
    // Persist state
    sendMessage('updateContextPreferences', {
      contextId: contextId,
      visible: newVisibility
    });
    
    console.log('[Chat] Context visibility toggled with animation:', contextId, newVisibility);
  }
  
  // Toggle context item expansion
  function toggleContextItemExpansion(target) {
    const itemElement = target.closest('.context-item');
    if (!itemElement) return;
    
    const preview = itemElement.querySelector('.context-item-preview');
    const expandButton = itemElement.querySelector('.context-item-action--expand');
    const isExpanded = itemElement.getAttribute('data-expanded') === 'true';
    
    if (preview && expandButton) {
      const newExpandedState = !isExpanded;
      
      itemElement.setAttribute('data-expanded', newExpandedState.toString());
      target.setAttribute('aria-expanded', newExpandedState.toString());
      
      if (newExpandedState) {
        preview.style.display = 'block';
        preview.style.maxHeight = '0';
        preview.style.opacity = '0';
        
        requestAnimationFrame(() => {
          preview.style.transition = 'max-height 0.3s ease-out, opacity 0.2s ease';
          preview.style.maxHeight = `${preview.scrollHeight}px`;
          preview.style.opacity = '1';
        });
        
        expandButton.textContent = '⊟';
        expandButton.title = 'Collapse content';
        expandButton.setAttribute('aria-label', 'Collapse file content');
      } else {
        preview.style.transition = 'max-height 0.2s ease-in, opacity 0.15s ease';
        preview.style.maxHeight = '0';
        preview.style.opacity = '0';
        
        setTimeout(() => {
          preview.style.display = 'none';
        }, 200);
        
        expandButton.textContent = '⊞';
        expandButton.title = 'Expand content';
        expandButton.setAttribute('aria-label', 'Expand file content');
      }
    }
  }
  
  // Create legacy context item for fallback
  function createLegacyContextItem(item, contextId) {
    const itemElement = document.createElement('div');
    itemElement.className = 'context-item';
    itemElement.setAttribute('data-type', item.type || 'file');
    itemElement.setAttribute('data-filepath', item.filepath || '');
    
    const fileName = getFileBasename(item.filepath);
    
    itemElement.innerHTML = `
      <div class="context-item-header">
        <span class="context-item-path" title="${escapeHtml(item.filepath || '')}">${escapeHtml(fileName)}</span>
        ${item.language ? `<span class="context-item-language">${escapeHtml(item.language)}</span>` : ''}
        ${item.startLine && item.endLine ? `<span class="context-item-lines">Lines ${item.startLine}-${item.endLine}</span>` : ''}
        ${item.type ? `<span class="context-item-type">${escapeHtml(item.type)}</span>` : ''}
      </div>
      <div class="context-item-preview" style="display: none;">
        <pre><code>${escapeHtml(item.content || '')}</code></pre>
      </div>
    `;
    
    return itemElement;
  }
  
  // Format file size helper
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Enhanced bind event handlers with animation support
  function bindEnhancedContextEventHandlers(contextId) {
    const container = document.getElementById(`context-${contextId}`);
    if (!container) return;
    
    // Main toggle handler
    const toggleButton = container.querySelector('.context-toggle');
    const header = container.querySelector('.context-header');
    
    if (toggleButton) {
      toggleButton.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleContextVisibilityWithAnimation(contextId);
      });
    }
    
    if (header) {
      header.addEventListener('click', (e) => {
        // Only toggle if clicking on header itself, not buttons within
        if (e.target === header || e.target.closest('.context-title')) {
          toggleContextVisibilityWithAnimation(contextId);
        }
      });
    }
    
    // Context action buttons
    const expandAllButton = container.querySelector('.context-action--expand-all');
    const collapseAllButton = container.querySelector('.context-action--collapse-all');
    const refreshButton = container.querySelector('.context-action--refresh');
    
    if (expandAllButton) {
      expandAllButton.addEventListener('click', (e) => {
        e.stopPropagation();
        expandAllContextItems(contextId);
      });
    }
    
    if (collapseAllButton) {
      collapseAllButton.addEventListener('click', (e) => {
        e.stopPropagation();
        collapseAllContextItems(contextId);
      });
    }
    
    if (refreshButton) {
      refreshButton.addEventListener('click', (e) => {
        e.stopPropagation();
        refreshContextData(contextId);
      });
    }
    
    // Individual item handlers
    const itemHeaders = container.querySelectorAll('.context-item-header');
    const expandButtons = container.querySelectorAll('.context-item-action--expand');
    const navigateButtons = container.querySelectorAll('.context-item-action--navigate');
    
    itemHeaders.forEach(header => {
      header.addEventListener('click', (e) => {
        if (!e.target.closest('.context-item-action')) {
          toggleContextItemExpansion(header);
        }
      });
    });
    
    expandButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleContextItemExpansion(button);
      });
    });
    
    navigateButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const itemElement = button.closest('.context-item');
        const filepath = itemElement?.getAttribute('data-filepath');
        if (filepath) {
          navigateToFile(filepath);
        }
      });
    });
  }
  
  // Expand all context items
  function expandAllContextItems(contextId) {
    const container = document.getElementById(`context-${contextId}`);
    if (!container) return;
    
    const items = container.querySelectorAll('.context-item[data-expanded="false"]');
    items.forEach((item, index) => {
      setTimeout(() => {
        const header = item.querySelector('.context-item-header');
        if (header) toggleContextItemExpansion(header);
      }, index * 100);
    });
  }
  
  // Collapse all context items
  function collapseAllContextItems(contextId) {
    const container = document.getElementById(`context-${contextId}`);
    if (!container) return;
    
    const items = container.querySelectorAll('.context-item[data-expanded="true"]');
    items.forEach((item, index) => {
      setTimeout(() => {
        const header = item.querySelector('.context-item-header');
        if (header) toggleContextItemExpansion(header);
      }, index * 50);
    });
  }
  
  // Refresh context data
  function refreshContextData(contextId) {
    const refreshButton = document.querySelector(`#context-${contextId} .context-action--refresh`);
    if (refreshButton) {
      refreshButton.textContent = '⟳';
      refreshButton.style.animation = 'spin 1s linear';
    }
    
    sendMessage('refreshContext', { contextId });
    
    setTimeout(() => {
      if (refreshButton) {
        refreshButton.textContent = '↻';
        refreshButton.style.animation = 'none';
      }
    }, 1000);
  }
  
  // Navigate to file in editor
  function navigateToFile(filepath) {
    sendMessage('navigateToFile', { filepath });
  }

  // === Persistent State Management ===
  
  // Save context preferences to VS Code state
  function saveContextPreferences() {
    const preferences = {
      contextVisibility: Object.fromEntries(state.contextVisibility),
      contextItemExpansion: Object.fromEntries(state.contextItemExpansion),
      contextPreferences: state.config.contextPreferences
    };
    
    vscode.setState({ 
      ...vscode.getState(),
      contextPreferences: preferences 
    });
    
    // Also send to backend for global persistence
    sendMessage('saveContextPreferences', preferences);
  }
  
  // Load context preferences from VS Code state
  function loadContextPreferences() {
    const savedState = vscode.getState();
    if (savedState?.contextPreferences) {
      const prefs = savedState.contextPreferences;
      
      // Restore context visibility
      if (prefs.contextVisibility) {
        state.contextVisibility = new Map(Object.entries(prefs.contextVisibility));
      }
      
      // Restore item expansion
      if (prefs.contextItemExpansion) {
        state.contextItemExpansion = new Map(Object.entries(prefs.contextItemExpansion));
      }
      
      // Restore preferences
      if (prefs.contextPreferences) {
        state.config.contextPreferences = { 
          ...state.config.contextPreferences,
          ...prefs.contextPreferences 
        };
      }
      
      console.log('[Chat] Context preferences loaded from state');
    }
    
    // Request additional preferences from backend
    sendMessage('loadContextPreferences');
  }
  
  // Update specific preference and persist
  function updateContextPreference(key, value, contextId = null) {
    if (contextId) {
      // Update context-specific preference
      if (key === 'visibility') {
        state.contextVisibility.set(contextId, value);
      } else if (key === 'itemExpansion') {
        const expansionMap = state.contextItemExpansion.get(contextId) || {};
        Object.assign(expansionMap, value);
        state.contextItemExpansion.set(contextId, expansionMap);
      }
    } else {
      // Update global preference
      state.config.contextPreferences[key] = value;
    }
    
    // Persist changes
    saveContextPreferences();
  }
  
  // Get context preference with fallback
  function getContextPreference(key, contextId = null, defaultValue = null) {
    if (contextId) {
      if (key === 'visibility') {
        return state.contextVisibility.get(contextId) ?? state.config.contextPreferences.defaultExpanded;
      } else if (key === 'itemExpansion') {
        return state.contextItemExpansion.get(contextId) || {};
      }
    }
    
    return state.config.contextPreferences[key] ?? defaultValue;
  }
  
  // Initialize state management
  function initializeStateManagement() {
    // Load saved preferences
    loadContextPreferences();
    
    // Auto-save preferences periodically
    setInterval(() => {
      if (state.contextVisibility.size > 0 || state.contextItemExpansion.size > 0) {
        saveContextPreferences();
      }
    }, 30000); // Save every 30 seconds
    
    // Save preferences before page unload
    window.addEventListener('beforeunload', () => {
      saveContextPreferences();
    });
  }
  
  // Enhanced toggle with state persistence
  function toggleContextItemExpansionWithPersistence(contextId, itemIndex, isExpanded) {
    const expansionMap = state.contextItemExpansion.get(contextId) || {};
    expansionMap[itemIndex] = isExpanded;
    
    updateContextPreference('itemExpansion', expansionMap, contextId);
  }
  
  // Apply saved item expansion states to newly created items
  function applySavedExpansionStates(contextId) {
    const expansionMap = state.contextItemExpansion.get(contextId) || {};
    const container = document.getElementById(`context-${contextId}`);
    if (!container) return;
    
    const items = container.querySelectorAll('.context-item');
    items.forEach((item, index) => {
      if (expansionMap[index] === true) {
        const header = item.querySelector('.context-item-header');
        if (header) {
          // Restore expanded state without animation
          const preview = item.querySelector('.context-item-preview');
          const expandButton = item.querySelector('.context-item-action--expand');
          
          if (preview && expandButton) {
            item.setAttribute('data-expanded', 'true');
            preview.style.display = 'block';
            preview.style.maxHeight = `${preview.scrollHeight}px`;
            preview.style.opacity = '1';
            expandButton.textContent = '⊟';
            expandButton.title = 'Collapse content';
            expandButton.setAttribute('aria-label', 'Collapse file content');
          }
        }
      }
    });
  }
  
  // Enhanced theme integration
  function updateThemeVariables() {
    const root = document.documentElement;
    const computedStyle = getComputedStyle(root);
    
    // Update context variables based on VS Code theme
    const updateCSSVariable = (property, fallback) => {
      const value = computedStyle.getPropertyValue(`--vscode-${property}`) || fallback;
      root.style.setProperty(`--context-${property}`, value);
    };
    
    updateCSSVariable('editor-background', '#1e1e1e');
    updateCSSVariable('editor-foreground', '#cccccc');
    updateCSSVariable('focusBorder', '#007acc');
    updateCSSVariable('button-hoverBackground', 'rgba(255, 255, 255, 0.1)');
    updateCSSVariable('list-hoverBackground', 'rgba(255, 255, 255, 0.1)');
  }
  
  // Performance optimization for large contexts
  function optimizeContextPerformance() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const contextItem = entry.target;
        const isVisible = entry.isIntersecting;
        
        if (isVisible) {
          // Lazy load item content when visible
          const preview = contextItem.querySelector('.context-item-preview');
          if (preview && !preview.dataset.loaded) {
            const contextId = contextItem.closest('.context-display')?.getAttribute('data-context-id');
            const itemIndex = Array.from(contextItem.parentElement.children).indexOf(contextItem);
            
            loadContextItemContent(contextId, itemIndex);
            preview.dataset.loaded = 'true';
          }
        }
      });
    }, {
      root: null,
      rootMargin: '50px',
      threshold: 0.1
    });
    
    // Observe all context items
    const observeContextItems = () => {
      const items = document.querySelectorAll('.context-item');
      items.forEach(item => observer.observe(item));
    };
    
    // Re-observe when context is updated
    const originalDisplayContextInUI = displayContextInUI;
    displayContextInUI = function(contextData) {
      originalDisplayContextInUI(contextData);
      setTimeout(observeContextItems, 100);
    };
  }
  
  // Load context item content on demand
  function loadContextItemContent(contextId, itemIndex) {
    sendMessage('loadContextItemContent', {
      contextId,
      itemIndex
    });
  }

  // Helper function to get file basename
  function getFileBasename(filepath) {
    if (!filepath) return '';
    const parts = filepath.split(/[\/\\]/);
    return parts[parts.length - 1] || filepath;
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