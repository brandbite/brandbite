// -----------------------------------------------------------------------------
// @file: components/tokens/insufficient-tokens-modal.tsx
// @purpose: Shared "you don't have enough tokens" modal. Any client page that
//           fires a request that may return a 402 should render this and call
//           setError({ required, balance, shortBy, action }) when the server
//           returns an INSUFFICIENT_TOKENS body.
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Modal, ModalFooter, ModalHeader } from "@/components/ui/modal";

export type InsufficientTokensInfo = {
  required: number;
  balance: number;
  shortBy: number;
  /** Short label: "consultation booking", "AI image generation", … */
  action?: string;
};

type Props = {
  info: InsufficientTokensInfo | null;
  onClose: () => void;
  /** Optional override for the upgrade CTA target. Defaults to customer settings. */
  upgradeHref?: string;
};

export function InsufficientTokensModal({
  info,
  onClose,
  upgradeHref = "/customer/settings",
}: Props) {
  const open = info !== null;
  return (
    <Modal open={open} onClose={onClose} size="md">
      <ModalHeader title="Not enough tokens" onClose={onClose} />

      <div className="px-6 pb-4 text-sm text-[var(--bb-text-secondary)]">
        {info && (
          <>
            <p>
              You need <strong>{info.shortBy.toLocaleString()}</strong> more token
              {info.shortBy === 1 ? "" : "s"} to{" "}
              {info.action ? <>complete this {info.action}</> : "continue"}.
            </p>
            <dl className="mt-4 divide-y divide-[var(--bb-border-subtle)] rounded-xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] text-xs">
              <div className="flex items-center justify-between px-4 py-2">
                <dt className="text-[var(--bb-text-muted)]">Required for this action</dt>
                <dd className="font-semibold text-[var(--bb-secondary)]">
                  {info.required.toLocaleString()}
                </dd>
              </div>
              <div className="flex items-center justify-between px-4 py-2">
                <dt className="text-[var(--bb-text-muted)]">Your current balance</dt>
                <dd className="font-semibold text-[var(--bb-secondary)]">
                  {info.balance.toLocaleString()}
                </dd>
              </div>
              <div className="flex items-center justify-between px-4 py-2">
                <dt className="text-[var(--bb-text-muted)]">Short by</dt>
                <dd className="font-semibold text-[var(--bb-danger-text)]">
                  {info.shortBy.toLocaleString()}
                </dd>
              </div>
            </dl>
            <p className="mt-4 text-xs text-[var(--bb-text-muted)]">
              Upgrade your plan on the billing page — renewed or upgraded plans credit tokens
              automatically. Only company owners and billing members can change the plan.
            </p>
          </>
        )}
      </div>

      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
        <Link href={upgradeHref}>
          <Button variant="primary">View plans &amp; top up</Button>
        </Link>
      </ModalFooter>
    </Modal>
  );
}
