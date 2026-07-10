import { CameraView, useCameraPermissions } from 'expo-camera';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { analyzeScene } from '@/lib/analyze';
import { speak, stopSpeaking } from '@/lib/speech';

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
  const [cameraReady, setCameraReady] = useState(false);

  // Specchi leggibili dentro il loop asincrono.
  const statusRef = useRef<Status>(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);
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

  const captureAndDescribe = useCallback(async () => {
    const cam = cameraRef.current;
    if (!cam) return;
    busyRef.current = true;
    let controller: AbortController | null = null;
    try {
      const photo = await cam.takePictureAsync({
        quality: 0.5,
        skipProcessing: true,
        shutterSound: false,
      });
      if (!photo?.uri) return;

      const context = ImageManipulator.manipulate(photo.uri);
      context.resize({ width: FRAME_WIDTH });
      const rendered = await context.renderAsync();
      const out = await rendered.saveAsync({
        format: SaveFormat.JPEG,
        compress: 0.6,
        base64: true,
      });
      if (!out.base64) return;

      // Richiesta annullabile: se l'utente mette in pausa o esce mentre attende
      // la risposta, la abortiamo invece di sprecarla (vedi togglePause/cleanup).
      controller = new AbortController();
      abortRef.current = controller;
      const scene = await analyzeScene(out.base64, summaryRef.current, controller.signal);

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
  }, []);

  // Loop di cattura: gira finché la schermata è montata; agisce solo se attiva.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      while (!cancelled) {
        if (
          cameraReady &&
          cameraRef.current &&
          !busyRef.current &&
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
    speak('SeneGet è attiva. Inquadra ciò che hai davanti.', { force: true });
  }, [cameraReady]);

  // Alla chiusura della schermata: ferma la voce e annulla l'analisi in corso.
  useEffect(
    () => () => {
      stopSpeaking();
      abortRef.current?.abort();
    },
    [],
  );

  const togglePause = useCallback(() => {
    setStatus((prev) => {
      if (prev === 'starting') return prev;
      const next = prev === 'active' ? 'paused' : 'active';
      if (next === 'paused') {
        // In pausa non ha senso spendere una richiesta: annulla quella in corso.
        abortRef.current?.abort();
        stopSpeaking();
        speak('In pausa.', { force: true });
      } else {
        // Riprendendo, forza una nuova descrizione della scena corrente e
        // riparte da zero anche il conteggio degli errori (nuovo avviso se serve).
        summaryRef.current = '';
        lastSpeechRef.current = '';
        failuresRef.current = 0;
        failureAnnouncedRef.current = false;
        speak('Ripresa.', { force: true });
      }
      return next;
    });
  }, []);

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

  return (
    // L'intero schermo è un unico grande pulsante: un tocco mette in pausa o riprende.
    <Pressable
      style={styles.black}
      onPress={togglePause}
      accessibilityRole="button"
      accessibilityLabel={active ? 'In ascolto. Tocca per mettere in pausa.' : 'In pausa. Tocca per riprendere.'}
    >
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        animateShutter={false}
        onCameraReady={() => setCameraReady(true)}
      />

      <SafeAreaView style={styles.overlay} pointerEvents="none">
        {/* Indicatore di stato minimale (nessuna descrizione a schermo). */}
        <View style={styles.topBar}>
          <View style={styles.pill}>
            <View style={[styles.dot, { backgroundColor: active ? '#30D158' : 'rgba(255,255,255,0.5)' }]} />
            <Text style={styles.pillText}>{active ? 'In ascolto' : 'In pausa'}</Text>
          </View>
        </View>

        <View style={styles.spacer} />

        <Text style={styles.hint}>Tocca lo schermo per {active ? 'mettere in pausa' : 'riprendere'}</Text>
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
    alignItems: 'center',
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
