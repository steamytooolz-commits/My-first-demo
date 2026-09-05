import { db } from '@/lib/db';
import AdminProductCreateForm from '@/components/AdminProductCreateForm';

export default async function AdminNewProductPage() {
  const categories = await db.prepare('SELECT id, name FROM categories WHERE active = 1 ORDER BY name ASC').all() as any[];

  return <AdminProductCreateForm categories={categories} />;
}
