import Anthropic from '@anthropic-ai/sdk';

import { getUserFromRequest } from '@/lib/supabase-admin';

// Stesso modello dell'analisi di scena (Haiku 4.5): veloce ed economico, adatto
// a rispondere subito. Sovrascrivibile con ANTHROPIC_MODEL.
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';

const client = new Anthropic();

const REQUIRE_AUTH = process.env.ANALYZE_REQUIRE_AUTH === 'true';

const SYSTEM = `Sei gli occhi di una persona cieca. Guardi una singola immagine ripresa dalla fotocamera del suo telefono e rispondi alla sua domanda su ciò che ha davanti, per aiutarla a capire l'ambiente e muoversi in sicurezza.

REGOLE
- Rispondi in italiano, con una frase breve e naturale, come farebbe una persona accanto a lei.
- Rispondi basandoti SOLO su ciò che vedi davvero nell'immagine. Non inventare nulla.
- Se la risposta non si vede o non sei sicuro, dillo con onestà: "Non riesco a vederlo bene", "Non sono sicuro", "Da qui non si vede". Meglio ammettere il dubbio che sbagliare.
- Vai dritto al punto: dai l'informazione richiesta, senza preamboli tipo "Nell'immagine vedo...".
- Se ti chiede di leggere un testo (un cartello, un'etichetta), leggilo esattamente com'è, se lo distingui con chiarezza.
- Non descrivere questi dati come "immagine" o "foto": per lei è semplicemente ciò che ha davanti.`;

interface AskBody {
  image?: string;
  question?: string;
}

export async function POST(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: 'ANTHROPIC_API_KEY non configurata sul server (crea un file .env).' },
      { status: 500 },
    );
  }

  const user = await getUserFromRequest(request);
  if (REQUIRE_AUTH && !user) {
    return Response.json(
      { error: 'Autenticazione richiesta per usare questo servizio.' },
      { status: 401 },
    );
  }

  let body: AskBody;
  try {
    body = (await request.json()) as AskBody;
  } catch {
    return Response.json({ error: 'Corpo della richiesta non è JSON valido.' }, { status: 400 });
  }

  const image = body.image;
  if (!image || typeof image !== 'string') {
    return Response.json({ error: 'Campo "image" (JPEG base64) mancante.' }, { status: 400 });
  }

  const question = typeof body.question === 'string' ? body.question.trim() : '';
  if (!question) {
    return Response.json({ error: 'Campo "question" mancante.' }, { status: 400 });
  }

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 400,
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: image },
            },
            { type: 'text', text: question },
          ],
        },
      ],
    });

    const answer = message.content
      .filter((block) => block.type === 'text')
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join(' ')
      .trim();

    if (!answer) {
      return Response.json(
        { error: 'Risposta del modello priva di contenuto testuale.' },
        { status: 502 },
      );
    }

    return Response.json({ answer });
  } catch (err) {
    console.error('[ask] errore chiamando Claude:', err);
    const messageText = err instanceof Error ? err.message : 'Errore sconosciuto';
    return Response.json({ error: messageText }, { status: 500 });
  }
}
