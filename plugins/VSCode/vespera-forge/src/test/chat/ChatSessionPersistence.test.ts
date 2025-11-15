/**
 * ChatSessionPersistence Tests
 * 
 * Comprehensive test coverage for the ChatSessionPersistence module focusing on:
 * - Session state restoration and initialization
 * - Periodic state saving mechanisms
 * - Server and channel state management
 * - User preference persistence
 * - Archive cleanup operations
 * - Error handling and resource management
 */

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { ChatSessionPersistence } from '../../chat/state/ChatSessionPersistence';
// Note: VesperaLogger type unused - using mock implementation
import {
  // SecureSessionPersistenceManager unused - using mock implementation
  ServerState,
  ChannelState
} from '../../chat/persistence/SecureSessionPersistenceManager';
import {
  MultiChatState
} from '../../chat/state/MultiChatStateTypes';

suite('ChatSessionPersistence Tests', () => {

  // Mock implementations
  class MockVesperaLogger {
    debug(_message: string, ..._args: any[]): void {
      // Silent for tests
    }
    
    info(_message: string, ..._args: any[]): void {
      // Silent for tests
    }
    
    warn(_message: string, ..._args: any[]): void {
      // Silent for tests
    }
    
    error(_message: string, ..._args: any[]): void {
      // Silent for tests
    }
  }

  class MockSecureSessionPersistenceManager {
    private currentSession: any = null;

    getCurrentSession(): any {
      return this.currentSession;
    }

    setCurrentSession(session: any): void {
      this.currentSession = session;
    }

    async saveSession(session: any): Promise<void> {
      this.currentSession = session;
    }
  }

  // Test data setup
  const createMockSession = (options: {
    includeServers?: boolean;
    includeTaskStates?: boolean;
    includeUserPreferences?: boolean;
    activeServerId?: string;
    activeChannelId?: string;
  } = {}) => {
    const session: any = {
      servers: [],
      taskServerStates: [],
      userPreferences: {},
      activeServerId: options.activeServerId || null,
      activeChannelId: options.activeChannelId || null
    };

    if (options.includeServers) {
      session.servers = [
        {
          serverId: 'server1',
          serverName: 'Test Server 1',
          serverType: 'regular',
          createdAt: Date.now() - (1 * 24 * 60 * 60 * 1000),
          channels: [
            {
              channelId: 'channel1',
              channelName: 'General',
              channelType: 'general',
              messageCount: 0,
              lastActivity: Date.now()
            },
            {
              channelId: 'channel2',
              channelName: 'Agent Channel',
              channelType: 'agent',
              agentRole: 'coder',
              messageCount: 0,
              lastActivity: Date.now()
            }
          ],
          archived: false,
          lastActivity: Date.now()
        },
        {
          serverId: 'server2',
          serverName: 'Archived Server',
          channels: [
            {
              channelId: 'channel3',
              channelName: 'Old Channel',
              channelType: 'general',
              messageCount: 0,
              lastActivity: Date.now() - (10 * 24 * 60 * 60 * 1000)
            }
          ],
          serverType: 'regular',
          createdAt: Date.now() - (15 * 24 * 60 * 60 * 1000),
          archived: true,
          lastActivity: Date.now() - (10 * 24 * 60 * 60 * 1000) // 10 days ago
        }
      ];
    }

    if (options.includeTaskStates) {
      session.taskServerStates = [
        {
          serverId: 'server1',
          taskId: 'task1',
          status: 'active',
          agentChannels: ['channel2']
        }
      ];
    }

    if (options.includeUserPreferences) {
      session.userPreferences = {
        collapsedServers: ['server1'],
        notificationSettings: {
          taskProgress: true,
          agentActivity: false,
          newMessages: true
        }
      };
    }

    return session;
  };

  const createMockMultiChatState = (): MultiChatState => ({
    serverNavigationState: {
      expandedServers: new Set(['server1']),
      collapsedServers: new Set(),
      pinnedServers: new Set(),
      serverOrder: ['server1', 'server2'],
      navigationHistory: []
    },
    activeServerId: 'server1',
    activeChannelId: 'channel1',
    channelStates: new Map([
      ['channel1', {
        channelId: 'channel1',
        serverId: 'server1',
        isVisible: true,
        scrollPosition: 100,
        inputText: 'draft message',
        typingIndicators: new Set()
      }]
    ]),
    agentProgressStates: new Map([
      ['channel2', {
        agentRole: 'coder',
        channelId: 'channel2',
        taskId: 'task1',
        status: 'active',
        progressPercentage: 50,
        lastUpdate: Date.now(),
        messageQueue: ['message1'],
        errorMessages: []
      }]
    ]),
    unreadCounts: new Map([
      ['channel1', 5],
      ['channel2', 0]
    ]),
    notificationSettings: {
      enableTaskProgress: true,
      enableAgentActivity: true,
      enableNewMessages: true,
      enableMentions: true,
      soundEnabled: true,
      desktopNotifications: true,
      quietHours: {
        enabled: false,
        startTime: '22:00',
        endTime: '08:00'
      }
    },
    uiPreferences: {
      theme: 'auto',
      density: 'comfortable',
      showAvatars: true,
      showTimestamps: true,
      groupMessages: true,
      showChannelList: true,
      showMemberList: false,
      fontSize: 14,
      messagePreview: true
    }
  });

  let mockLogger: MockVesperaLogger;
  let mockPersistenceManager: MockSecureSessionPersistenceManager;
  let chatSessionPersistence: ChatSessionPersistence;

  setup(() => {
    mockLogger = new MockVesperaLogger();
    mockPersistenceManager = new MockSecureSessionPersistenceManager();
    // Cast to any to bypass type checking for mock manager
    chatSessionPersistence = new ChatSessionPersistence(mockPersistenceManager as any, mockLogger as any);
  });

  teardown(() => {
    chatSessionPersistence.dispose();
  });

  suite('Periodic State Saving', () => {
    test('Should setup periodic state saving with callback', (done) => {
      let callCount = 0;
      const saveCallback = async () => {
        callCount++;
        if (callCount >= 1) {
          chatSessionPersistence.dispose();
          done();
        }
      };

      // Use shorter interval for testing
      (chatSessionPersistence as any).STATE_SAVE_INTERVAL = 100;
      chatSessionPersistence.setupPeriodicStateSaving(saveCallback);
    });

    test('Should handle errors in periodic save callback', (done) => {
      const errorCallback = async () => {
        throw new Error('Save failed');
      };

      // Should not throw errors, just log them
      (chatSessionPersistence as any).STATE_SAVE_INTERVAL = 100;
      chatSessionPersistence.setupPeriodicStateSaving(errorCallback);

      setTimeout(() => {
        chatSessionPersistence.dispose();
        done();
      }, 200);
    });

    test('Should dispose periodic timer', () => {
      const saveCallback = async () => {};
      
      chatSessionPersistence.setupPeriodicStateSaving(saveCallback);
      
      // Should not throw
      assert.doesNotThrow(() => {
        chatSessionPersistence.dispose();
      });
    });
  });

  suite('State Restoration', () => {
    test('Should restore complete state from session', async () => {
      const mockSession = createMockSession({
        includeServers: true,
        includeTaskStates: true,
        includeUserPreferences: true,
        activeServerId: 'server1',
        activeChannelId: 'channel1'
      });
      mockPersistenceManager.setCurrentSession(mockSession);

      const restoredState = await chatSessionPersistence.restoreStateFromSession();

      assert.ok(restoredState, 'Should return restored state');
      assert.strictEqual(restoredState.activeServerId, 'server1', 'Should restore active server ID');
      assert.strictEqual(restoredState.activeChannelId, 'channel1', 'Should restore active channel ID');
      
      // Verify server navigation state
      assert.ok(restoredState.serverNavigationState, 'Should restore server navigation state');
      assert.ok(restoredState.serverNavigationState.collapsedServers instanceof Set, 'Collapsed servers should be a Set');
      assert.ok(restoredState.serverNavigationState.collapsedServers.has('server1'), 'Should restore collapsed servers from user preferences');
      
      // Verify notification settings
      assert.ok(restoredState.notificationSettings, 'Should restore notification settings');
      assert.strictEqual(restoredState.notificationSettings.enableTaskProgress, true, 'Should restore task progress setting');
      assert.strictEqual(restoredState.notificationSettings.enableAgentActivity, false, 'Should restore agent activity setting from preferences');
      
      // Verify channel states
      assert.ok(restoredState.channelStates instanceof Map, 'Should restore channel states as Map');
      assert.strictEqual(restoredState.channelStates.size, 3, 'Should restore all channel states'); // 2 from server1, 1 from server2
      
      // Verify unread counts
      assert.ok(restoredState.unreadCounts instanceof Map, 'Should restore unread counts as Map');
      assert.strictEqual(restoredState.unreadCounts.get('channel1'), 0, 'Should initialize unread counts to 0');
      
      // Verify agent progress states
      assert.ok(restoredState.agentProgressStates instanceof Map, 'Should restore agent progress states as Map');
      const agentState = restoredState.agentProgressStates.get('channel2');
      assert.ok(agentState, 'Should restore agent progress state for agent channel');
      assert.strictEqual(agentState.agentRole, 'coder', 'Should restore agent role');
      assert.strictEqual(agentState.taskId, 'task1', 'Should restore task ID');
    });

    test('Should return empty state when no session exists', async () => {
      mockPersistenceManager.setCurrentSession(null);

      const restoredState = await chatSessionPersistence.restoreStateFromSession();

      assert.deepStrictEqual(restoredState, {}, 'Should return empty state when no session');
    });

    test('Should handle state restoration errors', async () => {
      // Create malformed session
      const malformedSession = { servers: null };
      mockPersistenceManager.setCurrentSession(malformedSession);

      try {
        await chatSessionPersistence.restoreStateFromSession();
        assert.fail('Should throw error for malformed session');
      } catch (error) {
        assert.ok(error, 'Should throw error for restoration failure');
      }
    });

    test('Should restore default notification settings when preferences missing', async () => {
      const mockSession = createMockSession({
        includeServers: true,
        // No user preferences
      });
      mockPersistenceManager.setCurrentSession(mockSession);

      const restoredState = await chatSessionPersistence.restoreStateFromSession();

      assert.ok(restoredState.notificationSettings, 'Should have notification settings');
      assert.strictEqual(restoredState.notificationSettings.enableTaskProgress, true, 'Should use default task progress setting');
      assert.strictEqual(restoredState.notificationSettings.enableAgentActivity, true, 'Should use default agent activity setting');
      assert.strictEqual(restoredState.notificationSettings.enableNewMessages, true, 'Should use default new messages setting');
    });
  });

  suite('State Saving', () => {
    test('Should save current state to session', async () => {
      const mockSession = createMockSession({ includeServers: true });
      mockPersistenceManager.setCurrentSession(mockSession);

      const currentState = createMockMultiChatState();
      
      await chatSessionPersistence.saveCurrentState(currentState);

      const savedSession = mockPersistenceManager.getCurrentSession();
      assert.strictEqual(savedSession.activeServerId, 'server1', 'Should save active server ID');
      assert.strictEqual(savedSession.activeChannelId, 'channel1', 'Should save active channel ID');
      
      // Verify user preferences are saved
      assert.ok(savedSession.userPreferences, 'Should save user preferences');
      assert.ok(Array.isArray(savedSession.userPreferences.collapsedServers), 'Should save collapsed servers as array');
      assert.ok(savedSession.userPreferences.notificationSettings, 'Should save notification settings');
      assert.strictEqual(savedSession.userPreferences.notificationSettings.taskProgress, true, 'Should save task progress setting');
    });

    test('Should handle save when no session exists', async () => {
      mockPersistenceManager.setCurrentSession(null);

      const currentState = createMockMultiChatState();
      
      // Should not throw, should just warn and return
      await chatSessionPersistence.saveCurrentState(currentState);
      
      assert.strictEqual(mockPersistenceManager.getCurrentSession(), null, 'Should remain null when no session to save to');
    });

    test('Should handle save errors gracefully', async () => {
      const mockSession = createMockSession();
      mockPersistenceManager.setCurrentSession(mockSession);

      // Override saveSession to throw error
      mockPersistenceManager.saveSession = async () => {
        throw new Error('Save failed');
      };

      const currentState = createMockMultiChatState();
      
      try {
        await chatSessionPersistence.saveCurrentState(currentState);
        assert.fail('Should throw error when save fails');
      } catch (error) {
        assert.ok(error, 'Should propagate save errors');
      }
    });
  });

  suite('Channel State Initialization', () => {
    test('Should initialize channel states from server', () => {
      const mockServer: ServerState = {
        serverId: 'server1',
        serverName: 'Test Server',
        serverType: 'regular',
        createdAt: Date.now(),
        channels: [
          {
            channelId: 'channel1',
            channelName: 'General',
            channelType: 'general',
            messageCount: 0,
            lastActivity: Date.now()
          },
          {
            channelId: 'channel2',
            channelName: 'Random',
            channelType: 'general',
            messageCount: 0,
            lastActivity: Date.now()
          }
        ],
        archived: false,
        lastActivity: Date.now()
      };

      const channelStates = chatSessionPersistence.initializeChannelStatesFromServer(mockServer);

      assert.ok(channelStates instanceof Map, 'Should return Map of channel states');
      assert.strictEqual(channelStates.size, 2, 'Should initialize all channels');

      const channel1State = channelStates.get('channel1');
      assert.ok(channel1State, 'Should have state for channel1');
      assert.strictEqual(channel1State.channelId, 'channel1', 'Should set correct channel ID');
      assert.strictEqual(channel1State.serverId, 'server1', 'Should set correct server ID');
      assert.strictEqual(channel1State.isVisible, false, 'Should initialize as not visible');
      assert.strictEqual(channel1State.scrollPosition, 0, 'Should initialize scroll position to 0');
      assert.strictEqual(channel1State.inputText, '', 'Should initialize input text as empty');
      assert.ok(channel1State.typingIndicators instanceof Set, 'Should initialize typing indicators as Set');
    });

    test('Should handle empty server channels', () => {
      const mockServer: ServerState = {
        serverId: 'server1',
        serverName: 'Empty Server',
        serverType: 'regular',
        createdAt: Date.now(),
        channels: [],
        archived: false,
        lastActivity: Date.now()
      };

      const channelStates = chatSessionPersistence.initializeChannelStatesFromServer(mockServer);

      assert.ok(channelStates instanceof Map, 'Should return Map for empty channels');
      assert.strictEqual(channelStates.size, 0, 'Should have empty Map for no channels');
    });
  });

  suite('Agent Progress State Initialization', () => {
    test('Should initialize agent progress state for agent channels', () => {
      const mockChannel: ChannelState = {
        channelId: 'agent-channel',
        channelName: 'Agent Channel',
        channelType: 'agent',
        agentRole: 'coder',
        messageCount: 0,
        lastActivity: Date.now()
      };

      const agentState = chatSessionPersistence.initializeAgentProgressState(
        mockChannel, 
        'server1', 
        'task1'
      );

      assert.ok(agentState, 'Should return agent progress state for agent channel');
      assert.strictEqual(agentState.agentRole, 'coder', 'Should set correct agent role');
      assert.strictEqual(agentState.channelId, 'agent-channel', 'Should set correct channel ID');
      assert.strictEqual(agentState.taskId, 'task1', 'Should set correct task ID');
      assert.strictEqual(agentState.status, 'idle', 'Should initialize status as idle');
      assert.strictEqual(agentState.progressPercentage, 0, 'Should initialize progress as 0');
      assert.ok(Array.isArray(agentState.messageQueue), 'Should initialize message queue as array');
      assert.ok(Array.isArray(agentState.errorMessages), 'Should initialize error messages as array');
      assert.ok(agentState.lastUpdate > 0, 'Should set last update timestamp');
    });

    test('Should return null for non-agent channels', () => {
      const mockChannel: ChannelState = {
        channelId: 'text-channel',
        channelName: 'Text Channel',
        channelType: 'general',
        messageCount: 0,
        lastActivity: Date.now()
      };

      const agentState = chatSessionPersistence.initializeAgentProgressState(
        mockChannel, 
        'server1', 
        'task1'
      );

      assert.strictEqual(agentState, null, 'Should return null for non-agent channels');
    });

    test('Should return null for agent channels without agent role', () => {
      const mockChannel: ChannelState = {
        channelId: 'agent-channel',
        channelName: 'Agent Channel',
        channelType: 'agent',
        messageCount: 0,
        lastActivity: Date.now()
        // Missing agentRole intentionally for test
      };

      const agentState = chatSessionPersistence.initializeAgentProgressState(
        mockChannel, 
        'server1', 
        'task1'
      );

      assert.strictEqual(agentState, null, 'Should return null for agent channels without role');
    });
  });

  suite('Archive Cleanup', () => {
    test('Should cleanup archived servers older than cutoff', async () => {
      const oldTimestamp = Date.now() - (10 * 24 * 60 * 60 * 1000); // 10 days ago
      const recentTimestamp = Date.now() - (5 * 24 * 60 * 60 * 1000); // 5 days ago

      const mockSession = createMockSession({ includeServers: true });
      // Add archived servers with different timestamps
      mockSession.servers.push(
        {
          serverId: 'old-server',
          serverName: 'Old Archived Server',
          channels: [{ channelId: 'old-channel', channelName: 'Old', channelType: 'text' }],
          archived: true,
          lastActivity: oldTimestamp
        },
        {
          serverId: 'recent-server',
          serverName: 'Recent Archived Server',
          channels: [{ channelId: 'recent-channel', channelName: 'Recent', channelType: 'text' }],
          archived: true,
          lastActivity: recentTimestamp
        }
      );
      mockPersistenceManager.setCurrentSession(mockSession);

      const currentState = createMockMultiChatState();
      // Add states for servers to be cleaned
      currentState.serverNavigationState.serverOrder.push('old-server', 'recent-server');
      currentState.channelStates.set('old-channel', {
        channelId: 'old-channel',
        serverId: 'old-server',
        isVisible: false,
        scrollPosition: 0,
        inputText: '',
        typingIndicators: new Set()
      });

      const cleanedServerIds = await chatSessionPersistence.cleanupArchivedServers(currentState, 7);

      assert.ok(cleanedServerIds.includes('old-server'), 'Should cleanup servers older than 7 days');
      assert.ok(!cleanedServerIds.includes('recent-server'), 'Should not cleanup recent archived servers');
      
      // Verify state was updated
      assert.ok(!currentState.serverNavigationState.serverOrder.includes('old-server'), 'Should remove from server order');
      assert.ok(!currentState.channelStates.has('old-channel'), 'Should remove channel states');
    });

    test('Should handle cleanup when no session exists', async () => {
      mockPersistenceManager.setCurrentSession(null);

      const currentState = createMockMultiChatState();
      const cleanedServerIds = await chatSessionPersistence.cleanupArchivedServers(currentState);

      assert.deepStrictEqual(cleanedServerIds, [], 'Should return empty array when no session');
    });

    test('Should use default cutoff of 7 days', async () => {
      const mockSession = createMockSession({ includeServers: true });
      mockPersistenceManager.setCurrentSession(mockSession);

      const currentState = createMockMultiChatState();
      
      // Should not throw when no cutoff specified
      const cleanedServerIds = await chatSessionPersistence.cleanupArchivedServers(currentState);
      
      assert.ok(Array.isArray(cleanedServerIds), 'Should return array with default cutoff');
    });

    test('Should handle cleanup errors gracefully', async () => {
      const mockSession = createMockSession({ includeServers: true });
      mockPersistenceManager.setCurrentSession(mockSession);

      // Override saveCurrentState to throw error
      chatSessionPersistence.saveCurrentState = async () => {
        throw new Error('Save failed during cleanup');
      };

      const currentState = createMockMultiChatState();
      const cleanedServerIds = await chatSessionPersistence.cleanupArchivedServers(currentState);

      assert.deepStrictEqual(cleanedServerIds, [], 'Should return empty array on cleanup error');
    });
  });

  suite('Resource Management', () => {
    test('Should dispose resources properly', () => {
      const saveCallback = async () => {};
      chatSessionPersistence.setupPeriodicStateSaving(saveCallback);
      
      // Should not throw
      assert.doesNotThrow(() => {
        chatSessionPersistence.dispose();
      });
      
      // Should be safe to call multiple times
      assert.doesNotThrow(() => {
        chatSessionPersistence.dispose();
      });
    });

    test('Should handle disposal when no timer is active', () => {
      // Should not throw even if no timer was set
      assert.doesNotThrow(() => {
        chatSessionPersistence.dispose();
      });
    });
  });

  suite('Error Handling and Edge Cases', () => {
    test('Should handle malformed session data during restoration', async () => {
      const malformedSession = {
        servers: [{ invalidServer: true }],
        taskServerStates: 'not an array',
        userPreferences: null
      };
      mockPersistenceManager.setCurrentSession(malformedSession);

      try {
        await chatSessionPersistence.restoreStateFromSession();
        assert.fail('Should throw error for malformed session');
      } catch (error) {
        assert.ok(error instanceof Error, 'Should throw proper Error object');
      }
    });

    test('Should handle empty or null preference objects', async () => {
      const mockSession = createMockSession({
        includeServers: true,
        includeUserPreferences: false // No preferences
      });
      mockSession.userPreferences = null;
      mockPersistenceManager.setCurrentSession(mockSession);

      const restoredState = await chatSessionPersistence.restoreStateFromSession();

      assert.ok(restoredState.notificationSettings, 'Should provide default notification settings');
      assert.ok(restoredState.serverNavigationState, 'Should provide default navigation state');
    });

    test('Should handle large numbers of servers and channels efficiently', async () => {
      const largeSession = createMockSession();
      
      // Create many servers with many channels each
      largeSession.servers = Array.from({ length: 100 }, (_, i) => ({
        serverId: `server${i}`,
        serverName: `Server ${i}`,
        channels: Array.from({ length: 50 }, (_, j) => ({
          channelId: `channel${i}-${j}`,
          channelName: `Channel ${j}`,
          channelType: 'text'
        })),
        archived: false,
        lastActivity: Date.now()
      }));
      
      mockPersistenceManager.setCurrentSession(largeSession);

      const startTime = Date.now();
      const restoredState = await chatSessionPersistence.restoreStateFromSession();
      const endTime = Date.now();

      assert.ok(restoredState.channelStates, 'Should restore channel states for large dataset');
      assert.strictEqual(restoredState.channelStates.size, 5000, 'Should restore all 5000 channels'); // 100 servers * 50 channels
      assert.ok(endTime - startTime < 2000, 'Should complete large restoration within reasonable time (2s)');
    });
  });
});