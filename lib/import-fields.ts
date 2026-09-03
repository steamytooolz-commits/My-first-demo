// Client-safe: no server imports (usable from client components).
export interface ImportField {
  key: string;
  label: string;
}

export const IMPORT_FIELDS: ImportField[] = [
  { key: '__ignore', label: 'Ignore column' },
  { key: 'name', label: 'Product name' },
  { key: 'slug', label: 'URL slug (auto if empty)' },
  { key: 'category', label: 'Category' },
  { key: 'brand', label: 'Brand' },
  { key: 'description', label: 'Description' },
  { key: 'variant', label: 'Variant name' },
  { key: 'sku', label: 'SKU (auto if empty)' },
  { key: 'price', label: 'Price (Rand)' },
  { key: 'compare_at', label: 'Compare-at price (Rand)' },
  { key: 'cost', label: 'Cost (Rand)' },
  { key: 'stock', label: 'Stock qty' },
  { key: 'low_stock_threshold', label: 'Low-stock threshold' },
  { key: 'weight', label: 'Weight (g)' },
  { key: 'barcode', label: 'Barcode' },
  { key: 'active', label: 'Active / status' },
  { key: 'featured', label: 'Featured' },
  { key: 'image', label: 'Image URL' },
];
