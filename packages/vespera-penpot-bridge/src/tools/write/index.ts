/**
 * Write operation tools for Penpot MCP server
 * New functionality for AI-driven design creation
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PenpotAPIClient } from '../../penpot-api/client.js';
import { FileCache } from '../../utils/cache.js';

export async function registerWriteTools(
  client: PenpotAPIClient,
  cache: FileCache
): Promise<Tool[]> {
  return [
    {
      name: 'create_rectangle',
      description: 'Create a rectangle shape in a Penpot design',
      inputSchema: {
        type: 'object',
        properties: {
          file_id: {
            type: 'string',
            description: 'The ID of the file',
          },
          page_id: {
            type: 'string',
            description: 'The ID of the page',
          },
          name: {
            type: 'string',
            description: 'Name of the rectangle',
            default: 'Rectangle',
          },
          x: {
            type: 'number',
            description: 'X position',
            default: 0,
          },
          y: {
            type: 'number',
            description: 'Y position',
            default: 0,
          },
          width: {
            type: 'number',
            description: 'Width of the rectangle',
            default: 100,
          },
          height: {
            type: 'number',
            description: 'Height of the rectangle',
            default: 100,
          },
          fills: {
            type: 'array',
            description: 'Fill colors and styles',
            items: {
              type: 'object',
              properties: {
                color: { type: 'string' },
                opacity: { type: 'number', minimum: 0, maximum: 1 },
              },
            },
          },
          strokes: {
            type: 'array',
            description: 'Stroke colors and styles',
            items: {
              type: 'object',
              properties: {
                color: { type: 'string' },
                width: { type: 'number' },
                opacity: { type: 'number', minimum: 0, maximum: 1 },
              },
            },
          },
          parent_id: {
            type: 'string',
            description: 'Optional parent container ID',
          },
        },
        required: ['file_id', 'page_id'],
      },
    },
    {
      name: 'create_ellipse',
      description: 'Create an ellipse or circle shape in a Penpot design',
      inputSchema: {
        type: 'object',
        properties: {
          file_id: {
            type: 'string',
            description: 'The ID of the file',
          },
          page_id: {
            type: 'string',
            description: 'The ID of the page',
          },
          name: {
            type: 'string',
            description: 'Name of the ellipse',
            default: 'Ellipse',
          },
          x: {
            type: 'number',
            description: 'X position',
            default: 0,
          },
          y: {
            type: 'number',
            description: 'Y position',
            default: 0,
          },
          width: {
            type: 'number',
            description: 'Width of the ellipse',
            default: 100,
          },
          height: {
            type: 'number',
            description: 'Height of the ellipse',
            default: 100,
          },
          fills: {
            type: 'array',
            description: 'Fill colors and styles',
            items: {
              type: 'object',
              properties: {
                color: { type: 'string' },
                opacity: { type: 'number', minimum: 0, maximum: 1 },
              },
            },
          },
          strokes: {
            type: 'array',
            description: 'Stroke colors and styles',
            items: {
              type: 'object',
              properties: {
                color: { type: 'string' },
                width: { type: 'number' },
                opacity: { type: 'number', minimum: 0, maximum: 1 },
              },
            },
          },
          parent_id: {
            type: 'string',
            description: 'Optional parent container ID',
          },
        },
        required: ['file_id', 'page_id'],
      },
    },
    {
      name: 'create_text',
      description: 'Create a text element in a Penpot design',
      inputSchema: {
        type: 'object',
        properties: {
          file_id: {
            type: 'string',
            description: 'The ID of the file',
          },
          page_id: {
            type: 'string',
            description: 'The ID of the page',
          },
          content: {
            type: 'string',
            description: 'Text content',
            default: 'Text',
          },
          name: {
            type: 'string',
            description: 'Name of the text element',
            default: 'Text',
          },
          x: {
            type: 'number',
            description: 'X position',
            default: 0,
          },
          y: {
            type: 'number',
            description: 'Y position',
            default: 0,
          },
          width: {
            type: 'number',
            description: 'Width of the text container',
            default: 200,
          },
          height: {
            type: 'number',
            description: 'Height of the text container',
            default: 40,
          },
          font_size: {
            type: 'number',
            description: 'Font size in pixels',
            default: 16,
          },
          font_family: {
            type: 'string',
            description: 'Font family name',
            default: 'Inter',
          },
          font_weight: {
            type: 'number',
            description: 'Font weight (100-900)',
            default: 400,
          },
          fills: {
            type: 'array',
            description: 'Text color',
            items: {
              type: 'object',
              properties: {
                color: { type: 'string' },
                opacity: { type: 'number', minimum: 0, maximum: 1 },
              },
            },
          },
          parent_id: {
            type: 'string',
            description: 'Optional parent container ID',
          },
        },
        required: ['file_id', 'page_id', 'content'],
      },
    },
    {
      name: 'create_board',
      description: 'Create a board (artboard/frame) in a Penpot design',
      inputSchema: {
        type: 'object',
        properties: {
          file_id: {
            type: 'string',
            description: 'The ID of the file',
          },
          page_id: {
            type: 'string',
            description: 'The ID of the page',
          },
          name: {
            type: 'string',
            description: 'Name of the board',
            default: 'Board',
          },
          x: {
            type: 'number',
            description: 'X position',
            default: 0,
          },
          y: {
            type: 'number',
            description: 'Y position',
            default: 0,
          },
          width: {
            type: 'number',
            description: 'Width of the board',
            default: 375,
          },
          height: {
            type: 'number',
            description: 'Height of the board',
            default: 812,
          },
          fills: {
            type: 'array',
            description: 'Background fill',
            items: {
              type: 'object',
              properties: {
                color: { type: 'string' },
                opacity: { type: 'number', minimum: 0, maximum: 1 },
              },
            },
          },
          parent_id: {
            type: 'string',
            description: 'Optional parent container ID',
          },
        },
        required: ['file_id', 'page_id'],
      },
    },
    {
      name: 'create_path',
      description: 'Create a vector path shape in a Penpot design',
      inputSchema: {
        type: 'object',
        properties: {
          file_id: {
            type: 'string',
            description: 'The ID of the file',
          },
          page_id: {
            type: 'string',
            description: 'The ID of the page',
          },
          path_data: {
            type: 'string',
            description: 'SVG path data string',
            default: 'M 0 0 L 100 100',
          },
          name: {
            type: 'string',
            description: 'Name of the path',
            default: 'Path',
          },
          x: {
            type: 'number',
            description: 'X position',
            default: 0,
          },
          y: {
            type: 'number',
            description: 'Y position',
            default: 0,
          },
          width: {
            type: 'number',
            description: 'Width of the path bounds',
            default: 100,
          },
          height: {
            type: 'number',
            description: 'Height of the path bounds',
            default: 100,
          },
          fills: {
            type: 'array',
            description: 'Fill colors and styles',
            items: {
              type: 'object',
              properties: {
                color: { type: 'string' },
                opacity: { type: 'number', minimum: 0, maximum: 1 },
              },
            },
          },
          strokes: {
            type: 'array',
            description: 'Stroke colors and styles',
            items: {
              type: 'object',
              properties: {
                color: { type: 'string' },
                width: { type: 'number' },
                opacity: { type: 'number', minimum: 0, maximum: 1 },
              },
            },
          },
          parent_id: {
            type: 'string',
            description: 'Optional parent container ID',
          },
        },
        required: ['file_id', 'page_id'],
      },
    },
    {
      name: 'append_to_parent',
      description: 'Add a shape to a parent container (board or group)',
      inputSchema: {
        type: 'object',
        properties: {
          parent_id: {
            type: 'string',
            description: 'The ID of the parent container',
          },
          child_id: {
            type: 'string',
            description: 'The ID of the child shape to add',
          },
        },
        required: ['parent_id', 'child_id'],
      },
    },
    {
      name: 'apply_styles',
      description: 'Apply styles to an existing object',
      inputSchema: {
        type: 'object',
        properties: {
          object_id: {
            type: 'string',
            description: 'The ID of the object to style',
          },
          styles: {
            type: 'object',
            properties: {
              fills: {
                type: 'array',
                description: 'Fill colors and styles',
                items: {
                  type: 'object',
                  properties: {
                    color: { type: 'string' },
                    opacity: { type: 'number', minimum: 0, maximum: 1 },
                  },
                },
              },
              strokes: {
                type: 'array',
                description: 'Stroke colors and styles',
                items: {
                  type: 'object',
                  properties: {
                    color: { type: 'string' },
                    width: { type: 'number' },
                    opacity: { type: 'number', minimum: 0, maximum: 1 },
                  },
                },
              },
              opacity: {
                type: 'number',
                description: 'Overall opacity',
                minimum: 0,
                maximum: 1,
              },
              shadows: {
                type: 'array',
                description: 'Shadow effects',
                items: {
                  type: 'object',
                  properties: {
                    color: { type: 'string' },
                    offsetX: { type: 'number' },
                    offsetY: { type: 'number' },
                    blur: { type: 'number' },
                  },
                },
              },
            },
          },
        },
        required: ['object_id', 'styles'],
      },
    },
    {
      name: 'set_flex_layout',
      description: 'Configure flex layout for a board',
      inputSchema: {
        type: 'object',
        properties: {
          board_id: {
            type: 'string',
            description: 'The ID of the board',
          },
          layout_config: {
            type: 'object',
            properties: {
              direction: {
                type: 'string',
                enum: ['row', 'column', 'row-reverse', 'column-reverse'],
                description: 'Flex direction',
                default: 'row',
              },
              wrap: {
                type: 'string',
                enum: ['nowrap', 'wrap', 'wrap-reverse'],
                description: 'Flex wrap',
                default: 'nowrap',
              },
              align_items: {
                type: 'string',
                enum: ['flex-start', 'flex-end', 'center', 'stretch', 'baseline'],
                description: 'Align items',
                default: 'stretch',
              },
              justify_content: {
                type: 'string',
                enum: ['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly'],
                description: 'Justify content',
                default: 'flex-start',
              },
              gap: {
                type: 'number',
                description: 'Gap between items',
                default: 0,
              },
            },
          },
        },
        required: ['board_id', 'layout_config'],
      },
    },
    {
      name: 'update_object',
      description: 'Update properties of an existing object',
      inputSchema: {
        type: 'object',
        properties: {
          object_id: {
            type: 'string',
            description: 'The ID of the object to update',
          },
          updates: {
            type: 'object',
            description: 'Object properties to update',
            additionalProperties: true,
          },
        },
        required: ['object_id', 'updates'],
      },
    },
  ];
}