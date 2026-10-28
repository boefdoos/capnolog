"use client";

import { useState } from "react";

/**
 * Link tonen met aparte knoppen om te kopiëren en te delen. Eerder viel
 * kopiëren enkel terug als delen niet bestond, dus op een telefoon kon je
 * nooit gewoon kopiëren. Eén tik op de link selecteert ze volledig.
 */
export default function InviteLinkActions({
  link,
  shareText,
  onDone,
}: {
  link: string;
  shareText: string;
  onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      return;
    } catch {
      // Clipboard API geblokkeerd of niet beschikbaar: oude manier.
    }
    const area = document.createElement("textarea");
    area.value = link;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    try {
      if (document.execCommand("copy")) setCopied(true);
    } catch {
      // Lukt ook dit niet, dan blijft de link te selecteren.
    }
    document.body.removeChild(area);
  }

  async function share() {
    try {
      await navigator.share({ title: "Uitnodiging CapnoLog", text: shareText });
    } catch {
      // Delen geannuleerd.
    }
  }

  return (
    <>
      <div className="select-all break-all rounded-lg border border-panel-border bg-[#0D1210] px-3.5 py-2.5 font-mono text-xs text-text">
        {link}
      </div>
      <div className="flex gap-2.5">
        <button
          onClick={copy}
          className="flex-1 rounded-lg bg-trace py-3 text-sm font-semibold text-[#06120B] active:scale-[0.99]"
        >
          {copied ? "Gekopieerd" : "Kopieer link"}
        </button>
        {canShare && (
          <button
            onClick={share}
            className="flex-1 rounded-lg border border-panel-border py-3 text-sm font-semibold text-text active:scale-[0.99]"
          >
            Delen
          </button>
        )}
      </div>
      <button onClick={onDone} className="w-full rounded-lg border border-panel-border py-3 text-sm font-semibold text-muted">
        Klaar
      </button>
    </>
  );
}
