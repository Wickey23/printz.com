"use client";

import { useActionState, useMemo, useState } from "react";
import type React from "react";
import { Calculator, CheckCircle2, Copy, ExternalLink, Eye, EyeOff, FileArchive, ImageIcon, ImagePlus, Loader2, LogIn, Search, Upload, Video } from "lucide-react";
import {
  createCustomPrintRequest,
  signInCustomer,
  signUpCustomer,
  type ActionState,
  type CustomPrintRequestState,
} from "@/app/actions";
import { ModelPreview } from "@/components/model-preview";
import type { CustomPrintRequest, PrintableModel, PrintStockOption } from "@/lib/types";

const authState: ActionState = { ok: false, message: "" };
const requestState: CustomPrintRequestState = { ok: false, message: "" };

type UploadedFile = {
  path: string;
  name: string;
  kind: "model" | "reference";
  size: number;
  type: string;
  previewUrl?: string;
};

const modelAccept =
  ".stl,.3mf,.obj,.step,.stp,.ply,.amf,.gcode,.scad,.blend,.fbx,.dae,.wrl,.x3d,.glb,.gltf,.iges,.igs,.zip,.rar,.7z,model/*,application/zip,application/x-zip-compressed";

export function CustomPrintPortal({
  defaultShippingAddress,
  defaultShippingName,
  initialModelSourcePlatform = "",
  initialModelSourceUrl = "",
  initialNotes = "",
  initialTitle = "",
  printableModels,
  signedIn,
  requests,
  stockOptions,
}: {
  defaultShippingAddress?: string;
  defaultShippingName?: string;
  initialModelSourcePlatform?: string;
  initialModelSourceUrl?: string;
  initialNotes?: string;
  initialTitle?: string;
  printableModels: PrintableModel[];
  signedIn: boolean;
  requests: CustomPrintRequest[];
  stockOptions: PrintStockOption[];
}) {
  const [selectedModel, setSelectedModel] = useState<PrintableModel | null>(null);

  if (!signedIn) {
    return (
      <div className="grid gap-8">
        <PublicPrintLookup models={printableModels} onSelect={setSelectedModel} selectedModel={selectedModel} />
        {initialTitle || initialModelSourceUrl ? (
          <div className="rounded-lg border border-amber-300/20 bg-amber-300/10 p-4">
            <p className="text-sm font-black text-amber-100">Selected product request</p>
            <p className="mt-2 text-sm leading-6 text-zinc-200">
              {initialTitle || "This product"} is ready to request. Sign in or create an account below, then the request form will open with the source model details filled in.
            </p>
          </div>
        ) : null}
        <CustomerAuthPanel />
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <CustomPrintRequestForm
        defaultShippingAddress={defaultShippingAddress}
        defaultShippingName={defaultShippingName}
        initialModelSourcePlatform={initialModelSourcePlatform}
        initialModelSourceUrl={initialModelSourceUrl}
        initialNotes={initialNotes}
        initialTitle={initialTitle}
        models={printableModels}
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
        stockOptions={stockOptions}
      />
      <PrintRequestHistory requests={requests} />
    </div>
  );
}

function PublicPrintLookup({
  models,
  onSelect,
  selectedModel,
}: {
  models: PrintableModel[];
  onSelect: (model: PrintableModel | null) => void;
  selectedModel: PrintableModel | null;
}) {
  const [modelSourceUrl, setModelSourceUrl] = useState("");
  const [modelSourcePlatform, setModelSourcePlatform] = useState("");

  return (
    <div className="rounded-lg border border-white/10 bg-zinc-900/70 p-5">
      <PrintLookup
        models={models}
        modelSourcePlatform={modelSourcePlatform}
        modelSourceUrl={modelSourceUrl}
        onModelSelect={onSelect}
        onSelect={(url, platform) => {
          setModelSourceUrl(url);
          setModelSourcePlatform(platform);
        }}
        selectedModel={selectedModel}
      />
      {selectedModel || modelSourceUrl ? (
        <p className="mt-3 text-sm font-semibold text-amber-100">
          Sign in or create an account below to request this {(selectedModel?.source_platform || modelSourcePlatform || "model")} print.
        </p>
      ) : null}
    </div>
  );
}

function CustomerAuthPanel() {
  const [signInState, signInAction, signInPending] = useActionState(signInCustomer, authState);
  const [signUpState, signUpAction, signUpPending] = useActionState(signUpCustomer, authState);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <form action={signInAction} className="rounded-lg border border-white/10 bg-zinc-900/70 p-5">
        <h2 className="text-2xl font-black text-zinc-50">Sign in</h2>
        <AuthFields pending={signInPending} submitLabel="Sign in" />
        {signInState.message ? <FormMessage state={signInState} /> : null}
      </form>
      <form action={signUpAction} className="rounded-lg border border-white/10 bg-zinc-900/70 p-5">
        <h2 className="text-2xl font-black text-zinc-50">Create account</h2>
        <AuthFields pending={signUpPending} submitLabel="Create account" />
        {signUpState.message ? <FormMessage state={signUpState} /> : null}
      </form>
    </div>
  );
}

function AuthFields({ pending, submitLabel }: { pending: boolean; submitLabel: string }) {
  return (
    <div className="mt-5 grid gap-4">
      <Field label="Email" name="email" type="email" />
      <PasswordField label="Password" name="password" />
      <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-amber-300 px-4 text-sm font-black text-zinc-950 disabled:opacity-60" disabled={pending}>
        <LogIn size={17} />
        {pending ? "Working..." : submitLabel}
      </button>
    </div>
  );
}

function PasswordField({ label, name, placeholder }: { label: string; name: string; placeholder?: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="grid min-w-0 gap-2 text-sm font-bold text-zinc-200">
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

function CustomPrintRequestForm({
  defaultShippingAddress,
  defaultShippingName,
  initialModelSourcePlatform,
  initialModelSourceUrl,
  initialNotes,
  initialTitle,
  models,
  selectedModel,
  setSelectedModel,
  stockOptions,
}: {
  defaultShippingAddress?: string;
  defaultShippingName?: string;
  initialModelSourcePlatform: string;
  initialModelSourceUrl: string;
  initialNotes: string;
  initialTitle: string;
  models: PrintableModel[];
  selectedModel: PrintableModel | null;
  setSelectedModel: (model: PrintableModel | null) => void;
  stockOptions: PrintStockOption[];
}) {
  const [state, action, pending] = useActionState(createCustomPrintRequest, requestState);
  const [uploads, setUploads] = useState<UploadedFile[]>([]);
  const [modelSourceUrl, setModelSourceUrl] = useState(initialModelSourceUrl);
  const [modelSourcePlatform, setModelSourcePlatform] = useState(initialModelSourcePlatform);
  const [projectTitle, setProjectTitle] = useState(initialTitle);
  const [printNotes, setPrintNotes] = useState(initialNotes);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [grams, setGrams] = useState("");
  const [hours, setHours] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [estimateNote, setEstimateNote] = useState("");
  const parsedDefaultAddress = useMemo(() => parseAddress(defaultShippingAddress || ""), [defaultShippingAddress]);
  const [shippingStreet, setShippingStreet] = useState(parsedDefaultAddress.street);
  const [shippingUnit, setShippingUnit] = useState(parsedDefaultAddress.unit);
  const [shippingCity, setShippingCity] = useState(parsedDefaultAddress.city);
  const [shippingState, setShippingState] = useState(parsedDefaultAddress.state);
  const [shippingZip, setShippingZip] = useState(parsedDefaultAddress.zip);
  const materialOptions = stockOptions.filter((option) => option.option_type === "material");
  const colorOptions = stockOptions.filter((option) => option.option_type === "color");
  const finishOptions = stockOptions.filter((option) => option.option_type === "finish");
  const [selectedMaterial, setSelectedMaterial] = useState(materialOptions[0]?.value || "PLA");
  const [selectedColor, setSelectedColor] = useState(colorOptions[0]?.value || "Black");
  const [selectedFinish, setSelectedFinish] = useState(finishOptions[0]?.value || "Standard");
  const selectedColorOption = colorOptions.find((option) => option.value === selectedColor || option.name === selectedColor);
  const selectedColorHex = selectedColorOption?.hex_color || colorToHex(selectedColor);

  function chooseCatalogModel(model: PrintableModel | null) {
    setSelectedModel(model);
    if (!model) return;
    setModelSourceUrl(model.source_url);
    setModelSourcePlatform(model.source_platform);
    setProjectTitle(model.title);
    setPrintNotes(
      [model.print_notes, model.license_summary ? `License note: ${model.license_summary}` : ""]
        .filter(Boolean)
        .join("\n\n"),
    );
  }

  const estimate = useMemo(() => {
    const gramValue = Number(grams);
    const hourValue = Number(hours);
    const quantityValue = Math.max(1, Number(quantity) || 1);
    if (!gramValue || !hourValue) return null;
    const cents = Math.max(999, (500 + Math.ceil(gramValue * 14) + Math.ceil(hourValue * 250)) * quantityValue + 599);
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
  }, [grams, hours, quantity]);

  async function uploadFiles(files: FileList | null, kind: UploadedFile["kind"]) {
    if (!files?.length) return;
    setUploading(true);
    setUploadMessage("");

    try {
      const uploaded: UploadedFile[] = [];
      for (const file of Array.from(files)) {
        const localPreviewUrl = URL.createObjectURL(file);
        if (kind === "model") {
          const stlEstimate = await estimateFromStl(file);
          if (stlEstimate) {
            setGrams(String(stlEstimate.grams));
            setHours(String(stlEstimate.hours));
            setEstimateNote(`Estimated from ${file.name}. Review before quoting.`);
          }
        }

        const uploadForm = new FormData();
        uploadForm.set("file", file);
        uploadForm.set("kind", kind);
        const response = await fetch("/api/print-upload", {
          method: "POST",
          body: uploadForm,
        });
        const result = (await response.json()) as {
          ok?: boolean;
          message?: string;
          path?: string;
          name?: string;
          size?: number;
          type?: string;
        };
        if (!response.ok || !result.ok || !result.path) throw new Error(result.message || "Upload failed.");
        uploaded.push({
          path: result.path,
          name: result.name || file.name,
          kind,
          size: result.size || file.size,
          type: result.type || file.type,
          previewUrl: localPreviewUrl,
        });
      }

      setUploads((current) => [...current, ...uploaded]);
      setUploadMessage(`Uploaded ${uploaded.length} file${uploaded.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  const modelUploads = uploads.filter((upload) => upload.kind === "model");
  const referenceUploads = uploads.filter((upload) => upload.kind === "reference");
  const shippingAddress = [shippingStreet, shippingUnit, `${shippingCity}, ${shippingState} ${shippingZip}`]
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    if (!modelUploads.length && !modelSourceUrl.trim()) {
      event.preventDefault();
      setUploadMessage("Upload a 3D model file or paste a model source link before submitting.");
      form.querySelector<HTMLElement>("[data-upload-section]")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    if (!form.checkValidity()) {
      event.preventDefault();
      const invalid = form.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(":invalid");
      invalid?.scrollIntoView({ behavior: "smooth", block: "center" });
      invalid?.focus({ preventScroll: true });
      form.reportValidity();
    }
  }

  return (
    <form action={action} className="rounded-lg border border-white/10 bg-zinc-900/70 p-5" onSubmit={handleSubmit}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-amber-200">Custom printing</p>
          <h2 className="mt-2 text-3xl font-black text-zinc-50">Upload files for us to print</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Upload STL, 3MF, OBJ, STEP, or ZIP files, or link a model you found online. We review the source, create a custom Etsy checkout listing, then send your Etsy payment link.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="grid gap-4">
          <Field label="Project title" name="title" onChange={setProjectTitle} placeholder="Desk name plate, replacement bracket, classroom organizer" required value={projectTitle} />
          <Textarea label="Print notes" name="notes" onChange={setPrintNotes} placeholder="Tell us what the part is for, strength needs, orientation concerns, scale, or deadlines." value={printNotes} />

          <PrintLookup
            models={models}
            modelSourcePlatform={modelSourcePlatform}
            modelSourceUrl={modelSourceUrl}
            onModelSelect={chooseCatalogModel}
            onSelect={(url, platform) => {
              setModelSourceUrl(url);
              setModelSourcePlatform(platform);
            }}
            selectedModel={selectedModel}
          />
          <input name="model_source_url" type="hidden" value={modelSourceUrl} />
          <input name="model_source_platform" type="hidden" value={modelSourcePlatform} />

          <div className="grid gap-3 rounded-lg border border-white/10 bg-zinc-950 p-4" data-upload-section>
            <div className="flex flex-wrap gap-3">
              <UploadButton
                accept={modelAccept}
                icon={<FileArchive size={16} />}
                label={uploading ? "Uploading..." : "Upload 3D files"}
                multiple
                onChange={(files) => void uploadFiles(files, "model")}
              />
              <UploadButton
                accept="image/*,video/*,.gif"
                icon={<ImagePlus size={16} />}
                label={uploading ? "Uploading..." : "Add images/video"}
                multiple
                onChange={(files) => void uploadFiles(files, "reference")}
              />
            </div>
            {!modelUploads.length && modelSourceUrl ? (
              <p className="text-sm font-semibold text-emerald-300">
                Source model selected. You can submit now, or upload downloaded files if you already have them.
              </p>
            ) : null}
            {uploadMessage ? <p className="text-sm font-semibold text-amber-200">{uploadMessage}</p> : null}
            <UploadList title="3D files" uploads={modelUploads} />
            <UploadList title="Reference media" uploads={referenceUploads} />
            {modelUploads.map((upload) => (
              <input key={upload.path} name="file_urls" type="hidden" value={upload.path} />
            ))}
            {modelUploads.map((upload) => (
              <input key={`${upload.path}-name`} name="file_names" type="hidden" value={upload.name} />
            ))}
            {referenceUploads.map((upload) => (
              <input key={upload.path} name="image_urls" type="hidden" value={upload.path} />
            ))}
          </div>

          <div className="grid gap-4">
            <input name="material" type="hidden" value={selectedMaterial} />
            <input name="color" type="hidden" value={selectedColor} />
            <input name="finish" type="hidden" value={selectedFinish} />
            <OptionButtons label="Material" options={materialOptions} selected={selectedMaterial} onSelect={setSelectedMaterial} />
            <ColorSwatches options={colorOptions} selected={selectedColor} onSelect={setSelectedColor} />
            <OptionButtons label="Finish" options={finishOptions} selected={selectedFinish} onSelect={setSelectedFinish} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Infill %" name="infill_percent" placeholder="15" type="number" />
            <Field label="Quantity" name="quantity" onChange={setQuantity} placeholder="1" type="number" value={quantity} />
            <Field label="Estimated grams" name="estimated_grams" onChange={setGrams} placeholder="Auto for STL or from slicer" type="number" value={grams} />
            <Field label="Estimated print hours" name="estimated_hours" onChange={setHours} placeholder="Auto for STL or from slicer" type="number" value={hours} />
          </div>

        <div className="rounded-lg border border-amber-300/20 bg-amber-300/10 p-4">
          <p className="inline-flex items-center gap-2 text-sm font-black text-amber-100">
            <Calculator size={16} />
            {estimate ? `Internal estimate: ${estimate}` : "Upload now, Etsy checkout after review"}
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-300">
            This estimate helps us quote faster. Final payment happens through a custom Etsy listing after we confirm the file can be printed.
          </p>
          {estimateNote ? <p className="mt-2 text-sm font-semibold text-amber-100">{estimateNote}</p> : null}
        </div>

          <div className="grid gap-4 rounded-lg border border-white/10 bg-zinc-950 p-4">
            <p className="text-sm font-black text-zinc-100">Shipping address</p>
            <Field defaultValue={defaultShippingName || ""} label="Full name" name="shipping_name" required />
            <input name="shipping_address" type="hidden" value={shippingAddress} />
            <Field label="Street address" name="shipping_street" onChange={setShippingStreet} placeholder="123 Main St" required value={shippingStreet} />
            <Field label="Apartment, suite, unit" name="shipping_unit" onChange={setShippingUnit} placeholder="Apt 4B" value={shippingUnit} />
            <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(80px,120px)_minmax(120px,160px)]">
              <Field label="City" name="shipping_city" onChange={setShippingCity} placeholder="City" required value={shippingCity} />
              <Field label="State" maxLength={2} name="shipping_state" onChange={(value) => setShippingState(value.toUpperCase())} placeholder="NY" required value={shippingState} />
              <Field label="ZIP" name="shipping_zip" onChange={setShippingZip} pattern="[0-9]{5}(-[0-9]{4})?" placeholder="10001" required value={shippingZip} />
            </div>
          </div>

          <button className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-amber-300 px-5 text-sm font-black text-zinc-950 disabled:opacity-60" disabled={pending || uploading}>
            {pending ? <Loader2 className="animate-spin" size={17} /> : <Upload size={17} />}
            {pending ? "Submitting..." : "Submit print request"}
          </button>
          {state.message ? <FormMessage state={state} /> : null}
        </div>

        <UploadPreview uploads={uploads} selectedColor={selectedColor} selectedColorHex={selectedColorHex} selectedFinish={selectedFinish} selectedMaterial={selectedMaterial} />
      </div>
    </form>
  );
}

function PrintRequestHistory({ requests }: { requests: CustomPrintRequest[] }) {
  return (
    <aside className="rounded-lg border border-white/10 bg-zinc-900/70 p-5">
      <h2 className="text-2xl font-black text-zinc-50">Your requests</h2>
      <div className="mt-5 grid gap-3">
        {requests.map((request) => (
          <article className="rounded-md border border-white/10 bg-zinc-950 p-4" key={request.id}>
            <p className="font-black text-zinc-50">{request.title}</p>
            <p className="mt-1 text-sm text-zinc-400">{request.file_names.length} file(s) uploaded</p>
            {request.model_source_url ? (
              <a className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-amber-200 underline" href={request.model_source_url} rel="noreferrer" target="_blank">
                {request.model_source_platform || "Model source"} <ExternalLink size={13} />
              </a>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-md bg-amber-300/15 px-2 py-1 text-amber-100">{request.payment_status.replaceAll("_", " ")}</span>
              <span className="rounded-md bg-white/10 px-2 py-1 text-zinc-200">{request.production_status.replaceAll("_", " ")}</span>
            </div>
            {request.quoted_cents ? (
              <p className="mt-3 text-sm font-bold text-zinc-100">Quote: ${(request.quoted_cents / 100).toFixed(2)}</p>
            ) : null}
            {request.etsy_checkout_url ? (
              <a
                className="mt-4 inline-flex h-10 items-center rounded-md bg-amber-300 px-4 text-sm font-black text-zinc-950"
                href={request.etsy_checkout_url}
                rel="noreferrer"
                target="_blank"
              >
                Pay on Etsy
              </a>
            ) : (
              <p className="mt-3 text-sm leading-6 text-zinc-400">We will add your Etsy payment link after reviewing the files.</p>
            )}
          </article>
        ))}
        {!requests.length ? <p className="text-sm leading-6 text-zinc-400">No custom print requests yet.</p> : null}
      </div>
    </aside>
  );
}

function OptionButtons({
  label,
  onSelect,
  options,
  selected,
}: {
  label: string;
  onSelect: (value: string) => void;
  options: PrintStockOption[];
  selected: string;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-bold text-zinc-200">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            className={
              selected === option.value
                ? "h-10 rounded-md bg-amber-300 px-4 text-sm font-black text-zinc-950"
                : "h-10 rounded-md border border-white/10 px-4 text-sm font-bold text-zinc-200 transition hover:border-amber-300/40"
            }
            key={option.id}
            onClick={() => onSelect(option.value)}
            type="button"
          >
            {option.name}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function ColorSwatches({
  onSelect,
  options,
  selected,
}: {
  onSelect: (value: string) => void;
  options: PrintStockOption[];
  selected: string;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-bold text-zinc-200">Color</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            aria-label={`Select ${option.name}`}
            className={
              selected === option.value
                ? "grid h-12 min-w-24 grid-cols-[28px_1fr] items-center gap-2 rounded-md bg-amber-300 px-2 text-left text-sm font-black text-zinc-950"
                : "grid h-12 min-w-24 grid-cols-[28px_1fr] items-center gap-2 rounded-md border border-white/10 px-2 text-left text-sm font-bold text-zinc-200 transition hover:border-amber-300/40"
            }
            key={option.id}
            onClick={() => onSelect(option.value)}
            type="button"
          >
            <span className="size-7 rounded border border-black/20" style={{ backgroundColor: option.hex_color || option.value }} />
            <span>{option.name}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function UploadPreview({
  selectedColor,
  selectedColorHex,
  selectedFinish,
  selectedMaterial,
  uploads,
}: {
  selectedColor: string;
  selectedColorHex: string;
  selectedFinish: string;
  selectedMaterial: string;
  uploads: UploadedFile[];
}) {
  return (
    <aside className="h-fit rounded-lg border border-white/10 bg-zinc-950 p-4 xl:sticky xl:top-24">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-200">Preview</p>
      <div className="mt-3 rounded-md border border-white/10 bg-zinc-900 p-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="size-8 shrink-0 rounded-md border border-white/15" style={{ backgroundColor: selectedColorHex }} />
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-zinc-50">{selectedMaterial}</p>
            <p className="mt-1 truncate text-sm text-zinc-400">{selectedColor} / {selectedFinish}</p>
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-3">
        {uploads.map((upload) => (
          <article className="overflow-hidden rounded-md border border-white/10 bg-zinc-900" key={upload.path}>
            {upload.previewUrl && upload.type.startsWith("image/") ? (
              <img alt={upload.name} className="aspect-video w-full object-cover" src={upload.previewUrl} />
            ) : upload.previewUrl && upload.type.startsWith("video/") ? (
              <video className="aspect-video w-full object-cover" controls src={upload.previewUrl} />
            ) : upload.kind === "model" && upload.previewUrl ? (
              <ModelPreview fileName={upload.name} materialColor={selectedColorHex} url={upload.previewUrl} />
            ) : (
              <div className="grid aspect-video place-items-center bg-zinc-950 text-zinc-400">
                {upload.kind === "reference" ? <ImageIcon size={28} /> : <FileArchive size={28} />}
              </div>
            )}
            <div className="p-3">
              <div className="flex items-start gap-2">
                {upload.type.startsWith("video/") ? <Video className="mt-0.5 shrink-0 text-amber-200" size={15} /> : <FileArchive className="mt-0.5 shrink-0 text-amber-200" size={15} />}
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-zinc-100">{upload.name}</p>
                  <p className="mt-1 text-xs text-zinc-500">{upload.kind === "model" ? fileExtension(upload.name).toUpperCase() : upload.type || "reference"} / {formatBytes(upload.size)}</p>
                </div>
              </div>
            </div>
          </article>
        ))}
        {!uploads.length ? <p className="rounded-md border border-dashed border-white/10 p-4 text-sm leading-6 text-zinc-500">Uploaded files will preview here before you submit the request.</p> : null}
      </div>
    </aside>
  );
}

const printLookupProviders = [
  {
    name: "MakerWorld",
    baseUrl: "https://makerworld.com/en/search/models",
    queryParam: "keyword",
    modelUrlPattern: /^https:\/\/(?:www\.)?makerworld\.com\/.+/i,
  },
  {
    name: "Printables",
    baseUrl: "https://www.printables.com/search/models",
    queryParam: "q",
    modelUrlPattern: /^https:\/\/(?:www\.)?printables\.com\/.+/i,
  },
  {
    name: "Thingiverse",
    baseUrl: "https://www.thingiverse.com/search",
    queryParam: "q",
    modelUrlPattern: /^https:\/\/(?:www\.)?thingiverse\.com\/.+/i,
  },
  {
    name: "Thangs",
    baseUrl: "https://thangs.com/search",
    queryParam: "q",
    modelUrlPattern: /^https:\/\/(?:www\.)?thangs\.com\/.+/i,
  },
  {
    name: "Cults",
    baseUrl: "https://cults3d.com/en/search",
    queryParam: "q",
    modelUrlPattern: /^https:\/\/(?:www\.)?cults3d\.com\/.+/i,
  },
] as const;

function PrintLookup({
  models,
  modelSourcePlatform,
  modelSourceUrl,
  onModelSelect,
  onSelect,
  selectedModel,
}: {
  models: PrintableModel[];
  modelSourcePlatform: string;
  modelSourceUrl: string;
  onModelSelect: (model: PrintableModel | null) => void;
  onSelect: (url: string, platform: string) => void;
  selectedModel: PrintableModel | null;
}) {
  const [query, setQuery] = useState("");
  const [sourceUrl, setSourceUrl] = useState(modelSourceUrl);
  const [copyMessage, setCopyMessage] = useState("");
  const guessedPlatform = guessProvider(sourceUrl);
  const visibleModels = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return models.slice(0, 8);
    return models
      .filter((model) => {
        const haystack = [
          model.title,
          model.source_platform,
          model.category || "",
          model.license_summary || "",
          model.print_notes || "",
          ...(model.tags || []),
        ].join(" ").toLowerCase();
        return cleanQuery.split(/\s+/).every((term) => haystack.includes(term));
      })
      .slice(0, 8);
  }, [models, query]);

  function saveSource() {
    const cleanUrl = sourceUrl.trim();
    if (!cleanUrl) {
      onSelect("", "");
      onModelSelect(null);
      return;
    }
    onModelSelect(null);
    onSelect(cleanUrl, guessedPlatform || "Model source");
  }

  function selectModel(model: PrintableModel) {
    onModelSelect(model);
    onSelect(model.source_url, model.source_platform);
    setSourceUrl(model.source_url);
  }

  return (
    <section className="grid gap-4 rounded-lg border border-white/10 bg-zinc-950 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 text-sm font-black text-zinc-100">
            <Search size={16} />
            Find a printable model
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Browse PRINTZ-curated model ideas first, or search outside libraries if you need something else. We review license, files, and printability before quoting.
          </p>
        </div>
        {selectedModel || modelSourceUrl ? (
          <span className="inline-flex h-8 items-center gap-1 rounded-md bg-emerald-300/15 px-2 text-xs font-black text-emerald-200">
            <CheckCircle2 size={14} />
            {selectedModel?.title || modelSourcePlatform || "Source selected"}
          </span>
        ) : null}
      </div>

      <label className="grid gap-2 text-sm font-bold text-zinc-200">
        Search PRINTZ model catalog
        <input
          className="h-11 w-full min-w-0 rounded-md border border-white/10 bg-black px-3 text-sm text-zinc-100 outline-none transition focus:border-amber-300/60"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="desk organizer, classroom hall pass, headphone hook"
          value={query}
        />
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        {visibleModels.map((model) => (
          <article
            className={
              selectedModel?.id === model.id
                ? "grid gap-3 rounded-md border border-amber-300/60 bg-amber-300/10 p-3"
                : "grid gap-3 rounded-md border border-white/10 bg-zinc-900 p-3"
            }
            key={model.id}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-black text-zinc-50">{model.title}</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-amber-200">{model.source_platform}</p>
              </div>
              <button
                className="shrink-0 rounded-md bg-amber-300 px-3 py-2 text-xs font-black text-zinc-950"
                onClick={() => selectModel(model)}
                type="button"
              >
                Request
              </button>
            </div>
            {model.category ? <p className="text-sm font-semibold text-zinc-300">{model.category}</p> : null}
            {model.print_notes ? <p className="text-sm leading-6 text-zinc-400">{model.print_notes}</p> : null}
            {model.license_summary ? <p className="text-xs leading-5 text-zinc-500">{model.license_summary}</p> : null}
            <div className="flex flex-wrap gap-2">
              {(model.tags || []).slice(0, 5).map((tag) => (
                <span className="rounded-md bg-white/5 px-2 py-1 text-xs font-bold text-zinc-300" key={tag}>{tag}</span>
              ))}
            </div>
            <a className="inline-flex items-center gap-1 text-sm font-bold text-amber-200 underline" href={model.source_url} rel="noreferrer" target="_blank">
              Source page <ExternalLink size={13} />
            </a>
          </article>
        ))}
        {!visibleModels.length ? <p className="rounded-md border border-dashed border-white/10 p-4 text-sm text-zinc-400">No saved PRINTZ models match that search. Try the outside library links below.</p> : null}
      </div>

      <div className="mt-2 border-t border-white/10 pt-4">
        <p className="text-sm font-black text-zinc-100">Search outside libraries</p>
        <p className="mt-1 text-sm leading-6 text-zinc-500">Use these when the PRINTZ catalog does not have what you need yet.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {printLookupProviders.map((provider) => (
          <ProviderSearchLink
            key={provider.name}
            label={provider.name}
            onCopied={() => setCopyMessage(`Copied ${provider.name} search link.`)}
            url={providerSearchUrl(provider, query)}
          />
        ))}
      </div>
      {copyMessage ? <p className="text-sm font-semibold text-emerald-300">{copyMessage}</p> : null}

      <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
        <label className="grid gap-2 text-sm font-bold text-zinc-200">
          Model page link
          <input
            className="h-11 w-full min-w-0 rounded-md border border-white/10 bg-black px-3 text-sm text-zinc-100 outline-none transition focus:border-amber-300/60"
            onBlur={saveSource}
            onChange={(event) => setSourceUrl(event.target.value)}
            placeholder="https://makerworld.com/en/models/..."
            type="url"
            value={sourceUrl}
          />
        </label>
        <button
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-amber-300 px-4 text-sm font-black text-zinc-950"
          onClick={saveSource}
          type="button"
        >
          Use model
        </button>
      </div>
      <p className="text-xs leading-5 text-zinc-500">
        We still verify license and printability before quoting. Upload files too if you already downloaded them.
      </p>
    </section>
  );
}

function ProviderSearchLink({
  label,
  onCopied,
  url,
}: {
  label: string;
  onCopied: () => void;
  url: string;
}) {
  async function copyUrl() {
    await navigator.clipboard.writeText(url);
    onCopied();
  }

  return (
    <div className="grid gap-2 rounded-md border border-white/10 p-2">
      <a
        className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-zinc-900 px-3 text-sm font-bold text-zinc-200 transition hover:text-amber-100"
        href={url}
        rel="noreferrer"
        target="_blank"
      >
        {label}
        <ExternalLink size={14} />
      </a>
      <button
        className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-white/10 px-3 text-xs font-bold text-zinc-300 transition hover:border-amber-300/40 hover:text-amber-100"
        onClick={() => void copyUrl()}
        type="button"
      >
        <Copy size={13} />
        Copy link
      </button>
    </div>
  );
}

function providerSearchUrl(provider: (typeof printLookupProviders)[number], query: string) {
  const url = new URL(provider.baseUrl);
  const cleanQuery = query.trim();
  if (cleanQuery) url.searchParams.set(provider.queryParam, cleanQuery);
  return url.toString();
}

function guessProvider(url: string) {
  const clean = url.trim();
  return printLookupProviders.find((provider) => provider.modelUrlPattern.test(clean))?.name || "";
}

function UploadButton({
  accept,
  icon,
  label,
  multiple,
  onChange,
}: {
  accept: string;
  icon: React.ReactNode;
  label: string;
  multiple?: boolean;
  onChange: (files: FileList | null) => void;
}) {
  return (
    <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-white/10 px-3 text-xs font-bold text-zinc-200 transition hover:border-amber-300/40">
      {icon}
      {label}
      <input
        accept={accept}
        className="sr-only"
        multiple={multiple}
        onChange={(event) => onChange(event.target.files)}
        type="file"
      />
    </label>
  );
}

function fileExtension(name: string) {
  return name.split(".").pop() || "file";
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function colorToHex(value: string) {
  const key = value.toLowerCase().trim();
  const colors: Record<string, string> = {
    black: "#050505",
    white: "#f8fafc",
    gray: "#71717a",
    grey: "#71717a",
    red: "#ef4444",
    blue: "#3b82f6",
    green: "#22c55e",
    yellow: "#facc15",
    gold: "#d4a017",
    silver: "#c0c0c0",
    orange: "#f97316",
    purple: "#a855f7",
    pink: "#ec4899",
  };
  return colors[key] || (value.startsWith("#") ? value : "#facc15");
}

async function estimateFromStl(file: File) {
  if (!file.name.toLowerCase().endsWith(".stl")) return null;

  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);
  if (buffer.byteLength < 84) return null;

  const triangleCount = view.getUint32(80, true);
  const expectedLength = 84 + triangleCount * 50;
  if (expectedLength !== buffer.byteLength || triangleCount <= 0 || triangleCount > 2_000_000) return null;

  let volume = 0;
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (let i = 0; i < triangleCount; i += 1) {
    const offset = 84 + i * 50 + 12;
    const a = point(view, offset);
    const b = point(view, offset + 12);
    const c = point(view, offset + 24);
    volume += signedTetraVolume(a, b, c);

    for (const p of [a, b, c]) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      minZ = Math.min(minZ, p.z);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
      maxZ = Math.max(maxZ, p.z);
    }
  }

  const volumeMm3 = Math.abs(volume);
  const bboxMm3 = Math.max(0, maxX - minX) * Math.max(0, maxY - minY) * Math.max(0, maxZ - minZ);
  if (!Number.isFinite(volumeMm3) || volumeMm3 <= 0) return null;

  const plasticDensityGPerCm3 = 1.24;
  const grams = Math.max(1, Math.round((volumeMm3 / 1000) * plasticDensityGPerCm3 * 1.12));
  const hours = Math.max(0.5, Math.round((grams / 14 + bboxMm3 / 350000) * 10) / 10);

  return { grams, hours };
}

function point(view: DataView, offset: number) {
  return {
    x: view.getFloat32(offset, true),
    y: view.getFloat32(offset + 4, true),
    z: view.getFloat32(offset + 8, true),
  };
}

function signedTetraVolume(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }, c: { x: number; y: number; z: number }) {
  return (
    a.x * b.y * c.z +
    b.x * c.y * a.z +
    c.x * a.y * b.z -
    a.x * c.y * b.z -
    b.x * a.y * c.z -
    c.x * b.y * a.z
  ) / 6;
}

function UploadList({ title, uploads }: { title: string; uploads: UploadedFile[] }) {
  if (!uploads.length) return null;
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">{title}</p>
      <ul className="mt-2 grid gap-1 text-sm text-zinc-300">
        {uploads.map((upload) => (
          <li className="truncate" key={upload.path}>{upload.name}</li>
        ))}
      </ul>
    </div>
  );
}

function Field({
  defaultValue,
  label,
  maxLength,
  name,
  onChange,
  pattern,
  placeholder,
  required = false,
  type = "text",
  value,
}: {
  defaultValue?: string;
  label: string;
  maxLength?: number;
  name: string;
  onChange?: (value: string) => void;
  pattern?: string;
  placeholder?: string;
  required?: boolean;
  type?: string;
  value?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-zinc-200">
      {label}
      <input
        className="h-11 w-full min-w-0 rounded-md border border-white/10 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none transition focus:border-amber-300/60"
        defaultValue={value === undefined ? defaultValue : undefined}
        maxLength={maxLength}
        name={name}
        onChange={(event) => onChange?.(event.target.value)}
        pattern={pattern}
        placeholder={placeholder}
        required={required}
        type={type}
        value={value}
      />
    </label>
  );
}

function Textarea({
  defaultValue,
  label,
  name,
  onChange,
  placeholder,
  value,
}: {
  defaultValue?: string;
  label: string;
  name: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  value?: string;
}) {
  return (
    <label className="grid min-w-0 gap-2 text-sm font-bold text-zinc-200">
      {label}
      <textarea
        className="min-h-28 w-full min-w-0 rounded-md border border-white/10 bg-zinc-950 px-3 py-3 text-sm text-zinc-100 outline-none transition focus:border-amber-300/60"
        defaultValue={value === undefined ? defaultValue : undefined}
        name={name}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </label>
  );
}

function FormMessage({ state }: { state: ActionState }) {
  return <p className={state.ok ? "text-sm font-semibold text-emerald-300" : "text-sm font-semibold text-amber-200"}>{state.message}</p>;
}

function parseAddress(address: string) {
  const lines = address.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const cityStateZip = lines.at(-1) || "";
  const match = cityStateZip.match(/^(.+?),\s*([A-Za-z]{2})\s+([0-9]{5}(?:-[0-9]{4})?)$/);

  return {
    street: lines[0] || "",
    unit: match ? lines.slice(1, -1).join(" ") : lines.slice(1).join(" "),
    city: match?.[1] || "",
    state: match?.[2]?.toUpperCase() || "",
    zip: match?.[3] || "",
  };
}
