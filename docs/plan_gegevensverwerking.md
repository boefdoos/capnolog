# CapnoLog: plan gegevensverwerking

**Status:** Plan, nog niet gebouwd. Opgesteld op 28 oktober 2026 na overleg met Thomas.
**Doel:** de architectuur klaar hebben voor gebruik met cliënten van kinesitherapeuten, voor er iets op de markt komt. Werkpunten P14 tot P21, in de volgorde waarin ze gebouwd worden.

## 0. Uitgangspunten

- Thomas voert het programma wellicht niet zelf uit. Begeleiders zijn kinesitherapeuten, het programma wordt voorgeschreven (huisarts).
- Thomas wil twee soorten analyse: **per cliënt** voor de kinesist (model 1), en **over cliënten heen** als onderzoek (model 2).
- Firestore staat in `eur3` (europe-west, België en Nederland), vastgesteld op 28/10. Geen nieuw project nodig.
- Toegang tot gegevens komt altijd van de cliënt zelf, per doel apart, en is altijd in te trekken. Een adminrol geeft op zich geen leesrecht op cliëntgegevens.
- Dit plan is geen juridisch advies. Claude heeft het opgesteld vanuit de GDPR zoals algemeen gekend. De open juridische vragen staan in deel 3 en moeten door een advocaat gezondheidsrecht of een DPO beantwoord worden voor er echte cliënten zijn.

## 1. Datamodel na dit plan

| Pad | Inhoud | Wie schrijft | Wie leest |
|---|---|---|---|
| `users/{uid}` | bestaand, plus `analystUids`, `researchId` | eigenaar | eigenaar, begeleider en analist met toestemming en actieve rol |
| `users/{uid}/consents/{id}` | `kind` ("begeleiding" \| "analyse" \| "onderzoek"), `targetUid` (begeleider of analist, leeg bij onderzoek), `textVersion`, `grantedAt`, `withdrawnAt` | eigenaar, enkel aanmaken en intrekken | eigenaar |
| `admins/{uid}` | bestaand, met de hand in de console | niemand vanuit de app | eigenaar |
| `coaches/{uid}` | bestaand | via uitnodiging, admin trekt in | eigenaar, admin, eigen cliënten (naam) |
| `analysts/{uid}` | `name` | admin | aangemelde gebruikers (enkel de naam, nodig voor het toestemmingsscherm) |
| `coachInvites/{code}` | bestaand | admin | per code zonder account, lijst enkel admin |
| `exports/{id}` | onderzoeksexport: wie, wanneer, aantal deelnemers, lijst onderzoeksnummers | enkel de Cloud Function | admin |

Leesrecht op `users/{uid}/**` voor iemand anders dan de eigenaar vereist voortaan **twee dingen tegelijk**: de uid staat in `coachUids` of `analystUids` van de cliënt, **en** de rol bestaat (`coaches/{uid}` of `analysts/{uid}`). Wie de rol verliest, verliest de toegang bij elke cliënt meteen, zonder dat cliënten iets moeten doen.

## 2. Werkpunten

### P14. Regeltests met de Firestore-emulator

De regels worden met dit plan te complex om enkel met de hand in de console te testen. Voeg `@firebase/rules-unit-testing` toe met een testscript tegen de emulator (vraagt Java en `firebase-tools` als dev-dependency, en een minimale `firebase.json` enkel voor de emulator). Elke latere regelwijziging krijgt tests: wie mag lezen, wie niet, wat er gebeurt na intrekken. Dat wordt naast `npx next build` de tweede validatie-gate.

### P15. Rol vereist voor leesrecht, beheer door de admin

**Regels.** `isCoachOf` vereist ook `exists(coaches/{auth.uid})`. Een admin zonder `coaches`-document is geen begeleider van cliënten. `coachInvites` mag de admin oplijsten.

**Beheer onder Account, enkel voor de admin:**
- **Begeleiders:** naam en sinds wanneer, met "Rol intrekken" (bevestiging). Verwijdert `coaches/{uid}`.
- **Openstaande uitnodigingen:** naam, geldig tot, en intrekken.
- Later ook de analisten (P17).

**Bewust niet:** de admin ziet de cliënten van andere begeleiders niet.

### P16. Toestemmingsrecords

Elke toestemming wordt een record in `users/{uid}/consents`, met de versie van de tekst die aanvaard werd. Teksten staan versioned in de code (`src/lib/consentTexts.ts`). Regels: de eigenaar mag aanmaken, en bij een bestaand record enkel `withdrawnAt` zetten, nooit iets anders wijzigen of verwijderen (behalve bij P18).

Intrekken onder Account zet `withdrawnAt` **en** haalt de uid uit `coachUids` of `analystUids` in één batch. De bestaande knop "Toegang intrekken" gaat daarin op.

**Bestaande koppelingen** (de testcliënt) hebben geen record. Bij de volgende opening vraagt de app eenmalig om toestemming, of je trekt de koppeling in.

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

Vraagt het Blaze-abonnement, net als P20. Daarmee komt er ook een `firebase.json` voor de functies (zie P14).

### P19. Model 2: toestemming voor onderzoek

- **Uitnodigingspagina:** een derde, aparte keuze, standaard niet aangevinkt, met een eigen tekst: wat er onderzocht wordt, door wie, dat het gepseudonimiseerd gebeurt, en dat intrekken kan maar een eerdere export niet terughaalt.
- **Onderzoeksnummer:** bij toestemming krijgt de cliënt een willekeurig nummer (`researchId`, los van uid en naam). Na intrekken en opnieuw toestemmen blijft hetzelfde nummer, zodat een reeks niet in twee deelnemers splitst.
- **Account:** de toestemming staat in het overzicht "Mijn toestemmingen" en is er in te trekken.

### P20. Onderzoeksexport via een Cloud Function

Een callable function `exportResearch` in `europe-west1`. Die controleert dat de aanroeper admin is, en leest met de Admin SDK enkel deelnemers met een actieve onderzoekstoestemming. De admin krijgt daardoor nergens leesrecht op cliëntdocumenten.

**Inhoud van de export:**
- `researchId`;
- per sessie: type (oefening, rustmeting startweek, rustmeting opvolging), dag ten opzichte van de eerste sessie (geen kalenderdatum), tijdstip van de dag afgerond op het uur, duur, en de metingen (`tSec`, `kpa`, ademhalingen per minuut);
- de bevroren startweek;
- geen naam, geen e-mail, geen uid, geen begeleider;
- het gevoel na de oefening enkel als Thomas het nodig heeft voor de onderzoeksvraag (dataminimalisatie, te beslissen).

**Bij elke export:**
- een record in `exports`;
- een lijst van onderzoeksnummers waarvan de toestemming sinds de vorige export ingetrokken werd, zodat die ook uit een lokale dataset gewist kunnen worden.

**Formaat:** CSV, één bestand per export.

### P21. Privacytekst en bewaartermijn

Wacht op de antwoorden uit deel 3.
- **Privacytekst:** wie verantwoordelijk is, welke gegevens, waarvoor, wie meeleest, waar ze staan, hoe lang, en de rechten van de cliënt. Zichtbaar op de uitnodigingspagina voor het aanvaarden, en altijd onder Account. Versie in de toestemmingsrecords (P16).
- **Bewaartermijn:** waarschijnlijk een geplande Cloud Function die accounts wist na een termijn zonder activiteit, met een mail vooraf. Termijn te bepalen.

## 3. Open juridische vragen

Voor een advocaat gezondheidsrecht of een DPO. De antwoorden bepalen vooral de teksten (P21), en ook of P19 en P20 al gebruikt mogen worden.

1. **Rollen.** Wie is verwerkingsverantwoordelijke voor de begeleiding: de kinesist, Thomas, of beiden samen? Is Thomas als analist (model 1) verwerker voor de kinesist? Is hij voor het onderzoek (model 2) zelf verantwoordelijke?
2. **Rechtsgrond.** Voor de begeleiding: toestemming, of de behandelrelatie (artikel 9.2.h GDPR)? Voor het onderzoek: uitdrukkelijke toestemming, of een onderzoeksgrond (artikel 9.2.j)?
3. **Experimentenwet.** Valt het onderzoek onder de wet van 7 mei 2004 inzake experimenten op de menselijke persoon, en is er dus een ethisch comité nodig? Hangt waarschijnlijk af van of de gegevens voor het onderzoek verzameld worden of achteraf gebruikt.
4. **DPIA.** Is een gegevensbeschermingseffectbeoordeling verplicht? Gezondheidsgegevens op schaal, en een nieuwe technologie, wijzen in die richting.
5. **Google.** Volstaan de standaard verwerkersvoorwaarden van Firebase en Google Cloud? Firestore staat in de EU, maar Firebase Auth verwerkt accounts ook buiten de EU.
6. **Medische software.** Valt de app onder de MDR (persoonlijk bereik, melding over compensatie)? Dat raakt eerder de teksten op het scherm dan de gegevensverwerking.
7. **Bewaartermijn.** Hoe lang mogen of moeten de gegevens bewaard worden? Geldt er een bewaarplicht voor het patiëntendossier van de kinesist, en hoort de app daarbij?

## 4. Volgorde en afhankelijkheden

1. **P14** eerst: alle volgende punten wijzigen regels.
2. **P15 en P16** naast elkaar: rol en toestemming, de basis voor alles erna.
3. **P17:** steunt op P15 en P16.
4. **P18:** zet het Blaze-abonnement en de functies op, en is los van het juridische nodig.
5. **P19 en P20:** steunen op P16 en P18. Bouwen kan nu, **gebruiken pas na het antwoord op vraag 3**.
6. **P21:** na de juridische antwoorden.
