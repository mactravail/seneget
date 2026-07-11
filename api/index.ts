// Entry point della funzione serverless su Vercel.
// Inoltra ogni richiesta al server Expo Router esportato in `dist/server`
// (SSR delle pagine web + API routes come /api/analyze).
// Vedi vercel.json per build command, output e rewrites.
const { createRequestHandler } = require('expo-server/adapter/vercel');

module.exports = createRequestHandler({
  build: require('path').join(__dirname, '../dist/server'),
});
