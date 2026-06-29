import { createMissingEtsyDrafts } from "@/lib/etsy-draft-automation";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}

async function handle(request: Request) {
  const secret = process.env.ETSY_DRAFT_CRON_SECRET || process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const url = new URL(request.url);

  if (!secret || (auth !== `Bearer ${secret}` && url.searchParams.get("secret") !== secret)) {
    return Response.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const dryRun = url.searchParams.get("dryRun") === "true";
  const limit = Number(url.searchParams.get("limit") || 5);

  try {
    const result = await createMissingEtsyDrafts({ dryRun, limit });
    return Response.json(result, { status: result.ok ? 200 : 207 });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Etsy draft automation failed.",
        checked: 0,
        created: 0,
        skipped: 0,
        failed: 1,
        failures: [error instanceof Error ? error.message : "Etsy draft automation failed."],
      },
      { status: 500 },
    );
  }
}
