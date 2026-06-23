"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Box, Menu } from "lucide-react";
import { siteConfig } from "@/lib/config";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const nav = [
  { href: "/products", label: "Products" },
  { href: "/custom-print", label: "Print My File" },
  { href: "/suggest", label: "Suggest" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/admin/login", label: "Admin" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState<{ email: string; avatarUrl?: string | null } | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      setAccount(
        user?.email
          ? {
              email: user.email,
              avatarUrl: typeof user.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null,
            }
          : null,
      );
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      setAccount(
        user?.email
          ? {
              email: user.email,
              avatarUrl: typeof user.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null,
            }
          : null,
      );
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-zinc-950/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link className="flex items-center gap-3" href="/">
          <span className="grid size-9 place-items-center rounded-md bg-amber-300 text-zinc-950">
            <Box size={20} strokeWidth={2.4} />
          </span>
          <span className="text-base font-bold text-zinc-50">{siteConfig.name}</span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm font-medium text-zinc-300 md:flex">
          {nav.map((item) => (
            <Link className="transition hover:text-amber-200" href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <a
            className="hidden h-10 items-center gap-2 rounded-md border border-amber-300/40 px-4 text-sm font-semibold text-amber-200 transition hover:bg-amber-300 hover:text-zinc-950 sm:inline-flex"
            href={siteConfig.etsyUrl}
            rel="noreferrer"
            target="_blank"
          >
            Etsy <ArrowUpRight size={16} />
          </a>
          {account ? (
            <Link
              aria-label={`Account for ${account.email}`}
              className="grid size-10 place-items-center overflow-hidden rounded-full border border-amber-300/40 bg-zinc-900 text-sm font-black text-amber-100"
              href="/account"
              title={account.email}
            >
              {account.avatarUrl ? (
                <img alt="" className="h-full w-full object-cover" src={account.avatarUrl} />
              ) : (
                account.email.slice(0, 1).toUpperCase()
              )}
            </Link>
          ) : null}
          <button
            aria-label="Open navigation"
            aria-expanded={open}
            className="grid size-10 place-items-center rounded-md border border-white/10 text-zinc-200 md:hidden"
            onClick={() => setOpen((value) => !value)}
            type="button"
          >
            <Menu size={18} />
          </button>
        </div>
      </div>
      {open ? (
        <nav className="border-t border-white/10 px-4 py-3 md:hidden">
          <div className="mx-auto grid max-w-7xl gap-2">
            {nav.map((item) => (
              <Link className="rounded-md px-3 py-2 text-sm font-bold text-zinc-200 hover:bg-white/5 hover:text-amber-200" href={item.href} key={item.href} onClick={() => setOpen(false)}>
                {item.label}
              </Link>
            ))}
            <a className="rounded-md px-3 py-2 text-sm font-bold text-amber-200 hover:bg-white/5" href={siteConfig.etsyUrl} rel="noreferrer" target="_blank">
              Etsy shop
            </a>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
