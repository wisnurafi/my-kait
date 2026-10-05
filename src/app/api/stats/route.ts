/**
 * Public platform stats — powers the landing page stats strip.
 * Aggregates only (no PII, no per-user data). Safe to expose publicly.
 * Response cached for 5 minutes (ISR) so the DB isn't hit per visitor.
 * GET /api/stats
 */
import { NextResponse } from "next/server";
import { getPublicStats } from "@/lib/public-stats";

export const revalidate = 300; // 5 minutes

export async function GET() {
  return NextResponse.json(await getPublicStats());
}
