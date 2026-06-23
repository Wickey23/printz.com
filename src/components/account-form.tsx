"use client";

import { useState } from "react";
import { Eye, EyeOff, UserRound } from "lucide-react";
import { updateCustomerAccount } from "@/app/actions";
import { ActionForm } from "@/components/action-form";

type Props = {
  avatarUrl?: string | null;
  defaultShippingAddress?: string | null;
  displayName?: string | null;
  email: string;
  emailNotifications?: boolean;
  phone?: string | null;
};

export function AccountForm({ avatarUrl, defaultShippingAddress, displayName, email, emailNotifications, phone }: Props) {
  return (
    <ActionForm action={updateCustomerAccount} className="rounded-lg border border-white/10 bg-zinc-900/70 p-5">
      {(state, pending) => (
        <div className="grid gap-5">
          <div className="flex items-center gap-4">
            <div className="grid size-16 place-items-center overflow-hidden rounded-full border border-amber-300/40 bg-zinc-950 text-xl font-black text-amber-100">
              {avatarUrl ? <img alt="" className="h-full w-full object-cover" src={avatarUrl} /> : <UserRound size={26} />}
            </div>
            <div>
              <h2 className="text-2xl font-black text-zinc-50">Account</h2>
              <p className="text-sm text-zinc-400">{email}</p>
            </div>
          </div>

          <Field defaultValue={displayName || ""} label="Display name" name="display_name" placeholder="Sameer Khan" />
          <Field defaultValue={avatarUrl || ""} label="Account image URL" name="avatar_url" placeholder="https://..." />
          <Field defaultValue={phone || ""} label="Phone" name="phone" placeholder="Optional" />
          <Textarea defaultValue={defaultShippingAddress || ""} label="Default shipping address" name="default_shipping_address" placeholder="Street, city, state, ZIP" />
          <label className="flex items-center gap-2 text-sm font-bold text-zinc-200">
            <input className="size-4 accent-amber-300" defaultChecked={emailNotifications ?? true} name="email_notifications" type="checkbox" />
            Email me about quotes and request updates
          </label>
          <PasswordField label="New password" name="new_password" placeholder="Leave blank to keep current password" />

          <button className="inline-flex h-11 items-center justify-center rounded-md bg-amber-300 px-4 text-sm font-black text-zinc-950 disabled:opacity-60" disabled={pending} type="submit">
            {pending ? "Saving..." : "Save account"}
          </button>
          {state.message ? <p className={state.ok ? "text-sm font-semibold text-emerald-300" : "text-sm font-semibold text-amber-200"}>{state.message}</p> : null}
        </div>
      )}
    </ActionForm>
  );
}

function PasswordField({ label, name, placeholder }: { label: string; name: string; placeholder?: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="grid gap-2 text-sm font-bold text-zinc-200">
      {label}
      <span className="relative">
        <input
          className="h-11 w-full rounded-md border border-white/10 bg-zinc-950 px-3 pr-11 text-sm text-zinc-100 outline-none transition focus:border-amber-300/60"
          name={name}
          placeholder={placeholder}
          type={visible ? "text" : "password"}
        />
        <button
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
          onClick={() => setVisible((value) => !value)}
          type="button"
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </span>
    </label>
  );
}

function Field({
  defaultValue,
  label,
  name,
  placeholder,
  type = "text",
}: {
  defaultValue?: string;
  label: string;
  name: string;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-zinc-200">
      {label}
      <input
        className="h-11 rounded-md border border-white/10 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none transition focus:border-amber-300/60"
        defaultValue={defaultValue}
        name={name}
        placeholder={placeholder}
        type={type}
      />
    </label>
  );
}

function Textarea({ defaultValue, label, name, placeholder }: { defaultValue?: string; label: string; name: string; placeholder?: string }) {
  return (
    <label className="grid gap-2 text-sm font-bold text-zinc-200">
      {label}
      <textarea
        className="min-h-24 rounded-md border border-white/10 bg-zinc-950 px-3 py-3 text-sm text-zinc-100 outline-none transition focus:border-amber-300/60"
        defaultValue={defaultValue}
        name={name}
        placeholder={placeholder}
      />
    </label>
  );
}
