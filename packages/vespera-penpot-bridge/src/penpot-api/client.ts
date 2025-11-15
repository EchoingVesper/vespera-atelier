/**
 * Penpot API Client
 *
 * Based on penpot-mcp by Montevive AI Team
 * Extended with write operations using Penpot's RPC API
 */

import axios, { AxiosInstance } from 'axios';
import transit from 'transit-js';
import { logger } from '../utils/logger.js';
import {
  PenpotProject,
  PenpotFile,
  PenpotPage,
  PenpotObject,
  CreateShapeOptions,
  StyleOptions,
  FlexLayoutConfig,
} from './types.js';

export class PenpotAPIClient {
  private axiosClient: AxiosInstance;
  private accessToken?: string;
  private profileId?: string;
  private sessionId?: string;
  private authenticated = false;

  constructor(private config: {
    baseUrl: string;
    username?: string;
    password?: string;
    accessToken?: string;
  }) {
    this.axiosClient = axios.create({
      baseURL: config.baseUrl,
      headers: {
        'Content-Type': 'application/transit+json',
        'Accept': 'application/transit+json',
      },
    });

    // Add Transit format encoding/decoding
    this.setupTransitInterceptors();
  }

  private setupTransitInterceptors() {
    const writer = transit.writer('json');
    const reader = transit.reader('json');

    // Request interceptor to encode with Transit
    this.axiosClient.interceptors.request.use((config) => {
      if (config.data && typeof config.data === 'object') {
        config.data = writer.write(config.data);
      }
      return config;
    });

    // Response interceptor to decode Transit
    this.axiosClient.interceptors.response.use((response) => {
      if (response.data && typeof response.data === 'string') {
        try {
          response.data = reader.read(response.data);
        } catch (e) {
          // If not Transit format, leave as is
        }
      }
      return response;
    });
  }

  async authenticate(): Promise<void> {
    if (this.authenticated) return;

    try {
      // Try access token first
      if (this.config.accessToken) {
        this.accessToken = this.config.accessToken;
        this.authenticated = true;
        return;
      }

      // Fall back to username/password
      if (!this.config.username || !this.config.password) {
        throw new Error('No authentication credentials provided');
      }

      const response = await this.axiosClient.post('/rpc/mutation/login', {
        email: this.config.username,
        password: this.config.password,
      });

      this.accessToken = response.data.accessToken;
      this.profileId = response.data.profileId;
      this.authenticated = true;

      // Add token to default headers
      this.axiosClient.defaults.headers.common['Authorization'] = `Bearer ${this.accessToken}`;
    } catch (error) {
      logger.error('Authentication failed:', error);
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  isAuthenticated(): boolean {
    return this.authenticated;
  }

  // Read Operations (original functionality)

  async listProjects(): Promise<PenpotProject[]> {
    await this.authenticate();
    const response = await this.axiosClient.post('/rpc/command/get-all-projects');
    return response.data;
  }

  async getProjectFiles(projectId: string): Promise<PenpotFile[]> {
    await this.authenticate();
    const response = await this.axiosClient.post('/rpc/command/get-project-files', {
      projectId,
    });
    return response.data;
  }

  async getFile(fileId: string): Promise<PenpotFile> {
    await this.authenticate();
    const response = await this.axiosClient.post('/rpc/command/get-file', {
      id: fileId,
    });
    return response.data;
  }

  async getPage(fileId: string, pageId?: string): Promise<PenpotPage> {
    await this.authenticate();
    const response = await this.axiosClient.post('/rpc/command/get-page', {
      fileId,
      pageId,
    });
    return response.data;
  }

  async searchObjects(fileId: string, query: string): Promise<PenpotObject[]> {
    await this.authenticate();
    const file = await this.getFile(fileId);

    // TODO: Implement actual search logic
    // For now, returning empty array
    return [];
  }

  async getObjectTree(
    file: any,
    objectId: string,
    fields: string[],
    depth: number
  ): Promise<any> {
    // TODO: Implement tree extraction logic
    return {
      id: objectId,
      tree: {},
    };
  }

  async exportObject(
    fileId: string,
    pageId: string,
    objectId: string,
    format: string,
    scale: number
  ): Promise<{ base64: string }> {
    // TODO: Implement export logic
    return {
      base64: '',
    };
  }

  async getAPISchema(): Promise<any> {
    // Return a simplified schema for now
    return {
      version: '1.0',
      endpoints: {
        read: ['get-file', 'get-page', 'list-projects'],
        write: ['update-file', 'create-file'],
      },
    };
  }

  async getTreeSchema(): Promise<any> {
    // Return tree schema structure
    return {
      fields: [
        'id',
        'name',
        'type',
        'x',
        'y',
        'width',
        'height',
        'fills',
        'strokes',
        'children',
      ],
    };
  }

  // Write Operations (new functionality)

  private async ensureSession(fileId: string): Promise<void> {
    if (!this.sessionId) {
      this.sessionId = crypto.randomUUID();
    }
  }

  async createRectangle(options: CreateShapeOptions): Promise<PenpotObject> {
    await this.authenticate();
    await this.ensureSession(options.fileId);

    const shapeId = options.id || crypto.randomUUID();
    const change = {
      type: 'add-obj',
      id: shapeId,
      pageId: options.pageId,
      obj: {
        id: shapeId,
        type: 'rect',
        name: options.name || 'Rectangle',
        x: options.x || 0,
        y: options.y || 0,
        width: options.width || 100,
        height: options.height || 100,
        fills: options.fills || [{ color: '#E5E5E5', opacity: 1 }],
        strokes: options.strokes || [],
      },
      parentId: options.parentId,
      index: options.index,
    };

    await this.updateFile(options.fileId, [change]);

    return {
      id: shapeId,
      type: 'rect',
      name: options.name || 'Rectangle',
      ...change.obj,
    };
  }

  async createEllipse(options: CreateShapeOptions): Promise<PenpotObject> {
    await this.authenticate();
    await this.ensureSession(options.fileId);

    const shapeId = options.id || crypto.randomUUID();
    const change = {
      type: 'add-obj',
      id: shapeId,
      pageId: options.pageId,
      obj: {
        id: shapeId,
        type: 'ellipse',
        name: options.name || 'Ellipse',
        x: options.x || 0,
        y: options.y || 0,
        width: options.width || 100,
        height: options.height || 100,
        fills: options.fills || [{ color: '#E5E5E5', opacity: 1 }],
        strokes: options.strokes || [],
      },
      parentId: options.parentId,
      index: options.index,
    };

    await this.updateFile(options.fileId, [change]);

    return {
      id: shapeId,
      type: 'ellipse',
      name: options.name || 'Ellipse',
      ...change.obj,
    };
  }

  async createText(options: CreateShapeOptions & { content?: string; fontSize?: number }): Promise<PenpotObject> {
    await this.authenticate();
    await this.ensureSession(options.fileId);

    const shapeId = options.id || crypto.randomUUID();
    const change = {
      type: 'add-obj',
      id: shapeId,
      pageId: options.pageId,
      obj: {
        id: shapeId,
        type: 'text',
        name: options.name || 'Text',
        x: options.x || 0,
        y: options.y || 0,
        width: options.width || 200,
        height: options.height || 40,
        content: options.content || 'Text',
        fontSize: options.fontSize || 16,
        fontFamily: 'Inter',
        fontWeight: 400,
        fills: options.fills || [{ color: '#000000', opacity: 1 }],
      },
      parentId: options.parentId,
      index: options.index,
    };

    await this.updateFile(options.fileId, [change]);

    return {
      id: shapeId,
      type: 'text',
      name: options.name || 'Text',
      ...change.obj,
    };
  }

  async createBoard(options: CreateShapeOptions): Promise<PenpotObject> {
    await this.authenticate();
    await this.ensureSession(options.fileId);

    const boardId = options.id || crypto.randomUUID();
    const change = {
      type: 'add-obj',
      id: boardId,
      pageId: options.pageId,
      obj: {
        id: boardId,
        type: 'frame',  // Boards are frames in Penpot
        name: options.name || 'Board',
        x: options.x || 0,
        y: options.y || 0,
        width: options.width || 375,
        height: options.height || 812,
        fills: options.fills || [{ color: '#FFFFFF', opacity: 1 }],
      },
      parentId: options.parentId,
      index: options.index,
    };

    await this.updateFile(options.fileId, [change]);

    return {
      id: boardId,
      type: 'frame',
      name: options.name || 'Board',
      ...change.obj,
    };
  }

  async createPath(options: CreateShapeOptions & { pathData?: string }): Promise<PenpotObject> {
    await this.authenticate();
    await this.ensureSession(options.fileId);

    const shapeId = options.id || crypto.randomUUID();
    const change = {
      type: 'add-obj',
      id: shapeId,
      pageId: options.pageId,
      obj: {
        id: shapeId,
        type: 'path',
        name: options.name || 'Path',
        x: options.x || 0,
        y: options.y || 0,
        width: options.width || 100,
        height: options.height || 100,
        pathData: options.pathData || 'M 0 0 L 100 100',
        fills: options.fills || [],
        strokes: options.strokes || [{ color: '#000000', opacity: 1, width: 2 }],
      },
      parentId: options.parentId,
      index: options.index,
    };

    await this.updateFile(options.fileId, [change]);

    return {
      id: shapeId,
      type: 'path',
      name: options.name || 'Path',
      ...change.obj,
    };
  }

  async appendToParent(parentId: string, childId: string): Promise<void> {
    // TODO: Implement move operation
    await this.authenticate();

    const change = {
      type: 'mov-objects',
      parentId,
      shapes: [childId],
    };

    // Need file context for this operation
    logger.warn('appendToParent needs implementation with proper file context');
  }

  async applyStyles(objectId: string, styles: StyleOptions): Promise<void> {
    await this.authenticate();

    const operations = [];

    if (styles.fills) {
      operations.push({
        type: 'set',
        attr: 'fills',
        val: styles.fills,
      });
    }

    if (styles.strokes) {
      operations.push({
        type: 'set',
        attr: 'strokes',
        val: styles.strokes,
      });
    }

    if (styles.opacity !== undefined) {
      operations.push({
        type: 'set',
        attr: 'opacity',
        val: styles.opacity,
      });
    }

    const change = {
      type: 'mod-obj',
      id: objectId,
      operations,
    };

    // Need file context for this operation
    logger.warn('applyStyles needs implementation with proper file context');
  }

  async setFlexLayout(boardId: string, config: FlexLayoutConfig): Promise<void> {
    await this.authenticate();

    const operations = [
      {
        type: 'set',
        attr: 'layout',
        val: 'flex',
      },
      {
        type: 'set',
        attr: 'layout-flex-dir',
        val: config.direction || 'row',
      },
      {
        type: 'set',
        attr: 'layout-wrap',
        val: config.wrap || 'nowrap',
      },
      {
        type: 'set',
        attr: 'layout-align-items',
        val: config.alignItems || 'stretch',
      },
      {
        type: 'set',
        attr: 'layout-justify-content',
        val: config.justifyContent || 'flex-start',
      },
      {
        type: 'set',
        attr: 'layout-gap',
        val: config.gap || 0,
      },
    ];

    const change = {
      type: 'mod-obj',
      id: boardId,
      operations,
    };

    // Need file context for this operation
    logger.warn('setFlexLayout needs implementation with proper file context');
  }

  async updateObject(objectId: string, updates: any): Promise<void> {
    await this.authenticate();

    const operations = Object.entries(updates).map(([key, value]) => ({
      type: 'set',
      attr: key,
      val: value,
    }));

    const change = {
      type: 'mod-obj',
      id: objectId,
      operations,
    };

    // Need file context for this operation
    logger.warn('updateObject needs implementation with proper file context');
  }

  private async updateFile(fileId: string, changes: any[]): Promise<void> {
    const file = await this.getFile(fileId);

    const updatePayload = {
      id: fileId,
      sessionId: this.sessionId,
      revn: file.revn || 0,
      vern: file.vern || 0,
      changes,
    };

    await this.axiosClient.post('/rpc/command/update-file', updatePayload);
  }
}