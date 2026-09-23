# CapnoLog: codeinstructies voor een volgende sessie

**Status:** Werkdocument, opgesteld na volledige codereview
**Datum:** 14 september 2026, statusupdate 23 september 2026, P12 en P13 toegevoegd 23 september 2026
**Doel:** Een sessie die hier koud instapt moet zonder verdere uitleg kunnen beginnen bouwen

---

## 0. Hoe dit document te gebruiken

Lees eerst deel 1. Alles daarna volgt eruit.

Volgorde van het werk: **P12 en P13 eerst**. Die blokkeren allebei de eerste cliënt, en de rest van de open punten doet dat niet. P5, P6 en P9 wachten op keuzes van Thomas en kunnen daarna.

Vraag Thomas welk punt hij wil aanpakken voor je begint. Bouw niet de hele lijst in één keer.

**Stand van zaken op 23 september 2026.**

| Punt | Status | Commits |
|---|---|---|
| P1 | Af. Beginscherm toont ook de datum van de volgende rustcontrole | `c97c493`, `6de544b` |
| P1b | Af. Bemonstering, pacer, fasecues | `5a93169`, `c0cc35c`, `5a2dae1` |
| P2 | Af | `654317c` |
| P3 | Af | `654317c` |
| P4 | Af, gebruikt de afgeleide RR met N-correctie | `f2efa30` |
| P5 | Af. Venster van 4 weken, vloer die nooit daalt | `122673b` |
| P6 | Niet bouwen. Thomas kiest voor de kalender zoals in CATCH | |
| P7 | Af, opgegaan in P1b | `5a93169` |
| P8 | Af. Fasen, automatisch afronden na 17 min, stille rust zonder feedback | `5a93169`, `255171c`, `5a2dae1` |
| P9 | Af. Minimumduur 10 minuten | `22536b7` |
| P10 | Af. RR van de EMMA, enkel in rust en transfer, één waarde per fase | `93c6eae`, `724cac4`, `c41e292`, `9b11be9` |
| P11 | Grotendeels af. Server-side aggregatie blijft open tot er meerdere cliënten zijn | `1289eb0` |
| P12 | Af | `c66194f` |
| P13 | Af. Regels gepubliceerd op 23/09, werking voor eigen gebruik gecontroleerd. Toegang begeleider testen bij de eerste koppeling | `09e327f` |

De beschrijvingen hieronder zijn het oorspronkelijke reviewverslag. Waar de bouw ervan afweek, staat dat bij het punt onder **Gebouwd**.

**Projectgegevens.** Repo `boefdoos/capnolog`, branch `main`. Next.js 14 App Router, TypeScript, Tailwind 3, Firebase Auth en Firestore, Chart.js 4. Buildcheck: `npx next build`. Deployment via Vercel op elke push naar `main`.

**Datamodel.** `users/{uid}/sessions/{sessionId}` met metadata en aggregaten, subcollectie `entries/{entryId}` met `type` ("reading" | "marker" | "sigh"), `subtype`, `tSec`, `kpa`. De velden `idx`, `delta`, `mmHg` en `rr` worden client-side afgeleid in `deriveEntries` en nooit opgeslagen. Protocolinstellingen staan in `users/{uid}/settings/protocol`.

P1 voegt `sessionType` toe op het sessiedocument, P1b en P10 voegen een entry-type `"rr"` toe met een veld `rrValue` en een sessieveld `logEveryNthBreath`. P12 voegt `nulmeting` toe als derde `sessionType` plus een bevroren baselinewaarde op gebruikersniveau, P13 voegt een koppeling tussen begeleider en cliënt toe.

---

## 1. Het probleem dat je eerst moet begrijpen

Thomas heeft het protocol op zichzelf gedraaid en de data geanalyseerd. Uit `plan_post_trial_rustcontroles.md`:

> De retroactieve baseline-proxy (eerste 60s van elke sessie) toont nog geen trend, p=0,94, terwijl het volledige sessiegemiddelde wel significant stijgt, p=0,038.

Dat is het centrale gegeven. Het gestuurde deel van de sessie verbetert. Het spontane moment niet.

En nu de consequentie voor de code: **elke cijfermatige uitspraak die CapnoLog vandaag doet, is berekend over gestuurde sessiedata.** Het weekgemiddelde, het maandgemiddelde, de referentieband en de trendgrafiek komen allemaal uit `useAverages`, dat alle sessies neemt zonder onderscheid. Dat zijn allemaal CART-sessies, waarin de gebruiker actief zijn ademhaling bijstuurt om het getal omhoog te krijgen.

De app rapporteert dus vooruitgang op de maat die reageert op sturen, en zwijgt over de maat die zou aantonen dat het werkpunt verschoven is. Dat is geen weergavefout maar een meetfout, en ze zit in de kern van wat de app beweert te tonen.

Ondersteunend bewijs uit de literatuur: de CATCH-trial (Ritz et al., CHEST 2014;146(5):1237-1247, volledige tekst gelezen op 14 september 2026) vergeleek CART met traag ademen zonder CO2-feedback. De CO2 steeg in de traag-ademen-groep tijdelijk tijdens de behandeling en stond na zes maanden exact terug op de beginwaarde, 35,6 naar 35,6 mmHg. Alleen de CO2-gestuurde groep hield de stijging vast. Tijdelijke winst tijdens gestuurd oefenen zegt dus aantoonbaar niets over duurzame verandering. (bewijsniveau: sterk voor dit punt, RCT met directe mechanismevergelijking)

---

## 2. Status van het bestaande rustcontroleplan

`plan_post_trial_rustcontroles.md` beschrijft precies de oplossing: een apart `sessionType`-veld met waarden `cart` en `rustcontrole`, een niet-gestuurd meetscherm van 90 seconden tot 3 minuten, en rustcontroles die geen invloed hebben op de band of het weekdoel.

*Update 23/09: P1 is intussen gebouwd, zie de statustabel in deel 0. De paragrafen hieronder beschrijven de toestand op 14/09.*

**Dat plan is niet uitgevoerd.** Geverifieerd in de code op 14 september 2026: `SessionMeta` in `src/types/capnolog.ts` heeft geen `sessionType`, `ensureSession` in `src/lib/useActiveSession.ts` schrijft het niet weg, en `parseSessionMeta` in `src/lib/format.ts` leest het niet.

**Het is intussen te laat voor het eerste meetmoment.** Het plan rekent met protocolherstart 27/07 en protocol-einde op 24/08. De vier momenten waren:

| Moment | Datum | Status op 14/09 |
|---|---|---|
| +1 week | 31/08 | Voorbij, twee weken geleden |
| +1 maand | 24/09 | Over tien dagen |
| +2 maanden | 24/10 | Ruim op tijd |
| +12 maanden | 24/08/2027 | Ruim op tijd |

Het eerste punt is gemist. Het tweede valt over tien dagen. Dat maakt P1 hieronder tijdgevoelig: als `sessionType` er niet is voor 24/09, gaat ook dat meetpunt verloren of komt het in de verkeerde reeks terecht.

Het plan zelf blijft inhoudelijk overeind en hoeft niet herzien te worden. Bouw wat er staat.

---

## 3. Wat niet mag veranderen

Uit het bestaande plan, ongewijzigd van kracht:

- Geen hergebruik van de 17-minuten sessieflow voor rustcontroles
- Geen RR-doel en geen live grafiek tijdens een rustcontrole, want die nodigen uit tot sturen en dat is precies wat de meting moet uitsluiten
- Geen countdown, geen rode stip, geen gemiste-check-status
- Geen automatische herhaling voorbij de vier momenten

Uit het projectprotocol en de programmaontwerpnota:

- Terughoudende UI blijft het uitgangspunt. Overmatige tracking kan rumineren aanwakkeren, dat is bij Ademruimte al gebleken. Elke toevoeging die de gebruiker vaker naar een cijfer laat kijken, moet die kost verantwoorden.
- De zelfherstellende backfill in `useAverages` (regels rond 117 tot 121) blijft staan. Die repareert sessies van voor `kpaSum` en `kpaSumSq` bestonden. Niet weghalen.

---

## 4. Bevindingen en werk, op prioriteit

### P1. `sessionType` invoeren en het rustcontrolescherm bouwen

Tijdgevoelig, zie deel 2.

Voer uit wat in `plan_post_trial_rustcontroles.md` staat. Kort samengevat: veld `sessionType` op het sessiedocument met `'cart'` als standaard voor bestaand gedrag, een apart meetscherm zonder ademdoel en zonder live grafiek, en een veld `nextRustcontrole` op gebruikersniveau berekend uit `cartProtocolStartDate + 28 dagen` plus de offsets.

Bestaande sessies zonder het veld moeten als `'cart'` gelezen worden. Zet die default in `parseSessionMeta`, niet in de queries, zodat oude data zonder migratie blijft werken.

**Gebouwd.** Geen opgeslagen `nextRustcontrole`-veld: `computeRustcontroleSchedule` in `src/lib/useRustcontrole.ts` rekent de vier momenten uit `cartProtocolStartDate`, en een moment telt als voltooid zodra er op of na die datum een `rustcontrole`-sessie bestaat. Het beginscherm toont vanaf drie dagen voor een moment "Rustcontrole deze week beschikbaar · start", en daarvoor enkel de datum ("Volgende rustcontrole: woensdag 24 september"). Dat laatste wijkt bewust af van het plan, dat de regel enkel vlak voor het moment toonde: op vraag van Thomas, en een datum zonder "over X dagen" is geen countdown.

### P1b. Meetdichtheid verlagen, en de pacer die daarbij hoort

Dit bepaalt of iemand anders dan Thomas dit programma kan volhouden. Direct na P1.

**Het probleem.** Bij een doelfrequentie van 13 ademhalingen per minuut komt er elke 4,6 seconden een waarde. De gebruiker moet in die tijd het EMMA-scherm aflezen, naar de telefoon kijken, twee cijfers intoetsen en bevestigen, terwijl hij tegelijk bewust zijn ademhaling stuurt. Tien minuten aan een stuk, tweemaal per dag. Thomas houdt dat vol. Voor een cliënt is dat de reden om af te haken.

**De vaststelling die de vraag omdraait.** Per-adem loggen is geen onderdeel van CART. In de CATCH-trial gebruikten de deelnemers een capnometer die alle waarden zelf opsloeg met tijdstempel, en de begeleider haalde de registratie wekelijks op. De patiënt logde niets. De logdruk in CapnoLog is een omweg rond het ontbreken van een data-uitgang op de EMMA, geen protocolvereiste.

**Wat er wel nodig is.** De therapeutische feedback is realtime en gebeurt op het EMMA-scherm zelf. Loggen dient enkel om het verloop over weken te volgen, en daarvoor volstaat een steekproef. Bij een spreiding binnen een sessie van ongeveer 0,4 kPa geeft n=30 een standaardfout van ongeveer 0,07 kPa op het sessiegemiddelde. De veranderingen die gevolgd worden liggen tussen een halve en een hele kPa over weken. Die precisie is ruim voldoende.

**En het is therapeutisch beter, niet alleen praktischer.** Elke 4,6 seconden een getal aflezen en overtypen is letterlijk hypervigilantie oefenen, precies wat het projectprotocol als risico benoemt.

**Ontwerp.**

Pacer op geluid, logsignaal op trilling. Twee tonen door elkaar wordt verwarrend. De haptische code uit Ademruimte is herbruikbaar.

Het logmoment hangt aan de ademcyclus, niet aan de klok. De EMMA toont de eindwaarde van de laatst voltooide uitademing. Een vast klokinterval valt soms midden in een inademing en levert dan een waarde uit een andere fase. Elke zoveelste ademhaling loggen houdt elk meetpunt op hetzelfde punt in de cyclus, en dus onderling vergelijkbaar.

| Doelfrequentie | Elke hoeveelste adem | Interval |
|---|---|---|
| 13/min | 7 | 32 s |
| 11/min | 6 | 33 s |
| 9/min | 5 | 33 s |
| 6/min | 3 | 30 s |

Per sessiefase verschilt de dichtheid:

- Eerste twee minuten stille rust: drie tot vier waarden, met de zachtste cue die er is. Hier mag geen sturing uitgelokt worden, maar dit is wel de baseline-proxy uit deel 1 en die data is onmisbaar.
- Tien minuten gepaced: elke Nde adem volgens de tabel, ongeveer 18 tot 20 waarden.
- Laatste vijf minuten zonder pacing: geen audiopacer, de trilling is het enige signaal.

Samen vijfentwintig tot dertig waarden per sessie in plaats van ongeveer tweehonderdtwintig.

**Wat hierdoor stilzwijgend breekt en meteen mee moet.**

`computeAvgRR` en de `rr`-afleiding in `deriveEntries` berekenen de ademfrequentie uit het interval tussen twee opeenvolgende gelogde metingen. Bij loggen per zevende adem rapporteren die een zevende van de werkelijke frequentie, zonder foutmelding. Niet irrelevant dus, maar fout, en dat is erger.

Rekenkundig is dat exact te corrigeren, want het interval tussen twee logs overspant precies N ademhalingen: werkelijke frequentie is N maal 60 gedeeld door het interval. Maar voor je dat bouwt, kijk eerst naar wat die RR nog moet doen, want de rol verandert per fase.

*Tijdens de gepacede fase is RR geen meting meer.* De app dicteert het tempo, dus er valt niets te meten wat niet al vastligt. Wat daar wel telt is of de gebruiker de pacer volgt: bij doel 13/min en loggen per zevende adem hoort een interval van 32 seconden, dus structureel 40 seconden betekent trager ademen dan gevraagd. Dat is een nalevingscontrole, en P4 heeft ze nodig om te kunnen zeggen "tempo gehaald, CO2-respons uitgebleven". Behoud de afleiding dus, met de N-correctie, maar label ze als naleving en niet als meting.

*In de ongestuurde fasen is RR wel een echte meting, en daar sloopt bemonstering ze.* De eerste twee minuten stille rust en de rustcontroles uit P1 zijn precies waar spontane ademfrequentie inhoudelijk interessant is, en met drie of vier waarden over twee minuten valt daar niets zinnigs uit af te leiden.

*De oplossing is niet corrigeren maar rechtstreeks meten.* De EMMA toont naast EtCO2 ook de ademfrequentie. Laat de gebruiker die waarde aflezen en één keer per fase intoetsen als een eigen entry-type, bijvoorbeeld `type: "rr"` met een veld `rrValue`. Dan staat er een gemeten waarde in de data in plaats van een afgeleide uit loggedrag. Dat is ook los van deze wijziging een verbetering: de huidige afleiding halveert al bij één overgeslagen log.

Let op dat `deriveEntries`, `StatsRow` en de aggregaten in `useActiveSession` filteren op `type === "reading"`, dus een nieuw entry-type verstoort `kpaSum` en `readingCount` niet. Controleer dat wel expliciet.

Sessiegemiddelden blijven vergelijkbaar met de oudere per-adem data, want beide zijn zuivere schattingen van hetzelfde gemiddelde. Wat wel verandert is de snelheid waarmee de referentieband aan metingen komt: `MIN_READINGS_FOR_BASELINE` van 20 wordt nu binnen één sessie gehaald in plaats van binnen enkele. Kijk na of die drempel nog zinvol is.

Sla de gebruikte bemonstering per sessie op, bijvoorbeeld `logEveryNthBreath`, zodat later analyseerbaar blijft welke sessies per adem en welke bemonsterd zijn.

**Volgorde binnen dit punt.** Test eerst alleen het interval, zonder pacer en zonder fasestructuur, een week lang op Thomas zelf. Ontbreekt er daarna niets in de data, dan is het probleem opgelost voor een fractie van het werk. Pacer en fasestructuur komen daarna.

**Dit punt absorbeert P7 en P8.** Die staan hieronder nog apart voor de details, maar ze zijn onderdeel van dit werk geworden.

**Gebouwd.** De weektest op Thomas is gedaan, daarna zijn pacer en fasestructuur meteen mee gebouwd (`src/lib/pacer.ts`, `src/lib/sessionPhase.ts`, `src/lib/useSessionCues.ts`). Bemonstering volgens de tabel hierboven (`BREATH_SAMPLING`), opgeslagen als `logEveryNthBreath`. Afwijkingen van het ontwerp:

- Stille rust heeft **twee meetpunten** in plaats van drie tot vier: de eerste log start de sessie (t=0), één zachte cue op 110 s vraagt het tweede, net voor het einde van de rust (`REST_LOG_INTERVAL_SEC`).
- Tijdens stille rust zijn het streefdoel, de live grafiek, `StatsRow` en `BandInfo` verborgen, zodat de baseline-proxy niet gestuurd wordt.
- De pacertoon valt samen met het logmoment in plaats van een tik per ademhaling, dat voelde over tien minuten te opdringerig aan.
- Het streefdoel staat groot in de fasekaart (`PhaseBadge`), de aparte `CartWeekBadge` is weg.
- De drempel voor een eigen referentieband is herbekeken op 23/09: `MIN_READINGS_FOR_BASELINE` (20 metingen) is vervangen door `MIN_SESSIONS_FOR_BASELINE` (4 CART-sessies, twee dagen protocol). Twintig metingen haalde je sinds de bemonstering al in één sessie, en één sessie toont enkel de spreiding binnen die sessie, niet de schommeling van dag tot dag.

### P2. De twee reeksen overal scheiden

Zodra P1 bestaat, vervuilen rustcontroles de CART-cijfers en omgekeerd. `src/lib/useAverages.ts` berekent nu alles over alle sessies zonder filter: `computeWindow`, `computeBaselineBand`, `computeTrend` en `computeSessionsToday`.

Alle vier moeten filteren op `sessionType`. Concreet:

- Week- en maandgemiddelde: enkel `cart`
- Referentieband: enkel `cart`, conform het plan
- `computeSessionsToday`: enkel `cart`, want het CART-doel van twee sessies per dag gaat over oefensessies
- Trend: twee aparte reeksen, of minstens een tweede reeks voor rustcontroles

De trendgrafiek op het startscherm moet beide tonen, met de rustcontroles duidelijk onderscheiden. Dat is de grafiek die het verschil tussen gestuurd en spontaan zichtbaar maakt, en dat is de hele reden dat dit gebouwd wordt.

### P3. Absoluut trajectdoel toevoegen

Er staat nergens in de code wat normocapnie is. Er is geen enkele vaste referentie.

CART richt op een PCO2 van 40 tot 42 mmHg, dus 5,33 tot 5,60 kPa. (bewijsniveau: matig, methodesectie CATCH-trial, geverifieerd op 14 september 2026)

Voeg toe in `src/types/capnolog.ts`:

```ts
// CART-doelbereik (Ritz et al., CHEST 2014, methodesectie): 40-42 mmHg.
export const CART_GOAL_KPA_LOW = 5.33;
export const CART_GOAL_KPA_HIGH = 5.60;
```

Toon dat als een vaste horizontale zone op `TrendChart`, die nooit meebeweegt. Dat is waar het traject naartoe werkt, en het is de maatstaf waaraan de rustcontrolereeks afgemeten moet worden.

Ter oriëntatie: `DEFAULT_BAND_LOW` staat op 3,8 en `DEFAULT_BAND_HIGH` op 4,9 kPa, dus 28,5 tot 36,8 mmHg. De bovengrens van de terugvalband ligt onder de ondergrens van het CART-doel. Voor een terugvalwaarde bij te weinig data is dat verdedigbaar, maar het maakt duidelijk waarom een absoluut anker apart nodig is.

### P4. Compensatiedetectie

Dit is de kernfaalmodus van het protocol en de app kan hem niet zien.

De werkzame ingreep is hypoventilatie, niet traag ademen. Minuutventilatie is ademfrequentie maal teugvolume: wie trager gaat ademen maar dieper, houdt de minuutventilatie gelijk en de CO2 stijgt niet. De CATCH-auteurs benoemen dit expliciet als verwachting vooraf, en hun resultaten bevestigen het.

CapnoLog meet geen teugvolume, maar heeft de CO2-respons zelf als detector. Bouw een controle per sessie: als de gemiddelde ademfrequentie daalt ten opzichte van eerdere sessies terwijl de gemiddelde kPa niet meestijgt, meld dat. Iets in de trant van "doelfrequentie gehaald, CO2-respons uitgebleven".

Beide grootheden bestaan al: `computeAvgRR` in `src/lib/format.ts` en `kpaSum` gedeeld door `readingCount` uit `SessionMeta`. Let op de wisselwerking met P1b: na bemonstering is `computeAvgRR` niet meer bruikbaar zonder correctie.

### P5. Bandsemantiek herzien

`computeBaselineBand` in `src/lib/useAverages.ts` berekent gemiddelde plus en min één standaarddeviatie over alle sessies ooit. Drie problemen.

**Een spreidingsband gebruikt als doelband.** Bij een normaal verdeelde reeks valt per definitie ongeveer 68 procent van de metingen binnen gemiddelde plus en min één SD. Het percentage binnen de band is daarmee grotendeels ongevoelig voor verbetering: wie beter wordt, sleept de band mee en zit nog altijd rond 68 procent. De maat detecteert spreiding, niet niveau.

**Cumulatief over de hele geschiedenis betekent verstarring.** Elke nieuwe sessie verschuift het gemiddelde met ongeveer 1 op n. Na tweehonderd sessies beweegt de band nauwelijks nog, en data uit de slechtste beginperiode blijft even zwaar meewegen als recente data. Iemand die van 3,5 naar 4,5 gaat, leest permanent als "boven de band" terwijl de band nooit bijtrekt. De band is dan een historisch archief geworden in plaats van een doel.

Het commentaar in de code motiveert de keuze bewust met stabiliteit, en die redenering klopt voor toepassingen waar de baseline stabiel hoort te zijn. Bij een hersteltraject is het verschuiven van die baseline net het doel. Dat is de mismatch.

**Documentatie klopt niet met de code.** `BandInfo.tsx` toont "maandgemiddelde ± 1 SD" en het commentaar in `ensureSession` zegt hetzelfde, terwijl `computeBaselineBand` alle sessies gebruikt. Kies wat het moet zijn en maak alle drie gelijk.

Voorstel, te bespreken met Thomas voor je bouwt: houd de meebewegende band als sessiedoel, maar laat de ondergrens nooit dalen. Beste behaalde waarde wordt de vloer. Een slechte week betekent dan tijdelijk onder je band zitten, niet dat de band naar beneden komt. En clamp `mean - sd` in elk geval op `DEVICE_MIN_KPA`, want nu kan die bij weinig data en grote spreiding onder nul uitkomen.

**Gebouwd.** `computeBaselineBand` rekent gemiddelde ± 1 SD over de CART-sessies van de laatste 28 dagen. Met te weinig recente data valt ze terug op alle CART-sessies, en daaronder op de vaste terugvalband. De vloer is de hoogste ondergrens die ooit bereikt werd over een venster van 28 dagen met minstens 6 sessies (`MIN_SESSIONS_FOR_FLOOR`), zodat één uitschieter in het begin niet voorgoed de vloer vastlegt. Trekt de vloer de ondergrens op, dan schuift de band mee met dezelfde breedte. Begrensd op `DEVICE_MIN_KPA`. `BandInfo` en het commentaar in `ensureSession` kloppen nu met de berekening.

### P6. Progressie op respons in plaats van op kalender

`computeCartWeekTarget` in `src/lib/useCartProtocol.ts` schuift puur op verstreken dagen door: 13, 11, 9, 6 per week. Wie op 11 nog geen CO2-respons haalt, wordt na veertien dagen naar 9 geduwd.

De stap van 9 naar 6 is bovendien de grootste, een reductie van 33 procent tegenover ongeveer 15 tot 20 procent bij de vorige stappen. Bij zes ademhalingen per minuut duurt een cyclus tien seconden, en de neiging om dat met diepere teugen op te vangen is dan het sterkst. Precies waar de eis het zwaarst is, is compensatie het waarschijnlijkst.

Voorstel: laat de volgende frequentie pas vrijkomen wanneer de huidige betrouwbaar een CO2-stijging oplevert. Behoud de kalender als bovengrens zodat niemand vastloopt, maar niet als enige criterium. Dit hangt samen met P4: dezelfde berekening voedt beide.

Dit is een gedragswijziging aan het protocol. Bespreek ze met Thomas voor je ze bouwt.

**Beslist op 23/09: niet bouwen.** De kalenderprogressie blijft zoals in CATCH, zodat het protocol vergelijkbaar blijft met de trial. Compensatie blijft zichtbaar via de melding uit P4.

### P7. Ademtempo-aangever

Onderdeel van P1b geworden, hier voor de details.

Er is geen pacer. `CartWeekBadge` toont de doelfrequentie als getal, en de gebruiker moet zichzelf timen.

De CATCH-methodesectie beschrijft de huisoefening als audio-gestuurd, met tonen op de doelfrequentie. Zonder cue is de oefening moeilijker en kost ze meer aandacht, wat haaks staat op het doel.

De ademcyclus-logica uit Ademruimte is herbruikbaar. Auditief, geen visuele animatie die de blik naar het scherm trekt. Het haptische kanaal blijft vrij voor het logsignaal uit P1b.

### P8. Driedelige sessiestructuur

Onderdeel van P1b geworden, hier voor de details.

De oefening van zeventien minuten is in CATCH opgebouwd als 2 minuten stil zitten met gesloten ogen, 10 minuten gepaced ademen, en 5 minuten zonder pacing.

CapnoLog kent één ongedeelde timer met een doel van 17:00 (`CART_TARGET_MINUTES`). De drie fasen zijn niet gemodelleerd.

Die eerste twee minuten zijn een ongestuurde meting binnen elke sessie, dus feitelijk een dagelijkse mini-rustcontrole. Dat is precies waar de baseline-proxy uit Thomas' analyse vandaan komt. Als de fasen expliciet in de data zitten, wordt die proxy een echt veld in plaats van een retroactieve reconstructie.

De laatste vijf minuten zonder pacing zijn de transferfase. Therapeutisch is dat de brug naar zelfstandigheid, en het is de logische aanknoping voor de afbouw uit de programmaontwerpnota.

### P9. Adherentiedefinitie aanscherpen

`computeSessionsToday` telt elke sessie met minstens één meting. `DailyProgress` meldt op basis daarvan dat het CART-doel van twee sessies per dag gehaald is.

Twee keer één waarde intikken haalt dus het dagdoel. Voor persoonlijk gebruik is dat hooguit vervelend, voor een programma waarin adherentie een uitkomstmaat is, is het onbruikbaar. Voeg een minimumduur of een minimumaantal metingen toe voor een sessie meetelt. Na P1b is een minimumduur logischer dan een minimumaantal metingen.

**Gebouwd.** Een CART-sessie telt mee voor het dagdoel vanaf 10 minuten tussen start en laatste log (`MIN_SESSION_SEC_FOR_DAILY_GOAL`, getoetst op `lastTSec`).

### P10. RR gemeten in plaats van afgeleid

`deriveEntries` leidt de ademfrequentie af uit het interval tussen twee opeenvolgende **gelogde** metingen. Het codecommentaar erkent dit al. Bij manuele invoer is dat de logfrequentie, niet de ademfrequentie: één overgeslagen log verdubbelt het interval en halveert de schijnbare RR. `StatsRow` toont dat als "RR gem." met nul decimalen, wat als een meting oogt.

De EMMA meet en toont zelf de ademfrequentie. Die aflezen en intoetsen als een eigen entry-type (`type: "rr"`, veld `rrValue`) levert een echte waarde op, een keer per sessiefase, in plaats van een reconstructie uit loggedrag. Dat is de eigenlijke oplossing.

Wat er dan van de afleiding overblijft is de nalevingscontrole uit P1b: wijkt het loginterval af van wat bij de doelfrequentie hoort, dan volgt de gebruiker de pacer niet. Behoud die berekening met de bemonsteringsfactor, maar label ze als naleving en niet als gemeten ademfrequentie.

Dit hangt samen met P1b en hoort in dezelfde wijziging thuis: bij bemonsterd loggen klopt de huidige afgeleide RR sowieso niet meer.

**Gebouwd.** Entry-type `"rr"` met `rrValue`, afgelezen van de EMMA. Het RR-veld verschijnt enkel in stille rust en transfer, één waarde per fase, en verdwijnt daarna. Tijdens gepaced ademen is er geen RR-veld, want de pacer dicteert het tempo. De afgeleide RR blijft bestaan met de N-correctie en voedt P4. De ingevoerde RR wordt nog in geen enkele berekening gebruikt, enkel getoond en geëxporteerd.

### P11. Kleiner spul

`meta` wordt niet live gesynct, alleen `entries`. `metaRef.current` wordt bij aanmaak gevuld met nullen en daarna nooit uit Firestore bijgewerkt. Wie later een feature bouwt die tijdens een sessie `meta.readingCount` uitleest, krijgt altijd nul. Zet daar een commentaar bij of sync meta alsnog.

`ensureSession` houdt lokaal `createdAt: Date.now()` aan maar schrijft `serverTimestamp()` weg. Bij klokverschil tussen toestel en server wijkt de opgeslagen `createdAt` af van de basis waarop alle `tSec` berekend zijn. Intervallen blijven kloppen, absolute tijdstippen niet helemaal.

`useAverages` haalt tot duizend sessies op en rekent alles client-side. Prima voor één gebruiker. Zodra er een begeleidersweergave over meerdere cliënten komt, moet dat naar server-side aggregatie.

**Gebouwd.** Commentaar bij `metaRef` in `useActiveSession`. `createdAt` wordt nu opgeslagen als `Timestamp.fromMillis` van dezelfde toestelklok als `tSec`, in plaats van `serverTimestamp()`. Server-side aggregatie blijft open: de begeleidersweergave uit P13 rekent per cliënt client-side, en dat volstaat voor een handvol cliënten.

---

### P12. Nulmeting als derde sessietype

**Blokkeert de eerste cliënt.**

Het traject begint met een nulmeting van vijf tot zeven dagen: drie rustmetingen per dag, geen oefeningen, geen sturing. Die staat nu nergens in de app, terwijl ze het vertrekpunt is waartegen alles later afgemeten wordt.

Technisch is het een kleine toevoeging, want een nulmeting is dezelfde meting als een rustcontrole: kort, ongestuurd, geen streefdoel op het scherm, geen live grafiek. Het meetscherm daarvoor bestaat al sinds P1. Voeg `nulmeting` toe als derde waarde op `sessionType` en hergebruik dat scherm.

Wat er wel bij hoort en nog niet bestaat:

**Een volledigheidsteller.** Toon tijdens de nulmeetweek hoeveel metingen er al zijn, bijvoorbeeld "14 van 20". De cliënt weet dan wanneer hij klaar is, en bij het go-of-no-go-gesprek is meteen zichtbaar of de nulmeting bruikbaar is.

**Een bevroren baselinewaarde.** Zodra het protocol start, sla gemiddelde, aantal metingen en spreiding van de nulmeting op als vaste waarde op gebruikersniveau, die daarna nooit meer verandert. De referentieband herberekent zich over alle sessies, dus zonder dit veld is het oorspronkelijke vertrekpunt na een paar weken niet meer terug te vinden. Het absolute vergelijkingspunt uit P3 steunt hierop.

**Uitsluiten uit de CART-reeks.** Net zoals bij rustcontroles in P2: nulmetingen tellen niet mee in weekgemiddelde, maandgemiddelde, referentieband of dagteller. Wel als eigen reeks op de trendgrafiek, zodat het vertrekpunt zichtbaar blijft.

Dit is ook het moment om `MIN_READINGS_FOR_BASELINE` te herbekijken, dat na P1b nog op 20 staat. Die drempel was bedoeld voor de voortschrijdende band. Voor de nulmeting is twintig een streefaantal voor volledigheid. Beslis of dat hetzelfde getal blijft.

**Gebouwd.** `sessionType: "nulmeting"`, met hetzelfde scherm als de rustcontrole (`RustcontroleLogger` met `kind`). Zolang het protocol niet gestart is, toont het beginscherm "Nulmeting: 14 van 20 metingen · meet nu". Het streefaantal telt meetmomenten, niet losse waarden (`NULMETING_TARGET_SESSIONS = 20`, drie per dag over zes à zeven dagen). De drempel voor de referentieband staat daar los van (`MIN_SESSIONS_FOR_BASELINE`, zie P1b). Bij de eerste protocolstart wordt de nulmeting bevroren als `nulmetingBaseline` in `settings/protocol` (gemiddelde, SD, aantal waarden, aantal meetmomenten, `frozenAt`). Een herstart overschrijft die nooit. Op de trendgrafiek staan de nulmetingen als eigen punten, en het bevroren gemiddelde als vaste stippellijn die ook zichtbaar blijft na 30 dagen.

### P13. Begeleidersaccount

**Blokkeert de eerste cliënt.**

Data staat onder `users/{uid}`, dus een cliënt die met zijn eigen account inlogt, zit in een afgesloten ruimte waar de begeleider niet in kan. Zonder oplossing blijven er twee uitwegen over: een gedeeld inlogaccount, wat een slechte constructie is voor de gegevensafspraak, of de cliënt na elke sessie handmatig een CSV laten doorsturen.

De minimale versie bestaat uit drie stukken.

**Een koppeling** tussen de uid van de begeleider en die van de cliënt. Een veld op het gebruikersdocument van de cliënt volstaat, of een apart koppelingsdocument.

**Firestore-regels** die de begeleider leesrecht geven op `users/{clientUid}/sessions/**` wanneer die koppeling bestaat. Dit is het enige stuk waar een fout meteen een datalek is, dus test expliciet twee dingen: een begeleider mag niets lezen van een cliënt waaraan hij niet gekoppeld is, en hij mag nergens schrijven.

**Een overzichtsscherm** waar de begeleider zijn cliënten ziet en er één kan openen, alleen-lezen.

Uitdrukkelijk alleen-lezen, ook later. Een begeleider die metingen van iemand anders kan aanpassen, maakt de data onbetrouwbaar, en het houdt de regels eenvoudiger.

**Voor cliënt één: koppel met de hand in Firestore.** Dat kost tien minuten en bespaart het bouwen van een uitnodigingsflow die pas nodig is bij een tweede cliënt.

Wat wel vóór een tweede cliënt af moet: de cliënt moet in de app kunnen zien wie toegang heeft en die kunnen intrekken. Voor de piloot volstaat een afspraak op papier plus handmatig verwijderen.

**Gebouwd (23/09, `09e327f`).** Koppeling op het gebruikersdocument van de cliënt: `users/{clientUid}.coachUids: [coachUid]`. Alleen dat veld verleent toegang, dus de cliënt beheert zelf wie mag lezen. De begeleider heeft `users/{coachUid}.clientUids` voor de eigen lijst. Dat veld geeft geen rechten, want de regels kijken alleen naar `coachUids` bij de cliënt. Optioneel `displayName` op het cliëntdocument voor de naam in de lijst. `firestore.rules` geeft de begeleider leesrecht op `users/{clientUid}/**`, schrijven blijft voorbehouden aan de eigenaar. Schermen: `/begeleiding`, `/begeleiding/[clientUid]`, `/begeleiding/[clientUid]/[sessionId]`. Alle schermen zijn alleen-lezen, en `useAverages` draait er zonder backfill. De link "Begeleiding" op het beginscherm verschijnt alleen voor wie `clientUids` heeft.

**Stand op 23/09:** de regels zijn door Thomas gepubliceerd in de console, en het eigen gebruik werkt. Niet getest in de Playground. Test bij de eerste koppeling in de praktijk: de gekoppelde cliënt verschijnt bij de begeleider, en een ongekoppeld account ziet niets.

Oorspronkelijke notitie: de regels zijn niet getest. Er is geen emulator in de repo, en geen Java of Firebase CLI op de ontwikkelmachine. Ze moeten bovendien met de hand gepubliceerd worden in de Firebase-console, want er is geen `firebase.json`. Test ze in de Rules Playground op deze vier gevallen:
1. Een begeleider leest `users/{client}/sessions/x` terwijl zijn uid in `coachUids` staat: toegelaten.
2. Dezelfde begeleider leest een cliënt waar hij niet in `coachUids` staat: geweigerd.
3. Een begeleider schrijft naar `users/{client}/sessions/x`: geweigerd.
4. Een begeleider leest een cliënt die geen gebruikersdocument heeft: geweigerd.

## 5. Wat er nog niet in zit en later komt

Uit de programmaontwerpnota, nog niet gepland als bouwwerk:

- Fase-besef over twaalf weken, met bewust afnemende meetintensiteit in fase 3
- Uitvoer voor de huisarts: nulmeting, verloop, slotmeting op één pagina
- Bandberekening en progressie afgeleid uit de nulmeting van de individuele gebruiker in plaats van uit constanten. De huidige standaardwaarden zijn gekalibreerd op één persoon, en die persoon is Thomas.

Op langere termijn lost eigen hardware met een data-uitgang het probleem uit P1b volledig op: een sidestream-opstelling met Bluetooth maakt manueel loggen overbodig. Dat is een apart traject van maanden en het mag P1b niet ophouden.

---

## 6. Open vragen voor Thomas

1. ~~P1b: is de bemonstering van ongeveer 30 seconden een week op jezelf getest, en ontbrak er iets in de data?~~ Getest, P1b is gebouwd.
2. ~~P5: mag de bandvloer ratelen?~~ Ja, vloer die nooit daalt, over een venster van 4 weken.
3. ~~P6: progressie koppelen aan CO2-respons?~~ Nee, kalender behouden.
4. ~~P9: wat telt als een voltooide sessie?~~ Minimaal 10 minuten.
5. P12: blijft twintig meetmomenten het streefaantal voor de nulmeting? Voorlopig wel. De banddrempel is los daarvan herbekeken: 4 CART-sessies in plaats van 20 metingen.
6. ~~P13: waar komt de koppeling te staan?~~ Op het gebruikersdocument van de cliënt (`coachUids`), zie P13. Aan Thomas voorgelegd bij de oplevering.
7. ~~Wat is de bron achter de vier follow-upmomenten in het rustcontroleplan?~~ Beantwoord op 23/09. De momenten kwamen uit een eerder gesprek met Claude, maar kloppen voor Meuret 2008: dat meet na de behandeling, op 2 en 12 maanden (abstract via PubMed, doi:10.1016/j.jpsychires.2007.06.005). CATCH meet op 1 en 6 maanden (doi:10.1378/chest.14-0665). Op vraag van Thomas is +6 maanden toegevoegd als vijfde moment, zodat beide trials gedekt zijn. Kanttekening: beide trials gaan over een andere doelgroep (paniekstoornis en astma), en daar gingen het om labmetingen door een geblindeerde beoordelaar.

---

## 7. Bewijsbasis achter deze instructies

Zodat een volgende sessie deze keuzes niet terugdraait zonder de reden te kennen.

| Bron | Wat het onderbouwt | Status |
|---|---|---|
| Ritz T, Rosenfield D, Steele AM, Millard MW, Meuret AE. Controlling Asthma by Training of Capnometry-Assisted Hypoventilation (CATCH) vs Slow Breathing. CHEST 2014;146(5):1237-1247 | Sessiestructuur 2/10/5, doel 40-42 mmHg, audio-gestuurde tonen, RR-progressie 13-11-9-6, het bewijs dat traag ademen zonder CO2-feedback de CO2 niet duurzaam verhoogt, en het gegeven dat de capnometer in de trial zelf registreerde zodat deelnemers niets manueel logden | Volledige tekst gelezen op 14 september 2026. Eindcontrole door Thomas conform projectprotocol nog nodig |
| Eigen N=1-analyse, zie `plan_post_trial_rustcontroles.md` | Sessiegemiddelde stijgt (p=0,038), baseline-proxy niet (p=0,94) | Eigen data van Thomas |
| Masimo, productpagina EMMA capnograaf | Het toestel meet en toont naast EtCO2 ook de ademfrequentie, wat de rechtstreekse RR-invoer uit P10 mogelijk maakt | Opgehaald op 14 september 2026, productpagina en niet de handleiding. Te bevestigen tegen de operator's manual |
| Meuret AE, Rosenfield D, Seidel A, et al. J Consult Clin Psychol 2010;78(5):691-704 | Mediatie-analyse: draagt de CO2-verandering het klinische effect? Rechtstreeks relevant voor P4 en P6 | Bestaan geverifieerd via bronnenlijst CATCH. Inhoud niet gelezen |
| Meuret AE, Wilhelm FH, Ritz T, et al. J Psychiatr Res 2008;42(7):560-568 | Oorspronkelijk CART-protocol bij paniekstoornis | Bestaan geverifieerd via bronnenlijst CATCH. Inhoud niet gelezen |
| Projectprotocol CHV | Terughoudende UI, spanning onderzoeker versus herstel | Eigen document |
