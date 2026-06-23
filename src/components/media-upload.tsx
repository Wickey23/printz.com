"use client";

import { useState } from "react";
import { Upload } from "lucide-react";

export function MediaUpload({ append = false, targetInputId }: { append?: boolean; targetInputId: string }) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function upload(file: File) {
    setPending(true);
    setMessage("");

    try {
      const formData = new FormData();
      formData.set("file", file);
      const response = await fetch("/api/media-upload", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as { ok?: boolean; message?: string; publicUrl?: string };
      if (!response.ok || !data.ok || !data.publicUrl) throw new Error(data.message || "Upload failed.");
      const input = document.getElementById(targetInputId) as HTMLInputElement | HTMLTextAreaElement | null;
      if (input) {
        input.value = append && input.value ? `${input.value}\n${data.publicUrl}` : data.publicUrl;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
      setMessage("Uploaded and copied into the URL field.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-white/10 px-3 text-xs font-bold text-zinc-200 transition hover:border-amber-300/40">
      <Upload size={15} />
      {pending ? "Uploading..." : "Upload"}
      <input
        accept="image/*,video/*"
        className="sr-only"
        disabled={pending}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
        type="file"
      />
      {message ? <span className="sr-only">{message}</span> : null}
    </label>
  );
}
