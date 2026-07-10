import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { Scene } from './types';

/**
 * URL base a cui inviare le richieste all'API route `/api/analyze`.
 *
 * Priorità:
 *   1. `EXPO_PUBLIC_API_URL` (obbligatorio in produzione / build standalone).
 *   2. Web in sviluppo → percorso relativo (stessa origine).
 *   3. Nativo in sviluppo → host del dev server Metro (rilevato automaticamente),
 *      es. `http://192.168.1.10:8081`.
 */
export function getApiBase(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (configured) return configured.replace(/\/+$/, '');

  if (Platform.OS === 'web') return '';

  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) return `http://${hostUri}`;

  return '';
}

/**
 * Invia un frame (JPEG in base64) all'API e restituisce la descrizione di scena.
 * `previousSummary` dà continuità: il modello parla solo se la scena è cambiata.
 */
export async function analyzeScene(
  imageBase64: string,
  previousSummary?: string,
  signal?: AbortSignal,
): Promise<Scene> {
  const res = await fetch(`${getApiBase()}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imageBase64, previousSummary }),
    signal,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Analisi fallita (${res.status}): ${detail}`);
  }

  return (await res.json()) as Scene;
}
