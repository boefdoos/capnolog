"use client";

import Link from "next/link";
import { useState } from "react";
import AuthGate from "@/components/AuthGate";
import TabBar from "@/components/TabBar";

/**
 * Uitleg voor de begeleider, een kinesitherapeut die de app en de methode
 * niet van binnenuit kent. Vaste pagina om op terug te vallen, geen
 * rondleiding. Afdrukbaar (of als pdf te bewaren) om door te geven.
 * Cijfers hier moeten blijven kloppen met de constanten in
 * src/types/capnolog.ts en src/lib/useAverages.ts.
 */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel space-y-2.5 text-sm leading-relaxed text-text print:break-inside-avoid">
      <h2 className="text-xs uppercase tracking-wide text-muted">{title}</h2>
      {children}
    </section>
  );
}

/**
 * Het afdrukvenster opent op iOS soms pas na lange tijd, zonder dat de pagina
 * reageert. Meteen tonen dat er iets gebeurt, en een tweede tik negeren: die
 * zette anders telkens een extra afdrukopdracht in de wachtrij.
 */
function PrintButton() {
  const [opening, setOpening] = useState(false);
  function print() {
    if (opening) return;
    setOpening(true);
    // Eerst de nieuwe knoptekst laten tekenen, dan pas het (blokkerende)
    // afdrukvenster openen.
    setTimeout(() => {
      window.print();
      setOpening(false);
    }, 50);
  }
  return (
    <button
      onClick={print}
      disabled={opening}
      className="shrink-0 rounded-lg border border-panel-border px-3 py-2 text-xs text-muted hover:text-text disabled:opacity-60 print:hidden"
    >
      {opening ? "Afdrukvenster openen\u2026" : "Afdrukken of pdf"}
    </button>
  );
}

function UitlegInner({ uid }: { uid: string }) {
  return (
    <div className="mx-auto max-w-2xl p-4 pb-24 print:max-w-none print:p-0">
      <header className="mb-4 flex items-end justify-between gap-3 border-b border-panel-border pb-3.5">
        <div>
          <Link
            href="/begeleiding"
            prefetch={false}
            className="text-xs text-muted underline decoration-panel-border underline-offset-2 hover:text-text print:hidden"
          >
            &lsaquo; Cliënten
          </Link>
          <h1 className="mt-1 text-[19px] font-semibold tracking-wide">Uitleg</h1>
          <p className="text-[12.5px] text-muted">Voor de begeleidende kinesitherapeut</p>
        </div>
        <PrintButton />
      </header>

      <div className="space-y-3.5">
        <Section title="Verloop">
          <p>
            Het programma heeft drie delen. De cliënt meet met een Masimo EMMA-capnograaf en tikt de waarden in
            de app in. De EMMA geeft tijdens het oefenen zelf de feedback, de app houdt het verloop bij.
          </p>
          <p>
            <strong>Startweek.</strong> Vijf tot zeven dagen, drie rustmetingen per dag, nog geen oefeningen. Een
            rustmeting duurt 2 minuten rustig zitten, en de cliënt tikt twee keer de CO2-waarde (ETCO2) van de EMMA
            in, na 60 en na 110 seconden. Het streefaantal is 20 rustmetingen. Wanneer de CO2-training start, wordt
            het gemiddelde van de startweek vastgelegd als vertrekpunt. Dat verandert daarna niet meer, ook niet
            als de training later opnieuw gestart wordt.
          </p>
          <p>
            <strong>CO2-training.</strong> Vier weken, twee oefeningen per dag van 17 minuten. Elke oefening heeft
            drie fasen: 2 minuten tot rust komen, 10 minuten ademen op het ritme van een toon, en 5 minuten zelf
            verder ademen zonder toon. Het ritme daalt per week: 13, 11, 9 en 6 ademhalingen per minuut. Ongeveer
            elke 30 seconden geeft de app een signaal, en dan tikt de cliënt de CO2-waarde in. In de eerste en de
            laatste fase tikt de cliënt ook één keer het aantal ademhalingen per minuut van de EMMA in. Een
            oefening telt mee vanaf 10 minuten.
          </p>
          <p>
            <strong>Opvolging.</strong> Na de vier weken volgen rustmetingen 1 week, 1 maand, 2 maanden, 6 maanden
            en 12 maanden na het einde van de training. Een rustmeting is telkens beschikbaar vanaf 3 dagen voor
            de datum.
          </p>
          <p>
            De cliënt start de CO2-training zelf, op het scherm Traject. Jij kunt dat niet doen of tegenhouden
            vanuit de app.
          </p>
        </Section>

        <Section title="Weinig meldingen">
          <p>
            Er zijn geen herinneringen, geen aftellers, geen meldingen over gemiste oefeningen en geen badges.
            Dat is bewust. Bij chronische hyperventilatie kan veel meten en opvolgen het piekeren over de
            ademhaling net versterken. De app toont zo weinig cijfers als nodig, en het gesprek met jou is de
            plek waar het verloop besproken wordt.
          </p>
        </Section>

        <Section title="Bronnen">
          <p>
            De CO2-training volgt de CART-methode (capnometry-assisted respiratory training). Het werkzame deel
            is minder ventileren, zodat de CO2-waarde stijgt. Trager ademen op zich is niet genoeg.
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              Meuret AE, Wilhelm FH, Ritz T, et al. J Psychiatr Res 2008;42(7):560-568. De oorspronkelijke
              methode, bij paniekstoornis. Opvolging na 2 en 12 maanden.
            </li>
            <li>
              Ritz T, Rosenfield D, Steele AM, Millard MW, Meuret AE. CHEST 2014;146(5):1237-1247 (CATCH). CART
              bij astma. Daaruit komen de opbouw van een oefening (2, 10 en 5 minuten), het ritme 13, 11, 9 en 6,
              en de opvolging na 1 en 6 maanden. In de vergelijkingsgroep die traag ademde zonder CO2-feedback,
              steeg de CO2 tijdens de behandeling, maar na 6 maanden stond ze terug op de beginwaarde (35,6 naar
              35,6 mmHg). Enkel de groep met CO2-feedback hield de stijging vast.
            </li>
          </ul>
          <p>
            Twee kanttekeningen. Beide studies gingen over paniekstoornis en astma, niet over chronische
            hyperventilatie. En in de studies registreerde de capnometer zelf alle waarden. Hier tikt de cliënt
            een steekproef in, omdat de EMMA geen data-uitgang heeft.
          </p>
        </Section>

        <Section title="Cijfers">
          <p>
            Waarden staan in kPa, zoals de EMMA ze toont. 1 kPa is ongeveer 7,5 mmHg. De EMMA toont 0,0 tot 9,9
            kPa.
          </p>
          <p>
            <strong>Gezond bereik.</strong> 35 tot 45 mmHg (4,7 tot 6,0 kPa), vast aangeduid op de grafiek. Dat
            is de gangbare referentie voor gezonde volwassenen, geen doel dat specifiek voor chronische
            hyperventilatie onderbouwd is.
          </p>
          <p>
            <strong>Persoonlijk bereik.</strong> Het gemiddelde ± 1 standaardafwijking van de oefeningen van de
            laatste 4 weken, vanaf 4 oefeningen. De ondergrens zakt nooit onder het beste niveau dat de cliënt al
            bereikte (gerekend over 4 weken met minstens 6 oefeningen), zodat een slechte week het bereik niet
            mee omlaag trekt. Zijn er nog geen 4 oefeningen, dan is het bereik het gemiddelde ± 1
            standaardafwijking van de startweek, en zonder startweek een vaste standaard van 3,8 tot 4,9 kPa. Let
            op: het is een spreidingsmaat, geen streefdoel. Ongeveer twee derde van de waarden valt er per
            definitie binnen.
          </p>
          <p>
            <strong>Twee reeksen.</strong> Tijdens een oefening stuurt de
            cliënt de ademhaling, en daar stijgt de CO2-waarde sneller dan in rust. Of het rustniveau echt
            verschuift, zie je aan de rustmetingen van de opvolging, niet aan de oefeningen. Rustmetingen tellen
            daarom nergens mee in gemiddelden of in het persoonlijk bereik, en staan apart op de grafiek. Het
            vertrekpunt van de startweek staat er als stippellijn bij.
          </p>
          <p>
            <strong>Compensatie.</strong> Na een oefening ziet de cliënt soms: &ldquo;Je ademde trager, maar je
            CO2-waarde steeg niet mee.&rdquo; Dat verschijnt wanneer de ademfrequentie minstens 5% lager lag dan
            het gemiddelde van de laatste 5 oefeningen (minstens 3), terwijl de CO2-waarde niet steeg. Meestal
            betekent dat trager maar dieper ademen, waardoor de ventilatie gelijk blijft. Dat is de belangrijkste
            valkuil van de methode en een goed onderwerp voor het gesprek. De ademfrequentie is hier een
            benadering, afgeleid uit het tempo waarin de cliënt waarden intikt. Die melding staat voorlopig niet
            in jouw overzicht.
          </p>
        </Section>

        <Section title="Na de startweek">
          <p>
            Bij de cliënt zie je hoeveel rustmetingen er al zijn (streefaantal 20) en, zodra de training gestart
            is, het vastgelegde gemiddelde met de spreiding. Omdat dat vertrekpunt vastligt bij de start, loont
            het om samen na te gaan of de startweek volledig genoeg is voor de cliënt de CO2-training start, en
            of het meten en intikken met de EMMA vlot loopt.
          </p>
        </Section>

        <Section title="Praktisch">
          <p>
            <strong>Uitnodigen.</strong> Onder Begeleiding vul je de naam van de cliënt en je eigen
            naam in, en maak je een link. Die is 14 dagen geldig en werkt één keer. De cliënt maakt daarmee een
            eigen account aan met een eigen wachtwoord.
          </p>
          <p>
            <strong>Overzicht.</strong> De startweek, de vier weken training met het gemiddelde per week, de
            opvolgmomenten, de evolutie over het hele traject, en elke oefening en rustmeting in detail.
          </p>
          <p>
            <strong>Rechten.</strong> Je kunt niets wijzigen, verwijderen of starten. De cliënt kan je
            toegang op elk moment intrekken onder Account, en dan verdwijnt de cliënt uit je lijst.
          </p>
          <p>
            <strong>Afmelden.</strong> Wanneer je afmeldt, worden de gegevens van je cliënten van dit toestel
            gewist.
          </p>
        </Section>
      </div>
      <div className="print:hidden">
        <TabBar uid={uid} />
      </div>
    </div>
  );
}

export default function UitlegPage() {
  return <AuthGate>{(user) => <UitlegInner uid={user.uid} />}</AuthGate>;
}
