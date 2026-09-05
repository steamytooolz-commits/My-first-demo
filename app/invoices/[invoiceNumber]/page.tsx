import { notFound } from 'next/navigation';
import Link from 'next/link';
import InvoicePrintButton from '@/components/InvoicePrintButton';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { getStoreSettings } from '@/lib/settings';
import { formatZar } from '@/lib/money';
import { ArrowLeft, CheckCircle2, Clock } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface InvoicePageProps {
  params: Promise<{ invoiceNumber: string }>;
}

export default async function InvoicePage({ params }: InvoicePageProps) {
  const { invoiceNumber } = await params;
  const user = await getSessionUser();
  const settings = await getStoreSettings();

  const invoice = await db.prepare(`
    SELECT i.*, o.order_number, o.user_id, o.shipping_address_json, o.billing_address_json,
           o.customer_note, o.coupon_code, o.shipping_method
    FROM invoices i
    JOIN orders o ON i.order_id = o.id
    WHERE i.invoice_number = ?
  `).get(invoiceNumber) as any;

  if (!invoice) {
    notFound();
  }

  // Allow access to order owner or admin
  if (!user || (user.id !== invoice.user_id && user.role !== 'admin')) {
    return (
      <div className="mx-auto max-w-md p-8 text-center space-y-4">
        <h2 className="font-serif text-xl font-bold text-slate-900">Access Restricted</h2>
        <p className="text-xs text-slate-500">Sign in to view this invoice.</p>
        <Link href={`/auth/login?redirectTo=/invoices/${invoiceNumber}`} className="inline-block rounded-lg bg-teal-800 px-4 py-2 text-xs font-semibold text-white">
          Sign In
        </Link>
      </div>
    );
  }

  let items: any[] = [];
  try {
    items = JSON.parse(invoice.line_items_json || '[]');
  } catch {
    items = [];
  }

  // Frozen snapshots win over live settings: historic invoices must never mutate
  // when store details change (TAA s30), and must stay buyer-redacted after erasure.
  let seller: any = {};
  try {
    seller = JSON.parse(invoice.seller_json || '{}');
  } catch {
    seller = {};
  }
  const sellerName = seller.store_name || settings.store_name;
  const sellerLine1 = seller.address_line1 || settings.address_line1;
  const sellerLine2 = seller.address_line2 || settings.address_line2;
  const sellerCity = seller.city || settings.city;
  const sellerProvince = seller.province || settings.province;
  const sellerPostal = seller.postal_code || settings.postal_code;
  const sellerEmail = seller.contact_email || settings.contact_email;
  const sellerPhone = seller.phone ?? settings.phone;
  const sellerVat = seller.vat_number ?? settings.vat_number;
  // Money-moving details come from the frozen snapshot: a later bank change
  // must never rewrite historic unpaid invoices (TAA s30 record integrity).
  const sellerBankName = seller.bank_name || settings.bank_name;
  const sellerBankAccountName = seller.bank_account_name || settings.bank_account_name;
  const sellerBankAccountNumber = seller.bank_account_number || settings.bank_account_number;
  const sellerBankBranch = seller.bank_branch_code || settings.bank_branch_code;

  let buyer: any = {};
  try {
    buyer = JSON.parse(invoice.buyer_json || '{}');
  } catch {
    buyer = {};
  }
  const shippingAddr = JSON.parse(invoice.shipping_address_json || '{}');
  const billName = buyer.name || shippingAddr.full_name || 'Customer';
  const billLine1 = buyer.address_line1 || shippingAddr.line1;
  const billLine2 = buyer.address_line2 || shippingAddr.line2;
  const billCity = buyer.city || shippingAddr.city;
  const billProvince = buyer.province || shippingAddr.province;
  const billPostal = buyer.postal_code || shippingAddr.postal_code;
  const billPhone = buyer.phone || shippingAddr.phone;

  const isTaxInvoice = Number(invoice.tax_cents || 0) > 0;
  const balanceDueCents = Math.max(0, invoice.total_cents - invoice.amount_paid_cents);

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 sm:px-6 print:p-0 print:bg-white">
      {/* Top action bar */}
      <div className="no-print mx-auto max-w-4xl mb-6 flex items-center justify-between">
        <Link
          href={`/order/${invoice.order_number}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Order #{invoice.order_number}</span>
        </Link>
        <InvoicePrintButton />
      </div>

      {/* A4 Tax Invoice Card */}
      <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-8 sm:p-12 shadow-sm print:border-none print:shadow-none print:p-0">
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-8 border-b-2 border-slate-900">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-800 text-white font-serif font-bold text-sm">
                PQ
              </span>
              <span className="font-serif text-2xl font-bold tracking-tight text-slate-900">
                {sellerName}
              </span>
            </div>
            <div className="text-xs text-slate-600 space-y-0.5">
              <p>{sellerLine1}</p>
              {sellerLine2 && <p>{sellerLine2}</p>}
              <p>{sellerCity}, {sellerProvince} {sellerPostal}, South Africa</p>
              <p>Email: {sellerEmail}{sellerPhone ? ` • Phone: ${sellerPhone}` : ''}</p>
              {sellerVat && (
                <p className="font-bold text-slate-900 pt-1">VAT Reg No: {sellerVat}</p>
              )}
            </div>
          </div>

          <div className="text-left sm:text-right space-y-1">
            <h1 className="font-serif text-3xl font-extrabold tracking-tight text-slate-900">
              {isTaxInvoice ? 'TAX INVOICE' : 'INVOICE'}
            </h1>
            <p className="font-mono text-xs font-bold text-teal-800">
              {invoice.invoice_number}
            </p>
            <div className="pt-2 text-xs text-slate-600 space-y-0.5">
              <p><strong>Order Ref:</strong> #{invoice.order_number}</p>
              <p><strong>Issue Date:</strong> {invoice.issue_date}</p>
              <p><strong>Due Date:</strong> {invoice.due_date}</p>
              <p>
                <strong>Status: </strong>
                <span className={`inline-block font-bold uppercase ${invoice.status === 'paid' ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {invoice.status}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Bill To / Ship To */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 py-6 border-b border-slate-200 text-xs">
          <div>
            <h3 className="font-bold uppercase tracking-wider text-slate-400 text-[10px] mb-2">
              Billed &amp; Delivered To
            </h3>
            <div className="space-y-0.5 text-slate-800 font-medium">
              <p className="font-bold text-slate-900 text-sm">{billName}</p>
              <p>{billLine1}</p>
              {billLine2 && <p>{billLine2}</p>}
              <p>{billCity}, {billProvince} {billPostal}</p>
              {billPhone ? <p>Phone: {billPhone}</p> : null}
            </div>
          </div>

          <div className="sm:text-right">
            <h3 className="font-bold uppercase tracking-wider text-slate-400 text-[10px] mb-2">
              Fulfilment &amp; Delivery Method
            </h3>
            <p className="text-slate-800 font-semibold capitalize">{invoice.shipping_method} Delivery</p>
            <p className="text-slate-500 text-[11px] mt-1">Dispatched from {sellerCity || 'Johannesburg'} Central Hub</p>
          </div>
        </div>

        {/* Items Table */}
        <div className="py-6">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-300 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                <th className="py-2.5">Item Description &amp; SKU</th>
                <th className="py-2.5 text-center">Qty</th>
                <th className="py-2.5 text-right">Unit Price</th>
                <th className="py-2.5 text-right">Discount</th>
                <th className="py-2.5 text-right">{isTaxInvoice && settings.tax_rate_percent > 0 ? `VAT (${settings.tax_rate_percent}%)` : 'Tax'}</th>
                <th className="py-2.5 text-right">Total (Incl)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item: any, idx: number) => {
                const discount = item.line_discount_cents ?? item.discount_cents ?? 0;
                const total = item.line_total_cents ?? item.total_cents ?? (item.qty * item.unit_price_cents - discount);
                return (
                  <tr key={item.sku || idx}>
                    <td className="py-3">
                      <span className="font-bold text-slate-900 block">{item.name || item.description || 'Stationery Item'}</span>
                      <span className="text-[10px] font-mono text-slate-400">SKU: {item.sku}</span>
                    </td>
                    <td className="py-3 text-center font-medium text-slate-800">{item.qty}</td>
                    <td className="py-3 text-right text-slate-700">{formatZar(item.unit_price_cents)}</td>
                    <td className="py-3 text-right text-emerald-700">
                      {discount > 0 ? `-${formatZar(discount)}` : formatZar(0)}
                    </td>
                    <td className="py-3 text-right text-slate-600">{formatZar(item.tax_cents || 0)}</td>
                    <td className="py-3 text-right font-bold text-slate-900">{formatZar(total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals & Banking Details Block */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-8 pt-6 border-t-2 border-slate-200">
          {/* Banking details — only while a balance is actually due */}
          {balanceDueCents > 0 && (
          <div className="sm:col-span-7 space-y-3 text-xs">
            <h4 className="font-bold uppercase tracking-wider text-slate-900 text-[11px]">
              Electronic Funds Transfer (EFT) Details
            </h4>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-[11px] space-y-1 text-slate-700">
              <p><span className="text-slate-400">Bank Name: </span><strong>{sellerBankName}</strong></p>
              <p><span className="text-slate-400">Account Name: </span><strong>{sellerBankAccountName}</strong></p>
              <p><span className="text-slate-400">Account Number: </span><strong>{sellerBankAccountNumber}</strong></p>
              <p><span className="text-slate-400">Branch Code: </span><strong>{sellerBankBranch}</strong></p>
              <p><span className="text-slate-400">Payment Reference: </span><strong className="text-teal-900">{invoice.invoice_number}</strong></p>
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Standard payment terms are {settings.invoice_due_days} days from issue. All queries regarding this {isTaxInvoice ? 'tax invoice' : 'invoice'} should be directed to {settings.contact_email}.
            </p>
          </div>
          )}

          {/* Financial calculations */}
          <div className="sm:col-span-5 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span className="font-semibold text-slate-900">{formatZar(invoice.subtotal_cents)}</span>
            </div>

            {invoice.discount_cents > 0 && (
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>Total Discounts</span>
                <span>-{formatZar(invoice.discount_cents)}</span>
              </div>
            )}

            <div className="flex justify-between text-slate-600">
              <span>Delivery Fee</span>
              <span className="font-semibold text-slate-900">
                {invoice.shipping_cents === 0 ? 'FREE' : formatZar(invoice.shipping_cents)}
              </span>
            </div>

            {Number(invoice.tax_cents || 0) > 0 && (
            <div className="flex justify-between text-slate-500 text-[11px]">
              <span>{settings.tax_rate_percent > 0 ? `VAT Included (${settings.tax_rate_percent}%)` : 'Tax Included'}</span>
              <span>{formatZar(invoice.tax_cents)}</span>
            </div>
            )}

            <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-bold text-slate-900">
              <span>Invoice Total</span>
              <span className="text-base text-teal-950">{formatZar(invoice.total_cents)}</span>
            </div>

            <div className="flex justify-between text-emerald-700 font-medium pt-1">
              <span>Amount Paid</span>
              <span>{formatZar(invoice.amount_paid_cents)}</span>
            </div>

            <div className="pt-2 border-t border-slate-300 flex justify-between text-sm font-extrabold text-slate-900">
              <span>Balance Due</span>
              <span className={balanceDueCents > 0 ? 'text-rose-700' : 'text-emerald-700'}>
                {formatZar(balanceDueCents)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer legal note */}
        <div className="mt-12 pt-6 border-t border-slate-200 text-center text-[10px] text-slate-400 space-y-1">
          {isTaxInvoice ? (
            <p>This is a computer-generated tax invoice issued in accordance with the South African Value-Added Tax Act, 1991.</p>
          ) : (
            <p>This is a computer-generated invoice. No VAT was charged on this order.</p>
          )}
          <p>{sellerName} • {sellerCity}, South Africa</p>
        </div>
      </div>
    </div>
  );
}
