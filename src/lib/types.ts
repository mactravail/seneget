/**
 * Modello dati della scena, prodotto dall'analisi AI di un singolo frame.
 *
 * Serve a una guida vocale per persone cieche o ipovedenti: l'utente NON vede
 * questi dati, che esistono solo per generare la frase da pronunciare a voce.
 */

/**
 * Modalità d'uso dell'app.
 * - `explore`: descrizione ricca dell'ambiente (l'utente è fermo o osserva).
 * - `walk`: l'utente sta camminando; frasi brevissime, solo pericoli sul percorso.
 */
export type Mode = 'explore' | 'walk';

/** Posizione orizzontale di un oggetto rispetto a chi impugna il telefono. */
export type Position = 'sinistra' | 'centro' | 'destra' | 'unknown';

/** Stato di movimento di un oggetto rispetto all'utente. */
export type Movement = 'fermo' | 'si avvicina' | 'si allontana' | 'attraversa' | 'unknown';

export const POSITIONS: readonly Position[] = ['sinistra', 'centro', 'destra', 'unknown'];
export const MOVEMENTS: readonly Movement[] = [
  'fermo',
  'si avvicina',
  'si allontana',
  'attraversa',
  'unknown',
];

/** Oggetto rilevato nella scena. Dato interno, mai mostrato all'utente. */
export interface DetectedObject {
  /** Nome dell'oggetto in italiano (es. "autobus", "persona", "porta"). */
  label: string;
  position: Position;
  /** Distanza stimata in metri; `null` quando non è stimabile con confidenza. */
  distanceM: number | null;
  movement: Movement;
  /** Confidenza 0–1 sull'identificazione dell'oggetto. */
  confidence: number;
}

/**
 * Esito dell'analisi di un frame.
 *
 * Il campo che guida l'app è `speech`: se non vuoto, va pronunciato. `summary`
 * viene rimandato al frame successivo per capire se la scena è cambiata ed
 * evitare descrizioni ripetitive.
 */
export interface Scene {
  /** Frase naturale da pronunciare adesso. Vuota se non c'è nulla di nuovo da dire. */
  speech: string;
  /** true se la scena è cambiata in modo significativo rispetto al riepilogo precedente. */
  changed: boolean;
  /** Riepilogo breve e stabile della scena, re-inviato al frame successivo per il confronto. */
  summary: string;
  /** true se c'è un ostacolo immediato o un pericolo imminente per chi cammina. */
  alert: boolean;
  /** Oggetti rilevati, in ordine di priorità. Dato interno. */
  objects: DetectedObject[];
}

export const EMPTY_SCENE: Scene = {
  speech: '',
  changed: false,
  summary: '',
  alert: false,
  objects: [],
};

/**
 * JSON Schema per vincolare l'output del modello (structured outputs).
 * I vincoli numerici non sono supportati: la normalizzazione avviene lato server.
 */
export const SCENE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    speech: { type: 'string' },
    changed: { type: 'boolean' },
    summary: { type: 'string' },
    alert: { type: 'boolean' },
    objects: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          label: { type: 'string' },
          position: { type: 'string', enum: ['sinistra', 'centro', 'destra', 'unknown'] },
          distanceM: { type: ['number', 'null'] },
          movement: {
            type: 'string',
            enum: ['fermo', 'si avvicina', 'si allontana', 'attraversa', 'unknown'],
          },
          confidence: { type: 'number' },
        },
        required: ['label', 'position', 'distanceM', 'movement', 'confidence'],
      },
    },
  },
  required: ['speech', 'changed', 'summary', 'alert', 'objects'],
} as const;
