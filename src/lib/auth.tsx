import type { AuthError, Session, User } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { supabase } from './supabase';

/**
 * Stato di autenticazione condiviso dall'app.
 *
 * Espone la sessione Supabase corrente e i metodi per entrare/uscire. Il login
 * reale (email/password) e l'accesso ospite (anonimo) sostituiscono il login
 * simulato precedente. L'audio resta l'interfaccia principale: l'auth è pensata
 * per NON ostacolare l'esperienza (su nativo la fotocamera parte comunque).
 */

/** Esito di un'operazione di autenticazione, in forma pronta per la UI. */
export interface AuthResult {
  /** Messaggio d'errore già tradotto in italiano, se qualcosa è andato storto. */
  error?: string;
  /**
   * true quando la registrazione è riuscita ma serve confermare l'email prima di
   * poter entrare (dipende dalle impostazioni del progetto Supabase).
   */
  needsEmailConfirmation?: boolean;
}

interface AuthContextValue {
  /** Sessione corrente, o null se non autenticato. */
  session: Session | null;
  user: User | null;
  /** true finché non è stato caricato lo stato iniziale della sessione. */
  initializing: boolean;
  /** true se l'utente corrente è un ospite (accesso anonimo). */
  isAnonymous: boolean;
  signInWithPassword: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signInAnonymously: () => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/** Traduce gli errori di Supabase Auth in messaggi brevi e chiari in italiano. */
function toItalianError(error: AuthError | null): string | undefined {
  if (!error) return undefined;
  const msg = error.message.toLowerCase();

  if (msg.includes('invalid login credentials')) return 'Email o password non corretti.';
  if (msg.includes('email not confirmed')) return 'Devi prima confermare la tua email.';
  if (msg.includes('user already registered') || msg.includes('already been registered'))
    return 'Esiste già un account con questa email. Prova ad accedere.';
  if (msg.includes('password should be at least'))
    return 'La password è troppo corta (minimo 6 caratteri).';
  if (msg.includes('anonymous sign-ins are disabled'))
    return 'Accesso ospite non disponibile: abilita «Anonymous sign-ins» nel dashboard Supabase, oppure registrati.';
  if (msg.includes('rate limit') || msg.includes('too many'))
    return 'Troppi tentativi. Riprova tra qualche minuto.';
  if (msg.includes('network') || msg.includes('failed to fetch'))
    return 'Problema di connessione. Controlla la rete e riprova.';

  return error.message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Sessione iniziale (da storage persistito, se presente).
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setInitializing(false);
    });

    // Aggiornamenti successivi: login, logout, refresh del token.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!mounted) return;
      setSession(next);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signInWithPassword = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      return { error: toItalianError(error) };
    },
    [],
  );

  const signUp = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
    if (error) return { error: toItalianError(error) };
    // Se il progetto richiede la conferma via email, non c'è ancora una sessione.
    return { needsEmailConfirmation: data.session === null };
  }, []);

  const signInAnonymously = useCallback(async (): Promise<AuthResult> => {
    const { error } = await supabase.auth.signInAnonymously();
    return { error: toItalianError(error) };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      initializing,
      isAnonymous: session?.user?.is_anonymous ?? false,
      signInWithPassword,
      signUp,
      signInAnonymously,
      signOut,
    }),
    [session, initializing, signInWithPassword, signUp, signInAnonymously, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Accede allo stato di autenticazione. Va usato dentro `<AuthProvider>`. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve essere usato dentro <AuthProvider>.');
  return ctx;
}
