/**
 * Resource registration for MCP server
 */

import { Resource } from '@modelcontextprotocol/sdk/types.js';

export function registerResources(): { resources: Resource[] } {
  return {
    resources: [
      {
        uri: 'penpot://schema',
        name: 'Penpot API Schema',
        description: 'Schema definition for the Penpot API',
        mimeType: 'application/json',
      },
      {
        uri: 'penpot://tree-schema',
        name: 'Penpot Tree Schema',
        description: 'Schema for Penpot object tree structure',
        mimeType: 'application/json',
      },
      {
        uri: 'penpot://cached-files',
        name: 'Cached Files',
        description: 'List of currently cached Penpot files',
        mimeType: 'application/json',
      },
    ],
  };
}