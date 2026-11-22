export type ProductVariantOption = {
  id?: string;
  name: string;
  swatch: string;
  pricePesewas?: number;
  availableCount?: number;
};

export type CatalogProduct = {
  id: string;
  defaultVariantId?: string;
  sku: string;
  name: string;
  category: string;
  pricePesewas: number;
  previousPricePesewas?: number;
  availableCount: number;
  badge?: string;
  image: string;
  rating: string;
  reviewCount: number;
  description: string;
  variants: ProductVariantOption[];
  brand: string;
  condition: string;
  sourceBatch: string;
  defectsNote: string;
  defectDisclosures?: string | null;
};

export const CATALOG_PRODUCTS: CatalogProduct[] = [
  {
    id: 'sofa',
    sku: 'AH-PRD-00018',
    name: 'Haven Three-Seater Sofa',
    category: 'Living room',
    pricePesewas: 895000,
    previousPricePesewas: 980000,
    availableCount: 3,
    badge: 'NEW ARRIVAL',
    image: '/images/sofa.avif',
    rating: '4.9',
    reviewCount: 24,
    description:
      'A thoughtfully selected, high-quality piece imported from the United States. Inspected and prepared by our team for reliable everyday use.',
    variants: [
      { name: 'Emerald velvet', swatch: '#166a4a' },
      { name: 'Warm beige', swatch: '#d6cfc2' },
    ],
    brand: 'American import',
    condition: 'Excellent · Inspected',
    sourceBatch: 'AH-SHP-2026-001',
    defectsNote: 'No material defects were found during inspection.',
  },
  {
    id: 'chair',
    sku: 'AH-PRD-00022',
    name: 'Aero Executive Office Chair',
    category: 'Office',
    pricePesewas: 245000,
    availableCount: 7,
    badge: 'POPULAR',
    image: '/images/chair.avif',
    rating: '4.9',
    reviewCount: 18,
    description:
      'A thoughtfully selected, high-quality piece imported from the United States. Inspected and prepared by our team for reliable everyday use.',
    variants: [
      { name: 'Midnight black', swatch: '#2b3036' },
      { name: 'Stone grey', swatch: '#8b9196' },
    ],
    brand: 'American import',
    condition: 'Excellent · Inspected',
    sourceBatch: 'AH-SHP-2026-001',
    defectsNote: 'No material defects were found during inspection.',
  },
  {
    id: 'blender',
    sku: 'AH-PRD-00031',
    name: 'Ninja Professional Blender',
    category: 'Kitchen',
    pricePesewas: 185000,
    availableCount: 9,
    image: '/images/blender.avif',
    rating: '4.8',
    reviewCount: 15,
    description:
      'High-powered kitchen blender tested and verified for voltage and blade integrity at our Tema warehouse.',
    variants: [{ name: 'Matte black', swatch: '#1f2328' }],
    brand: 'Ninja (US Import)',
    condition: 'Excellent · Tested',
    sourceBatch: 'AH-SHP-2026-002',
    defectsNote: 'No material defects were found during inspection.',
  },
  {
    id: 'bicycle',
    sku: 'AH-PRD-00045',
    name: 'Trail Ridge Mountain Bicycle',
    category: 'Outdoors',
    pricePesewas: 420000,
    availableCount: 2,
    badge: 'ONLY 2 LEFT',
    image: '/images/bicycle.avif',
    rating: '4.9',
    reviewCount: 11,
    description:
      'Rugged trail bicycle tuned and inspected for brake response, gear shifting, and frame alignment.',
    variants: [{ name: 'Carbon black', swatch: '#181b1f' }],
    brand: 'American import',
    condition: 'Excellent · Tuned',
    sourceBatch: 'AH-SHP-2026-002',
    defectsNote: 'Minor surface scuff on pedal crank; mechanically 100% sound.',
  },
  {
    id: 'dining',
    sku: 'AH-PRD-00052',
    name: 'Oakline Dining Set',
    category: 'Dining',
    pricePesewas: 675000,
    availableCount: 4,
    image: '/images/dining.avif',
    rating: '4.8',
    reviewCount: 9,
    description:
      'Solid wood dining table and chairs inspected for joinery stability and surface finish.',
    variants: [{ name: 'Natural oak', swatch: '#b9936c' }],
    brand: 'American import',
    condition: 'Excellent · Inspected',
    sourceBatch: 'AH-SHP-2026-001',
    defectsNote: 'No material defects were found during inspection.',
  },
  {
    id: 'tv',
    sku: 'AH-PRD-00060',
    name: 'Samsung 55″ Crystal UHD TV',
    category: 'Electronics',
    pricePesewas: 720000,
    availableCount: 5,
    image: '/images/tv.avif',
    rating: '4.9',
    reviewCount: 21,
    description:
      'Tested 4K UHD smart television verified for display uniformity, HDMI ports, and remote pairing.',
    variants: [{ name: 'Titan grey', swatch: '#4a5056' }],
    brand: 'Samsung (US Import)',
    condition: 'Excellent · Tested',
    sourceBatch: 'AH-SHP-2026-003',
    defectsNote: 'No material defects were found during inspection.',
  },
];

export function getProductById(id: string): CatalogProduct {
  return CATALOG_PRODUCTS.find((p) => p.id === id) ?? CATALOG_PRODUCTS[1];
}

export function mapApiProductToCatalog(raw: Record<string, unknown>): CatalogProduct {
  const variantsRaw = Array.isArray(raw.variants)
    ? (raw.variants as Array<{
        id: string;
        sku?: string;
        name?: string;
        priceCents?: number;
        stockLots?: Array<{ available?: number }>;
      }>)
    : [];
  const firstVariant = variantsRaw[0];
  const availableCount = variantsRaw.reduce(
    (sum, v) => sum + (v.stockLots ?? []).reduce((s, lot) => s + Number(lot.available ?? 0), 0),
    0,
  );
  const media = Array.isArray(raw.media) ? (raw.media as Array<{ url?: string }>) : [];
  const pricePesewas = Number(firstVariant?.priceCents ?? 0);

  return {
    id: String(raw.id),
    defaultVariantId: firstVariant?.id,
    sku: firstVariant?.sku || `AH-PRD-${String(raw.id).slice(-5).toUpperCase()}`,
    name: String(raw.name || 'Product'),
    category: String(raw.category || 'Living room'),
    pricePesewas,
    availableCount,
    image: media[0]?.url || '/images/sofa.avif',
    rating: '4.9',
    reviewCount: 12,
    description: String(
      raw.description || 'Inspected and prepared by our warehouse team for collection.',
    ),
    variants:
      variantsRaw.length > 0
        ? variantsRaw.map((v) => ({
            id: v.id,
            name: v.name || v.sku || 'Standard',
            swatch: '#166a4a',
            pricePesewas: v.priceCents,
            availableCount: (v.stockLots ?? []).reduce(
              (s, lot) => s + Number(lot.available ?? 0),
              0,
            ),
          }))
        : [{ name: 'Standard', swatch: '#166a4a' }],
    brand: String(raw.brand || 'American import'),
    condition: raw.condition
      ? String(raw.condition).charAt(0).toUpperCase() + String(raw.condition).slice(1).toLowerCase()
      : 'Good',
    sourceBatch: 'Tema Warehouse',
    defectsNote: String(raw.defectDisclosures || 'No disclosed defects.'),
    defectDisclosures: raw.defectDisclosures ? String(raw.defectDisclosures) : null,
  };
}
