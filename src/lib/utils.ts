import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind classes safely.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generate a random slug for share links.
 * Uses crypto.randomUUID and takes first segment for shortness.
 */
export function generateSlug(): string {
  const uuid = crypto.randomUUID();
  // Take 12 chars from the UUID (enough entropy to be unguessable)
  return uuid.replace(/-/g, "").slice(0, 12);
}

/**
 * Truncate text.
 */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "…";
}
