# CapnoLog: codeinstructies voor een volgende sessie

**Status:** Werkdocument, opgesteld na volledige codereview
**Datum:** 14 september 2026
**Doel:** Een sessie die hier koud instapt moet zonder verdere uitleg kunnen beginnen bouwen

---

## 0. Hoe dit document te gebruiken

Lees eerst deel 1. Alles daarna volgt eruit.

Volgorde van het werk: **P1 eerst**, want daar hangt een datum aan. **Daarna P1b**, want dat bepaalt of iemand anders dan Thomas dit programma kan volhouden. Pas dan de rest.

Vraag Thomas welk punt hij wil aanpakken voor je begint. Bouw niet de hele lijst in één keer.

**Projectgegevens.** Repo `boefdoos/capnolog`, branch `main`. Next.js 14 App Router, TypeScript, Tailwind 3, Firebase Auth en Firestore, Chart.js 4. Buildcheck: `npx next build`. Deployment via Vercel op elke push naar `main`.

**Datamodel.** `users/{uid}/sessions/{sessionId}` met metadata en aggregaten, subcollectie `entries/{entryId}` met `type`, `subtype`, `tSec`, `kpa`. De velden `idx`, `delta`, `mmHg` en `rr` worden client-side afgeleid in `deriveEntries` en nooit opgeslagen. Protocolinstellingen staan in `users/{uid}/settings/protocol`.

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

`computeAvgRR` en de `rr`-afleiding in `deriveEntries` berekenen de ademfrequentie uit het interval tussen twee opeenvolgende gelogde metingen. Bij loggen per zevende adem rapporteren die een zevende van de werkelijke frequentie, zonder foutmelding. Dat moet ofwel de bemonsteringsfactor kennen, ofwel verdwijnen. Zie ook P10.

Sessiegemiddelden blijven vergelijkbaar met de oudere per-adem data, want beide zijn zuivere schattingen van hetzelfde gemiddelde. Wat wel verandert is de snelheid waarmee de referentieband aan metingen komt: `MIN_READINGS_FOR_BASELINE` van 20 wordt nu binnen één sessie gehaald in plaats van binnen enkele. Kijk na of die drempel nog zinvol is.

Sla de gebruikte bemonstering per sessie op, bijvoorbeeld `logEveryNthBreath`, zodat later analyseerbaar blijft welke sessies per adem en welke bemonsterd zijn.

**Volgorde binnen dit punt.** Test eerst alleen het interval, zonder pacer en zonder fasestructuur, een week lang op Thomas zelf. Ontbreekt er daarna niets in de data, dan is het probleem opgelost voor een fractie van het werk. Pacer en fasestructuur komen daarna.

**Dit punt absorbeert P7 en P8.** Die staan hieronder nog apart voor de details, maar ze zijn onderdeel van dit werk geworden.

### P2. De twee reeksen overal scheiden

**Status: uitgevoerd op 14 september 2026.** `computeWindow`, `computeBaselineBand` en `computeSessionsToday` in `src/lib/useAverages.ts` filteren nu op `sessionType === "cart"`. `computeTrend` geeft een `Trend`-object `{ cart, rustcontrole }` terug; `TrendChart` toont de rustcontroles als losse, niet-verbonden punten (geen lijn, om geen continu verloop te suggereren over enkele sporadische momenten). Getest in Chrome: een testrustcontrole liet "vandaag", weekgemiddelde en trend ongemoeid en verscheen enkel als apart punt op de grafiek.

Zodra P1 bestaat, vervuilen rustcontroles de CART-cijfers en omgekeerd. `src/lib/useAverages.ts` berekent nu alles over alle sessies zonder filter: `computeWindow`, `computeBaselineBand`, `computeTrend` en `computeSessionsToday`.

Alle vier moeten filteren op `sessionType`. Concreet:

- Week- en maandgemiddelde: enkel `cart`
- Referentieband: enkel `cart`, conform het plan
- `computeSessionsToday`: enkel `cart`, want het CART-doel van twee sessies per dag gaat over oefensessies
- Trend: twee aparte reeksen, of minstens een tweede reeks voor rustcontroles

De trendgrafiek op het startscherm moet beide tonen, met de rustcontroles duidelijk onderscheiden. Dat is de grafiek die het verschil tussen gestuurd en spontaan zichtbaar maakt, en dat is de hele reden dat dit gebouwd wordt.

### P3. Absoluut trajectdoel toevoegen

**Status: uitgevoerd op 14 september 2026.** `CART_GOAL_KPA_LOW`/`CART_GOAL_KPA_HIGH` (5.33-5.60 kPa) staan in `src/types/capnolog.ts`. `TrendChart` toont ze als vaste, teal gestippelde horizontale lijnen die nooit meebewegen met de data, los van de meebewegende referentieband. Getest in Chrome: de zone staat op de juiste hoogte (5,33/5,60 op de as) en blijft onafhankelijk van de sessiedata.

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

**Status: uitgevoerd op 14 september 2026.** `src/lib/compensation.ts` (`checkCompensation`) vergelijkt de huidige sessie met het gemiddelde van de laatste 5 eerdere CART-sessies (minstens 3 nodig, anders geen uitspraak): RR-daling van minstens 5% zonder dat de gemiddelde kPa meestijgt → gevlagd. `CompensationNote.tsx` toont dat enkel op het "Sessie afronden"-scherm, neutrale toon, geen alarmkleur.

Belangrijke valkuil vermeden: `meta.readingCount`/`kpaSum`/`lastTSec` uit `useActiveSession` worden nooit live bijgewerkt (P11) en staan dus altijd op 0. De huidige sessie wordt daarom herrekend uit de wél live gesynchroniseerde `entries`, niet uit `meta`. De historische baseline gebruikt wel de opgeslagen sessie-aggregaten (`readingCount`, `lastTSec`, `kpaSum`), zonder de entries van oude sessies te moeten ophalen.

Logica geverifieerd met synthetische testcases (RR daalt zonder kPa-stijging → gevlagd; RR daalt mét kPa-stijging → niet gevlagd; RR ongewijzigd → niet gevlagd; te weinig historiek of enkel rustcontroles in de baseline → niet gevlagd). In Chrome getest op een korte testsessie: geen console-fouten, geen vals-positieve melding tegenover Thomas' echte recente data.

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

### P6. Progressie op respons in plaats van op kalender

`computeCartWeekTarget` in `src/lib/useCartProtocol.ts` schuift puur op verstreken dagen door: 13, 11, 9, 6 per week. Wie op 11 nog geen CO2-respons haalt, wordt na veertien dagen naar 9 geduwd.

De stap van 9 naar 6 is bovendien de grootste, een reductie van 33 procent tegenover ongeveer 15 tot 20 procent bij de vorige stappen. Bij zes ademhalingen per minuut duurt een cyclus tien seconden, en de neiging om dat met diepere teugen op te vangen is dan het sterkst. Precies waar de eis het zwaarst is, is compensatie het waarschijnlijkst.

Voorstel: laat de volgende frequentie pas vrijkomen wanneer de huidige betrouwbaar een CO2-stijging oplevert. Behoud de kalender als bovengrens zodat niemand vastloopt, maar niet als enige criterium. Dit hangt samen met P4: dezelfde berekening voedt beide.

Dit is een gedragswijziging aan het protocol. Bespreek ze met Thomas voor je ze bouwt.

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

### P10. RR eerlijk benoemen

`deriveEntries` leidt de ademfrequentie af uit het interval tussen twee opeenvolgende **gelogde** metingen. Het codecommentaar erkent dit al. Bij manuele invoer is dat de logfrequentie, niet de ademfrequentie: één overgeslagen log verdubbelt het interval en halveert de schijnbare RR.

`StatsRow` toont dat als "RR gem." met nul decimalen, wat als een meting oogt. Label het zo dat duidelijk is dat het een afleiding uit de invoer is.

Na P1b wordt dit dwingend in plaats van cosmetisch: bij bemonsterd loggen klopt de afgeleide RR gewoon niet meer zonder correctie met de bemonsteringsfactor.

### P11. Kleiner spul

`meta` wordt niet live gesynct, alleen `entries`. `metaRef.current` wordt bij aanmaak gevuld met nullen en daarna nooit uit Firestore bijgewerkt. Wie later een feature bouwt die tijdens een sessie `meta.readingCount` uitleest, krijgt altijd nul. Zet daar een commentaar bij of sync meta alsnog.

`ensureSession` houdt lokaal `createdAt: Date.now()` aan maar schrijft `serverTimestamp()` weg. Bij klokverschil tussen toestel en server wijkt de opgeslagen `createdAt` af van de basis waarop alle `tSec` berekend zijn. Intervallen blijven kloppen, absolute tijdstippen niet helemaal.

`useAverages` haalt tot duizend sessies op en rekent alles client-side. Prima voor één gebruiker. Zodra er een begeleidersweergave over meerdere cliënten komt, moet dat naar server-side aggregatie.

---

## 5. Wat er nog niet in zit en later komt

Uit de programmaontwerpnota, nog niet gepland als bouwwerk:

- Fase-besef over twaalf weken, met bewust afnemende meetintensiteit in fase 3
- Begeleidersweergave over meerdere cliënten
- Uitvoer voor de huisarts: nulmeting, verloop, slotmeting op één pagina
- Bandberekening en progressie afgeleid uit de nulmeting van de individuele gebruiker in plaats van uit constanten. De huidige standaardwaarden zijn gekalibreerd op één persoon, en die persoon is Thomas.

Op langere termijn lost eigen hardware met een data-uitgang het probleem uit P1b volledig op: een sidestream-opstelling met Bluetooth maakt manueel loggen overbodig. Dat is een apart traject van maanden en het mag P1b niet ophouden.

---

## 6. Open vragen voor Thomas

1. P1b: is de bemonstering van ongeveer 30 seconden een week op jezelf getest, en ontbrak er iets in de data?
2. P5: mag de bandvloer ratelen, dus nooit meer dalen? En blijft de band cumulatief of gaat hij naar een venster?
3. P6: akkoord om de progressie te koppelen aan CO2-respons in plaats van aan de kalender?
4. P9: wat telt als een voltooide sessie, een minimumduur of een minimumaantal metingen?
5. Wat is de bron achter de vier follow-upmomenten in het rustcontroleplan? Er staat "2 en 12 maanden follow-up uit de trials", terwijl CATCH op 1 en 6 maanden meet. Mogelijk komt het uit Meuret 2008, nog te verifiëren.

---

## 7. Bewijsbasis achter deze instructies

Zodat een volgende sessie deze keuzes niet terugdraait zonder de reden te kennen.

| Bron | Wat het onderbouwt | Status |
|---|---|---|
| Ritz T, Rosenfield D, Steele AM, Millard MW, Meuret AE. Controlling Asthma by Training of Capnometry-Assisted Hypoventilation (CATCH) vs Slow Breathing. CHEST 2014;146(5):1237-1247 | Sessiestructuur 2/10/5, doel 40-42 mmHg, audio-gestuurde tonen, RR-progressie 13-11-9-6, het bewijs dat traag ademen zonder CO2-feedback de CO2 niet duurzaam verhoogt, en het gegeven dat de capnometer in de trial zelf registreerde zodat deelnemers niets manueel logden | Volledige tekst gelezen op 14 september 2026. Eindcontrole door Thomas conform projectprotocol nog nodig |
| Eigen N=1-analyse, zie `plan_post_trial_rustcontroles.md` | Sessiegemiddelde stijgt (p=0,038), baseline-proxy niet (p=0,94) | Eigen data van Thomas |
| Meuret AE, Rosenfield D, Seidel A, et al. J Consult Clin Psychol 2010;78(5):691-704 | Mediatie-analyse: draagt de CO2-verandering het klinische effect? Rechtstreeks relevant voor P4 en P6 | Bestaan geverifieerd via bronnenlijst CATCH. Inhoud niet gelezen |
| Meuret AE, Wilhelm FH, Ritz T, et al. J Psychiatr Res 2008;42(7):560-568 | Oorspronkelijk CART-protocol bij paniekstoornis | Bestaan geverifieerd via bronnenlijst CATCH. Inhoud niet gelezen |
| Projectprotocol CHV | Terughoudende UI, spanning onderzoeker versus herstel | Eigen document |
