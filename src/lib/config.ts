export const siteConfig = {
  name: "PRINTZ Team Official",
  tagline: "Modern 3D printed products, desk upgrades, decor, gifts, and custom functional prints.",
  description:
    "A branded catalog for modern 3D printed products, desk accessories, home decor, collectibles, and functional prints.",
  etsyUrl: process.env.NEXT_PUBLIC_ETSY_URL || "https://printzbykhan.etsy.com",
  social: {
    instagram: process.env.NEXT_PUBLIC_INSTAGRAM_URL || "",
    tiktok: process.env.NEXT_PUBLIC_TIKTOK_URL || "",
    email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "hello@example.com",
  },
};

export const categories = [
  "Desk Accessories",
  "Collectibles",
  "Decor",
  "Functional Prints",
  "Digital Products",
  "Custom Orders",
  "Seasonal",
];

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function getAllowedAdminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}
