/**
 * MCP Message Schemas
 *
 * Zod schemas for validating MCP protocol messages.
 * Based on MCP SDK and vespera-scriptorium patterns.
 */

import { z } from 'zod';

/**
 * MCP error schema
 */
export const MCPErrorSchema = z.object({
  code: z.number(),
  message: z.string(),
  data: z.unknown().optional()
});

export type MCPError = z.infer<typeof MCPErrorSchema>;

/**
 * MCP request schema
 */
export const MCPRequestSchema = z.object({
  jsonrpc: z.literal('2.0').optional(),
  id: z.union([z.string(), z.number()]).optional(),
  method: z.string(),
  params: z.record(z.unknown()).optional()
});

export type MCPRequest = z.infer<typeof MCPRequestSchema>;

/**
 * MCP response schema
 */
export const MCPResponseSchema = z.object({
  jsonrpc: z.literal('2.0').optional(),
  id: z.union([z.string(), z.number()]),
  result: z.unknown().optional(),
  error: MCPErrorSchema.optional()
});

export type MCPResponse = z.infer<typeof MCPResponseSchema>;

/**
 * Standard success response
 */
export const MCPSuccessResponseSchema = z.object({
  success: z.literal(true),
  data: z.unknown().optional(),
  message: z.string().optional()
});

export type MCPSuccessResponse = z.infer<typeof MCPSuccessResponseSchema>;

/**
 * Standard error response (from vespera-scriptorium)
 */
export const MCPErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  error_code: z.string(),
  operation: z.string(),
  context: z.record(z.unknown()).optional(),
  suggestions: z.array(z.string()).optional()
});

export type MCPErrorResponse = z.infer<typeof MCPErrorResponseSchema>;

/**
 * Tool definition schema
 */
export const ToolDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  inputSchema: z.record(z.unknown()),
  outputSchema: z.record(z.unknown()).optional()
});

export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;

/**
 * Resource definition schema
 */
export const ResourceDefinitionSchema = z.object({
  uri: z.string(),
  name: z.string(),
  description: z.string().optional(),
  mimeType: z.string().optional()
});

export type ResourceDefinition = z.infer<typeof ResourceDefinitionSchema>;