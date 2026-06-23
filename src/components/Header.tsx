import Link from 'next/link';
import { siteConfig } from '@/lib/config';

const navItems = [
  { label: 'Products', href: '/products' },
  { label: 'Suggest', href: '/suggest' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-zinc-950/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link href="/" className="text-xl font-black tracking-tight">
          {siteConfig.name}
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-zinc-300 md:flex">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="transition hover:text-white">
              {item.label}
            </Link>
          ))}
        </nav>

        <Link className="btn btn-primary py-2" href={siteConfig.etsyUrl}>
          Etsy Shop
        </Link>
      </div>
    </header>
  );
}
