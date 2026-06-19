import { createServerSupabase } from '@/lib/supabase';
import { sampleProducts } from '@/lib/sample-data';
import type { Product, ProductMedia } from '@/types/database';

type ProductQuery = {
  activeOnly?: boolean;
  featured?: boolean;
  search?: string;
  category?: string;
  sort?: string;
};

function filterFallbackProducts({ activeOnly = true, featured, search, category, sort = 'newest' }: ProductQuery) {
  const normalizedSearch = search?.toLowerCase().trim();

  return sampleProducts
    .filter((product) => !activeOnly || product.active)
    .filter((product) => featured === undefined || product.featured === featured)
    .filter((product) => !category || product.category === category)
    .filter((product) => {
      if (!normalizedSearch) return true;
      return [product.name, product.short_description, product.full_description, product.category, ...(product.tags ?? [])]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch);
    })
    .sort((a, b) => {
      if (sort === 'price-low') return (a.price ?? Number.MAX_VALUE) - (b.price ?? Number.MAX_VALUE);
      if (sort === 'price-high') return (b.price ?? 0) - (a.price ?? 0);
      if (sort === 'featured') return Number(b.featured) - Number(a.featured);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
}

export async function getProducts(query: ProductQuery = {}) {
  const { activeOnly = true, featured, search, category, sort = 'newest' } = query;

  try {
    const supabase = await createServerSupabase();
    let request = supabase.from('products').select('*');

    if (activeOnly) request = request.eq('active', true);
    if (featured !== undefined) request = request.eq('featured', featured);
    if (category) request = request.eq('category', category);
    if (search) request = request.or(`name.ilike.%${search}%,short_description.ilike.%${search}%`);

    if (sort === 'price-low') request = request.order('price', { ascending: true, nullsFirst: false });
    else if (sort === 'price-high') request = request.order('price', { ascending: false, nullsFirst: false });
    else if (sort === 'featured') request = request.order('featured', { ascending: false }).order('created_at', { ascending: false });
    else request = request.order('created_at', { ascending: false });

    const { data, error } = await request;
    if (error) throw error;

    return data as Product[];
  } catch {
    return filterFallbackProducts(query);
  }
}

export async function getProduct(slug: string) {
  const fallback = sampleProducts.find((product) => product.slug === slug) ?? null;

  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.from('products').select('*').eq('slug', slug).eq('active', true).single();

    if (error) return fallback;
    return data as Product;
  } catch {
    return fallback;
  }
}

export async function getProductMedia(productId: string) {
  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from('product_media')
      .select('*')
      .eq('product_id', productId)
      .order('sort_order');

    if (error) throw error;
    return data as ProductMedia[];
  } catch {
    return [];
  }
}
