/**
 * Multi-Chat Notification Manager
 * 
 * Manages notifications for multi-chat system events including direct messages,
 * channel activity, mentions, server events, and collaboration awareness.
 */

import * as vscode from 'vscode';
import { VesperaLogger } from '../core/logging/VesperaLogger';
import { VesperaErrorHandler } from '../core/error-handling/VesperaErrorHandler';
import { SecurityEnhancedVesperaCoreServices } from '../core/security/SecurityEnhancedCoreServices';
import { 
  SecureNotificationManager, 
  NotificationLevel, 
  NotificationType 
} from './SecureNotificationManager';

export enum ChatEventType {
  DIRECT_MESSAGE = 'direct_message',
  CHANNEL_MESSAGE = 'channel_message',
  MENTION = 'mention',
  REPLY = 'reply',
  SERVER_JOIN = 'server_join',
  SERVER_LEAVE = 'server_leave',
  CHANNEL_CREATED = 'channel_created',
  TYPING_INDICATOR = 'typing_indicator',
  PRESENCE_UPDATE = 'presence_update',
  UNREAD_MESSAGES = 'unread_messages'
}

export enum PresenceStatus {
  ONLINE = 'online',
  AWAY = 'away',
  BUSY = 'busy',
  OFFLINE = 'offline'
}

export interface ChatUser {
  id: string;
  username: string;
  displayName?: string;
  avatar?: string;
  presence: PresenceStatus;
  isBot?: boolean;
}

export interface ChatMessage {
  id: string;
  content: string;
  authorId: string;
  channelId: string;
  serverId: string;
  timestamp: number;
  mentions: string[];
  replyToId?: string;
  attachments?: ChatAttachment[];
  reactions?: ChatReaction[];
}

export interface ChatAttachment {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'file' | 'audio' | 'video';
  size: number;
}

export interface ChatReaction {
  emoji: string;
  count: number;
  users: string[];
}

export interface ChatChannel {
  id: string;
  name: string;
  serverId: string;
  type: 'text' | 'voice' | 'dm';
  topic?: string;
  memberCount?: number;
  unreadCount: number;
  lastMessageId?: string;
  lastActivity: number;
}

export interface ChatServer {
  id: string;
  name: string;
  iconUrl?: string;
  memberCount: number;
  channels: ChatChannel[];
  unreadCount: number;
  mentionCount: number;
  lastActivity: number;
}

export interface ChatEvent {
  type: ChatEventType;
  timestamp: number;
  serverId: string;
  channelId?: string;
  userId?: string;
  message?: ChatMessage;
  user?: ChatUser;
  data?: any;
}

export interface MultiChatNotificationConfig {
  enabled: boolean;
  directMessages: {
    enabled: boolean;
    showPreview: boolean;
    playSound: boolean;
    showInToast: boolean;
    includeAttachments: boolean;
  };
  channelActivity: {
    enabled: boolean;
    subscribedChannelsOnly: boolean;
    importantChannelsOnly: boolean;
    showPreviews: boolean;
    batchNotifications: boolean;
  };
  mentions: {
    enabled: boolean;
    highlightEnabled: boolean;
    keywordAlerts: string[];
    showInToast: boolean;
    playSound: boolean;
  };
  serverEvents: {
    showJoinLeave: boolean;
    showChannelCreation: boolean;
    onlyImportantServers: boolean;
  };
  unreadMessages: {
    enabled: boolean;
    batchingEnabled: boolean;
    updateInterval: number; // milliseconds
    thresholdForNotification: number;
  };
  privacy: {
    hideMessageContent: boolean;
    hideUsernames: boolean;
    hideServerNames: boolean;
    sanitizeContent: boolean;
  };
  filtering: {
    mutedServers: string[];
    mutedChannels: string[];
    mutedUsers: string[];
    botMessagesEnabled: boolean;
    spamFilterEnabled: boolean;
  };
}

export class MultiChatNotificationManager implements vscode.Disposable {
  private static instance: MultiChatNotificationManager;
  private initialized = false;
  private config: MultiChatNotificationConfig;
  private disposables: vscode.Disposable[] = [];
  
  // State tracking
  private connectedServers: Map<string, ChatServer> = new Map();
  private userPresence: Map<string, ChatUser> = new Map();
  private unreadMessages: Map<string, number> = new Map(); // channelId -> count
  private mentionKeywords: Set<string> = new Set();
  
  // Batching and rate limiting
  private pendingNotifications: Map<string, ChatEvent[]> = new Map();
  private batchTimer?: NodeJS.Timeout;
  private lastNotificationTimes: Map<string, number> = new Map();

  private constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly coreServices: SecurityEnhancedVesperaCoreServices,
    private readonly notificationManager: SecureNotificationManager,
    private readonly logger: VesperaLogger,
    private readonly errorHandler: VesperaErrorHandler
  ) {
    this.config = this.getDefaultConfig();
  }

  /**
   * Initialize the multi-chat notification manager
   */
  public static async initialize(
    context: vscode.ExtensionContext,
    coreServices: SecurityEnhancedVesperaCoreServices,
    notificationManager: SecureNotificationManager
  ): Promise<MultiChatNotificationManager> {
    if (MultiChatNotificationManager.instance) {
      return MultiChatNotificationManager.instance;
    }

    const logger = coreServices.logger.createChild('MultiChatNotificationManager');
    const instance = new MultiChatNotificationManager(
      context,
      coreServices,
      notificationManager,
      logger,
      coreServices.errorHandler
    );

    await instance.initializeInternal();
    MultiChatNotificationManager.instance = instance;
    
    return instance;
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): MultiChatNotificationManager {
    if (!MultiChatNotificationManager.instance?.initialized) {
      throw new Error('MultiChatNotificationManager not initialized');
    }
    return MultiChatNotificationManager.instance;
  }

  /**
   * Internal initialization
   */
  private async initializeInternal(): Promise<void> {
    try {
      this.logger.info('Initializing MultiChatNotificationManager');

      // Load configuration
      await this.loadConfiguration();

      // Setup mention keywords
      this.setupMentionKeywords();

      // Setup unread message polling
      this.setupUnreadMessagePolling();

      // Setup periodic cleanup
      this.setupPeriodicCleanup();

      // Register disposal
      this.context.subscriptions.push(this);

      this.initialized = true;
      this.logger.info('MultiChatNotificationManager initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize MultiChatNotificationManager', error);
      throw error;
    }
  }

  /**
   * Handle chat event
   */
  public async handleChatEvent(event: ChatEvent): Promise<void> {
    try {
      if (!this.config.enabled || !this.shouldProcessEvent(event)) {
        return;
      }

      this.logger.debug('Handling chat event', {
        type: event.type,
        serverId: event.serverId,
        channelId: event.channelId,
        userId: event.userId
      });

      switch (event.type) {
        case ChatEventType.DIRECT_MESSAGE:
          await this.handleDirectMessage(event);
          break;
        case ChatEventType.CHANNEL_MESSAGE:
          await this.handleChannelMessage(event);
          break;
        case ChatEventType.MENTION:
          await this.handleMention(event);
          break;
        case ChatEventType.REPLY:
          await this.handleReply(event);
          break;
        case ChatEventType.SERVER_JOIN:
          await this.handleServerJoin(event);
          break;
        case ChatEventType.SERVER_LEAVE:
          await this.handleServerLeave(event);
          break;
        case ChatEventType.CHANNEL_CREATED:
          await this.handleChannelCreated(event);
          break;
        case ChatEventType.PRESENCE_UPDATE:
          await this.handlePresenceUpdate(event);
          break;
        case ChatEventType.UNREAD_MESSAGES:
          await this.handleUnreadMessages(event);
          break;
        default:
          this.logger.debug('Unhandled chat event type', { type: event.type });
      }

    } catch (error) {
      this.logger.error('Failed to handle chat event', error, {
        eventType: event.type,
        serverId: event.serverId
      });
      await this.errorHandler.handleError(error as Error);
    }
  }

  /**
   * Handle direct message
   */
  private async handleDirectMessage(event: ChatEvent): Promise<void> {
    if (!this.config.directMessages.enabled || !event.message) {
      return;
    }

    const message = event.message;
    const author = this.userPresence.get(message.authorId);
    
    // Skip messages from bots if disabled
    if (author?.isBot && !this.config.filtering.botMessagesEnabled) {
      return;
    }

    const content = await this.processMessageContent(message.content);
    const authorName = this.getDisplayName(author);
    
    await this.notificationManager.notify({
      title: `Direct Message from ${authorName}`,
      message: this.config.directMessages.showPreview ? content : 'New direct message',
      type: NotificationType.CHAT_MESSAGE,
      level: NotificationLevel.IMPORTANT,
      data: {
        messageId: message.id,
        authorId: message.authorId,
        channelId: message.channelId,
        serverId: event.serverId,
        hasAttachments: (message.attachments?.length || 0) > 0
      },
      showInToast: this.config.directMessages.showInToast,
      actions: [
        {
          id: 'reply',
          label: 'Reply',
          callback: () => this.replyToMessage(message.id)
        },
        {
          id: 'view_conversation',
          label: 'View Conversation',
          callback: () => this.viewConversation(message.channelId)
        }
      ]
    });

    this.logger.info('Direct message notification sent', {
      messageId: message.id,
      authorId: message.authorId,
      hasAttachments: (message.attachments?.length || 0) > 0
    });
  }

  /**
   * Handle channel message
   */
  private async handleChannelMessage(event: ChatEvent): Promise<void> {
    if (!this.config.channelActivity.enabled || !event.message) {
      return;
    }

    
    // Check if this is a subscribed or important channel
    if (this.config.channelActivity.subscribedChannelsOnly) {
      // Would check subscription status
      // For now, we'll show all messages
    }

    // Batch channel notifications if enabled
    if (this.config.channelActivity.batchNotifications) {
      await this.batchChannelMessage(event);
      return;
    }

    await this.showChannelMessageNotification(event);
  }

  /**
   * Handle mention
   */
  private async handleMention(event: ChatEvent): Promise<void> {
    if (!this.config.mentions.enabled || !event.message) {
      return;
    }

    const message = event.message;
    const author = this.userPresence.get(message.authorId);
    const server = this.connectedServers.get(event.serverId);
    const channel = server?.channels.find(c => c.id === message.channelId);
    
    const authorName = this.getDisplayName(author);
    const channelName = channel?.name || 'Unknown Channel';
    const serverName = server?.name || 'Unknown Server';
    
    const content = await this.processMessageContent(message.content);
    
    await this.notificationManager.notify({
      title: `Mentioned by ${authorName}`,
      message: `In #${channelName} (${serverName}): ${content}`,
      type: NotificationType.CHAT_MESSAGE,
      level: NotificationLevel.IMPORTANT,
      data: {
        messageId: message.id,
        authorId: message.authorId,
        channelId: message.channelId,
        serverId: event.serverId,
        mentionType: 'direct'
      },
      showInToast: this.config.mentions.showInToast,
      actions: [
        {
          id: 'reply',
          label: 'Reply',
          callback: () => this.replyToMessage(message.id)
        },
        {
          id: 'view_context',
          label: 'View Context',
          callback: () => this.viewMessageContext(message.id)
        }
      ]
    });

    this.logger.info('Mention notification sent', {
      messageId: message.id,
      authorId: message.authorId,
      channelId: message.channelId
    });
  }

  /**
   * Handle reply
   */
  private async handleReply(event: ChatEvent): Promise<void> {
    if (!event.message) return;

    const message = event.message;
    const author = this.userPresence.get(message.authorId);
    const authorName = this.getDisplayName(author);
    
    const content = await this.processMessageContent(message.content);
    
    await this.notificationManager.notify({
      title: `Reply from ${authorName}`,
      message: content,
      type: NotificationType.CHAT_MESSAGE,
      level: NotificationLevel.INFO,
      data: {
        messageId: message.id,
        replyToId: message.replyToId,
        authorId: message.authorId,
        channelId: message.channelId,
        serverId: event.serverId
      },
      showInToast: false,
      actions: [
        {
          id: 'view_thread',
          label: 'View Thread',
          callback: () => this.viewMessageThread(message.id)
        }
      ]
    });
  }

  /**
   * Handle server join
   */
  private async handleServerJoin(event: ChatEvent): Promise<void> {
    if (!this.config.serverEvents.showJoinLeave || !event.user) {
      return;
    }

    const user = event.user;
    const server = this.connectedServers.get(event.serverId);
    const serverName = server?.name || 'Unknown Server';
    const userName = this.getDisplayName(user);
    
    await this.notificationManager.notify({
      title: 'User Joined Server',
      message: `${userName} joined ${serverName}`,
      type: NotificationType.CHAT_MESSAGE,
      level: NotificationLevel.INFO,
      data: {
        userId: user.id,
        serverId: event.serverId,
        eventType: 'join'
      },
      showInToast: false
    });
  }

  /**
   * Handle server leave
   */
  private async handleServerLeave(event: ChatEvent): Promise<void> {
    if (!this.config.serverEvents.showJoinLeave || !event.user) {
      return;
    }

    const user = event.user;
    const server = this.connectedServers.get(event.serverId);
    const serverName = server?.name || 'Unknown Server';
    const userName = this.getDisplayName(user);
    
    await this.notificationManager.notify({
      title: 'User Left Server',
      message: `${userName} left ${serverName}`,
      type: NotificationType.CHAT_MESSAGE,
      level: NotificationLevel.INFO,
      data: {
        userId: user.id,
        serverId: event.serverId,
        eventType: 'leave'
      },
      showInToast: false
    });
  }

  /**
   * Handle channel created
   */
  private async handleChannelCreated(event: ChatEvent): Promise<void> {
    if (!this.config.serverEvents.showChannelCreation) {
      return;
    }

    const channelData = event.data;
    const server = this.connectedServers.get(event.serverId);
    const serverName = server?.name || 'Unknown Server';
    
    await this.notificationManager.notify({
      title: 'New Channel Created',
      message: `#${channelData.name} created in ${serverName}`,
      type: NotificationType.CHAT_MESSAGE,
      level: NotificationLevel.INFO,
      data: {
        channelId: channelData.id,
        channelName: channelData.name,
        serverId: event.serverId
      },
      showInToast: false,
      actions: [
        {
          id: 'join_channel',
          label: 'Join Channel',
          callback: () => this.joinChannel(channelData.id)
        }
      ]
    });
  }

  /**
   * Handle presence update
   */
  private async handlePresenceUpdate(event: ChatEvent): Promise<void> {
    if (!event.user) return;

    const user = event.user;
    const previousUser = this.userPresence.get(user.id);
    
    // Update presence
    this.userPresence.set(user.id, user);
    
    // Only notify for important presence changes (online/offline)
    if (previousUser && 
        previousUser.presence !== user.presence &&
        (user.presence === PresenceStatus.ONLINE || user.presence === PresenceStatus.OFFLINE)) {
      
      const userName = this.getDisplayName(user);
      const status = user.presence === PresenceStatus.ONLINE ? 'came online' : 'went offline';
      
      await this.notificationManager.notify({
        title: 'Presence Update',
        message: `${userName} ${status}`,
        type: NotificationType.CHAT_MESSAGE,
        level: NotificationLevel.DEBUG,
        data: {
          userId: user.id,
          presence: user.presence,
          previousPresence: previousUser.presence
        },
        showInToast: false
      });
    }
  }

  /**
   * Handle unread messages
   */
  private async handleUnreadMessages(event: ChatEvent): Promise<void> {
    if (!this.config.unreadMessages.enabled) {
      return;
    }

    const unreadData = event.data;
    const totalUnread = Object.values(unreadData.unreadCounts as Record<string, number>)
      .reduce((sum: number, count: number) => sum + count, 0);
    
    if (totalUnread < this.config.unreadMessages.thresholdForNotification) {
      return;
    }

    // Batch unread notifications
    if (this.config.unreadMessages.batchingEnabled) {
      await this.batchUnreadNotification(unreadData);
    } else {
      await this.showUnreadNotification(totalUnread, unreadData);
    }
  }

  /**
   * Batch channel messages
   */
  private async batchChannelMessage(event: ChatEvent): Promise<void> {
    const batchKey = `channel_${event.channelId}`;
    
    if (!this.pendingNotifications.has(batchKey)) {
      this.pendingNotifications.set(batchKey, []);
    }
    
    this.pendingNotifications.get(batchKey)!.push(event);
    
    // Setup batch timer if not already running
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(async () => {
        await this.processBatchedNotifications();
        this.batchTimer = undefined;
      }, 5000); // 5 second batching window
    }
  }

  /**
   * Process batched notifications
   */
  private async processBatchedNotifications(): Promise<void> {
    try {
      for (const [batchKey, events] of this.pendingNotifications.entries()) {
        if (events.length === 0) continue;
        
        if (batchKey.startsWith('channel_')) {
          await this.processBatchedChannelMessages(events);
        } else if (batchKey.startsWith('unread_')) {
          await this.processBatchedUnreadMessages(events);
        }
      }
      
      this.pendingNotifications.clear();
    } catch (error) {
      this.logger.error('Failed to process batched notifications', error);
      await this.errorHandler.handleError(error as Error);
    }
  }

  /**
   * Process batched channel messages
   */
  private async processBatchedChannelMessages(events: ChatEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }
    
    const firstEvent = events[0];
    const channelId = firstEvent?.channelId;
    const serverId = firstEvent?.serverId;
    
    if (!channelId || !serverId) {
      return;
    }
    
    const server = this.connectedServers.get(serverId);
    const channel = server?.channels.find(c => c.id === channelId);
    
    const messageCount = events.length;
    const uniqueAuthors = new Set(events.map(e => e.message?.authorId).filter(Boolean)).size;
    
    const channelName = channel?.name || 'Unknown Channel';
    const serverName = server?.name || 'Unknown Server';
    
    await this.notificationManager.notify({
      title: 'Channel Activity',
      message: `${messageCount} new messages from ${uniqueAuthors} users in #${channelName} (${serverName})`,
      type: NotificationType.CHAT_MESSAGE,
      level: NotificationLevel.INFO,
      data: {
        channelId,
        serverId,
        messageCount,
        uniqueAuthors,
        events: events.map(e => e.message?.id).filter(Boolean)
      },
      showInToast: false,
      actions: [
        {
          id: 'view_channel',
          label: 'View Channel',
          callback: () => this.viewChannel(channelId)
        }
      ]
    });
  }

  /**
   * Show channel message notification
   */
  private async showChannelMessageNotification(event: ChatEvent): Promise<void> {
    const message = event.message!;
    const author = this.userPresence.get(message.authorId);
    const server = this.connectedServers.get(event.serverId);
    const channel = server?.channels.find(c => c.id === message.channelId);
    
    const authorName = this.getDisplayName(author);
    const channelName = channel?.name || 'Unknown Channel';
    const serverName = server?.name || 'Unknown Server';
    
    const content = this.config.channelActivity.showPreviews 
      ? await this.processMessageContent(message.content)
      : 'New message';
    
    await this.notificationManager.notify({
      title: `Message in #${channelName}`,
      message: `${authorName}: ${content}`,
      type: NotificationType.CHAT_MESSAGE,
      level: NotificationLevel.INFO,
      data: {
        messageId: message.id,
        authorId: message.authorId,
        channelId: message.channelId,
        serverId: event.serverId,
        serverName,
        channelName
      },
      showInToast: false
    });
  }

  /**
   * Show unread notification
   */
  private async showUnreadNotification(totalUnread: number, unreadData: any): Promise<void> {
    const serverCount = Object.keys(unreadData.unreadCounts).length;
    
    await this.notificationManager.notify({
      title: 'Unread Messages',
      message: `${totalUnread} unread messages across ${serverCount} channels`,
      type: NotificationType.CHAT_MESSAGE,
      level: NotificationLevel.INFO,
      data: {
        totalUnread,
        serverCount,
        unreadCounts: unreadData.unreadCounts
      },
      showInToast: true,
      actions: [
        {
          id: 'view_unread',
          label: 'View Unread',
          callback: () => this.viewUnreadMessages()
        },
        {
          id: 'mark_all_read',
          label: 'Mark All Read',
          callback: () => this.markAllMessagesRead()
        }
      ]
    });
  }

  /**
   * Check if event should be processed
   */
  private shouldProcessEvent(event: ChatEvent): boolean {
    // Check if server is muted
    if (this.config.filtering.mutedServers.includes(event.serverId)) {
      return false;
    }

    // Check if channel is muted
    if (event.channelId && this.config.filtering.mutedChannels.includes(event.channelId)) {
      return false;
    }

    // Check if user is muted
    if (event.userId && this.config.filtering.mutedUsers.includes(event.userId)) {
      return false;
    }

    // Check rate limiting
    const rateLimitKey = `${event.type}_${event.serverId}_${event.channelId || ''}`;
    const now = Date.now();
    const lastNotification = this.lastNotificationTimes.get(rateLimitKey) || 0;
    
    if (now - lastNotification < 1000) { // 1 second minimum between similar notifications
      return false;
    }
    
    this.lastNotificationTimes.set(rateLimitKey, now);
    return true;
  }

  /**
   * Process message content for privacy and display
   */
  private async processMessageContent(content: string): Promise<string> {
    if (this.config.privacy.hideMessageContent) {
      return '[Message content hidden]';
    }

    let processedContent = content;

    // Apply privacy filtering
    if (this.config.privacy.sanitizeContent && this.coreServices.inputSanitizer) {
      try {
        const result = await this.coreServices.inputSanitizer.sanitize(
          content,
          'user_input' as any
        );
        processedContent = result.sanitized;
      } catch (error) {
        this.logger.warn('Failed to sanitize message content', { error });
      }
    }

    // Truncate long messages
    if (processedContent.length > 100) {
      processedContent = processedContent.substring(0, 97) + '...';
    }

    return processedContent;
  }

  /**
   * Get display name for user
   */
  private getDisplayName(user?: ChatUser): string {
    if (this.config.privacy.hideUsernames) {
      return '[Username hidden]';
    }
    
    return user?.displayName || user?.username || 'Unknown User';
  }

  /**
   * Setup mention keywords
   */
  private setupMentionKeywords(): void {
    this.mentionKeywords.clear();
    
    // Add configured keywords
    for (const keyword of this.config.mentions.keywordAlerts) {
      this.mentionKeywords.add(keyword.toLowerCase());
    }
    
    this.logger.debug('Mention keywords configured', {
      keywordCount: this.mentionKeywords.size
    });
  }

  /**
   * Setup unread message polling
   */
  private setupUnreadMessagePolling(): void {
    if (!this.config.unreadMessages.enabled) {
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        // This would poll for unread message counts
        // For now, we'll just clean up old tracking data
        this.cleanupUnreadTracking();
      } catch (error) {
        this.logger.warn('Unread message polling failed', { error });
      }
    }, this.config.unreadMessages.updateInterval);

    this.disposables.push(new vscode.Disposable(() => {
      clearInterval(pollInterval);
    }));
  }

  /**
   * Cleanup unread tracking
   */
  private cleanupUnreadTracking(): void {
    const fiveMinutesAgo = Date.now() - 300000;
    
    for (const [key, timestamp] of this.lastNotificationTimes.entries()) {
      if (timestamp < fiveMinutesAgo) {
        this.lastNotificationTimes.delete(key);
      }
    }
  }

  // Action callbacks (would integrate with actual chat UI components)
  private async replyToMessage(messageId: string): Promise<void> {
    this.logger.info('Reply to message requested', { messageId });
  }

  private async viewConversation(channelId: string): Promise<void> {
    this.logger.info('View conversation requested', { channelId });
  }

  private async viewMessageContext(messageId: string): Promise<void> {
    this.logger.info('View message context requested', { messageId });
  }

  private async viewMessageThread(messageId: string): Promise<void> {
    this.logger.info('View message thread requested', { messageId });
  }

  private async joinChannel(channelId: string): Promise<void> {
    this.logger.info('Join channel requested', { channelId });
  }

  private async viewChannel(channelId: string): Promise<void> {
    this.logger.info('View channel requested', { channelId });
  }

  private async viewUnreadMessages(): Promise<void> {
    this.logger.info('View unread messages requested');
  }

  private async markAllMessagesRead(): Promise<void> {
    this.logger.info('Mark all messages read requested');
  }

  /**
   * Update server information
   */
  public updateServer(server: ChatServer): void {
    this.connectedServers.set(server.id, server);
    this.logger.debug('Server updated', { serverId: server.id, name: server.name });
  }

  /**
   * Update user presence
   */
  public updateUserPresence(user: ChatUser): void {
    this.userPresence.set(user.id, user);
  }

  /**
   * Update configuration
   */
  public async updateConfiguration(config: Partial<MultiChatNotificationConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    await this.saveConfiguration();
    
    // Reapply configuration-dependent setup
    this.setupMentionKeywords();
    
    this.logger.info('Multi-chat notification configuration updated');
  }

  /**
   * Load configuration
   */
  private async loadConfiguration(): Promise<void> {
    const workspaceConfig = vscode.workspace.getConfiguration('vesperaForge.notifications.multiChat');
    
    this.config = {
      ...this.getDefaultConfig(),
      enabled: workspaceConfig.get('enabled', this.config.enabled)
    };
  }

  /**
   * Save configuration
   */
  private async saveConfiguration(): Promise<void> {
    const workspaceConfig = vscode.workspace.getConfiguration('vesperaForge.notifications.multiChat');
    await workspaceConfig.update('enabled', this.config.enabled, true);
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): MultiChatNotificationConfig {
    return {
      enabled: true,
      directMessages: {
        enabled: true,
        showPreview: true,
        playSound: true,
        showInToast: true,
        includeAttachments: true
      },
      channelActivity: {
        enabled: true,
        subscribedChannelsOnly: false,
        importantChannelsOnly: false,
        showPreviews: false,
        batchNotifications: true
      },
      mentions: {
        enabled: true,
        highlightEnabled: true,
        keywordAlerts: [],
        showInToast: true,
        playSound: true
      },
      serverEvents: {
        showJoinLeave: false,
        showChannelCreation: true,
        onlyImportantServers: true
      },
      unreadMessages: {
        enabled: true,
        batchingEnabled: true,
        updateInterval: 60000, // 1 minute
        thresholdForNotification: 5
      },
      privacy: {
        hideMessageContent: false,
        hideUsernames: false,
        hideServerNames: false,
        sanitizeContent: true
      },
      filtering: {
        mutedServers: [],
        mutedChannels: [],
        mutedUsers: [],
        botMessagesEnabled: false,
        spamFilterEnabled: true
      }
    };
  }

  /**
   * Setup periodic cleanup
   */
  private setupPeriodicCleanup(): void {
    const cleanupInterval = setInterval(() => {
      try {
        this.cleanupUnreadTracking();
        
        // Clear old pending notifications if batch timer is stuck
        if (!this.batchTimer && this.pendingNotifications.size > 0) {
          this.processBatchedNotifications();
        }
      } catch (error) {
        this.logger.warn('Multi-chat notification cleanup failed', { error });
      }
    }, 300000); // Run every 5 minutes

    this.disposables.push(new vscode.Disposable(() => {
      clearInterval(cleanupInterval);
    }));
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    this.disposables.forEach(d => d.dispose());
    this.disposables.length = 0;
    
    this.connectedServers.clear();
    this.userPresence.clear();
    this.unreadMessages.clear();
    this.mentionKeywords.clear();
    this.pendingNotifications.clear();
    this.lastNotificationTimes.clear();
    
    this.initialized = false;
    MultiChatNotificationManager.instance = undefined as any;
    
    this.logger.info('MultiChatNotificationManager disposed');
  }
}