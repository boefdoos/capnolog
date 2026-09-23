"use client";

import Link from "next/link";
import AuthGate from "@/components/AuthGate";
import TabBar from "@/components/TabBar";
import { useCoachClients } from "@/lib/useCoachClients";

function ClientsInner({ uid }: { uid: string }) {
  const { clients, loading } = useCoachClients(uid);

  return (
    <div className="mx-auto max-w-2xl p-4 pb-10">
      <header className="mb-4 flex items-end justify-between border-b border-panel-border pb-3.5">
        <div>
          <h1 className="text-[19px] font-semibold tracking-wide">Begeleiding</h1>
          <p className="text-[12.5px] text-muted">Cliënten, alleen-lezen</p>
        </div>
      </header>

      {loading && <div className="py-6 text-center text-xs text-muted">...</div>}
      {!loading && !clients.length && (
        <div className="py-6 text-center text-xs text-muted">Nog geen cliënten die toegang gaven.</div>
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
      <TabBar uid={uid} />
    </div>
  );
}

export default function BegeleidingPage() {
  return <AuthGate>{(user) => <ClientsInner uid={user.uid} />}</AuthGate>;
}
