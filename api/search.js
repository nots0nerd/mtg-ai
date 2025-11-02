// Serverless function per Vercel - Endpoint /api/search
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const { validateScryfallQuery, validateFilters } = require('../src/scryfall/validators');

// System prompt per Gemini (stesso di server.js)
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

SCRYFALL SYNTAX RULES:

1. TEXT SEARCH (Abilities, Keywords):
   - o: or oracle: - Search Oracle text (rules text)
   - fo: or fulloracle: - Search full Oracle including reminder text
   - ft: or flavor: - Search flavor text

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

   d) Generic Effects (AVOID exact quotes - use multiple terms):
      ❌ WRONG: o:"destroy target creature"
      ✅ CORRECT: o:destroy o:creature

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

When a user asks for cards, convert their natural language to proper Scryfall syntax following these rules.`;

module.exports = async (req, res) => {
  // Abilita CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      
      const fullPrompt = `${SYSTEM_PROMPT}\n\nRichiesta utente: ${prompt}`;
      
      console.log('Calling Gemini API...');
      
      const result = await model.generateContent(fullPrompt);
      const response = await result.response;
      scryfallQuery = response.text().trim();
      
      // Valida la query generata
      try {
        validateScryfallQuery(scryfallQuery);
      } catch (validationError) {
        console.error('❌ Query validation failed:', validationError.message);
        
        // Log errore
        const logDir = path.join(process.cwd(), 'logs');
        if (!fs.existsSync(logDir)) {
          fs.mkdirSync(logDir, { recursive: true });
        }
        
        const errorLog = {
          timestamp: new Date().toISOString(),
          userQuery: prompt,
          generatedQuery: scryfallQuery,
          error: validationError.message
        };
        
        fs.appendFileSync(
          path.join(logDir, 'query-errors.log'),
          JSON.stringify(errorLog) + '\n'
        );
        
        throw validationError;
      }
      
      console.log('✅ Generated Scryfall query:', scryfallQuery);
    } catch (error) {
      console.error('Error generating query:', error);
      return res.status(500).json({ 
        error: 'Failed to generate Scryfall query',
        details: error.message 
      });
    }

    // Aggiungi filtri alla query
    let finalQuery = scryfallQuery;
    if (format && format !== 'all') {
      finalQuery += ` f:${format}`;
    }
    if (order && order !== 'auto') {
      finalQuery += ` order:${order}`;
    }
    if (direction && direction !== 'auto' && order && order !== 'auto') {
      finalQuery += ` direction:${direction}`;
    }

    // Chiama Scryfall API
    try {
      const scryfallUrl = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(finalQuery)}&page=${page}`;
      console.log('🔍 Calling Scryfall:', scryfallUrl);
      
      const scryfallResponse = await axios.get(scryfallUrl, {
        timeout: 10000
      });

      const scryfallData = scryfallResponse.data;
      const cards = scryfallData.data || [];
      const totalCards = scryfallData.total_cards || 0;
      const hasMore = scryfallData.has_more || false;

      // 🆕 Se has_more è false ma ci sono più carte di quelle ricevute,
      // significa che Scryfall ha dato tutte le carte in una volta
      // In questo caso, restituiamo tutte le carte per pagination client-side
      const shouldReturnAllCards = !hasMore && totalCards > 0 && cards.length === totalCards && totalCards > 20;
      
      // Se deve restituire tutte le carte, non limitare
      const cardsToReturn = shouldReturnAllCards ? cards : cards.slice(0, 20);
      
      // Calcola totalPages (Scryfall ritorna max 175 pagine)
      const totalPages = Math.min(Math.ceil(totalCards / 20), 175);

      return res.json({
        scryfall_query: finalQuery,
        results: cardsToReturn,
        pagination: {
          totalCards: totalCards,
          currentPage: parseInt(page),
          hasMore: hasMore,
          totalPages: totalPages,
          cardsInPage: cardsToReturn.length,
          isClientPagination: shouldReturnAllCards // 🆕 Flag per frontend
        }
      });
    } catch (error) {
      if (error.response?.status === 422 && error.response?.data?.code === 'not_found') {
        // Nessuna carta trovata
        return res.json({
          scryfall_query: finalQuery,
          results: [],
          pagination: {
            totalCards: 0,
            currentPage: 1,
            hasMore: false,
            totalPages: 0,
            cardsInPage: 0
          }
        });
      }
      
      if (error.response?.status === 404 || (error.response?.status === 422 && page > 1)) {
        // Pagina non esiste
        return res.status(400).json({
          error: 'Page does not exist',
          message: `Page ${page} is out of range`
        });
      }
      
      console.error('Scryfall API error:', error.response?.data || error.message);
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

