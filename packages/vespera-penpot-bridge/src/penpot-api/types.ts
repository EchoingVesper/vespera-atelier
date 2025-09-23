/**
 * Penpot API Type Definitions
 */

export interface PenpotProject {
  id: string;
  name: string;
  teamId: string;
  createdAt: string;
  modifiedAt: string;
  isDefault?: boolean;
  isPinned?: boolean;
}

export interface PenpotFile {
  id: string;
  projectId: string;
  name: string;
  isShared: boolean;
  createdAt: string;
  modifiedAt: string;
  revn?: number;
  vern?: number;
  data?: any;
}

export interface PenpotPage {
  id: string;
  name: string;
  fileId: string;
  objects: Map<string, PenpotObject>;
  background?: string;
}

export interface PenpotObject {
  id: string;
  type: 'rect' | 'ellipse' | 'text' | 'path' | 'frame' | 'group' | 'image';
  name: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  opacity?: number;
  fills?: Fill[];
  strokes?: Stroke[];
  shadows?: Shadow[];
  blur?: Blur;
  children?: string[];
  parentId?: string;
  content?: string; // For text objects
  fontSize?: number; // For text objects
  fontFamily?: string; // For text objects
  fontWeight?: number; // For text objects
  pathData?: string; // For path objects
}

export interface Fill {
  color: string;
  opacity: number;
  type?: 'solid' | 'gradient' | 'image';
  gradient?: Gradient;
}

export interface Stroke {
  color: string;
  opacity: number;
  width: number;
  style?: 'solid' | 'dashed' | 'dotted';
  alignment?: 'center' | 'inside' | 'outside';
}

export interface Shadow {
  color: string;
  offsetX: number;
  offsetY: number;
  blur: number;
  spread?: number;
  type?: 'drop-shadow' | 'inner-shadow';
}

export interface Blur {
  type: 'layer' | 'background';
  value: number;
}

export interface Gradient {
  type: 'linear' | 'radial';
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  centerX?: number;
  centerY?: number;
  radius?: number;
  stops: GradientStop[];
}

export interface GradientStop {
  color: string;
  position: number;
  opacity?: number;
}

export interface CreateShapeOptions {
  fileId: string;
  pageId: string;
  id?: string;
  name?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fills?: Fill[];
  strokes?: Stroke[];
  parentId?: string;
  index?: number;
}

export interface StyleOptions {
  fills?: Fill[];
  strokes?: Stroke[];
  opacity?: number;
  shadows?: Shadow[];
  blur?: Blur;
}

export interface FlexLayoutConfig {
  direction?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
  wrap?: 'nowrap' | 'wrap' | 'wrap-reverse';
  alignItems?: 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
  justifyContent?: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
  gap?: number;
  padding?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
}

export interface TransitData {
  [key: string]: any;
}

export interface RPCRequest {
  method: string;
  params: any;
}

export interface RPCResponse {
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface UpdateFileChange {
  type: string;
  [key: string]: any;
}

export interface AddObjChange extends UpdateFileChange {
  type: 'add-obj';
  id: string;
  obj: any;
  pageId?: string;
  componentId?: string;
  frameId?: string;
  parentId?: string;
  index?: number;
  ignoreTouched?: boolean;
}

export interface ModObjChange extends UpdateFileChange {
  type: 'mod-obj';
  id: string;
  pageId?: string;
  componentId?: string;
  operations: Operation[];
}

export interface Operation {
  type: 'set' | 'add' | 'remove';
  attr: string;
  val?: any;
  index?: number;
}

export interface MovObjectsChange extends UpdateFileChange {
  type: 'mov-objects';
  pageId?: string;
  componentId?: string;
  parentId: string;
  shapes: string[];
  index?: number;
  afterShape?: string;
}