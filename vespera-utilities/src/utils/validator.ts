import { z } from 'zod';

/**
 * Server configuration schema
 */
export const ServerConfigSchema = z.object({
  server: z.object({
    name: z.string().min(1),
    version: z.string().min(1),
    port: z.number().int().min(1).max(65535),
    host: z.string().optional(),
    transport: z.enum(['streamable-http', 'stdio']),
    sessionTimeout: z.number().int().min(1000).optional()
  }),
  plugins: z.object({
    enabled: z.array(z.string()),
    directory: z.string().min(1),
    autoload: z.boolean(),
    watchForChanges: z.boolean().optional(),
    configs: z.record(z.record(z.unknown())).optional()
  }),
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']),
    format: z.enum(['json', 'pretty']),
    file: z.string().optional(),
    maxFiles: z.number().int().min(1).optional(),
    maxSize: z.string().optional()
  })
});

/**
 * Plugin manifest schema
 */
export const PluginManifestSchema = z.object({
  id: z.string().min(1).regex(/^[a-z0-9-_]+$/),
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string().min(1),
  main: z.string().min(1),
  author: z.string().optional(),
  license: z.string().optional(),
  repository: z.string().url().optional(),
  dependencies: z.array(z.string()).optional(),
  peerDependencies: z.record(z.string()).optional(),
  vesperaPlugin: z.object({
    capabilities: z.array(z.string()),
    configSchema: z.record(z.unknown()).optional()
  })
});

/**
 * Validate configuration object
 */
export function validateConfig(config: unknown): asserts config is z.infer<typeof ServerConfigSchema> {
  ServerConfigSchema.parse(config);
}

/**
 * Validate plugin manifest
 */
export function validatePluginManifest(manifest: unknown): asserts manifest is z.infer<typeof PluginManifestSchema> {
  PluginManifestSchema.parse(manifest);
}

/**
 * Safe validation with result
 */
export function safeValidateConfig(config: unknown): {
  success: boolean;
  data?: z.infer<typeof ServerConfigSchema>;
  error?: z.ZodError;
} {
  const result = ServerConfigSchema.safeParse(config);
  return {
    success: result.success,
    data: result.success ? result.data : undefined,
    error: !result.success ? result.error : undefined
  };
}

/**
 * Safe validation of plugin manifest
 */
export function safeValidatePluginManifest(manifest: unknown): {
  success: boolean;
  data?: z.infer<typeof PluginManifestSchema>;
  error?: z.ZodError;
} {
  const result = PluginManifestSchema.safeParse(manifest);
  return {
    success: result.success,
    data: result.success ? result.data : undefined,
    error: !result.success ? result.error : undefined
  };
}