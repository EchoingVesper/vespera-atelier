/**
 * Enhanced Multi-Server Chat Interface with Discord-like UI
 * Revolutionary Task-Server Architecture Implementation
 * 
 * Features:
 * - Discord-like server sidebar with dynamic task servers
 * - Channel list with agent channels and progress indicators
 * - Direct Messages system
 * - Real-time agent progress tracking
 * - Task completion notifications
 * - Multi-server state persistence
 */

(function() {
  'use strict';

  // Get VS Code API
  const vscode = acquireVsCodeApi();
  
  // Multi-server application state
  let multiServerState = {
    servers: new Map(), // Map<serverId, ServerData>
    channels: new Map(), // Map<channelId, ChannelData>
    currentServerId: null,
    currentChannelId: null,
    taskServers: new Map(), // Map<taskId, TaskServerData>
    directMessages: new Map(), // Map<dmId, DMData>
    userPresence: new Map(), // Map<userId, PresenceData>
    agentStatuses: new Map(), // Map<agentId, AgentStatus>
    notifications: [],
    unreadCounts: new Map(),
    config: {
      showServerSidebar: true,
      showChannelSidebar: true,
      showAgentProgress: true,
      showNotifications: true,
      autoCollapseInactiveServers: true,
      sortServersBy: 'activity', // 'activity' | 'alphabetical' | 'priority'
      dmNotificationSound: true,
      agentCompletionSound: true,
      theme: 'auto' // 'light' | 'dark' | 'auto'
    },
    ui: {
      collapsedServers: new Set(),
      pinnedServers: new Set(),
      sidebarWidth: 240,
      channelSidebarWidth: 200
    }
  };

  // Server and Channel data structures
  class ServerData {
    constructor({
      serverId,
      serverName,
      serverType, // 'task' | 'regular'
      taskId = null,
      taskType = null,
      taskPhase = null,
      taskPriority = 'medium',
      taskStatus = 'active',
      taskProgress = 0,
      channels = [],
      isActive = false,
      isCollapsed = false,
      isPinned = false,
      unreadCount = 0,
      lastActivity = Date.now(),
      archived = false
    }) {
      this.serverId = serverId;
      this.serverName = serverName;
      this.serverType = serverType;
      this.taskId = taskId;
      this.taskType = taskType;
      this.taskPhase = taskPhase;
      this.taskPriority = taskPriority;
      this.taskStatus = taskStatus;
      this.taskProgress = taskProgress;
      this.channels = channels;
      this.isActive = isActive;
      this.isCollapsed = isCollapsed;
      this.isPinned = isPinned;
      this.unreadCount = unreadCount;
      this.lastActivity = lastActivity;
      this.archived = archived;
    }

    addChannel(channelData) {
      this.channels.push(channelData);
      this.lastActivity = Date.now();
    }

    updateTaskProgress(progress, status = null) {
      this.taskProgress = progress;
      if (status) this.taskStatus = status;
      this.lastActivity = Date.now();
    }

    getStatusColor() {
      const colors = {
        'planning': '#3498db',
        'executing': '#f39c12',
        'blocked': '#e74c3c',
        'completed': '#2ecc71',
        'failed': '#e74c3c',
        'active': '#95a5a6'
      };
      return colors[this.taskStatus] || colors['active'];
    }

    getPriorityIcon() {
      const icons = {
        'low': '🔵',
        'medium': '🟡', 
        'high': '🟠',
        'critical': '🔴'
      };
      return icons[this.taskPriority] || icons['medium'];
    }
  }

  class ChannelData {
    constructor({
      channelId,
      channelName,
      channelType, // 'agent' | 'progress' | 'planning' | 'dm' | 'general'
      agentRole = null,
      agentStatus = 'idle',
      agentProgress = 0,
      messageCount = 0,
      unreadCount = 0,
      lastMessage = null,
      lastActivity = Date.now(),
      isActive = false,
      typingIndicators = []
    }) {
      this.channelId = channelId;
      this.channelName = channelName;
      this.channelType = channelType;
      this.agentRole = agentRole;
      this.agentStatus = agentStatus;
      this.agentProgress = agentProgress;
      this.messageCount = messageCount;
      this.unreadCount = unreadCount;
      this.lastMessage = lastMessage;
      this.lastActivity = lastActivity;
      this.isActive = isActive;
      this.typingIndicators = typingIndicators;
    }

    getAgentStatusIcon() {
      const icons = {
        'idle': '⭕',
        'active': '🟢',
        'waiting': '🟡',
        'error': '🔴',
        'completed': '✅'
      };
      return icons[this.agentStatus] || icons['idle'];
    }

    getChannelTypeIcon() {
      const icons = {
        'agent': '🤖',
        'progress': '📊',
        'planning': '📋',
        'dm': '💬',
        'general': '💭'
      };
      return icons[this.channelType] || icons['general'];
    }
  }

  // DOM elements cache
  let elements = {};

  // Initialize the enhanced multi-server interface
  function initialize() {
    console.log('[MultiServerChat] Initializing Discord-like multi-server chat interface...');
    
    // Initialize state management
    initializeStateManagement();
    
    // Update theme variables
    updateThemeVariables();
    
    // Create enhanced interface
    createMultiServerInterface();
    bindEnhancedEventListeners();
    setupEnhancedMessageListener();
    
    // Initialize real-time systems
    initializeAgentTracking();
    initializeNotificationSystem();
    
    // Request initial server/channel data
    sendMessage({
      type: 'requestServerList',
      sessionId: generateSessionId()
    });
    
    sendMessage({
      type: 'requestTaskServers',
      sessionId: generateSessionId()
    });

    // Setup performance optimizations
    optimizeRenderingPerformance();
    
    console.log('[MultiServerChat] Enhanced multi-server interface initialized');
  }

  // Create the Discord-like multi-server interface
  function createMultiServerInterface() {
    const root = document.getElementById('chat-root');
    if (!root) return;

    root.innerHTML = `
      <div class="multi-server-chat">
        <!-- Server Sidebar (Discord-like) -->
        <div class="server-sidebar" id="server-sidebar">
          <div class="server-sidebar__header">
            <div class="server-sidebar__title">Servers</div>
            <div class="server-sidebar__controls">
              <button class="server-control" id="add-server-btn" title="Add Server">
                <span class="server-control__icon">➕</span>
              </button>
              <button class="server-control" id="server-settings-btn" title="Server Settings">
                <span class="server-control__icon">⚙️</span>
              </button>
            </div>
          </div>
          
          <!-- Direct Messages -->
          <div class="server-section">
            <div class="server-section__header">
              <button class="server-section__toggle" data-section="dms">
                <span class="server-section__icon">💬</span>
                <span class="server-section__title">Direct Messages</span>
                <span class="server-section__count" id="dm-count">0</span>
              </button>
            </div>
            <div class="server-section__content" id="dm-list">
              <!-- DM list will be populated here -->
            </div>
          </div>

          <!-- Task Servers -->
          <div class="server-section">
            <div class="server-section__header">
              <button class="server-section__toggle" data-section="task-servers">
                <span class="server-section__icon">📋</span>
                <span class="server-section__title">Task Servers</span>
                <span class="server-section__count" id="task-server-count">0</span>
              </button>
            </div>
            <div class="server-section__content" id="task-server-list">
              <!-- Task servers will be populated here -->
            </div>
          </div>

          <!-- Regular Servers -->
          <div class="server-section">
            <div class="server-section__header">
              <button class="server-section__toggle" data-section="regular-servers">
                <span class="server-section__icon">💭</span>
                <span class="server-section__title">Chat Servers</span>
                <span class="server-section__count" id="regular-server-count">0</span>
              </button>
            </div>
            <div class="server-section__content" id="regular-server-list">
              <!-- Regular servers will be populated here -->
            </div>
          </div>
        </div>

        <!-- Channel Sidebar -->
        <div class="channel-sidebar" id="channel-sidebar">
          <div class="channel-sidebar__header">
            <div class="channel-sidebar__server-info" id="current-server-info">
              <div class="server-info__name" id="current-server-name">Select a Server</div>
              <div class="server-info__details" id="current-server-details"></div>
            </div>
          </div>

          <div class="channel-list" id="channel-list">
            <!-- Channels will be populated here -->
          </div>

          <!-- Agent Status Panel -->
          <div class="agent-status-panel" id="agent-status-panel">
            <div class="agent-status-panel__header">
              <span class="agent-status-panel__title">Active Agents</span>
              <span class="agent-status-panel__count" id="active-agent-count">0</span>
            </div>
            <div class="agent-status-panel__list" id="active-agent-list">
              <!-- Active agents will be populated here -->
            </div>
          </div>
        </div>

        <!-- Main Chat Area -->
        <div class="chat-main" id="chat-main">
          <div class="chat-header" id="chat-header">
            <div class="chat-header__channel-info">
              <div class="channel-info__icon" id="current-channel-icon">💭</div>
              <div class="channel-info__details">
                <div class="channel-info__name" id="current-channel-name">Welcome</div>
                <div class="channel-info__description" id="current-channel-description">
                  Select a server and channel to start chatting
                </div>
              </div>
            </div>
            
            <div class="chat-header__controls">
              <button class="chat-control" id="channel-settings" title="Channel Settings">
                <span class="chat-control__icon">⚙️</span>
              </button>
              <button class="chat-control" id="notification-settings" title="Notifications">
                <span class="chat-control__icon">🔔</span>
              </button>
              <button class="chat-control" id="search-messages" title="Search Messages">
                <span class="chat-control__icon">🔍</span>
              </button>
            </div>
          </div>

          <!-- Message Area -->
          <div class="chat-messages" id="chat-messages">
            <div class="chat-messages__welcome">
              <div class="welcome-message">
                <h2>🚀 Welcome to Vespera Forge Multi-Chat</h2>
                <p>Revolutionary task-driven chat system with Discord-like interface</p>
                <ul class="welcome-features">
                  <li>📋 <strong>Task Servers:</strong> Each major task automatically creates a server</li>
                  <li>🤖 <strong>Agent Channels:</strong> AI agents work in dedicated channels</li>
                  <li>💬 <strong>Direct Messages:</strong> Private conversations</li>
                  <li>📊 <strong>Real-time Progress:</strong> Live task and agent monitoring</li>
                  <li>🔔 <strong>Smart Notifications:</strong> OS-level alerts for important events</li>
                </ul>
              </div>
            </div>
          </div>

          <!-- Message Input Area -->
          <div class="chat-input-area" id="chat-input-area">
            <div class="typing-indicators" id="typing-indicators">
              <!-- Typing indicators will appear here -->
            </div>
            
            <div class="message-input-container">
              <div class="message-attachments" id="message-attachments">
                <!-- File attachments will appear here -->
              </div>
              
              <div class="message-input-wrapper">
                <button class="input-action" id="attach-file" title="Attach File">
                  <span class="input-action__icon">📎</span>
                </button>
                
                <div class="message-input" contenteditable="true" id="message-input" 
                     data-placeholder="Type a message..."></div>
                
                <div class="input-controls">
                  <button class="input-action" id="emoji-picker" title="Add Emoji">
                    <span class="input-action__icon">😊</span>
                  </button>
                  <button class="input-action input-action--primary" id="send-message" title="Send Message">
                    <span class="input-action__icon">➡️</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Notification Toast Container -->
        <div class="notification-container" id="notification-container">
          <!-- Notifications will appear here -->
        </div>
      </div>
    `;

    // Cache DOM elements
    cacheElements();
    
    // Apply initial theme and styles
    applyThemeStyles();
    
    // Initialize interaction handlers
    initializeServerSidebarInteractions();
    initializeChannelSidebarInteractions();
    initializeChatInteractions();
    
    console.log('[MultiServerChat] Multi-server interface created successfully');
  }

  // Cache frequently accessed DOM elements
  function cacheElements() {
    elements = {
      // Sidebars
      serverSidebar: document.getElementById('server-sidebar'),
      channelSidebar: document.getElementById('channel-sidebar'),
      
      // Server lists
      dmList: document.getElementById('dm-list'),
      taskServerList: document.getElementById('task-server-list'),
      regularServerList: document.getElementById('regular-server-list'),
      
      // Counters
      dmCount: document.getElementById('dm-count'),
      taskServerCount: document.getElementById('task-server-count'),
      regularServerCount: document.getElementById('regular-server-count'),
      activeAgentCount: document.getElementById('active-agent-count'),
      
      // Current server/channel info
      currentServerInfo: document.getElementById('current-server-info'),
      currentServerName: document.getElementById('current-server-name'),
      currentServerDetails: document.getElementById('current-server-details'),
      currentChannelIcon: document.getElementById('current-channel-icon'),
      currentChannelName: document.getElementById('current-channel-name'),
      currentChannelDescription: document.getElementById('current-channel-description'),
      
      // Channel list and agent panel
      channelList: document.getElementById('channel-list'),
      agentStatusPanel: document.getElementById('agent-status-panel'),
      activeAgentList: document.getElementById('active-agent-list'),
      
      // Chat area
      chatMain: document.getElementById('chat-main'),
      chatMessages: document.getElementById('chat-messages'),
      messageInput: document.getElementById('message-input'),
      sendButton: document.getElementById('send-message'),
      
      // Controls
      addServerBtn: document.getElementById('add-server-btn'),
      serverSettingsBtn: document.getElementById('server-settings-btn'),
      
      // Notifications
      notificationContainer: document.getElementById('notification-container'),
      typingIndicators: document.getElementById('typing-indicators')
    };
  }

  // Initialize server sidebar interactions
  function initializeServerSidebarInteractions() {
    // Server section toggles
    document.querySelectorAll('.server-section__toggle').forEach(toggle => {
      toggle.addEventListener('click', (e) => {
        const section = e.currentTarget.dataset.section;
        toggleServerSection(section);
      });
    });

    // Add server button
    if (elements.addServerBtn) {
      elements.addServerBtn.addEventListener('click', showAddServerDialog);
    }

    // Server settings button
    if (elements.serverSettingsBtn) {
      elements.serverSettingsBtn.addEventListener('click', showServerSettings);
    }
  }

  // Initialize channel sidebar interactions
  function initializeChannelSidebarInteractions() {
    // Channel clicks will be handled dynamically as channels are created
  }

  // Initialize main chat area interactions
  function initializeChatInteractions() {
    // Message input handling
    if (elements.messageInput) {
      elements.messageInput.addEventListener('keydown', handleMessageInputKeydown);
      elements.messageInput.addEventListener('input', handleMessageInputChange);
    }

    // Send button
    if (elements.sendButton) {
      elements.sendButton.addEventListener('click', sendCurrentMessage);
    }

    // Attach file button
    const attachFileBtn = document.getElementById('attach-file');
    if (attachFileBtn) {
      attachFileBtn.addEventListener('click', handleFileAttachment);
    }

    // Emoji picker button
    const emojiBtn = document.getElementById('emoji-picker');
    if (emojiBtn) {
      emojiBtn.addEventListener('click', showEmojiPicker);
    }
  }

  // Server management functions
  function addTaskServer(serverData) {
    const server = new ServerData(serverData);
    multiServerState.servers.set(server.serverId, server);
    
    if (server.taskId) {
      multiServerState.taskServers.set(server.taskId, server);
    }
    
    renderTaskServerItem(server);
    updateServerCounts();
    
    // Show notification for new task server
    showNotification({
      type: 'info',
      title: 'New Task Server',
      message: `Task server "${server.serverName}" has been created`,
      serverIcon: server.getPriorityIcon()
    });
  }

  function addRegularServer(serverData) {
    const server = new ServerData(serverData);
    multiServerState.servers.set(server.serverId, server);
    
    renderRegularServerItem(server);
    updateServerCounts();
  }

  function renderTaskServerItem(server) {
    const serverItem = document.createElement('div');
    serverItem.className = `server-item server-item--task ${server.isActive ? 'server-item--active' : ''}`;
    serverItem.dataset.serverId = server.serverId;
    
    serverItem.innerHTML = `
      <div class="server-item__icon">
        <div class="task-server-icon" style="background-color: ${server.getStatusColor()}">
          ${server.getPriorityIcon()}
        </div>
        <div class="server-item__status-indicator ${server.taskStatus}"></div>
      </div>
      
      <div class="server-item__content">
        <div class="server-item__header">
          <div class="server-item__name">${server.serverName}</div>
          <div class="server-item__meta">
            <span class="task-type">${server.taskType || 'Task'}</span>
            ${server.taskPhase ? `<span class="task-phase">${server.taskPhase}</span>` : ''}
          </div>
        </div>
        
        <div class="server-item__progress">
          <div class="progress-bar">
            <div class="progress-bar__fill" style="width: ${server.taskProgress}%"></div>
          </div>
          <div class="progress-text">${server.taskProgress}%</div>
        </div>
        
        <div class="server-item__stats">
          <span class="stat">
            <span class="stat__icon">💬</span>
            <span class="stat__value">${server.channels.length}</span>
          </span>
          ${server.unreadCount > 0 ? `
            <span class="unread-badge">${server.unreadCount}</span>
          ` : ''}
        </div>
      </div>
      
      <div class="server-item__controls">
        <button class="server-control server-control--small" title="Pin Server">
          📌
        </button>
        <button class="server-control server-control--small" title="Server Menu">
          ⋯
        </button>
      </div>
    `;
    
    // Add event listeners
    serverItem.addEventListener('click', () => selectServer(server.serverId));
    
    // Add to task server list
    elements.taskServerList.appendChild(serverItem);
  }

  function renderRegularServerItem(server) {
    const serverItem = document.createElement('div');
    serverItem.className = `server-item server-item--regular ${server.isActive ? 'server-item--active' : ''}`;
    serverItem.dataset.serverId = server.serverId;
    
    serverItem.innerHTML = `
      <div class="server-item__icon">
        <div class="regular-server-icon">
          💭
        </div>
      </div>
      
      <div class="server-item__content">
        <div class="server-item__name">${server.serverName}</div>
        <div class="server-item__stats">
          <span class="stat">
            <span class="stat__icon">💬</span>
            <span class="stat__value">${server.channels.length}</span>
          </span>
          ${server.unreadCount > 0 ? `
            <span class="unread-badge">${server.unreadCount}</span>
          ` : ''}
        </div>
      </div>
    `;
    
    // Add event listeners
    serverItem.addEventListener('click', () => selectServer(server.serverId));
    
    // Add to regular server list
    elements.regularServerList.appendChild(serverItem);
  }

  function selectServer(serverId) {
    const server = multiServerState.servers.get(serverId);
    if (!server) return;
    
    // Update active server
    if (multiServerState.currentServerId) {
      const prevServer = multiServerState.servers.get(multiServerState.currentServerId);
      if (prevServer) {
        prevServer.isActive = false;
      }
    }
    
    server.isActive = true;
    multiServerState.currentServerId = serverId;
    
    // Update UI
    updateActiveServerUI(server);
    renderChannelList(server.channels);
    updateServerListActiveStates();
    
    // Request server data and message history
    sendMessage({
      type: 'selectServer',
      serverId: serverId,
      sessionId: generateSessionId()
    });
  }

  function updateActiveServerUI(server) {
    // Update server info in channel sidebar
    elements.currentServerName.textContent = server.serverName;
    
    const detailsHtml = [];
    if (server.serverType === 'task') {
      detailsHtml.push(`<span class="server-detail task-type">${server.taskType}</span>`);
      if (server.taskPhase) {
        detailsHtml.push(`<span class="server-detail task-phase">${server.taskPhase}</span>`);
      }
      detailsHtml.push(`<span class="server-detail task-status ${server.taskStatus}">${server.taskStatus}</span>`);
      detailsHtml.push(`<span class="server-detail task-progress">${server.taskProgress}%</span>`);
    }
    
    elements.currentServerDetails.innerHTML = detailsHtml.join('');
  }

  function renderChannelList(channels) {
    if (!elements.channelList) return;
    
    elements.channelList.innerHTML = '';
    
    // Group channels by type
    const channelGroups = {
      'general': [],
      'planning': [],
      'progress': [],
      'agent': [],
      'dm': []
    };
    
    channels.forEach(channel => {
      const channelData = new ChannelData(channel);
      multiServerState.channels.set(channelData.channelId, channelData);
      
      if (channelGroups[channelData.channelType]) {
        channelGroups[channelData.channelType].push(channelData);
      }
    });
    
    // Render channel groups
    Object.entries(channelGroups).forEach(([type, typeChannels]) => {
      if (typeChannels.length === 0) return;
      
      const groupElement = document.createElement('div');
      groupElement.className = 'channel-group';
      
      const groupHeader = document.createElement('div');
      groupHeader.className = 'channel-group__header';
      groupHeader.innerHTML = `
        <span class="channel-group__icon">${getChannelGroupIcon(type)}</span>
        <span class="channel-group__title">${getChannelGroupTitle(type)}</span>
        <span class="channel-group__count">${typeChannels.length}</span>
      `;
      
      groupElement.appendChild(groupHeader);
      
      const channelListElement = document.createElement('div');
      channelListElement.className = 'channel-group__list';
      
      typeChannels.forEach(channel => {
        const channelElement = renderChannelItem(channel);
        channelListElement.appendChild(channelElement);
      });
      
      groupElement.appendChild(channelListElement);
      elements.channelList.appendChild(groupElement);
    });
  }

  function renderChannelItem(channel) {
    const channelItem = document.createElement('div');
    channelItem.className = `channel-item channel-item--${channel.channelType} ${channel.isActive ? 'channel-item--active' : ''}`;
    channelItem.dataset.channelId = channel.channelId;
    
    let statusIndicator = '';
    if (channel.channelType === 'agent' && channel.agentRole) {
      statusIndicator = `
        <div class="agent-status-indicator">
          <span class="agent-status-icon ${channel.agentStatus}">${channel.getAgentStatusIcon()}</span>
          ${channel.agentProgress > 0 ? `
            <div class="agent-progress-mini">
              <div class="agent-progress-mini__fill" style="width: ${channel.agentProgress}%"></div>
            </div>
          ` : ''}
        </div>
      `;
    }
    
    channelItem.innerHTML = `
      <div class="channel-item__icon">
        ${channel.getChannelTypeIcon()}
      </div>
      
      <div class="channel-item__content">
        <div class="channel-item__name">${channel.channelName}</div>
        ${channel.agentRole ? `<div class="channel-item__agent-role">${channel.agentRole}</div>` : ''}
        ${channel.lastMessage ? `<div class="channel-item__last-message">${channel.lastMessage}</div>` : ''}
      </div>
      
      ${statusIndicator}
      
      <div class="channel-item__meta">
        ${channel.unreadCount > 0 ? `<span class="unread-count">${channel.unreadCount}</span>` : ''}
        ${channel.typingIndicators.length > 0 ? `<span class="typing-indicator">💭</span>` : ''}
      </div>
    `;
    
    // Add click handler
    channelItem.addEventListener('click', () => selectChannel(channel.channelId));
    
    return channelItem;
  }

  function selectChannel(channelId) {
    const channel = multiServerState.channels.get(channelId);
    if (!channel) return;
    
    // Update active channel
    if (multiServerState.currentChannelId) {
      const prevChannel = multiServerState.channels.get(multiServerState.currentChannelId);
      if (prevChannel) {
        prevChannel.isActive = false;
      }
    }
    
    channel.isActive = true;
    multiServerState.currentChannelId = channelId;
    
    // Update UI
    updateActiveChannelUI(channel);
    updateChannelListActiveStates();
    
    // Request channel messages
    sendMessage({
      type: 'selectChannel',
      serverId: multiServerState.currentServerId,
      channelId: channelId,
      sessionId: generateSessionId()
    });
    
    // Clear unread count
    if (channel.unreadCount > 0) {
      channel.unreadCount = 0;
      updateChannelUnreadUI(channel);
    }
  }

  function updateActiveChannelUI(channel) {
    elements.currentChannelIcon.textContent = channel.getChannelTypeIcon();
    elements.currentChannelName.textContent = channel.channelName;
    
    let description = '';
    if (channel.channelType === 'agent' && channel.agentRole) {
      description = `${channel.agentRole} Agent - ${channel.agentStatus}`;
      if (channel.agentProgress > 0) {
        description += ` (${channel.agentProgress}% complete)`;
      }
    } else if (channel.channelType === 'progress') {
      description = 'Task progress and milestone updates';
    } else if (channel.channelType === 'planning') {
      description = 'Planning and architectural discussions';
    } else {
      description = `${channel.messageCount} messages`;
    }
    
    elements.currentChannelDescription.textContent = description;
  }

  // Agent tracking and notifications
  function initializeAgentTracking() {
    // Poll for agent status updates
    setInterval(() => {
      if (multiServerState.currentServerId) {
        sendMessage({
          type: 'requestAgentStatus',
          serverId: multiServerState.currentServerId,
          sessionId: generateSessionId()
        });
      }
    }, 5000); // Update every 5 seconds
  }

  function updateAgentStatus(agentId, status) {
    multiServerState.agentStatuses.set(agentId, status);
    
    // Find and update corresponding channels
    multiServerState.channels.forEach(channel => {
      if (channel.channelType === 'agent' && channel.agentRole === agentId) {
        channel.agentStatus = status.status;
        channel.agentProgress = status.progress || 0;
        
        // Update UI if this channel is visible
        updateChannelAgentStatusUI(channel);
      }
    });
    
    // Update agent status panel
    updateAgentStatusPanel();
    
    // Show completion notification
    if (status.status === 'completed') {
      showNotification({
        type: 'success',
        title: 'Agent Completed',
        message: `${agentId} has completed its task`,
        agentIcon: '✅'
      });
    }
  }

  function updateAgentStatusPanel() {
    if (!elements.activeAgentList) return;
    
    const activeAgents = Array.from(multiServerState.agentStatuses.entries())
      .filter(([_, status]) => status.status !== 'idle' && status.status !== 'completed');
    
    elements.activeAgentCount.textContent = activeAgents.length.toString();
    
    elements.activeAgentList.innerHTML = activeAgents
      .map(([agentId, status]) => `
        <div class="active-agent-item">
          <div class="active-agent-item__icon">${getAgentStatusIcon(status.status)}</div>
          <div class="active-agent-item__content">
            <div class="active-agent-item__name">${agentId}</div>
            <div class="active-agent-item__status">${status.currentAction || status.status}</div>
            ${status.progress > 0 ? `
              <div class="active-agent-item__progress">
                <div class="progress-bar-mini">
                  <div class="progress-bar-mini__fill" style="width: ${status.progress}%"></div>
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      `).join('');
  }

  // Notification system
  function initializeNotificationSystem() {
    // Listen for browser notifications permission
    if ('Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }

  function showNotification({ type, title, message, serverIcon = '', agentIcon = '', duration = 5000 }) {
    // Create in-app notification
    const notification = document.createElement('div');
    notification.className = `notification notification--${type}`;
    
    notification.innerHTML = `
      <div class="notification__icon">
        ${serverIcon || agentIcon || getNotificationIcon(type)}
      </div>
      <div class="notification__content">
        <div class="notification__title">${title}</div>
        <div class="notification__message">${message}</div>
      </div>
      <button class="notification__close">✕</button>
    `;
    
    // Add to container
    elements.notificationContainer.appendChild(notification);
    
    // Auto-remove after duration
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, duration);
    
    // Close button
    notification.querySelector('.notification__close').addEventListener('click', () => {
      notification.remove();
    });
    
    // Browser notification for important events
    if (type === 'success' || type === 'error') {
      showBrowserNotification(title, message);
    }
    
    // Play notification sound
    playNotificationSound(type);
  }

  function showBrowserNotification(title, message) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body: message,
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="50" font-size="50">🚀</text></svg>'
      });
    }
  }

  function playNotificationSound(type) {
    // Create audio context for notification sounds
    if (!window.audioContext) {
      window.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    const frequencies = {
      'info': 800,
      'success': 1000,
      'warning': 600,
      'error': 400
    };
    
    const freq = frequencies[type] || 800;
    
    const oscillator = window.audioContext.createOscillator();
    const gainNode = window.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(window.audioContext.destination);
    
    oscillator.frequency.value = freq;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, window.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, window.audioContext.currentTime + 0.5);
    
    oscillator.start(window.audioContext.currentTime);
    oscillator.stop(window.audioContext.currentTime + 0.5);
  }

  // Message handling
  function setupEnhancedMessageListener() {
    window.addEventListener('message', (event) => {
      const message = event.data;
      
      try {
        switch (message.type) {
          case 'serverList':
            handleServerListUpdate(message.servers);
            break;
          case 'taskServerCreated':
            addTaskServer(message.serverData);
            break;
          case 'channelList':
            renderChannelList(message.channels);
            break;
          case 'agentStatusUpdate':
            updateAgentStatus(message.agentId, message.status);
            break;
          case 'taskProgressUpdate':
            handleTaskProgressUpdate(message.taskId, message.progress);
            break;
          case 'newMessage':
            handleNewMessage(message);
            break;
          case 'directMessage':
            handleDirectMessage(message);
            break;
          case 'notificationEvent':
            showNotification(message.notification);
            break;
          default:
            console.log('[MultiServerChat] Unknown message type:', message.type);
        }
      } catch (error) {
        console.error('[MultiServerChat] Error handling message:', error, message);
      }
    });
  }

  function handleServerListUpdate(servers) {
    servers.forEach(serverData => {
      if (serverData.serverType === 'task') {
        addTaskServer(serverData);
      } else {
        addRegularServer(serverData);
      }
    });
  }

  function handleTaskProgressUpdate(taskId, progressData) {
    const server = multiServerState.taskServers.get(taskId);
    if (server) {
      server.updateTaskProgress(progressData.progress, progressData.status);
      updateTaskServerUI(server);
      
      // Show milestone notifications
      if (progressData.milestone) {
        showNotification({
          type: 'info',
          title: 'Task Milestone',
          message: `${server.serverName}: ${progressData.milestone}`,
          serverIcon: server.getPriorityIcon()
        });
      }
    }
  }

  function handleNewMessage(messageData) {
    // Update channel message count and last activity
    const channel = multiServerState.channels.get(messageData.channelId);
    if (channel) {
      channel.messageCount++;
      channel.lastActivity = Date.now();
      channel.lastMessage = messageData.preview;
      
      // Increment unread count if not current channel
      if (messageData.channelId !== multiServerState.currentChannelId) {
        channel.unreadCount++;
        updateChannelUnreadUI(channel);
      }
      
      // Update server unread count
      const server = multiServerState.servers.get(messageData.serverId);
      if (server && messageData.channelId !== multiServerState.currentChannelId) {
        server.unreadCount++;
        updateServerUnreadUI(server);
      }
    }
    
    // Show message in chat if it's the current channel
    if (messageData.channelId === multiServerState.currentChannelId) {
      displayMessage(messageData);
    }
  }

  function handleDirectMessage(dmData) {
    // Handle direct messages
    showNotification({
      type: 'info',
      title: 'Direct Message',
      message: `${dmData.senderName}: ${dmData.preview}`,
      agentIcon: '💬'
    });
  }

  // Utility functions
  function getChannelGroupIcon(type) {
    const icons = {
      'general': '💭',
      'planning': '📋',
      'progress': '📊',
      'agent': '🤖',
      'dm': '💬'
    };
    return icons[type] || '💭';
  }

  function getChannelGroupTitle(type) {
    const titles = {
      'general': 'General Channels',
      'planning': 'Planning',
      'progress': 'Progress Tracking',
      'agent': 'Agent Channels',
      'dm': 'Direct Messages'
    };
    return titles[type] || 'Channels';
  }

  function getAgentStatusIcon(status) {
    const icons = {
      'idle': '⭕',
      'active': '🟢',
      'waiting': '🟡',
      'error': '🔴',
      'completed': '✅'
    };
    return icons[status] || '⭕';
  }

  function getNotificationIcon(type) {
    const icons = {
      'info': 'ℹ️',
      'success': '✅',
      'warning': '⚠️',
      'error': '❌'
    };
    return icons[type] || 'ℹ️';
  }

  function updateServerCounts() {
    const taskServerCount = Array.from(multiServerState.servers.values())
      .filter(s => s.serverType === 'task' && !s.archived).length;
    const regularServerCount = Array.from(multiServerState.servers.values())
      .filter(s => s.serverType === 'regular' && !s.archived).length;
    
    elements.taskServerCount.textContent = taskServerCount.toString();
    elements.regularServerCount.textContent = regularServerCount.toString();
  }

  function updateServerListActiveStates() {
    document.querySelectorAll('.server-item').forEach(item => {
      const serverId = item.dataset.serverId;
      if (serverId === multiServerState.currentServerId) {
        item.classList.add('server-item--active');
      } else {
        item.classList.remove('server-item--active');
      }
    });
  }

  function updateChannelListActiveStates() {
    document.querySelectorAll('.channel-item').forEach(item => {
      const channelId = item.dataset.channelId;
      if (channelId === multiServerState.currentChannelId) {
        item.classList.add('channel-item--active');
      } else {
        item.classList.remove('channel-item--active');
      }
    });
  }

  function generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  function sendMessage(message) {
    vscode.postMessage(message);
  }

  // Initialize theme and performance optimizations
  function initializeStateManagement() {
    // Load persisted state
    const persistedState = vscode.getState();
    if (persistedState) {
      Object.assign(multiServerState, persistedState);
    }
    
    // Save state periodically
    setInterval(() => {
      vscode.setState(multiServerState);
    }, 10000); // Save every 10 seconds
  }

  function updateThemeVariables() {
    const root = document.documentElement;
    const theme = document.body.dataset.vscodeThemeKind || 'dark';
    
    root.style.setProperty('--theme-kind', theme);
    
    // Update CSS custom properties based on theme
    if (theme === 'light') {
      root.style.setProperty('--server-sidebar-bg', '#f3f4f6');
      root.style.setProperty('--channel-sidebar-bg', '#ffffff');
      root.style.setProperty('--chat-main-bg', '#ffffff');
      root.style.setProperty('--text-primary', '#1f2937');
      root.style.setProperty('--text-secondary', '#6b7280');
    } else {
      root.style.setProperty('--server-sidebar-bg', '#1e1f22');
      root.style.setProperty('--channel-sidebar-bg', '#2f3136');
      root.style.setProperty('--chat-main-bg', '#36393f');
      root.style.setProperty('--text-primary', '#ffffff');
      root.style.setProperty('--text-secondary', '#b9bbbe');
    }
  }

  function applyThemeStyles() {
    updateThemeVariables();
  }

  function optimizeRenderingPerformance() {
    // Implement virtual scrolling for large message lists
    // Throttle UI updates
    // Use requestAnimationFrame for smooth animations
  }

  // Event handlers (stub implementations)
  function toggleServerSection(section) {
    // Toggle server section collapse/expand
    console.log('[MultiServerChat] Toggling server section:', section);
  }

  function showAddServerDialog() {
    console.log('[MultiServerChat] Showing add server dialog');
  }

  function showServerSettings() {
    console.log('[MultiServerChat] Showing server settings');
  }

  function handleMessageInputKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendCurrentMessage();
    }
  }

  function handleMessageInputChange(e) {
    // Handle typing indicators
  }

  function sendCurrentMessage() {
    const content = elements.messageInput.textContent.trim();
    if (!content) return;
    
    sendMessage({
      type: 'sendMessage',
      serverId: multiServerState.currentServerId,
      channelId: multiServerState.currentChannelId,
      content: content,
      sessionId: generateSessionId()
    });
    
    elements.messageInput.textContent = '';
  }

  function handleFileAttachment() {
    console.log('[MultiServerChat] File attachment clicked');
  }

  function showEmojiPicker() {
    console.log('[MultiServerChat] Emoji picker clicked');
  }

  function updateChannelUnreadUI(channel) {
    // Update unread count in UI
  }

  function updateServerUnreadUI(server) {
    // Update server unread count in UI
  }

  function updateChannelAgentStatusUI(channel) {
    // Update agent status indicators in channel UI
  }

  function updateTaskServerUI(server) {
    // Update task server progress and status in UI
  }

  function displayMessage(messageData) {
    // Display message in current chat view
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

  // Export for testing
  window.MultiServerChat = {
    state: multiServerState,
    addTaskServer,
    addRegularServer,
    selectServer,
    selectChannel,
    showNotification
  };

})();