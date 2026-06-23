"use client";

import { useMemo, useState } from "react";
import { Calculator, Copy, TrendingUp } from "lucide-react";
import { formatPrice } from "@/lib/utils";

type Inputs = {
  filamentGrams: number;
  spoolCost: number;
  spoolGrams: number;
  printHours: number;
  machineHourly: number;
  laborMinutes: number;
  laborHourly: number;
  packaging: number;
  failureRate: number;
  profitMargin: number;
  etsyTransactionRate: number;
  etsyPaymentRate: number;
  etsyFixedFee: number;
  competitorLow: number;
  competitorHigh: number;
  shippingChargedSeparately: boolean;
};

const defaults: Inputs = {
  filamentGrams: 80,
  spoolCost: 22,
  spoolGrams: 1000,
  printHours: 5,
  machineHourly: 0.35,
  laborMinutes: 15,
  laborHourly: 18,
  packaging: 1.25,
  failureRate: 12,
  profitMargin: 45,
  etsyTransactionRate: 6.5,
  etsyPaymentRate: 3,
  etsyFixedFee: 0.45,
  competitorLow: 14.99,
  competitorHigh: 24.99,
  shippingChargedSeparately: true,
};

export function PriceCalculator() {
  const [inputs, setInputs] = useState(defaults);
  const [copied, setCopied] = useState(false);

  const result = useMemo(() => calculatePrice(inputs), [inputs]);

  function update<K extends keyof Inputs>(key: K, value: Inputs[K]) {
    setInputs((current) => ({ ...current, [key]: value }));
  }

  const copyText = [
    `Suggested Etsy price: ${formatPrice(result.suggestedPrice)}`,
    `Floor price: ${formatPrice(result.floorPrice)}`,
    `Competitive range: ${formatPrice(result.competitiveLow)} - ${formatPrice(result.competitiveHigh)}`,
    `Estimated profit: ${formatPrice(result.profit)}`,
    `Costs: filament ${formatPrice(result.filamentCost)}, print time ${formatPrice(result.machineCost)}, labor ${formatPrice(result.laborCost)}, packaging ${formatPrice(result.packagingCost)}, failure buffer ${formatPrice(result.failureBuffer)}, Etsy fees ${formatPrice(result.etsyFees)}`,
  ].join("\n");

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <section className="grid gap-5 rounded-lg border border-white/10 bg-zinc-900/70 p-5 sm:p-7">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-200">Inputs</p>
          <h2 className="mt-2 text-2xl font-black text-zinc-50">3D print pricing</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Start with your slicer estimates, then compare against Etsy pricing. Keep shipping separate when possible so item pricing stays competitive.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <NumberField label="Filament used" suffix="g" value={inputs.filamentGrams} onChange={(value) => update("filamentGrams", value)} />
          <NumberField label="Spool cost" prefix="$" value={inputs.spoolCost} onChange={(value) => update("spoolCost", value)} />
          <NumberField label="Spool size" suffix="g" value={inputs.spoolGrams} onChange={(value) => update("spoolGrams", value)} />
          <NumberField label="Print time" suffix="hrs" value={inputs.printHours} onChange={(value) => update("printHours", value)} />
          <NumberField label="Printer/electricity wear" prefix="$" suffix="/hr" value={inputs.machineHourly} step={0.05} onChange={(value) => update("machineHourly", value)} />
          <NumberField label="Hands-on labor" suffix="min" value={inputs.laborMinutes} onChange={(value) => update("laborMinutes", value)} />
          <NumberField label="Labor rate" prefix="$" suffix="/hr" value={inputs.laborHourly} onChange={(value) => update("laborHourly", value)} />
          <NumberField label="Packaging cost" prefix="$" value={inputs.packaging} step={0.05} onChange={(value) => update("packaging", value)} />
        </div>

        <div className="grid gap-5 border-t border-white/10 pt-5 sm:grid-cols-2">
          <NumberField label="Failure / reprint buffer" suffix="%" value={inputs.failureRate} onChange={(value) => update("failureRate", value)} />
          <NumberField label="Target profit margin" suffix="%" value={inputs.profitMargin} onChange={(value) => update("profitMargin", value)} />
          <NumberField label="Etsy transaction fee" suffix="%" value={inputs.etsyTransactionRate} step={0.1} onChange={(value) => update("etsyTransactionRate", value)} />
          <NumberField label="Payment processing fee" suffix="%" value={inputs.etsyPaymentRate} step={0.1} onChange={(value) => update("etsyPaymentRate", value)} />
          <NumberField label="Fixed order/listing fees" prefix="$" value={inputs.etsyFixedFee} step={0.05} onChange={(value) => update("etsyFixedFee", value)} />
          <label className="flex items-center gap-3 rounded-md border border-white/10 bg-zinc-950 px-4 py-3 text-sm font-semibold text-zinc-200">
            <input
              checked={inputs.shippingChargedSeparately}
              onChange={(event) => update("shippingChargedSeparately", event.target.checked)}
              type="checkbox"
            />
            Shipping charged separately
          </label>
        </div>

        <div className="grid gap-5 border-t border-white/10 pt-5 sm:grid-cols-2">
          <NumberField label="Competitor low price" prefix="$" value={inputs.competitorLow} step={0.5} onChange={(value) => update("competitorLow", value)} />
          <NumberField label="Competitor high price" prefix="$" value={inputs.competitorHigh} step={0.5} onChange={(value) => update("competitorHigh", value)} />
        </div>
      </section>

      <aside className="grid h-fit gap-4 rounded-lg border border-amber-300/20 bg-amber-300/[0.06] p-5 sm:p-7">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-md bg-amber-300 text-zinc-950">
            <Calculator size={22} />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-200">Recommended</p>
            <h2 className="text-3xl font-black text-zinc-50">{formatPrice(result.suggestedPrice)}</h2>
          </div>
        </div>

        <div className="grid gap-3">
          <ResultRow label="Minimum floor price" value={formatPrice(result.floorPrice)} />
          <ResultRow label="Competitive target" value={`${formatPrice(result.competitiveLow)} - ${formatPrice(result.competitiveHigh)}`} />
          <ResultRow label="Estimated profit" value={formatPrice(result.profit)} strong />
          <ResultRow label="Effective margin" value={`${Math.round(result.effectiveMargin)}%`} />
        </div>

        <div className="rounded-md border border-white/10 bg-zinc-950 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-zinc-50">
            <TrendingUp className="text-amber-200" size={16} />
            Pricing guidance
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-400">{result.guidance}</p>
        </div>

        <div className="rounded-md border border-white/10 bg-zinc-950 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Cost breakdown</p>
          <dl className="mt-3 grid gap-2 text-sm">
            <ResultRow label="Filament" value={formatPrice(result.filamentCost)} />
            <ResultRow label="Print time" value={formatPrice(result.machineCost)} />
            <ResultRow label="Labor" value={formatPrice(result.laborCost)} />
            <ResultRow label="Packaging" value={formatPrice(result.packagingCost)} />
            <ResultRow label="Failure buffer" value={formatPrice(result.failureBuffer)} />
            <ResultRow label="Etsy fees" value={formatPrice(result.etsyFees)} />
          </dl>
        </div>

        <button
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-white/10 px-4 text-sm font-bold text-zinc-200 hover:border-amber-300/50"
          onClick={async () => {
            await navigator.clipboard.writeText(copyText);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
          }}
          type="button"
        >
          <Copy size={16} />
          {copied ? "Copied" : "Copy pricing summary"}
        </button>
      </aside>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  prefix,
  suffix,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-zinc-200">
      {label}
      <span className="grid grid-cols-[auto_1fr_auto] items-center rounded-md border border-white/10 bg-zinc-950 focus-within:border-amber-300">
        {prefix ? <span className="pl-4 text-zinc-500">{prefix}</span> : null}
        <input
          className="h-12 min-w-0 bg-transparent px-4 text-zinc-50 outline-none"
          min={0}
          onChange={(event) => onChange(Number(event.target.value) || 0)}
          step={step}
          type="number"
          value={value}
        />
        {suffix ? <span className="pr-4 text-zinc-500">{suffix}</span> : null}
      </span>
    </label>
  );
}

function ResultRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-sm text-zinc-400">{label}</dt>
      <dd className={strong ? "text-sm font-black text-emerald-300" : "text-sm font-bold text-zinc-100"}>{value}</dd>
    </div>
  );
}

function calculatePrice(inputs: Inputs) {
  const filamentCost = inputs.spoolGrams > 0 ? (inputs.filamentGrams / inputs.spoolGrams) * inputs.spoolCost : 0;
  const machineCost = inputs.printHours * inputs.machineHourly;
  const laborCost = (inputs.laborMinutes / 60) * inputs.laborHourly;
  const packagingCost = inputs.packaging;
  const baseCost = filamentCost + machineCost + laborCost + packagingCost;
  const failureBuffer = baseCost * (inputs.failureRate / 100);
  const costWithBuffer = baseCost + failureBuffer;

  const marginDecimal = Math.min(inputs.profitMargin / 100, 0.85);
  const preFeeTarget = costWithBuffer / Math.max(1 - marginDecimal, 0.15);
  const feeRate = (inputs.etsyTransactionRate + inputs.etsyPaymentRate) / 100;
  const floorPrice = (costWithBuffer + inputs.etsyFixedFee) / Math.max(1 - feeRate - 0.12, 0.5);
  const formulaPrice = (preFeeTarget + inputs.etsyFixedFee) / Math.max(1 - feeRate, 0.5);
  const competitorMid = (inputs.competitorLow + inputs.competitorHigh) / 2;
  const competitiveLow = Math.max(inputs.competitorLow, floorPrice);
  const competitiveHigh = Math.max(inputs.competitorHigh, competitiveLow);

  let suggestedPrice = roundCharm(Math.max(formulaPrice, floorPrice));
  if (competitorMid > 0) {
    const competitiveAnchor = competitorMid * 0.96;
    if (floorPrice <= competitiveAnchor) {
      suggestedPrice = roundCharm(Math.max(floorPrice, Math.min(formulaPrice, competitiveAnchor)));
    } else {
      suggestedPrice = roundCharm(floorPrice);
    }
  }

  const etsyFees = suggestedPrice * feeRate + inputs.etsyFixedFee;
  const profit = suggestedPrice - costWithBuffer - etsyFees;
  const effectiveMargin = suggestedPrice > 0 ? (profit / suggestedPrice) * 100 : 0;

  const guidance =
    suggestedPrice > inputs.competitorHigh && inputs.competitorHigh > 0
      ? "Your real cost is above the current competitor range. Consider reducing print time, lowering grams, charging separately for customization, or positioning it as a premium/custom item."
      : suggestedPrice < inputs.competitorLow
        ? "You have room to price higher. Match the lower competitor range unless you intentionally want an entry offer."
        : "This lands inside the competitor range while covering material, time, failure risk, fees, and profit.";

  return {
    filamentCost,
    machineCost,
    laborCost,
    packagingCost,
    failureBuffer,
    floorPrice,
    suggestedPrice,
    etsyFees,
    profit,
    effectiveMargin,
    competitiveLow,
    competitiveHigh,
    guidance,
  };
}

function roundCharm(value: number) {
  if (value <= 0) return 0;
  const rounded = Math.ceil(value) - 0.01;
  return Number(Math.max(0.99, rounded).toFixed(2));
}
