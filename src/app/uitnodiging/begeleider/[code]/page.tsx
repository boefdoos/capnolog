"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Loading from "@/components/Loading";
import { acceptCoachInvite, getCoachInvite, type CoachInvite } from "@/lib/coachInvites";
import { useAuth } from "@/lib/useAuth";
import { useRole } from "@/lib/useRole";

const inputClass =
  "w-full rounded-lg border border-panel-border bg-[#0D1210] px-3.5 py-2.5 text-sm text-text outline-none focus:border-trace";
const primaryClass =
  "w-full rounded-lg bg-trace py-3.5 text-sm font-semibold text-[#06120B] active:scale-[0.99] disabled:opacity-50";

/**
 * Uitnodiging als begeleider. Zelfde opbouw als de uitnodiging voor een
 * cliënt: eigen account met eigen wachtwoord, of aanmelden met een bestaand
 * account. Na het aanvaarden meteen naar de uitleg.
 */
export default function CoachInvitePage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const { user, loading: authLoading, configured, error, signIn, signUp, logOut } = useAuth();
  const [invite, setInvite] = useState<CoachInvite | null | undefined>(undefined);
  const [mode, setMode] = useState<"choose" | "new" | "existing">("choose");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  // Foutcode van Firebase bij een mislukt aanvaarden, zichtbaar op het scherm
  // zodat een melding als "er gebeurt niets" te herleiden is.
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [autoAccept, setAutoAccept] = useState(false);

  useEffect(() => {
    if (!configured) return;
    getCoachInvite(code)
      .then((inv) => {
        setInvite(inv);
        if (inv) setName(inv.coachName);
      })
      .catch(() => setInvite(null));
  }, [code, configured]);

  const expired = invite ? Date.now() > invite.expiresAt : false;
  const used = invite ? invite.usedBy != null && invite.usedBy !== user?.uid : false;
  const alreadyMine = invite != null && user != null && invite.usedBy === user.uid;
  const role = useRole(user?.uid ?? null);

  async function accept(uid: string) {
    if (!invite) return;
    setAcceptError(null);
    try {
      await acceptCoachInvite(uid, invite, name.trim() || invite.coachName);
      router.push("/begeleiding/uitleg");
    } catch (err) {
      console.error("Begeleidersuitnodiging aanvaarden mislukt", err);
      setAcceptError((err as { code?: string })?.code ?? "onbekend");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "new") await signUp(email, password);
      else await signIn(email, password);
    } catch (err) {
      // Foutmelding zit al in de hook. Bestaat het adres al, dan meteen naar
      // aanmelden, met het adres ingevuld.
      if ((err as { code?: string })?.code === "auth/email-already-in-use") setMode("existing");
    } finally {
      setBusy(false);
    }
  }

  // Net aangemeld of geregistreerd via dit formulier: meteen aanvaarden.
  useEffect(() => {
    if (autoAccept && user && invite && !expired && !used && !alreadyMine && !role.loading && !role.isCoach && !role.coachRevoked) {
      setAutoAccept(false);
      void accept(user.uid);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAccept, user, invite, role.loading, role.isCoach, role.coachRevoked]);

  let body: React.ReactNode;
  if (!configured || invite === undefined || authLoading || (user && role.loading)) {
    body = <Loading />;
  } else if (invite === null) {
    body = <p className="text-sm text-text">Deze uitnodiging bestaat niet. Vraag een nieuwe link.</p>;
  } else if (alreadyMine) {
    body = (
      <>
        <p className="text-sm text-text">Je bent al begeleider.</p>
        <button onClick={() => router.push("/begeleiding")} className={primaryClass}>
          Naar Begeleiding
        </button>
      </>
    );
  } else if (expired || used) {
    body = (
      <p className="text-sm text-text">
        Deze uitnodiging is {expired ? "verlopen" : "al gebruikt"}. Vraag een nieuwe link.
      </p>
    );
  } else if (user && role.coachRevoked) {
    body = (
      <>
        <p className="text-sm text-text">
          Je bent aangemeld als {user.email}, en de rol als begeleider van dat account is ingetrokken. Een nieuwe
          uitnodiging geeft die rol niet terug, dat kan enkel de beheerder.
        </p>
        <button onClick={() => logOut()} className={primaryClass}>
          Ander account gebruiken
        </button>
      </>
    );
  } else if (user && role.isCoach) {
    // Al begeleider of admin: een tweede rol op hetzelfde account heeft geen
    // zin, en de regels zouden het weigeren (coaches/{uid} bestaat al).
    body = (
      <>
        <p className="text-sm text-text">
          Je bent aangemeld als {user.email}, en dat account is al begeleider. Wil je met een ander account
          begeleider worden, meld je dan eerst af.
        </p>
        <button onClick={() => logOut()} className={primaryClass}>
          Ander account gebruiken
        </button>
      </>
    );
  } else if (user) {
    body = (
      <>
        <p className="text-sm text-muted">Aangemeld als {user.email}.</p>
        <label className="block space-y-1.5">
          <span className="text-xs text-muted">Je naam, zoals cliënten die zien</span>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        {acceptError && <p className="text-xs text-danger">Aanvaarden mislukt ({acceptError}), probeer opnieuw.</p>}
        <button onClick={() => accept(user.uid)} disabled={!name.trim()} className={primaryClass}>
          Aanvaarden
        </button>
        <button
          onClick={() => logOut()}
          className="w-full text-xs text-muted underline decoration-panel-border underline-offset-2"
        >
          Ander account gebruiken
        </button>
      </>
    );
  } else if (mode === "choose") {
    body = (
      <>
        <p className="text-sm text-text">Heb je al een CapnoLog-account?</p>
        <button onClick={() => setMode("existing")} className={primaryClass}>
          Ja, aanmelden
        </button>
        <button
          onClick={() => setMode("new")}
          className="w-full rounded-lg border border-panel-border py-3.5 text-sm font-semibold text-text active:scale-[0.99]"
        >
          Nee, account aanmaken
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
            <span className="text-xs text-muted">Je naam, zoals cliënten die zien</span>
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
        {acceptError && <p className="text-xs text-danger">Aanvaarden mislukt ({acceptError}), probeer opnieuw.</p>}
        <button type="submit" disabled={busy} className={primaryClass}>
          {busy ? "..." : mode === "new" ? "Account aanmaken" : "Aanmelden en aanvaarden"}
        </button>
        <button
          type="button"
          onClick={() => setMode("choose")}
          className="w-full text-xs text-muted underline decoration-panel-border underline-offset-2"
        >
          Terug
        </button>
      </form>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-5 p-6">
      <div>
        <div className="text-lg font-semibold tracking-wide text-text">CapnoLog</div>
        {invite && !expired && !used && (
          <p className="mt-2 text-sm text-text">
            Je bent uitgenodigd als begeleider. Je kunt daarna cliënten uitnodigen en hun metingen lezen, maar
            niets wijzigen. Een cliënt geeft zelf toegang en kan die altijd intrekken.
          </p>
        )}
      </div>
      {body}
    </div>
  );
}
