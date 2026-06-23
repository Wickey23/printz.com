import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

const bucketName = "print-uploads";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  if (!supabase || !admin) {
    return NextResponse.json({ ok: false, message: "Supabase is not configured." }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, message: "Sign in before uploading files." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const kind = String(formData.get("kind") || "model");

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, message: "Missing upload file." }, { status: 400 });
  }

  if (!["model", "reference"].includes(kind)) {
    return NextResponse.json({ ok: false, message: "Invalid upload type." }, { status: 400 });
  }

  const bucketError = await ensurePrintUploadsBucket(admin);
  if (bucketError) {
    return NextResponse.json({ ok: false, message: bucketError }, { status: 500 });
  }

  const extension = file.name.split(".").pop() || "bin";
  const path = `${user.id}/${kind}/${crypto.randomUUID()}.${extension}`;
  let { error } = await admin.storage.from(bucketName).upload(path, file, {
    upsert: false,
    contentType: file.type || "application/octet-stream",
  });

  if (error?.message.toLowerCase().includes("bucket not found")) {
    const retryBucketError = await ensurePrintUploadsBucket(admin, true);
    if (retryBucketError) {
      return NextResponse.json({ ok: false, message: retryBucketError }, { status: 500 });
    }
    const retry = await admin.storage.from(bucketName).upload(path, file, {
      upsert: false,
      contentType: file.type || "application/octet-stream",
    });
    error = retry.error;
  }

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    path,
    name: file.name,
    size: file.size,
    type: file.type,
  });
}

async function ensurePrintUploadsBucket(admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, forceCreate = false) {
  const { data } = await admin.storage.getBucket(bucketName);
  if (data && !forceCreate) return null;

  const { error } = await admin.storage.createBucket(bucketName, {
    public: false,
  });
  if (error && !error.message.toLowerCase().includes("already exists")) {
    return `Could not create Supabase storage bucket "${bucketName}": ${error.message}`;
  }

  return null;
}
