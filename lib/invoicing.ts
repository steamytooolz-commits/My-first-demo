import { db } from './db';
import { nextSequence } from './sequences';
import { getStoreSettings } from './settings';

export interface InvoiceBuyer {
  name: string;
  email: string;
  phone: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  province: string;
  postal_code: string;
  country: string;
}

export interface InvoiceSeller {
  store_name: string;
  contact_email: string;
  phone: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  province: string;
  postal_code: string;
  country: string;
  vat_number: string;
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  bank_branch_code: string;
  bank_reference_note: string;
}

export interface InvoiceLineItem {
  sku: string;
  name: string;
  qty: number;
  unit_price_cents: number;
  line_subtotal_cents: number;
  line_discount_cents: number;
  line_total_cents: number;
  tax_cents: number;
}

export interface InvoiceRecord {
  id: string;
  invoice_number: string;
  order_id: string;
  status: 'draft' | 'issued' | 'paid' | 'void' | 'refunded';
  issue_date: string;
  due_date: string;
  currency: string;
  subtotal_cents: number;
  discount_cents: number;
  shipping_cents: number;
  tax_cents: number;
  total_cents: number;
  amount_paid_cents: number;
  seller_json: string;
  buyer_json: string;
  line_items_json: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

/**
 * Issue an invoice for an order inside a transaction
 */
export async function createInvoiceForOrder(
  order: {
    id: string;
    order_number: string;
    subtotal_cents: number;
    discount_cents: number;
    shipping_cents: number;
    tax_cents: number;
    total_cents: number;
    email: string;
  },
  buyer: InvoiceBuyer,
  lineItems: InvoiceLineItem[],
  status: 'issued' | 'paid' = 'issued',
  amountPaidCents: number = 0,
  notes: string = ''
): Promise<InvoiceRecord> {
  const settings = await getStoreSettings();
  const invoiceId = crypto.randomUUID();
  const invoiceNumber = await nextSequence('invoice', settings.invoice_prefix || 'INV');

  const now = new Date();
  const issueDate = now.toISOString().split('T')[0];
  const dueDays = settings.invoice_due_days || 14;
  const dueDate = new Date(now.getTime() + dueDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const seller: InvoiceSeller = {
    store_name: settings.store_name,
    contact_email: settings.contact_email,
    phone: settings.phone,
    address_line1: settings.address_line1,
    address_line2: settings.address_line2,
    city: settings.city,
    province: settings.province,
    postal_code: settings.postal_code,
    country: settings.country,
    vat_number: settings.vat_number,
    bank_name: settings.bank_name,
    bank_account_name: settings.bank_account_name,
    bank_account_number: settings.bank_account_number,
    bank_branch_code: settings.bank_branch_code,
    bank_reference_note: settings.bank_reference_note,
  };

  await db.prepare(`
    INSERT INTO invoices (
      id, invoice_number, order_id, status, issue_date, due_date, currency,
      subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents,
      amount_paid_cents, seller_json, buyer_json, line_items_json, notes,
      created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, 'ZAR',
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      datetime('now'), datetime('now')
    )
  `).run(
    invoiceId,
    invoiceNumber,
    order.id,
    status,
    issueDate,
    dueDate,
    order.subtotal_cents,
    order.discount_cents,
    order.shipping_cents,
    order.tax_cents,
    order.total_cents,
    amountPaidCents,
    JSON.stringify(seller),
    JSON.stringify(buyer),
    JSON.stringify(lineItems),
    notes
  );

  return await db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId) as InvoiceRecord;
}
