import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ProductDetailClient from '@/components/ProductDetailClient';
import { db } from '@/lib/db';
import { ShieldCheck, Truck, RotateCcw } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;

  const product = db.prepare(`
    SELECT p.*, c.name as category_name, c.slug as category_slug
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.slug = ? AND p.active = 1
  `).get(slug) as any;

  if (!product) {
    notFound();
  }

  const images = db.prepare(`
    SELECT url, alt FROM product_images WHERE product_id = ? ORDER BY position ASC
  `).all(product.id) as any[];

  const variants = db.prepare(`
    SELECT id, sku, name, price_cents, compare_at_price_cents, stock_qty, low_stock_threshold, weight_g, options_json
    FROM product_variants
    WHERE product_id = ? AND active = 1
    ORDER BY price_cents ASC
  `).all(product.id) as any[];

  const primaryImage = images[0]?.url || '/seed/a4-notebook.svg';

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-2 text-xs text-slate-500">
          <Link href="/" className="hover:text-slate-800">Home</Link>
          <span>/</span>
          <Link href="/catalog" className="hover:text-slate-800">Catalog</Link>
          {product.category_name && (
            <>
              <span>/</span>
              <Link href={`/catalog?category=${product.category_slug}`} className="hover:text-slate-800">
                {product.category_name}
              </Link>
            </>
          )}
          <span>/</span>
          <span className="text-slate-900 font-medium truncate max-w-[200px]">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          {/* Left: Product Image Gallery */}
          <div className="lg:col-span-6 space-y-4">
            <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <Image
                src={primaryImage}
                alt={product.name}
                fill
                priority
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {images.map((img: any, i: number) => (
                  <div key={i} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <Image src={img.url} alt={img.alt || product.name} fill className="object-cover" referrerPolicy="no-referrer" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Product Details & Purchase Form */}
          <div className="lg:col-span-6 space-y-6">
            <div>
              {product.brand && (
                <p className="text-xs font-bold uppercase tracking-wider text-teal-800">
                  {product.brand}
                </p>
              )}
              <h1 className="mt-1 font-serif text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
                {product.name}
              </h1>
            </div>

            {/* Interactive Variant Picker & Add to Cart Client Component */}
            <ProductDetailClient
              productId={product.id}
              productName={product.name}
              variants={variants}
            />

            {/* Description */}
            <div className="pt-6 border-t border-slate-200">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-900 mb-2">Description</h3>
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                {product.description || 'Crafted with premium materials for discerning stationery users.'}
              </p>
            </div>

            {/* Trust Assurances */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 pt-6 border-t border-slate-200 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-teal-800 shrink-0" />
                <span>Johannesburg Courier Dispatch</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-teal-800 shrink-0" />
                <span>POPIA Data Protected</span>
              </div>
              <div className="flex items-center gap-2">
                <RotateCcw className="h-4 w-4 text-teal-800 shrink-0" />
                <span>14-Day Returns</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
