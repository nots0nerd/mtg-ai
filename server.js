require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { validateScryfallQuery, validateFilters } = require('./src/scryfall/validators');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Inizializza Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Scryfall Query Builder
 * 
 * IMPORTANT: Follow syntax rules in .cursorrules
 * 
 * Valid operators:
 * - o: (oracle text for abilities like flying, trample)
 * - t: (card type)
 * - mv: or cmc: (mana value)
 * - c: (color)
 * 
 * Example: "one mana flying creature" → "mv=1 t:creature o:flying"
 * 
 * ❌ WRONG: kv:flying
 * ✅ CORRECT: o:flying
 */

// System prompt per Gemini - Ultra-Simple v4.0
const SYSTEM_PROMPT = `You convert Magic card searches to Scryfall syntax.

🚨 CRITICAL RULE #1: NEVER USE "gives" or "grants" IN QUERIES!

When user says "gives/grants [ability]", Magic cards actually say "has/have [ability]".

❌ WRONG EXAMPLES (NEVER DO THIS):
- o:"gives haste" ❌ WRONG!
- o:"grants flying" ❌ WRONG!
- o:"gives trample" ❌ WRONG!

✅ CORRECT TRANSLATION:
User says → You write
"gives haste" → o:"has haste" OR o:"have haste"
"grants flying" → o:"has flying" OR o:"have flying"  
"gives trample" → o:"has trample" OR o:"have trample"

═══════════════════════════════════════════════════════════
## QUICK DECISION TREE
═══════════════════════════════════════════════════════════

1️⃣ CARDS WITH ABILITY (user says "with/has")
   → Use keyword:[ability]
   
   "creature with haste" → t:creature keyword:haste
   "with flying" → keyword:flying

2️⃣ CARDS THAT GRANT (user says "gives/grants/buffs")  
   → Use o:"has [ability]" or o:"have [ability]"
   
   "creature that gives haste" → t:creature o:"have haste"
   "gives trample" → o:"has trample"
   "enchantment that grants flying" → t:enchantment o:"has flying"

3️⃣ CARDS THAT DO ACTION (creates/destroys/draws)
   → Use o:[verb] o:[object]
   
   "creates tokens" → o:create o:token
   "destroys artifacts" → o:destroy o:artifact

## BASIC FILTERS

COLOR: c:red, c:blue, c:white, c:black, c:green (or c:r, c:u, c:w, c:b, c:g)
TYPE: t:creature, t:instant, t:sorcery, t:artifact, t:enchantment
MANA: mv=3, mv<=2, mv>=5, mv<4
STATS: pow>=5, tou<3, pow>tou

═══════════════════════════════════════════════════════════
## MORE EXAMPLES - STUDY THESE!
═══════════════════════════════════════════════════════════

✅ "red mana creature that gives trample"
   → c:red t:creature o:"has trample"
   (NOT o:"gives trample"!)

✅ "red two mana creature that gives trample"  
   → c:red mv=2 t:creature o:"has trample"
   (NOT o:"gives trample"!)

✅ "enchantment that grants flying"
   → t:enchantment o:"has flying"
   (NOT o:"grants flying"!)

✅ "artifact that gives haste"
   → t:artifact o:"has haste"
   (NOT o:"gives haste"!)

✅ "creature with haste" (HAS ability, not GRANTS)
   → t:creature keyword:haste

✅ "creature that gives haste to others" (GRANTS ability)
   → t:creature o:"have haste"

✅ "creates tokens"
   → o:create o:token

✅ "when enters draws"
   → o:"when" o:"enters" o:"draw"

═══════════════════════════════════════════════════════════
## FINAL REMINDERS
═══════════════════════════════════════════════════════════

1. User says "gives/grants" → YOU write o:"has" or o:"have"
2. User says "with" → YOU write keyword:
3. Multi-word abilities need quotes: keyword:"first strike"
4. NEVER EVER use o:"gives" or o:"grants" - it doesn't exist in Magic!

OUTPUT: Return ONLY the Scryfall query, nothing else.`;
Now convert the user's query following this decision tree.`;

// Endpoint POST /api/search
// Gestisce sia /api/search (locale) che /search (Vercel rimuove /api)
const handleSearch = async (req, res) => {
  try {
    const { prompt, format, order, direction, page = 1 } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Valida i filtri
    const filterError = validateFilters(format, order, direction);
    if (filterError) {
      console.error('❌ Filter validation failed:', filterError);
      return res.status(400).json({ 
        error: 'Invalid filters',
        details: filterError 
      });
    }

    console.log('\n📨 Received request:');
    console.log('   Message:', prompt);
    console.log('   Format:', format || 'undefined');
    console.log('   Order:', order || 'undefined');
    console.log('   Direction:', direction || 'undefined');
    console.log('   Page:', page);

    // Trasforma il prompt in query Scryfall usando Gemini
    let scryfallQuery;
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      
      const fullPrompt = `${SYSTEM_PROMPT}\n\nRichiesta utente: ${prompt}`;
      
      console.log('Calling Gemini API...');
      
      // Timeout di 5 secondi per la richiesta Gemini
      const geminiPromise = model.generateContent(fullPrompt);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Gemini API timeout')), 5000)
      );
      
      const result = await Promise.race([geminiPromise, timeoutPromise]);
      const response = await result.response;
      scryfallQuery = response.text().trim();
      
      // Valida la query generata
      try {
        validateScryfallQuery(scryfallQuery);
      } catch (validationError) {
        // Crea log entry per analisi errori
        const errorLog = {
          timestamp: new Date().toISOString(),
          userQuery: prompt,
          generatedQuery: scryfallQuery,
          error: validationError.message,
        };
        
        // Log su console (per debug immediato)
        console.error('❌ [VALIDATION ERROR]', errorLog);
        
        // Assicura che la directory logs esista
        const logsDir = path.join(__dirname, 'logs');
        if (!fs.existsSync(logsDir)) {
          fs.mkdirSync(logsDir, { recursive: true });
        }
        
        // Salva su file (per analisi successiva)
        const logFile = path.join(logsDir, 'query-errors.log');
        fs.appendFileSync(
          logFile,
          JSON.stringify(errorLog) + '\n'
        );
        
        return res.status(500).json({ 
          error: 'Invalid Scryfall query generated',
          details: validationError.message 
        });
      }
      
      console.log('✅ Query validation passed');
      
      // 🆕 AGGIUNGI FILTRI alla query
      console.log('🔧 Before filters:', scryfallQuery);
      let finalQuery = scryfallQuery;
      
      // Aggiungi filtro formato se presente
      if (format && format !== 'all') {
        finalQuery += ` f:${format}`;
        console.log('✅ Added format:', format);
      }
      
      // Aggiungi ordinamento se presente
      if (order && order !== 'auto') {
        finalQuery += ` order:${order}`;
        console.log('✅ Added order:', order);
        
        // Aggiungi direzione se presente e non auto
        if (direction && direction !== 'auto') {
          finalQuery += ` direction:${direction}`;
          console.log('✅ Added direction:', direction);
        }
      }
      
      console.log('🔧 After filters:', finalQuery);
      
      // ⚠️ IMPORTANTE: AGGIORNA LA VARIABILE
      scryfallQuery = finalQuery;
      
      console.log('Generated Scryfall query:', scryfallQuery);
    } catch (error) {
      console.error('Error calling Gemini API:', error.message);
      return res.status(500).json({ 
        error: 'Failed to generate Scryfall query',
        details: error.message 
      });
    }

    // Chiama Scryfall API
    try {
      console.log('Calling Scryfall API with query:', scryfallQuery);
      
      // Costruisci URL Scryfall con paginazione
      const scryfallUrl = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(scryfallQuery)}&page=${page}`;
      
      console.log('🔍 Fetching from Scryfall:', scryfallUrl);
      
      let scryfallResponse;
      try {
        scryfallResponse = await axios.get(scryfallUrl, {
          timeout: 10000 // 10 secondi timeout per Scryfall
        });
      } catch (axiosError) {
        // Gestisce sia 404 che 422 con code "not_found" (query senza risultati)
        if ((axiosError.response?.status === 404 || axiosError.response?.status === 422) && 
            axiosError.response?.data?.code === 'not_found') {
          console.log('ℹ️ No cards found for query:', scryfallQuery);
          return res.json({
            scryfall_query: scryfallQuery,
            results: [],
            pagination: {
              totalCards: 0,
              currentPage: 1,
              hasMore: false,
              totalPages: 0,
              cardsInPage: 0
            },
            message: 'No cards found matching your search'
          });
        }
        
        // Pagina fuori range (solo se page > 1)
        if ((axiosError.response?.status === 404 || axiosError.response?.status === 422) && page > 1) {
          console.log('⚠️ Page out of range:', page);
          return res.status(400).json({
            error: 'Page does not exist',
            message: `Page ${page} is out of range`,
            scryfall_query: scryfallQuery
          });
        }
        
        throw axiosError; // Rilancia altri errori
      }

      // 🆕 Gestisci errore 422 (pagina non esiste) - fallback se axios non lo cattura
      if (scryfallResponse.status === 422) {
        console.log('⚠️ Scryfall 422: Requested page does not exist');
        return res.status(400).json({
          error: 'Page does not exist',
          message: 'The requested page is out of range.',
          scryfall_query: scryfallQuery,
          results: [],
          pagination: {
            totalCards: 0,
            currentPage: 1,
            hasMore: false,
            totalPages: 1,
            cardsInPage: 0
          }
        });
      }

      const scryfallData = scryfallResponse.data;
      const cards = scryfallData.data || [];
      
      // 🔍 LOG COMPLETO PER DEBUG
      console.log('🔍 Scryfall Response:');
      console.log('  - total_cards:', scryfallData.total_cards);
      console.log('  - data.length:', scryfallData.data?.length);
      console.log('  - has_more:', scryfallData.has_more);
      console.log('  - object:', scryfallData.object);
      
      // Se c'è un errore da Scryfall
      if (scryfallData.object === 'error') {
        console.error('❌ Scryfall error:', scryfallData.details);
        return res.status(404).json({
          scryfall_query: scryfallQuery,
          results: [],
          count: 0,
          pagination: {
            totalCards: 0,
            currentPage: parseInt(page),
            hasMore: false,
            totalPages: 0,
            cardsInPage: 0
          }
        });
      }
      
      // 🔍 LOG DETTAGLIATO
      console.log('📊 Scryfall Response Details:');
      console.log('  - total_cards:', scryfallData.total_cards);
      console.log('  - data.length:', scryfallData.data?.length);
      console.log('  - has_more:', scryfallData.has_more);
      
      // 🔧 CALCOLO CORRETTO
      const totalCards = scryfallData.total_cards || 0;
      const cardsInCurrentPage = scryfallData.data?.length || 0;
      const hasMore = scryfallData.has_more || false;
      
      // 🆕 CALCOLO CORRETTO DELLE PAGINE
      // Se Scryfall ha mandato tutte le carte in una volta (has_more = false)
      // ma ci sono più di 20 carte, dobbiamo fare pagination client-side
      let totalPages;
      let needsClientPagination = false;

      if (!hasMore && totalCards > 20) {
        // Scryfall ha mandato tutto, ma ci sono più di 20 carte
        // Calcola pagine per client-side pagination
        totalPages = Math.ceil(totalCards / 20);
        needsClientPagination = true;
        console.log('🔄 Client-side pagination needed');
      } else if (hasMore) {
        // Pagination normale server-side
        totalPages = Math.ceil(totalCards / 20);
      } else {
        // Tutto sta in una pagina (≤ 20 carte)
        totalPages = 1;
      }
      
      console.log(`📄 Pagination Calculation:`);
      console.log(`  - Current page: ${page}`);
      console.log(`  - Cards in page: ${cardsInCurrentPage}`);
      console.log(`  - Total cards: ${totalCards}`);
      console.log(`  - Has more: ${hasMore}`);
      console.log(`  - Calculated total pages: ${totalPages}`);
      console.log(`  - Client pagination needed: ${needsClientPagination}`);
      
      // Non limitare le carte se serve client-side pagination
      // Il frontend gestirà lo slicing
      const returnCards = needsClientPagination ? cards : cards.slice(0, 20);

      return res.json({
        scryfall_query: scryfallQuery,
        results: returnCards,
        count: returnCards.length,
        pagination: {
          totalCards: totalCards,
          currentPage: parseInt(page),
          hasMore: needsClientPagination ? (parseInt(page) < totalPages) : hasMore,
          totalPages: totalPages,
          cardsInPage: returnCards.length,
          needsClientPagination: needsClientPagination // 🆕 Flag per frontend
        }
      });
    } catch (error) {
      console.error('Error calling Scryfall API:', error.message);
      
      // Se Scryfall ritorna 404 (nessun risultato), ritorna array vuoto
      if (error.response && error.response.status === 404) {
        return res.json({
          scryfall_query: scryfallQuery,
          results: [],
          count: 0,
          pagination: {
            totalCards: 0,
            currentPage: parseInt(page || 1),
            hasMore: false,
            totalPages: 0,
            needsClientPagination: false
          }
        });
      }
      
      return res.status(500).json({ 
        error: 'Failed to fetch cards from Scryfall',
        details: error.message 
      });
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
};

// Registra le route (locale e Vercel)
app.post('/api/search', handleSearch);
app.post('/search', handleSearch);

// Endpoint di test
app.get('/', (req, res) => {
  res.json({ message: 'MTG Search API is running' });
});

// Export per Vercel serverless functions
module.exports = app;

// Avvia il server solo in locale (non su Vercel)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}