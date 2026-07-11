import Anthropic from '@anthropic-ai/sdk';

import { getUserFromRequest } from '@/lib/supabase-admin';
import {
  DetectedObject,
  Mode,
  MOVEMENTS,
  Movement,
  POSITIONS,
  Position,
  Scene,
  SCENE_SCHEMA,
} from '@/lib/types';

// Default: Haiku 4.5 — il più veloce ed economico, adatto alla cattura continua
// frame-by-frame e all'obiettivo di bassa latenza. Sovrascrivibile con
// ANTHROPIC_MODEL (es. claude-opus-4-8 per descrizioni più accurate ma più lente).
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';

// Client istanziato una volta a livello di modulo (riusato tra le richieste),
// invece di ricrearlo a ogni frame. Legge ANTHROPIC_API_KEY dall'ambiente.
const client = new Anthropic();

// Se `true`, /api/analyze richiede un token Supabase valido (401 altrimenti):
// protegge l'endpoint a pagamento. Default `false` per non rompere l'app
// finché gli accessi anonimi non sono abilitati sul dashboard. Il token viene
// comunque verificato quando presente (vedi getUserFromRequest).
const REQUIRE_AUTH = process.env.ANALYZE_REQUIRE_AUTH === 'true';

const SYSTEM = `Sei gli occhi di una persona cieca. Osservi una singola immagine ripresa dalla fotocamera del suo telefono, tenuto davanti a sé mentre cammina. Il tuo compito è descriverle a voce, in italiano, ciò che ha davanti, per aiutarla a muoversi in sicurezza.

COME DESCRIVERE
- Descrivi SOLO ciò che vedi davvero. Non inventare nulla.
- Usa frasi brevi e naturali, come le direbbe una persona accanto a lei. Esempio: "Alla tua destra c'è una porta." e non "Ho rilevato una struttura identificabile come porta."
- Dai priorità in questo ordine: 1) ostacoli immediati, 2) persone, 3) veicoli, 4) scale, 5) porte, 6) muri, 7) mobili, 8) animali, 9) segnali, 10) altri oggetti.
- Indica la posizione quando puoi: "davanti a te", "alla tua destra", "alla tua sinistra".
- Indica la distanza approssimativa SOLO se hai sufficiente confidenza (es. "a circa due metri"). Se non è stimabile, ometti la distanza: non inventarla mai.
- Distingui gli oggetti fermi da quelli in movimento: "una bicicletta si sta avvicinando", "un autobus si sta allontanando", "una persona cammina verso di te".
- Includi dettagli identificativi utili SOLO se li leggi con chiarezza: colore, numero di un autobus, testo di un cartello, tipo di edificio.
- Quando non sei sicuro, usa "sembra esserci..." o "potrebbe esserci...", oppure non descrivere quell'elemento. La precisione è più importante della quantità di informazioni.

EVITARE LE RIPETIZIONI (molto importante)
- Ti verrà fornito un riepilogo della scena descritta poco fa. Parla SOLO se la scena è cambiata in modo significativo: è comparso un nuovo oggetto, un oggetto è scomparso, è cambiata la distanza, è cambiata la direzione, è cambiata la situazione.
- Se la scena è sostanzialmente identica a quella già descritta, imposta "changed" a false e "speech" a stringa vuota "". Non ripetere la stessa frase.

CAMPI DA RESTITUIRE
- "speech": la frase da pronunciare adesso, in italiano. Stringa vuota "" se non c'è nulla di nuovo da dire.
- "changed": true se la scena è cambiata in modo significativo rispetto al riepilogo precedente, altrimenti false.
- "alert": true SOLO se c'è un ostacolo immediato o un pericolo imminente per chi sta camminando.
- "summary": un riepilogo brevissimo e stabile della scena attuale (in italiano, a uso interno) che servirà a confrontare il frame successivo. Elenca gli elementi principali con posizione e distanza.
- "objects": elenco degli oggetti rilevati, in ordine di priorità. Per ciascuno: "label" (nome in italiano), "position" (una tra sinistra, centro, destra, unknown), "distanceM" (metri stimati come numero, oppure null se non stimabile), "movement" (una tra fermo, si avvicina, si allontana, attraversa, unknown), "confidence" (0–1).

Rispondi esclusivamente con i campi richiesti dallo schema.`;

/**
 * Blocco aggiunto in coda al prompt quando l'utente è in MODALITÀ CAMMINO.
 * Sta camminando col telefono in mano: deve sentire pochissime parole, solo se
 * riguardano la sicurezza del percorso. Le istruzioni qui in fondo hanno la
 * precedenza sullo stile descrittivo di "explore".
 */
const WALK_OVERRIDE = `
MODALITÀ CAMMINO ATTIVA (la persona sta camminando: la priorità assoluta è la sicurezza)
- Parla pochissimo e solo per aiutarla a camminare senza farsi male.
- Frasi brevissime, poche parole. Esempi: "Attento, gradino davanti.", "Persona davanti a te.", "Auto da sinistra.", "Muro a un metro.", "Via libera."
- Segnala SOLO ciò che riguarda il cammino: ostacoli sul percorso, gradini o scale, dislivelli e buche, porte o passaggi stretti, persone o veicoli che si avvicinano o attraversano davanti.
- Ignora tutto ciò che non serve a camminare: colori, decorazioni, dettagli estetici, oggetti lontani o fuori dal percorso.
- Se davanti è tutto libero e non è cambiato nulla di rilevante per la sicurezza, imposta "changed" a false e "speech" a "". Non riempire il silenzio.
- Imposta "alert" a true per qualsiasi pericolo immediato sul percorso (un gradino, un ostacolo vicino, un veicolo o una persona in avvicinamento).`;

/** Compone il prompt di sistema per la modalità richiesta. */
function systemFor(mode: Mode): string {
  return mode === 'walk' ? `${SYSTEM}\n${WALK_OVERRIDE}` : SYSTEM;
}

interface AnalyzeBody {
  image?: string;
  /** Riepilogo della scena descritta al frame precedente (per il confronto). */
  previousSummary?: string;
  /** Modalità d'uso: `explore` (descrizione ricca) o `walk` (solo pericoli). */
  mode?: Mode;
}

/** Normalizza un oggetto rilevato nella forma `DetectedObject`. */
function toObject(raw: unknown): DetectedObject | null {
  const o = (raw ?? {}) as Record<string, unknown>;
  const label = typeof o.label === 'string' ? o.label.trim() : '';
  if (!label) return null;

  const position: Position = POSITIONS.includes(o.position as Position)
    ? (o.position as Position)
    : 'unknown';
  const movement: Movement = MOVEMENTS.includes(o.movement as Movement)
    ? (o.movement as Movement)
    : 'unknown';
  const distanceM =
    typeof o.distanceM === 'number' && Number.isFinite(o.distanceM) && o.distanceM >= 0
      ? o.distanceM
      : null;
  const confRaw = typeof o.confidence === 'number' ? o.confidence : 0;
  const confidence = Math.max(0, Math.min(1, Number.isFinite(confRaw) ? confRaw : 0));

  return { label, position, distanceM, movement, confidence };
}

/** Normalizza l'output del modello nella forma `Scene` attesa dal client. */
function toScene(raw: unknown): Scene {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

  const objects = Array.isArray(obj.objects)
    ? obj.objects.map(toObject).filter((o): o is DetectedObject => o !== null)
    : [];

  return {
    speech: str(obj.speech),
    changed: Boolean(obj.changed),
    summary: str(obj.summary),
    alert: Boolean(obj.alert),
    objects,
  };
}

export async function POST(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: 'ANTHROPIC_API_KEY non configurata sul server (crea un file .env).' },
      { status: 500 },
    );
  }

  // Verifica il token Supabase se presente. Con ANALYZE_REQUIRE_AUTH=true, una
  // richiesta senza utente valido viene respinta prima di chiamare (e pagare) Claude.
  const user = await getUserFromRequest(request);
  if (REQUIRE_AUTH && !user) {
    return Response.json(
      { error: 'Autenticazione richiesta per usare questo servizio.' },
      { status: 401 },
    );
  }

  let body: AnalyzeBody;
  try {
    body = (await request.json()) as AnalyzeBody;
  } catch {
    return Response.json({ error: 'Corpo della richiesta non è JSON valido.' }, { status: 400 });
  }

  const image = body.image;
  if (!image || typeof image !== 'string') {
    return Response.json({ error: 'Campo "image" (JPEG base64) mancante.' }, { status: 400 });
  }

  const mode: Mode = body.mode === 'walk' ? 'walk' : 'explore';

  const previousSummary =
    typeof body.previousSummary === 'string' ? body.previousSummary.trim() : '';
  const userText = previousSummary
    ? `Riepilogo della scena descritta poco fa (usalo per capire se qualcosa è cambiato):\n${previousSummary}\n\nDescrivi la scena in questa nuova immagine. Parla solo se è cambiato qualcosa di importante.`
    : 'Prima immagine. Descrivi ciò che la persona ha davanti.';

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemFor(mode),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: image },
            },
            { type: 'text', text: userText },
          ],
        },
      ],
      output_config: { format: { type: 'json_schema', schema: SCENE_SCHEMA } },
    });

    const textBlock = message.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return Response.json(
        { error: 'Risposta del modello priva di contenuto testuale.' },
        { status: 502 },
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(textBlock.text);
    } catch {
      return Response.json({ error: 'Il modello non ha restituito JSON valido.' }, { status: 502 });
    }

    return Response.json(toScene(parsed));
  } catch (err) {
    console.error('[analyze] errore chiamando Claude:', err);
    const messageText = err instanceof Error ? err.message : 'Errore sconosciuto';
    return Response.json({ error: messageText }, { status: 500 });
  }
}
