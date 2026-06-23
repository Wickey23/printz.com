import { cn } from "@/lib/utils";

type FieldProps = {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | number | null;
  placeholder?: string;
  required?: boolean;
  error?: string[];
};

export function Field({
  label,
  name,
  type = "text",
  defaultValue,
  placeholder,
  required,
  error,
}: FieldProps) {
  return (
    <label className="grid gap-2 text-sm font-medium text-zinc-200">
      {label}
      <input
        className={cn(
          "h-12 rounded-md border border-white/10 bg-zinc-950 px-4 text-zinc-50 outline-none transition focus:border-amber-300",
          error?.length && "border-red-400",
        )}
        defaultValue={defaultValue ?? ""}
        id={name}
        name={name}
        placeholder={placeholder}
        required={required}
        type={type}
      />
      {error?.[0] ? <span className="text-xs text-red-300">{error[0]}</span> : null}
    </label>
  );
}

type TextAreaProps = Omit<FieldProps, "type"> & { rows?: number };

export function TextArea({
  label,
  name,
  defaultValue,
  placeholder,
  required,
  error,
  rows = 5,
}: TextAreaProps) {
  return (
    <label className="grid gap-2 text-sm font-medium text-zinc-200">
      {label}
      <textarea
        className={cn(
          "rounded-md border border-white/10 bg-zinc-950 px-4 py-3 text-zinc-50 outline-none transition focus:border-amber-300",
          error?.length && "border-red-400",
        )}
        defaultValue={defaultValue ?? ""}
        id={name}
        name={name}
        placeholder={placeholder}
        required={required}
        rows={rows}
      />
      {error?.[0] ? <span className="text-xs text-red-300">{error[0]}</span> : null}
    </label>
  );
}

export function SelectField({
  label,
  name,
  options,
  defaultValue,
  error,
}: {
  label: string;
  name: string;
  options: string[];
  defaultValue?: string | null;
  error?: string[];
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-zinc-200">
      {label}
      <select
        className={cn(
          "h-12 rounded-md border border-white/10 bg-zinc-950 px-4 text-zinc-50 outline-none transition focus:border-amber-300",
          error?.length && "border-red-400",
        )}
        defaultValue={defaultValue ?? options[0]}
        name={name}
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
      {error?.[0] ? <span className="text-xs text-red-300">{error[0]}</span> : null}
    </label>
  );
}

export function SubmitButton({ children, pending }: { children: string; pending: boolean }) {
  return (
    <button
      className="inline-flex h-12 items-center justify-center rounded-md bg-amber-300 px-5 text-sm font-bold text-zinc-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      {pending ? "Saving..." : children}
    </button>
  );
}
