@AGENTS.md

# PROJECT

Nome: SeneGet

## Mission

Creare un'app mobile pensata per le persone cieche o ipovedenti.

L'app utilizza la fotocamera del telefono e un modello di AI Vision per riconoscere **qualsiasi cosa** si trovi davanti all'utente e descriverla, esclusivamente tramite audio, in tempo reale.

L'app diventa gli occhi dell'utente: gli permette di capire l'ambiente circostante e di camminare in modo normale e sicuro, semplicemente ascoltando.

L'app non mostra descrizioni testuali sullo schermo.

L'obiettivo è permettere all'utente di comprendere l'ambiente circostante ascoltando una descrizione naturale e utile.

## Cosa NON è

- Non è un'app di vendita, un negozio o un marketplace.
- Non riconosce prodotti per acquistarli né mostra listini o prezzi.
- L'unico scopo è descrivere a voce ciò che la fotocamera vede, per aiutare una persona cieca a orientarsi.

## Destinatari

L'utente tipico è una persona cieca o con grave disabilità visiva.

Di conseguenza:

- l'audio è l'unica interfaccia; nulla dipende dalla vista;
- l'app deve funzionare tenendo il telefono in mano mentre si cammina;
- affidabilità e sicurezza vengono prima di tutto, perché l'utente si fida di ciò che sente per muoversi.

---

# OBIETTIVO PRINCIPALE

L'utente apre l'app.

L'app attiva automaticamente la fotocamera.

L'AI osserva continuamente il video.

Ogni volta che rileva un cambiamento significativo nella scena, genera una nuova descrizione.

La descrizione viene riprodotta tramite sintesi vocale (Text-to-Speech).

---

# ESEMPI

Scenario 1

Utente davanti a un muro.

Audio:

> "Davanti a te c'è un muro a circa due metri."

---

Scenario 2

Utente davanti a un autobus in arrivo.

Audio:

> "A circa dieci metri sta arrivando un autobus rosso, numero 12."

Quando il modello riesce a leggerli, la descrizione include dettagli utili come il colore e il numero del mezzo. Se non li riconosce con sicurezza, li omette.

---

Scenario 3

Persona che attraversa.

Audio:

> "Una persona sta attraversando davanti a te."

---

Scenario 4

Utente davanti a una casa.

Audio:

> "Davanti a te c'è una casa, con un cancello sulla destra."

---

Scenario 5

Più persone presenti nella scena.

Audio:

> "Ci sono alcune persone ferme davanti a te, a circa tre metri."

---

Scenario 6

Scale.

Audio:

> "Ci sono delle scale che salgono davanti a te."

---

Scenario 7

Porta.

Audio:

> "Alla tua destra c'è una porta."

---

Scenario 8

Automobile in movimento.

Audio:

> "Un'automobile sta passando da sinistra verso destra."

---

# ESPERIENZA UTENTE

L'app deve essere estremamente semplice.

Nessuna schermata complessa.

Nessun menu inutile.

L'utente apre l'app e riceve immediatamente descrizioni vocali.

L'audio è l'interfaccia principale.

---

# REGOLE DI DESCRIZIONE

L'AI deve:

- riconoscere qualsiasi tipo di oggetto, luogo, mezzo, persona o animale;
- descrivere solo ciò che vede realmente;
- non inventare dettagli;
- includere i dettagli identificativi utili quando li riconosce con sicurezza (colore, numero di un autobus, testo di un cartello, tipo di edificio);
- usare frasi brevi e naturali;
- evitare descrizioni ripetitive;
- aggiornare la descrizione solo quando la scena cambia;
- dare priorità agli elementi più importanti;
- indicare la posizione degli oggetti quando possibile (davanti, destra, sinistra);
- stimare la distanza solo quando il modello ha sufficiente confidenza.

---

# PRIORITÀ

Ordine di importanza:

1. ostacoli immediati;
2. persone;
3. veicoli;
4. scale;
5. porte;
6. muri;
7. mobili;
8. animali;
9. segnali;
10. altri oggetti.

---

# DISTANZA

Quando possibile, indicare una distanza approssimativa.

Esempi:

"Un muro a circa due metri."

"Una persona a circa cinque metri."

"Un'automobile a circa venti metri."

Non inventare la distanza.

Se non è stimabile, ometterla.

---

# MOVIMENTO

L'AI deve distinguere oggetti fermi da oggetti in movimento.

Esempi:

"Una bicicletta si sta avvicinando."

"Un autobus si sta allontanando."

"Una persona cammina verso di te."

---

# AGGIORNAMENTI

Non ripetere continuamente la stessa frase.

Esempio:

❌

"Muro davanti."

"Muro davanti."

"Muro davanti."

"Muro davanti."

Corretto:

L'app parla solo quando:

- compare un nuovo oggetto;
- un oggetto scompare;
- cambia la distanza;
- cambia la direzione;
- cambia la situazione.

---

# STILE DELLE RISPOSTE

Le descrizioni devono essere:

- brevi;
- naturali;
- facili da capire;
- utili;
- pronunciate come farebbe una persona.

Esempio:

"Alla tua sinistra c'è una panchina."

e non

"Ho rilevato una struttura identificabile come panchina."

---

# OUTPUT DEL MODELLO

Il modello Vision restituisce una struttura dati interna con:

- oggetti rilevati;
- posizione;
- distanza stimata;
- movimento;
- livello di confidenza.

L'utente non vede questi dati.

Servono solo per generare il messaggio vocale.

---

# AUDIO

Ogni descrizione viene convertita immediatamente in voce.

Non mostrare testo sullo schermo.

L'audio è il canale principale di comunicazione.

---

# PERFORMANCE

L'analisi deve essere continua.

L'obiettivo è una latenza inferiore a un secondo tra ciò che la fotocamera vede e ciò che viene pronunciato.

---

# PRINCIPI

- Voice First
- AI Vision First
- Nessun testo necessario
- Esperienza semplice
- Risposte naturali
- Bassa latenza
- Sicurezza come priorità

---

# IMPORTANTE

L'AI non deve mai dichiarare come certo qualcosa che non vede chiaramente.

Quando non è sicura, deve usare espressioni come:

"Sembra esserci..."

"Potrebbe esserci..."

oppure evitare di descrivere quell'elemento.

La precisione è più importante della quantità di informazioni.
