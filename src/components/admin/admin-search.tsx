"use client";

/**
 * Admin search input — debounced 400ms, URL-driven (?q=&f=).
 * Same pattern as the user dashboard's TemplatesList: local state
 * initialized from the URL, a debounced effect syncs it back via
 * router.replace so the query stays shareable and filters are preserved.
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/routing";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export function AdminSearch({
  basePath,
  param = "q",
  preserve = [],
  placeholder,
}: {
  /** e.g. "/admin/users" */
  basePath: string;
  /** query param name, default "q" */
  param?: string;
  /** other params to keep while typing, e.g. ["f"] */
  preserve?: string[];
  placeholder: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(() => searchParams.get(param) ?? "");

  useEffect(() => {
    const timer = setTimeout(() => {
      const current = searchParams.get(param) ?? "";
      if (value === current) return;
      const next = new URLSearchParams();
      const q = value.trim();
      if (q) next.set(param, q);
      for (const key of preserve) {
        const v = searchParams.get(key);
        if (v) next.set(key, v);
      }
      const qs = next.toString();
      router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
    }, 400);
    return () => clearTimeout(timer);
    // Only re-run when the typed value changes (standard client pattern).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="relative max-w-md stagger-in">
      <span
        className="ia ia-scan absolute left-3 top-1/2 -translate-y-1/2 text-fg-tertiary pointer-events-none"
        aria-hidden="true"
      >
        <Search size={16} />
      </span>
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="pl-9"
      />
    </div>
  );
}
