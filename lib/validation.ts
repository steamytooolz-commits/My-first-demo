import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  full_name: z.string().min(1, 'Full name is required'),
  phone: z.string().optional().default(''),
  poia_consent: z.boolean().refine(val => val === true, {
    message: 'You must consent to the processing of your personal information for order fulfilment',
  }),
  marketing_consent: z.boolean().optional().default(false),
});

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const changePasswordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password: z
    .string()
    .min(8, 'New password must be at least 8 characters')
    .regex(/[a-zA-Z]/, 'New password must contain at least one letter')
    .regex(/[0-9]/, 'New password must contain at least one number'),
  confirm_password: z.string(),
}).refine(data => data.new_password === data.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
});

export const profileUpdateSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  phone: z.string().default(''),
  marketing_consent: z.boolean().default(false),
});

export const addressSchema = z.object({
  label: z.string().min(1, 'Label is required (e.g. Home, Office)').default('Home'),
  full_name: z.string().min(1, 'Recipient full name is required'),
  phone: z.string().optional().default(''),
  line1: z.string().min(1, 'Street address is required'),
  line2: z.string().optional().default(''),
  city: z.string().min(1, 'City is required'),
  province: z.string().min(1, 'Province is required'),
  postal_code: z.string().min(1, 'Postal code is required'),
  country: z.string().default('ZA'),
  is_default: z.boolean().optional().default(false),
});

export const couponSchema = z.object({
  code: z
    .string()
    .min(2, 'Coupon code must be at least 2 characters')
    .max(30)
    .regex(/^[A-Za-z0-9_-]+$/, 'Coupon code can only contain letters, numbers, and dashes')
    .transform(v => v.toUpperCase()),
  type: z.enum(['percent', 'fixed', 'free_shipping']),
  value: z.number().int().min(0),
  min_subtotal_cents: z.number().int().min(0).default(0),
  max_discount_cents: z.number().int().positive().nullable().optional(),
  usage_limit: z.number().int().positive().nullable().optional(),
  one_per_customer: z.boolean().default(false),
  active: z.boolean().default(true),
  starts_at: z.string().nullable().optional(),
  expires_at: z.string().nullable().optional(),
}).refine(data => {
  if (data.type === 'percent') {
    return data.value >= 1 && data.value <= 100;
  }
  if (data.type === 'fixed') {
    return data.value > 0;
  }
  return true;
}, {
  message: 'Percent discount must be 1-100%, and fixed discount must be positive',
  path: ['value'],
});

export const productSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  slug: z.string().min(1, 'Slug is required').regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  category_id: z.string().nullable().optional(),
  brand: z.string().optional().default(''),
  description: z.string().optional().default(''),
  active: z.boolean().default(true),
  featured: z.boolean().default(false),
});

export const variantSchema = z.object({
  sku: z.string().min(1, 'SKU is required').regex(/^[A-Za-z0-9_-]+$/, 'SKU must be alphanumeric'),
  name: z.string().min(1, 'Variant name is required'),
  options_json: z.string().default('{}'),
  price_cents: z.number().int().min(0, 'Price cannot be negative'),
  compare_at_price_cents: z.number().int().positive().nullable().optional(),
  cost_cents: z.number().int().min(0).nullable().optional(),
  stock_qty: z.number().int().min(0, 'Stock cannot be negative'),
  low_stock_threshold: z.number().int().min(0).default(5),
  weight_g: z.number().int().min(0).default(0),
  barcode: z.string().nullable().optional(),
  active: z.boolean().default(true),
});

export const categorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  slug: z.string().min(1, 'Slug is required').regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  description: z.string().optional().default(''),
  parent_id: z.string().nullable().optional(),
  active: z.boolean().default(true),
  sort_order: z.number().int().default(0),
});

export const tradeApplicationSchema = z.object({
  business_name: z.string().min(2, 'Registered business name is required').max(120),
  trade_vat_number: z.string().max(20).default(''),
  cipc_number: z.string().max(30).default(''),
  contact_person: z.string().min(1, 'Contact person is required').max(120),
  phone: z.string().min(7, 'A valid contact number is required').max(20),
  trade_references: z.string().max(1000).default(''),
});
