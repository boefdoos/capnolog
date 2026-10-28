/**
 * Toestemmingsteksten met versie (P16, docs/plan_gegevensverwerking.md). De
 * exacte tekst die een cliënt aanvaardde, komt mee in het record, zodat ze
 * later aantoonbaar blijft, ook nadat ze hier gewijzigd is. Wijzig je een
 * tekst inhoudelijk, verhoog dan de versie.
 */
export const CONSENT_TEXT_VERSION = "2026-10-28";

export type ConsentKind = "begeleiding" | "analyse";

export function begeleidingText(coachName: string): string {
  return `${coachName} kan je metingen lezen, maar niets wijzigen. Je kunt die toegang altijd intrekken onder Account.`;
}
