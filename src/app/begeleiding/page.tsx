"use client";

import Link from "next/link";
import AuthGate from "@/components/AuthGate";
import InviteClient from "@/components/InviteClient";
import TabBar from "@/components/TabBar";
import { useCoachClients } from "@/lib/useCoachClients";
import { useRole } from "@/lib/useRole";
import Loading from "@/components/Loading";

function ClientsInner({ uid }: { uid: string }) {
  const { clients, loading } = useCoachClients(uid);
  const { isCoach } = useRole(uid);

  return (
    <div className="mx-auto max-w-2xl p-4 pb-10">
      <header className="mb-4 flex items-end justify-between border-b border-panel-border pb-3.5">
        <div>
          <h1 className="text-[19px] font-semibold tracking-wide">Begeleiding</h1>
          <p className="text-[12.5px] text-muted">Cliënten, alleen-lezen</p>
        </div>
        <Link
          href="/begeleiding/uitleg"
          prefetch={false}
          className="text-xs text-muted underline decoration-panel-border underline-offset-2 hover:text-text"
        >
          Uitleg
        </Link>
      </header>

      {loading && <Loading />}
      {!loading && !clients.length && (
        <div className="panel space-y-2 text-sm text-text">
          <p>Nog geen cliënten die toegang gaven.</p>
          <p className="text-xs text-muted">
            Nieuw als begeleider? Lees eerst de{" "}
            <Link href="/begeleiding/uitleg" prefetch={false} className="text-text underline underline-offset-2">
              uitleg
            </Link>
            , en nodig daarna hieronder een cliënt uit.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {clients.map((c) => (
          <Link
            key={c.uid}
            href={`/begeleiding/${c.uid}`}
            prefetch={false}
            className="panel block text-sm text-text hover:border-trace"
          >
            {c.name}
          </Link>
        ))}
      </div>

      {isCoach && (
        <div className="mt-6">
          <InviteClient coachUid={uid} />
        </div>
      )}
      <TabBar uid={uid} />
    </div>
  );
}

export default function BegeleidingPage() {
  return <AuthGate>{(user) => <ClientsInner uid={user.uid} />}</AuthGate>;
}
