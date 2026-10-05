"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { ThemeLanguageSwitcher } from "@/components/app/theme-language-switcher";
import { toast } from "@/components/ui/toast";
import { signOut } from "next-auth/react";
import { deleteAccountAction } from "@/server/actions/messages";
import { exportUserDataAction } from "@/server/actions/export";
import { Link } from "@/i18n/routing";
import { Download, AlertTriangle, User } from "lucide-react";

function staggerStyle(i: number) {
  return { "--stagger-index": i } as React.CSSProperties;
}

/** Baca preferensi savePayload dari localStorage. Default true. */
function readSavePayload(): boolean {
  try {
    const v = localStorage.getItem("mykait-save-payload");
    return v === null ? true : v === "1";
  } catch {
    return true;
  }
}

export function SettingsClient({
  user,
}: {
  user: { name?: string | null; image?: string | null } | null;
}) {
  const t = useTranslations("settings");
  const [savePayload, setSavePayload] = useState(true);
  // Sync from localStorage after mount — reading it in useState would
  // mismatch SSR HTML when the user previously set OFF (hydration flicker).
  useEffect(() => {
    setSavePayload(readSavePayload());
  }, []);
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [exporting, setExporting] = useState(false);

  const handleSavePayloadChange = (v: boolean) => {
    try {
      localStorage.setItem("mykait-save-payload", v ? "1" : "0");
    } catch {
      // localStorage tidak tersedia — tetap update state lokal
    }
    setSavePayload(v);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await exportUserDataAction();
      if (result.success) {
        const blob = new Blob([JSON.stringify(result.data, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `mykait-export-${new Date().toISOString().split("T")[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        toast.error(t("exportFailed"));
      }
    } catch {
      toast.error(t("exportFailed"));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Page head */}
      <div className="flex items-start justify-between gap-4 flex-wrap stagger-in">
        <div>
          <div className="label mb-2">{t("title")}</div>
          <h2 className="uppercase">{t("title")}</h2>
        </div>
      </div>

      {/* Profile */}
      <div className="stagger-in" style={staggerStyle(0)}>
        <Card hover>
          <CardBody>
            <h2 className="font-display text-xl uppercase mb-4">{t("profile")}</h2>
            <div className="flex items-center gap-4">
              {user?.image ? (
                <img
                  src={user.image}
                  alt="Avatar"
                  className="w-16 h-16 rounded-full ring-2 ring-border-ink object-cover"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-sunken border border-border-ink flex items-center justify-center">
                  <User size={24} className="text-fg-tertiary" />
                </div>
              )}
              <div>
                <div className="font-bold">{user?.name}</div>
                <div className="text-sm text-fg-secondary">{t("loginViaDiscord")}</div>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Preferences */}
      <div className="stagger-in" style={staggerStyle(1)}>
        <Card hover>
          <CardBody>
            <h2 className="font-display text-xl uppercase mb-4">{t("preferences")}</h2>
            <div className="space-y-4">
              <div>
                <Label>{t("language")}</Label>
                <div className="mt-2">
                  <ThemeLanguageSwitcher />
                </div>
              </div>
              <div>
                <Label>{t("logRetention")}</Label>
                <p className="text-sm text-fg-secondary mt-1">{t("logRetentionDesc")}</p>
              </div>
              <Toggle
                checked={savePayload}
                onChange={handleSavePayloadChange}
                label={t("savePayload")}
                description={t("savePayloadDesc")}
              />
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Data export */}
      <div className="stagger-in" style={staggerStyle(2)}>
        <Card hover>
          <CardBody>
            <h2 className="font-display text-xl uppercase mb-4">{t("dataExport")}</h2>
            <p className="text-sm text-fg-secondary mb-4">{t("dataExportDesc")}</p>
            <Button variant="secondary" onClick={handleExport} disabled={exporting} className="gap-2">
              <Download size={16} />
              {exporting ? t("exporting") : t("exportButton")}
            </Button>
          </CardBody>
        </Card>
      </div>

      {/* Danger zone */}
      <div className="stagger-in" style={staggerStyle(3)}>
        <div
          className="panel"
          style={{
            borderColor: "rgba(248, 113, 113, 0.4)",
            background: "var(--error-soft)",
          }}
        >
          <CardBody>
            <h2 className="font-display text-xl uppercase text-error mb-2 flex items-center gap-2">
              <AlertTriangle size={20} /> {t("deleteAccount")}
            </h2>
            <p className="text-sm text-fg-secondary mb-4">{t("deleteAccountDesc")}</p>
            {confirming ? (
              <div className="space-y-3">
                <Label>{t("deleteAccountConfirm")}</Label>
                <Input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                />
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    disabled={confirmText !== "DELETE"}
                    onClick={async () => {
                      try {
                        await deleteAccountAction();
                        await signOut({ redirectTo: "/" });
                      } catch {
                        toast.error(t("deleteFailed"));
                      }
                    }}
                  >
                    {t("deleteAccountButton")}
                  </Button>
                  <Button variant="ghost" onClick={() => { setConfirming(false); setConfirmText(""); }}>
                    {t("cancel")}
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="destructive" onClick={() => setConfirming(true)}>
                {t("deleteAccountButton")}
              </Button>
            )}
          </CardBody>
        </div>
      </div>

      {/* Legal */}
      <div className="flex gap-4 justify-center text-sm stagger-in" style={staggerStyle(4)}>
        <Link href="/privacy" className="text-fg-secondary hover:text-link">
          {t("privacy")}
        </Link>
        <Link href="/terms" className="text-fg-secondary hover:text-link">
          {t("terms")}
        </Link>
      </div>
    </div>
  );
}
