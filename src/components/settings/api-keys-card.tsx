"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { Link } from "@/i18n/routing";
import {
  listApiKeysAction,
  createApiKeyAction,
  revokeApiKeyAction,
  type ApiKeyPublic,
  type NewApiKey,
} from "@/server/actions/api-keys";
import { KeyRound, Copy, Check, Plus, Ban, BookOpen } from "lucide-react";

type NewKey = NewApiKey;

function formatDate(iso: string | null, locale: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function ApiKeysCard() {
  const t = useTranslations("settings");
  const locale = useLocale();
  const [keys, setKeys] = useState<ApiKeyPublic[] | null>(null);
  const [name, setName] = useState("");
  const [expiry, setExpiry] = useState("never");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<NewKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);

  const load = async () => {
    try {
      setKeys(await listApiKeysAction());
    } catch {
      toast.error(t("apiKeysLoadFailed"));
      setKeys([]);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    setCopied(false);
    try {
      const result = await createApiKeyAction({
        name,
        expiresInDays: expiry === "never" ? null : Number(expiry),
      });
      if ("error" in result) {
        toast.error(result.error);
      } else {
        setNewKey(result.key);
        setName("");
        setExpiry("never");
        await load();
      }
    } catch {
      toast.error(t("apiKeysCreateFailed"));
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!newKey) return;
    try {
      await navigator.clipboard.writeText(newKey.raw);
    } catch {
      // Clipboard API unavailable — select fallback
      const ta = document.createElement("textarea");
      ta.value = newKey.raw;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    toast.success(t("apiKeysCopied"));
  };

  const handleRevoke = async (id: string) => {
    if (confirmRevokeId !== id) {
      setConfirmRevokeId(id);
      return;
    }
    setRevoking(true);
    try {
      const result = await revokeApiKeyAction(id);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(t("apiKeysRevoked"));
        await load();
      }
    } catch {
      toast.error(t("apiKeysRevokeFailed"));
    } finally {
      setRevoking(false);
      setConfirmRevokeId(null);
    }
  };

  const isExpired = (k: ApiKeyPublic) =>
    !k.revokedAt && k.expiresAt && new Date(k.expiresAt) < new Date();

  return (
    <Card hover>
      <CardBody>
        <h2 className="font-display text-xl uppercase mb-2 flex items-center gap-2">
          <KeyRound size={20} /> {t("apiKeysTitle")}
        </h2>
        <p className="text-sm text-fg-secondary mb-4">{t("apiKeysDesc")}</p>

        {/* New key — shown exactly once */}
        {newKey && (
          <div
            className="panel p-4 mb-4"
            style={{
              borderColor: "var(--accent-primary)",
              background: "var(--accent-primary-soft)",
            }}
            role="alert"
          >
            <div className="font-bold mb-1">{t("apiKeysCreatedTitle")}</div>
            <p className="text-sm text-fg-secondary mb-3">
              {t("apiKeysCreatedWarning")}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <code className="font-mono text-sm bg-sunken border border-border-ink rounded px-3 py-2 break-all flex-1 min-w-0">
                {newKey.raw}
              </code>
              <Button
                variant="secondary"
                onClick={handleCopy}
                className="gap-2 shrink-0"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {t("apiKeysCopy")}
              </Button>
            </div>
          </div>
        )}

        {/* Create form */}
        <div className="flex gap-2 flex-wrap items-end mb-4">
          <div className="flex-1 min-w-[180px]">
            <Label>{t("apiKeysNameLabel")}</Label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("apiKeysNamePlaceholder")}
              maxLength={50}
              className="mt-1"
            />
          </div>
          <div>
            <Label>{t("apiKeysExpiryLabel")}</Label>
            <Select
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              className="mt-1"
            >
              <option value="never">{t("apiKeysExpiryNever")}</option>
              <option value="30">{t("apiKeysExpiry30")}</option>
              <option value="90">{t("apiKeysExpiry90")}</option>
              <option value="365">{t("apiKeysExpiry365")}</option>
            </Select>
          </div>
          <Button
            onClick={handleCreate}
            disabled={creating || !name.trim()}
            className="gap-2"
          >
            <Plus size={16} />
            {creating ? t("apiKeysCreating") : t("apiKeysCreate")}
          </Button>
        </div>

        {/* Key list */}
        {keys === null ? (
          <div className="text-sm text-fg-tertiary">{t("loading")}</div>
        ) : keys.length === 0 ? (
          <p className="text-sm text-fg-secondary">{t("apiKeysEmpty")}</p>
        ) : (
          <ul className="space-y-2">
            {keys.map((k) => {
              const expired = isExpired(k);
              const revoked = !!k.revokedAt;
              return (
                <li
                  key={k.id}
                  className="panel p-3 flex items-center gap-3 flex-wrap"
                >
                  <div className="flex-1 min-w-[160px]">
                    <div className="font-bold flex items-center gap-2 flex-wrap">
                      {k.name}
                      <code className="font-mono text-xs text-fg-tertiary">
                        {k.keyPrefix}…
                      </code>
                      {k.scopes.map((s) => (
                        <Badge key={s} variant="info">
                          {s}
                        </Badge>
                      ))}
                      {revoked ? (
                        <Badge variant="error">{t("apiKeysRevokedBadge")}</Badge>
                      ) : expired ? (
                        <Badge variant="warning">{t("apiKeysExpiredBadge")}</Badge>
                      ) : (
                        <Badge variant="success">{t("apiKeysActiveBadge")}</Badge>
                      )}
                    </div>
                    <div className="text-xs text-fg-tertiary mt-1">
                      {t("apiKeysLastUsed")}:{" "}
                      {k.lastUsedAt
                        ? formatDate(k.lastUsedAt, locale)
                        : t("apiKeysNeverUsed")}{" "}
                      · {t("apiKeysExpires")}:{" "}
                      {k.expiresAt
                        ? formatDate(k.expiresAt, locale)
                        : t("apiKeysNoExpiry")}
                    </div>
                  </div>
                  {!revoked && !expired && (
                    <Button
                      variant={confirmRevokeId === k.id ? "destructive" : "ghost"}
                      onClick={() => handleRevoke(k.id)}
                      disabled={revoking}
                      className="gap-2"
                      aria-label={t("apiKeysRevoke")}
                    >
                      <Ban size={16} />
                      {confirmRevokeId === k.id
                        ? t("apiKeysRevokeConfirmButton")
                        : t("apiKeysRevoke")}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {confirmRevokeId && (
          <p className="text-sm text-error mt-2" role="alert">
            {t("apiKeysRevokeConfirm")}
          </p>
        )}

        <Link
          href="/docs"
          className="inline-flex items-center gap-2 text-sm text-link hover:underline mt-4"
        >
          <BookOpen size={16} /> {t("apiKeysDocsLink")}
        </Link>
      </CardBody>
    </Card>
  );
}
