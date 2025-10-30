/**
 * Chat Channel List Provider - Tree view for chat channels and agent tasks
 * Displays user chats and agent tasks organized in folders with activity indicators
 */

import * as vscode from 'vscode';
import { BinderyService } from '../services/bindery';

export interface ChatChannel {
  id: string;
  title: string;
  templateId: string;
  type: 'user-chat' | 'agent-task';
  status: 'active' | 'idle' | 'archived';
  lastActivity?: Date;
  messageCount?: number;
}

export class ChatChannelListProvider implements vscode.TreeDataProvider<ChatChannelTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ChatChannelTreeItem | undefined | null | void> = new vscode.EventEmitter<ChatChannelTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<ChatChannelTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private channels: ChatChannel[] = [];

  constructor(
    private binderyService: BinderyService
  ) {
    // Don't auto-load in constructor - channels will load when view becomes visible
    // This prevents firing change events before VS Code has created the tree view
  }

  refresh(): void {
    this.loadChannels().then(() => {
      this._onDidChangeTreeData.fire();
    });
  }

  private async loadChannels(): Promise<void> {
    try {
      // Load all codex IDs from Bindery
      const listResult = await this.binderyService.listCodeices();

      // Check if the request was successful
      if (!listResult.success) {
        const error = 'error' in listResult ? listResult.error : { message: 'Unknown error' };
        console.warn('[ChatChannelList] Failed to load codex IDs from Bindery:', error.message);
        this.channels = [];
        return;
      }

      if (!listResult.data) {
        console.warn('[ChatChannelList] No codex IDs returned from Bindery');
        this.channels = [];
        return;
      }

      // Phase 17: list_codices now returns full codex objects, not just IDs
      const codices = listResult.data;
      console.log('[ChatChannelList] Retrieved', codices.length, 'full codex objects');

      // DEBUG: Log first codex structure
      if (codices.length > 0) {
        console.log('[ChatChannelList] First codex structure:', JSON.stringify(codices[0], null, 2));
      }

      // Filter for chat channels (ai-chat template) and agent tasks
      this.channels = codices
        .filter((codex: any) => {
          const matches = codex.template_id === 'ai-chat' ||
                         codex.template_id === 'task-orchestrator' ||
                         codex.template_id === 'task-code-writer';
          if (!matches && codex.template_id) {
            console.log('[ChatChannelList] Codex filtered out - template_id:', codex.template_id, 'title:', codex.title);
          }
          return matches;
        })
        .map((codex: any) => {
          const isChat = codex.template_id === 'ai-chat';
          const status = this.determineStatus(codex);

          return {
            id: codex.id,
            title: codex.title || 'Untitled',
            templateId: codex.template_id,
            type: isChat ? 'user-chat' : 'agent-task',
            status,
            lastActivity: codex.updated_at ? new Date(codex.updated_at) : undefined,
            messageCount: this.getMessageCount(codex)
          } as ChatChannel;
        });

      console.log('[ChatChannelList] Loaded', this.channels.length, 'channels');
    } catch (error) {
      console.error('[ChatChannelList] Failed to load channels:', error);
      vscode.window.showErrorMessage(`Failed to load chat channels: ${error}`);
      this.channels = [];
    }
  }

  private determineStatus(codex: any): 'active' | 'idle' | 'archived' {
    // Check if explicitly archived
    if (codex.content?.status === 'archived' || codex.metadata?.archived) {
      return 'archived';
    }

    // Check last activity (idle if no activity in last hour)
    const lastActivity = codex.updated_at ? new Date(codex.updated_at) : new Date(codex.created_at);
    const hoursSinceActivity = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60);

    if (hoursSinceActivity > 1) {
      return 'idle';
    }

    return 'active';
  }

  private getMessageCount(codex: any): number {
    try {
      const messages = codex.content?.messages || [];
      return Array.isArray(messages) ? messages.length : 0;
    } catch {
      return 0;
    }
  }

  getTreeItem(element: ChatChannelTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ChatChannelTreeItem): Thenable<ChatChannelTreeItem[]> {
    if (!element) {
      // Root level - show folders
      return Promise.resolve([
        new ChatChannelTreeItem('User Chats', 'folder', vscode.TreeItemCollapsibleState.Expanded),
        new ChatChannelTreeItem('Agent Tasks', 'folder', vscode.TreeItemCollapsibleState.Expanded)
      ]);
    }

    if (element.contextValue === 'folder') {
      // Show channels in the folder
      const isUserChats = element.label === 'User Chats';
      const filteredChannels = this.channels.filter(ch =>
        isUserChats ? ch.type === 'user-chat' : ch.type === 'agent-task'
      );

      if (filteredChannels.length === 0) {
        return Promise.resolve([
          new ChatChannelTreeItem(
            isUserChats ? 'No chat channels yet' : 'No agent tasks',
            'empty',
            vscode.TreeItemCollapsibleState.None
          )
        ]);
      }

      return Promise.resolve(
        filteredChannels.map(channel => {
          const item = new ChatChannelTreeItem(
            channel.title,
            'channel',
            vscode.TreeItemCollapsibleState.None,
            channel
          );

          // Set icon based on status
          const statusIcon = this.getStatusIcon(channel.status);
          item.iconPath = new vscode.ThemeIcon(
            channel.type === 'user-chat' ? 'comment-discussion' : 'pulse',
            channel.status === 'active' ? new vscode.ThemeColor('charts.green') :
            channel.status === 'idle' ? new vscode.ThemeColor('charts.yellow') :
            new vscode.ThemeColor('descriptionForeground')
          );

          // Set description with activity info
          const timeAgo = channel.lastActivity ? this.formatTimeAgo(channel.lastActivity) : '';
          item.description = `${statusIcon} ${channel.messageCount || 0} msgs${timeAgo ? ' • ' + timeAgo : ''}`;

          // Make it clickable
          item.command = {
            command: 'vespera-forge.selectChatChannel',
            title: 'Select Chat Channel',
            arguments: [channel]
          };

          return item;
        })
      );
    }

    return Promise.resolve([]);
  }

  private getStatusIcon(status: 'active' | 'idle' | 'archived'): string {
    switch (status) {
      case 'active': return '🟢';
      case 'idle': return '🟡';
      case 'archived': return '⚪';
    }
  }

  private formatTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  }

  // Public API for managing channels
  async createChannel(name: string, type: 'user-chat' | 'agent-task'): Promise<ChatChannel | undefined> {
    try {
      const templateId = type === 'user-chat' ? 'ai-chat' : 'task-orchestrator';

      // Create new Codex for this channel (returns just the codex ID)
      const result = await this.binderyService.createCodex(name, templateId);

      if (!result.success) {
        const error = 'error' in result ? result.error : { message: 'Unknown error' };
        throw new Error(error.message);
      }

      const codexId = result.data;

      // Update the codex with initial content
      const updateResult = await this.binderyService.updateCodex(codexId, {
        content: {
          messages: [],
          summary: '',
          channel_name: name,
          channel_type: type,
          status: 'active'
        }
      });

      if (!updateResult.success) {
        const error = 'error' in updateResult ? updateResult.error : { message: 'Unknown error' };
        throw new Error(error.message);
      }

      const channel: ChatChannel = {
        id: codexId,
        title: name,
        templateId,
        type,
        status: 'active',
        lastActivity: new Date(),
        messageCount: 0
      };

      this.channels.push(channel);
      this.refresh();

      return channel;
    } catch (error) {
      console.error('[ChatChannelList] Failed to create channel:', error);
      vscode.window.showErrorMessage(`Failed to create channel: ${error}`);
      return undefined;
    }
  }

  async deleteChannel(channelId: string): Promise<boolean> {
    try {
      const result = await this.binderyService.deleteCodex(channelId);

      if (!result.success) {
        const error = 'error' in result ? result.error : { message: 'Unknown error' };
        throw new Error(error.message);
      }

      this.channels = this.channels.filter(ch => ch.id !== channelId);
      this.refresh();
      return true;
    } catch (error) {
      console.error('[ChatChannelList] Failed to delete channel:', error);
      vscode.window.showErrorMessage(`Failed to delete channel: ${error}`);
      return false;
    }
  }

  async archiveChannel(channelId: string): Promise<boolean> {
    try {
      const channel = this.channels.find(ch => ch.id === channelId);
      if (!channel) return false;

      const result = await this.binderyService.updateCodex(channelId, {
        content: {
          status: 'archived'
        }
      });

      if (!result.success) {
        const error = 'error' in result ? result.error : { message: 'Unknown error' };
        throw new Error(error.message);
      }

      channel.status = 'archived';
      this.refresh();
      return true;
    } catch (error) {
      console.error('[ChatChannelList] Failed to archive channel:', error);
      vscode.window.showErrorMessage(`Failed to archive channel: ${error}`);
      return false;
    }
  }

  getChannel(channelId: string): ChatChannel | undefined {
    return this.channels.find(ch => ch.id === channelId);
  }

  getAllChannels(): ChatChannel[] {
    return [...this.channels];
  }

  /**
   * Dispose of the provider (required by VS Code)
   */
  dispose(): void {
    // Clean up any resources if needed
    this.channels = [];
  }
}

export class ChatChannelTreeItem extends vscode.TreeItem {
  constructor(
    public override readonly label: string,
    public override readonly contextValue: 'folder' | 'channel' | 'empty',
    public override readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly channel?: ChatChannel
  ) {
    super(label, collapsibleState);

    if (contextValue === 'folder') {
      this.iconPath = new vscode.ThemeIcon('folder');
    } else if (contextValue === 'empty') {
      this.iconPath = new vscode.ThemeIcon('info');
      this.description = 'Click + to create';
    }
  }
}
