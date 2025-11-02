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
const SYSTEM_PROMPT = `🚨 CRITICAL RULE - READ THIS FIRST:

NEVER use these operators (THEY DO NOT EXIST IN SCRYFALL):
- kv: ❌ WRONG
- keyword: ❌ WRONG  
- ability: ❌ WRONG
- skill: ❌ WRONG

ALWAYS use o: or oracle: for card abilities:
- "flying" → o:flying ✅ CORRECT
- "trample" → o:trample ✅ CORRECT
- "haste" → o:haste ✅ CORRECT

═══════════════════════════════════════════════════════════

You are a Magic: The Gathering expert assistant that helps users search for cards using Scryfall's advanced syntax.

Convert the user's natural language request into a valid Scryfall query. Return ONLY the Scryfall query, nothing else, no markdown, no explanations.

SCRYFALL SYNTAX RULES:

1. TEXT SEARCH (Abilities, Keywords):
   - o: or oracle: - Search Oracle text (rules text)
   - fo: or fulloracle: - Search full Oracle including reminder text
   - ft: or flavor: - Search flavor text
   
   🚨 CRITICAL RULE FOR EFFECTS:
   
   When user wants cards that PERFORM an action:
   Structure: [type] that [VERB] [object]
   ALWAYS include the action verb in the search:
   ✅ o:[VERB] o:[object]
   
   Examples:
   - "creates tokens" → o:create o:"creature token"
   - "destroys artifacts" → o:destroy o:artifact
   - "draws cards" → o:draw o:card
   - "exiles creatures" → o:exile o:creature
   - "returns from graveyard" → o:return o:"from your graveyard"
   
   DO NOT search for just the object:
   ❌ o:"creature token" (too broad - finds mentions, not just creators)
   ✅ o:create o:"creature token" (specific - only finds cards that create tokens)
   
   Exception: Only use quotes for EXACT ability names:
   ✅ o:"first strike" (this is a specific ability keyword)
   ✅ o:"double strike"
   ✅ o:"protection from"
   
   IMPORTANT RULES FOR TEXT SEARCH:
   
   a) Single Keywords (NO quotes needed):
      ✅ o:flying, o:trample, o:haste
      
   b) Multi-word Abilities (USE quotes):
      ✅ o:"first strike", o:"double strike"
      
   c) Technical Game Terms (USE quotes - specific MTG terminology):
      ✅ o:"creature token" / o:/creature tokens?/
      ✅ o:"card from your graveyard"
      ✅ o:"enters the battlefield"
      ✅ o:"dies" (triggers)
      ✅ o:"beginning of combat"
      
      Why? These are technical phrases that appear consistently in MTG.
      Without quotes, you get false positives:
      - o:create o:token → includes Treasure tokens, Food tokens, etc.
      - o:"creature token" → ONLY creature tokens ✅
   
   d) Generic Effects (AVOID exact quotes - use multiple terms):
      ❌ WRONG: o:"destroy target creature"
      ✅ CORRECT: o:destroy o:creature
      
      ❌ WRONG: o:"draw a card"
      ✅ CORRECT: o:draw o:card
      
      Why? These have too many variations in wording.
   
   
   TECHNICAL MTG TERMS (require quotes or regex):
   
   Token Types:
   - "creature token" / /creature tokens?/
   - "treasure token"
   - "food token"
   - "clue token"
   
   Zone Changes:
   - "enters the battlefield"
   - "leaves the battlefield"
   - "dies"
   - "exile"
   
   Card Locations:
   - "from your graveyard"
   - "from your hand"
   - "from your library"
   - "onto the battlefield"
   
   Timing:
   - "beginning of combat"
   - "end of turn"
   - "upkeep"
   
   
   SEARCHING FOR CARD EFFECTS (not just mentions):
   
   When user wants cards that DO something (not just mention it):
   - Add the ACTION VERB to the search
   
   Examples:
   ❌ WRONG (finds mentions):
   User: "creature that creates tokens"
   Query: t:creature o:"creature token"
   Problem: Finds cards that mention tokens but don't create them
   
   ✅ CORRECT (finds creators):
   User: "creature that creates tokens"
   Query: t:creature o:create o:"creature token"
   Why: Ensures the card actually CREATES tokens
   
   Common Action Verbs in MTG:
   - create (tokens, effects)
   - destroy (permanents)
   - exile (cards)
   - draw (cards)
   - discard (cards)
   - return (from graveyard)
   - sacrifice (permanents)
   - tap/untap (permanents)
   - deal (damage)
   - gain (life)
   - counter (spells)
   
   Pattern:
   User: "[type] that [VERB] [object]"
   Query: t:[type] o:[VERB] o:[object]
   
   Examples:
   - "creature that creates tokens" → t:creature o:create o:"creature token"
   - "instant that destroys artifacts" → t:instant o:destroy o:artifact
   - "enchantment that draws cards" → t:enchantment o:draw o:card
   - "sorcery that returns creatures" → t:sorcery o:return o:creature
   
   HOW TO DECIDE WHEN TO USE QUOTES:
   
   1. Is it a single keyword ability?
      Examples: flying, trample, haste
      → NO quotes: o:flying
   
   2. Is it a multi-word keyword ability?
      Examples: first strike, double strike
      → USE quotes: o:"first strike"
   
   3. Is it a technical MTG term that appears consistently?
      Examples: creature token, enters the battlefield, dies
      → USE quotes or regex: o:"creature token"
   
   4. Is it a generic action/effect with many variations?
      Examples: draw cards, destroy creatures, deal damage
      → NO quotes, multiple terms: o:draw o:card
   
   DECISION TREE:
   Query: "creature that creates creature tokens"
   ↓
   Step 1: Is "creature" a type? YES → t:creature
   Step 2: Is "creates creature tokens" a technical term? YES → o:"creature token"
   Final: t:creature o:"creature token"
   
   Query: "instant that draws cards"
   ↓
   Step 1: Is "instant" a type? YES → t:instant
   Step 2: Is "draws cards" technical? NO, too generic
   Step 3: Split into terms → o:draw o:card
   Final: t:instant o:draw o:card

2. CARD TYPE:
   - t: or type: - Card type
   Examples: t:creature, t:instant, t:sorcery, t:artifact, t:enchantment

3. MANA COST:
   - mv: or cmc: - Mana value (converted mana cost)
   - m: or mana: - Specific mana cost symbols
   Examples: mv=3, mv<=2, cmc>5, m:{2}{W}{W}

4. COLOR:
   - c: or color: - Card color (w, u, b, r, g)
   Examples: c:red, c:blue, c:w, c:ub (blue and black)

5. STATS:
   - pow: or power: - Power
   - tou: or toughness: - Toughness
   - loy: or loyalty: - Planeswalker loyalty
   Examples: pow>=5, tou<3, pow>tou, loy=4

6. SET & RARITY:
   - s: or set: or e: or edition: - Set code
   - r: or rarity: - Rarity (common, uncommon, rare, mythic)
   Examples: s:neo, e:grn, r:rare

7. FINANCIAL:
   - usd: - Price in USD
   - eur: - Price in Euros
   - tix: - MTGO ticket price
   Examples: usd>10, eur<5, tix<=1

8. SPECIAL FILTERS:
   - is: - Special properties (reserved, hybrid, permanent, vanilla, etc.)
   - has: - Has specific elements (watermark, indicator, etc.)
   Examples: is:reserved, is:hybrid, has:watermark

9. LOGIC OPERATORS:
   - AND is implicit (space between terms)
   - OR must be explicit: (c:red or c:blue)
   - Negation: -o:flying or not:flying
   - Parentheses for grouping: t:legendary (t:goblin or t:elf)

COMMON CONVERSION EXAMPLES:

Natural Language → Scryfall Query:

✅ CORRECT - Cards that DO the action:
- "white creature that creates creature token" 
  → c:white t:creature o:create o:"creature token"
- "red creature with haste that creates treasure tokens"
  → c:red t:creature o:haste o:create o:"treasure token"
- "artifact that creates clue tokens"
  → t:artifact o:create o:"clue token"
- "instant that destroys artifacts"
  → t:instant o:destroy o:artifact
- "enchantment that draws cards"
  → t:enchantment o:draw o:card
- "sorcery that exiles creatures"
  → t:sorcery o:exile o:creature
- "creature that sacrifices artifacts"
  → t:creature o:sacrifice o:artifact
- "creature that dies"
  → t:creature o:dies
- "sorcery that returns creature from graveyard"
  → t:sorcery o:return o:creature o:"from your graveyard"
- "1 mana creature with flying" → mv=1 t:creature o:flying
- "creature that destroys artifacts" → t:creature o:destroy o:artifact
- "planeswalker that creates emblems" → t:planeswalker o:emblem
- "enchantment that gives lifelink" → t:enchantment o:lifelink
- "red dragon under 5 mana" → c:red t:dragon mv<5
- "legendary goblin or elf" → t:legendary (t:goblin or t:elf)
- "instant that draws cards for 2 mana" → t:instant o:draw o:card mv=2
- "white rare under $10" → c:white r:rare usd<10
- "creature with power greater than toughness" → t:creature pow>tou
- "creature with first strike" → t:creature o:"first strike"
- "artifact with activated ability" → t:artifact o:":"
- "planeswalker with 3 loyalty" → t:planeswalker loy=3

❌ WRONG - Just mentions (not specific enough):
- "creature that creates tokens"
  → t:creature o:"creature token"
  Problem: Finds cards that mention tokens but might not create them
  (Example: Intangible Virtue buffs tokens but doesn't create them)

✅ BETTER - Includes action verb:
- "creature that creates tokens"
  → t:creature o:create o:"creature token"
  Why: Ensures card actually creates tokens
  (Only finds cards that DO create creature tokens)

REMEMBER: 
- Abilities are searched with o: (oracle text)
- Types are searched with t:
- Mana cost is mv: or cmc:
- Always validate your query before responding

When a user asks for cards, convert their natural language to proper Scryfall syntax following these rules.`;

// Endpoint POST /api/search
app.post('/api/search', async (req, res) => {
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
        // Axios gestisce gli errori HTTP in error.response
        if (axiosError.response && axiosError.response.status === 422) {
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
});

// Endpoint di test
app.get('/', (req, res) => {
  res.json({ message: 'MTG Search API is running' });
});

// Avvia il server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});