/**
 * Penpot Type Schemas
 *
 * Zod schemas for validating Penpot API types.
 * Based on Penpot API documentation and vespera-penpot-bridge types.
 */

import { z } from 'zod';

/**
 * Color validation (hex format)
 */
export const HexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

/**
 * UUID validation
 */
export const UUIDSchema = z.string().uuid();

/**
 * Fill schema
 */
export const FillSchema = z.object({
  fillColor: HexColorSchema,
  fillOpacity: z.number().min(0).max(1).optional(),
  fillColorGradient: z.any().optional(), // TODO: Define gradient schema
  fillColorRefFile: UUIDSchema.optional(),
  fillColorRefId: UUIDSchema.optional(),
  fillImage: z.any().optional() // TODO: Define image schema
});

export type Fill = z.infer<typeof FillSchema>;

/**
 * Stroke schema
 */
export const StrokeSchema = z.object({
  strokeColor: HexColorSchema,
  strokeOpacity: z.number().min(0).max(1).optional(),
  strokeStyle: z.enum(['solid', 'dotted', 'dashed', 'mixed']).optional(),
  strokeWidth: z.number().positive().optional(),
  strokeAlignment: z.enum(['center', 'inner', 'outer']).optional(),
  strokeCapStart: z.enum(['round', 'square', 'line-arrow', 'triangle-arrow', 'diamond-arrow', 'circle-marker', 'square-marker']).optional(),
  strokeCapEnd: z.enum(['round', 'square', 'line-arrow', 'triangle-arrow', 'diamond-arrow', 'circle-marker', 'square-marker']).optional(),
  strokeColorRefFile: UUIDSchema.optional(),
  strokeColorRefId: UUIDSchema.optional()
});

export type Stroke = z.infer<typeof StrokeSchema>;

/**
 * Shadow schema
 */
export const ShadowSchema = z.object({
  id: UUIDSchema.optional(),
  style: z.enum(['drop-shadow', 'inner-shadow']),
  offsetX: z.number(),
  offsetY: z.number(),
  blur: z.number().nonnegative(),
  spread: z.number().optional(),
  hidden: z.boolean().optional(),
  color: z.object({
    color: HexColorSchema,
    opacity: z.number().min(0).max(1)
  })
});

export type Shadow = z.infer<typeof ShadowSchema>;

/**
 * Blur schema
 */
export const BlurSchema = z.object({
  id: UUIDSchema.optional(),
  type: z.enum(['layer-blur']),
  value: z.number().nonnegative(),
  hidden: z.boolean().optional()
});

export type Blur = z.infer<typeof BlurSchema>;

/**
 * Penpot object type
 */
export const PenpotObjectTypeSchema = z.enum([
  'frame',
  'rect',
  'circle',
  'path',
  'text',
  'image',
  'svg-raw',
  'group',
  'bool',
  'multiple'
]);

export type PenpotObjectType = z.infer<typeof PenpotObjectTypeSchema>;

/**
 * Base shape properties
 */
export const BaseShapeSchema = z.object({
  id: UUIDSchema,
  name: z.string(),
  type: PenpotObjectTypeSchema,
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  rotation: z.number().optional(),
  opacity: z.number().min(0).max(1).optional(),
  blendMode: z.string().optional(),
  blocked: z.boolean().optional(),
  hidden: z.boolean().optional(),
  fills: z.array(FillSchema).optional(),
  strokes: z.array(StrokeSchema).optional(),
  shadows: z.array(ShadowSchema).optional(),
  blur: BlurSchema.optional(),
  children: z.array(UUIDSchema).optional()
});

export type BaseShape = z.infer<typeof BaseShapeSchema>;

/**
 * Rectangle-specific properties
 */
export const RectangleSchema = BaseShapeSchema.extend({
  type: z.literal('rect'),
  rx: z.number().nonnegative().optional(), // Border radius X
  ry: z.number().nonnegative().optional(), // Border radius Y
  r1: z.number().nonnegative().optional(), // Top-left radius
  r2: z.number().nonnegative().optional(), // Top-right radius
  r3: z.number().nonnegative().optional(), // Bottom-right radius
  r4: z.number().nonnegative().optional()  // Bottom-left radius
});

export type Rectangle = z.infer<typeof RectangleSchema>;

/**
 * Ellipse/Circle-specific properties
 */
export const EllipseSchema = BaseShapeSchema.extend({
  type: z.literal('circle')
});

export type Ellipse = z.infer<typeof EllipseSchema>;

/**
 * Text-specific properties
 */
export const TextSchema = BaseShapeSchema.extend({
  type: z.literal('text'),
  content: z.string(),
  fontId: z.string().optional(),
  fontFamily: z.string().optional(),
  fontSize: z.string().optional(), // String because it can be like "16px"
  fontWeight: z.string().optional(),
  fontStyle: z.enum(['normal', 'italic']).optional(),
  textDecoration: z.enum(['none', 'underline', 'line-through']).optional(),
  textTransform: z.enum(['none', 'uppercase', 'lowercase', 'capitalize']).optional(),
  lineHeight: z.string().optional(),
  letterSpacing: z.string().optional(),
  textAlign: z.enum(['left', 'center', 'right', 'justify']).optional(),
  verticalAlign: z.enum(['top', 'center', 'bottom']).optional()
});

export type Text = z.infer<typeof TextSchema>;

/**
 * Path-specific properties
 */
export const PathSchema = BaseShapeSchema.extend({
  type: z.literal('path'),
  content: z.string() // SVG path data
});

export type Path = z.infer<typeof PathSchema>;

/**
 * Frame-specific properties (boards/artboards)
 */
export const FrameSchema = BaseShapeSchema.extend({
  type: z.literal('frame'),
  showContent: z.boolean().optional(),
  hideInViewer: z.boolean().optional(),
  layout: z.enum(['flex', 'grid', 'none']).optional(),
  layoutFlexDir: z.enum(['row', 'column', 'row-reverse', 'column-reverse']).optional(),
  layoutWrap: z.enum(['wrap', 'nowrap']).optional(),
  layoutJustifyContent: z.enum(['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly']).optional(),
  layoutAlignItems: z.enum(['flex-start', 'flex-end', 'center', 'stretch', 'baseline']).optional(),
  layoutGap: z.number().nonnegative().optional(),
  layoutPaddingTop: z.number().nonnegative().optional(),
  layoutPaddingRight: z.number().nonnegative().optional(),
  layoutPaddingBottom: z.number().nonnegative().optional(),
  layoutPaddingLeft: z.number().nonnegative().optional()
});

export type Frame = z.infer<typeof FrameSchema>;

/**
 * Generic Penpot object (union of all shape types)
 */
export const PenpotObjectSchema = z.union([
  BaseShapeSchema,
  RectangleSchema,
  EllipseSchema,
  TextSchema,
  PathSchema,
  FrameSchema
]);

export type PenpotObject = z.infer<typeof PenpotObjectSchema>;

/**
 * Penpot page schema
 */
export const PenpotPageSchema = z.object({
  id: UUIDSchema,
  name: z.string(),
  objects: z.record(UUIDSchema, PenpotObjectSchema)
});

export type PenpotPage = z.infer<typeof PenpotPageSchema>;

/**
 * Penpot file schema (simplified)
 */
export const PenpotFileSchema = z.object({
  id: UUIDSchema,
  name: z.string(),
  projectId: UUIDSchema.optional(),
  pages: z.array(UUIDSchema).optional(),
  pagesIndex: z.record(UUIDSchema, PenpotPageSchema).optional()
});

export type PenpotFile = z.infer<typeof PenpotFileSchema>;

/**
 * Penpot project schema
 */
export const PenpotProjectSchema = z.object({
  id: UUIDSchema,
  name: z.string(),
  teamId: UUIDSchema.optional(),
  isDefault: z.boolean().optional(),
  modifiedAt: z.string().datetime().optional()
});

export type PenpotProject = z.infer<typeof PenpotProjectSchema>;