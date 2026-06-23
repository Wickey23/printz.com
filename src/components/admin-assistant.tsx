"use client";

import { useRef, useState } from "react";
import { Bot, ExternalLink, ImagePlus, Loader2, Send, Sparkles, X } from "lucide-react";
import { usePathname } from "next/navigation";

type ChatMessage = {
  role: "admin" | "assistant";
  text: string;
  listingDrafts?: ListingDraft[];
  actions?: AdminAction[];
};

type ListingDraft = {
  name: string;
  short_description: string;
  full_description?: string;
  category?: string;
  price?: string | number;
  main_image_url?: string;
  gallery_media_urls?: string[] | string;
  source_url?: string;
  license_notes?: string;
  rights_status?: string;
  tags?: string[] | string;
  materials?: string;
  dimensions?: string;
  customization_notes?: string;
  color_options?: string[] | string;
  size_options?: string[] | string;
  finish_options?: string[] | string;
  processing_time?: string;
  care_instructions?: string;
  preview_images?: Array<{ url: string; source_url?: string; label?: string }>;
  active?: boolean;
  featured?: boolean;
  etsy_url?: string;
  video_url?: string;
};

type AdminAction = {
  type: "update_product" | "create_etsy_draft";
  label: string;
  summary: string;
  product_id: string;
  patch?: Partial<ListingDraft>;
};

export function AdminAssistant() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "Ask me to improve listings, audit selling rights, analyze product photos, price prints, or create product drafts. When I can act in the app, I will show an Apply edit or Create listing button for approval.",
    },
  ]);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [pending, setPending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const quickPrompts = [
    "Find 5 sellable Etsy product ideas for PRINTZ this week. Focus on 3D prints and digital products. Include preview images, source links, rights status, and listing drafts I can create.",
    "Research a profitable teacher/classroom niche and give me one listing to make today with preview images, SEO tags, price, and license/remake guidance.",
    "Check this product/source for selling-rights risk and, if viable, make a website listing draft with preview images.",
    "If I am on a product edit page, improve this listing like an employee. Give me an applyable edit for SEO, title, description, tags, price, and buyer clarity.",
    "Audit all current listings for selling rights. Flag risky listings and give me applyable edits to mark unsafe ones inactive with license notes.",
  ];

  if (!pathname.startsWith("/admin") || pathname === "/admin/login") return null;

  async function sendMessage() {
    const trimmed = text.trim();
    if ((!trimmed && !files.length) || pending) return;

    const lastActions = [...messages].reverse().find((message) => message.actions?.length)?.actions || [];
    setPending(true);
    setText("");
    setMessages((current) => [
      ...current,
      { role: "admin", text: trimmed || `Analyze ${files.length} uploaded image${files.length === 1 ? "" : "s"}.` },
    ]);

    if (isApplyCommand(trimmed) && lastActions.length) {
      const resultText = await applyActionBatch(lastActions);
      setMessages((current) => [...current, { role: "assistant", text: resultText }]);
      setPending(false);
      return;
    }

    const formData = new FormData();
    formData.set("message", trimmed);
    formData.set("page", pathname);
    formData.set("history", serializeHistory(messages));
    files.forEach((file) => formData.append("files", file));

    try {
      const response = await fetch("/api/admin-chat", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as {
        ok?: boolean;
        answer?: string;
        message?: string;
        listingDrafts?: ListingDraft[];
        actions?: AdminAction[];
      };
      if (!response.ok || !result.ok) throw new Error(result.message || "Assistant failed.");
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: result.answer || "No response.",
          listingDrafts: result.listingDrafts || [],
          actions: result.actions || [],
        },
      ]);
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      setMessages((current) => [
        ...current,
        { role: "assistant", text: error instanceof Error ? error.message : "Assistant failed. Try again." },
      ]);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open ? (
        <section className="flex h-[min(680px,calc(100vh-40px))] w-[min(420px,calc(100vw-40px))] flex-col overflow-hidden rounded-lg border border-white/10 bg-zinc-950 shadow-2xl shadow-black/50">
          <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
            <div className="flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-md bg-amber-300 text-zinc-950">
                <Bot size={18} />
              </span>
              <div>
                <p className="text-sm font-black text-zinc-50">PRINTZ admin agent</p>
                <p className="text-xs text-zinc-500">Listings, research, images, pricing</p>
              </div>
            </div>
            <button
              aria-label="Close admin assistant"
              className="grid size-9 place-items-center rounded-md text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
              onClick={() => setOpen(false)}
              type="button"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((message, index) => (
              <div
                className={
                  message.role === "admin"
                    ? "ml-auto max-w-[86%] rounded-lg bg-amber-300 px-3 py-2 text-sm font-semibold leading-6 text-zinc-950"
                    : "max-w-[92%] whitespace-pre-wrap rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm leading-6 text-zinc-200"
                }
                key={`${message.role}-${index}`}
              >
                {message.text}
                {message.listingDrafts?.length ? <ListingDraftCards drafts={message.listingDrafts} /> : null}
                {message.actions?.length ? <AdminActionCards actions={message.actions} /> : null}
              </div>
            ))}
            {pending ? (
              <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-300">
                <Loader2 className="animate-spin" size={15} />
                Working...
              </div>
            ) : null}
            {messages.length === 1 ? (
              <div className="grid gap-2">
                {quickPrompts.map((prompt) => (
                  <button
                className="rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-left text-xs font-semibold leading-5 text-zinc-300 transition hover:border-amber-300/40 hover:text-zinc-100"
                    key={prompt}
                    onClick={() => setText(prompt)}
                    type="button"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {files.length ? (
            <div className="border-t border-white/10 px-4 py-2">
              <div className="flex flex-wrap gap-2">
                {files.map((file) => (
                  <span className="rounded-md bg-white/10 px-2 py-1 text-xs font-semibold text-zinc-300" key={`${file.name}-${file.size}`}>
                    {file.name}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="border-t border-white/10 p-3">
            <textarea
              className="min-h-20 w-full resize-none rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-amber-300/60"
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void sendMessage();
              }}
            placeholder="Ask for listing copy, image analysis, rights checks, or market research..."
              value={text}
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <button
                className="inline-flex h-10 items-center gap-2 rounded-md border border-white/10 px-3 text-xs font-bold text-zinc-200 hover:border-amber-300/40"
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                <ImagePlus size={16} />
                Images
              </button>
              <input
                accept="image/*"
                className="sr-only"
                multiple
                onChange={(event) => setFiles(Array.from(event.target.files || []).slice(0, 4))}
                ref={fileInputRef}
                type="file"
              />
              <button
                className="inline-flex h-10 items-center gap-2 rounded-md bg-amber-300 px-4 text-xs font-black text-zinc-950 disabled:opacity-60"
                disabled={pending || (!text.trim() && !files.length)}
                onClick={() => void sendMessage()}
                type="button"
              >
                {pending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                Send
              </button>
            </div>
          </div>
        </section>
      ) : (
        <button
          aria-label="Open admin assistant"
          className="grid size-14 place-items-center rounded-full bg-amber-300 text-zinc-950 shadow-2xl shadow-black/50 transition hover:scale-105"
          onClick={() => setOpen(true)}
          type="button"
        >
          <Bot size={24} />
        </button>
      )}
    </div>
  );
}

function isApplyCommand(message: string) {
  return /^(ok\s*)?(do it|do this|apply it|apply that|apply them|make those changes|yes do it|go ahead|proceed)\.?$/i.test(message.trim());
}

function serializeHistory(messages: ChatMessage[]) {
  return messages
    .slice(-8)
    .map((message) => `${message.role}: ${message.text}`)
    .join("\n\n");
}

async function applyActionBatch(actions: AdminAction[]) {
  let applied = 0;
  const failures: string[] = [];

  for (const action of actions) {
    try {
      const response = await fetch("/api/admin-chat", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const result = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || !result.ok) throw new Error(result.message || "Could not apply edit.");
      applied += 1;
    } catch (error) {
      failures.push(`${action.label}: ${error instanceof Error ? error.message : "failed"}`);
    }
  }

  const summary = `Applied ${applied} of ${actions.length} queued admin edit${actions.length === 1 ? "" : "s"}.`;
  return failures.length ? `${summary}\n\nFailed:\n${failures.slice(0, 5).join("\n")}` : summary;
}

function ListingDraftCards({ drafts }: { drafts: ListingDraft[] }) {
  const [creating, setCreating] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});

  async function createDraft(draft: ListingDraft) {
    setCreating(draft.name);
    try {
      const response = await fetch("/api/admin-chat", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft }),
      });
      const result = (await response.json()) as { ok?: boolean; message?: string; editUrl?: string; publicUrl?: string };
      if (!response.ok || !result.ok) throw new Error(result.message || "Could not create listing.");
      setResults((current) => ({
        ...current,
        [draft.name]: `${result.message || "Created."} ${result.editUrl ? `Edit: ${result.editUrl}` : ""}`,
      }));
    } catch (error) {
      setResults((current) => ({
        ...current,
        [draft.name]: error instanceof Error ? error.message : "Could not create listing.",
      }));
    } finally {
      setCreating(null);
    }
  }

  return (
    <div className="mt-3 grid gap-3">
      {drafts.map((draft) => {
        const images = previewImagesForDraft(draft);
        const rights = draft.rights_status || "Needs review";
        const safe = rights === "Safe to create ourselves";

        return (
          <article className="overflow-hidden rounded-md border border-white/10 bg-zinc-950" key={draft.name}>
            {images.length ? (
              <div className="grid grid-cols-3 gap-1 bg-zinc-900 p-1">
                {images.slice(0, 3).map((image) => (
                  <a href={image.source_url || image.url} key={image.url} rel="noreferrer" target="_blank">
                    <img alt={image.label || draft.name} className="aspect-square w-full rounded object-cover" src={image.url} />
                  </a>
                ))}
              </div>
            ) : null}
            <div className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-black text-zinc-50">{draft.name}</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-400">{draft.short_description}</p>
                </div>
                <span className={safe ? "rounded bg-emerald-400/15 px-2 py-1 text-[10px] font-black text-emerald-200" : "rounded bg-amber-300/15 px-2 py-1 text-[10px] font-black text-amber-100"}>
                  {rights}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {draft.source_url ? (
                  <a className="inline-flex h-8 items-center gap-1 rounded-md border border-white/10 px-2 text-xs font-bold text-zinc-300" href={draft.source_url} rel="noreferrer" target="_blank">
                    Source <ExternalLink size={12} />
                  </a>
                ) : null}
                <button
                  className="inline-flex h-8 items-center gap-1 rounded-md bg-amber-300 px-2 text-xs font-black text-zinc-950 disabled:opacity-60"
                  disabled={creating === draft.name}
                  onClick={() => void createDraft(draft)}
                  type="button"
                >
                  {creating === draft.name ? <Loader2 className="animate-spin" size={13} /> : <Sparkles size={13} />}
                  {safe ? "Create listing" : "Create inactive draft"}
                </button>
              </div>
              {draft.license_notes ? <p className="mt-2 text-xs leading-5 text-zinc-500">{draft.license_notes}</p> : null}
              {results[draft.name] ? <p className="mt-2 text-xs font-semibold text-amber-200">{results[draft.name]}</p> : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function AdminActionCards({ actions }: { actions: AdminAction[] }) {
  const [applying, setApplying] = useState<string | null>(null);
  const [applyingAll, setApplyingAll] = useState(false);
  const [results, setResults] = useState<Record<string, string>>({});

  async function applyAction(action: AdminAction) {
    setApplying(action.label);
    try {
      const response = await fetch("/api/admin-chat", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const result = (await response.json()) as { ok?: boolean; message?: string; editUrl?: string; publicUrl?: string };
      if (!response.ok || !result.ok) throw new Error(result.message || "Could not apply edit.");
      setResults((current) => ({
        ...current,
        [action.label]: `${result.message || "Applied."} ${result.editUrl ? `Edit: ${result.editUrl}` : ""}`,
      }));
    } catch (error) {
      setResults((current) => ({
        ...current,
        [action.label]: error instanceof Error ? error.message : "Could not apply edit.",
      }));
    } finally {
      setApplying(null);
    }
  }

  return (
    <div className="mt-3 grid gap-3">
      {actions.length > 1 ? (
        <button
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-amber-300 px-3 text-xs font-black text-zinc-950 disabled:opacity-60"
          disabled={applyingAll}
          onClick={async () => {
            setApplyingAll(true);
            const result = await applyActionBatch(actions);
            setResults((current) => ({ ...current, "__all__": result }));
            setApplyingAll(false);
          }}
          type="button"
        >
          {applyingAll ? <Loader2 className="animate-spin" size={13} /> : <Sparkles size={13} />}
          Apply all {actions.length} edits
        </button>
      ) : null}
      {results.__all__ ? <p className="whitespace-pre-wrap text-xs font-semibold text-amber-200">{results.__all__}</p> : null}
      {actions.map((action) => (
        <article className="rounded-md border border-amber-300/20 bg-amber-300/10 p-3" key={`${action.type}-${action.label}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black text-amber-100">{action.label}</p>
              <p className="mt-1 text-xs leading-5 text-zinc-300">{action.summary}</p>
            </div>
            <button
              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md bg-amber-300 px-2 text-xs font-black text-zinc-950 disabled:opacity-60"
              disabled={applying === action.label}
              onClick={() => void applyAction(action)}
              type="button"
            >
              {applying === action.label ? <Loader2 className="animate-spin" size={13} /> : <Sparkles size={13} />}
              Apply edit
            </button>
          </div>
          {action.patch ? <ChangedFields patch={action.patch} /> : null}
          {results[action.label] ? <p className="mt-2 text-xs font-semibold text-amber-200">{results[action.label]}</p> : null}
        </article>
      ))}
    </div>
  );
}

function ChangedFields({ patch }: { patch: Partial<ListingDraft> }) {
  const entries = Object.entries(patch).filter(([, value]) => value !== undefined && value !== null && value !== "");
  if (!entries.length) return null;

  return (
    <div className="mt-3 grid gap-1">
      {entries.slice(0, 6).map(([key, value]) => (
        <p className="truncate text-xs text-zinc-400" key={key}>
          <span className="font-bold text-zinc-300">{key.replaceAll("_", " ")}:</span>{" "}
          {Array.isArray(value) ? value.join(", ") : String(value)}
        </p>
      ))}
      {entries.length > 6 ? <p className="text-xs text-zinc-500">+ {entries.length - 6} more fields</p> : null}
    </div>
  );
}

function previewImagesForDraft(draft: ListingDraft) {
  const fromPreview = draft.preview_images || [];
  const gallery = Array.isArray(draft.gallery_media_urls)
    ? draft.gallery_media_urls
    : typeof draft.gallery_media_urls === "string"
      ? draft.gallery_media_urls.split(/\n|,/)
      : [];
  const urls = [draft.main_image_url || "", ...gallery].map((url) => url.trim()).filter(Boolean);

  return [
    ...fromPreview,
    ...urls.map((url) => ({ url, source_url: draft.source_url, label: draft.name })),
  ].filter((image, index, all) => image.url && all.findIndex((item) => item.url === image.url) === index);
}
