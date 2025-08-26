import { z } from 'zod';

// Base layer schema (permissive) allowing future extensions via catch-all.
const LayerBase = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  type: z.string().min(1), // will refine in unions below when known
  disabled: z.boolean().optional(),
});

const Raster = LayerBase.extend({
  type: z.literal('raster'),
  template: z
    .string()
    .min(1)
    .refine(
      (v: string) => /\{z\}\/\{x\}\/\{y\}/.test(v) || /^https?:/.test(v) || v.startsWith('/'),
      'raster.template should contain {z}/{x}/{y} or be absolute/relative URL',
    ),
});

const Vector = LayerBase.extend({
  type: z.literal('vector'),
  url: z
    .string()
    .min(1)
    .refine(
      (v: string) => /^https?:/.test(v) || v.startsWith('/'),
      'vector.url should be absolute or root-relative',
    ),
});

const GeoJSON = LayerBase.extend({
  type: z.literal('geojson'),
  url: z
    .string()
    .min(1)
    .refine(
      (v: string) => /^https?:/.test(v) || v.startsWith('/'),
      'geojson.url should be absolute or root-relative',
    ),
});

export const CatalogSchema = z.array(
  Raster.or(Vector).or(GeoJSON).or(LayerBase), // fallback LayerBase to allow new types
);

export type CatalogLayer =
  | z.infer<typeof Raster>
  | z.infer<typeof Vector>
  | z.infer<typeof GeoJSON>
  | z.infer<typeof LayerBase>;

export function validateCatalog(data: unknown): CatalogLayer[] {
  const layers = CatalogSchema.parse(data);
  const seen = new Set<string>();
  for (const l of layers) {
    if (seen.has(l.slug)) throw new Error(`Duplicate slug: ${l.slug}`);
    seen.add(l.slug);
  }
  return layers;
}
