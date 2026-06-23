"use client";

import { useRef, useState } from "react";
import type { ClipboardEvent } from "react";
import { ImagePlus, Upload } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function PasteImageUpload({ targetInputId }: { targetInputId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState("");
  const [message, setMessage] = useState("Paste, drop, or upload the MakerWorld image.");
  const [pending, setPending] = useState(false);

  async function upload(file: File) {
    if (!file.type.startsWith("image/")) {
      setMessage("Use an image file.");
      return;
    }

    setPending(true);
    setMessage("Uploading image...");

    try {
      const supabase = createSupabaseBrowserClient();
      const extension = file.name.split(".").pop() || file.type.split("/")[1] || "png";
      const path = `products/ai-source-${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage.from("product-media").upload(path, file, {
        upsert: false,
        contentType: file.type,
      });

      if (error) throw error;

      const { data } = supabase.storage.from("product-media").getPublicUrl(path);
      const target = document.getElementById(targetInputId) as HTMLInputElement | null;
      if (target) {
        target.value = data.publicUrl;
        target.dispatchEvent(new Event("input", { bubbles: true }));
      }
      setPreview(data.publicUrl);
      setMessage("Image uploaded and attached to the AI draft.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Image upload failed.");
    } finally {
      setPending(false);
    }
  }

  function fileFromPaste(event: ClipboardEvent<HTMLDivElement>) {
    const file = Array.from(event.clipboardData.items)
      .find((item) => item.kind === "file" && item.type.startsWith("image/"))
      ?.getAsFile();

    if (file) {
      event.preventDefault();
      void upload(file);
    }
  }

  return (
    <div
      className="grid min-h-44 place-items-center rounded-lg border border-dashed border-white/15 bg-zinc-950 p-4 text-center outline-none transition focus:border-amber-300"
      onClick={() => inputRef.current?.click()}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const file = event.dataTransfer.files?.[0];
        if (file) void upload(file);
      }}
      onPaste={fileFromPaste}
      role="button"
      tabIndex={0}
    >
      {preview ? (
        <img alt="Uploaded source preview" className="max-h-44 rounded-md object-contain" src={preview} />
      ) : (
        <div>
          <ImagePlus className="mx-auto text-amber-200" size={30} />
          <p className="mt-3 text-sm font-bold text-zinc-100">{pending ? "Uploading..." : "Attach source image"}</p>
          <p className="mt-1 max-w-sm text-sm leading-6 text-zinc-400">{message}</p>
          <p className="mt-2 inline-flex items-center justify-center gap-2 text-xs font-bold text-amber-200">
            <Upload size={14} /> Click to choose file
          </p>
        </div>
      )}
      <input
        accept="image/*"
        className="sr-only"
        disabled={pending}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
        ref={inputRef}
        type="file"
      />
      {preview ? <p className="mt-3 text-xs font-semibold text-emerald-300">{message}</p> : null}
    </div>
  );
}
