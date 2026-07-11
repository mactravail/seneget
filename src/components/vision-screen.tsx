import { CameraView, useCameraPermissions } from 'expo-camera';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { analyzeScene } from '@/lib/analyze';
import { askQuestion } from '@/lib/ask';
import { parseCommand } from '@/lib/commands';
import { speak, stopSpeaking } from '@/lib/speech';
import { Mode } from '@/lib/types';
import { useSpeechInput } from '@/lib/use-speech-input';

/**
 * Schermata principale: la fotocamera a schermo intero che osserva la scena e
 * la descrive a voce. È montata sia sulla route nativa `/` (index) — dove si
 * apre subito — sia sulla route `/vision`, raggiunta dal web dopo il login.
 */

/**
 * Intervallo minimo tra due catture inviate all'AI (throttling costi/latenza).
 * Con Haiku 4.5 (bassa latenza) 1s dà aggiornamenti reattivi; il loop è comunque
 * serializzato (una richiesta alla volta) quindi non satura il modello.
 */
const FRAME_INTERVAL_MS = 1000;
/** Larghezza a cui ridimensionare il frame prima dell'invio. */
const FRAME_WIDTH = 768;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type Status = 'starting' | 'active' | 'paused';

export default function VisionScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [status, setStatus] = useState<Status>('starting');
  const [mode, setMode] = useState<Mode>('explore');
  const [cameraReady, setCameraReady] = useState(false);

  // Specchi leggibili dentro il loop asincrono.
  const statusRef = useRef<Status>(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  const modeRef = useRef<Mode>(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  const busyRef = useRef(false);
  /** Riepilogo dell'ultima scena annunciata: base per rilevare i cambiamenti. */
  const summaryRef = useRef('');
  /** Ultima frase pronunciata: evita ripetizioni identiche ravvicinate. */
  const lastSpeechRef = useRef('');
  const welcomedRef = useRef(false);
  /** Richiesta di analisi in corso: annullabile in pausa o all'uscita. */
  const abortRef = useRef<AbortController | null>(null);
  /** Fallimenti di analisi consecutivi (rete/chiave): per avvisare a voce. */
  const failuresRef = useRef(0);
  /** Guardia: l'avviso di errore è già stato pronunciato una volta. */
  const failureAnnouncedRef = useRef(false);
  /**
   * true durante un'interazione vocale (dal segnale "Dimmi" fino alla risposta):
   * mentre è attiva, il loop di descrizione tace per non parlare sopra l'utente.
   */
  const voiceBusyRef = useRef(false);
  /** Richiesta di risposta a una domanda in corso: annullabile. */
  const questionAbortRef = useRef<AbortController | null>(null);

  /**
   * Cattura un frame dalla fotocamera e lo restituisce come JPEG in base64,
   * ridimensionato per l'invio. Condiviso dal loop di descrizione e dalle
   * domande vocali (che analizzano lo stesso "adesso" che l'utente ha davanti).
   */
  const grabFrame = useCallback(async (): Promise<string | null> => {
    const cam = cameraRef.current;
    if (!cam) return null;
    const photo = await cam.takePictureAsync({
      quality: 0.5,
      skipProcessing: true,
      shutterSound: false,
    });
    if (!photo?.uri) return null;

    const context = ImageManipulator.manipulate(photo.uri);
    context.resize({ width: FRAME_WIDTH });
    const rendered = await context.renderAsync();
    const out = await rendered.saveAsync({
      format: SaveFormat.JPEG,
      compress: 0.6,
      base64: true,
    });
    return out.base64 ?? null;
  }, []);

  const captureAndDescribe = useCallback(async () => {
    if (!cameraRef.current) return;
    busyRef.current = true;
    let controller: AbortController | null = null;
    try {
      const base64 = await grabFrame();
      if (!base64) return;

      // Richiesta annullabile: se l'utente mette in pausa o esce mentre attende
      // la risposta, la abortiamo invece di sprecarla (vedi togglePause/cleanup).
      controller = new AbortController();
      abortRef.current = controller;
      const scene = await analyzeScene(base64, {
        previousSummary: summaryRef.current,
        mode: modeRef.current,
        signal: controller.signal,
      });

      // Il server ha risposto: la scena non è più in stato di errore.
      failuresRef.current = 0;
      failureAnnouncedRef.current = false;

      // L'utente potrebbe aver messo in pausa durante l'attesa della risposta.
      if (statusRef.current !== 'active') return;

      const phrase = scene.speech.trim();
      if (scene.changed && phrase && phrase !== lastSpeechRef.current) {
        const started = await speak(phrase, { force: scene.alert });
        if (started) {
          lastSpeechRef.current = phrase;
          // Aggiorna il riferimento solo quando annunciamo qualcosa di nuovo:
          // così il confronto successivo è rispetto a ciò che l'utente ha sentito.
          if (scene.summary) summaryRef.current = scene.summary;
        }
      }
    } catch (e) {
      // Richiesta annullata (pausa/uscita): non è un errore, esci in silenzio.
      if (e instanceof Error && (e.name === 'AbortError' || /abort/i.test(e.message))) {
        return;
      }

      // Errore reale (rete giù o chiave mancante): un utente cieco non vede un
      // fallimento silenzioso e crederebbe che l'app funzioni. Dopo alcuni
      // errori consecutivi, avvisa a voce una sola volta.
      console.warn('[vision] analisi fallita:', e instanceof Error ? e.message : e);
      failuresRef.current += 1;
      if (
        failuresRef.current >= 2 &&
        !failureAnnouncedRef.current &&
        statusRef.current === 'active'
      ) {
        failureAnnouncedRef.current = true;
        speak('Servizio non disponibile. Controlla la connessione.', { force: true });
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      busyRef.current = false;
    }
  }, [grabFrame]);

  // Loop di cattura: gira finché la schermata è montata; agisce solo se attiva
  // e non è in corso un'interazione vocale (in tal caso il loop tace).
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      while (!cancelled) {
        if (
          cameraReady &&
          cameraRef.current &&
          !busyRef.current &&
          !voiceBusyRef.current &&
          statusRef.current === 'active'
        ) {
          await captureAndDescribe();
        }
        if (cancelled) break;
        await sleep(FRAME_INTERVAL_MS);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [cameraReady, captureAndDescribe]);

  // All'avvio della fotocamera: messaggio di benvenuto e passaggio ad "active".
  useEffect(() => {
    if (!cameraReady || welcomedRef.current) return;
    welcomedRef.current = true;
    setStatus('active');
    speak(
      'SeneGet è attiva. Tocca lo schermo per parlarmi e farmi una domanda. Tieni premuto per mettere in pausa.',
      { force: true },
    );
  }, [cameraReady]);

  // Alla chiusura della schermata: ferma la voce e annulla le richieste in corso.
  useEffect(
    () => () => {
      stopSpeaking();
      abortRef.current?.abort();
      questionAbortRef.current?.abort();
    },
    [],
  );

  /** Imposta una modalità (esplora/cammino) e la conferma a voce. */
  const applyMode = useCallback((next: Mode) => {
    setMode((prev) => {
      if (prev === next) {
        speak(
          next === 'walk' ? 'Sei già in modalità cammino.' : 'Sei già in modalità esplora.',
          { force: true },
        );
        return prev;
      }
      // Cambiando stile di descrizione, riparte il confronto: il prossimo frame
      // viene ridescritto con le regole della nuova modalità (senza ripetizioni
      // ereditate da quella precedente).
      summaryRef.current = '';
      lastSpeechRef.current = '';
      if (next === 'walk') {
        speak('Modalità cammino. Ti avviso solo dei pericoli davanti a te.', { force: true });
      } else {
        speak("Modalità esplora. Ti descrivo l'ambiente intorno a te.", { force: true });
      }
      return next;
    });
  }, []);

  const doPause = useCallback(() => {
    setStatus((prev) => {
      if (prev !== 'active') return prev;
      // In pausa non ha senso spendere una richiesta: annulla quella in corso.
      abortRef.current?.abort();
      stopSpeaking();
      speak('In pausa.', { force: true });
      return 'paused';
    });
  }, []);

  const doResume = useCallback(() => {
    setStatus((prev) => {
      if (prev === 'active') return prev;
      // Riprendendo, forza una nuova descrizione della scena corrente e riparte
      // da zero anche il conteggio degli errori (nuovo avviso se serve).
      summaryRef.current = '';
      lastSpeechRef.current = '';
      failuresRef.current = 0;
      failureAnnouncedRef.current = false;
      speak('Ripresa.', { force: true });
      return 'active';
    });
  }, []);

  /** Pressione prolungata: alterna pausa e ripresa senza bisogno di parlare. */
  const togglePause = useCallback(() => {
    if (statusRef.current === 'paused') doResume();
    else if (statusRef.current === 'active') doPause();
  }, [doPause, doResume]);

  /**
   * Elabora ciò che l'utente ha detto. Se è un comando riconosciuto lo esegue;
   * altrimenti è una domanda: risponde guardando il frame inquadrato adesso.
   */
  const handleTranscript = useCallback(
    async (text: string) => {
      const command = parseCommand(text);
      if (command) {
        if (command === 'pause') doPause();
        else if (command === 'resume') doResume();
        else if (command === 'walk') applyMode('walk');
        else if (command === 'explore') applyMode('explore');
        voiceBusyRef.current = false;
        return;
      }

      try {
        const frame = await grabFrame();
        if (!frame) {
          speak('Non riesco a vedere in questo momento.', { force: true });
          return;
        }
        // Riempitivo mentre l'AI elabora: l'utente sa di essere stato capito.
        speak('Un momento.', { force: true });
        const controller = new AbortController();
        questionAbortRef.current = controller;
        const answer = await askQuestion(frame, text, controller.signal);
        speak(answer || 'Non sono sicuro di cosa hai davanti.', { force: true });
      } catch (e) {
        if (e instanceof Error && (e.name === 'AbortError' || /abort/i.test(e.message))) return;
        console.warn('[vision] domanda fallita:', e instanceof Error ? e.message : e);
        speak('Non sono riuscito a rispondere. Riprova.', { force: true });
      } finally {
        questionAbortRef.current = null;
        voiceBusyRef.current = false;
      }
    },
    [grabFrame, doPause, doResume, applyMode],
  );

  const { listening, start: startListening } = useSpeechInput({
    onResult: handleTranscript,
    onNoSpeech: () => {
      voiceBusyRef.current = false;
      speak('Non ho sentito. Riprova.', { force: true });
    },
    onError: (code) => {
      voiceBusyRef.current = false;
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        speak('Serve il permesso del microfono per parlarmi.', { force: true });
      } else if (code === 'no-speech') {
        speak('Non ho sentito. Riprova.', { force: true });
      } else {
        speak('Non riesco ad ascoltare in questo momento.', { force: true });
      }
    },
  });

  /**
   * Tocco singolo: parla con l'app (push-to-talk). Ferma la descrizione in
   * corso, dà un breve segnale ("Dimmi") e — solo quando ha finito di parlare,
   * per non registrare la propria voce — avvia l'ascolto del microfono.
   */
  const startTalking = useCallback(() => {
    if (!cameraReady || voiceBusyRef.current || listening) return;
    voiceBusyRef.current = true;
    abortRef.current?.abort();
    stopSpeaking();
    speak('Dimmi.', { force: true, onDone: () => startListening() });
  }, [cameraReady, listening, startListening]);

  // --- Stati dei permessi ---
  if (!permission) {
    return <View style={styles.black} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.black, styles.center]}>
        <Text style={styles.permTitle} accessibilityRole="header">
          SeneGet ha bisogno della fotocamera
        </Text>
        <Text style={styles.permBody}>
          Serve la fotocamera per osservare ciò che hai davanti e descrivertelo a voce.
        </Text>
        <Pressable
          onPress={requestPermission}
          accessibilityRole="button"
          accessibilityLabel="Consenti l'accesso alla fotocamera"
          style={({ pressed }) => [styles.permButton, pressed && styles.pressed]}
        >
          <Text style={styles.permButtonText}>Consenti fotocamera</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const active = status === 'active';
  const walking = mode === 'walk';
  const statusText = listening ? 'Ti ascolto…' : active ? 'Attiva' : 'In pausa';
  const dotColor = listening ? '#0A84FF' : active ? '#30D158' : 'rgba(255,255,255,0.5)';

  return (
    // L'intero schermo è un grande pulsante: un tocco parla con l'app (fai una
    // domanda o dai un comando a voce); una pressione prolungata mette in pausa
    // o riprende senza bisogno di parlare.
    <Pressable
      style={styles.black}
      onPress={startTalking}
      onLongPress={togglePause}
      delayLongPress={500}
      accessibilityRole="button"
      accessibilityLabel={
        `${statusText}. ` +
        `${walking ? 'Modalità cammino' : 'Modalità esplora'}. ` +
        'Tocca per parlarmi e farmi una domanda. Tieni premuto per mettere in pausa o riprendere.'
      }
    >
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        animateShutter={false}
        onCameraReady={() => setCameraReady(true)}
      />

      <SafeAreaView style={styles.overlay} pointerEvents="none">
        {/* Indicatori di stato minimali (nessuna descrizione a schermo). */}
        <View style={styles.topBar}>
          <View style={styles.pill}>
            <View style={[styles.dot, { backgroundColor: dotColor }]} />
            <Text style={styles.pillText}>{statusText}</Text>
          </View>
          <View style={styles.pill}>
            <Text style={styles.pillText}>{walking ? '🚶 Cammino' : '🔍 Esplora'}</Text>
          </View>
        </View>

        <View style={styles.spacer} />

        <Text style={styles.hint}>Tocca per parlare · Tieni premuto per pausa</Text>
      </SafeAreaView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  black: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  overlay: {
    flex: 1,
    paddingHorizontal: 16,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
  },
  spacer: {
    flex: 1,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pillText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  hint: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    textAlign: 'center',
    paddingBottom: 12,
  },
  permTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  permBody: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 21,
  },
  permButton: {
    marginTop: 8,
    backgroundColor: '#0A84FF',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
  },
  permButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.7,
  },
});
