import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { syncEtsyListings } from "@/lib/etsy-sync";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const url = new URL(request.url);

  if (cronSecret && auth !== `Bearer ${cronSecret}` && url.searchParams.get("secret") !== cronSecret) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await syncEtsyListings();
    revalidatePath("/");
    revalidatePath("/products");
    revalidatePath("/admin");
    revalidatePath("/admin/etsy");
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Etsy sync failed.",
        imported: 0,
        updatedAt: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
