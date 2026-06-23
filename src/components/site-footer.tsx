import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { siteConfig } from "@/lib/config";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-zinc-950">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 text-sm text-zinc-400 sm:px-6 md:grid-cols-[1fr_auto] lg:px-8">
        <div>
          <p className="font-bold text-zinc-50">{siteConfig.name}</p>
          <p className="mt-2 max-w-xl">{siteConfig.tagline}</p>
        </div>
        <div className="flex flex-wrap items-center gap-5">
          <Link className="hover:text-amber-200" href="/products">
            Products
          </Link>
          <Link className="hover:text-amber-200" href="/suggest">
            Suggest
          </Link>
          <Link className="hover:text-amber-200" href="/admin/login">
            Admin
          </Link>
          <a
            className="inline-flex items-center gap-1 font-semibold text-amber-200"
            href={siteConfig.etsyUrl}
            rel="noreferrer"
            target="_blank"
          >
            Etsy <ArrowUpRight size={14} />
          </a>
        </div>
      </div>
    </footer>
  );
}
