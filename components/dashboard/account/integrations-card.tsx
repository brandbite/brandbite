// -----------------------------------------------------------------------------
// @file: components/dashboard/account/integrations-card.tsx
// @purpose: Settings → Integrations for a customer company: connect Google
//           Drive (and later Dropbox and Slack) so creatives deliver source
//           files straight into the customer's own storage. Owners and PMs
//           connect and disconnect; everyone else sees what is connected.
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useState } from "react";

import {
  Badge,
  Button,
  Callout,
  Card,
  CardTitle,
  Skeleton,
  buttonClass,
} from "@/components/admin/v2/ui";
import { Modal, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast-provider";

type IntegrationView = {
  provider: "GOOGLE_DRIVE" | "DROPBOX" | "SLACK";
  label: string;
  slug: string;
  available: boolean;
  status: "CONNECTED" | "BROKEN" | "NOT_CONNECTED";
  accountLabel: string | null;
  connectedAt: string | null;
  connectedBy: string | null;
  lastError: string | null;
};

const DESCRIPTIONS: Record<IntegrationView["provider"], string> = {
  GOOGLE_DRIVE:
    "Creatives deliver source files (PSD, AI, print files) into a brandbite folder in your Drive. They stay yours for good. brandbite only sees the folder it creates, nothing else in your Drive.",
  DROPBOX:
    "Creatives deliver source files into a brandbite folder in your Dropbox. They stay yours for good.",
  SLACK: "Get request updates in a Slack channel of your choice.",
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

export function IntegrationsCard({
  result,
}: {
  result?: { slug: string; ok: boolean; message: string | null } | null;
}) {
  const { showToast } = useToast();
  const [items, setItems] = useState<IntegrationView[] | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<IntegrationView | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch("/api/customer/integrations", { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Could not load integrations.");
      setItems(json.integrations);
      setCanManage(Boolean(json.canManage));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load integrations.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const disconnect = async () => {
    if (!confirming) return;
    setDisconnecting(true);
    setDisconnectError(null);
    try {
      const res = await fetch(`/api/customer/integrations/${confirming.slug}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Could not disconnect.");
      showToast({ type: "success", title: `${confirming.label} disconnected` });
      setConfirming(null);
      await load();
    } catch (error) {
      setDisconnectError(error instanceof Error ? error.message : "Could not disconnect.");
    } finally {
      setDisconnecting(false);
    }
  };

  const resultLabel = items?.find((i) => i.slug === result?.slug)?.label ?? "The integration";

  return (
    <Card>
      <CardTitle description="Connect your own storage so source files land straight in your account. Without one, source files are kept on brandbite for 90 days after a request is done.">
        Integrations
      </CardTitle>

      {result && (
        <div className="mt-4">
          {result.ok ? (
            <Callout tone="success" title={`${resultLabel} is connected`}>
              {result.message ? `Connected as ${result.message}.` : null}
            </Callout>
          ) : (
            <Callout tone="error" title={`${resultLabel} wasn't connected`}>
              {result.message}
            </Callout>
          )}
        </div>
      )}

      {loadError && (
        <div className="mt-4">
          <Callout tone="error" title="Couldn't load integrations">
            {loadError}
          </Callout>
        </div>
      )}

      {!items && !loadError ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : items ? (
        <ul className="mt-4 divide-y divide-[var(--av2-border)]">
          {items.map((item) => (
            <li
              key={item.provider}
              className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 py-4 first:pt-0 last:pb-0"
            >
              <div className="min-w-0 flex-1 basis-64">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{item.label}</p>
                  {item.status === "CONNECTED" && (
                    <Badge tone="green" dot>
                      Connected
                    </Badge>
                  )}
                  {item.status === "BROKEN" && (
                    <Badge tone="red" dot>
                      Needs reconnecting
                    </Badge>
                  )}
                  {item.status === "NOT_CONNECTED" && !item.available && (
                    <Badge tone="neutral">Coming soon</Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-[var(--av2-text-2)]">
                  {DESCRIPTIONS[item.provider]}
                </p>
                {item.status !== "NOT_CONNECTED" && (
                  <p className="mt-1 text-sm text-[var(--av2-text-2)]">
                    {item.accountLabel ? `${item.accountLabel} · ` : ""}
                    {item.connectedAt ? `connected ${formatDate(item.connectedAt)}` : ""}
                    {item.connectedBy ? ` by ${item.connectedBy}` : ""}
                  </p>
                )}
                {item.status === "BROKEN" && (
                  <p className="mt-1 text-sm text-[var(--av2-error-text)]">
                    {item.label} stopped accepting brandbite&apos;s access. Reconnect it so files
                    keep arriving.
                  </p>
                )}
              </div>

              {canManage && item.available && (
                <div className="flex shrink-0 flex-wrap gap-2">
                  {item.status !== "CONNECTED" && (
                    // A full page load: the connect route redirects to the provider.
                    <a
                      href={`/api/customer/integrations/${item.slug}/connect`}
                      className={buttonClass(item.status === "BROKEN" ? "primary" : "secondary")}
                    >
                      {item.status === "BROKEN" ? "Reconnect" : `Connect ${item.label}`}
                    </a>
                  )}
                  {item.status !== "NOT_CONNECTED" && (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setDisconnectError(null);
                        setConfirming(item);
                      }}
                    >
                      Disconnect
                    </Button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {items && !canManage && (
        <p className="mt-4 text-sm text-[var(--av2-text-2)]">
          Only company owners and project managers can connect or disconnect integrations.
        </p>
      )}

      <Modal open={Boolean(confirming)} onClose={() => setConfirming(null)} size="md">
        <ModalHeader
          title={`Disconnect ${confirming?.label ?? ""}?`}
          onClose={() => setConfirming(null)}
        />
        <div className="space-y-3 px-6 pb-4 text-sm text-[var(--av2-text-2)]">
          <p>
            Files already delivered stay in your {confirming?.label} folder. New source files go to
            brandbite storage instead, where they are kept for 90 days after a request is done.
          </p>
          {disconnectError && <Callout tone="error">{disconnectError}</Callout>}
        </div>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setConfirming(null)} disabled={disconnecting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={disconnect} disabled={disconnecting}>
            {disconnecting ? "Disconnecting…" : "Disconnect"}
          </Button>
        </ModalFooter>
      </Modal>
    </Card>
  );
}
