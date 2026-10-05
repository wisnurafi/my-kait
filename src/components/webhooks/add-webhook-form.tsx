"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { addWebhookAction, pingWebhookAction } from "@/server/actions/webhooks";
import { Plus, Zap } from "lucide-react";

export function AddWebhookForm() {
  const t = useTranslations("webhooks");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pingResult, setPingResult] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPingResult(null);
    startTransition(async () => {
      const formData = new FormData(e.currentTarget);
      // Ping first before saving
      const pingFormData = new FormData();
      pingFormData.set("url", url);
      // We need to ping the raw URL — but pingWebhookAction expects a webhookId
      // So we just save directly, which pings internally
      const result = await addWebhookAction(formData);
      if (result.error) {
        setError(result.error);
      } else {
        setName("");
        setUrl("");
        setPingResult("Webhook ditambahkan dan dicek!");
      }
    });
  }

  return (
    <Card className="p-5" id="add-webhook-form">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name" required>{t("addName")}</Label>
            <Input
              id="name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("addNamePlaceholder")}
              required
            />
          </div>
          <div>
            <Label htmlFor="url" required>{t("addUrl")}</Label>
            <Input
              id="url"
              name="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t("addPlaceholder")}
              required
            />
          </div>
        </div>
        {error && (
          <p className="text-sm text-error font-semibold">{error}</p>
        )}
        {pingResult && (
          <p className="text-sm text-success font-semibold">{pingResult}</p>
        )}
        <Button type="submit" disabled={pending} className="gap-2">
          {pending ? (
            <span className="inline-block h-4 w-4 animate-spin border-[2px] border-current border-t-transparent" />
          ) : (
            <Plus size={18} />
          )}
          {t("add")}
        </Button>
      </form>
    </Card>
  );
}
