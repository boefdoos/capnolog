"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { acceptInvite, getInvite, type Invite } from "@/lib/invites";
import { useAuth } from "@/lib/useAuth";

const inputClass =
  "w-full rounded-lg border border-panel-border bg-[#0D1210] px-3.5 py-2.5 text-sm text-text outline-none focus:border-trace";
const primaryClass =
  "w-full rounded-lg bg-trace py-3.5 text-sm font-semibold text-[#06120B] active:scale-[0.99] disabled:opacity-50";

/**
 * Uitnodigingspagina (P13). De cliënt maakt hier zelf een account aan met een
 * eigen wachtwoord, of meldt zich aan met een bestaand account, en aanvaardt
 * dan dat de begeleider mag meelezen. Staat bewust buiten AuthGate: wie de
 * link opent, heeft meestal nog geen account.
 */
export default function InvitePage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const { user, loading: authLoading, configured, error, signIn, signUp, logOut } = useAuth();
  const [invite, setInvite] = useState<Invite | null | undefined>(undefined);
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [acceptFailed, setAcceptFailed] = useState(false);

  useEffect(() => {
    if (!configured) return;
    getInvite(code)
      .then((inv) => {
        setInvite(inv);
        if (inv) setName(inv.clientName);
      })
      .catch(() => setInvite(null));
  }, [code, configured]);

  const expired = invite ? Date.now() > invite.expiresAt : false;
  const used = invite ? invite.usedBy != null && invite.usedBy !== user?.uid : false;
  const alreadyMine = invite != null && user != null && invite.usedBy === user.uid;
  const ownInvite = invite != null && user != null && invite.coachUid === user.uid;

  async function accept(uid: string) {
    if (!invite) return;
    setAcceptFailed(false);
    try {
      await acceptInvite(uid, invite, name.trim() || invite.clientName);
      router.push("/");
    } catch {
      setAcceptFailed(true);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "new") await signUp(email, password);
      else await signIn(email, password);
      // De koppeling volgt in de effect hieronder, zodra `user` bekend is.
    } catch {
      // foutmelding zit al in de hook
    } finally {
      setBusy(false);
    }
  }

  // Net aangemeld of geregistreerd via dit formulier: meteen koppelen.
  const [autoAccept, setAutoAccept] = useState(false);
  useEffect(() => {
    if (autoAccept && user && invite && !expired && !used && !ownInvite && !alreadyMine) {
      setAutoAccept(false);
      void accept(user.uid);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAccept, user, invite]);

  let body: React.ReactNode;
  if (!configured || invite === undefined || authLoading) {
    body = <p className="text-center text-sm text-muted">...</p>;
  } else if (invite === null) {
    body = <p className="text-sm text-text">Deze uitnodiging bestaat niet. Vraag je begeleider om een nieuwe link.</p>;
  } else if (alreadyMine) {
    body = (
      <>
        <p className="text-sm text-text">Je bent al gekoppeld aan {invite.coachName}.</p>
        <button onClick={() => router.push("/")} className={primaryClass}>
          Naar CapnoLog
        </button>
      </>
    );
  } else if (expired || used) {
    body = (
      <p className="text-sm text-text">
        Deze uitnodiging is {expired ? "verlopen" : "al gebruikt"}. Vraag {invite.coachName} om een nieuwe link.
      </p>
    );
  } else if (ownInvite) {
    body = (
      <p className="text-sm text-text">
        Dit is je eigen uitnodiging. Stuur de link naar {invite.clientName || "je cliënt"}.
      </p>
    );
  } else if (user) {
    body = (
      <>
        <p className="text-sm text-muted">Aangemeld als {user.email}.</p>
        <label className="block space-y-1.5">
          <span className="text-xs text-muted">Je naam</span>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        {acceptFailed && <p className="text-xs text-danger">Koppelen mislukt, probeer opnieuw.</p>}
        <button onClick={() => accept(user.uid)} disabled={!name.trim()} className={primaryClass}>
          Akkoord, koppel met {invite.coachName}
        </button>
        <button
          onClick={() => logOut()}
          className="w-full text-xs text-muted underline decoration-panel-border underline-offset-2"
        >
          Ander account gebruiken
        </button>
      </>
    );
  } else {
    body = (
      <form
        onSubmit={(e) => {
          setAutoAccept(true);
          void submit(e);
        }}
        className="space-y-3"
      >
        {mode === "new" && (
          <label className="block space-y-1.5">
            <span className="text-xs text-muted">Je naam</span>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
        )}
        <label className="block space-y-1.5">
          <span className="text-xs text-muted">E-mail</span>
          <input
            className={inputClass}
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs text-muted">{mode === "new" ? "Kies een wachtwoord (minstens 6 tekens)" : "Wachtwoord"}</span>
          <input
            className={inputClass}
            type="password"
            autoComplete={mode === "new" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <p className="text-xs text-danger">{error}</p>}
        {acceptFailed && <p className="text-xs text-danger">Koppelen mislukt, probeer opnieuw.</p>}
        <button type="submit" disabled={busy} className={primaryClass}>
          {busy ? "..." : mode === "new" ? "Account aanmaken" : "Aanmelden en koppelen"}
        </button>
        <button
          type="button"
          onClick={() => setMode(mode === "new" ? "existing" : "new")}
          className="w-full text-xs text-muted underline decoration-panel-border underline-offset-2"
        >
          {mode === "new" ? "Ik heb al een account" : "Nieuw account aanmaken"}
        </button>
      </form>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-5 p-6">
      <div>
        <div className="text-lg font-semibold tracking-wide text-text">CapnoLog</div>
        {invite && !expired && !used && !ownInvite && (
          <p className="mt-2 text-sm text-text">
            {invite.coachName} nodigt je uit. {invite.coachName} kan je metingen lezen, maar niets wijzigen. Je kunt
            die toegang altijd intrekken onder Account.
          </p>
        )}
      </div>
      {body}
    </div>
  );
}
