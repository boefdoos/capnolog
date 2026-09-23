# Implementatieplan: post-trial rustcontroles in CapnoLog

## Aanleiding

De retroactieve baseline-proxy (eerste 60s van elke sessie) toont nog geen trend, p=0,94,
terwijl het volledige sessiegemiddelde wel significant stijgt, p=0,038. De winst zit tot nu
toe in het actief gestuurde deel van de sessie, niet in het meest spontane moment ervan.
Om na te gaan of dat na afloop van het volledige protocol verandert, zijn losse, niet-actief
gestuurde meetmomenten nodig, in lijn met hoe de CART-trials op 2 en 12 maanden follow-up meten. *(Noot 23/09: deze bewering komt uit een gesprek met Claude en is niet geverifieerd. CATCH meet op 1 en 6 maanden, zie `docs/codeinstructies.md` §6 vraag 7.)*

## Scope van dit plan

Alleen de rustcontroles ná het actieve 4-wekenprotocol. Niet: wijzigingen aan de bestaande
CART-sessieflow, het gegradueerde RR-doel, of de analyseworkflow tijdens de actieve weken.

## Wanneer dit ingaat

Protocol-einde = `cartProtocolStartDate` + 28 dagen, dus rond 24/08 gegeven de herstart van
27/07. Dat is over ruim twee weken, geen haast, maar de datamodel-wijziging kan best al klaar
zijn voor die datum aanbreekt, zodat er geen gat valt tussen het einde van week 4 en de eerste
rustcontrole.

## Voorgesteld schema

Vier momenten, gespreid, niet frequent:

1. **+1 week na protocol-einde** (~31/08): vroege consolidatiecheck
2. **+1 maand** (~24/09): tussenpunt
3. **+2 maanden** (~24/10): komt overeen met de 2-maanden follow-up uit de trials
4. **+12 maanden** (~24/08/2027): komt overeen met de 12-maanden follow-up uit de trials

Vier momenten over een jaar, geen doorlopende herhaling daarna tenzij je dat zelf op dat moment
beslist. Bewust laagfrequent: het doel is een vergelijkingspunt met de literatuur, niet een
nieuw dagelijks ritueel.

## Wat een rustcontrole inhoudt

Kort, niet-gestuurd: 90 seconden tot 3 minuten stil zitten met de EMMA, geen ademdoel op het
scherm, geen live weergave die tot sturing uitnodigt. Puur meten wat er is. Dat onderscheidt
het van een CART-sessie, waar sturing net de bedoeling is.

## Datamodel

Nieuw veld `sessionType` op het sessie-document: `'cart'` (bestaand gedrag, ongewijzigd) of
`'rustcontrole'` (nieuw). Rustcontrole-sessies slaan dezelfde velden op als nu (kpa, mmHg,
tijd_s, rr_per_min-afgeleide) maar zonder de RR-doelweergave uit de gegradueerde protocol-
feature, en zonder invloed op de cumulatieve band of het weekdoel.

Nieuw veld op gebruikersniveau, bijvoorbeeld `nextRustcontrole` (datum), berekend uit
`cartProtocolStartDate + 28 dagen` plus de offsets hierboven, om de eerstvolgende geplande
check te kunnen tonen zonder dat er telkens herrekend moet worden.

## UI, zelfde terughoudendheid als de rest van het protocol

Één rustige regel ergens op het hoofdscherm zodra een rustcontrole binnen een paar dagen valt,
bijvoorbeeld "rustcontrole deze week beschikbaar", geen countdown, geen rode stip, geen melding
die opdringt. Gemist een moment, geen "gemiste check"-status, gewoon het eerstvolgende moment
tonen. Uitstellen zonder gevolg moet net zo makkelijk zijn als het nu doen.

## Wat dit betekent voor de analyseworkflow

Toekomstige analyseprompts, zoals die voor week 2, moeten `sessionType` filteren en
`rustcontrole`-sessies apart houden van CART-sessies in trendberekeningen, tenzij expliciet
gevraagd om ze naast elkaar te leggen. Dat is een aanpassing aan hoe ik toekomstige exports
lees, geen technische bouwvraag.

## Fasering

**Nu tot 24/08 (voor protocol-einde):** datamodel-veld `sessionType` toevoegen, rustcontrole-
sessiescherm bouwen (het niet-gestuurde meetscherm), `nextRustcontrole`-berekening.

**Rond 24/08:** eerste keer dat de UI de eerste rustcontrole aankondigt, in de praktijk testen.

**Daarna:** niets meer bouwen tot de vier momenten gepasseerd zijn en er voldoende rustcontrole-
data is om zelf te evalueren of het schema zinvol blijkt of aanpassing verdient.

## Expliciet niet te doen

Geen hergebruik van de volledige 17-minuten sessieflow voor rustcontroles. Geen RR-doel of live
grafiek tijdens een rustcontrole. Geen automatische herhaling voorbij de vier voorgestelde
momenten zonder jouw beslissing. Geen wijziging aan hoe bestaande CART-sessiedata of de
gegradueerde RR-target-feature werkt.
