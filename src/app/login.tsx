import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Pagina di login — raggiunta dalla landing web premendo «Provala».
 * Dopo l'accesso porta alla fotocamera (`/vision`), il cuore dell'app.
 *
 * Nota: non c'è ancora un backend di autenticazione. Il form è funzionale
 * (stato, validazione minima) ma l'accesso è simulato: «Entra» conduce
 * direttamente all'app. Quando ci sarà un backend, basterà sostituire
 * `submit()` con la vera chiamata e navigare al successo.
 *
 * Costruita con primitive React Native per restare coerente con lo stack e
 * con l'estetica dark/iOS dell'app.
 */

const C = {
  bg: '#000',
  surface: 'rgba(18,18,20,0.86)',
  field: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.12)',
  borderStrong: 'rgba(255,255,255,0.22)',
  text: '#fff',
  muted: 'rgba(255,255,255,0.62)',
  faint: 'rgba(255,255,255,0.42)',
  blue: '#0A84FF',
  green: '#30D158',
  red: '#FF453A',
} as const;

type Mode = 'login' | 'register';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const router = useRouter();

  // Logo responsive, mobile-first: parte da una taglia adatta ai telefoni
  // e cresce con lo schermo, restando entro limiti leggibili.
  const { width } = useWindowDimensions();
  const logoHeight = Math.round(Math.min(48, Math.max(32, width * 0.11)));
  const logoWidth = Math.round((logoHeight * 860) / 290);

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRegister = mode === 'register';

  const enterApp = useCallback(() => {
    // `replace`: una volta dentro l'app, «indietro» non torna al login.
    router.replace('/vision');
  }, [router]);

  const goHome = useCallback(() => {
    // Il logo riporta alla home: torna indietro se possibile, altrimenti naviga a «/».
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  const submit = useCallback(() => {
    const mail = email.trim();
    if (!EMAIL_RE.test(mail)) {
      setError('Inserisci un indirizzo email valido.');
      return;
    }
    if (password.length < 6) {
      setError('La password deve avere almeno 6 caratteri.');
      return;
    }
    setError(null);
    // TODO: qui andrà la vera autenticazione. Per ora si entra direttamente.
    enterApp();
  }, [email, password, enterApp]);

  const toggleMode = useCallback(() => {
    setError(null);
    setMode((m) => (m === 'login' ? 'register' : 'login'));
  }, []);

  const heading = useMemo(
    () => (isRegister ? 'Crea il tuo account' : 'Bentornato'),
    [isRegister],
  );
  const subtitle = useMemo(
    () =>
      isRegister
        ? 'Registrati per iniziare a farti guidare dalla voce.'
        : 'Accedi per farti descrivere a voce ciò che hai davanti.',
    [isRegister],
  );

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            {/* Brand — il logo è già pensato per fondo scuro (niente sfondo bianco).
                Toccandolo si torna alla home. */}
            <Pressable
              onPress={goHome}
              accessibilityRole="button"
              accessibilityLabel="SeneGet — torna alla home"
              hitSlop={8}
              style={({ pressed }) => [styles.logoButton, pressed && styles.pressed]}
            >
              <Image
                source={require('../../assets/images/seneget.png')}
                style={[styles.logo, { width: logoWidth, height: logoHeight }]}
                resizeMode="contain"
                accessibilityRole="image"
                accessibilityLabel="SeneGet"
              />
            </Pressable>

            <Text style={styles.heading} accessibilityRole="header">
              {heading}
            </Text>
            <Text style={styles.subtitle}>{subtitle}</Text>

            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label} nativeID="emailLabel">
                Email
              </Text>
              <TextInput
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  if (error) setError(null);
                }}
                placeholder="nome@esempio.it"
                placeholderTextColor={C.faint}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                inputMode="email"
                style={styles.input}
                accessibilityLabel="Email"
                aria-labelledby="emailLabel"
                returnKeyType="next"
              />
            </View>

            {/* Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label} nativeID="passwordLabel">
                Password
              </Text>
              <View style={styles.passwordRow}>
                <TextInput
                  value={password}
                  onChangeText={(v) => {
                    setPassword(v);
                    if (error) setError(null);
                  }}
                  placeholder="Almeno 6 caratteri"
                  placeholderTextColor={C.faint}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  autoCorrect={false}
                  style={[styles.input, styles.passwordInput]}
                  accessibilityLabel="Password"
                  aria-labelledby="passwordLabel"
                  returnKeyType="go"
                  onSubmitEditing={submit}
                />
                <Pressable
                  onPress={() => setShowPassword((s) => !s)}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Nascondi la password' : 'Mostra la password'}
                  hitSlop={8}
                  style={({ pressed }) => [styles.showBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.showBtnText}>{showPassword ? 'Nascondi' : 'Mostra'}</Text>
                </Pressable>
              </View>
            </View>

            {/* Errore di validazione */}
            {error && (
              <Text style={styles.error} accessibilityLiveRegion="polite" role="alert">
                {error}
              </Text>
            )}

            {/* CTA principale */}
            <Pressable
              onPress={submit}
              accessibilityRole="button"
              accessibilityLabel={isRegister ? 'Crea account ed entra' : 'Accedi ed entra nell’app'}
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            >
              <Text style={styles.primaryBtnText}>{isRegister ? 'Registrati' : 'Entra'}</Text>
            </Pressable>

            {/* Divisore */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>oppure</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Prova senza account */}
            <Pressable
              onPress={enterApp}
              accessibilityRole="button"
              accessibilityLabel="Continua come ospite ed entra nell’app"
              style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]}
            >
              <Text style={styles.ghostBtnText}>Continua come ospite</Text>
            </Pressable>

            {/* Cambio modalità */}
            <Pressable
              onPress={toggleMode}
              accessibilityRole="button"
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Text style={styles.switchText}>
                {isRegister ? 'Hai già un account? ' : 'Non hai un account? '}
                <Text style={styles.switchLink}>{isRegister ? 'Accedi' : 'Registrati'}</Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: C.surface,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 28,
    padding: 28,
    gap: 16,
  },
  logoButton: {
    alignSelf: 'center',
    maxWidth: '100%',
    marginBottom: 4,
  },
  logo: {
    // Dimensioni impostate inline (responsive); maxWidth evita sfori su schermi stretti.
    maxWidth: '100%',
  },
  heading: {
    color: C.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: C.muted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 4,
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    color: C.muted,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  input: {
    backgroundColor: C.field,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: C.text,
    fontSize: 16,
  },
  passwordRow: {
    position: 'relative',
    justifyContent: 'center',
  },
  passwordInput: {
    paddingRight: 92,
  },
  showBtn: {
    position: 'absolute',
    right: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  showBtnText: {
    color: C.blue,
    fontSize: 14,
    fontWeight: '700',
  },
  error: {
    color: C.red,
    fontSize: 14,
    fontWeight: '600',
    marginTop: -4,
  },
  primaryBtn: {
    backgroundColor: C.blue,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 2,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.border,
  },
  dividerText: {
    color: C.faint,
    fontSize: 13,
    fontWeight: '600',
  },
  ghostBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: C.border,
    borderWidth: 1,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
  },
  ghostBtnText: {
    color: C.text,
    fontSize: 16,
    fontWeight: '700',
  },
  switchText: {
    color: C.muted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
  switchLink: {
    color: C.blue,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.65,
  },
});
