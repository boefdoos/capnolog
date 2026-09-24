"use client";

import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { getFirebaseDb } from "@/lib/firebase";
import { createInvite, inviteUrl } from "@/lib/invites";

const inputClass =
  "w-full rounded-lg border border-panel-border bg-[#0D1210] px-3.5 py-2.5 text-sm text-text outline-none focus:border-trace";

/**
 * Begeleider nodigt een cliënt uit (P13): naam invullen, link delen. De
 * cliënt maakt met die link zelf een account aan, met een eigen wachtwoord,
 * en de koppeling gebeurt dan vanzelf. Geen Firebase-console nodig.
 */
export default function InviteClient({ coachUid }: { coachUid: string }) {
  const [open, setOpen] = useState(false);
  const [clientName, setClientName] = useState("");
  const [coachName, setCoachName] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    getDoc(doc(getFirebaseDb(), "users", coachUid))
      .then((snap) => setCoachName((snap.data()?.displayName as string | undefined) ?? ""))
      .catch(() => {});
  }, [coachUid]);

  async function create() {
    setBusy(true);
    setFailed(false);
    try {
      const code = await createInvite(coachUid, coachName.trim(), clientName.trim());
      setLink(inviteUrl(code));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    if (!link) return;
    const text = `${coachName} nodigt je uit voor CapnoLog. Maak hier je account aan: ${link}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Uitnodiging CapnoLog", text });
        return;
      }
    } catch {
      // Delen geannuleerd, val terug op kopiëren.
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // Klembord geblokkeerd; de link staat zichtbaar en is te selecteren.
    }
  }

  function reset() {
    setOpen(false);
    setLink(null);
    setClientName("");
    setCopied(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-panel-border py-3 text-sm font-semibold text-text active:scale-[0.99]"
      >
        Cliënt uitnodigen
      </button>
    );
  }

  return (
    <div className="panel space-y-3">
      <h2 className="text-xs uppercase tracking-wide text-muted">Cliënt uitnodigen</h2>
      {link ? (
        <>
          <p className="text-sm text-text">
            Stuur deze link naar {clientName || "de cliënt"}. Hij is 14 dagen geldig en werkt één keer.
          </p>
          <div className="break-all rounded-lg border border-panel-border bg-[#0D1210] px-3.5 py-2.5 font-mono text-xs text-text">
            {link}
          </div>
          <div className="flex gap-2.5">
            <button
              onClick={share}
              className="flex-1 rounded-lg bg-trace py-3 text-sm font-semibold text-[#06120B] active:scale-[0.99]"
            >
              {copied ? "Gekopieerd" : "Link delen"}
            </button>
            <button
              onClick={reset}
              className="flex-1 rounded-lg border border-panel-border py-3 text-sm font-semibold text-muted"
            >
              Klaar
            </button>
          </div>
        </>
      ) : (
        <>
          <label className="block space-y-1.5">
            <span className="text-xs text-muted">Naam van de cliënt</span>
            <input className={inputClass} value={clientName} onChange={(e) => setClientName(e.target.value)} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-muted">Jouw naam, zoals de cliënt die ziet</span>
            <input className={inputClass} value={coachName} onChange={(e) => setCoachName(e.target.value)} />
          </label>
          {failed && <p className="text-xs text-danger">Uitnodiging maken mislukt, probeer opnieuw.</p>}
          <div className="flex gap-2.5">
            <button
              onClick={reset}
              className="flex-1 rounded-lg border border-panel-border py-3 text-sm font-semibold text-muted"
            >
              Annuleer
            </button>
            <button
              onClick={create}
              disabled={busy || !clientName.trim() || !coachName.trim()}
              className="flex-1 rounded-lg bg-trace py-3 text-sm font-semibold text-[#06120B] disabled:opacity-50"
            >
              {busy ? "..." : "Maak link"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
