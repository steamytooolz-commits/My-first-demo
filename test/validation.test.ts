import { describe, it, expect } from 'vitest';
import {
  registerSchema,
  loginSchema,
  addressSchema,
  couponSchema,
  productSchema,
  variantSchema,
  categorySchema,
} from '../lib/validation';

describe('lib/validation.ts', () => {
  it('accepts a valid registration and rejects weak passwords', () => {
    const ok = registerSchema.safeParse({
      email: 'thabo@example.co.za',
      password: 'Customer123!',
      full_name: 'Thabo Mokoena',
      phone: '',
      poia_consent: true,
      marketing_consent: false,
    });
    expect(ok.success).toBe(true);

    const weak = registerSchema.safeParse({
      email: 'thabo@example.co.za',
      password: 'short',
      full_name: 'Thabo Mokoena',
      poia_consent: true,
    });
    expect(weak.success).toBe(false);

    const noConsent = registerSchema.safeParse({
      email: 'thabo@example.co.za',
      password: 'Customer123!',
      full_name: 'Thabo Mokoena',
      poia_consent: false,
    });
    expect(noConsent.success).toBe(false);
  });

  it('validates login inputs', () => {
    expect(loginSchema.safeParse({ email: 'admin@example.com', password: 'x' }).success).toBe(true);
    expect(loginSchema.safeParse({ email: 'not-an-email', password: 'x' }).success).toBe(false);
  });

  it('requires address fields for delivery', () => {
    const ok = addressSchema.safeParse({
      label: 'Home',
      full_name: 'Thabo Mokoena',
      line1: '12 Protea Lane',
      city: 'Rosebank',
      province: 'Gauteng',
      postal_code: '2196',
      country: 'ZA',
    });
    expect(ok.success).toBe(true);

    const missing = addressSchema.safeParse({
      label: 'Home',
      full_name: '',
      line1: '',
      city: 'Rosebank',
      province: 'Gauteng',
      postal_code: '2196',
    });
    expect(missing.success).toBe(false);
  });

  it('constrains coupon values by type', () => {
    expect(couponSchema.safeParse({ code: 'WELCOME10', type: 'percent', value: 10 }).success).toBe(true);
    expect(couponSchema.safeParse({ code: 'BAD', type: 'percent', value: 150 }).success).toBe(false);
    expect(couponSchema.safeParse({ code: 'SAVE50', type: 'fixed', value: 5000 }).success).toBe(true);
    expect(couponSchema.safeParse({ code: 'X', type: 'percent', value: 10 }).success).toBe(false);
  });

  it('enforces slug formats for products and categories', () => {
    expect(productSchema.safeParse({ name: 'Notebook', slug: 'a4-notebook' }).success).toBe(true);
    expect(productSchema.safeParse({ name: 'Notebook', slug: 'A4 Notebook!' }).success).toBe(false);
    expect(categorySchema.safeParse({ name: 'Pens', slug: 'pens-writing' }).success).toBe(true);
  });

  it('rejects negative variant pricing and stock', () => {
    const base = {
      sku: 'TEST-1',
      name: 'Test Variant',
      price_cents: 1000,
      stock_qty: 5,
    };
    expect(variantSchema.safeParse(base).success).toBe(true);
    expect(variantSchema.safeParse({ ...base, price_cents: -1 }).success).toBe(false);
    expect(variantSchema.safeParse({ ...base, stock_qty: -1 }).success).toBe(false);
  });
});
