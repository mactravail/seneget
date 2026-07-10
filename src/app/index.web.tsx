import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

/**
 * Home page — mostrata solo sul web (`index.web.tsx`).
 * Su iOS/Android il router usa `index.tsx` (la fotocamera a schermo intero).
 *
 * SeneGet è pensata per persone cieche o ipovedenti, che non vedono lo schermo:
 * a configurare l'app è quasi sempre un amico o un familiare. Per questo la home
 * è ridotta all'essenziale — cos'è l'app e come avviarla — e si rivolge a chi aiuta.
 */

const C = {
  bg: '#000',
  surface: 'rgba(18,18,20,0.86)',
  border: 'rgba(255,255,255,0.12)',
  text: '#fff',
  muted: 'rgba(255,255,255,0.62)',
  faint: 'rgba(255,255,255,0.42)',
  blue: '#0A84FF',
} as const;

export default function Home() {
  const router = useRouter();

  // Logo responsive, mobile-first: taglia base per telefoni, cresce con lo schermo.
  const { width } = useWindowDimensions();
  const logoHeight = Math.round(Math.min(52, Math.max(34, width * 0.12)));
  const logoWidth = Math.round((logoHeight * 860) / 290);

  /** «Inizia» → login, che poi porta all'app (la fotocamera). */
  const start = useCallback(() => router.push('/login'), [router]);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.card}>
        {/* Brand — il logo è già pensato per fondo scuro (niente sfondo bianco). */}
        <Image
          source={require('../../assets/images/seneget.png')}
          style={[styles.logo, { width: logoWidth, height: logoHeight }]}
          resizeMode="contain"
          accessibilityRole="image"
          accessibilityLabel="SeneGet"
        />

        {/* Cosa fa, in una frase */}
        <Text style={styles.h1} accessibilityRole="header">
          Gli occhi di chi non vede
        </Text>
        <Text style={styles.lead}>
          SeneGet usa la fotocamera e l&apos;intelligenza artificiale per descrivere a voce, in
          tempo reale, ciò che si ha davanti. Solo audio, nessuno schermo da guardare.
        </Text>

        {/* Azione principale */}
        <Pressable
          onPress={start}
          accessibilityRole="button"
          accessibilityLabel="Inizia: avvia SeneGet"
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
        >
          <Text style={styles.primaryBtnText}>Inizia</Text>
        </Pressable>

        {/* Guida per chi aiuta a configurare */}
        <View style={styles.helper}>
          <Text style={styles.helperTitle}>Stai aiutando una persona cara?</Text>
          {HELP_STEPS.map((step, i) => (
            <View key={step} style={styles.step}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>{i + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

/** I pochi passi essenziali per chi configura l'app al posto della persona cieca. */
const HELP_STEPS = [
  'Premi «Inizia» e consenti l’accesso alla fotocamera.',
  'Consegna il telefono alla persona: la fotocamera è già attiva.',
  'Da qui basta ascoltare: SeneGet descrive a voce ciò che ha davanti.',
] as const;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: C.surface,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 28,
    padding: 28,
    gap: 18,
  },
  logo: {
    // Dimensioni impostate inline (responsive); maxWidth evita sfori su schermi stretti.
    alignSelf: 'flex-start',
    maxWidth: '100%',
    marginBottom: 2,
  },
  h1: {
    color: C.text,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  lead: {
    color: C.muted,
    fontSize: 17,
    lineHeight: 25,
  },
  primaryBtn: {
    backgroundColor: C.blue,
    paddingVertical: 17,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 2,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.65,
  },
  helper: {
    gap: 14,
    borderTopColor: C.border,
    borderTopWidth: 1,
    paddingTop: 20,
    marginTop: 2,
  },
  helperTitle: {
    color: C.faint,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: 'rgba(10,132,255,0.15)',
    borderColor: 'rgba(10,132,255,0.4)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: {
    color: '#8FC3FF',
    fontSize: 13,
    fontWeight: '800',
  },
  stepText: {
    flex: 1,
    color: C.muted,
    fontSize: 15,
    lineHeight: 21,
  },
});
