/**
 * Multi-Chat State Type Definitions
 * 
 * Centralizes all type definitions for the multi-chat state management system.
 * This provides a single source of truth for all interfaces and types used
 * across the state management modules.
 */

// State management interfaces
export interface MultiChatState {
  activeServerId?: string;
  activeChannelId?: string;
  serverNavigationState: ServerNavigationState;
  channelStates: Map<string, ChannelViewState>;
  agentProgressStates: Map<string, AgentProgressState>;
  unreadCounts: Map<string, number>;
  notificationSettings: NotificationSettings;
  uiPreferences: UIPreferences;
}

export interface ServerNavigationState {
  expandedServers: Set<string>;
  collapsedServers: Set<string>;
  pinnedServers: Set<string>;
  serverOrder: string[];
  lastAccessedServer?: string;
  navigationHistory: string[];
}

export interface ChannelViewState {
  channelId: string;
  serverId: string;
  isVisible: boolean;
  scrollPosition: number;
  inputText: string;
  mentionState?: MentionState;
  lastReadMessageId?: string;
  typingIndicators: Set<string>;
}

export interface AgentProgressState {
  agentRole: string;
  channelId: string;
  taskId: string;
  status: 'idle' | 'active' | 'waiting' | 'error' | 'completed';
  currentAction?: string;
  progressPercentage: number;
  lastUpdate: number;
  messageQueue: string[];
  errorMessages: string[];
}

export interface MentionState {
  mentionSuggestions: string[];
  activeMention?: string;
  mentionPosition: number;
}

export interface NotificationSettings {
  enableTaskProgress: boolean;
  enableAgentActivity: boolean;
  enableNewMessages: boolean;
  enableMentions: boolean;
  soundEnabled: boolean;
  desktopNotifications: boolean;
  quietHours: QuietHoursConfig;
}

export interface QuietHoursConfig {
  enabled: boolean;
  startTime: string; // HH:MM format
  endTime: string;   // HH:MM format
}

export interface UIPreferences {
  theme: 'light' | 'dark' | 'auto';
  density: 'compact' | 'comfortable' | 'spacious';
  showAvatars: boolean;
  showTimestamps: boolean;
  groupMessages: boolean;
  showChannelList: boolean;
  showMemberList: boolean;
  fontSize: number;
  messagePreview: boolean;
}

export interface StateChangeEvent {
  type: 'serverAdded' | 'serverRemoved' | 'channelAdded' | 'channelRemoved' | 
        'serverActivated' | 'channelActivated' | 'agentProgressUpdated' | 
        'messageReceived' | 'preferencesUpdated';
  serverId?: string;
  channelId?: string;
  data?: any;
}

// Validation interfaces
export interface StateValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface StateValidationResult {
  isValid: boolean;
  errors: StateValidationError[];
  sanitizedState?: Partial<MultiChatState>;
}

// Event handler interfaces
export interface TaskServerEvent {
  type: string;
  taskId: string;
  serverId?: string;
  data?: any;
}

export interface AgentUpdate {
  channelId: string;
  status: AgentProgressState['status'];
  currentAction?: string;
  progress?: number;
}