import Link from 'next/link';
import type { Product } from '@/types/database';

type ProductCardProps = {
  product: Product;
};

export function ProductCard({ product }: ProductCardProps) {
  const isComingSoon = !product.etsy_url;
  const isCustom = product.tags?.includes('custom');

  return (
    <article className="glass group overflow-hidden rounded-3xl transition duration-300 hover:-translate-y-1 hover:border-orange-300/40">
      <div className="aspect-[4/3] overflow-hidden bg-zinc-900">
        <img
          src={product.main_image_url ?? '/placeholder.svg'}
          alt={product.name}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
      </div>

      <div className="p-5">
        <div className="mb-3 flex flex-wrap gap-2">
          <span className="badge">{product.category}</span>
          {isComingSoon ? <span className="badge">Coming Soon</span> : null}
          {isCustom ? <span className="badge">Custom Order Available</span> : null}
        </div>

        <h3 className="text-xl font-black">{product.name}</h3>
        <p className="mt-2 line-clamp-2 text-sm text-zinc-400">{product.short_description}</p>

        <div className="mt-5 flex items-center justify-between gap-3">
          <span className="font-bold">{product.price ? `$${product.price}` : 'Quote'}</span>
          <Link className="btn btn-ghost py-2" href={`/products/${product.slug}`}>
            View Details
          </Link>
        </div>
      </div>
    </article>
  );
}
