import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Ascolto vocale (Speech-to-Text) in italiano, sul dispositivo.
 *
 * È l'orecchio dell'app: l'utente tiene premuto lo schermo, parla, e la frase
 * riconosciuta arriva a `onResult`. Chi la usa decide se è un comando o una
 * domanda (vedi `parseCommand` e `vision-screen`).
 *
 * Richiede un development build (il modulo è nativo, non funziona in Expo Go).
 */

const LANGUAGE = 'it-IT';
/** Se l'utente non smette di parlare, fermiamo comunque dopo questo tempo. */
const MAX_LISTEN_MS = 8000;

export interface SpeechInputHandlers {
  /** Frase finale riconosciuta (non vuota). */
  onResult: (transcript: string) => void;
  /** L'ascolto è finito senza che sia stato riconosciuto nulla. */
  onNoSpeech?: () => void;
  /** Errore (permesso negato, riconoscitore non disponibile, ...). */
  onError?: (code: string, message: string) => void;
}

export interface SpeechInput {
  /** true mentre il microfono sta ascoltando. */
  listening: boolean;
  /** Chiede il permesso (la prima volta) e avvia l'ascolto. */
  start: () => Promise<void>;
  /** Ferma l'ascolto e finalizza il risultato. */
  stop: () => void;
}

export function useSpeechInput(handlers: SpeechInputHandlers): SpeechInput {
  const [listening, setListening] = useState(false);

  // Gli handler cambiano a ogni render; le sottoscrizioni agli eventi devono
  // però sempre chiamare l'ultima versione. Uno ref tiene il riferimento fresco
  // (aggiornato in un effect: toccare un ref durante il render è sconsigliato).
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  /**
   * Abbiamo già reagito a questa sessione di ascolto (risultato, errore o
   * silenzio)? Evita risposte doppie: su alcuni dispositivi lo stesso ascolto
   * emette sia `error: no-speech` sia `end`.
   */
  const respondedRef = useRef(false);
  const maxTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (maxTimer.current) {
      clearTimeout(maxTimer.current);
      maxTimer.current = null;
    }
  }, []);

  useSpeechRecognitionEvent('start', () => setListening(true));

  useSpeechRecognitionEvent('end', () => {
    setListening(false);
    clearTimer();
    if (respondedRef.current) return;
    respondedRef.current = true;
    handlersRef.current.onNoSpeech?.();
  });

  useSpeechRecognitionEvent('result', (event) => {
    if (!event.isFinal) return;
    const transcript = event.results?.[0]?.transcript?.trim() ?? '';
    if (!transcript || respondedRef.current) return;
    respondedRef.current = true;
    handlersRef.current.onResult(transcript);
  });

  useSpeechRecognitionEvent('error', (event) => {
    setListening(false);
    clearTimer();
    if (respondedRef.current) return;
    respondedRef.current = true;
    handlersRef.current.onError?.(event.error, event.message);
  });

  const start = useCallback(async () => {
    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        handlersRef.current.onError?.('not-allowed', 'Permesso microfono negato');
        return;
      }
      respondedRef.current = false;
      ExpoSpeechRecognitionModule.start({
        lang: LANGUAGE,
        interimResults: false,
        continuous: false,
        addsPunctuation: true,
      });
      clearTimer();
      maxTimer.current = setTimeout(() => {
        try {
          ExpoSpeechRecognitionModule.stop();
        } catch {
          // già fermo
        }
      }, MAX_LISTEN_MS);
    } catch (e) {
      handlersRef.current.onError?.(
        'start-failed',
        e instanceof Error ? e.message : String(e),
      );
    }
  }, [clearTimer]);

  const stop = useCallback(() => {
    clearTimer();
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      // già fermo
    }
  }, [clearTimer]);

  // Alla smontaggio: ferma tutto per non lasciare il microfono aperto.
  useEffect(
    () => () => {
      clearTimer();
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {
        // niente in corso
      }
    },
    [clearTimer],
  );

  return { listening, start, stop };
}
