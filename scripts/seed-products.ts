import { createClient } from "@supabase/supabase-js";
import { mockProducts } from "../src/lib/mock-data";

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const products = mockProducts.map((mockProduct) => ({
    name: mockProduct.name,
    slug: mockProduct.slug,
    short_description: mockProduct.short_description,
    full_description: mockProduct.full_description,
    category: mockProduct.category,
    price: mockProduct.price,
    etsy_url: mockProduct.etsy_url,
    main_image_url: mockProduct.main_image_url,
    video_url: mockProduct.video_url,
    materials: mockProduct.materials,
    dimensions: mockProduct.dimensions,
    customization_notes: mockProduct.customization_notes,
    source_url: mockProduct.source_url,
    license_notes: mockProduct.license_notes,
    tags: mockProduct.tags,
    featured: mockProduct.featured,
    active: mockProduct.active,
  }));

  const { data, error } = await supabase
    .from("products")
    .upsert(products, { onConflict: "slug" })
    .select("id, name, slug");

  if (error) throw error;

  console.log(`Seeded ${data.length} products.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
