/**
 * AI Assistant Component
 * Right panel AI assistant with template-aware personalities
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, Sparkles, Settings, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { AIAssistant as AIAssistantType, Codex, Template, Context } from '../../core/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  context?: string;
  templateId?: string;
}

interface AIAssistantProps {
  assistants: AIAssistantType[];
  currentAssistant: AIAssistantType;
  activeCodex?: Codex;
  activeTemplate?: Template;
  context: Context;
  onAssistantChange: (assistant: AIAssistantType) => void;
  onSendMessage: (message: string, assistant: AIAssistantType, context: any) => Promise<string>;
  className?: string;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({
  assistants,
  currentAssistant,
  activeCodex,
  activeTemplate,
  context,
  onAssistantChange,
  onSendMessage,
  className
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [agentMode, setAgentMode] = useState<string>('default');
  // TODO: Load available agents from .vespera/templates/agents dynamically
  const availableAgents = [
    { id: 'default', name: 'General Assistant', description: 'Helpful general-purpose assistant' },
    { id: 'task-orchestrator', name: 'Task Orchestrator', description: 'Coordinates complex multi-step tasks' },
    { id: 'task-code-writer', name: 'Code Writer', description: 'Specialist in writing and refactoring code' }
  ];
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize with welcome message
  useEffect(() => {
    if (messages.length === 0 && currentAssistant) {
      const welcomeMessage: Message = {
        id: 'welcome',
        role: 'assistant',
        content: getWelcomeMessage(currentAssistant, activeCodex, activeTemplate, context),
        timestamp: new Date(),
        templateId: activeTemplate?.id
      };
      setMessages([welcomeMessage]);
    }
  }, [currentAssistant, activeCodex, activeTemplate, context]);

  const getWelcomeMessage = (assistant: AIAssistantType, codex?: Codex, template?: Template, _ctx?: Context): string => {
    const baseGreeting = getGreetingByPersonality(assistant.personality);

    if (codex && template) {
      return `${baseGreeting} I'm here to help you with your ${template.name.toLowerCase()} "${codex.name}". What would you like to work on?`;
    }

    if (template) {
      return `${baseGreeting} I'm your ${template.name.toLowerCase()} specialist. How can I assist you today?`;
    }

    return `${baseGreeting} I'm your AI assistant. I can help you with content creation, template management, and workflow optimization. What would you like to explore?`;
  };

  const getGreetingByPersonality = (personality: AIAssistantType['personality']): string => {
    switch (personality.tone) {
      case 'professional':
        return 'Good day. ';
      case 'friendly':
        return 'Hello there! ';
      case 'casual':
        return 'Hey! ';
      case 'formal':
        return 'Greetings. ';
      default:
        return 'Hello! ';
    }
  };

  const handleSendMessage = useCallback(async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await onSendMessage(
        userMessage.content,
        currentAssistant,
        {
          activeCodex,
          activeTemplate,
          context,
          conversationHistory: messages.slice(-5) // Last 5 messages for context
        }
      );

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
        templateId: activeTemplate?.id
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I apologize, but I encountered an error processing your request. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [inputMessage, isLoading, currentAssistant, activeCodex, activeTemplate, context, messages, onSendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Send on Enter, new line on Shift+Enter
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const startVoiceRecording = () => {
    // Voice recording implementation would go here
    setIsRecording(true);
    setTimeout(() => {
      setIsRecording(false);
      setInputMessage('Voice input would be processed here');
    }, 2000);
  };

  const clearConversation = () => {
    setMessages([]);
    const welcomeMessage: Message = {
      id: 'welcome',
      role: 'assistant',
      content: getWelcomeMessage(currentAssistant, activeCodex, activeTemplate, context),
      timestamp: new Date(),
      templateId: activeTemplate?.id
    };
    setMessages([welcomeMessage]);
  };

  const formatTimestamp = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getContextualActions = (): string[] => {
    if (!activeCodex || !activeTemplate) return [];

    const actions: string[] = [];
    
    // Template-specific actions
    switch (activeTemplate.id) {
      case 'character':
        actions.push('Develop character backstory', 'Suggest character relationships', 'Review character consistency');
        break;
      case 'task':
        actions.push('Break down task into subtasks', 'Estimate task duration', 'Suggest task dependencies');
        break;
      case 'scene':
        actions.push('Enhance scene description', 'Suggest scene pacing', 'Add emotional depth');
        break;
      default:
        actions.push('Review content', 'Suggest improvements', 'Check consistency');
    }

    // Context-specific actions
    if (context.workflowStage === 'planning') {
      actions.push('Create outline', 'Set goals', 'Define milestones');
    } else if (context.workflowStage === 'review') {
      actions.push('Proofread', 'Check grammar', 'Suggest edits');
    }

    return actions.slice(0, 3); // Limit to 3 actions
  };

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Avatar className="w-8 h-8">
              <AvatarFallback>
                <Bot className="w-4 h-4" />
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold">{currentAssistant.name}</h3>
              <p className="text-xs text-muted-foreground">
                {currentAssistant.expertise.join(', ')}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMuted(!isMuted)}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Settings className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={clearConversation}>
                  Clear Conversation
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {assistants.map(assistant => (
                  <DropdownMenuItem
                    key={assistant.id}
                    onClick={() => onAssistantChange(assistant)}
                    disabled={assistant.id === currentAssistant.id}
                  >
                    <Bot className="w-4 h-4 mr-2" />
                    {assistant.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        {/* Context Info */}
        {activeCodex && activeTemplate && (
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="outline">{activeTemplate.name}</Badge>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground truncate">{activeCodex.name}</span>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      {getContextualActions().length > 0 && (
        <div className="p-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-1 mb-2">
            <Sparkles className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Quick Actions</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {getContextualActions().map(action => (
              <Button
                key={action}
                variant="outline"
                size="sm"
                className="text-xs h-6"
                onClick={() => setInputMessage(action)}
              >
                {action}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map(message => (
            <div
              key={message.id}
              className={cn(
                'flex gap-3',
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {message.role === 'assistant' && (
                <Avatar className="w-8 h-8 mt-1">
                  <AvatarFallback>
                    <Bot className="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
              )}
              
              <div
                className={cn(
                  'max-w-[80%] rounded-lg p-3',
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground ml-auto'
                    : 'bg-muted'
                )}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                <p className="text-xs opacity-70 mt-1">
                  {formatTimestamp(message.timestamp)}
                </p>
              </div>
              
              {message.role === 'user' && (
                <Avatar className="w-8 h-8 mt-1">
                  <AvatarFallback>
                    <User className="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}
          
          {isLoading && (
            <div className="flex gap-3 justify-start">
              <Avatar className="w-8 h-8 mt-1">
                <AvatarFallback>
                  <Bot className="w-4 h-4" />
                </AvatarFallback>
              </Avatar>
              <div className="bg-muted rounded-lg p-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce delay-100" />
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce delay-200" />
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 border-t border-border space-y-2">
        {/* Full-width textarea input */}
        <Textarea
          ref={inputRef}
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask me anything about your content... (Shift+Enter for new line)"
          disabled={isLoading}
          className="w-full min-h-[80px] resize-none"
          rows={3}
        />

        {/* Controls row: Agent Mode, Voice, Send */}
        <div className="flex gap-2 items-center">
          <Select value={agentMode} onValueChange={setAgentMode}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select agent mode" />
            </SelectTrigger>
            <SelectContent>
              {availableAgents.map(agent => (
                <SelectItem key={agent.id} value={agent.id}>
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{agent.name}</span>
                    <span className="text-xs text-muted-foreground">{agent.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={startVoiceRecording}
            disabled={isRecording}
            className={cn(
              'shrink-0',
              isRecording && 'bg-red-500 text-white'
            )}
          >
            {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </Button>

          <Button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isLoading}
            size="sm"
            className="ml-auto px-6"
          >
            <Send className="w-4 h-4 mr-2" />
            Send
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;