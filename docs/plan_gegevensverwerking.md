# CapnoLog: plan gegevensverwerking

**Status:** Plan, nog niet gebouwd. Opgesteld op 28 oktober 2026 na overleg met Thomas.
**Doel:** de architectuur klaar hebben voor gebruik met cliënten van kinesitherapeuten, voor er iets op de markt komt. Werkpunten P14 tot P19, in de volgorde waarin ze gebouwd worden.

## 0. Uitgangspunten

- Thomas voert het programma wellicht niet zelf uit. Begeleiders zijn kinesitherapeuten, het programma wordt voorgeschreven (huisarts).
- Thomas analyseert de gegevens **per cliënt**, voor de kinesist die die cliënt begeleidt (model 1).
- **Bewust niet:** onderzoek over cliënten heen (model 2). Dat zou de app een onderzoeksdoel geven, met een eigen toestemming, een export en mogelijk een ethisch comité (experimentenwet). Thomas heeft het op 28/10 uit het plan gehaald. De architectuur laat het later toe zonder iets te herbouwen: er zou een onderzoekstoestemming in de records van P16 bijkomen, en een export via een Cloud Function zoals P18. Let op: ook per-cliëntanalyse wordt onderzoek zodra cliënten onderling vergeleken worden om te zien of de methode werkt.
- Firestore staat in `eur3` (europe-west, België en Nederland), vastgesteld op 28/10. Geen nieuw project nodig.
- Toegang tot gegevens komt altijd van de cliënt zelf, per doel apart, en is altijd in te trekken. Een adminrol geeft op zich geen leesrecht op cliëntgegevens.
- Dit plan is geen juridisch advies. Claude heeft het opgesteld vanuit de GDPR zoals algemeen gekend. De open juridische vragen staan in deel 3 en moeten door een advocaat gezondheidsrecht of een DPO beantwoord worden voor er echte cliënten zijn.

## 1. Datamodel na dit plan

| Pad | Inhoud | Wie schrijft | Wie leest |
|---|---|---|---|
| `users/{uid}` | bestaand, plus `analystUids` | eigenaar | eigenaar, begeleider en analist met toestemming en actieve rol |
| `users/{uid}/consents/{id}` | `kind` ("begeleiding" \| "analyse"), `targetUid` (begeleider of analist), `textVersion`, `grantedAt`, `withdrawnAt` | eigenaar, enkel aanmaken en intrekken | eigenaar |
| `admins/{uid}` | bestaand, met de hand in de console | niemand vanuit de app | eigenaar |
| `coaches/{uid}` | bestaand | via uitnodiging, admin trekt in | eigenaar, admin, eigen cliënten (naam) |
| `analysts/{uid}` | `name` | admin | aangemelde gebruikers (enkel de naam, nodig voor het toestemmingsscherm) |
| `coachInvites/{code}` | bestaand | admin | per code zonder account, lijst enkel admin |

Leesrecht op `users/{uid}/**` voor iemand anders dan de eigenaar vereist voortaan **twee dingen tegelijk**: de uid staat in `coachUids` of `analystUids` van de cliënt, **en** de rol bestaat (`coaches/{uid}` of `analysts/{uid}`). Wie de rol verliest, verliest de toegang bij elke cliënt meteen, zonder dat cliënten iets moeten doen.

## 2. Werkpunten

### P14. Regeltests met de Firestore-emulator

De regels worden met dit plan te complex om enkel met de hand in de console te testen. Voeg `@firebase/rules-unit-testing` toe met een testscript tegen de emulator (vraagt Java en `firebase-tools` als dev-dependency, en een minimale `firebase.json` enkel voor de emulator). Elke latere regelwijziging krijgt tests: wie mag lezen, wie niet, wat er gebeurt na intrekken. Dat wordt naast `npx next build` de tweede validatie-gate.

**Gebouwd (28/10).** `npm run test:rules` (`scripts/test-rules.sh`): 22 tests voor de regels zoals ze nu zijn, in `tests/rules/firestore.test.mjs`. Java (Temurin 21) staat in `~/.capnolog-tools`, het script vindt het daar. De Firebase CLI krijgt een eigen instellingenmap in `.cache/`, omdat `~/.config` op Thomas' Mac van root is. Gecontroleerd dat een fout opengezette regel een test laat falen.

### P15. Rol vereist voor leesrecht, beheer door de admin

**Regels.** `isCoachOf` vereist ook `exists(coaches/{auth.uid})`. Een admin zonder `coaches`-document is geen begeleider van cliënten. `coachInvites` mag de admin oplijsten.

**Beheer onder Account, enkel voor de admin:**
- **Begeleiders:** naam en sinds wanneer, met "Rol intrekken" (bevestiging). Verwijdert `coaches/{uid}`.
- **Openstaande uitnodigingen:** naam, geldig tot, en intrekken.
- Later ook de analisten (P17).

**Bewust niet:** de admin ziet de cliënten van andere begeleiders niet.

**Gebouwd (28/10).** `isCoachOf` vereist `exists(coaches/{auth.uid})`. Onder Account ziet de admin begeleiders (naam, sinds) met "Rol intrekken", en openstaande, niet verlopen uitnodigingen met "Intrekken" (`useCoachAdmin`, `CoachAdmin`). De eigen rij van de admin heeft geen knop. Intrekken markeert de rol (`revokedAt`) in plaats van het document te wissen (gewijzigd na een test van Thomas op 28/10: na wissen kwam een ex-begeleider in de cliëntomgeving terecht). Een ingetrokken begeleider ziet bij het aanmelden enkel dat de rol ingetrokken is (`AuthGate`), en kan de markering niet zelf weghalen. De admin ziet ingetrokken begeleiders met "Rol teruggeven". Een ingetrokken begeleider houdt de koppelingen, zodat een teruggegeven rol de toegang herstelt. Een uitnodiging die een ingetrokken begeleider nog had uitstaan, kan een cliënt nog aanvaarden, maar geeft zonder rol geen leesrecht. 30 regeltests slagen. Regels gepubliceerd en door Thomas getest op 28/10: uitnodigen, intrekken (scherm "rol ingetrokken"), teruggeven (toegang werkt weer).

### P16. Toestemmingsrecords

Elke toestemming wordt een record in `users/{uid}/consents`, met de versie van de tekst die aanvaard werd. Teksten staan versioned in de code (`src/lib/consentTexts.ts`). Regels: de eigenaar mag aanmaken, en bij een bestaand record enkel `withdrawnAt` zetten, nooit iets anders wijzigen of verwijderen (behalve bij P18).

Intrekken onder Account zet `withdrawnAt` **en** haalt de uid uit `coachUids` of `analystUids` in één batch. De bestaande knop "Toegang intrekken" gaat daarin op.

**Bestaande koppelingen** (de testcliënt) hebben geen record. Bij de volgende opening vraagt de app eenmalig om toestemming, of je trekt de koppeling in.

**Gebouwd (28/10).** Regels: `users/{uid}` en de subcollecties zijn opgesplitst, zodat `consents` eigen regels krijgt: aanmaken door de eigenaar met vaste velden (`grantedAt` en later `withdrawnAt` gelijk aan het servertijdstip), één keer intrekken, nooit wijzigen of wissen, enkel de eigenaar leest. Teksten in `src/lib/consentTexts.ts` (versie `2026-10-28`), het record bevat de exacte tekst. `acceptInvite` voegt het record toe in dezelfde batch als de toegang, intrekken onder Account trekt de toegang en de toestemming samen in. Afwijking van het plan: geen eenmalige vraag bij het openen van de app voor koppelingen zonder record. Onder Account staat bij zo'n begeleider "toestemming niet vastgelegd · bevestigen", wat terughoudender is en voor echte cliënten niet voorkomt (die komen via een uitnodiging). De regels dwingen niet af dat er bij elke uid in `coachUids` een record bestaat; het record is bewijs, de toegang zelf blijft `coachUids` plus de rol. 36 regeltests slagen.

### P17. Model 1: analist per cliënt

- **Rol:** admin maakt `analysts/{uid}` aan, voorlopig enkel Thomas.
- **Uitnodigingspagina** voor de cliënt, twee aparte keuzes:
  - verplicht: de begeleider mag meelezen (zoals nu);
  - optioneel en standaard **niet** aangevinkt: "[naam analist] mag mijn metingen analyseren voor [begeleider]". Elke analist is een aparte keuze.
- **Leesrecht:** via `analystUids` op het cliëntdocument, met het toestemmingsrecord erbij.
- **Overzicht van de analist:** dezelfde alleen-lezen weergave als die van een begeleider, met enkel de cliënten die toestemden. Vermeldt bij elke cliënt de begeleider.
- **Account van de cliënt:** de analist staat apart onder "Wie kan je gegevens lezen", met het doel erbij, en is los in te trekken.
- **Later toestemmen:** een cliënt die het vinkje eerst niet zette, moet dat onder Account kunnen doen.

### P18. Account verwijderen

Onder Account: "Account en gegevens verwijderen", met een bevestiging en het wachtwoord opnieuw. Firebase vraagt een recente aanmelding voor het verwijderen van een account. De export blijft er net boven, zodat de cliënt eerst een kopie kan nemen.

**Uitvoering:** een Cloud Function (`deleteMyAccount`, `europe-west1`), niet vanuit de app. Firestore kan subcollecties niet in één keer wissen, en een half gewist account vanuit een telefoon met een slechte verbinding is erger dan geen. De functie wist:
- `users/{uid}` met alle subcollecties;
- de koppelingen in `links`;
- eventuele `coaches/{uid}` en `analysts/{uid}`;
- het Auth-account.

Voor een begeleider blijven de gegevens van cliënten staan, want die zijn van de cliënten. Hun `coachUids` verwijst dan naar een uid zonder rol, wat volgens P15 geen toegang meer geeft.

Vraagt het Blaze-abonnement. Daarmee komt er ook een `firebase.json` voor de functies (zie P14). Zonder Blaze kan het wissen vanuit de app: sessie per sessie, dan het account. Dat werkt, maar een onderbroken verbinding laat dan een half gewist account achter, en daarom is het niet de voorkeur.

### P19. Privacytekst en bewaartermijn

Wacht op de antwoorden uit deel 3.
- **Privacytekst:** wie verantwoordelijk is, welke gegevens, waarvoor, wie meeleest, waar ze staan, hoe lang, en de rechten van de cliënt. Zichtbaar op de uitnodigingspagina voor het aanvaarden, en altijd onder Account. Versie in de toestemmingsrecords (P16).
- **Bewaartermijn:** waarschijnlijk een geplande Cloud Function die accounts wist na een termijn zonder activiteit, met een mail vooraf. Termijn te bepalen.

## 3. Open juridische vragen

Voor een advocaat gezondheidsrecht of een DPO. De antwoorden bepalen vooral de teksten (P19).

1. **Rollen.** Wie is verwerkingsverantwoordelijke voor de begeleiding: de kinesist, Thomas, of beiden samen? Is Thomas als analist verwerker voor de kinesist?
2. **Rechtsgrond.** Toestemming, of de behandelrelatie (artikel 9.2.h GDPR)? Geldt dat ook voor de analyse door Thomas?
3. **Experimentenwet en klinisch onderzoek.** Valt de begeleiding met deze methode en deze app, met per-cliëntanalyse door Thomas, onder de wet van 7 mei 2004 inzake experimenten op de menselijke persoon, of onder de regels voor klinisch onderzoek met medische hulpmiddelen? CART is onderzocht bij paniekstoornis en astma, niet bij chronische hyperventilatie. Geldt het toepassen ervan door een kinesist als gangbare zorg?
4. **DPIA.** Is een gegevensbeschermingseffectbeoordeling verplicht? Gezondheidsgegevens en een nieuwe technologie wijzen in die richting.
5. **Google.** Volstaan de standaard verwerkersvoorwaarden van Firebase en Google Cloud? Firestore staat in de EU, maar Firebase Auth verwerkt accounts ook buiten de EU.
6. **Medische software.** Valt de app onder de MDR (persoonlijk bereik, melding over compensatie)? Dat raakt eerder de teksten op het scherm dan de gegevensverwerking, maar hangt samen met vraag 3.
7. **Bewaartermijn.** Hoe lang mogen of moeten de gegevens bewaard worden? Geldt er een bewaarplicht voor het patiëntendossier van de kinesist, en hoort de app daarbij?

## 4. Volgorde en afhankelijkheden

1. **P14** eerst: alle volgende punten wijzigen regels.
2. **P15 en P16** naast elkaar: rol en toestemming, de basis voor alles erna.
3. **P17:** steunt op P15 en P16.
4. **P18:** zet het Blaze-abonnement en de functies op, en is los van het juridische nodig.
5. **P19:** na de juridische antwoorden.
