# CapnoLog: UI-doorlichting

**Datum:** 23 september 2026
**Basis:** alle schermen doorlopen in Chrome op telefoonbreedte (414 px), live versie, account van Thomas, naast de code
**Status:** voorstel, nog niets van gebouwd

---

## 1. Het kernprobleem

De app is opgebouwd rond één handeling: een sessie loggen. Het traject zelf (nulmeting, dan vier weken CART, dan vijf rustcontroles) bestaat in de code, maar niet in de schermopbouw. Het beginscherm toont altijd hetzelfde: dagteller, week- en maandgemiddelde, evolutie, een groene knop "Start nieuwe sessie". Alles wat met de fase te maken heeft, staat eronder als kleine grijze tekstlink: "CART-protocol starten", "Nulmeting: 0 van 20 · meet nu", "herstart", "Volgende rustcontrole".

Gevolgen:

- Een nieuwe cliënt ziet als hoofdactie "Start nieuwe sessie", een CART-oefensessie, terwijl die in de nulmeetweek net niet mag oefenen. De actie die wel moet, de nulmeting, is een voetnoot.
- Na het protocol blijft "Start nieuwe sessie" de hoofdactie, terwijl de rustcontrole het enige is dat er dan nog telt.
- "herstart" staat als klein linkje naast de weekstatus. Eén tik zet de startdatum op vandaag en verschuift weekdoel en rustcontroles. Op 19/09 is dat gebeurd, en daardoor verdween het meetmoment van 24/09.

**Principe voor de herziening:** het beginscherm zegt in welke fase je zit en wat er vandaag van je verwacht wordt, met één hoofdactie die bij die fase hoort. Protocolbeheer (starten, herstarten, fasen) gaat naar een apart scherm.

---

## 2. Bevindingen per scherm

Ernst: **H** hoog (fout gedrag of verkeerde handeling ligt voor de hand), **M** middel (verwarrend of tegen de terughoudende UI in), **L** laag (afwerking).

### Beginscherm

| # | Ernst | Bevinding |
|---|---|---|
| B1 | H | Fase van het traject is onzichtbaar. Nulmeting, protocolstart en rustcontrole zijn tekstlinks onder de hoofdknop (zie deel 1). |
| B2 | H | "herstart" als los linkje naast de weekstatus, met enkel een browser-bevestiging. Verschuift weekdoel en rustcontroles. |
| B3 | H | Tijdens het laden stond er even "CART-protocol starten" en "Nulmeting: 0 van 20". Een tik daarop overschreef de echte startdatum. *Opgelost in `e5cbbd1`, nog niet gepusht.* |
| B4 | M | "Deze week 4,5 kPa" steunt op één meting uit een sessie van 6 seconden. Het weekgemiddelde kent geen minimum, de dagteller wel (10 minuten, P9). Twee cijfers naast elkaar met een verschillende definitie van "sessie". |
| B5 | M | Drie grote groene cijfers (dagteller, week, maand) bovenaan. Dat is precies het soort cijfer waar de terughoudende UI voor waarschuwt: het eerste wat je ziet is een score. mmHg en "594 metingen" eronder voegen niets toe voor de cliënt. |
| B6 | M | Evolutiegrafiek heeft drie stippellijnen (CART-doelzone, referentieband, nulmeting) zonder legende. Niet af te lezen welke lijn wat is. De band en de doelzone werden bovendien nooit ingekleurd. *Inkleuring opgelost in `5d12c3a`, nog niet gepusht.* |
| B7 | M | Dagteller "0 / 2 sessies · nog 2 sessies voor het CART-doel" staat er in elke fase, ook in de nulmeetweek en na het protocol, waar geen dagdoel van twee oefensessies geldt. |
| B8 | L | Ondertitel "EMMA capnograaf · ETCO2-sessies" is technisch en zegt niets over wat je hier doet. |
| B9 | L | Belangrijke acties in 11 px grijs op donkergrijs, met onderstreping als enige aanduiding. Klein doelwit op een telefoon, laag contrast. |

### Sessiescherm (CART)

| # | Ernst | Bevinding |
|---|---|---|
| S1 | H | De klok staat op 00:00 en de fasekaart ontbreekt tot je een eerste waarde logt. Er staat nergens dat de sessie pas start bij die eerste waarde. Wie stil gaat zitten met de ogen dicht zoals de rustfase vraagt, is in de app nog niet begonnen. |
| S2 | M | "Beëindig sessie" is een grote amberkleurige knop bovenaan, meteen boven het invoerveld, dus op de plek waar de duim het vaakst komt. Een afsluitknop hoort onderaan. |
| S3 | M | Zeven kaders onder elkaar: invoer, gebeurtenissen, gevoel, grafiek, statistieken, referentieband, log. Tijdens het oefenen heb je enkel de fasekaart, het invoerveld en eventueel verstoring en zucht nodig. Gevoel, log en de uitleg bij de band horen bij het afronden. |
| S4 | M | "Zucht: mislukt" in rood. Rood is een oordeel, en de terughoudende UI vermijdt net rode signalen. |
| S5 | L | Leeg kader onder de grafiek voor de eerste log (de statistiekenrij zonder inhoud). |
| S6 | L | Asopschrift "Tempo (afgeleid) / RR (/min)" op de lege grafiek: vakjargon, en het afgeleide tempo is sinds P10 geen meting meer. |
| S7 | L | Link "Geschiedenis" midden in een lopende sessie: één tik en je verlaat de oefening. |

### Afronden

| # | Ernst | Bevinding |
|---|---|---|
| A1 | L | Werkt. Zelfde leeg kader als S5. Gevoel staat hier en ook al op het sessiescherm: dubbel. |

### Rustcontrole en nulmeting

| # | Ernst | Bevinding |
|---|---|---|
| R1 | M | Zelfde probleem als S1: de klok loopt pas vanaf de eerste waarde. Voor een meting van 90 seconden tot 3 minuten is het net het begin dat telt. |
| R2 | M | Enkel een ondertitel legt uit wat er moet gebeuren. Geen aanwijzing wanneer je klaar bent, behalve zelf op de klok kijken. |
| R3 | M | Niet bereikbaar buiten het venster: na afloop van het venster of voor de nulmeting in een lopend protocol is er geen weg naartoe. Voor een cliënt klopt dat, voor de begeleider die iets wil tonen niet. |

### Geschiedenis

| # | Ernst | Bevinding |
|---|---|---|
| G1 | M | Het sessietype staat nergens. CART-sessies, rustcontroles en nulmetingen staan door elkaar met dezelfde opmaak, terwijl ze iets anders meten (P2). |
| G2 | M | "verwijder" op elke rij, naast het cijfer. Een onomkeerbare handeling op het eerste niveau. Hoort in het sessiedetail. |
| G3 | L | "BSR 100%" en de exportregel "Overzicht: week maand / Volledig (alle datapunten): week maand" zijn onbegrijpelijk zonder uitleg. |

### Begeleiding

| # | Ernst | Bevinding |
|---|---|---|
| C1 | L | Zelfde kaarten en grafiek als het eigen beginscherm. Nu opgevangen met de balk en de naam als titel. Bij de herziening van het beginscherm meteen dezelfde fase-opbouw per cliënt gebruiken: dat is voor de begeleider het nuttigste overzicht. |

---

## 3. Voorgestelde opbouw

### 3.1 Beginscherm per fase

Bovenaan één kaart "Nu", met de fase, wat er vandaag verwacht wordt en één hoofdknop. Daaronder de evolutie. Geen voetnootlinks meer.

| Fase | Kaart "Nu" | Hoofdknop | Wat verdwijnt |
|---|---|---|---|
| Nulmeting | "Nulmeting · 14 van 20 metingen · drie per dag, zonder oefenen" | **Rustmeting** | dagteller, week- en maandgemiddelde (er zijn nog geen CART-sessies) |
| CART week 1-4 | "Week 2 van 4 · streefdoel 11/min · vandaag 1 van 2" | **Start oefensessie** | nulmetingsregel |
| Na het protocol | "Volgende rustcontrole: donderdag 24 september", of in het venster "Rustcontrole beschikbaar" | **Rustcontrole** in het venster, anders geen grote knop | dagteller. Oefenen blijft kunnen als gewone knop eronder |

De overgang van nulmeting naar CART wordt een bewuste handeling: na de nulmeting toont de kaart "Nulmeting klaar · protocol starten", met het resultaat van de nulmeting erbij. Dat is ook het moment waarop die bevroren wordt.

### 3.2 Nieuw scherm "Traject"

Bereikbaar vanaf het beginscherm. Een tijdlijn met de fasen en hun data: nulmeting (met het bevroren resultaat), de vier CART-weken met hun streefdoel, en de vijf rustcontroles met datum en of ze gedaan zijn. Starten en herstarten van het protocol gebeurt enkel hier, met een eigen bevestigingsscherm dat zegt wat er verschuift. Geen browser-popup.

Dit scherm is ook de plek voor de begeleider: per cliënt dezelfde tijdlijn.

### 3.3 Sessiescherm

- Een echte startknop: de klok en de rustfase beginnen bij de tik op "Start", niet bij de eerste waarde. Het sessiedocument ontstaat nog altijd pas bij de eerste log, maar met de starttijd van de tik.
- Tijdens de sessie enkel: fasekaart, invoerveld, twee knoppen (verstoring, zucht). Zucht als één knop met daarna geslaagd of niet, in neutrale kleuren.
- "Beëindig sessie" onderaan, klein, en pas prominent na 17 minuten (dat gebeurt nu al automatisch, P8).
- Grafiek, log, gevoel en band enkel op het afrondscherm.

### 3.4 Geschiedenis

- Sessietype als label per rij (Oefensessie, Rustcontrole, Nulmeting), eventueel met een filter.
- Verwijderen enkel in het sessiedetail.
- Export in een eigen blok met gewone woorden: "Exporteer deze week" en "Exporteer deze maand", met een keuze tussen samenvatting en alle meetwaarden.

### 3.5 Doorlopend

- Legende of labels bij de lijnen in de evolutiegrafiek.
- Eén definitie van "sessie telt mee" voor dagteller en gemiddelden.
- Grotere, duidelijker tikdoelen voor secundaire acties.

---

## 4. Voorgestelde volgorde

1. Beginscherm per fase en het Trajectscherm (3.1, 3.2). Lost B1, B2, B7 en R3 op, en is de voorwaarde voor een eerste cliënt.
2. Sessiescherm (3.3). Lost S1 tot S7 en R1 op.
3. Geschiedenis (3.4) en de doorlopende punten (3.5).

## 5. Open vragen voor Thomas

1. Moeten week- en maandgemiddelde op het beginscherm blijven (B5), of verhuizen ze naar het Trajectscherm en blijft enkel de evolutiegrafiek?
2. Mag de begeleider de rustcontrole of nulmeting buiten het venster kunnen starten (R3), of blijft dat bewust dicht?
3. Na het protocol: blijft oefenen zichtbaar als knop, of enkel via het Trajectscherm?
