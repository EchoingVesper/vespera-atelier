#!/usr/bin/env node

/**
 * Vespera Penpot Bridge - MCP Server
 *
 * Based on penpot-mcp by Montevive AI Team (MIT License)
 * Extended with write capabilities for AI-driven design creation
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import { PenpotAPIClient } from './penpot-api/client.js';
import { registerReadTools } from './tools/read/index.js';
import { registerWriteTools } from './tools/write/index.js';
import { registerResources } from './tools/resources.js';
import { FileCache } from './utils/cache.js';
import { logger } from './utils/logger.js';

// Load environment variables
dotenv.config();

export class VesperaPenpotBridge {
  private server: Server;
  private penpotClient: PenpotAPIClient;
  private fileCache: FileCache;
  private tools: Map<string, Tool>;

  constructor() {
    // Initialize server
    this.server = new Server(
      {
        name: 'vespera-penpot-bridge',
        version: '0.1.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    // Initialize Penpot API client
    this.penpotClient = new PenpotAPIClient({
      baseUrl: process.env.PENPOT_API_URL || 'https://design.penpot.app/api',
      username: process.env.PENPOT_USERNAME,
      password: process.env.PENPOT_PASSWORD,
      accessToken: process.env.PENPOT_ACCESS_TOKEN,
    });

    // Initialize cache
    this.fileCache = new FileCache(600); // 10 minutes TTL

    // Initialize tools map
    this.tools = new Map();

    // Register handlers
    this.registerHandlers();
  }

  private registerHandlers() {
    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return registerResources();
    });

    // Read resource content
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      if (uri === 'penpot://schema') {
        return {
          contents: [{
            uri: 'penpot://schema',
            mimeType: 'application/json',
            text: JSON.stringify(await this.penpotClient.getAPISchema(), null, 2),
          }],
        };
      }

      if (uri === 'penpot://tree-schema') {
        return {
          contents: [{
            uri: 'penpot://tree-schema',
            mimeType: 'application/json',
            text: JSON.stringify(await this.penpotClient.getTreeSchema(), null, 2),
          }],
        };
      }

      if (uri.startsWith('penpot://cached-files')) {
        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(this.fileCache.getAllKeys(), null, 2),
          }],
        };
      }

      throw new McpError(ErrorCode.InvalidRequest, `Unknown resource: ${uri}`);
    });

    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const readTools = await registerReadTools(this.penpotClient, this.fileCache);
      const writeTools = await registerWriteTools(this.penpotClient, this.fileCache);

      const allTools = [...readTools, ...writeTools];

      // Store tools for later use
      allTools.forEach(tool => {
        this.tools.set(tool.name, tool);
      });

      return { tools: allTools };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        // Authenticate if needed
        if (!this.penpotClient.isAuthenticated()) {
          await this.penpotClient.authenticate();
        }

        // Route to appropriate tool handler
        switch (name) {
          // Read operations
          case 'list_projects':
            return await this.handleListProjects();
          case 'get_project_files':
            return await this.handleGetProjectFiles(args);
          case 'get_file':
            return await this.handleGetFile(args);
          case 'get_object_tree':
            return await this.handleGetObjectTree(args);
          case 'search_object':
            return await this.handleSearchObject(args);
          case 'export_object':
            return await this.handleExportObject(args);

          // Write operations (new)
          case 'create_rectangle':
            return await this.handleCreateRectangle(args);
          case 'create_ellipse':
            return await this.handleCreateEllipse(args);
          case 'create_text':
            return await this.handleCreateText(args);
          case 'create_board':
            return await this.handleCreateBoard(args);
          case 'create_path':
            return await this.handleCreatePath(args);
          case 'append_to_parent':
            return await this.handleAppendToParent(args);
          case 'apply_styles':
            return await this.handleApplyStyles(args);
          case 'set_flex_layout':
            return await this.handleSetFlexLayout(args);
          case 'update_object':
            return await this.handleUpdateObject(args);

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        logger.error(`Error executing tool ${name}:`, error);

        if (error instanceof McpError) {
          throw error;
        }

        throw new McpError(
          ErrorCode.InternalError,
          `Failed to execute tool: ${error.message}`
        );
      }
    });
  }

  // Read operation handlers
  private async handleListProjects() {
    const projects = await this.penpotClient.listProjects();
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(projects, null, 2),
      }],
    };
  }

  private async handleGetProjectFiles(args: any) {
    const { project_id } = args;
    if (!project_id) {
      throw new McpError(ErrorCode.InvalidParams, 'project_id is required');
    }

    const files = await this.penpotClient.getProjectFiles(project_id);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(files, null, 2),
      }],
    };
  }

  private async handleGetFile(args: any) {
    const { file_id } = args;
    if (!file_id) {
      throw new McpError(ErrorCode.InvalidParams, 'file_id is required');
    }

    // Check cache first
    let file = this.fileCache.get(file_id);
    if (!file) {
      file = await this.penpotClient.getFile(file_id);
      this.fileCache.set(file_id, file);
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(file, null, 2),
      }],
    };
  }

  private async handleGetObjectTree(args: any) {
    const { file_id, object_id, fields, depth = -1 } = args;

    if (!file_id || !object_id) {
      throw new McpError(ErrorCode.InvalidParams, 'file_id and object_id are required');
    }

    const file = await this.handleGetFile({ file_id });
    const tree = await this.penpotClient.getObjectTree(file, object_id, fields, depth);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(tree, null, 2),
      }],
    };
  }

  private async handleSearchObject(args: any) {
    const { file_id, query } = args;

    if (!file_id || !query) {
      throw new McpError(ErrorCode.InvalidParams, 'file_id and query are required');
    }

    const results = await this.penpotClient.searchObjects(file_id, query);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(results, null, 2),
      }],
    };
  }

  private async handleExportObject(args: any) {
    const { file_id, page_id, object_id, export_type = 'png', scale = 1 } = args;

    if (!file_id || !page_id || !object_id) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'file_id, page_id, and object_id are required'
      );
    }

    const exportData = await this.penpotClient.exportObject(
      file_id,
      page_id,
      object_id,
      export_type,
      scale
    );

    return {
      content: [{
        type: 'image',
        data: exportData.base64,
        mimeType: `image/${export_type}`,
      }],
    };
  }

  // Write operation handlers (new functionality)
  private async handleCreateRectangle(args: any) {
    const result = await this.penpotClient.createRectangle(args);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }

  private async handleCreateEllipse(args: any) {
    const result = await this.penpotClient.createEllipse(args);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }

  private async handleCreateText(args: any) {
    const result = await this.penpotClient.createText(args);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }

  private async handleCreateBoard(args: any) {
    const result = await this.penpotClient.createBoard(args);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }

  private async handleCreatePath(args: any) {
    const result = await this.penpotClient.createPath(args);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }

  private async handleAppendToParent(args: any) {
    const { parent_id, child_id } = args;
    if (!parent_id || !child_id) {
      throw new McpError(ErrorCode.InvalidParams, 'parent_id and child_id are required');
    }

    const result = await this.penpotClient.appendToParent(parent_id, child_id);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }

  private async handleApplyStyles(args: any) {
    const { object_id, styles } = args;
    if (!object_id || !styles) {
      throw new McpError(ErrorCode.InvalidParams, 'object_id and styles are required');
    }

    const result = await this.penpotClient.applyStyles(object_id, styles);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }

  private async handleSetFlexLayout(args: any) {
    const { board_id, layout_config } = args;
    if (!board_id || !layout_config) {
      throw new McpError(ErrorCode.InvalidParams, 'board_id and layout_config are required');
    }

    const result = await this.penpotClient.setFlexLayout(board_id, layout_config);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }

  private async handleUpdateObject(args: any) {
    const { object_id, updates } = args;
    if (!object_id || !updates) {
      throw new McpError(ErrorCode.InvalidParams, 'object_id and updates are required');
    }

    const result = await this.penpotClient.updateObject(object_id, updates);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('Vespera Penpot Bridge MCP Server started');
  }
}

// Start the server
const server = new VesperaPenpotBridge();
server.start().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});