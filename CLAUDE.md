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

Geen testsuite aanwezig, `npx next build` is de enige geautomatiseerde validatie-gate.

Deployment via Vercel op elke push naar `main`. Firebase-config staat in `.env.local`
(zie `.env.example`), nooit committen.

## Datamodel

`users/{uid}/sessions/{sessionId}` met metadata en aggregaten, subcollectie
`entries/{entryId}` met `type` ("reading" | "rr", en in oudere sessies ook "marker" en "sigh", die sinds 24/09 niet meer gelogd worden), `subtype`, `tSec`, `kpa`.

`idx`, `delta`, `mmHg` en `rr` worden client-side afgeleid in `deriveEntries`
(`src/lib/format.ts`) en worden nooit opgeslagen. Aggregaten (`readingCount`, `kpaSum`,
`kpaSumSq`) worden incrementeel bijgewerkt bij elke log.

Protocolinstellingen: `users/{uid}/settings/protocol`.

Meetbereik: 0,0 tot 9,9 kPa, het effectieve displaybereik van de EMMA (kPa-versie).
Dat is een toestelgrens, geen klinische drempel.

## Architectuur

**Auth en dataroute.** `AuthGate` (`src/components/AuthGate.tsx`) gate't de hele app
en geeft de Firebase `User` door aan zijn children; verder is er geen context/store,
`uid` wordt gewoon doorgegeven aan elke hook. Aanmelden is e-mail/wachtwoord via
`useAuth`, niet Google zoals de (verouderde) README nog beschrijft. `src/lib/firebase.ts`
initialiseert de Firebase-app lazy en uitsluitend client-side (`ensureApp` gooit een
fout server-side), zodat `next build` niet struikelt over ontbrekende env-vars van een
nog niet aangemaakt Firebase-project.

**Sessielevenscyclus.** Een sessiedocument ontstaat pas bij de eerste log
(`ensureSession` in `src/lib/useActiveSession.ts`), niet bij het openen van het
scherm, maar met als `createdAt` het moment van de tik op Start (`begin`), dus `tSec` telt
vanaf die tik en de eerste waarde valt typisch rond 60 s. `readingCount`/`kpaSum`/
`kpaSumSq`/`lastTSec` op het sessiedocument worden per log incrementeel bijgewerkt
(`increment(...)`) en bij het verwijderen van een entry weer teruggedraaid: dat zijn
de opgeslagen aggregaten waarop week-, maand- en referentiebandberekeningen steunen.
Het sessiedocument zelf wordt na aanmaak niet live gesynct (enkel de
`entries`-subcollectie via `onSnapshot`), dus `setFeeling` houdt de lokale
`meta`-state er handmatig mee in sync.

**CART-protocol en rustcontroles.** `useCartProtocol` bewaart één datum
(`cartProtocolStartDate` in `settings/protocol`) waaruit het gegradueerde weekdoel
volgt (13/11/9/6 ademhalingen per minuut, week 1 tot 4, verzadigt op week 4). Diezelfde
startdatum drijft, via `computeRustcontroleSchedule` (`src/lib/useRustcontrole.ts`), de
vijf rustcontrolemomenten na het 28-dagen-protocol (+1 week, +1 maand, +2 maanden,
+6 maanden, +12 maanden, afgeleid van de follow-ups in CATCH en Meuret 2008). Een
moment telt als voltooid zodra er een `rustcontrole`-sessie bestaat vanaf drie dagen
voor die datum, er is geen apart voortgangsveld (zie ook
`docs/plan_post_trial_rustcontroles.md`).

**Beginscherm per fase** (`docs/ui_doorlichting.md`). `computeTrajectPhase`
(`src/lib/traject.ts`) leidt uit de protocolstartdatum af of de nulmeting, het
CART-protocol of de periode erna loopt. `NowCard` toont per fase één hoofdactie;
protocol starten en herstarten gebeurt enkel op `/traject`.

**Gemiddelden en referentieband** (`src/lib/useAverages.ts`) rekenen week-/
maandgemiddelde en de referentieband (gemiddelde ± 1 SD over de CART-sessies van
de laatste 4 weken, met een ondergrens die nooit daalt, P5; vaste terugvalband
onder `MIN_SESSIONS_FOR_BASELINE`) uitsluitend
uit sessies met `sessionType: "cart"`. Rustcontroles zijn bewust een aparte,
ongestuurde reeks en wegen nergens in mee (P2, `docs/codeinstructies.md`). Dezelfde
hook bevat de zelfherstellende backfill hierboven.

**Compensatiedetectie** (`src/lib/compensation.ts`, P4) vergelijkt de ademfrequentie
en gemiddelde kPa van de huidige sessie met het gemiddelde van de laatste 5 eerdere
CART-sessies: een gedaalde ademfrequentie zonder gestegen CO2 wijst op compensatie
(trager maar dieper ademen zonder echte hypoventilatie-respons) in plaats van geslaagde
training.

**Firestore-rules** (`firestore.rules`) staan lezen/schrijven enkel toe binnen het
eigen `users/{uid}`-pad, er is verder geen schemavalidatie.

## Schrijfwijze

Belgisch Nederlands in alle UI-tekst, commentaar en commits. Op het scherm gewone woorden, geen vakjargon: "CO2-training" (niet CART-protocol, niet ademtraining), "startweek", "opvolging", "rustmeting", "oefening", "je persoonlijk bereik". Volledige lijst in `docs/ui_doorlichting.md` §11. Kinesitherapeut, NKO-arts,
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
rustcontroles (werkpunt P1). Gebouwd, afwijkingen staan bij P1 in
`docs/codeinstructies.md`.

## Git

Kleine commits per afgerond punt. Commitboodschap in het Nederlands, eerste regel
kort en beschrijvend. Verwijs naar het werkpunt waar dat past, bijvoorbeeld
"P1: sessionType toevoegen aan sessiedocument".

Nooit `.env.local` of Firebase-sleutels committen.
