/**
 * Vaste balk op elk begeleidingsscherm (P13): de kaarten en grafieken zijn
 * dezelfde als op het eigen beginscherm, dus zonder deze balk ziet cliëntdata
 * er niet anders uit dan je eigen data.
 */
export default function BegeleidingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="sticky top-0 z-10 border-b border-amber bg-[#1A1508] px-4 py-2 text-center text-xs font-semibold text-amber">
        Begeleidersweergave &middot; alleen-lezen &middot; niet je eigen gegevens
      </div>
      {children}
    </>
  );
}
