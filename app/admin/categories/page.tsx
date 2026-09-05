import { db } from '@/lib/db';
import { adminSaveCategoryAction, adminDeleteCategoryAction } from '@/app/actions/admin';
import ActionForm from '@/components/ActionForm';
import { Plus, Trash2 } from 'lucide-react';

export default async function AdminCategoriesPage() {
  const categories = await db.prepare(`
    SELECT c.*,
           (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) as product_count
    FROM categories c
    ORDER BY c.sort_order ASC, c.name ASC
  `).all() as any[];

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="font-serif text-3xl font-bold text-slate-900">Categories Management</h1>
        <p className="text-xs text-slate-500 mt-1">Organize stationery collections and storefront navigation.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Existing Categories Table */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="font-serif text-base font-bold text-slate-900">Existing Categories ({categories.length})</h2>

          <div className="divide-y divide-slate-100 text-xs">
            {categories.map(c => (
              <div key={c.id} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{c.name}</span>
                    <span className="text-[10px] font-mono text-slate-400">/{c.slug}</span>
                    {c.active === 0 && (
                      <span className="rounded bg-slate-100 px-1 text-[10px] text-slate-500">Hidden</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">{c.description || 'No description'}</p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                    {c.product_count} items
                  </span>

                  <ActionForm action={async () => {
                    'use server';
                    return adminDeleteCategoryAction(c.id);
                  }}>
                    <button
                      type="submit"
                      disabled={c.product_count > 0}
                      title={c.product_count > 0 ? 'Cannot delete category with products' : 'Delete category'}
                      className="text-rose-600 hover:text-rose-800 disabled:opacity-30"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </ActionForm>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Add Category Form */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="font-serif text-base font-bold text-slate-900 flex items-center gap-2">
            <Plus className="h-4 w-4 text-teal-800" />
            <span>Add New Category</span>
          </h2>

          <ActionForm action={async (formData: FormData) => {
            'use server';
            return adminSaveCategoryAction(null, formData);
          }} successMessage="Category saved." className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Category Name *</label>
              <input
                name="name"
                required
                placeholder="e.g. Calligraphy &amp; Inks"
                className="w-full rounded-lg border border-slate-200 p-2 focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Slug *</label>
              <input
                name="slug"
                required
                placeholder="calligraphy-inks"
                className="w-full rounded-lg border border-slate-200 p-2 font-mono focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Description</label>
              <textarea
                name="description"
                rows={2}
                placeholder="Brief summary of items in this category..."
                className="w-full rounded-lg border border-slate-200 p-2 focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Sort Order (Priority)</label>
              <input
                name="sort_order"
                type="number"
                defaultValue={categories.length + 1}
                className="w-full rounded-lg border border-slate-200 p-2 font-mono focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="cat_active"
                name="active"
                defaultChecked
                className="h-4 w-4 rounded border-slate-300 text-teal-800 focus:ring-teal-700"
              />
              <label htmlFor="cat_active" className="font-semibold text-slate-700 cursor-pointer">
                Active in Storefront
              </label>
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-teal-800 py-2.5 font-semibold text-white hover:bg-teal-900 transition-colors"
            >
              Create Category
            </button>
          </ActionForm>
        </div>
      </div>
    </div>
  );
}
