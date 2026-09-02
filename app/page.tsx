import Link from 'next/link';
import Image from 'next/image';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ProductCard from '@/components/ProductCard';
import { db } from '@/lib/db';
import { ArrowRight, Truck, ShieldCheck, Feather, FileText } from 'lucide-react';

export default async function HomePage() {
  // Fetch active categories with product counts
  const categories = await db.prepare(`
    SELECT c.id, c.name, c.slug, c.description,
           (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.active = 1) as product_count
    FROM categories c
    WHERE c.active = 1
    ORDER BY c.sort_order ASC
  `).all() as any[];

  // Fetch featured products with variant aggregation
  const rawFeatured = await db.prepare(`
    SELECT 
      p.id, p.name, p.slug, p.brand,
      c.name as category_name,
      (SELECT url FROM product_images WHERE product_id = p.id ORDER BY position ASC LIMIT 1) as image_url,
      MIN(pv.price_cents) as min_price_cents,
      MAX(pv.price_cents) as max_price_cents,
      SUM(pv.stock_qty) as total_stock,
      COUNT(pv.id) as variant_count,
      (SELECT id FROM product_variants WHERE product_id = p.id AND active = 1 ORDER BY price_cents ASC LIMIT 1) as default_variant_id
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    JOIN product_variants pv ON pv.product_id = p.id AND pv.active = 1
    WHERE p.active = 1 AND p.featured = 1
    GROUP BY p.id
    ORDER BY p.created_at DESC
    LIMIT 8
  `).all() as any[];

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative border-b border-slate-200 bg-white py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-center">
              <div className="lg:col-span-7 space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50/70 px-3 py-1 text-xs font-medium text-teal-800">
                  <Feather className="h-3.5 w-3.5" />
                  <span>South African Artisan Stationery</span>
                </div>

                <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 leading-[1.15]">
                  Tools for clear minds and deliberate work.
                </h1>

                <p className="max-w-2xl text-base sm:text-lg text-slate-600 leading-relaxed">
                  Discover Smyth-sewn journals, machined brass pens, archival copy paper, and ergonomic desktop essentials crafted for writers, designers, and students.
                </p>

                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <Link
                    href="/catalog"
                    id="hero-explore-button"
                    className="inline-flex items-center justify-center rounded-xl bg-teal-800 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-teal-900 transition-colors gap-2"
                  >
                    <span>Browse All Stationery</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/catalog?category=pens-writing"
                    className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Fine Writing
                  </Link>
                </div>
              </div>

              {/* Visual Showcase Card */}
              <div className="lg:col-span-5">
                <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-100 to-slate-200 p-8 shadow-sm">
                  <div className="space-y-4">
                    <span className="text-xs font-semibold uppercase tracking-wider text-teal-800">Featured Highlight</span>
                    <h3 className="font-serif text-2xl font-bold text-slate-900">Kalahari Executive A4 Hardcover</h3>
                    <p className="text-sm text-slate-600">
                      192 numbered pages of 100gsm acid-free ivory paper. Built for fountain pens with zero bleed-through.
                    </p>
                    <div className="pt-2 flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-slate-900">R 245.00</span>
                      <span className="text-sm text-slate-400 line-through">R 280.00</span>
                    </div>
                    <Link
                      href="/products/a4-hardcover-notebook"
                      className="inline-block mt-4 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
                    >
                      View Product &amp; Options
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Benefits Strip */}
        <section className="border-b border-slate-200 bg-slate-100/60 py-6">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="flex items-center gap-3">
                <Truck className="h-5 w-5 text-teal-800 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-slate-900">Free SA Delivery</p>
                  <p className="text-[11px] text-slate-500">On all orders over R950</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Feather className="h-5 w-5 text-teal-800 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-slate-900">Archival Quality</p>
                  <p className="text-[11px] text-slate-500">Acid-free ink safe paper</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-teal-800 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-slate-900">VAT Tax Invoices</p>
                  <p className="text-[11px] text-slate-500">Official South African invoices</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-teal-800 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-slate-900">POPIA Compliant</p>
                  <p className="text-[11px] text-slate-500">Privacy &amp; data export rights</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Category Explorer */}
        <section className="py-14">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
              <div>
                <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900">Shop by Category</h2>
                <p className="mt-1 text-sm text-slate-500">Curated materials designed for notebooks, drafting, and office organization.</p>
              </div>
              <Link href="/catalog" className="text-xs font-semibold text-teal-800 hover:text-teal-900 flex items-center gap-1">
                <span>View all products</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {categories.map((cat: any) => (
                <Link
                  key={cat.id}
                  href={`/catalog?category=${cat.slug}`}
                  className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-teal-700 hover:shadow-md transition-all"
                >
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 group-hover:text-teal-800 transition-colors">
                      {cat.name}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                      {cat.description}
                    </p>
                  </div>
                  <div className="mt-4 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 group-hover:text-teal-700">
                    <span>{cat.product_count} items</span>
                    <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Featured Products Grid */}
        <section className="border-t border-slate-200 bg-slate-50 py-14">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900">Featured Curations</h2>
                <p className="mt-1 text-sm text-slate-500">Most sought-after stationery items in our Johannesburg inventory.</p>
              </div>
              <Link href="/catalog" className="text-xs font-semibold text-teal-800 hover:text-teal-900 flex items-center gap-1">
                <span>Browse catalog</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {rawFeatured.map((product: any) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
