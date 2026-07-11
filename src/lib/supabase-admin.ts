import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

/**
 * Client Supabase lato SERVER (route `/api`).
 *
 * Usa la *secret key* (`SUPABASE_SECRET_KEY`): scavalca le RLS e permette di
 * verificare i token degli utenti. NON deve MAI essere importato dal codice
 * client — vive solo nelle API route, dove le variabili senza prefisso
 * `EXPO_PUBLIC_` restano lato server e non entrano nel bundle dell'app.
 */

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const secret = process.env.SUPABASE_SECRET_KEY ?? '';

/** Client admin. `null` se le variabili non sono configurate. */
export const supabaseAdmin: SupabaseClient | null =
  url && secret
    ? createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;

/** Estrae il token dall'header `Authorization: Bearer <token>`. */
function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

/**
 * Verifica il token della richiesta e restituisce l'utente Supabase.
 * Restituisce `null` se manca il token, è invalido/scaduto, oppure se il client
 * admin non è configurato.
 */
export async function getUserFromRequest(request: Request): Promise<User | null> {
  if (!supabaseAdmin) return null;
  const token = bearerToken(request);
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error) return null;
  return data.user;
}
