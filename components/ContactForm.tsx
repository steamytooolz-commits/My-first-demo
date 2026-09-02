'use client';

import { useState } from 'react';

export default function ContactForm() {
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div className="rounded-xl bg-teal-50 border border-teal-200 p-6 text-center space-y-2">
        <p className="font-bold text-teal-950 text-sm">Thank You for Getting in Touch</p>
        <p className="text-xs text-teal-800">
          Your message has been received. Our stationery advisory team will respond within one business day.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setSubmitted(true);
      }}
      className="space-y-4"
    >
      <div>
        <label className="block font-semibold text-slate-700 mb-1">Your Name</label>
        <input
          type="text"
          required
          placeholder="e.g. Lerato Mokoena"
          className="w-full rounded-lg border border-slate-200 p-2 focus:border-teal-700 focus:outline-none"
        />
      </div>

      <div>
        <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
        <input
          type="email"
          required
          placeholder="lerato@example.co.za"
          className="w-full rounded-lg border border-slate-200 p-2 focus:border-teal-700 focus:outline-none"
        />
      </div>

      <div>
        <label className="block font-semibold text-slate-700 mb-1">Message</label>
        <textarea
          rows={4}
          required
          placeholder="How can we assist you with our stationery?"
          className="w-full rounded-lg border border-slate-200 p-2 focus:border-teal-700 focus:outline-none"
        />
      </div>

      <button
        type="submit"
        className="w-full rounded-xl bg-teal-800 py-2.5 font-semibold text-white hover:bg-teal-900 transition-colors"
      >
        Send Message
      </button>
    </form>
  );
}
