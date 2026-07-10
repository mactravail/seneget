import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

/**
 * Shell HTML per il web (solo rendering statico lato Node).
 * Imposta lingua, meta SEO e uno sfondo scuro per evitare il flash bianco
 * prima che React monti la landing page.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="it">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        <title>SeneGet — Inquadra, ascolta, cammina</title>
        <meta
          name="description"
          content="SeneGet è la guida vocale per chi non vede: la fotocamera del telefono e l'AI descrivono a voce, in tempo reale, tutto ciò che hai davanti — persone, ostacoli, mezzi, scale e porte. Solo audio, nessuno schermo da guardare."
        />
        <meta name="theme-color" content="#000000" />

        {/* Open Graph / social */}
        <meta property="og:title" content="SeneGet — Inquadra, ascolta, cammina" />
        <meta
          property="og:description"
          content="La guida vocale in tempo reale per persone cieche e ipovedenti. L'AI descrive a voce ciò che hai davanti, così puoi camminare in sicurezza."
        />
        <meta property="og:type" content="website" />

        <ScrollViewStyleReset />

        {/* Sfondo scuro coerente con l'app, senza flash bianco. */}
        <style dangerouslySetInnerHTML={{ __html: rootStyle }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const rootStyle = `
html, body { background-color: #000; }
body { overscroll-behavior: none; }
`;
