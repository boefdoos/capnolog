"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import AuthGate from "@/components/AuthGate";
import TabBar from "@/components/TabBar";
import TrajectOverview from "@/components/TrajectOverview";
import { fmtTime } from "@/lib/format";
import { useAverages } from "@/lib/useAverages";
import { useCartProtocol } from "@/lib/useCartProtocol";
import { useClientName } from "@/lib/useCoachClients";
import { useSessionsList } from "@/lib/useSessionsList";
import { SESSION_TYPE_LABELS } from "@/types/capnolog";


/**
 * Overzicht van één cliënt voor de begeleider (P13). Uitdrukkelijk
 * alleen-lezen: geen verwijderknoppen, geen protocolstart, geen backfill.
 */
function ClientInner({ coachUid, clientUid }: { coachUid: string; clientUid: string }) {
  const { band, trendAll, sessions: allSessions } = useAverages(clientUid, { readOnly: true });
  const { startDate, nulmetingBaseline } = useCartProtocol(clientUid);
  const { sessions, loading } = useSessionsList(clientUid);
  const clientName = useClientName(clientUid);

  return (
    <div className="mx-auto max-w-2xl p-4 pb-10">
      <header className="mb-4 flex items-end justify-between border-b border-panel-border pb-3.5">
        <div>
          <Link href="/begeleiding" prefetch={false} className="text-xs text-muted underline decoration-panel-border underline-offset-2 hover:text-text">
            &lsaquo; Cliënten
          </Link>
          <h1 className="mt-1 text-[19px] font-semibold tracking-wide">{clientName}</h1>
        </div>
      </header>

      <div className="space-y-3.5">
        <TrajectOverview
          startDate={startDate}
          sessions={allSessions}
          nulmetingBaseline={nulmetingBaseline}
          trend={trendAll}
          band={band}
        />

        {loading && <div className="py-6 text-center text-xs text-muted">...</div>}
        <div className="space-y-2">
          {sessions.map((s) => {
            const avgKpa = s.readingCount > 0 ? s.kpaSum / s.readingCount : null;
            return (
              <Link
                key={s.id}
                href={`/begeleiding/${clientUid}/${s.id}`}
                prefetch={false}
                className="panel flex items-center justify-between gap-3 text-sm hover:border-trace"
              >
                <span className="text-text">
                  {new Date(s.createdAt).toLocaleDateString("nl-BE", { day: "numeric", month: "short" })}{" "}
                  <span className="text-muted">
                    {new Date(s.createdAt).toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" })}
                    {" · "}
                    {SESSION_TYPE_LABELS[s.sessionType]}
                  </span>
                </span>
                <span className="font-mono text-xs text-muted">
                  {avgKpa != null ? `${avgKpa.toFixed(1)} kPa` : "—"} &middot; {fmtTime(s.lastTSec)}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
      <TabBar uid={coachUid} />
    </div>
  );
}

export default function ClientPage() {
  const params = useParams<{ clientUid: string }>();
  return <AuthGate>{(user) => <ClientInner coachUid={user.uid} clientUid={params.clientUid} />}</AuthGate>;
}
