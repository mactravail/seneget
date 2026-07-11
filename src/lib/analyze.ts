import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { supabase } from './supabase';
import { Mode, Scene } from './types';

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
 * `mode` regola lo stile: `explore` descrive l'ambiente, `walk` avvisa solo dei
 * pericoli sul percorso con frasi brevissime.
 */
export async function analyzeScene(
  imageBase64: string,
  {
    previousSummary,
    mode = 'explore',
    signal,
  }: { previousSummary?: string; mode?: Mode; signal?: AbortSignal } = {},
): Promise<Scene> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  // Allega il token della sessione Supabase (se presente): la route /api/analyze
  // può usarlo per verificare l'utente. In assenza di sessione la richiesta parte
  // comunque — l'app deve funzionare anche prima che l'auth sia pienamente attiva.
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${getApiBase()}/api/analyze`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ image: imageBase64, previousSummary, mode }),
    signal,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Analisi fallita (${res.status}): ${detail}`);
  }

  return (await res.json()) as Scene;
}
