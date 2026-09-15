# CapnoLog

ETCO2-sessielogger voor de Masimo EMMA capnograaf, gebouwd rond het CART-protocol
(capnometry-assisted respiratory training). Persoonlijk instrument van Thomas, in
ontwikkeling richting gebruik met cliënten in een begeleidingsprogramma.

## Stack en commando's

Next.js 14 (App Router), TypeScript, Tailwind 3, Firebase (Auth + Firestore), Chart.js 4.
PWA, geoptimaliseerd voor telefoon en tablet.

```bash
npm run dev      # lokaal draaien
npx next build   # buildcheck, moet slagen voor een push
npm run lint
```

Deployment via Vercel op elke push naar `main`. Firebase-config staat in `.env.local`
(zie `.env.example`), nooit committen.

## Datamodel

`users/{uid}/sessions/{sessionId}` met metadata en aggregaten, subcollectie
`entries/{entryId}` met `type` ("reading" | "marker" | "sigh"), `subtype`, `tSec`, `kpa`.

`idx`, `delta`, `mmHg` en `rr` worden client-side afgeleid in `deriveEntries`
(`src/lib/format.ts`) en worden nooit opgeslagen. Aggregaten (`readingCount`, `kpaSum`,
`kpaSumSq`) worden incrementeel bijgewerkt bij elke log.

Protocolinstellingen: `users/{uid}/settings/protocol`.

Meetbereik: 0,0 tot 9,9 kPa, het effectieve displaybereik van de EMMA (kPa-versie).
Dat is een toestelgrens, geen klinische drempel.

## Schrijfwijze

Belgisch Nederlands in alle UI-tekst, commentaar en commits. Kinesitherapeut, NKO-arts,
maag-darmklachten. Geen em-dash, gebruik een komma of een punt. Nederlandse
codecommentaar mag, Engelse identifiers zijn de norm.

## Bewuste ontwerpkeuzes, niet "opruimen"

**Terughoudende UI.** Overmatige tracking kan rumineren aanwakkeren bij deze
aandoening, dat is bij een eerder project van Thomas al gebleken. Geen countdowns,
geen rode stippen, geen "gemiste sessie"-status, geen badges die tot dagelijks
controleren aanzetten. Elke toevoeging die de gebruiker vaker naar een cijfer laat
kijken, moet die kost verantwoorden. Bij twijfel: vragen, niet toevoegen.

**De zelfherstellende backfill** in `useAverages` (`backfillSessionAggregates`) repareert
sessies van voor `kpaSum` en `kpaSumSq` bestonden. Niet weghalen.

**De auto-decimaal invoer** in `formatDigits`: "42" wordt "4.2". Dat is er zodat er
eenhandig gelogd kan worden zonder decimaaltoets, tijdens een ademoefening. Niet
vervangen door een gewoon getalveld.

**De eigen klok in `useCartProtocol`** (interval van 60 seconden) staat er omdat de
weekberekening anders blijft hangen wanneer de app dagenlang openstaat.

## Werkdocumenten

`docs/codeinstructies.md` bevat de volledige codereview met genummerde werkpunten
P1 tot P11, per punt de bestandsverwijzing en de bewijsbasis. Lees dat voor je aan
een van die punten begint, en werk het bij wanneer een punt af is.

`docs/plan_post_trial_rustcontroles.md` is het oorspronkelijke plan voor de
rustcontroles (werkpunt P1). Inhoudelijk nog geldig, alleen nog niet gebouwd.

## Git

Kleine commits per afgerond punt. Commitboodschap in het Nederlands, eerste regel
kort en beschrijvend. Verwijs naar het werkpunt waar dat past, bijvoorbeeld
"P1: sessionType toevoegen aan sessiedocument".

Nooit `.env.local` of Firebase-sleutels committen.
