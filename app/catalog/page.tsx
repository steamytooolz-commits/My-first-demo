import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ProductCard from '@/components/ProductCard';
import AutoSubmitSelect from '@/components/AutoSubmitSelect';
import { db } from '@/lib/db';
import { Search, Filter, X } from 'lucide-react';

interface CatalogPageProps {
  searchParams: Promise<{
    category?: string;
    q?: string;
    inStock?: string;
    minPrice?: string;
    maxPrice?: string;
    sort?: string;
  }>;
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const resolvedParams = await searchParams;
  const categorySlug = resolvedParams.category || '';
  const searchQuery = resolvedParams.q?.trim() || '';
  const inStockOnly = resolvedParams.inStock === 'true';
  const minPriceRand = parseFloat(resolvedParams.minPrice || '0') || 0;
  const maxPriceRand = parseFloat(resolvedParams.maxPrice || '0') || 0;
  const sort = resolvedParams.sort || 'featured';

  // Categories list for filter sidebar
  const categories = await db.prepare(`
    SELECT id, name, slug,
           (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.active = 1) as count
    FROM categories c
    WHERE c.active = 1
    ORDER BY c.sort_order ASC
  `).all() as any[];

  // Build dynamic SQL query for products
  let whereClauses: string[] = ['p.active = 1', 'pv.active = 1'];
  const queryParams: any[] = [];

  if (categorySlug) {
    whereClauses.push('c.slug = ?');
    queryParams.push(categorySlug);
  }

  if (searchQuery) {
    whereClauses.push('(p.name LIKE ? OR p.description LIKE ? OR p.brand LIKE ? OR pv.sku LIKE ?)');
    const term = `%${searchQuery}%`;
    queryParams.push(term, term, term, term);
  }

  let havingClauses: string[] = [];
  if (inStockOnly) {
    havingClauses.push('total_stock > 0');
  }

  if (minPriceRand > 0) {
    havingClauses.push('min_price_cents >= ?');
    queryParams.push(Math.round(minPriceRand * 100));
  }

  if (maxPriceRand > 0) {
    havingClauses.push('min_price_cents <= ?');
    queryParams.push(Math.round(maxPriceRand * 100));
  }

  let orderBy = 'p.featured DESC, p.created_at DESC';
  if (sort === 'price-asc') orderBy = 'min_price_cents ASC';
  else if (sort === 'price-desc') orderBy = 'min_price_cents DESC';
  else if (sort === 'newest') orderBy = 'p.created_at DESC';

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const havingSql = havingClauses.length > 0 ? `HAVING ${havingClauses.join(' AND ')}` : '';

  const query = `
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
    JOIN product_variants pv ON pv.product_id = p.id
    ${whereSql}
    GROUP BY p.id
    ${havingSql}
    ORDER BY ${orderBy}
  `;

  const products = await db.prepare(query).all(...queryParams) as any[];

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {/* Breadcrumb & Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <Link href="/" className="hover:text-slate-800">Home</Link>
              <span>/</span>
              <span className="text-slate-900 font-medium">Catalog</span>
              {categorySlug && (
                <>
                  <span>/</span>
                  <span className="text-teal-800 font-medium capitalize">
                    {categories.find(c => c.slug === categorySlug)?.name || categorySlug}
                  </span>
                </>
              )}
            </div>
            <h1 className="font-serif text-3xl font-bold text-slate-900">
              {categorySlug
                ? categories.find(c => c.slug === categorySlug)?.name || 'Catalog'
                : 'All Stationery'}
            </h1>
            <p className="text-xs text-slate-500 mt-1">Showing {products.length} products</p>
          </div>

          {/* Active filter pills */}
          {(categorySlug || searchQuery || inStockOnly) && (
            <div className="flex items-center gap-2 flex-wrap">
              {searchQuery && (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2.5 py-1 text-xs text-slate-800">
                  Search: &quot;{searchQuery}&quot;
                  <Link href={`/catalog?${new URLSearchParams({ category: categorySlug, inStock: String(inStockOnly), sort }).toString()}`}>
                    <X className="h-3 w-3 hover:text-slate-900" />
                  </Link>
                </span>
              )}
              {categorySlug && (
                <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2.5 py-1 text-xs text-teal-900">
                  Category: {categories.find(c => c.slug === categorySlug)?.name}
                  <Link href={`/catalog?${new URLSearchParams({ q: searchQuery, inStock: String(inStockOnly), sort }).toString()}`}>
                    <X className="h-3 w-3 hover:text-teal-950" />
                  </Link>
                </span>
              )}
              <Link
                href="/catalog"
                className="text-xs font-semibold text-rose-600 hover:text-rose-800"
              >
                Clear all filters
              </Link>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
          {/* Filters Sidebar */}
          <aside className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-6">
              <div className="flex items-center gap-2 font-semibold text-slate-900 text-sm pb-3 border-b border-slate-100">
                <Filter className="h-4 w-4 text-teal-800" />
                <span>Filters &amp; Search</span>
              </div>

              {/* Keyword search input */}
              <form method="GET" action="/catalog" className="space-y-4">
                {categorySlug && <input type="hidden" name="category" value={categorySlug} />}
                {sort && <input type="hidden" name="sort" value={sort} />}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Search Keywords</label>
                  <div className="relative">
                    <input
                      type="text"
                      name="q"
                      defaultValue={searchQuery}
                      placeholder="e.g. A4, gel pen, brass..."
                      className="w-full rounded-lg border border-slate-200 py-1.5 pl-8 pr-3 text-xs focus:border-teal-700 focus:outline-none"
                    />
                    <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                  </div>
                </div>

                {/* In stock toggle */}
                <div className="flex items-center justify-between pt-1">
                  <label htmlFor="inStock" className="text-xs font-medium text-slate-700">In Stock Only</label>
                  <input
                    type="checkbox"
                    id="inStock"
                    name="inStock"
                    value="true"
                    defaultChecked={inStockOnly}
                    className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-700"
                  />
                </div>

                {/* Price range */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Price Range (ZAR)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      name="minPrice"
                      defaultValue={minPriceRand > 0 ? minPriceRand : ''}
                      placeholder="Min R"
                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                    />
                    <input
                      type="number"
                      name="maxPrice"
                      defaultValue={maxPriceRand > 0 ? maxPriceRand : ''}
                      placeholder="Max R"
                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full rounded-lg bg-teal-800 py-2 text-xs font-semibold text-white hover:bg-teal-900 transition-colors"
                >
                  Apply Filters
                </button>
              </form>

              {/* Categories list */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-900 mb-3">Categories</h4>
                <ul className="space-y-1.5 text-xs">
                  <li>
                    <Link
                      href={`/catalog?${new URLSearchParams({ q: searchQuery, inStock: String(inStockOnly), sort }).toString()}`}
                      className={`block px-2.5 py-1.5 rounded-md transition-colors ${!categorySlug ? 'bg-teal-50 font-bold text-teal-900' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      All Categories
                    </Link>
                  </li>
                  {categories.map(c => (
                    <li key={c.id}>
                      <Link
                        href={`/catalog?category=${c.slug}&${new URLSearchParams({ q: searchQuery, inStock: String(inStockOnly), sort }).toString()}`}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-md transition-colors ${categorySlug === c.slug ? 'bg-teal-50 font-bold text-teal-900' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        <span>{c.name}</span>
                        <span className="text-[10px] text-slate-400">({c.count})</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </aside>

          {/* Product Grid */}
          <div className="lg:col-span-3">
            {/* Sort toolbar */}
            <div className="mb-6 flex items-center justify-end">
              <form method="GET" action="/catalog" className="flex items-center gap-2 text-xs text-slate-600">
                {categorySlug && <input type="hidden" name="category" value={categorySlug} />}
                {searchQuery && <input type="hidden" name="q" value={searchQuery} />}
                {inStockOnly && <input type="hidden" name="inStock" value="true" />}
                <label htmlFor="sort-select" className="font-medium">Sort by:</label>
                <AutoSubmitSelect
                  id="sort-select"
                  name="sort"
                  defaultValue={sort}
                  className="rounded-lg border border-slate-200 bg-white py-1.5 pl-2.5 pr-8 text-xs text-slate-900 focus:border-teal-700 focus:outline-none cursor-pointer"
                >
                  <option value="featured">Featured Curations</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="newest">Newest Arrivals</option>
                </AutoSubmitSelect>
              </form>
            </div>

            {products.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
                <p className="font-serif text-lg font-bold text-slate-900">No stationery found</p>
                <p className="mt-1 text-xs text-slate-500">Try adjusting your filters or search keywords.</p>
                <Link
                  href="/catalog"
                  className="mt-4 inline-block rounded-lg bg-teal-800 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-900 transition-colors"
                >
                  View All Products
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {products.map(product => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
