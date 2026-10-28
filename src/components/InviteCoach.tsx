"use client";

import { useState } from "react";
import { coachInviteUrl, createCoachInvite } from "@/lib/coachInvites";
import InviteLinkActions from "./InviteLinkActions";

const inputClass =
  "w-full rounded-lg border border-panel-border bg-[#0D1210] px-3.5 py-2.5 text-sm text-text outline-none focus:border-trace";

/**
 * Admin nodigt een begeleider uit, typisch een kinesitherapeut. Zelfde
 * opbouw als InviteClient: naam invullen, link delen.
 */
export default function InviteCoach({ adminUid }: { adminUid: string }) {
  const [open, setOpen] = useState(false);
  const [coachName, setCoachName] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function create() {
    setBusy(true);
    setFailed(false);
    try {
      const code = await createCoachInvite(adminUid, coachName.trim());
      setLink(coachInviteUrl(code));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setOpen(false);
    setLink(null);
    setCoachName("");
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-panel-border py-3 text-sm font-semibold text-text active:scale-[0.99]"
      >
        Begeleider uitnodigen
      </button>
    );
  }

  return (
    <div className="panel space-y-3">
      <h2 className="text-xs uppercase tracking-wide text-muted">Begeleider uitnodigen</h2>
      {link ? (
        <>
          <p className="text-sm text-text">
            Stuur deze link naar {coachName || "de begeleider"}. Hij is 14 dagen geldig en werkt één keer.
          </p>
          <InviteLinkActions link={link} shareText={`Je bent uitgenodigd als begeleider in CapnoLog. Maak hier je account aan: ${link}`} onDone={reset} />
        </>
      ) : (
        <>
          <label className="block space-y-1.5">
            <span className="text-xs text-muted">Naam van de begeleider</span>
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
              disabled={busy || !coachName.trim()}
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
