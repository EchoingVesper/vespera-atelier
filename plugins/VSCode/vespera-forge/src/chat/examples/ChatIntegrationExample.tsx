/**
 * Complete Chat System Integration Example
 * 
 * This example demonstrates how to integrate all the chat components
 * with a working ChatManager, streaming support, and VS Code integration.
 */
import * as React from 'react';
import * as vscode from 'vscode';
import { ChatWindow } from '../ui/components/organisms/ChatWindow';
import { ChatManager } from '../core/ChatManager';
import { ChatTemplateRegistry } from '../core/TemplateRegistry';
import { ChatConfigurationManager } from '../core/ConfigurationManager';
import { ChatEventRouter } from '../events/ChatEventRouter';
import { ChatMessage, ChatChunk } from '../types/chat';
import { ProviderOption } from '../ui/components/molecules/ProviderSelector';

interface ChatIntegrationExampleProps {
  context: vscode.ExtensionContext;
}

export const ChatIntegrationExample: React.FC<ChatIntegrationExampleProps> = ({ context }) => {
  // Chat system state
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [providers, setProviders] = React.useState<ProviderOption[]>([]);
  const [selectedProviderId, setSelectedProviderId] = React.useState<string>();
  const [connected, setConnected] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [streaming, setStreaming] = React.useState(false);
  
  // Chat manager instance
  const chatManagerRef = React.useRef<ChatManager | null>(null);
  const streamingMessageRef = React.useRef<ChatMessage | null>(null);
  
  // Initialize chat manager
  React.useEffect(() => {
    const initializeChatManager = async () => {
      try {
        // Create dependencies
        const templateRegistry = new ChatTemplateRegistry(context);
        const configManager = new ChatConfigurationManager(context);
        const eventRouter = new ChatEventRouter();
        
        // Create chat manager
        const chatManager = new ChatManager(
          context,
          templateRegistry,
          configManager,
          eventRouter
        );
        
        // Set up event listeners for UI updates
        eventRouter.on('chatMessageReceived', (data: any) => {
          console.log('Message received:', data);
          refreshMessages();
        });
        
        eventRouter.on('chatProviderConnected', (data: any) => {
          console.log('Provider connected:', data);
          refreshProviders();
          setConnected(true);
        });
        
        eventRouter.on('chatProviderDisconnected', (data: any) => {
          console.log('Provider disconnected:', data);
          refreshProviders();
        });
        
        eventRouter.on('chatStreamStarted', (data: any) => {
          console.log('Stream started:', data);
          setStreaming(true);
          setLoading(false);
        });
        
        eventRouter.on('chatStreamChunk', (data: any) => {
          console.log('Stream chunk:', data);
          handleStreamChunk(data.chunk);
        });
        
        eventRouter.on('chatStreamComplete', (data: any) => {
          console.log('Stream complete:', data);
          setStreaming(false);
          streamingMessageRef.current = null;
          refreshMessages();
        });
        
        eventRouter.on('chatStreamError', (data: any) => {
          console.error('Stream error:', data);
          setStreaming(false);
          setLoading(false);
          streamingMessageRef.current = null;
          // Show error message
          vscode.window.showErrorMessage(`Chat error: ${data.error}`);
        });
        
        // Initialize chat manager
        await chatManager.initialize();
        chatManagerRef.current = chatManager;
        
        // Load initial state
        const state = chatManager.getState();
        setMessages(state.messageHistory);
        setProviders(state.providers.map(p => ({
          id: p.id,
          name: p.name,
          template: p.template,
          status: p.status,
          enabled: true
        })));
        setSelectedProviderId(state.activeProviderId);
        setConnected(state.providers.some(p => p.status === 'connected'));
        
      } catch (error) {
        console.error('Failed to initialize chat manager:', error);
        vscode.window.showErrorMessage(`Failed to initialize chat: ${error}`);
      }
    };
    
    initializeChatManager();
    
    return () => {
      chatManagerRef.current?.dispose();
    };
  }, [context]);
  
  // Refresh messages from chat manager
  const refreshMessages = () => {
    if (chatManagerRef.current) {
      const state = chatManagerRef.current.getState();
      setMessages([...state.messageHistory]);
    }
  };
  
  // Refresh providers from chat manager
  const refreshProviders = () => {
    if (chatManagerRef.current) {
      const state = chatManagerRef.current.getState();
      setProviders(state.providers.map(p => ({
        id: p.id,
        name: p.name,
        template: p.template,
        status: p.status,
        enabled: true
      })));
      setConnected(state.providers.some(p => p.status === 'connected'));
    }
  };
  
  // Handle streaming chunks
  const handleStreamChunk = (chunk: ChatChunk) => {
    if (!streamingMessageRef.current) {
      // Create a new streaming message
      streamingMessageRef.current = {
        id: `streaming_${Date.now()}`,
        role: 'assistant',
        content: chunk.content,
        timestamp: new Date(),
        threadId: 'default',
        metadata: {
          provider: selectedProviderId
        }
      };
    } else {
      // Append to existing streaming message
      streamingMessageRef.current.content += chunk.content;
    }
    
    // Update messages with streaming message
    setMessages(prev => {
      const withoutStreaming = prev.filter(m => !m.id.startsWith('streaming_'));
      return [...withoutStreaming, streamingMessageRef.current!];
    });
  };
  
  // Handle sending messages
  const handleSendMessage = async (content: string) => {
    if (!chatManagerRef.current || !connected) {
      vscode.window.showWarningMessage('Please connect to a provider first');
      return;
    }
    
    try {
      setLoading(true);
      
      // Check if provider supports streaming
      const manager = chatManagerRef.current;
      const streamingSupported = manager.getState().providers
        .find(p => p.id === selectedProviderId)?.capabilities?.streaming;
      
      if (streamingSupported) {
        // Send streaming message
        await manager.sendStreamingMessage(content, handleStreamChunk, selectedProviderId);
      } else {
        // Send regular message
        await manager.sendMessage(content, selectedProviderId);
        refreshMessages();
        setLoading(false);
      }
      
    } catch (error) {
      console.error('Failed to send message:', error);
      vscode.window.showErrorMessage(`Failed to send message: ${error}`);
      setLoading(false);
      setStreaming(false);
    }
  };
  
  // Handle provider change
  const handleProviderChange = async (providerId: string) => {
    try {
      await chatManagerRef.current?.switchProvider(providerId);
      setSelectedProviderId(providerId);
    } catch (error) {
      console.error('Failed to switch provider:', error);
      vscode.window.showErrorMessage(`Failed to switch provider: ${error}`);
    }
  };
  
  // Handle provider configuration
  const handleProviderConfigure = (providerId: string) => {
    // This would typically open a configuration UI
    // For now, just show a message
    vscode.window.showInformationMessage(`Configure provider: ${providerId}`);
  };
  
  // Handle message copy
  const handleMessageCopy = async (content: string) => {
    try {
      await vscode.env.clipboard.writeText(content);
      vscode.window.showInformationMessage('Message copied to clipboard');
    } catch (error) {
      console.error('Failed to copy message:', error);
      vscode.window.showErrorMessage('Failed to copy message');
    }
  };
  
  // Handle message retry
  const handleMessageRetry = async (messageId: string) => {
    try {
      setLoading(true);
      await chatManagerRef.current?.retryMessage(messageId);
      refreshMessages();
      setLoading(false);
    } catch (error) {
      console.error('Failed to retry message:', error);
      vscode.window.showErrorMessage(`Failed to retry message: ${error}`);
      setLoading(false);
    }
  };
  
  // Handle message edit
  const handleMessageEdit = async (messageId: string, newContent: string) => {
    try {
      // Find the message and update it, then retry from that point
      const messageIndex = messages.findIndex(m => m.id === messageId);
      if (messageIndex === -1) return;
      
      // Update message content
      const updatedMessages = [...messages];
      updatedMessages[messageIndex].content = newContent;
      
      // Remove subsequent messages and retry
      const messagesToKeep = updatedMessages.slice(0, messageIndex + 1);
      setMessages(messagesToKeep);
      
      // If it's a user message, resend it
      if (updatedMessages[messageIndex].role === 'user') {
        await handleSendMessage(newContent);
      }
      
    } catch (error) {
      console.error('Failed to edit message:', error);
      vscode.window.showErrorMessage(`Failed to edit message: ${error}`);
    }
  };
  
  // Handle clear history
  const handleClearHistory = async () => {
    try {
      await chatManagerRef.current?.clearHistory();
      setMessages([]);
      vscode.window.showInformationMessage('Chat history cleared');
    } catch (error) {
      console.error('Failed to clear history:', error);
      vscode.window.showErrorMessage('Failed to clear history');
    }
  };
  
  // Handle export history
  const handleExportHistory = () => {
    try {
      if (!chatManagerRef.current) return;
      
      const exportData = chatManagerRef.current.exportHistory('markdown');
      
      // Create a new document with the exported data
      vscode.workspace.openTextDocument({
        content: exportData,
        language: 'markdown'
      }).then(doc => {
        vscode.window.showTextDocument(doc);
      });
      
    } catch (error) {
      console.error('Failed to export history:', error);
      vscode.window.showErrorMessage('Failed to export history');
    }
  };
  
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ChatWindow
        messages={messages}
        providers={providers}
        selectedProviderId={selectedProviderId}
        loading={loading}
        streaming={streaming}
        connected={connected}
        showTimestamps={true}
        compactMode={false}
        maxMessageLength={4000}
        onSendMessage={handleSendMessage}
        onProviderChange={handleProviderChange}
        onProviderConfigure={handleProviderConfigure}
        onMessageCopy={handleMessageCopy}
        onMessageRetry={handleMessageRetry}
        onMessageEdit={handleMessageEdit}
        onClearHistory={handleClearHistory}
        onExportHistory={handleExportHistory}
        hotkeys={{
          send: 'enter',
          newLine: 'shift_enter',
          clearChat: 'ctrl+k',
          switchProvider: 'ctrl+p'
        }}
      />
    </div>
  );
};

ChatIntegrationExample.displayName = 'ChatIntegrationExample';

/**
 * Usage example for VS Code extension:
 * 
 * ```typescript
 * // In your extension's webview provider
 * export class ChatWebviewProvider implements vscode.WebviewViewProvider {
 *   private _view?: vscode.WebviewView;
 * 
 *   constructor(private readonly _context: vscode.ExtensionContext) {}
 * 
 *   public resolveWebviewView(webviewView: vscode.WebviewView) {
 *     this._view = webviewView;
 *     
 *     webviewView.webview.options = {
 *       enableScripts: true,
 *       localResourceRoots: [this._context.extensionUri]
 *     };
 * 
 *     webviewView.webview.html = this.getHtml();
 *   }
 * 
 *   private getHtml(): string {
 *     return `
 *       <!DOCTYPE html>
 *       <html>
 *         <head>
 *           <meta charset="UTF-8">
 *           <link href="${this.getCssUri()}" rel="stylesheet">
 *         </head>
 *         <body>
 *           <div id="root"></div>
 *           <script src="${this.getScriptUri()}"></script>
 *         </body>
 *       </html>
 *     `;
 *   }
 * }
 * ```
 */