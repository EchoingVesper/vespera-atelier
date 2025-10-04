/**
 * Core types for Vespera Forge UI System
 * Compatible with both VS Code and Obsidian plugin environments
 */

// Core Codex System Types
export interface Codex {
  id: string;
  name: string;
  templateId: string;
  content: Record<string, any>;
  metadata: CodexMetadata;
  relationships: Relationship[];
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CodexMetadata {
  projectId?: string;
  status?: string;
  priority?: string;
  assignedTo?: string;
  workflowState?: string;
  customFields?: Record<string, any>;
}

export interface Relationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: RelationshipType;
  strength: number;
  metadata?: Record<string, any>;
}

export enum RelationshipType {
  DEPENDENCY = 'dependency',
  REFERENCE = 'reference',
  CONTAINS = 'contains',
  RELATED_TO = 'related_to',
  PRECEDES = 'precedes',
  FOLLOWS = 'follows',
  PARENT_OF = 'parent_of',
  CHILD_OF = 'child_of'
}

// Template System Types
export interface Template {
  id: string;
  name: string;
  description: string;
  version: string;
  baseTemplate?: string;
  mixins: string[];
  fields: TemplateField[];
  viewModes: ViewMode[];
  workflowStates: WorkflowState[];
  actions: TemplateAction[];
  styling: TemplateStyling;
}

export interface TemplateField {
  id: string;
  name: string;
  type: FieldType;
  required: boolean;
  defaultValue?: any;
  validation?: ValidationRule[];
  visibility?: FieldVisibility;
  styling?: FieldStyling;
}

export enum FieldType {
  TEXT = 'text',
  RICH_TEXT = 'rich_text',
  NUMBER = 'number',
  DATE = 'date',
  SELECT = 'select',
  MULTI_SELECT = 'multi_select',
  BOOLEAN = 'boolean',
  FILE = 'file',
  IMAGE = 'image',
  REFERENCE = 'reference',
  MULTI_REFERENCE = 'multi_reference',
  FORMULA = 'formula',
  COMPUTED = 'computed'
}

export interface ValidationRule {
  type: string;
  params: Record<string, any>;
  message: string;
}

export interface FieldVisibility {
  contexts: string[];
  roles: string[];
  conditions: VisibilityCondition[];
}

export interface VisibilityCondition {
  field: string;
  operator: string;
  value: any;
}

export interface FieldStyling {
  width?: string;
  height?: string;
  className?: string;
  customCSS?: string;
}

export interface ViewMode {
  id: string;
  name: string;
  description: string;
  layout: LayoutConfig;
  components: ViewComponent[];
  contexts: string[];
}

export interface LayoutConfig {
  type: 'single' | 'split' | 'grid' | 'custom';
  columns?: number;
  rows?: number;
  proportions?: number[];
  customLayout?: string;
}

export interface ViewComponent {
  id: string;
  type: ComponentType;
  fieldId?: string;
  config: ComponentConfig;
  position: ComponentPosition;
}

export enum ComponentType {
  FIELD = 'field',
  RELATIONSHIP_MAP = 'relationship_map',
  WORKFLOW_VISUALIZER = 'workflow_visualizer',
  ANALYTICS = 'analytics',
  CUSTOM = 'custom'
}

export interface ComponentConfig {
  [key: string]: any;
}

export interface ComponentPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WorkflowState {
  id: string;
  name: string;
  description: string;
  color: string;
  transitions: WorkflowTransition[];
  actions: string[];
}

export interface WorkflowTransition {
  from: string;
  to: string;
  condition?: string;
  action?: string;
}

export interface TemplateAction {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: ActionType;
  config: ActionConfig;
  visibility?: ActionVisibility;
}

export enum ActionType {
  STATE_CHANGE = 'state_change',
  FIELD_UPDATE = 'field_update',
  AUTOMATION = 'automation',
  EXTERNAL = 'external',
  CUSTOM = 'custom'
}

export interface ActionConfig {
  [key: string]: any;
}

export interface ActionVisibility {
  states: string[];
  roles: string[];
  conditions: VisibilityCondition[];
}

export interface TemplateStyling {
  theme: string;
  customCSS?: string;
  componentStyles?: Record<string, any>;
}

// Mixin System Types
export interface Mixin {
  id: string;
  name: string;
  description: string;
  version: string;
  fields: TemplateField[];
  actions: TemplateAction[];
  styling?: TemplateStyling;
  dependencies: string[];
}

// Context System Types
export interface Context {
  projectId?: string;
  userId?: string;
  role: UserRole;
  workflowStage: WorkflowStage;
  collaborationMode: CollaborationMode;
  deviceType: DeviceType;
  customContext?: Record<string, any>;
}

export enum UserRole {
  WRITER = 'writer',
  DEVELOPER = 'developer',
  GAME_MASTER = 'game_master',
  PROJECT_MANAGER = 'project_manager',
  VIEWER = 'viewer'
}

export enum WorkflowStage {
  PLANNING = 'planning',
  CREATION = 'creation',
  REVIEW = 'review',
  PUBLICATION = 'publication'
}

export enum CollaborationMode {
  SOLO = 'solo',
  TEAM = 'team',
  REVIEW = 'review',
  PRESENTATION = 'presentation'
}

export enum DeviceType {
  DESKTOP = 'desktop',
  TABLET = 'tablet',
  MOBILE = 'mobile'
}

// AI Assistant Types
export interface AIAssistant {
  id: string;
  name: string;
  personality: AIPersonality;
  expertise: string[];
  templateIds: string[];
  contexts: string[];
  config: AIConfig;
}

export interface AIPersonality {
  tone: 'professional' | 'friendly' | 'casual' | 'formal';
  expertise: 'beginner' | 'intermediate' | 'expert';
  communicationStyle: 'concise' | 'detailed' | 'interactive';
}

export interface AIConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  customInstructions?: string;
}

// UI State Types
export interface UIState {
  activeCodexId?: string;
  selectedTemplateId?: string;
  currentViewMode: string;
  leftPanelWidth: number;
  rightPanelWidth: number;
  showLeftPanel: boolean;
  showRightPanel: boolean;
  context: Context;
  searchQuery?: string;
  filters: FilterConfig[];
}

export interface FilterConfig {
  field: string;
  operator: string;
  value: any;
  type: 'text' | 'select' | 'date' | 'number';
}

// Platform-Specific Types
export interface PlatformAdapter {
  type: 'vscode' | 'obsidian';
  api: any;
  sendMessage: (message: any) => void;
  onMessage: (callback: (message: any) => void) => void;
  getTheme: () => string;
  openFile: (path: string) => void;
  saveFile: (path: string, content: string) => Promise<void>;
  showNotification: (message: string, type: 'info' | 'warning' | 'error') => void;
}

// Event System Types
export interface UIEvent {
  type: string;
  payload: any;
  timestamp: Date;
  source: string;
}

export interface EventListener {
  eventType: string;
  callback: (event: UIEvent) => void;
  priority?: number;
}

// Analytics Types
export interface AnalyticsData {
  templateUsage: Record<string, number>;
  fieldUsage: Record<string, number>;
  workflowEfficiency: Record<string, number>;
  userInteractions: UserInteraction[];
  performanceMetrics: PerformanceMetrics;
}

export interface UserInteraction {
  action: string;
  target: string;
  timestamp: Date;
  context: Context;
  duration?: number;
}

export interface PerformanceMetrics {
  renderTime: number;
  responseTime: number;
  memoryUsage: number;
  errorRate: number;
}