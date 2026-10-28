"use client";

import { doc, getDoc } from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Loading from "@/components/Loading";
import { begeleidingText } from "@/lib/consentTexts";
import { getFirebaseDb } from "@/lib/firebase";
import { acceptInvite, getInvite, type Invite } from "@/lib/invites";
import { useAuth } from "@/lib/useAuth";
import { useRole } from "@/lib/useRole";

const inputClass =
  "w-full rounded-lg border border-panel-border bg-[#0D1210] px-3.5 py-2.5 text-sm text-text outline-none focus:border-trace";
const primaryClass =
  "w-full rounded-lg bg-trace py-3.5 text-sm font-semibold text-[#06120B] active:scale-[0.99] disabled:opacity-50";
const secondaryClass =
  "w-full rounded-lg border border-panel-border py-3.5 text-sm font-semibold text-text active:scale-[0.99]";
const linkClass = "w-full text-xs text-muted underline decoration-panel-border underline-offset-2";

/** Wat van het eigen account nodig is: de naam, en aan wie het al gekoppeld is. */
interface OwnProfile {
  displayName: string | null;
  coachUids: string[];
}

/**
 * Uitnodigingspagina (P13). Eerst de vraag of je al een account hebt, dan
 * aanmelden of een account aanmaken, en daarna altijd het scherm met de
 * toestemmingstekst en "Akkoord" (nooit automatisch koppelen, P16). Een
 * bestaand account met een naam krijgt geen naamveld: de naam die de
 * begeleider bij de uitnodiging typte, zou anders de eigen naam overschrijven.
 * Een begeleider kan geen cliëntuitnodiging aanvaarden (ook in de regels).
 * Staat bewust buiten AuthGate: wie de link opent, heeft vaak nog geen account.
 */
export default function InvitePage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const { user, loading: authLoading, configured, error, signIn, signUp, logOut } = useAuth();
  const role = useRole(user?.uid ?? null);
  const [invite, setInvite] = useState<Invite | null | undefined>(undefined);
  const [profile, setProfile] = useState<OwnProfile | null | undefined>(undefined);
  const [mode, setMode] = useState<"choose" | "new" | "existing">("choose");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  // Net hier een account aangemaakt: de naam staat al in `name`, dus geen
  // tweede naamveld op het toestemmingsscherm.
  const [createdHere, setCreatedHere] = useState(false);
  // Foutcode van Firebase bij een mislukte koppeling, zichtbaar op het scherm.
  const [acceptError, setAcceptError] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) return;
    getInvite(code)
      .then((inv) => {
        setInvite(inv);
        if (inv) setName(inv.clientName);
      })
      .catch(() => setInvite(null));
  }, [code, configured]);

  useEffect(() => {
    if (!user) {
      setProfile(undefined);
      return;
    }
    getDoc(doc(getFirebaseDb(), "users", user.uid))
      .then((snap) => {
        const data = snap.data();
        setProfile({
          displayName: (data?.displayName as string | undefined) || null,
          coachUids: (data?.coachUids as string[] | undefined) ?? [],
        });
      })
      .catch(() => setProfile({ displayName: null, coachUids: [] }));
  }, [user]);

  const expired = invite ? Date.now() > invite.expiresAt : false;
  const used = invite ? invite.usedBy != null && invite.usedBy !== user?.uid : false;
  const alreadyMine = invite != null && user != null && invite.usedBy === user.uid;
  const ownInvite = invite != null && user != null && invite.coachUid === user.uid;
  const alreadyLinked = invite != null && profile != null && profile.coachUids.includes(invite.coachUid);
  const isCoachAccount = user != null && (role.isCoach || role.coachRevoked);
  const knownName = profile?.displayName ?? null;

  async function accept(uid: string) {
    if (!invite) return;
    setAcceptError(null);
    try {
      await acceptInvite(uid, invite, knownName ?? (name.trim() || invite.clientName));
      router.push("/");
    } catch (err) {
      console.error("Uitnodiging aanvaarden mislukt", err);
      setAcceptError((err as { code?: string })?.code ?? "onbekend");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "new") {
        await signUp(email, password);
        setCreatedHere(true);
      } else await signIn(email, password);
      // Daarna toont de pagina het toestemmingsscherm: koppelen gebeurt pas
      // na een tik op "Akkoord", nooit automatisch.
    } catch (err) {
      // Foutmelding zit al in de hook. Bestaat het adres al, dan meteen naar
      // aanmelden, met het adres ingevuld.
      if ((err as { code?: string })?.code === "auth/email-already-in-use") setMode("existing");
    } finally {
      setBusy(false);
    }
  }

  let body: React.ReactNode;
  // Zichtbaar bovenaan zolang de uitnodiging voor dit account bruikbaar is.
  let showConsentText = false;

  if (!configured || invite === undefined || authLoading || (user && (role.loading || profile === undefined))) {
    body = <Loading />;
  } else if (invite === null) {
    body = <p className="text-sm text-text">Deze uitnodiging bestaat niet. Vraag je begeleider om een nieuwe link.</p>;
  } else if (alreadyMine || (alreadyLinked && !ownInvite)) {
    body = (
      <>
        <p className="text-sm text-text">Je bent al gekoppeld aan {invite.coachName}. Je hoeft niets meer te doen.</p>
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
  } else if (user && isCoachAccount) {
    body = (
      <>
        <p className="text-sm text-text">
          Dit is een uitnodiging voor een cliënt. Je bent aangemeld als {user.email}, en dat account is begeleider.
          De uitnodiging blijft geldig voor de cliënt voor wie ze bedoeld is.
        </p>
        <button onClick={() => logOut()} className={secondaryClass}>
          Ander account gebruiken
        </button>
      </>
    );
  } else if (user) {
    showConsentText = true;
    body = (
      <>
        <p className="text-sm text-muted">
          Aangemeld als {knownName ? `${knownName} (${user.email})` : user.email}.
        </p>
        {!knownName && !createdHere && (
          <label className="block space-y-1.5">
            <span className="text-xs text-muted">Je naam</span>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        )}
        {acceptError && <p className="text-xs text-danger">Koppelen mislukt ({acceptError}), probeer opnieuw.</p>}
        <button onClick={() => accept(user.uid)} disabled={!knownName && !name.trim()} className={primaryClass}>
          Akkoord, koppel met {invite.coachName}
        </button>
        <button onClick={() => logOut()} className={linkClass}>
          Ander account gebruiken
        </button>
      </>
    );
  } else if (mode === "choose") {
    showConsentText = true;
    body = (
      <>
        <p className="text-sm text-text">Heb je al een CapnoLog-account?</p>
        <button onClick={() => setMode("existing")} className={primaryClass}>
          Ja, aanmelden
        </button>
        <button onClick={() => setMode("new")} className={secondaryClass}>
          Nee, account aanmaken
        </button>
      </>
    );
  } else {
    showConsentText = true;
    body = (
      <form onSubmit={submit} className="space-y-3">
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
        <button type="submit" disabled={busy} className={primaryClass}>
          {busy ? "..." : mode === "new" ? "Account aanmaken" : "Aanmelden"}
        </button>
        <button type="button" onClick={() => setMode("choose")} className={linkClass}>
          Terug
        </button>
      </form>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-5 p-6">
      <div>
        <div className="text-lg font-semibold tracking-wide text-text">CapnoLog</div>
        {invite && showConsentText && (
          <p className="mt-2 text-sm text-text">
            {invite.coachName} nodigt je uit. {begeleidingText(invite.coachName)}
          </p>
        )}
      </div>
      {body}
    </div>
  );
}
