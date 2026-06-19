import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MediaUploader } from '@/components/MediaUploader';
import { deleteProduct, signOut, upsertProduct } from '@/lib/actions';
import { getProducts } from '@/lib/products';
import { createServerSupabase, isApprovedAdmin } from '@/lib/supabase';
import type { Product } from '@/types/database';

export const metadata = { title: 'Admin' };

export default async function Admin() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/admin/login');

  if (!isApprovedAdmin(user.email)) {
    return (
      <section className="container py-12">
        <h1 className="text-4xl font-black">Access denied</h1>
        <p className="mt-3 text-zinc-400">Your account is not approved for admin access.</p>
      </section>
    );
  }

  const products = await getProducts({ activeOnly: false });

  return (
    <section className="container py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="badge w-fit">Admin</p>
          <h1 className="mt-3 text-4xl font-black">Product dashboard</h1>
        </div>
        <form action={signOut}>
          <button className="btn btn-ghost">Sign out</button>
        </form>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link className="btn btn-primary" href="/admin/suggestions">
          View suggestions
        </Link>
        <Link className="btn btn-ghost" href="/products">
          Public catalog
        </Link>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="glass rounded-3xl p-6">
          <h2 className="text-2xl font-black">Add product</h2>
          <ProductForm />
        </div>
        <MediaUploader />
      </div>

      <div className="mt-8 grid gap-4">
        {products.map((product) => (
          <article className="glass rounded-2xl p-4" key={product.id}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-black">{product.name}</h2>
                <p className="text-sm text-zinc-400">
                  {product.category} · {product.active ? 'Active' : 'Inactive'} · {product.featured ? 'Featured' : 'Standard'}
                </p>
              </div>
              <form action={deleteProduct}>
                <input type="hidden" name="id" value={product.id} />
                <button className="btn btn-ghost">Delete</button>
              </form>
            </div>
            <details className="mt-4">
              <summary className="cursor-pointer text-orange-300">Edit product</summary>
              <ProductForm product={product} />
            </details>
          </article>
        ))}
      </div>
    </section>
  );
}

function ProductForm({ product }: { product?: Product }) {
  const fields = [
    'name',
    'slug',
    'short_description',
    'category',
    'price',
    'etsy_url',
    'main_image_url',
    'video_url',
    'materials',
    'dimensions',
    'customization_notes',
    'tags',
  ] as const;

  return (
    <form action={upsertProduct} className="mt-4 grid gap-3 md:grid-cols-2">
      {product ? <input type="hidden" name="id" value={product.id} /> : null}
      {fields.map((field) => (
        <input
          key={field}
          className="input"
          name={field}
          placeholder={field.replaceAll('_', ' ')}
          defaultValue={Array.isArray(product?.[field]) ? product?.[field]?.join(', ') : product?.[field] ?? ''}
        />
      ))}
      <textarea
        className="input min-h-32 md:col-span-2"
        name="full_description"
        placeholder="Full description"
        defaultValue={product?.full_description}
      />
      <label className="flex items-center gap-2 text-sm text-zinc-300">
        <input name="featured" type="checkbox" defaultChecked={product?.featured} /> Featured
      </label>
      <label className="flex items-center gap-2 text-sm text-zinc-300">
        <input name="active" type="checkbox" defaultChecked={product?.active ?? true} /> Active
      </label>
      <button className="btn btn-primary md:col-span-2">Save product</button>
    </form>
  );
}
