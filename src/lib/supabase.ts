import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

/**
 * Client Supabase lato APP (browser/dispositivo).
 *
 * Usa la *publishable key* (`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`): è sicura nel
 * bundle client perché protetta dalle Row Level Security policy del progetto.
 * La *secret key* NON deve mai finire qui — vive solo lato server in
 * `src/lib/supabase-admin.ts`.
 */

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Supabase non configurato: imposta EXPO_PUBLIC_SUPABASE_URL e ' +
      'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY nel file .env.local.',
  );
}

const isWeb = Platform.OS === 'web';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // Su nativo la sessione va persistita con AsyncStorage. Sul web lasciamo il
    // default di supabase-js (localStorage nel browser), evitando AsyncStorage
    // durante il render server dell'output web di Expo.
    storage: isWeb ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Il rilevamento della sessione dall'URL serve solo ai redirect OAuth/magic
    // link (flusso web). Con email/password non è necessario, ma è innocuo.
    detectSessionInUrl: isWeb,
  },
});

// Su nativo: mantiene il token aggiornato solo mentre l'app è in primo piano.
// In background fermiamo l'auto-refresh per non sprecare richieste.
if (!isWeb) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
