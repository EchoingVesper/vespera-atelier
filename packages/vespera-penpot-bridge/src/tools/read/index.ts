/**
 * Read operation tools for Penpot MCP server
 * Based on original penpot-mcp functionality
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PenpotAPIClient } from '../../penpot-api/client.js';
import { FileCache } from '../../utils/cache.js';

export async function registerReadTools(
  client: PenpotAPIClient,
  cache: FileCache
): Promise<Tool[]> {
  return [
    {
      name: 'list_projects',
      description: 'List all Penpot projects',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    {
      name: 'get_project_files',
      description: 'Get all files in a Penpot project',
      inputSchema: {
        type: 'object',
        properties: {
          project_id: {
            type: 'string',
            description: 'The ID of the project',
          },
        },
        required: ['project_id'],
      },
    },
    {
      name: 'get_file',
      description: 'Get a Penpot file by ID and cache it',
      inputSchema: {
        type: 'object',
        properties: {
          file_id: {
            type: 'string',
            description: 'The ID of the file to retrieve',
          },
        },
        required: ['file_id'],
      },
    },
    {
      name: 'get_object_tree',
      description: 'Get the object tree structure for a Penpot object',
      inputSchema: {
        type: 'object',
        properties: {
          file_id: {
            type: 'string',
            description: 'The ID of the file',
          },
          object_id: {
            type: 'string',
            description: 'The ID of the object to retrieve',
          },
          fields: {
            type: 'array',
            items: { type: 'string' },
            description: 'Specific fields to include in the tree',
          },
          depth: {
            type: 'number',
            description: 'How deep to traverse the tree (-1 for full depth)',
            default: -1,
          },
          format: {
            type: 'string',
            enum: ['json', 'yaml'],
            description: 'Output format',
            default: 'json',
          },
        },
        required: ['file_id', 'object_id', 'fields'],
      },
    },
    {
      name: 'search_object',
      description: 'Search for objects within a Penpot file by name',
      inputSchema: {
        type: 'object',
        properties: {
          file_id: {
            type: 'string',
            description: 'The ID of the file to search in',
          },
          query: {
            type: 'string',
            description: 'Search string (supports regex patterns)',
          },
        },
        required: ['file_id', 'query'],
      },
    },
    {
      name: 'export_object',
      description: 'Export a Penpot design object as an image',
      inputSchema: {
        type: 'object',
        properties: {
          file_id: {
            type: 'string',
            description: 'The ID of the file',
          },
          page_id: {
            type: 'string',
            description: 'The ID of the page containing the object',
          },
          object_id: {
            type: 'string',
            description: 'The ID of the object to export',
          },
          export_type: {
            type: 'string',
            enum: ['png', 'svg', 'pdf'],
            description: 'Image format',
            default: 'png',
          },
          scale: {
            type: 'number',
            description: 'Scale factor for the exported image',
            default: 1,
            minimum: 0.5,
            maximum: 4,
          },
        },
        required: ['file_id', 'page_id', 'object_id'],
      },
    },
  ];
}