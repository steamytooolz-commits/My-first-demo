export function formatZar(cents: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
  }).format(cents / 100);
}

export interface LineSubtotalItem {
  id?: string;
  line_subtotal_cents: number;
}

export interface AllocatedDiscountItem extends LineSubtotalItem {
  line_discount_cents: number;
  line_total_cents: number;
}

export interface AllocatedTaxItem extends AllocatedDiscountItem {
  tax_cents: number;
}

/**
 * Allocate order-level discount proportionally across line items.
 * Remainder is given to the final item so sum(discounts) exactly equals order_discount.
 */
export function allocateDiscounts<T extends LineSubtotalItem>(
  items: T[],
  orderDiscountCents: number,
  subtotalCents: number
): (T & { line_discount_cents: number; line_total_cents: number })[] {
  if (items.length === 0) return [];
  if (orderDiscountCents <= 0 || subtotalCents <= 0) {
    return items.map(item => ({
      ...item,
      line_discount_cents: 0,
      line_total_cents: item.line_subtotal_cents,
    }));
  }

  // Cap discount if it exceeds subtotal
  const effectiveDiscount = Math.min(orderDiscountCents, subtotalCents);
  let accumulatedDiscount = 0;

  return items.map((item, index) => {
    const isLast = index === items.length - 1;
    let lineDiscount = 0;

    if (isLast) {
      lineDiscount = effectiveDiscount - accumulatedDiscount;
    } else {
      lineDiscount = Math.floor((effectiveDiscount * item.line_subtotal_cents) / subtotalCents);
      accumulatedDiscount += lineDiscount;
    }

    // Safety bounds
    lineDiscount = Math.max(0, Math.min(lineDiscount, item.line_subtotal_cents));
    const lineTotal = item.line_subtotal_cents - lineDiscount;

    return {
      ...item,
      line_discount_cents: lineDiscount,
      line_total_cents: lineTotal,
    };
  });
}

/**
 * Calculate tax-inclusive amounts and allocate goods tax proportionally across items.
 */
export function calculateAndAllocateTax<T extends { line_total_cents: number }>(
  items: T[],
  taxEnabled: boolean,
  taxRatePercent: number,
  shippingCents: number,
  shippingTaxable: boolean
): {
  items: (T & { tax_cents: number })[];
  goodsTaxCents: number;
  shippingTaxCents: number;
  totalTaxCents: number;
} {
  if (!taxEnabled || taxRatePercent <= 0 || items.length === 0) {
    return {
      items: items.map(item => ({ ...item, tax_cents: 0 })),
      goodsTaxCents: 0,
      shippingTaxCents: 0,
      totalTaxCents: 0,
    };
  }

  const goodsTotalAfterDiscount = items.reduce((sum, item) => sum + item.line_total_cents, 0);

  // Inclusive tax formula: Math.round(taxable_incl * tax_rate_percent / (100 + tax_rate_percent))
  const goodsTaxCents = Math.round(
    (goodsTotalAfterDiscount * taxRatePercent) / (100 + taxRatePercent)
  );

  const shippingTaxCents = shippingTaxable && shippingCents > 0
    ? Math.round((shippingCents * taxRatePercent) / (100 + taxRatePercent))
    : 0;

  const totalTaxCents = goodsTaxCents + shippingTaxCents;

  let accumulatedItemTax = 0;
  const itemsWithTax = items.map((item, index) => {
    const isLast = index === items.length - 1;
    let itemTax = 0;

    if (goodsTotalAfterDiscount > 0) {
      if (isLast) {
        itemTax = goodsTaxCents - accumulatedItemTax;
      } else {
        itemTax = Math.floor((goodsTaxCents * item.line_total_cents) / goodsTotalAfterDiscount);
        accumulatedItemTax += itemTax;
      }
    }

    return {
      ...item,
      tax_cents: Math.max(0, itemTax),
    };
  });

  return {
    items: itemsWithTax,
    goodsTaxCents,
    shippingTaxCents,
    totalTaxCents,
  };
}
