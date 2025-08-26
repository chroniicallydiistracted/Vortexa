import { z } from 'zod';
// Base layer schema (permissive) allowing future extensions via catch-all.
// Use a raw base schema that can be extended using `.extend()`.
const RawLayerBase = z.object({
    slug: z.string().min(1),
    name: z.string().min(1).optional(),
    suggested_label: z.string().min(1).optional(),
    type: z.string().min(1), // will refine in unions below when known
    disabled: z.boolean().optional(),
});
const Raster = RawLayerBase.extend({
    type: z.literal('raster'),
    template: z
        .string()
        .min(1)
        .refine((v) => /\{z\}\/\{x\}\/\{y\}/.test(v) || /^https?:/.test(v) || v.startsWith('/'), 'raster.template should contain {z}/{x}/{y} or be absolute/relative URL'),
});
const Vector = RawLayerBase.extend({
    type: z.literal('vector'),
    url: z
        .string()
        .min(1)
        .refine((v) => /^https?:/.test(v) || v.startsWith('/'), 'vector.url should be absolute or root-relative'),
});
const GeoJSON = RawLayerBase.extend({
    type: z.literal('geojson'),
    url: z
        .string()
        .min(1)
        .refine((v) => /^https?:/.test(v) || v.startsWith('/'), 'geojson.url should be absolute or root-relative'),
});
export const CatalogSchema = z.array(Raster.or(Vector).or(GeoJSON).or(RawLayerBase));
export function validateCatalog(data) {
    // Accept either an array of layers or an object with a `layers` array (runtime catalog).
    let rawLayers;
    if (Array.isArray(data))
        rawLayers = data;
    else if (data && typeof data === 'object' && 'layers' in data)
        rawLayers = data.layers;
    else
        rawLayers = data;
    // Normalize common alternate keys so the Zod schema can validate consistently.
    const normalized = (Array.isArray(rawLayers) ? rawLayers : []).map((l) => ({
        ...l,
        // prefer explicit fields, but fall back to common alternate names
        type: l.type || l.source_type || l.sourceType || undefined,
        template: l.template || l.tile_url_template || l.tile_url || l.tileUrl || undefined,
        url: l.url || l.api_endpoint || l.apiEndpoint || undefined,
        name: l.name || l.suggested_label || l.suggestedLabel || undefined,
    }));
    const layers = CatalogSchema.parse(normalized);
    const seen = new Set();
    for (const l of layers) {
        if (seen.has(l.slug))
            throw new Error(`Duplicate slug: ${l.slug}`);
        seen.add(l.slug);
    }
    return layers;
}
