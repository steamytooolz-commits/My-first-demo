import Link from 'next/link';
import Image from 'next/image';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ProductCard from '@/components/ProductCard';
import { db } from '@/lib/db';
import { getStoreSettings } from '@/lib/settings';
import { formatZar } from '@/lib/money';
import { ArrowRight, Truck, ShieldCheck, Feather, FileText } from 'lucide-react';

import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  let name = 'Paper & Quill Stationery';
  try {
    const s = await getStoreSettings();
    if (s.store_name) name = s.store_name;
  } catch {}
  return {
    title: `${name} — Fine Pens, Journals & Desk Essentials`,
    description: `${name}: South African artisan stationery. Live demo storefront with cart, checkout, VAT invoices and admin.`,
  };
}

export default async function HomePage() {
  const settings = await getStoreSettings();
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

  // Hero showcase: first live featured product (never a hardcoded dead link)
  const hero = rawFeatured[0] as any | undefined;
  const heroPriceLabel = hero
    ? hero.min_price_cents === hero.max_price_cents
      ? formatZar(hero.min_price_cents)
      : `${formatZar(hero.min_price_cents)} – ${formatZar(hero.max_price_cents)}`
    : null;

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

              {/* Visual Showcase Card — live featured product */}
              <div className="lg:col-span-5">
                {hero ? (
                  <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    {hero.image_url && (
                      <div className="relative h-52 w-full bg-slate-100">
                        <Image
                          src={hero.image_url}
                          alt={hero.name}
                          fill
                          className="object-cover"
                          sizes="(max-width: 1024px) 100vw, 40vw"
                        />
                      </div>
                    )}
                    <div className="space-y-3 p-8">
                      <span className="text-xs font-semibold uppercase tracking-wider text-teal-800">Featured Highlight</span>
                      <h3 className="font-serif text-2xl font-bold text-slate-900">{hero.name}</h3>
                      {hero.brand && <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{hero.brand}</p>}
                      <div className="pt-1 flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-slate-900">{heroPriceLabel}</span>
                      </div>
                      <Link
                        href={`/products/${hero.slug}`}
                        className="inline-block mt-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
                      >
                        View Product &amp; Options
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="relative overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 shadow-sm">
                    <div className="space-y-4">
                      <span className="text-xs font-semibold uppercase tracking-wider text-teal-800">Featured Highlight</span>
                      <h3 className="font-serif text-2xl font-bold text-slate-900">New arrivals landing soon</h3>
                      <p className="text-sm text-slate-600">
                        The curation team is stocking the shelves — browse the full catalogue meanwhile.
                      </p>
                      <Link
                        href="/catalog"
                        className="inline-block mt-4 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
                      >
                        Browse Catalogue
                      </Link>
                    </div>
                  </div>
                )}
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
                  <p className="text-[11px] text-slate-500">On all orders over {formatZar(settings.free_shipping_threshold_cents)}</p>
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
                  <p className="text-xs font-bold text-slate-900">Official Invoices</p>
                  <p className="text-[11px] text-slate-500">Tax invoices when VAT-registered</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-teal-800 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-slate-900">POPIA-Aligned</p>
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
              {categories.length === 0 && (
                <p className="col-span-full rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                  Categories are being stocked — <Link href="/catalog" className="font-semibold text-teal-800 hover:underline">browse the catalogue</Link> meanwhile.
                </p>
              )}
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
              {rawFeatured.length === 0 && (
                <p className="col-span-full rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                  Featured items are being curated — <Link href="/catalog" className="font-semibold text-teal-800 hover:underline">explore everything</Link>.
                </p>
              )}
              {rawFeatured.map((product: any) => (
                <ProductCard key={product.id} product={product} storeName={settings.store_name} />
              ))}
            </div>
          </div>
        </section>

        {/* Demo tour — portfolio reviewers see the depth in one glance */}
        <section className="border-t border-slate-200 bg-white py-14">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-8">
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900">Take the full tour</h2>
              <p className="mt-1 text-sm text-slate-500">Storefront, customer portal, trade accounts and admin — all live in this demo.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Link href="/catalog" className="group rounded-xl border border-slate-200 bg-slate-50 p-6 hover:border-teal-700 hover:shadow-md transition-all">
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-teal-800">1. Shop the catalogue</h3>
                <p className="mt-1 text-xs text-slate-500">Search, filter, variants, cart, coupons and simulated checkout with VAT invoices.</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-teal-800">Start shopping <ArrowRight className="h-3.5 w-3.5" /></span>
              </Link>
              <Link href="/account/trade" className="group rounded-xl border border-slate-200 bg-slate-50 p-6 hover:border-teal-700 hover:shadow-md transition-all">
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-teal-800">2. Apply for trade (B2B)</h3>
                <p className="mt-1 text-xs text-slate-500">Approval-gated business accounts with VAT-detailed invoicing.</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-teal-800">Trade Beta <ArrowRight className="h-3.5 w-3.5" /></span>
              </Link>
              <Link href="/admin" className="group rounded-xl border border-slate-200 bg-slate-50 p-6 hover:border-teal-700 hover:shadow-md transition-all">
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-teal-800">3. Run the back office</h3>
                <p className="mt-1 text-xs text-slate-500">One-page product create, bulk CSV import, stock, orders, coupons and exports.</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-teal-800">Open admin <ArrowRight className="h-3.5 w-3.5" /></span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
