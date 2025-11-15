/**
 * Main Vespera Forge Component
 * Template-driven content management system UI
 * Compatible with both VS Code and Obsidian plugins
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  PlatformAdapter,
  Codex,
  Template,
  AIAssistant as AIAssistantType,
  Context,
  UIState,
  FieldType
} from '../../core/types';
import ThreePanelLayout from '../layout/ThreePanelLayout';
import CodexNavigator from '../navigation/CodexNavigator';
import { AIAssistant as AIAssistantComponent } from '../ai/AIAssistant';
import { CodexEditor } from '../editor/CodexEditor';
import { cn } from '@/lib/utils';

interface VesperaForgeProps {
  platformAdapter: PlatformAdapter;
  initialData?: {
    codices?: Codex[];
    templates?: Template[];
    assistants?: AIAssistantType[];
  };
  onCodexCreate?: (codex: Omit<Codex, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Codex>;
  onCodexUpdate?: (codex: Codex) => Promise<Codex>;
  onCodexDelete?: (codexId: string) => Promise<void>;
  onTemplateCreate?: (template: Omit<Template, 'id'>) => Promise<Template>;
  onTemplateUpdate?: (template: Template) => Promise<Template>;
  onAIMessage?: (message: string, assistant: AIAssistantType, context: any) => Promise<string>;
  className?: string;
}

export const VesperaForge: React.FC<VesperaForgeProps> = ({
  platformAdapter,
  initialData,
  onCodexCreate,
  onCodexUpdate,
  onCodexDelete,
  className
}) => {
  // State management
  const [codices, setCodices] = useState<Codex[]>(initialData?.codices || []);
  const [templates, setTemplates] = useState<Template[]>(initialData?.templates || getDefaultTemplates());
  const [assistants, setAssistants] = useState<AIAssistantType[]>(initialData?.assistants || getDefaultAssistants());
  const [activeCodex, setActiveCodex] = useState<Codex | undefined>();
  const [activeTemplate, setActiveTemplate] = useState<Template | undefined>();
  const [currentAssistant, setCurrentAssistant] = useState<AIAssistantType>(assistants[0] || getDefaultAssistants()[0] || {} as AIAssistantType);
  const [context, setContext] = useState<Context>(platformAdapter.getCurrentContext());
  const [uiState, setUiState] = useState<UIState>({
    currentViewMode: 'default',
    leftPanelWidth: 300,
    rightPanelWidth: 350,
    showLeftPanel: true,
    showRightPanel: true,
    context,
    filters: []
  });

  // Initialize default data
  useEffect(() => {
    if (templates.length === 0) {
      setTemplates(getDefaultTemplates());
    }
    if (assistants.length === 0) {
      const defaultAssistants = getDefaultAssistants();
      setAssistants(defaultAssistants);
      if (defaultAssistants[0]) {
        setCurrentAssistant(defaultAssistants[0]);
      }
    }
  }, [templates.length, assistants.length]);

  // Update context when platform context changes
  useEffect(() => {
    const newContext = platformAdapter.getCurrentContext();
    setContext(newContext);
    setUiState(prev => ({ ...prev, context: newContext }));
  }, [platformAdapter]);

  // Handle platform messages
  useEffect(() => {
    platformAdapter.onMessage((message: any) => {
      handlePlatformMessage(message);
    });
  }, [platformAdapter]);

  const handlePlatformMessage = useCallback((message: any) => {
    switch (message.type) {
      case 'setActiveCodex':
        const codex = codices.find(c => c.id === message.payload.codexId);
        if (codex) {
          setActiveCodex(codex);
          const template = templates.find(t => t.id === codex.templateId);
          setActiveTemplate(template);
        }
        break;
      case 'updateContext':
        setContext(message.payload);
        break;
      case 'showNotification':
        platformAdapter.showNotification(message.payload.message, message.payload.type);
        break;
      default:
        console.log('Unhandled platform message:', message);
    }
  }, [codices, templates, platformAdapter]);

  // Codex operations
  const handleCodexSelect = useCallback((codex: Codex) => {
    setActiveCodex(codex);
    const template = templates.find(t => t.id === codex.templateId);
    setActiveTemplate(template);

    // Notify platform
    platformAdapter.sendMessage({
      type: 'codexSelected',
      payload: { codexId: codex.id }
    });
  }, [templates, platformAdapter]);

  const handleCodexCreate = useCallback(async (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    const newCodex: Omit<Codex, 'id' | 'createdAt' | 'updatedAt'> = {
      name: `New ${template.name}`,
      templateId,
      content: {},
      metadata: {
        status: 'draft',
        projectId: context.projectId
      },
      relationships: [],
      tags: []
    };

    try {
      let createdCodex: Codex;
      if (onCodexCreate) {
        createdCodex = await onCodexCreate(newCodex);
      } else {
        // Default creation logic
        createdCodex = {
          ...newCodex,
          id: Date.now().toString(),
          createdAt: new Date(),
          updatedAt: new Date()
        };
      }

      setCodices(prev => [...prev, createdCodex]);
      setActiveCodex(createdCodex);
      setActiveTemplate(template);

      platformAdapter.showNotification(`${template.name} created successfully`, 'info');
    } catch (error) {
      platformAdapter.showNotification('Failed to create codex', 'error');
      console.error('Failed to create codex:', error);
    }
  }, [templates, context, onCodexCreate, platformAdapter]);

  const handleCodexUpdate = useCallback(async (updatedCodex: Codex) => {
    try {
      let savedCodex: Codex;
      if (onCodexUpdate) {
        savedCodex = await onCodexUpdate(updatedCodex);
      } else {
        savedCodex = { ...updatedCodex, updatedAt: new Date() };
      }

      setCodices(prev => prev.map(c => c.id === savedCodex.id ? savedCodex : c));
      if (activeCodex?.id === savedCodex.id) {
        setActiveCodex(savedCodex);
      }

      platformAdapter.showNotification('Codex updated successfully', 'info');
    } catch (error) {
      platformAdapter.showNotification('Failed to update codex', 'error');
      console.error('Failed to update codex:', error);
    }
  }, [activeCodex, onCodexUpdate, platformAdapter]);

  const handleCodexDelete = useCallback(async (codexId: string) => {
    try {
      if (onCodexDelete) {
        await onCodexDelete(codexId);
      }

      setCodices(prev => prev.filter(c => c.id !== codexId));
      if (activeCodex?.id === codexId) {
        setActiveCodex(undefined);
        setActiveTemplate(undefined);
      }

      platformAdapter.showNotification('Codex deleted successfully', 'info');
    } catch (error) {
      platformAdapter.showNotification('Failed to delete codex', 'error');
      console.error('Failed to delete codex:', error);
    }
  }, [activeCodex, onCodexDelete, platformAdapter]);

  // AI operations
  const handleAIMessage = useCallback(async (_message: string, _assistant: AIAssistantType, _aiContext: any): Promise<string> => {
    try {
      // Default AI response logic
      const responses = [
        "I understand you're working on that. Let me help you think through it.",
        "That's an interesting approach. Have you considered...",
        "Based on the template structure, I suggest focusing on...",
        "Let me provide some guidance on this topic."
      ];

      return responses[Math.floor(Math.random() * responses.length)] || '';
    } catch (error) {
      console.error('AI message failed:', error);
      return 'I apologize, but I encountered an error processing your request.';
    }
  }, []);

  const handleAssistantChange = useCallback((assistant: AIAssistantType) => {
    setCurrentAssistant(assistant);
  }, []);

  // UI state management
  const handleUIStateChange = useCallback((newState: UIState) => {
    setUiState(newState);

    // Persist state to platform if available
    if ('setState' in platformAdapter && typeof platformAdapter.setState === 'function') {
      platformAdapter.setState({ vesperaForgeUIState: newState });
    }
  }, [platformAdapter]);

  // Memoized components
  const leftPanel = useMemo(() => (
    <CodexNavigator
      codices={codices}
      templates={templates}
      selectedCodexId={activeCodex?.id}
      onCodexSelect={handleCodexSelect}
      onCodexCreate={handleCodexCreate}
      onCodexDelete={handleCodexDelete}
      onCodexUpdate={handleCodexUpdate}
    />
  ), [codices, templates, activeCodex?.id, handleCodexSelect, handleCodexCreate, handleCodexDelete, handleCodexUpdate]);

  const centerPanel = useMemo(() => (
    <CodexEditor
      codex={activeCodex}
      template={activeTemplate}
      context={context}
      onCodexUpdate={handleCodexUpdate}
      platformAdapter={platformAdapter}
    />
  ), [activeCodex, activeTemplate, context, handleCodexUpdate, platformAdapter]);

  const rightPanel = useMemo(() => (
    <AIAssistantComponent
      assistants={assistants}
      currentAssistant={currentAssistant}
      activeCodex={activeCodex}
      activeTemplate={activeTemplate}
      context={context}
      onAssistantChange={handleAssistantChange}
      onSendMessage={handleAIMessage}
    />
  ), [assistants, currentAssistant, activeCodex, activeTemplate, context, handleAssistantChange, handleAIMessage]);

  return (
    <div className={cn('vespera-forge h-full w-full', className)}>
      <ThreePanelLayout
        platformAdapter={platformAdapter}
        leftPanel={leftPanel}
        centerPanel={centerPanel}
        rightPanel={rightPanel}
        initialState={uiState}
        onStateChange={handleUIStateChange}
      />
    </div>
  );
};

// Helper functions for default data
function getDefaultTemplates(): Template[] {
  return [
    {
      id: 'character',
      name: 'Character',
      description: 'Character development template',
      version: '1.0.0',
      mixins: [],
      fields: [
        {
          id: 'name',
          name: 'Name',
          type: FieldType.TEXT,
          required: true
        },
        {
          id: 'description',
          name: 'Description',
          type: FieldType.RICH_TEXT,
          required: false
        },
        {
          id: 'age',
          name: 'Age',
          type: FieldType.NUMBER,
          required: false
        }
      ],
      viewModes: [
        {
          id: 'sheet',
          name: 'Character Sheet',
          description: 'Standard character sheet view',
          layout: { type: 'single' },
          components: [],
          contexts: ['all']
        }
      ],
      workflowStates: [
        {
          id: 'draft',
          name: 'Draft',
          description: 'Initial character concept',
          color: '#gray',
          transitions: [],
          actions: []
        }
      ],
      actions: [],
      styling: { theme: 'default' }
    },
    {
      id: 'task',
      name: 'Task',
      description: 'Task management template',
      version: '1.0.0',
      mixins: [],
      fields: [
        {
          id: 'title',
          name: 'Title',
          type: FieldType.TEXT,
          required: true
        },
        {
          id: 'description',
          name: 'Description',
          type: FieldType.RICH_TEXT,
          required: false
        },
        {
          id: 'priority',
          name: 'Priority',
          type: FieldType.SELECT,
          required: false
        }
      ],
      viewModes: [],
      workflowStates: [],
      actions: [],
      styling: { theme: 'default' }
    }
  ];
}

function getDefaultAssistants(): AIAssistantType[] {
  return [
    {
      id: 'character-expert',
      name: 'Character Development Expert',
      personality: {
        tone: 'friendly',
        expertise: 'expert',
        communicationStyle: 'detailed'
      },
      expertise: ['character development', 'storytelling', 'dialogue'],
      templateIds: ['character'],
      contexts: ['creation', 'review'],
      config: {
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 1000,
        systemPrompt: 'You are a character development expert specializing in creating compelling, realistic characters.'
      }
    },
    {
      id: 'task-coach',
      name: 'Task Management Coach',
      personality: {
        tone: 'professional',
        expertise: 'intermediate',
        communicationStyle: 'concise'
      },
      expertise: ['productivity', 'planning', 'organization'],
      templateIds: ['task'],
      contexts: ['planning', 'creation'],
      config: {
        model: 'gpt-3.5-turbo',
        temperature: 0.5,
        maxTokens: 500,
        systemPrompt: 'You are a productivity coach helping users manage their tasks effectively.'
      }
    }
  ];
}

export default VesperaForge;
