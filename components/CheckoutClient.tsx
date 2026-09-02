'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { formatZar } from '@/lib/money';
import { placeOrderAction } from '@/app/actions/checkout';
import { saveAddressAction } from '@/app/actions/addresses';
import { ShieldCheck, CreditCard, Landmark, Truck, AlertCircle, Plus, Check } from 'lucide-react';
import { CartSummary } from '@/lib/cart';

interface Address {
  id: string;
  label: string;
  full_name: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  province: string;
  postal_code: string;
  is_default: number;
}

interface CheckoutClientProps {
  user: any | null;
  savedAddresses: Address[];
  cart: CartSummary;
  bankDetails: {
    bank_name: string;
    bank_account_name: string;
    bank_account_number: string;
    bank_branch_code: string;
    bank_reference_note: string;
  };
}

export default function CheckoutClient({
  user,
  savedAddresses,
  cart,
  bankDetails,
}: CheckoutClientProps) {
  const [selectedAddressId, setSelectedAddressId] = useState<string>(
    savedAddresses.find(a => a.is_default)?.id || savedAddresses[0]?.id || ''
  );
  const [showNewAddressForm, setShowNewAddressForm] = useState<boolean>(savedAddresses.length === 0);
  const [shippingMethod, setShippingMethod] = useState<'pickup' | 'standard' | 'express'>(cart.shippingMethod);
  const [paymentMethod, setPaymentMethod] = useState<'sim_card' | 'manual_eft' | 'pay_on_delivery'>('sim_card');
  const [simCardOutcome, setSimCardOutcome] = useState<'success' | 'declined' | 'pending'>('success');
  const [customerNote, setCustomerNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // New address form states
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [newAddress, setNewAddress] = useState({
    full_name: user?.full_name || '',
    phone: user?.phone || '',
    line1: '',
    line2: '',
    city: '',
    province: 'Gauteng',
    postal_code: '',
    label: 'Delivery Address',
  });

  if (!user) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 max-w-lg mx-auto text-center space-y-4 my-12 shadow-sm">
        <h2 className="font-serif text-2xl font-bold text-slate-900">Sign in to Checkout</h2>
        <p className="text-xs text-slate-600">
          Please sign in to your customer account to save your delivery address, track orders, and view official VAT invoices.
        </p>
        <div className="pt-2 flex flex-col gap-2.5">
          <Link
            href="/auth/login?redirectTo=/checkout"
            className="w-full rounded-xl bg-teal-800 py-3 text-xs font-semibold text-white shadow hover:bg-teal-900 transition-colors"
          >
            Sign In with Existing Account
          </Link>
          <Link
            href="/auth/register?redirectTo=/checkout"
            className="w-full rounded-xl border border-slate-300 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Create New Account
          </Link>
        </div>
        <p className="text-[11px] text-slate-400">
          Demo Customer Account: <code className="text-slate-600">customer@example.com / Customer123!</code>
        </p>
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center my-12">
        <h2 className="font-serif text-xl font-bold text-slate-900">Your cart is empty</h2>
        <p className="mt-1 text-xs text-slate-500">Add some stationery items to proceed with checkout.</p>
        <Link href="/catalog" className="mt-4 inline-block rounded-lg bg-teal-800 px-4 py-2 text-xs font-semibold text-white">
          Browse Catalog
        </Link>
      </div>
    );
  }

  async function handleCreateAddress() {
    if (!newAddress.full_name.trim() || !newAddress.line1.trim() || !newAddress.city.trim() || !newAddress.postal_code.trim()) {
      setErrorMessage('Please fill in all required address fields (*).');
      return;
    }
    setIsSavingAddress(true);
    setErrorMessage(null);

    const formData = new FormData();
    formData.set('full_name', newAddress.full_name.trim());
    formData.set('phone', newAddress.phone.trim());
    formData.set('line1', newAddress.line1.trim());
    formData.set('line2', newAddress.line2.trim());
    formData.set('city', newAddress.city.trim());
    formData.set('province', newAddress.province.trim());
    formData.set('postal_code', newAddress.postal_code.trim());
    formData.set('label', newAddress.label || 'Delivery Address');
    formData.set('is_default', 'on');

    const res = await saveAddressAction(null, formData);
    setIsSavingAddress(false);
    if (res.success) {
      window.location.reload();
    } else {
      setErrorMessage(res.error || 'Failed to save address');
    }
  }

  async function handlePlaceOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAddressId) {
      setErrorMessage('Please select or create a delivery address.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.set('addressId', selectedAddressId);
      formData.set('shippingMethod', shippingMethod);
      formData.set('paymentMethod', paymentMethod);
      formData.set('simCardOutcome', simCardOutcome);
      formData.set('customerNote', customerNote);

      const result = await placeOrderAction(null, formData);
      if (!result || !result.success || !result.orderNumber) {
        setIsSubmitting(false);
        setErrorMessage(result?.error || 'Order processing failed.');
      } else {
        window.location.href = `/order/${result.orderNumber}`;
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMessage(err?.message || 'Order processing failed.');
    }
  }

  return (
    <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 gap-8 lg:grid-cols-12 my-8">
      {/* Checkout Steps */}
      <div className="lg:col-span-8 space-y-8">
        {/* Step 1: Delivery Address */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-800 text-xs font-bold text-white">
                1
              </span>
              <h2 className="font-serif text-lg font-bold text-slate-900">Delivery Address</h2>
            </div>
            {savedAddresses.length > 0 && (
              <button
                type="button"
                onClick={() => setShowNewAddressForm(!showNewAddressForm)}
                className="text-xs font-semibold text-teal-800 hover:text-teal-900 flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{showNewAddressForm ? 'Select Saved Address' : 'Add New Address'}</span>
              </button>
            )}
          </div>

          {!showNewAddressForm && savedAddresses.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {savedAddresses.map(addr => (
                <div
                  key={addr.id}
                  onClick={() => setSelectedAddressId(addr.id)}
                  className={`cursor-pointer rounded-xl border p-4 transition-all ${
                    selectedAddressId === addr.id
                      ? 'border-teal-700 bg-teal-50/40 ring-1 ring-teal-700'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">{addr.label}</span>
                    {addr.is_default === 1 && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-xs font-medium text-slate-800">{addr.full_name}</p>
                  <p className="text-xs text-slate-600">{addr.line1}</p>
                  {addr.line2 && <p className="text-xs text-slate-600">{addr.line2}</p>}
                  <p className="text-xs text-slate-600">{addr.city}, {addr.province} {addr.postal_code}</p>
                  <p className="mt-1 text-[11px] text-slate-400">Phone: {addr.phone}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Enter Delivery Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Full Name *</label>
                  <input
                    name="full_name"
                    required
                    value={newAddress.full_name}
                    onChange={e => setNewAddress(prev => ({ ...prev, full_name: e.target.value }))}
                    placeholder="e.g. Lerato Ndlovu"
                    className="w-full rounded-lg border border-slate-200 p-2 focus:border-teal-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Contact Phone</label>
                  <input
                    name="phone"
                    value={newAddress.phone}
                    onChange={e => setNewAddress(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="e.g. 082 000 0000"
                    className="w-full rounded-lg border border-slate-200 p-2 focus:border-teal-700 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-medium text-slate-700 mb-1">Street Address *</label>
                  <input
                    name="line1"
                    required
                    value={newAddress.line1}
                    onChange={e => setNewAddress(prev => ({ ...prev, line1: e.target.value }))}
                    placeholder="Unit / Building, Street number and name"
                    className="w-full rounded-lg border border-slate-200 p-2 focus:border-teal-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Suburb / Line 2</label>
                  <input
                    name="line2"
                    value={newAddress.line2}
                    onChange={e => setNewAddress(prev => ({ ...prev, line2: e.target.value }))}
                    placeholder="Apartment, suite, or suburb"
                    className="w-full rounded-lg border border-slate-200 p-2 focus:border-teal-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">City *</label>
                  <input
                    name="city"
                    required
                    value={newAddress.city}
                    onChange={e => setNewAddress(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="Johannesburg"
                    className="w-full rounded-lg border border-slate-200 p-2 focus:border-teal-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Province *</label>
                  <select
                    name="province"
                    required
                    value={newAddress.province}
                    onChange={e => setNewAddress(prev => ({ ...prev, province: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 p-2 focus:border-teal-700 focus:outline-none"
                  >
                    <option value="Gauteng">Gauteng</option>
                    <option value="Western Cape">Western Cape</option>
                    <option value="KwaZulu-Natal">KwaZulu-Natal</option>
                    <option value="Eastern Cape">Eastern Cape</option>
                    <option value="Free State">Free State</option>
                    <option value="Mpumalanga">Mpumalanga</option>
                    <option value="Limpopo">Limpopo</option>
                    <option value="North West">North West</option>
                    <option value="Northern Cape">Northern Cape</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Postal Code *</label>
                  <input
                    name="postal_code"
                    required
                    value={newAddress.postal_code}
                    onChange={e => setNewAddress(prev => ({ ...prev, postal_code: e.target.value }))}
                    placeholder="2194"
                    className="w-full rounded-lg border border-slate-200 p-2 focus:border-teal-700 focus:outline-none"
                  />
                </div>
              </div>

              {/* Sub-action button for saving new address */}
              <button
                type="button"
                disabled={isSavingAddress}
                onClick={handleCreateAddress}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
              >
                {isSavingAddress ? 'Saving Address...' : 'Save & Use Address'}
              </button>
            </div>
          )}
        </section>

        {/* Step 2: Shipping Method */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-800 text-xs font-bold text-white">
              2
            </span>
            <h2 className="font-serif text-lg font-bold text-slate-900">Shipping Method</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label
              onClick={() => setShippingMethod('pickup')}
              className={`cursor-pointer rounded-xl border p-4 transition-all ${
                shippingMethod === 'pickup'
                  ? 'border-teal-700 bg-teal-50/50 ring-1 ring-teal-700'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <span className="text-xs font-bold text-slate-900 block">Warehouse Collection</span>
              <span className="text-[11px] text-slate-500 block mt-0.5">Johannesburg Hub</span>
              <span className="mt-2 text-xs font-bold text-teal-800 block">FREE (R 0.00)</span>
            </label>

            <label
              onClick={() => setShippingMethod('standard')}
              className={`cursor-pointer rounded-xl border p-4 transition-all ${
                shippingMethod === 'standard'
                  ? 'border-teal-700 bg-teal-50/50 ring-1 ring-teal-700'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <span className="text-xs font-bold text-slate-900 block">Standard Courier</span>
              <span className="text-[11px] text-slate-500 block mt-0.5">2-4 business days</span>
              <span className="mt-2 text-xs font-bold text-slate-900 block">
                {cart.freeShippingProgress.qualifies ? 'FREE' : 'R 75.00'}
              </span>
            </label>

            <label
              onClick={() => setShippingMethod('express')}
              className={`cursor-pointer rounded-xl border p-4 transition-all ${
                shippingMethod === 'express'
                  ? 'border-teal-700 bg-teal-50/50 ring-1 ring-teal-700'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <span className="text-xs font-bold text-slate-900 block">Express Overnight</span>
              <span className="text-[11px] text-slate-500 block mt-0.5">1-2 business days</span>
              <span className="mt-2 text-xs font-bold text-slate-900 block">R 150.00</span>
            </label>
          </div>
        </section>

        {/* Step 3: Payment Method Simulation */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-800 text-xs font-bold text-white">
              3
            </span>
            <h2 className="font-serif text-lg font-bold text-slate-900">Payment Simulation (Staging Sandbox)</h2>
          </div>

          <div className="space-y-3">
            {/* Card Simulation */}
            <div
              onClick={() => setPaymentMethod('sim_card')}
              className={`cursor-pointer rounded-xl border p-4 transition-all ${
                paymentMethod === 'sim_card'
                  ? 'border-teal-700 bg-teal-50/40 ring-1 ring-teal-700'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <CreditCard className="h-5 w-5 text-teal-800" />
                  <span className="text-xs font-bold text-slate-900">Simulated Credit / Debit Card</span>
                </div>
                <span className="text-[11px] font-semibold text-teal-800">Instant Processing</span>
              </div>

              {paymentMethod === 'sim_card' && (
                <div className="mt-4 pt-3 border-t border-teal-100 space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Select Simulated Card Authorization Outcome:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setSimCardOutcome('success'); }}
                      className={`rounded-lg py-2 px-3 text-xs font-semibold border text-center transition-all ${
                        simCardOutcome === 'success'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-600'
                          : 'border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      ✓ Approve (Success)
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setSimCardOutcome('declined'); }}
                      className={`rounded-lg py-2 px-3 text-xs font-semibold border text-center transition-all ${
                        simCardOutcome === 'declined'
                          ? 'border-rose-600 bg-rose-50 text-rose-900 ring-1 ring-rose-600'
                          : 'border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      ✗ Decline (Insufficient Funds)
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setSimCardOutcome('pending'); }}
                      className={`rounded-lg py-2 px-3 text-xs font-semibold border text-center transition-all ${
                        simCardOutcome === 'pending'
                          ? 'border-amber-600 bg-amber-50 text-amber-900 ring-1 ring-amber-600'
                          : 'border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      ⏳ Pending (3DS Review)
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Manual EFT */}
            <div
              onClick={() => setPaymentMethod('manual_eft')}
              className={`cursor-pointer rounded-xl border p-4 transition-all ${
                paymentMethod === 'manual_eft'
                  ? 'border-teal-700 bg-teal-50/40 ring-1 ring-teal-700'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Landmark className="h-5 w-5 text-teal-800" />
                  <span className="text-xs font-bold text-slate-900">Manual Bank Transfer / EFT</span>
                </div>
                <span className="text-[11px] text-slate-500">Official Invoice Reference</span>
              </div>

              {paymentMethod === 'manual_eft' && (
                <div className="mt-4 pt-3 border-t border-teal-100 text-xs text-slate-600 space-y-1">
                  <p className="font-semibold text-slate-800">Transfer directly into our bank account:</p>
                  <p>Bank: <strong className="text-slate-900">{bankDetails.bank_name}</strong> • Account: <strong className="text-slate-900">{bankDetails.bank_account_number}</strong></p>
                  <p>Branch Code: <strong className="text-slate-900">{bankDetails.bank_branch_code}</strong></p>
                  <p className="text-[11px] text-teal-800 font-medium">
                    Please use your Order Number as payment reference. Your order will dispatch as soon as funds clear.
                  </p>
                </div>
              )}
            </div>

            {/* Pay on Delivery */}
            <div
              onClick={() => setPaymentMethod('pay_on_delivery')}
              className={`cursor-pointer rounded-xl border p-4 transition-all ${
                paymentMethod === 'pay_on_delivery'
                  ? 'border-teal-700 bg-teal-50/40 ring-1 ring-teal-700'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Truck className="h-5 w-5 text-teal-800" />
                  <span className="text-xs font-bold text-slate-900">Pay on Delivery (Gauteng only)</span>
                </div>
                <span className="text-[11px] text-slate-500">Card or Cash to Courier</span>
              </div>
            </div>
          </div>
        </section>

        {/* Step 4: Optional Customer Note */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
          <label htmlFor="customerNote" className="block text-xs font-semibold text-slate-700">
            Order Note / Special Delivery Instructions (Optional)
          </label>
          <textarea
            id="customerNote"
            rows={2}
            value={customerNote}
            onChange={(e) => setCustomerNote(e.target.value)}
            placeholder="e.g. Please leave at the security gate or call on arrival..."
            className="w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-900 focus:border-teal-700 focus:outline-none"
          />
        </section>
      </div>

      {/* Order Summary & Place Order */}
      <div className="lg:col-span-4 space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h3 className="font-serif text-lg font-bold text-slate-900 pb-3 border-b border-slate-100">
            Order Overview ({cart.itemCount} items)
          </h3>

          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 pr-1 space-y-2">
            {cart.items.map(item => (
              <div key={item.id} className="pt-2 flex items-center gap-3">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded bg-slate-100 border border-slate-200">
                  <Image src={item.image_url || '/seed/a4-notebook.svg'} alt={item.product_name} fill className="object-cover" referrerPolicy="no-referrer" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">{item.product_name}</p>
                  <p className="text-[11px] text-slate-500">{item.qty} × {formatZar(item.unit_price_cents)}</p>
                </div>
                <span className="text-xs font-semibold text-slate-900">
                  {formatZar(item.line_subtotal_cents)}
                </span>
              </div>
            ))}
          </div>

          <div className="space-y-2 pt-3 border-t border-slate-200 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span className="font-semibold text-slate-900">{formatZar(cart.subtotalCents)}</span>
            </div>

            {cart.discountCents > 0 && (
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>Coupon ({cart.couponCode})</span>
                <span>-{formatZar(cart.discountCents)}</span>
              </div>
            )}

            <div className="flex justify-between text-slate-600">
              <span>Delivery</span>
              <span className="font-semibold text-slate-900">
                {cart.shippingCents === 0 ? 'FREE' : formatZar(cart.shippingCents)}
              </span>
            </div>

            {cart.taxCents > 0 && (
              <div className="flex justify-between text-slate-500 text-[11px]">
                <span>Includes 15% VAT</span>
                <span>{formatZar(cart.taxCents)}</span>
              </div>
            )}

            <div className="pt-3 border-t border-slate-200 flex justify-between text-base font-bold text-slate-900">
              <span>Total to Pay</span>
              <span className="text-xl text-teal-900">{formatZar(cart.totalCents)}</span>
            </div>
          </div>

          {errorMessage && (
            <div className="rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-800 border border-rose-200 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <button
            type="submit"
            id="place-order-button"
            disabled={isSubmitting || !selectedAddressId}
            className="w-full rounded-xl bg-teal-800 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Placing Order...' : 'Place Order & Generate Invoice'}
          </button>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 pt-2">
            <ShieldCheck className="h-4 w-4 text-teal-800" />
            <span>POPIA Protected • 100% Deterministic Sandbox</span>
          </div>
        </div>
      </div>
    </form>
  );
}
