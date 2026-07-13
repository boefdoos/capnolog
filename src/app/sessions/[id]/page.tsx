"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import AuthGate from "@/components/AuthGate";
import Co2Chart from "@/components/Co2Chart";
import EntryTable from "@/components/EntryTable";
import StatsRow from "@/components/StatsRow";
import { useSessionDetail } from "@/lib/useSessionDetail";
import { exportSessionCsv } from "@/lib/exportCsv";
import { deleteSessionCompletely } from "@/lib/sessionActions";
import { FEELING_LABELS } from "@/types/capnolog";

function SessionDetailInner({ uid, sessionId }: { uid: string; sessionId: string }) {
  const { meta, entries, loading } = useSessionDetail(uid, sessionId);
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    const ok = window.confirm(
      "Deze sessie en alle metingen erin definitief verwijderen? Dit kan niet ongedaan gemaakt worden."
    );
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteSessionCompletely(uid, sessionId);
      router.push("/sessions");
    } catch {
      setDeleting(false);
      window.alert("Verwijderen mislukt, probeer opnieuw.");
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-4 pb-10">
      <header className="mb-4 flex items-end justify-between border-b border-panel-border pb-3.5">
        <div>
          <Link href="/sessions" className="text-xs text-muted underline decoration-panel-border underline-offset-2 hover:text-text">
            &lsaquo; Geschiedenis
          </Link>
          <h1 className="mt-1 text-[19px] font-semibold tracking-wide">
            {meta ? new Date(meta.createdAt).toLocaleString("nl-BE") : "..."}
          </h1>
          {meta?.feeling && (
            <div className="mt-1 inline-block rounded-md border border-panel-border px-2 py-0.5 text-[11px] text-muted">
              {FEELING_LABELS[meta.feeling]}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {entries.length > 0 && (
            <button onClick={() => exportSessionCsv(entries)} className="text-xs text-muted hover:text-text">
              Exporteer CSV
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs text-danger hover:underline disabled:opacity-50"
          >
            {deleting ? "bezig..." : "Verwijder sessie"}
          </button>
        </div>
      </header>

      {loading && <div className="py-6 text-center text-xs text-muted">...</div>}

      {!loading && (
        <div className="space-y-3.5">
          <div className="panel">
            <Co2Chart entries={entries} bandLow={meta?.bandLow ?? 3.8} bandHigh={meta?.bandHigh ?? 4.9} />
          </div>
          <div className="panel">
            <StatsRow entries={entries} />
          </div>
          <div className="panel">
            <h2 className="mb-2.5 text-[13px] font-semibold uppercase tracking-wide text-muted">Log</h2>
            <EntryTable entries={entries} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function SessionDetailPage() {
  const params = useParams<{ id: string }>();
  return <AuthGate>{(user) => <SessionDetailInner uid={user.uid} sessionId={params.id} />}</AuthGate>;
}
