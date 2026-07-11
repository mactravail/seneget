/**
 * Interpretazione dei comandi vocali.
 *
 * L'utente parla all'app (vedi il push-to-talk in `vision-screen`). Se la frase
 * è un comando riconosciuto la eseguiamo; altrimenti la trattiamo come una
 * domanda sulla scena inquadrata (vedi `ask`). Nessun modello serve qui: il
 * riconoscimento è locale e robusto, così i comandi funzionano anche offline.
 */

/** Azioni che l'utente può attivare a voce. */
export type Command = 'pause' | 'resume' | 'walk' | 'explore';

/** Rimuove accenti e punteggiatura per un confronto tollerante. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // accenti (segni diacritici combinanti)
    .replace(/[^a-z0-9\s]/g, ' ') // punteggiatura
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Ogni comando è associato a delle radici di parola: se una compare nel testo
 * (già normalizzato) il comando scatta. Uso radici (`cammin`) per accettare le
 * varianti ("cammino", "camminando", "cammina").
 *
 * L'ordine conta: i comandi più specifici vanno prima (es. "riprendi" prima di
 * un'ipotetica sovrapposizione), e "cammino"/"esplora" prima dei generici.
 */
const RULES: { command: Command; roots: string[] }[] = [
  { command: 'walk', roots: ['cammin', 'sto camminando', 'modalita cammino'] },
  { command: 'explore', roots: ['esplor', 'modalita esplora', 'descrivi tutto', 'guarda intorno'] },
  { command: 'resume', roots: ['riprend', 'ripart', 'ricomincia', 'continua', ' riprendi', 'vai avanti', 'torna ad ascoltare'] },
  { command: 'pause', roots: ['pausa', 'ferma', 'fermati', 'aspetta', 'silenzio', 'zitt', 'basta', 'stop'] },
];

/**
 * Restituisce il comando corrispondente al testo riconosciuto, oppure `null`
 * se non è un comando (in tal caso il testo è una domanda da girare all'AI).
 */
export function parseCommand(text: string): Command | null {
  const t = ` ${normalize(text)} `;
  if (!t.trim()) return null;
  for (const { command, roots } of RULES) {
    if (roots.some((r) => t.includes(r))) return command;
  }
  return null;
}
