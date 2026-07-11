import { Redirect } from 'expo-router';
import { Platform, View } from 'react-native';

import VisionScreen from '@/components/vision-screen';
import { useAuth } from '@/lib/auth';

/**
 * Route `/vision`: la fotocamera, raggiunta dopo il login (dal web) o
 * direttamente. Su nativo `/` apre già la fotocamera; questa route serve al
 * flusso "Provala → Login → App" della landing web, dove `/` è la landing page.
 *
 * Sul web protegge l'accesso: senza sessione si torna al login. Su nativo la
 * fotocamera non viene mai bloccata (la sessione è garantita all'avvio in `/`).
 */
export default function Vision() {
  const { session, initializing } = useAuth();

  if (Platform.OS === 'web') {
    // Attende il caricamento della sessione per non lampeggiare il redirect.
    if (initializing) return <View style={{ flex: 1, backgroundColor: '#000' }} />;
    if (!session) return <Redirect href="/login" />;
  }

  return <VisionScreen />;
}
