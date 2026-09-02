'use client';

import { Printer } from 'lucide-react';

export default function InvoicePrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print inline-flex items-center gap-2 rounded-xl bg-teal-800 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-teal-900 transition-colors"
    >
      <Printer className="h-4 w-4" />
      <span>Print / Download PDF</span>
    </button>
  );
}
