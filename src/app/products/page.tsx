import { ProductCard } from '@/components/ProductCard';
import { categories } from '@/lib/config';
import { getProducts } from '@/lib/products';

export const metadata = { title: 'Products' };

type ProductsPageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams;
  const products = await getProducts({ search: params.q, category: params.category, sort: params.sort });

  return (
    <section className="container py-12">
      <div className="max-w-2xl">
        <p className="badge w-fit">Catalog</p>
        <h1 className="mt-3 text-4xl font-black">Products</h1>
        <p className="mt-3 text-zinc-400">Browse active products, custom-friendly designs, and coming-soon pieces.</p>
      </div>

      <form className="glass mt-8 grid gap-3 rounded-3xl p-4 md:grid-cols-4">
        <input className="input md:col-span-2" name="q" placeholder="Search products" defaultValue={params.q} />
        <select className="input" name="category" defaultValue={params.category}>
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category}>{category}</option>
          ))}
        </select>
        <select className="input" name="sort" defaultValue={params.sort}>
          <option value="newest">Newest</option>
          <option value="featured">Featured</option>
          <option value="price-low">Price low/high</option>
          <option value="price-high">Price high/low</option>
        </select>
        <button className="btn btn-primary md:col-span-4">Apply filters</button>
      </form>

      {products.length ? (
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="glass mt-10 rounded-3xl p-8 text-center text-zinc-400">No products found. Try another search.</div>
      )}
    </section>
  );
}
