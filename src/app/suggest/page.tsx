import type { Metadata } from "next";
import { SuggestionForm } from "@/components/suggestion-form";

export const metadata: Metadata = {
  title: "Suggest an Item",
  description: "Send a custom 3D print or handmade product idea.",
};

export default function SuggestPage() {
  return (
    <section className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-200">Custom Ideas</p>
        <h1 className="mt-3 text-4xl font-black text-zinc-50 sm:text-5xl">Suggest an item</h1>
        <p className="mt-5 leading-8 text-zinc-400">
          Share a product idea, reference, budget range, or customization request. No account required.
        </p>
      </div>
      <SuggestionForm />
    </section>
  );
}
