import Link from 'next/link';
import { ProductCard } from '@/components/ProductCard';
import { categories, siteConfig } from '@/lib/config';
import { getProducts } from '@/lib/products';

export default async function Home() {
  const products = await getProducts({ featured: true });

  return (
    <>
      <section className="container grid min-h-[78vh] items-center gap-10 py-20 lg:grid-cols-[1.1fr_.9fr]">
        <div className="fade-up">
          <p className="badge w-fit">3D printed · handmade · custom</p>
          <h1 className="mt-5 text-5xl font-black tracking-tight md:text-7xl">Objects that make your setup feel personal.</h1>
          <p className="mt-6 max-w-2xl text-lg text-zinc-300">{siteConfig.tagline}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="btn btn-primary" href="/products">
              Shop Products
            </Link>
            <Link className="btn btn-ghost" href="/suggest">
              Suggest an Item
            </Link>
          </div>
        </div>

        <div className="glass rounded-[2rem] p-4">
          <div className="aspect-square rounded-[1.5rem] bg-[url('https://images.unsplash.com/photo-1581090464777-f3220bbe1b8b?auto=format&fit=crop&w=1100&q=80')] bg-cover bg-center" />
        </div>
      </section>

      <section className="container py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="badge w-fit">Featured</p>
            <h2 className="mt-3 text-3xl font-black">Featured products</h2>
          </div>
          <Link className="btn btn-ghost" href="/products">
            View all
          </Link>
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      <section className="container py-12">
        <h2 className="text-3xl font-black">What We Make</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {categories.map((category) => (
            <div className="glass rounded-2xl p-6" key={category}>
              <h3 className="font-black">{category}</h3>
              <p className="mt-2 text-zinc-400">Small-batch designs, custom sizing, finish options, and practical details.</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container py-12">
        <div className="glass grid gap-6 rounded-3xl p-6 md:grid-cols-2">
          <div className="aspect-video rounded-2xl bg-zinc-800" />
          <div>
            <p className="badge w-fit">Showcase</p>
            <h2 className="mt-3 text-3xl font-black">Behind the making</h2>
            <p className="mt-3 text-zinc-300">Use this space for print timelapses, product demos, and process photography that builds trust.</p>
            <Link className="btn btn-primary mt-6" href={siteConfig.etsyUrl}>
              Visit Etsy Shop
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
