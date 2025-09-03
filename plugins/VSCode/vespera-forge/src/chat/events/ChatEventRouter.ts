/**
 * Chat Event Router for integrating with VesperaEvents system
 */
import { ChatEvent, ChatEventType, ChatEventData } from '../types/events';
import { VesperaEvents, eventBus } from '../../utils/events';

export class ChatEventRouter {
  constructor() {
    // Use the real VesperaEvents system
  }
  
  // Emit chat events
  async emit<T extends ChatEventType>(event: ChatEvent<T>): Promise<void> {
    console.log(`[ChatEventRouter] Emitting event: ${event.type}`, event.data);
    
    // Map chat events to VesperaEvents
    await this.handleCrossSystemEvents(event);
  }
  
  // Listen for chat events via VesperaEvents
  on<T extends ChatEventType>(
    eventType: T, 
    handler: (data: ChatEventData[T]) => void | Promise<void>,
    listenerName?: string
  ): void {
    // Map chat event types to VesperaEvent types and listen through VesperaEvents
    switch (eventType) {
      case 'chatProviderConnected':
        eventBus.onEvent('chatProviderConnected', handler as any, listenerName);
        break;
      case 'chatProviderDisconnected':
        eventBus.onEvent('chatProviderDisconnected', handler as any, listenerName);
        break;
      case 'chatProviderChanged':
        eventBus.onEvent('chatProviderChanged', handler as any, listenerName);
        break;
      case 'chatConfigUpdated':
        eventBus.onEvent('chatConfigurationChanged', handler as any, listenerName);
        break;
      default:
        console.warn(`[ChatEventRouter] Unsupported event type for listening: ${eventType}`);
    }
  }
  
  // Handle events that affect other systems
  private async handleCrossSystemEvents<T extends ChatEventType>(
    event: ChatEvent<T>
  ): Promise<void> {
    switch (event.type) {
      case 'chatMessageSent':
        // Could trigger task creation or updates
        await this.handlePotentialTaskIntegration(event.data as ChatEventData['chatMessageSent']);
        break;
        
      case 'chatProviderChanged':
        // Emit through VesperaEvents system
        const changeData = event.data as ChatEventData['chatProviderChanged'];
        VesperaEvents.chatProviderChanged(changeData.from, changeData.to);
        await this.handleProviderChange(changeData);
        break;
        
      case 'chatProviderConnected':
        // Emit through VesperaEvents system
        const connectData = event.data as ChatEventData['chatProviderConnected'];
        VesperaEvents.chatProviderConnected(connectData.providerId, connectData.providerName);
        break;
        
      case 'chatProviderDisconnected':
        // Emit through VesperaEvents system
        const disconnectData = event.data as ChatEventData['chatProviderDisconnected'];
        VesperaEvents.chatProviderDisconnected(disconnectData.providerId, undefined, disconnectData.error);
        break;
        
      case 'chatConfigUpdated':
        // Emit through VesperaEvents system
        const configData = event.data as ChatEventData['chatConfigUpdated'];
        VesperaEvents.chatConfigurationChanged('provider', configData.changes);
        await this.handleConfigSync(configData);
        break;
    }
  }
  
  private async handlePotentialTaskIntegration(data: ChatEventData['chatMessageSent']): Promise<void> {
    // TODO: Implement task integration analysis
    // Analyze message content for task-related keywords
    const taskKeywords = ['create task', 'todo', 'remind me', 'schedule'];
    const containsTaskKeyword = taskKeywords.some(keyword => 
      data.content.toLowerCase().includes(keyword)
    );
    
    if (containsTaskKeyword) {
      console.log('Potential task detected in chat message:', data.content.slice(0, 50) + '...');
      
      // Emit suggestion for task creation via VesperaEvents
      VesperaEvents.taskFocused('suggested', `Potential task from chat: ${data.content.slice(0, 50)}...`);
    }
  }
  
  private async handleProviderChange(data: ChatEventData['chatProviderChanged']): Promise<void> {
    // TODO: Implement provider change handling
    console.log('Provider changed from', data.from, 'to', data.to);
  }
  
  private async handleConfigSync(data: ChatEventData['chatConfigUpdated']): Promise<void> {
    // TODO: Implement configuration sync handling
    console.log('Configuration updated for provider', data.providerId, 'changes:', data.changes);
  }
}