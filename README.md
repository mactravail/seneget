# SeneGet

App mobile pensata per le **persone cieche o ipovedenti**: usa la fotocamera del telefono e un modello di visione AI (Claude) per **descrivere a voce, in tempo reale, ciò che l'utente ha davanti**. Diventa i suoi occhi, per aiutarla a camminare in sicurezza.

L'utente apre l'app e la fotocamera si attiva da sola. L'AI osserva la scena in continuo e, ogni volta che qualcosa di importante cambia, pronuncia una frase breve e naturale — *"A circa dieci metri sta arrivando un autobus rosso, numero 12."*, *"Alla tua destra c'è una porta."*, *"Una persona sta attraversando davanti a te."*

**L'audio è l'unica interfaccia: nessuna descrizione viene mostrata a schermo.**

---

## Principi

- **Voice first** — l'app parla, non scrive. Niente testo da leggere.
- **Solo ciò che vede** — mai dettagli inventati. Se il modello non è sicuro usa *"sembra esserci…"* o tace.
- **Priorità alla sicurezza** — prima gli ostacoli immediati e le persone, poi il resto.
- **Niente ripetizioni** — parla solo quando la scena cambia (nuovo oggetto, oggetto scomparso, cambio di distanza, direzione o situazione).
- **Bassa latenza** — frasi corte, un frame ogni ~1s, una richiesta alla volta.

---

## Stack

- **App:** React Native + Expo (SDK 57), Expo Router, TypeScript
- **Fotocamera:** `expo-camera` (`CameraView`)
- **Frame:** ridimensionati con `expo-image-manipulator` prima dell'invio
- **Voce (TTS):** `expo-speech` (sintesi vocale in italiano)
- **AI:** Claude (Anthropic) via **API route Expo** (`/api/analyze`) — la chiave resta lato server
- **Output AI:** JSON strutturato (structured outputs) validato contro uno schema

---

## Prerequisiti

- Node.js 18+ (testato con 24)
- Una chiave API Anthropic
- Per provarla su telefono: l'app **Expo Go** (Android) oppure la fotocamera (iOS) per scansionare il QR.
  In alternativa un emulatore Android / simulatore iOS.

> La fotocamera **non funziona nell'emulatore web**: serve un dispositivo o emulatore reale.
> Sul web (`index.web.tsx`) è servita solo la home page di presentazione.

---

## Configurazione

```bash
cd seneget
cp .env.example .env
```

Apri `.env` e inserisci la tua chiave:

```
ANTHROPIC_API_KEY=sk-ant-...
```

### Scelta del modello

Il default è `claude-haiku-4-5` — il più veloce ed economico, con la minore latenza: ideale per la
descrizione **frame-by-frame** in continuo. Per descrizioni più accurate (ma più lente e costose)
puoi passare a Opus:

```
ANTHROPIC_MODEL=claude-opus-4-8
```

Entrambi i modelli supportano vision e output JSON strutturato.

---

## Avvio

```bash
npx expo start
```

Poi:
- **Android:** apri **Expo Go** e scansiona il QR nel terminale.
- **iOS:** scansiona il QR con l'app Fotocamera e apri in Expo Go.
- **Emulatore:** premi `a` (Android) o `i` (iOS) nel terminale.

Concedi l'accesso alla fotocamera, punta il telefono davanti a te e ascolta. Un **tocco sullo schermo** mette in pausa o riprende le descrizioni.

> **Rete:** in sviluppo l'app rileva automaticamente l'host del dev server (Metro) per raggiungere `/api/analyze`,
> quindi il telefono deve essere sulla **stessa rete Wi-Fi** del computer.
> Per build standalone/produzione imposta `EXPO_PUBLIC_API_URL` all'URL pubblico dell'API.

---

## Come funziona

```
Fotocamera ──(1 frame / ~1s)──▶ resize 768px + JPEG base64
        │
        ▼
POST /api/analyze  (server, Expo API route)
        │  costruisce la richiesta a Claude:
        │  immagine + istruzioni + riepilogo della scena precedente
        ▼
Claude (vision, JSON strutturato) ──▶ Scene { speech, changed, summary, alert, objects }
        │
        ▼
se `changed` e `speech` non vuoto ──▶ expo-speech pronuncia la frase (in italiano)
        │
        ▼
`summary` viene rimandato al frame successivo per rilevare i cambiamenti
```

- **Nessun dettaglio inventato:** il modello descrive solo ciò che vede; quando non è sicuro usa *"sembra esserci…"* o omette.
- **Niente ripetizioni:** il modello confronta la scena con il `summary` dell'ultima frase pronunciata e parla solo se qualcosa di rilevante è cambiato.
- **Avvisi:** quando `alert` è vero (ostacolo immediato / pericolo) la frase interrompe subito quella eventualmente in corso.
- L'utente non vede mai i dati strutturati (`objects`, distanze, confidenza): servono solo a generare la voce.

### File principali

| File | Ruolo |
|------|-------|
| `src/components/vision-screen.tsx` | Fotocamera + loop di cattura e descrizione a voce (il cuore dell'app) |
| `src/app/index.tsx` | Route nativa `/`: apre subito la fotocamera |
| `src/app/index.web.tsx` | Home page di presentazione (solo web) |
| `src/app/login.tsx` | Login (flusso web «Provala → Login → App») |
| `src/app/api/analyze+api.ts` | Backend: chiama Claude con l'immagine e restituisce la `Scene` JSON |
| `src/lib/types.ts` | Tipo `Scene`, oggetti rilevati, schema JSON |
| `src/lib/analyze.ts` | Client: invia il frame all'API (con auto-rilevamento dell'host) |
| `src/lib/speech.ts` | Sintesi vocale in italiano (`expo-speech`) |

---

## Note su costi e latenza

Una vera chiamata a un modello di visione richiede ~1–3s e ha un costo per immagine.
Per questo l'app cattura in continuo ma invia al modello solo **un frame ogni ~1s** e mai in sovrapposizione
(una richiesta alla volta). Regola l'intervallo in `src/components/vision-screen.tsx` (`FRAME_INTERVAL_MS`).

## Prossimi passi

- Regolazione di velocità e voce della sintesi vocale nelle impostazioni.
- Gesti dedicati (es. doppio tocco) per ripetere l'ultima descrizione.
- Segnale acustico distinto per gli avvisi di pericolo prima della frase.
- Feedback aptico (vibrazione) per gli ostacoli immediati.
