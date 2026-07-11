import * as Speech from 'expo-speech';

/**
 * Sintesi vocale (Text-to-Speech) in italiano.
 *
 * L'audio è l'unica interfaccia dell'app: queste funzioni pronunciano le frasi
 * generate dall'analisi della scena. Su iOS/Android usano `expo-speech`.
 */

const LANGUAGE = 'it-IT';

/**
 * Pronuncia `text` in italiano.
 *
 * Per impostazione predefinita NON interrompe una frase già in corso (per non
 * spezzare una descrizione a metà): in quel caso restituisce `false`.
 * Con `force: true` (usato per gli avvisi urgenti) interrompe e parla subito.
 *
 * `onDone` viene chiamato quando la frase finisce di essere pronunciata: utile
 * per incatenare un'azione (es. avviare il microfono) senza sovrapporre l'audio.
 *
 * @returns `true` se la frase è stata avviata, `false` se è stata ignorata.
 */
export async function speak(
  text: string,
  { force = false, onDone }: { force?: boolean; onDone?: () => void } = {},
): Promise<boolean> {
  const t = text.trim();
  if (!t) {
    onDone?.();
    return false;
  }

  if (!force && (await isSpeaking())) return false;

  Speech.stop();
  Speech.speak(t, {
    language: LANGUAGE,
    // `onError`/`stopped` garantiscono che chi attende `onDone` non resti appeso
    // se la sintesi viene interrotta.
    onDone,
    onStopped: onDone,
    onError: onDone,
  });
  return true;
}

/** Interrompe immediatamente qualsiasi frase in corso. */
export function stopSpeaking(): void {
  Speech.stop();
}

/** Indica se una frase è attualmente in riproduzione. */
export async function isSpeaking(): Promise<boolean> {
  try {
    return await Speech.isSpeakingAsync();
  } catch {
    return false;
  }
}
