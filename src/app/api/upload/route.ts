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

/** Extension derived from the DETECTED content type — never from file.name. */
const DETECTED_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
};

/**
 * Detect the real image type from magic bytes.
 * `file.type` comes from the multipart Content-Type header and is fully
 * attacker-controlled, so it must never be trusted on its own — an HTML/JS
 * polyglot uploaded as "image/png" would otherwise get a public,
 * trusted vercel-storage.com URL.
 */
function detectImageType(bytes: Uint8Array): string | null {
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  // JPEG: FF D8 FF
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }
  // GIF: "GIF8" (GIF87a / GIF89a)
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38
  ) {
    return "image/gif";
  }
  // WebP: "RIFF"...."WEBP"
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  // AVIF: ...."ftyp" + "avif"/"avis" brand
  if (
    bytes.length >= 12 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70 &&
    bytes[8] === 0x61 &&
    bytes[9] === 0x76 &&
    bytes[10] === 0x69 &&
    (bytes[11] === 0x66 || bytes[11] === 0x73)
  ) {
    return "image/avif";
  }
  return null;
}

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

  // Validate type (declared type — verified against magic bytes below)
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

  // Magic-bytes check: the declared type must match the actual content.
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const detectedType = detectImageType(head);
  if (!detectedType || detectedType !== file.type) {
    return NextResponse.json(
      { error: "File content does not match its declared type." },
      { status: 400 },
    );
  }

  try {
    // Generate unique filename — extension from the DETECTED type, never
    // from file.name (attacker-controlled).
    const ext = DETECTED_EXT[detectedType];
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
