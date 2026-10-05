/**
 * Image upload via Vercel Blob.
 * See PRD section 3.10 (P2).
 * Uploads go through server to enforce rate limiting and auth.
 */

import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";

const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"];

export async function POST(req: Request) {
  // Auth check
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit
  const rl = await checkRateLimit("addWebhook", session.user.id);
  if (!rl.success) {
    return NextResponse.json({ error: "Too many uploads. Try again later." }, { status: 429 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Validate type
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `File type ${file.type} not allowed. Use PNG, JPEG, GIF, WebP, or AVIF.` },
      { status: 400 },
    );
  }

  // Validate size
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File too large. Max 8MB." },
      { status: 400 },
    );
  }

  try {
    // Generate unique filename
    const ext = file.name.split(".").pop() || "png";
    const filename = `mykait/${session.user.id}/${crypto.randomUUID()}.${ext}`;

    const blob = await put(filename, file, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return NextResponse.json({ url: blob.url });
  } catch (err) {
    logger.error("upload", "upload failed", err);
    return NextResponse.json(
      { error: "Upload failed. Try again." },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit (same bucket as uploads)
  const rl = await checkRateLimit("addWebhook", session.user.id);
  if (!rl.success) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "No URL provided" }, { status: 400 });
  }

  // Only allow deleting the caller's own uploads from our blob store.
  // Uploads are stored at mykait/<userId>/<uuid>.<ext>, so scoping the
  // pathname to the caller's prefix prevents deleting other users' files.
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }
  if (
    !url.includes("vercel-storage.com") ||
    !pathname.startsWith(`/mykait/${session.user.id}/`)
  ) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  try {
    const { del } = await import("@vercel/blob");
    await del(url, { token: process.env.BLOB_READ_WRITE_TOKEN });
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("upload", "blob delete failed", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
