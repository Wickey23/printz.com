import type { Metadata } from "next";
import { ArrowUpRight, Camera, Mail } from "lucide-react";
import { ContactForm } from "@/components/contact-form";
import { siteConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact PRINTZ Team Official for custom product questions and Etsy listing support.",
};

export default function ContactPage() {
  return (
    <section className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-200">Contact</p>
        <h1 className="mt-3 text-4xl font-black text-zinc-50 sm:text-5xl">Ask about a piece</h1>
        <p className="mt-5 leading-8 text-zinc-400">
          Send questions about listings, custom requests, materials, timelines, or product ideas.
        </p>
        <div className="mt-8 grid gap-3 text-sm font-semibold">
          <a className="inline-flex items-center gap-2 text-amber-200" href={`mailto:${siteConfig.social.email}`}>
            <Mail size={17} /> {siteConfig.social.email}
          </a>
          <a className="inline-flex items-center gap-2 text-amber-200" href={siteConfig.etsyUrl} rel="noreferrer" target="_blank">
            <ArrowUpRight size={17} /> Etsy shop
          </a>
          {siteConfig.social.instagram ? (
            <a className="inline-flex items-center gap-2 text-amber-200" href={siteConfig.social.instagram} rel="noreferrer" target="_blank">
              <Camera size={17} /> Instagram
            </a>
          ) : null}
        </div>
      </div>
      <ContactForm />
    </section>
  );
}
