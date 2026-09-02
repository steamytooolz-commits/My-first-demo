import { describe, it, expect } from 'vitest';
import { formatZar, allocateDiscounts, calculateAndAllocateTax } from '../lib/money';

describe('lib/money.ts', () => {
  it('formats South African Rand correctly', () => {
    const formatted = formatZar(24500);
    expect(formatted).toContain('245');
    expect(formatted).toContain('00');
  });

  it('allocates discounts proportionally and guarantees sum equals discount', () => {
    const items = [
      { line_subtotal_cents: 10000 },
      { line_subtotal_cents: 20000 },
      { line_subtotal_cents: 30000 },
    ];
    const discountCents = 5000;
    const subtotalCents = 60000;

    const result = allocateDiscounts(items, discountCents, subtotalCents);
    expect(result).toHaveLength(3);

    const sumDiscounts = result.reduce((sum, item) => sum + item.line_discount_cents, 0);
    expect(sumDiscounts).toBe(discountCents);

    const sumTotals = result.reduce((sum, item) => sum + item.line_total_cents, 0);
    expect(sumTotals).toBe(subtotalCents - discountCents);

    // Verify line totals: total = subtotal - discount
    for (const item of result) {
      expect(item.line_total_cents).toBe(item.line_subtotal_cents - item.line_discount_cents);
    }
  });

  it('handles zero or negative discount gracefully', () => {
    const items = [{ line_subtotal_cents: 15000 }];
    const result = allocateDiscounts(items, 0, 15000);
    expect(result[0].line_discount_cents).toBe(0);
    expect(result[0].line_total_cents).toBe(15000);
  });

  it('calculates tax-inclusive goods and shipping correctly with allocation', () => {
    const items = [
      { line_total_cents: 10000 },
      { line_total_cents: 15000 },
    ];
    const taxRate = 15; // 15% VAT
    const shippingCents = 5000;

    const result = calculateAndAllocateTax(items, true, taxRate, shippingCents, true);
    
    // Tax on 25000 goods at 15% inclusive: 25000 * 15 / 115 = 3260.87 -> 3261 cents
    expect(result.goodsTaxCents).toBe(3261);
    // Tax on 5000 shipping at 15% inclusive: 5000 * 15 / 115 = 652.17 -> 652 cents
    expect(result.shippingTaxCents).toBe(652);
    expect(result.totalTaxCents).toBe(3261 + 652);

    // Check item allocated taxes sum up to goodsTaxCents
    const sumItemTax = result.items.reduce((sum, item) => sum + item.tax_cents, 0);
    expect(sumItemTax).toBe(result.goodsTaxCents);
  });

  it('returns 0 tax when tax is disabled', () => {
    const items = [{ line_total_cents: 20000 }];
    const result = calculateAndAllocateTax(items, false, 15, 5000, true);
    expect(result.totalTaxCents).toBe(0);
    expect(result.items[0].tax_cents).toBe(0);
  });
});
