import Link from 'next/link';
import { siteConfig } from '@/lib/config';

export function Footer() {
  return (
    <footer className="mt-24 border-t border-white/10 py-10 text-zinc-400">
      <div className="container grid gap-8 md:grid-cols-3">
        <div>
          <p className="font-black text-white">{siteConfig.name}</p>
          <p className="mt-2 max-w-sm">Creative custom prints, decor, collectibles, and functional handmade pieces.</p>
        </div>

        <nav className="flex flex-wrap gap-4">
          <Link href="/products">Products</Link>
          <Link href="/suggest">Suggest</Link>
          <Link href="/about">About</Link>
          <Link href="/contact">Contact</Link>
        </nav>

        <div className="md:text-right">
          <Link className="text-orange-300" href={siteConfig.etsyUrl}>
            Shop on Etsy
          </Link>
          <p className="mt-2">Instagram · TikTok · YouTube</p>
        </div>
      </div>
    </footer>
  );
}
