"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCoachClients } from "@/lib/useCoachClients";

const ICONS: Record<string, JSX.Element> = {
  vandaag: <circle cx="12" cy="12" r="4.5" />,
  traject: <path d="M4 18h4l3-12h2l3 12h4" />,
  geschiedenis: <path d="M5 7h14M5 12h14M5 17h9" />,
  account: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 19.5c1-3.3 3.7-5 7-5s6 1.7 7 5" />
    </>
  ),
  begeleiding: (
    <>
      <circle cx="9" cy="9" r="3" />
      <path d="M3.5 19c.8-3 3-4.5 5.5-4.5s4.7 1.5 5.5 4.5M16 7.5a2.5 2.5 0 110 5M17.5 14.8c1.6.5 2.6 1.9 3 4.2" />
    </>
  ),
};

/**
 * Vaste tabbalk onderaan de hoofdschermen. Niet tonen tijdens een sessie of
 * meting: één tik zou de oefening verlaten (docs/ui_doorlichting.md S7).
 * Begeleiding verschijnt enkel voor wie cliënten heeft (P13).
 */
export default function TabBar({ uid }: { uid: string }) {
  const pathname = usePathname();
  const { clients } = useCoachClients(uid);

  const tabs = [
    { key: "vandaag", href: "/", label: "Vandaag", active: pathname === "/" },
    { key: "traject", href: "/traject", label: "Traject", active: pathname.startsWith("/traject") },
    { key: "geschiedenis", href: "/sessions", label: "Geschiedenis", active: pathname.startsWith("/sessions") },
    ...(clients.length > 0
      ? [{ key: "begeleiding", href: "/begeleiding", label: "Begeleiding", active: pathname.startsWith("/begeleiding") }]
      : []),
    { key: "account", href: "/account", label: "Account", active: pathname.startsWith("/account") },
  ];

  return (
    <>
      {/* Ruimte zodat de laatste inhoud niet achter de balk verdwijnt. */}
      <div aria-hidden className="h-20" />
      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-panel-border bg-[#0A0E0D]/95 backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex max-w-2xl">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={t.href}
              prefetch={false}
              aria-current={t.active ? "page" : undefined}
              className={
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-semibold " +
                (t.active ? "text-trace" : "text-muted hover:text-text")
              }
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {ICONS[t.key]}
              </svg>
              {t.label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
