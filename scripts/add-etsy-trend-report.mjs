import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(path) {
  try {
    const body = readFileSync(path, "utf8");
    for (const line of body.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const index = trimmed.indexOf("=");
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // The deployment environment can provide vars directly.
  }
}

function requiredString(value, field) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing required report field: ${field}`);
  }
  return value.trim();
}

function stringArray(value, field) {
  if (!Array.isArray(value)) {
    throw new Error(`Report field must be an array: ${field}`);
  }
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function parseReport(path) {
  const report = JSON.parse(readFileSync(resolve(path), "utf8"));
  return {
    report_date: requiredString(report.report_date, "report_date"),
    title: requiredString(report.title, "title"),
    summary: requiredString(report.summary, "summary"),
    top_trends: stringArray(report.top_trends, "top_trends"),
    listing_ideas: stringArray(report.listing_ideas, "listing_ideas"),
    recommended_listing: report.recommended_listing || {},
    source_notes: typeof report.source_notes === "string" ? report.source_notes.trim() : null,
  };
}

async function main() {
  const reportPath = process.argv[2];
  if (!reportPath) {
    throw new Error("Usage: node scripts/add-etsy-trend-report.mjs <report.json>");
  }

  loadEnvFile(".env.local");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  const report = parseReport(reportPath);
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("etsy_trend_reports")
    .insert(report)
    .select("id, report_date, title, created_at")
    .single();

  if (error) throw new Error(error.message);
  console.log(JSON.stringify(data, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
