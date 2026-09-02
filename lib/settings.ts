import { db } from './db';
import { z } from 'zod';

export const storeSettingsSchema = z.object({
  store_name: z.string().min(1, 'Store name is required'),
  contact_email: z.string().email('Invalid contact email'),
  phone: z.string().default(''),
  address_line1: z.string().min(1, 'Address line 1 is required'),
  address_line2: z.string().default(''),
  city: z.string().min(1, 'City is required'),
  province: z.string().min(1, 'Province is required'),
  postal_code: z.string().min(1, 'Postal code is required'),
  country: z.string().default('ZA'),

  currency: z.string().default('ZAR'),

  tax_enabled: z.boolean().default(false),
  tax_rate_percent: z.number().min(0).max(100).default(0),
  prices_include_tax: z.boolean().default(true),
  shipping_taxable: z.boolean().default(true),

  free_shipping_enabled: z.boolean().default(true),
  free_shipping_threshold_cents: z.number().int().nonnegative().default(95000),

  standard_base_cents: z.number().int().nonnegative().default(7500),
  express_base_cents: z.number().int().nonnegative().default(15000),

  weight_threshold_g: z.number().int().nonnegative().default(5000),
  weight_surcharge_cents: z.number().int().nonnegative().default(2500),
  express_weight_surcharge_cents: z.number().int().nonnegative().default(5000),

  invoice_prefix: z.string().default('INV'),
  order_prefix: z.string().default('ORD'),
  invoice_due_days: z.number().int().positive().default(14),
  low_stock_threshold: z.number().int().nonnegative().default(5),

  bank_name: z.string().default('First National Bank'),
  bank_account_name: z.string().default('Paper & Quill Stationery (Pty) Ltd'),
  bank_account_number: z.string().default('62000000000'),
  bank_branch_code: z.string().default('250655'),
  bank_reference_note: z.string().default('Please use your Order Number (e.g. ORD-2026-000001) as payment reference'),

  vat_number: z.string().default(''),
});

export type StoreSettings = z.infer<typeof storeSettingsSchema>;

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  store_name: 'Paper & Quill Stationery',
  contact_email: 'hello@paperandquill.co.za',
  phone: '',
  address_line1: '42 Bram Fischer Drive',
  address_line2: 'Ferndale',
  city: 'Johannesburg',
  province: 'Gauteng',
  postal_code: '2194',
  country: 'ZA',

  currency: 'ZAR',

  tax_enabled: false,
  tax_rate_percent: 0,
  prices_include_tax: true,
  shipping_taxable: true,

  free_shipping_enabled: true,
  free_shipping_threshold_cents: 95000,

  standard_base_cents: 7500,
  express_base_cents: 15000,

  weight_threshold_g: 5000,
  weight_surcharge_cents: 2500,
  express_weight_surcharge_cents: 5000,

  invoice_prefix: 'INV',
  order_prefix: 'ORD',
  invoice_due_days: 14,
  low_stock_threshold: 5,

  bank_name: 'First National Bank',
  bank_account_name: 'Paper & Quill Stationery (Pty) Ltd',
  bank_account_number: '62000000000',
  bank_branch_code: '250655',
  bank_reference_note: 'Please use your Order Number as payment reference',

  vat_number: '',
};

export async function getStoreSettings(): Promise<StoreSettings> {
  try {
    const row = await db.prepare('SELECT value_json FROM settings WHERE key = ?').get('store') as { value_json: string } | undefined;
    if (!row) {
      return DEFAULT_STORE_SETTINGS;
    }
    const parsed = JSON.parse(row.value_json);
    return { ...DEFAULT_STORE_SETTINGS, ...parsed };
  } catch (err) {
    console.error('Failed to load store settings:', err);
    return DEFAULT_STORE_SETTINGS;
  }
}

export async function updateStoreSettings(settings: Partial<StoreSettings>): Promise<StoreSettings> {
  const current = await getStoreSettings();
  const merged = { ...current, ...settings };
  const validated = storeSettingsSchema.parse(merged);

  await db.prepare(`
    INSERT INTO settings (key, value_json)
    VALUES ('store', ?)
    ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json
  `).run(JSON.stringify(validated));

  return validated;
}

// Sync wrapper for places that cannot be async yet (fallback to default if not awaited)
export function getStoreSettingsSync(): StoreSettings {
  return DEFAULT_STORE_SETTINGS;
}
