"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import AuthGate from "@/components/AuthGate";
import AveragesCard from "@/components/AveragesCard";
import TrendChart from "@/components/TrendChart";
import { fmtTime } from "@/lib/format";
import { computeNulmetingSummary, useAverages } from "@/lib/useAverages";
import { useCartProtocol } from "@/lib/useCartProtocol";
import { useClientName } from "@/lib/useCoachClients";
import { useSessionsList } from "@/lib/useSessionsList";
import { NULMETING_TARGET_SESSIONS, type SessionType } from "@/types/capnolog";

const TYPE_LABELS: Record<SessionType, string> = {
  cart: "CART",
  rustcontrole: "Rustcontrole",
  nulmeting: "Nulmeting",
};

/**
 * Overzicht van één cliënt voor de begeleider (P13). Uitdrukkelijk
 * alleen-lezen: geen verwijderknoppen, geen protocolstart, geen backfill.
 */
function ClientInner({ clientUid }: { clientUid: string }) {
  const { week, month, band, trend, sessions: allSessions } = useAverages(clientUid, { readOnly: true });
  const { target, nulmetingBaseline } = useCartProtocol(clientUid);
  const { sessions, loading } = useSessionsList(clientUid);
  const nulmetingNow = computeNulmetingSummary(allSessions);
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
        <div className="panel text-xs text-muted">
          {target ? (
            <>
              CART-protocol: week {target.week} &middot; doel {target.targetRR}/min
            </>
          ) : (
            <>
              Protocol nog niet gestart &middot; nulmeting {nulmetingNow?.sessionCount ?? 0} van{" "}
              {NULMETING_TARGET_SESSIONS} metingen
            </>
          )}
          {nulmetingBaseline && (
            <div className="mt-1">
              Nulmeting (bevroren):{" "}
              <span className="font-mono text-text">
                {nulmetingBaseline.meanKpa.toFixed(2)} &plusmn; {nulmetingBaseline.sdKpa.toFixed(2)} kPa
              </span>{" "}
              &middot; {nulmetingBaseline.sessionCount} metingen, {nulmetingBaseline.readingCount} waarden
            </div>
          )}
        </div>

        <AveragesCard week={week} month={month} />
        <TrendChart trend={trend} band={band} nulmetingMeanKpa={nulmetingBaseline?.meanKpa ?? null} />

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
                    {TYPE_LABELS[s.sessionType]}
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
    </div>
  );
}

export default function ClientPage() {
  const params = useParams<{ clientUid: string }>();
  return <AuthGate>{() => <ClientInner clientUid={params.clientUid} />}</AuthGate>;
}
