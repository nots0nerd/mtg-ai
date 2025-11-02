# MTG AI Search

Un'applicazione web per cercare carte Magic: The Gathering usando l'AI. Trasforma richieste in linguaggio naturale in query Scryfall e visualizza i risultati.

## 🚀 Funzionalità

- **Ricerca con AI**: Converti richieste in linguaggio naturale in query Scryfall
- **Interfaccia moderna**: Dark mode con design responsive
- **Visualizzazione carte**: Griglia di carte con immagini, mana cost, tipo e set

## 📋 Requisiti

- Node.js 24+
- npm 11+
- API Key Gemini (Google AI)

## 🛠️ Installazione

1. Clona il repository o naviga nella cartella del progetto

2. Installa le dipendenze del backend:
   ```bash
   npm install
   ```

3. Installa le dipendenze del frontend:
   ```bash
   cd client
   npm install
   ```

4. Configura le variabili d'ambiente:
   - Crea un file `.env` nella root del progetto
   - Aggiungi la tua API Key Gemini:
     ```
     GEMINI_API_KEY=your_api_key_here
     ```

## 🎮 Utilizzo

1. Avvia il server backend:
   ```bash
   node server.js
   ```
   Il server sarà disponibile su `http://localhost:3001`

2. Avvia il frontend (in un nuovo terminale):
   ```bash
   cd client
   npm run dev
   ```
   Il frontend sarà disponibile su `http://localhost:5173`

3. Apri il browser e vai su `http://localhost:5173`

4. Inserisci una richiesta in linguaggio naturale, ad esempio:
   - "creatures with flying"
   - "cheap blue cards"
   - "red dragon under 5 mana"

## 📚 Scryfall Query Syntax

Questo progetto usa la sintassi avanzata di ricerca di Scryfall. L'AI converte automaticamente le richieste in query valide.

### Quick Start

```javascript
// ✅ CORRECT
const query = "mv=1 t:creature o:flying";

// ❌ WRONG
const query = "cmc=1 t:creature kv:flying"; // kv: doesn't exist!
```

### Operatori Principali

- `o:` - Cerca nel testo Oracle (per abilità come flying, trample)
- `t:` - Tipo di carta (creature, instant, sorcery, ecc.)
- `mv:` o `cmc:` - Mana value/converted mana cost
- `c:` - Colore (w, u, b, r, g)

### Esempi di Conversione

| Linguaggio Naturale | Query Scryfall |
|---------------------|----------------|
| "creatures with flying" | `t:creature o:flying` |
| "cheap blue cards" | `c:u mv<3` |
| "red dragon under 5 mana" | `c:red t:dragon mv<5` |
| "instant that draws cards" | `t:instant o:"draw"` |

### ⚠️ Operatori da NON Usare

Questi operatori **non esistono** in Scryfall:
- ❌ `kv:` → ✅ Usa `o:`
- ❌ `keyword:` → ✅ Usa `o:`
- ❌ `ability:` → ✅ Usa `o:`
- ❌ `skill:` → ✅ Usa `o:`

Vedi `.cursorrules` per la documentazione completa della sintassi Scryfall.

## 📁 Struttura del Progetto

```
MTG/
├── server.js              # Backend Express con Gemini API
├── .env                   # Variabili d'ambiente (non committare!)
├── .cursorrules           # Regole sintassi Scryfall per Cursor
├── README.md              # Questo file
├── package.json           # Dipendenze backend
├── src/
│   └── scryfall/
│       └── validators.js  # Validatore query Scryfall
├── .cursor/
│   └── scryfall-context.md # Contesto per AI
└── client/                # Frontend React + Vite
    ├── src/
    │   ├── App.jsx        # Componente principale
    │   ├── App.css        # Stili dell'applicazione
    │   └── index.css      # Stili globali
    └── package.json       # Dipendenze frontend
```

## 🔧 Tecnologie Utilizzate

### Backend
- Express.js
- Google Gemini AI (@google/generative-ai)
- Axios (per chiamate Scryfall API)
- dotenv (gestione variabili ambiente)
- CORS

### Frontend
- React 19
- Vite
- Axios
- CSS3 (no frameworks)

## 📝 Note

- Le query vengono generate automaticamente dall'AI usando Gemini
- I risultati sono limitati a 20 carte per ricerca
- Il timeout per Gemini è di 5 secondi
- Il timeout per Scryfall è di 10 secondi

## 📄 Licenza

ISC

## 🤝 Contributi

Sentiti libero di aprire issue o pull request per miglioramenti!


