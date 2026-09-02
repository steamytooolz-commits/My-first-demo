import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-4xl flex-1 px-4 py-12 sm:px-6 lg:px-8 space-y-8">
        <div>
          <h1 className="font-serif text-3xl font-bold text-slate-900">About Paper &amp; Quill</h1>
          <p className="text-xs text-slate-500 mt-1">Artisan stationery, fountain pens, and archival paper curated in South Africa.</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 space-y-6 text-xs text-slate-700 leading-relaxed">
          <p>
            Founded in Johannesburg, <strong>Paper &amp; Quill</strong> was established out of a quiet reverence for tactile handwriting and thoughtful daily rituals. We believe that writing on 100gsm fountain-pen friendly cotton paper with a well-balanced instrument brings clarity, focus, and enduring pleasure to work and personal reflection.
          </p>
          <p>
            Every product in our collection is rigorously selected or crafted to archival standards. From hand-stitched lay-flat journals to solid brass drafting pencils and bottled mineral inks, our tools are built to last for generations of thought.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
