# CapnoLog

CO2-sessielogger voor de EMMA capnograaf. Next.js (App Router) + TypeScript + Tailwind + Firebase (Auth + Firestore), geoptimaliseerd voor telefoon/tablet en installeerbaar als PWA.

## 1. Firebase-project opzetten

1. [console.firebase.google.com](https://console.firebase.google.com) &rarr; nieuw project.
2. **Build &rarr; Authentication &rarr; Sign-in method** &rarr; Google inschakelen.
3. **Build &rarr; Firestore Database** &rarr; database aanmaken (production mode).
4. **Project settings &rarr; Your apps** &rarr; webapp toevoegen (`</>`) &rarr; kopieer de config-waarden.
5. Firestore-regels: `firebase deploy --only firestore:rules` (met de [Firebase CLI](https://firebase.google.com/docs/cli), na `firebase init` en koppeling aan dit project), of plak de inhoud van `firestore.rules` manueel in de Firestore-console onder **Rules**.

## 2. Lokaal draaien

```bash
cp .env.example .env.local
# vul de Firebase-waarden in .env.local in
npm install
npm run dev
```

## 3. Naar GitHub (boefdoos/capnolog)

```bash
git init
git add .
git commit -m "CapnoLog: initiele versie"
git branch -M main
git remote add origin https://github.com/boefdoos/capnolog.git
git push -u origin main
```

## 4. Deployment via Vercel

1. [vercel.com/new](https://vercel.com/new) &rarr; importeer `boefdoos/capnolog`.
2. Framework wordt automatisch als Next.js gedetecteerd.
3. **Environment Variables**: voeg alle zes `NEXT_PUBLIC_FIREBASE_*` waarden uit `.env.local` toe (Production, Preview en Development).
4. Deploy. Elke push naar `main` deployt automatisch opnieuw.
5. In de Firebase console, **Authentication &rarr; Settings &rarr; Authorized domains**: voeg het Vercel-domein toe (bv. `capnolog.vercel.app`), anders weigert Google sign-in op de live URL.

## 5. Op telefoon/tablet installeren

Open de Vercel-URL in Chrome (Android) of Safari (iOS) &rarr; "Toevoegen aan startscherm" / "Install app". De app verschijnt dan als icoon, los van de browserbalk.

## Architectuur

- **Auth:** Firebase Google sign-in, een vast account, cross-device.
- **Data:** `users/{uid}/sessions/{sessionId}` (metadata: band, aggregaten) met subcollectie `entries/{entryId}` (type, subtype, tSec, kpa). `idx`/`delta`/`mmHg` worden client-side afgeleid, niet opgeslagen.
- **Sessie start pas bij de eerste log** (meting, klacht-markering of zucht): het sessiedocument wordt lazy aangemaakt, `tSec` van de eerste entry is dus altijd ~0.
- **Plausibel bereik** voor metingen is vast ingesteld op 0,0&ndash;9,9 kPa: het effectieve displaybereik van de EMMA (kPa-versie), geen instelbare/klinische drempel.
- Geen offline-caching: Firestore vereist sowieso verbinding, de service worker is enkel aanwezig voor PWA-installatiecriteria.
