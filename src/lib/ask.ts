import { getApiBase } from './analyze';
import { supabase } from './supabase';

/**
 * Gira una domanda dell'utente all'AI insieme al frame inquadrato in quel
 * momento, e restituisce la risposta (una frase da pronunciare a voce).
 *
 * A differenza di `analyzeScene` — che descrive la scena in continuazione — qui
 * si risponde a una domanda precisa ("cosa c'è davanti?", "che colore ha?",
 * "leggi il cartello") su ciò che la fotocamera sta vedendo adesso.
 */
export async function askQuestion(
  imageBase64: string,
  question: string,
  signal?: AbortSignal,
): Promise<string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${getApiBase()}/api/ask`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ image: imageBase64, question }),
    signal,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Domanda fallita (${res.status}): ${detail}`);
  }

  const json = (await res.json()) as { answer?: string };
  return typeof json.answer === 'string' ? json.answer.trim() : '';
}
