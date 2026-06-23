"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type EtsySettings = {
  shopId: string;
  taxonomyId: string;
  shippingProfileId: string;
  readinessStateId: string;
};

type SettingsPayload = {
  ok?: boolean;
  message?: string;
  settings?: Partial<EtsySettings>;
};

export function EtsySettingsPanel({ settings }: { settings: EtsySettings }) {
  const router = useRouter();
  const [form, setForm] = useState(settings);
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);
  const [pending, setPending] = useState(false);
  const [detecting, setDetecting] = useState(false);

  async function save() {
    setPending(true);
    setMessage("");
    setOk(false);
    try {
      const response = await fetch("/api/etsy/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json() as SettingsPayload;
      handlePayload(response, payload);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save settings.");
    } finally {
      setPending(false);
    }
  }

  async function autoDetect() {
    setDetecting(true);
    setMessage("");
    setOk(false);
    try {
      const response = await fetch("/api/etsy/settings", { method: "PUT" });
      const payload = await response.json() as SettingsPayload;
      handlePayload(response, payload);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not auto-detect Etsy IDs.");
    } finally {
      setDetecting(false);
    }
  }

  function handlePayload(response: Response, payload: SettingsPayload) {
    if (payload.settings) {
      setForm((current) => ({
        shopId: payload.settings?.shopId || current.shopId,
        taxonomyId: payload.settings?.taxonomyId || current.taxonomyId,
        shippingProfileId: payload.settings?.shippingProfileId || current.shippingProfileId,
        readinessStateId: payload.settings?.readinessStateId || current.readinessStateId,
      }));
    }
    setOk(Boolean(payload.ok));
    setMessage(payload.message || (response.ok ? "Saved." : "Could not save settings."));
    if (response.ok && payload.ok) router.refresh();
  }

  return (
    <div className="mt-5 rounded-md border border-white/10 bg-zinc-950 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-zinc-100">Etsy IDs</p>
          <p className="mt-2 text-xs leading-5 text-zinc-500">
            Auto-detect uses your connected Etsy account. If Etsy does not expose shipping or readiness values here, keep the manually entered ones. Shipping/readiness are required for physical 3D printed drafts.
          </p>
        </div>
        <button
          className="inline-flex h-10 items-center rounded-md border border-amber-300/30 px-4 text-sm font-black text-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={pending || detecting}
          onClick={() => void autoDetect()}
          type="button"
        >
          {detecting ? "Detecting..." : "Auto-detect IDs"}
        </button>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <IdField label="Shop ID" value={form.shopId} onChange={(value) => setForm((current) => ({ ...current, shopId: value }))} />
        <IdField label="Default taxonomy ID" value={form.taxonomyId} onChange={(value) => setForm((current) => ({ ...current, taxonomyId: value }))} />
        <IdField label="Shipping profile ID" value={form.shippingProfileId} onChange={(value) => setForm((current) => ({ ...current, shippingProfileId: value }))} />
        <IdField label="Readiness state ID" value={form.readinessStateId} onChange={(value) => setForm((current) => ({ ...current, readinessStateId: value }))} />
      </div>
      <button
        className="mt-4 inline-flex h-10 items-center rounded-md bg-amber-300 px-4 text-sm font-black text-zinc-950 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending || detecting}
        onClick={() => void save()}
        type="button"
      >
        {pending ? "Saving..." : "Save Etsy IDs"}
      </button>
      {message ? <p className={ok ? "mt-3 text-sm font-semibold text-emerald-300" : "mt-3 text-sm font-semibold text-amber-200"}>{message}</p> : null}
    </div>
  );
}

function IdField({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="grid gap-1 text-sm font-bold text-zinc-200">
      {label}
      <input
        className="h-10 w-full rounded-md border border-white/10 bg-black px-3 text-sm text-zinc-100 outline-none focus:border-amber-200"
        inputMode="numeric"
        onChange={(event) => onChange(event.target.value)}
        placeholder="Paste ID"
        value={value}
      />
    </label>
  );
}
