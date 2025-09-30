/**
 * Penpot API Client
 *
 * Based on penpot-mcp by Montevive AI Team
 * Extended with write operations using Penpot's RPC API
 */

import axios, { AxiosInstance } from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
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
    const jar = new CookieJar();
    this.axiosClient = wrapper(axios.create({
      baseURL: config.baseUrl,
      headers: {
        'Content-Type': 'application/transit+json',
        'Accept': 'application/transit+json',
      },
      jar, // Cookie jar for persistence
      withCredentials: true,
    }));

    // Add Transit format encoding/decoding
    this.setupTransitInterceptors();
  }

  private setupTransitInterceptors() {
    const writer = transit.writer('json');
    const reader = transit.reader('json');

    // Request interceptor to encode with Transit
    this.axiosClient.interceptors.request.use((config) => {
      if (config.data !== undefined) {
        // Always encode data with Transit, including null
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

      // Create Transit map with keyword keys for Penpot API
      const loginData = transit.map([
        transit.keyword('email'), this.config.username,
        transit.keyword('password'), this.config.password,
      ]);

      const response = await this.axiosClient.post('/rpc/command/login-with-password', loginData);

      // Penpot 2.x uses cookie-based authentication (auth-token cookie)
      // The response contains the profile data as a Transit map
      // Transit maps have a .get() method for keyword lookup
      const profileData = response.data;
      if (profileData && typeof profileData.get === 'function') {
        const idKey = transit.keyword('id');
        this.profileId = profileData.get(idKey);
      }
      this.authenticated = true;

      logger.info('Authentication successful', { profileId: this.profileId });
    } catch (error) {
      logger.error('Authentication failed:', error);
      throw new Error(`Authentication failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  isAuthenticated(): boolean {
    return this.authenticated;
  }

  // Read Operations (original functionality)

  async listProjects(): Promise<PenpotProject[]> {
    await this.authenticate();
    const response = await this.axiosClient.post('/rpc/command/get-all-projects', null);
    return response.data;
  }

  async getProjectFiles(projectId: string): Promise<PenpotFile[]> {
    await this.authenticate();
    const params = transit.map([
      transit.keyword('project-id'), projectId,
    ]);
    const response = await this.axiosClient.post('/rpc/command/get-project-files', params);
    return response.data;
  }

  async getFile(fileId: string): Promise<PenpotFile> {
    await this.authenticate();
    const params = transit.map([
      transit.keyword('id'), fileId,
    ]);
    const response = await this.axiosClient.post('/rpc/command/get-file', params);
    return response.data;
  }

  async getPage(fileId: string, pageId?: string): Promise<PenpotPage> {
    await this.authenticate();
    const paramList = [transit.keyword('file-id'), fileId];
    if (pageId) {
      paramList.push(transit.keyword('page-id'), pageId);
    }
    const params = transit.map(paramList);
    const response = await this.axiosClient.post('/rpc/command/get-page', params);
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
    // In Penpot, frameId is required. Use pageId as frameId for root-level shapes
    const frameId = options.parentId || options.pageId;

    const change = {
      type: 'add-obj',
      id: shapeId,
      pageId: options.pageId,
      frameId: frameId,
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

    return change.obj as PenpotObject;
  }

  async createEllipse(options: CreateShapeOptions): Promise<PenpotObject> {
    await this.authenticate();
    await this.ensureSession(options.fileId);

    const shapeId = options.id || crypto.randomUUID();
    const frameId = options.parentId || options.pageId;

    const change = {
      type: 'add-obj',
      id: shapeId,
      pageId: options.pageId,
      frameId: frameId,
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

    return change.obj as PenpotObject;
  }

  async createText(options: CreateShapeOptions & { content?: string; fontSize?: number }): Promise<PenpotObject> {
    await this.authenticate();
    await this.ensureSession(options.fileId);

    const shapeId = options.id || crypto.randomUUID();
    const frameId = options.parentId || options.pageId;

    const change = {
      type: 'add-obj',
      id: shapeId,
      pageId: options.pageId,
      frameId: frameId,
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

    return change.obj as PenpotObject;
  }

  async createBoard(options: CreateShapeOptions): Promise<PenpotObject> {
    await this.authenticate();
    await this.ensureSession(options.fileId);

    const boardId = options.id || crypto.randomUUID();
    const frameId = options.parentId || options.pageId;

    const change = {
      type: 'add-obj',
      id: boardId,
      pageId: options.pageId,
      frameId: frameId,
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

    return change.obj as PenpotObject;
  }

  async createPath(options: CreateShapeOptions & { pathData?: string }): Promise<PenpotObject> {
    await this.authenticate();
    await this.ensureSession(options.fileId);

    const shapeId = options.id || crypto.randomUUID();
    const frameId = options.parentId || options.pageId;

    const change = {
      type: 'add-obj',
      id: shapeId,
      pageId: options.pageId,
      frameId: frameId,
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

    return change.obj as PenpotObject;
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
    // Try to use revn=0 to start, as Penpot can handle version conflicts
    // Getting the full file is too large and causes issues
    const revn = 0;

    // Convert changes to Transit maps with keyword keys
    const transitChanges = changes.map(change => {
      const changeMap: any[] = [
        transit.keyword('type'), change.type,
        transit.keyword('id'), change.id,
      ];

      if (change.pageId) {
        changeMap.push(transit.keyword('page-id'), change.pageId);
      }
      if (change.frameId) {
        changeMap.push(transit.keyword('frame-id'), change.frameId);
      }
      if (change.parentId !== undefined) {
        changeMap.push(transit.keyword('parent-id'), change.parentId);
      }
      if (change.index !== undefined) {
        changeMap.push(transit.keyword('index'), change.index);
      }
      if (change.obj) {
        // Convert obj to Transit map with keyword keys
        const objMap: any[] = [];
        for (const [key, value] of Object.entries(change.obj)) {
          objMap.push(transit.keyword(key), value);
        }
        changeMap.push(transit.keyword('obj'), transit.map(objMap));
      }

      return transit.map(changeMap);
    });

    // Penpot API requires Transit keyword encoding
    const params = transit.map([
      transit.keyword('id'), fileId,
      transit.keyword('session-id'), this.sessionId,
      transit.keyword('revn'), revn,
      transit.keyword('changes'), transitChanges,
    ]);

    await this.axiosClient.post('/rpc/command/update-file', params);
  }
}