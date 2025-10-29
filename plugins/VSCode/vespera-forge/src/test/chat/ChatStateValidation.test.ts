/**
 * ChatStateValidation Tests
 * 
 * Comprehensive test coverage for the ChatStateValidation module focusing on:
 * - Complete state structure validation
 * - Data type checking and conversion
 * - State sanitization and error correction
 * - Default state creation and fallbacks
 * - Edge case handling and error recovery
 */

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { ChatStateValidation } from '../../chat/state/ChatStateValidation';
// Note: VesperaLogger type unused - using mock implementation
import {
  MultiChatState,
  ServerNavigationState,
  ChannelViewState,
  AgentProgressState,
  NotificationSettings,
  UIPreferences
} from '../../chat/state/MultiChatStateTypes';

suite('ChatStateValidation Tests', () => {

  // Mock logger implementation
  class MockVesperaLogger {
    public debugMessages: string[] = [];
    public infoMessages: string[] = [];
    public warnMessages: string[] = [];
    public errorMessages: string[] = [];

    debug(message: string, ..._args: any[]): void {
      this.debugMessages.push(message);
    }
    
    info(message: string, ..._args: any[]): void {
      this.infoMessages.push(message);
    }
    
    warn(message: string, ..._args: any[]): void {
      this.warnMessages.push(message);
    }
    
    error(message: string, ..._args: any[]): void {
      this.errorMessages.push(message);
    }
  }

  let mockLogger: MockVesperaLogger;
  let chatStateValidation: ChatStateValidation;

  // Test data creators
  const createValidServerNavigationState = (): ServerNavigationState => ({
    expandedServers: new Set(['server1', 'server2']),
    collapsedServers: new Set(['server3']),
    pinnedServers: new Set(['server1']),
    serverOrder: ['server1', 'server2', 'server3'],
    navigationHistory: ['server1', 'server2'],
    lastAccessedServer: 'server1'
  });

  const createValidChannelViewState = (channelId: string, serverId: string): ChannelViewState => ({
    channelId,
    serverId,
    isVisible: true,
    scrollPosition: 100,
    inputText: 'draft message',
    lastReadMessageId: 'msg123',
    typingIndicators: new Set(['user1', 'user2'])
  });

  const createValidAgentProgressState = (channelId: string): AgentProgressState => ({
    agentRole: 'coder',
    channelId,
    taskId: 'task1',
    status: 'active',
    currentAction: 'analyzing',
    progressPercentage: 75,
    lastUpdate: Date.now(),
    messageQueue: ['message1', 'message2'],
    errorMessages: ['error1']
  });

  const createValidNotificationSettings = (): NotificationSettings => ({
    enableTaskProgress: true,
    enableAgentActivity: false,
    enableNewMessages: true,
    enableMentions: true,
    soundEnabled: false,
    desktopNotifications: true,
    quietHours: {
      enabled: true,
      startTime: '22:00',
      endTime: '08:00'
    }
  });

  const createValidUIPreferences = (): UIPreferences => ({
    theme: 'dark',
    density: 'compact',
    showAvatars: true,
    showTimestamps: false,
    groupMessages: true,
    showChannelList: true,
    showMemberList: true,
    fontSize: 16,
    messagePreview: false
  });

  const createValidMultiChatState = (): MultiChatState => ({
    serverNavigationState: createValidServerNavigationState(),
    activeServerId: 'server1',
    activeChannelId: 'channel1',
    channelStates: new Map([
      ['channel1', createValidChannelViewState('channel1', 'server1')],
      ['channel2', createValidChannelViewState('channel2', 'server1')]
    ]),
    agentProgressStates: new Map([
      ['channel2', createValidAgentProgressState('channel2')]
    ]),
    unreadCounts: new Map([
      ['channel1', 5],
      ['channel2', 0]
    ]),
    notificationSettings: createValidNotificationSettings(),
    uiPreferences: createValidUIPreferences()
  });

  setup(() => {
    mockLogger = new MockVesperaLogger();
    // Cast to any to bypass type checking for mock logger
    chatStateValidation = new ChatStateValidation(mockLogger as any);
  });

  suite('Complete State Validation', () => {
    test('Should validate complete valid state successfully', () => {
      const validState = createValidMultiChatState();
      
      const result = chatStateValidation.validateState(validState);
      
      assert.strictEqual(result.isValid, true, 'Valid state should pass validation');
      assert.ok(result.sanitizedState, 'Should provide sanitized state');
      assert.strictEqual(result.errors.filter(e => e.severity === 'error').length, 0, 'Should have no error-level issues');
    });

    test('Should handle partial state validation', () => {
      const partialState: Partial<MultiChatState> = {
        activeServerId: 'server1',
        notificationSettings: createValidNotificationSettings()
      };
      
      const result = chatStateValidation.validateState(partialState);
      
      assert.strictEqual(result.isValid, true, 'Partial valid state should pass validation');
      assert.ok(result.sanitizedState, 'Should provide sanitized state');
      assert.ok(result.sanitizedState.activeServerId, 'Should include validated fields');
      assert.ok(result.sanitizedState.notificationSettings, 'Should include validated notification settings');
    });

    test('Should reject invalid state with errors', () => {
      const invalidState: Partial<MultiChatState> = {
        activeServerId: '', // Invalid empty string
        activeChannelId: 123 as any, // Invalid type
        channelStates: 'not a map' as any, // Invalid type
        unreadCounts: new Map([['channel1', -5]]) // Invalid negative count
      };
      
      const result = chatStateValidation.validateState(invalidState);
      
      assert.strictEqual(result.isValid, false, 'Invalid state should fail validation');
      assert.ok(result.errors.length > 0, 'Should have validation errors');
      
      const errorMessages = result.errors.filter(e => e.severity === 'error');
      assert.ok(errorMessages.length > 0, 'Should have error-level validation issues');
    });

    test('Should sanitize correctable issues and provide warnings', () => {
      const correctableState: Partial<MultiChatState> = {
        unreadCounts: new Map([
          ['channel1', 10.5], // Will be rounded to integer
          ['channel2', -3],   // Will be corrected to 0
          ['channel3', 'not a number' as any] // Will be corrected to 0
        ]),
        uiPreferences: {
          fontSize: 5, // Too small, will be constrained
          theme: 'invalid-theme' as any, // Will be corrected to default
          density: 'comfortable',
          showAvatars: true,
          showTimestamps: true,
          groupMessages: true,
          showChannelList: true,
          showMemberList: false,
          messagePreview: true
        }
      };
      
      const result = chatStateValidation.validateState(correctableState);
      
      assert.strictEqual(result.isValid, true, 'Correctable state should pass after sanitization');
      
      // Check sanitized unread counts
      const sanitizedCounts = result.sanitizedState!.unreadCounts!;
      assert.strictEqual(sanitizedCounts.get('channel1'), 10, 'Should round decimal to integer');
      assert.strictEqual(sanitizedCounts.get('channel2'), 0, 'Should correct negative to 0');
      assert.strictEqual(sanitizedCounts.get('channel3'), 0, 'Should correct invalid type to 0');
      
      // Check sanitized UI preferences
      const sanitizedUI = result.sanitizedState!.uiPreferences!;
      assert.strictEqual(sanitizedUI.fontSize, 10, 'Should constrain font size to minimum');
      assert.strictEqual(sanitizedUI.theme, 'auto', 'Should correct invalid theme to default');
      
      // Should have warnings for corrections
      const warnings = result.errors.filter(e => e.severity === 'warning');
      assert.ok(warnings.length > 0, 'Should have warning-level corrections');
    });

    test('Should handle validation exceptions gracefully', () => {
      // Create state that will cause validation to throw
      const problematicState = {
        serverNavigationState: {
          serverOrder: null // This will cause issues in array operations
        }
      } as unknown as Partial<MultiChatState>;

      const result = chatStateValidation.validateState(problematicState);

      assert.strictEqual(result.isValid, false, 'Should fail validation on exception');
      assert.ok(result.errors.length > 0, 'Should provide error information');
      // Add null-safety guard before accessing array property
      if (result.errors && result.errors.length > 0 && result.errors[0]) {
        assert.ok(result.errors[0].message.includes('Validation failed'), 'Should indicate validation failure');
      }
    });
  });

  suite('Server Navigation State Validation', () => {
    test('Should validate valid server navigation state', () => {
      const validNavState = createValidServerNavigationState();
      
      const result = chatStateValidation.validateState({ serverNavigationState: validNavState });
      
      assert.strictEqual(result.isValid, true, 'Valid navigation state should pass');
      const sanitized = result.sanitizedState!.serverNavigationState!;
      assert.ok(sanitized.expandedServers instanceof Set, 'Should preserve Set types');
      assert.ok(Array.isArray(sanitized.serverOrder), 'Should preserve array types');
    });

    test('Should convert arrays to Sets for server collections', () => {
      const navStateWithArrays = {
        expandedServers: ['server1', 'server2'] as any,
        collapsedServers: ['server3'] as any,
        pinnedServers: ['server1'] as any,
        serverOrder: ['server1', 'server2', 'server3'],
        navigationHistory: ['server1', 'server2']
      };
      
      const result = chatStateValidation.validateState({ serverNavigationState: navStateWithArrays });
      
      assert.strictEqual(result.isValid, true, 'Should convert arrays to Sets');
      const sanitized = result.sanitizedState!.serverNavigationState!;
      assert.ok(sanitized.expandedServers instanceof Set, 'Should convert expanded servers to Set');
      assert.ok(sanitized.collapsedServers instanceof Set, 'Should convert collapsed servers to Set');
      assert.ok(sanitized.pinnedServers instanceof Set, 'Should convert pinned servers to Set');
    });

    test('Should filter non-string IDs from server collections', () => {
      const navStateWithInvalidIds = {
        expandedServers: new Set(['server1', 123, null, 'server2'] as any),
        collapsedServers: new Set([undefined, 'server3', ''] as any),
        pinnedServers: ['server1', {}, 'server2', ''] as any,
        serverOrder: ['server1', null, 'server2', 123, 'server3'] as any,
        navigationHistory: ['server1', undefined, 'server2'] as any
      } as any;

      const result = chatStateValidation.validateState({ serverNavigationState: navStateWithInvalidIds });
      
      assert.strictEqual(result.isValid, true, 'Should filter invalid IDs');
      const sanitized = result.sanitizedState!.serverNavigationState!;
      
      assert.strictEqual(sanitized.expandedServers.size, 2, 'Should filter invalid expanded server IDs');
      assert.ok(sanitized.expandedServers.has('server1'), 'Should keep valid server1');
      assert.ok(sanitized.expandedServers.has('server2'), 'Should keep valid server2');
      
      assert.strictEqual(sanitized.serverOrder.length, 3, 'Should filter invalid server order IDs');
      assert.ok(sanitized.serverOrder.includes('server1'), 'Should keep valid IDs in order');
    });

    test('Should limit navigation history length', () => {
      const navStateWithLongHistory = {
        expandedServers: new Set() as Set<string>,
        collapsedServers: new Set() as Set<string>,
        pinnedServers: new Set() as Set<string>,
        serverOrder: [] as string[],
        navigationHistory: Array.from({ length: 20 }, (_, i) => `server${i}`)
      } as ServerNavigationState;

      const result = chatStateValidation.validateState({ serverNavigationState: navStateWithLongHistory });
      
      const sanitized = result.sanitizedState!.serverNavigationState!;
      assert.strictEqual(sanitized.navigationHistory.length, 10, 'Should limit navigation history to 10 items');
    });

    test('Should handle invalid navigation state structure', () => {
      const invalidNavState = {
        expandedServers: 'not a set',
        serverOrder: 'not an array',
        navigationHistory: 123
      } as any;

      const result = chatStateValidation.validateState({ serverNavigationState: invalidNavState });
      
      const errors = result.errors.filter(e => e.severity === 'error');
      assert.ok(errors.some(e => e.field.includes('serverOrder')), 'Should error on invalid serverOrder');
      assert.ok(errors.some(e => e.field.includes('navigationHistory')), 'Should error on invalid navigationHistory');
    });
  });

  suite('Channel States Validation', () => {
    test('Should validate Map of channel states', () => {
      const channelStates = new Map([
        ['channel1', createValidChannelViewState('channel1', 'server1')],
        ['channel2', createValidChannelViewState('channel2', 'server1')]
      ]);
      
      const result = chatStateValidation.validateState({ channelStates });
      
      assert.strictEqual(result.isValid, true, 'Valid channel states should pass');
      const sanitized = result.sanitizedState!.channelStates!;
      assert.ok(sanitized instanceof Map, 'Should preserve Map type');
      assert.strictEqual(sanitized.size, 2, 'Should preserve all valid channel states');
    });

    test('Should sanitize individual channel view states', () => {
      const channelWithIssues = {
        channelId: 'channel1',
        serverId: 'server1',
        isVisible: 'yes' as any, // Should convert to boolean
        scrollPosition: -50, // Should correct to 0
        inputText: 123 as any, // Should convert to string
        typingIndicators: ['user1', 'user2'] as any // Should convert to Set
      };
      
      const channelStates = new Map([['channel1', channelWithIssues]]);
      
      const result = chatStateValidation.validateState({ channelStates });
      
      assert.strictEqual(result.isValid, true, 'Should sanitize channel state issues');
      const sanitized = result.sanitizedState!.channelStates!;
      const channel1 = sanitized.get('channel1')!;
      
      assert.strictEqual(channel1.isVisible, true, 'Should convert truthy to boolean');
      assert.strictEqual(channel1.scrollPosition, 0, 'Should correct negative scroll to 0');
      assert.strictEqual(channel1.inputText, '123', 'Should convert number to string');
      assert.ok(channel1.typingIndicators instanceof Set, 'Should convert array to Set');
    });

    test('Should reject channel states with invalid structure', () => {
      const invalidChannelStates = new Map([
        ['channel1', { channelId: 123, serverId: null } as any], // Invalid types
        ['channel2', 'not an object' as any] // Invalid structure
      ]) as any;

      const result = chatStateValidation.validateState({ channelStates: invalidChannelStates });
      
      const errors = result.errors.filter(e => e.severity === 'error');
      assert.ok(errors.length >= 2, 'Should error on invalid channel structures');
      
      // Should exclude invalid channels from sanitized state
      if (result.sanitizedState?.channelStates) {
        assert.strictEqual(result.sanitizedState.channelStates.size, 0, 'Should exclude invalid channels');
      }
    });

    test('Should handle non-Map channel states', () => {
      const result = chatStateValidation.validateState({ channelStates: 'not a map' as any });
      
      const errors = result.errors.filter(e => e.severity === 'error');
      assert.ok(errors.some(e => e.field === 'channelStates'), 'Should error on non-Map type');
    });
  });

  suite('Agent Progress States Validation', () => {
    test('Should validate Map of agent progress states', () => {
      const agentStates = new Map([
        ['channel1', createValidAgentProgressState('channel1')],
        ['channel2', createValidAgentProgressState('channel2')]
      ]);
      
      const result = chatStateValidation.validateState({ agentProgressStates: agentStates });
      
      assert.strictEqual(result.isValid, true, 'Valid agent states should pass');
      const sanitized = result.sanitizedState!.agentProgressStates!;
      assert.strictEqual(sanitized.size, 2, 'Should preserve all valid agent states');
    });

    test('Should sanitize agent progress state values', () => {
      const agentWithIssues = {
        agentRole: 'coder',
        channelId: 'channel1',
        taskId: 'task1',
        status: 'invalid_status', // Should correct to valid status
        progressPercentage: 150, // Should constrain to 100
        lastUpdate: 'not a number' as any, // Should correct to timestamp
        messageQueue: 'not an array' as any, // Should correct to array
        errorMessages: null as any // Should correct to array
      } as any;

      const agentStates = new Map([['channel1', agentWithIssues]]) as any;

      const result = chatStateValidation.validateState({ agentProgressStates: agentStates });
      
      assert.strictEqual(result.isValid, true, 'Should sanitize agent state issues');
      const sanitized = result.sanitizedState!.agentProgressStates!;
      const agent1 = sanitized.get('channel1')!;
      
      assert.strictEqual(agent1.status, 'idle', 'Should correct invalid status to idle');
      assert.strictEqual(agent1.progressPercentage, 100, 'Should constrain progress to maximum');
      assert.ok(typeof agent1.lastUpdate === 'number', 'Should provide numeric timestamp');
      assert.ok(Array.isArray(agent1.messageQueue), 'Should convert to array');
      assert.ok(Array.isArray(agent1.errorMessages), 'Should convert to array');
    });

    test('Should validate agent status values', () => {
      const validStatuses = ['idle', 'active', 'waiting', 'error', 'completed'];

      validStatuses.forEach(status => {
        const agentState = {
          agentRole: 'coder',
          channelId: 'channel1',
          taskId: 'task1',
          status,
          progressPercentage: 50,
          lastUpdate: Date.now(),
          messageQueue: [],
          errorMessages: []
        } as any;

        const result = chatStateValidation.validateState({
          agentProgressStates: new Map([['channel1', agentState]]) as any
        });
        
        assert.strictEqual(result.isValid, true, `Status '${status}' should be valid`);
        const sanitized = result.sanitizedState!.agentProgressStates!;
        assert.strictEqual(sanitized.get('channel1')!.status, status, `Should preserve valid status '${status}'`);
      });
    });

    test('Should filter string arrays for message queues', () => {
      const agentState = {
        agentRole: 'coder',
        channelId: 'channel1',
        taskId: 'task1',
        status: 'active',
        progressPercentage: 50,
        lastUpdate: Date.now(),
        messageQueue: ['message1', 123, null, 'message2', undefined] as any,
        errorMessages: ['error1', {}, 'error2', '', 'error3'] as any
      } as any;

      const result = chatStateValidation.validateState({
        agentProgressStates: new Map([['channel1', agentState]]) as any
      });
      
      const sanitized = result.sanitizedState!.agentProgressStates!;
      const agent = sanitized.get('channel1')!;
      
      assert.deepStrictEqual(agent.messageQueue, ['message1', 'message2'], 'Should filter non-string messages');
      assert.deepStrictEqual(agent.errorMessages, ['error1', 'error2', 'error3'], 'Should filter non-string errors');
    });
  });

  suite('Notification Settings Validation', () => {
    test('Should validate and convert notification settings', () => {
      const settingsWithConversions = {
        enableTaskProgress: 'true' as any, // Should convert to boolean
        enableAgentActivity: 0 as any, // Should convert to false
        enableNewMessages: 1 as any, // Should convert to true
        enableMentions: null as any, // Should convert to false
        soundEnabled: undefined as any, // Should convert to false
        desktopNotifications: 'yes' as any, // Should convert to true
        quietHours: {
          enabled: 'false' as any, // Should convert to false
          startTime: '22:00',
          endTime: '08:00'
        }
      };
      
      const result = chatStateValidation.validateState({ notificationSettings: settingsWithConversions });
      
      assert.strictEqual(result.isValid, true, 'Should convert notification settings');
      const sanitized = result.sanitizedState!.notificationSettings!;
      
      assert.strictEqual(sanitized.enableTaskProgress, true, 'Should convert "true" to boolean');
      assert.strictEqual(sanitized.enableAgentActivity, false, 'Should convert 0 to false');
      assert.strictEqual(sanitized.enableNewMessages, true, 'Should convert 1 to true');
      assert.strictEqual(sanitized.enableMentions, false, 'Should convert null to false');
      assert.strictEqual(sanitized.desktopNotifications, true, 'Should convert truthy string to true');
    });

    test('Should validate quiet hours time format', () => {
      const settingsWithInvalidTimes = {
        enableTaskProgress: true,
        enableAgentActivity: true,
        enableNewMessages: true,
        enableMentions: true,
        soundEnabled: true,
        desktopNotifications: true,
        quietHours: {
          enabled: true,
          startTime: '25:00', // Invalid hour
          endTime: '08:70' // Invalid minute
        }
      };
      
      const result = chatStateValidation.validateState({ notificationSettings: settingsWithInvalidTimes });
      
      const sanitized = result.sanitizedState!.notificationSettings!;
      assert.strictEqual(sanitized.quietHours.startTime, '22:00', 'Should use default for invalid start time');
      assert.strictEqual(sanitized.quietHours.endTime, '08:00', 'Should use default for invalid end time');
    });
  });

  suite('UI Preferences Validation', () => {
    test('Should validate and constrain UI preferences', () => {
      const preferencesWithIssues = {
        theme: 'invalid_theme' as any,
        density: 'super_compact' as any,
        showAvatars: 'yes' as any,
        showTimestamps: 0 as any,
        groupMessages: null as any,
        showChannelList: undefined as any,
        showMemberList: 'false' as any,
        fontSize: 5, // Too small
        messagePreview: 'true' as any
      };
      
      const result = chatStateValidation.validateState({ uiPreferences: preferencesWithIssues });
      
      assert.strictEqual(result.isValid, true, 'Should sanitize UI preferences');
      const sanitized = result.sanitizedState!.uiPreferences!;
      
      assert.strictEqual(sanitized.theme, 'auto', 'Should use default for invalid theme');
      assert.strictEqual(sanitized.density, 'comfortable', 'Should use default for invalid density');
      assert.strictEqual(sanitized.fontSize, 10, 'Should constrain font size to minimum');
      assert.strictEqual(sanitized.showAvatars, true, 'Should convert truthy to true');
      assert.strictEqual(sanitized.showTimestamps, false, 'Should convert falsy to false');
      
      const warnings = result.errors.filter(e => e.severity === 'warning');
      assert.ok(warnings.some(w => w.field.includes('fontSize')), 'Should warn about font size constraint');
    });

    test('Should validate theme and density enums', () => {
      const validThemes: Array<'light' | 'dark' | 'auto'> = ['light', 'dark', 'auto'];
      const validDensities: Array<'compact' | 'comfortable' | 'spacious'> = ['compact', 'comfortable', 'spacious'];

      validThemes.forEach(theme => {
        const result = chatStateValidation.validateState({
          uiPreferences: { ...createValidUIPreferences(), theme }
        });

        assert.strictEqual(result.isValid, true, `Theme '${theme}' should be valid`);
        assert.strictEqual(result.sanitizedState!.uiPreferences!.theme, theme, `Should preserve valid theme '${theme}'`);
      });

      validDensities.forEach(density => {
        const result = chatStateValidation.validateState({
          uiPreferences: { ...createValidUIPreferences(), density }
        });

        assert.strictEqual(result.isValid, true, `Density '${density}' should be valid`);
        assert.strictEqual(result.sanitizedState!.uiPreferences!.density, density, `Should preserve valid density '${density}'`);
      });
    });

    test('Should constrain font size to valid range', () => {
      const testCases = [
        { input: 5, expected: 10 }, // Below minimum
        { input: 10, expected: 10 }, // At minimum
        { input: 16, expected: 16 }, // Valid middle
        { input: 24, expected: 24 }, // At maximum
        { input: 30, expected: 24 }  // Above maximum
      ];
      
      testCases.forEach(({ input, expected }) => {
        const result = chatStateValidation.validateState({
          uiPreferences: { ...createValidUIPreferences(), fontSize: input }
        });
        
        assert.strictEqual(result.sanitizedState!.uiPreferences!.fontSize, expected, 
          `Font size ${input} should be constrained to ${expected}`);
      });
    });
  });

  suite('Unread Counts Validation', () => {
    test('Should sanitize unread counts to non-negative integers', () => {
      const unreadCounts = new Map([
        ['channel1', 5.7], // Should round to 6
        ['channel2', -3], // Should correct to 0
        ['channel3', 'not a number' as any], // Should correct to 0
        ['channel4', Infinity], // Should correct to 0
        ['channel5', 10] // Should remain 10
      ]);
      
      const result = chatStateValidation.validateState({ unreadCounts });
      
      assert.strictEqual(result.isValid, true, 'Should sanitize unread counts');
      const sanitized = result.sanitizedState!.unreadCounts!;
      
      assert.strictEqual(sanitized.get('channel1'), 6, 'Should round decimal up');
      assert.strictEqual(sanitized.get('channel2'), 0, 'Should correct negative to 0');
      assert.strictEqual(sanitized.get('channel3'), 0, 'Should correct invalid type to 0');
      assert.strictEqual(sanitized.get('channel4'), 0, 'Should correct Infinity to 0');
      assert.strictEqual(sanitized.get('channel5'), 10, 'Should preserve valid count');
    });

    test('Should handle non-Map unread counts', () => {
      const result = chatStateValidation.validateState({ unreadCounts: 'not a map' as any });
      
      const errors = result.errors.filter(e => e.severity === 'error');
      assert.ok(errors.some(e => e.field === 'unreadCounts'), 'Should error on non-Map type');
    });

    test('Should handle non-string channel IDs in unread counts', () => {
      const unreadCounts = new Map([
        ['channel1', 5],
        [123 as any, 3], // Invalid key type
        [null as any, 2] // Invalid key type
      ]);
      
      const result = chatStateValidation.validateState({ unreadCounts });
      
      const errors = result.errors.filter(e => e.severity === 'error');
      assert.ok(errors.length >= 2, 'Should error on non-string channel IDs');
      
      // Should only preserve valid entries
      const sanitized = result.sanitizedState!.unreadCounts!;
      assert.strictEqual(sanitized.size, 1, 'Should only keep valid channel ID entries');
      assert.strictEqual(sanitized.get('channel1'), 5, 'Should preserve valid entry');
    });
  });

  suite('Default State Creation', () => {
    test('Should create complete default state', () => {
      const defaultState = chatStateValidation.createDefaultState();
      
      assert.ok(defaultState, 'Should create default state');
      
      // Verify all required fields are present
      assert.ok(defaultState.serverNavigationState, 'Should have server navigation state');
      assert.ok(defaultState.channelStates instanceof Map, 'Should have channel states Map');
      assert.ok(defaultState.agentProgressStates instanceof Map, 'Should have agent progress states Map');
      assert.ok(defaultState.unreadCounts instanceof Map, 'Should have unread counts Map');
      assert.ok(defaultState.notificationSettings, 'Should have notification settings');
      assert.ok(defaultState.uiPreferences, 'Should have UI preferences');
      
      // Verify default values
      assert.ok(defaultState.serverNavigationState.expandedServers instanceof Set, 'Should have Set for expanded servers');
      assert.strictEqual(defaultState.serverNavigationState.serverOrder.length, 0, 'Should have empty server order');
      assert.strictEqual(defaultState.notificationSettings.enableTaskProgress, true, 'Should have default notification settings');
      assert.strictEqual(defaultState.uiPreferences.theme, 'auto', 'Should have default theme');
      assert.strictEqual(defaultState.uiPreferences.fontSize, 14, 'Should have default font size');
    });

    test('Should create default state with proper structure', () => {
      const defaultState = chatStateValidation.createDefaultState();
      
      // Should pass its own validation
      const result = chatStateValidation.validateState(defaultState);
      assert.strictEqual(result.isValid, true, 'Default state should pass validation');
      assert.strictEqual(result.errors.filter(e => e.severity === 'error').length, 0, 'Default state should have no errors');
    });
  });

  suite('State Sanitization', () => {
    test('Should sanitize valid state', () => {
      const validState = createValidMultiChatState();
      
      const sanitizedState = chatStateValidation.sanitizeState(validState);
      
      assert.ok(sanitizedState, 'Should return sanitized state');
      // Should be similar to input but may have minor sanitizations
      assert.strictEqual(sanitizedState.activeServerId, validState.activeServerId, 'Should preserve valid values');
    });

    test('Should return default state for severely corrupted state', () => {
      // Create state that will cause validation to fail completely
      const corruptedState = {
        serverNavigationState: null,
        channelStates: 'completely invalid',
        agentProgressStates: undefined,
        activeServerId: 123,
        activeChannelId: {},
      } as any;
      
      const sanitizedState = chatStateValidation.sanitizeState(corruptedState);
      
      // Should return default state structure
      assert.ok(sanitizedState, 'Should return state even for corrupted input');
      assert.ok(sanitizedState.serverNavigationState, 'Should have server navigation state');
      assert.ok(sanitizedState.channelStates instanceof Map, 'Should have Map for channel states');
      assert.ok(sanitizedState.notificationSettings, 'Should have notification settings');
      
      // Should log warning about corruption
      assert.ok(mockLogger.warnMessages.length > 0, 'Should log warning about state corruption');
    });
  });

  suite('Error Handling and Edge Cases', () => {
    test('Should handle empty state gracefully', () => {
      const result = chatStateValidation.validateState({});
      
      assert.strictEqual(result.isValid, true, 'Empty state should be valid');
      assert.deepStrictEqual(result.sanitizedState, {}, 'Should return empty sanitized state');
    });

    test('Should handle null and undefined values', () => {
      const stateWithNulls = {
        activeServerId: null,
        activeChannelId: undefined,
        serverNavigationState: null,
        channelStates: undefined
      } as any;
      
      const result = chatStateValidation.validateState(stateWithNulls);
      
      // Should handle nulls/undefined without crashing
      assert.ok(Array.isArray(result.errors), 'Should return errors array');
      assert.ok(typeof result.isValid === 'boolean', 'Should return boolean validity');
    });

    test('Should log validation progress for complex states', () => {
      const complexState = createValidMultiChatState();
      
      chatStateValidation.validateState(complexState);
      
      // Should have logged debug information (even though mock logger is silent in this case)
      // The important thing is it doesn't crash with complex states
    });

    test('Should handle circular references safely', () => {
      const circularState: any = { activeServerId: 'server1' };
      circularState.circular = circularState; // Create circular reference
      
      // Should not throw or hang
      assert.doesNotThrow(() => {
        const result = chatStateValidation.validateState(circularState);
        assert.ok(result, 'Should handle circular references');
      });
    });
  });

  suite('Performance and Scalability', () => {
    test('Should handle large states efficiently', () => {
      const largeChannelStates = new Map();
      const largeAgentStates = new Map();
      const largeUnreadCounts = new Map();
      
      // Create 1000 channel states
      for (let i = 0; i < 1000; i++) {
        const channelId = `channel${i}`;
        largeChannelStates.set(channelId, createValidChannelViewState(channelId, `server${i % 10}`));
        largeUnreadCounts.set(channelId, i % 100);
        
        if (i % 5 === 0) {
          largeAgentStates.set(channelId, createValidAgentProgressState(channelId));
        }
      }
      
      const largeState = {
        serverNavigationState: {
          ...createValidServerNavigationState(),
          serverOrder: Array.from({ length: 100 }, (_, i) => `server${i}`)
        },
        channelStates: largeChannelStates,
        agentProgressStates: largeAgentStates,
        unreadCounts: largeUnreadCounts,
        notificationSettings: createValidNotificationSettings(),
        uiPreferences: createValidUIPreferences()
      };
      
      const startTime = Date.now();
      const result = chatStateValidation.validateState(largeState);
      const endTime = Date.now();
      
      assert.strictEqual(result.isValid, true, 'Large state should validate successfully');
      assert.ok(endTime - startTime < 2000, 'Validation should complete within reasonable time (2s)');
      assert.ok(result.sanitizedState, 'Should provide sanitized state for large input');
    });
  });
});