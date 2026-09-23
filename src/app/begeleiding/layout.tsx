/**
 * Vaste balk op elk begeleidingsscherm (P13). Dat het om cliëntdata gaat,
 * blijkt uit de lijst per naam en de naam als titel; de balk zegt enkel in
 * welke modus je zit.
 */
export default function BegeleidingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="sticky top-0 z-10 border-b border-amber bg-[#1A1508] px-4 py-2 text-center text-xs font-semibold text-amber">
        Begeleidersweergave &middot; alleen-lezen
      </div>
      {children}
    </>
  );
}
