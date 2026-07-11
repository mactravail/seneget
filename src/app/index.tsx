import { useEffect, useRef } from 'react';

import VisionScreen from '@/components/vision-screen';
import { useAuth } from '@/lib/auth';

/**
 * Route nativa `/`: apre subito la fotocamera (esperienza voice-first).
 * Sul web questa route è sostituita da `index.web.tsx` (la landing page).
 *
 * All'avvio garantisce una sessione Supabase in modo "best-effort": se non c'è
 * ancora un accesso, prova un login anonimo per dare all'app un token (utile a
 * proteggere `/api/analyze`). Il tentativo NON blocca mai la fotocamera: se
 * fallisce (es. accessi anonimi disabilitati sul dashboard) l'app funziona
 * comunque — la sicurezza di chi sta camminando viene prima di tutto.
 */
export default function NativeHome() {
  const { session, initializing, signInAnonymously } = useAuth();
  const triedRef = useRef(false);

  useEffect(() => {
    if (initializing || session || triedRef.current) return;
    triedRef.current = true;
    signInAnonymously().then((res) => {
      if (res.error) console.warn('[auth] accesso ospite non riuscito:', res.error);
    });
  }, [initializing, session, signInAnonymously]);

  return <VisionScreen />;
}
