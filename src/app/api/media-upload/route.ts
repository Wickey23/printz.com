import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

const bucketName = "product-media";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  if (!supabase || !admin) {
    return NextResponse.json({ ok: false, message: "Supabase is not configured." }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, message: "Sign in before uploading media." }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, message: "Missing upload file." }, { status: 400 });
  }

  const bucketError = await ensureProductMediaBucket(admin);
  if (bucketError) return NextResponse.json({ ok: false, message: bucketError }, { status: 500 });

  const extension = file.name.split(".").pop() || "bin";
  const path = `products/${crypto.randomUUID()}.${extension}`;
  const { error } = await admin.storage.from(bucketName).upload(path, file, {
    upsert: false,
    contentType: file.type || "application/octet-stream",
  });

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

  const { data } = admin.storage.from(bucketName).getPublicUrl(path);
  return NextResponse.json({ ok: true, publicUrl: data.publicUrl });
}

async function ensureProductMediaBucket(admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>) {
  const { data } = await admin.storage.getBucket(bucketName);
  if (data) return null;

  const { error } = await admin.storage.createBucket(bucketName, { public: true });
  if (error && !error.message.toLowerCase().includes("already exists")) {
    return `Could not create Supabase storage bucket "${bucketName}": ${error.message}`;
  }

  return null;
}
