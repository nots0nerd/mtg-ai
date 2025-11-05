// Serverless function per Vercel - Endpoint /api/search
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');

// Validators inline per evitare problemi di percorso su Vercel
const validateScryfallQuery = (query) => {
  const INVALID_OPERATORS = ['kv:', 'ability:', 'skill:'];
  INVALID_OPERATORS.forEach(invalid => {
    if (query.includes(invalid)) {
      throw new Error(`Invalid operator '${invalid}' found in query.`);
    }
  });
};

const validateFilters = (format, order, direction) => {
  const VALID_FORMATS = ['standard', 'pioneer', 'modern', 'legacy', 'vintage', 'commander', 'edh', 'pauper', 'historic', 'explorer', 'alchemy', 'brawl', 'future', 'oldschool', 'premodern', 'duel', 'penny'];
  const VALID_ORDER_BY = ['name', 'set', 'released', 'rarity', 'color', 'usd', 'tix', 'eur', 'cmc', 'power', 'toughness', 'edhrec', 'penny', 'artist', 'review'];
  const VALID_DIRECTIONS = ['auto', 'asc', 'desc'];
  const errors = [];
  if (format && !VALID_FORMATS.includes(format.toLowerCase()) && format !== 'all') {
    errors.push(`Invalid format '${format}'.`);
  }
  if (order && !VALID_ORDER_BY.includes(order.toLowerCase()) && order !== 'auto') {
    errors.push(`Invalid order '${order}'.`);
  }
  if (direction && !VALID_DIRECTIONS.includes(direction.toLowerCase())) {
    errors.push(`Invalid direction '${direction}'.`);
  }
  return errors.length > 0 ? errors.join('; ') : null;
};

// Post-processing validation layer - Research Priority 1
function validateAndCorrect(query) {
  const corrections = {
    'o:"gives ': 'o:"has ',
    'o:"grants ': 'o:"has ',
    'o:"give ': 'o:"have ',
    'o:"grant ': 'o:"have ',
    'o:gives': 'o:has',
    'o:grants': 'o:has',
    'o:give': 'o:have',
    'o:grant': 'o:have'
  };
  
  let corrected = query;
  for (const [wrong, right] of Object.entries(corrections)) {
    corrected = corrected.replace(new RegExp(wrong, 'gi'), right);
  }
  
  return corrected;
}

// Set name extraction - uses full mtg-sets.json database
// Cache sets data to avoid reloading on every request
let setsCache = null;

function loadSetsCache() {
  if (setsCache) return setsCache;
  
  try {
    const setsPath = path.join(__dirname, '..', 'mtg-sets.json');
    if (fs.existsSync(setsPath)) {
      const setsData = JSON.parse(fs.readFileSync(setsPath, 'utf8'));
      // Filter to only expansion/core sets (exclude tokens, memorabilia, etc.)
      setsCache = setsData
        .filter(set => ['expansion', 'core', 'commander', 'draft_innovation'].includes(set.set_type))
        .map(set => ({
          code: set.code,
          name: set.name.toLowerCase(),
          fullName: set.name
        }));
      console.log(`📚 Loaded ${setsCache.length} sets for name matching`);
      return setsCache;
    }
  } catch (error) {
    console.warn('⚠️ Could not load mtg-sets.json:', error.message);
  }
  
  return [];
}

function extractSetCodeFromQuery(userQuery) {
  if (!userQuery) return null;
  
  const sets = loadSetsCache();
  if (sets.length === 0) return null;
  
  const queryLower = userQuery.toLowerCase();
  
  // Patterns that indicate set names: "from [Set]", "in [Set]", "[Set] set", etc.
  const setPatterns = [
    /(?:from|in|of|set|edition)\s+([a-z][a-z\s:']{2,})/gi,
    /^([a-z][a-z\s:']{2,})\s+(?:set|cards?|edition)/gi,
    /([a-z][a-z\s:']{2,})\s+(?:rare|mythic|uncommon|common)/gi
  ];
  
  let potentialSetNames = [];
  
  // Extract potential set names using patterns
  setPatterns.forEach(pattern => {
    const matches = [...userQuery.matchAll(pattern)];
    matches.forEach(match => {
      if (match[1]) {
        potentialSetNames.push(match[1].trim());
      }
    });
  });
  
  // Also check if entire query or significant parts match a set name
  const words = queryLower.split(/\s+/).filter(w => w.length > 2);
  if (words.length >= 2) {
    // Check 2-4 word combinations
    for (let i = 0; i < words.length - 1; i++) {
      for (let j = i + 2; j <= Math.min(i + 4, words.length + 1); j++) {
        const phrase = words.slice(i, j).join(' ');
        potentialSetNames.push(phrase);
      }
    }
  }
  
  // Fuzzy match against set names
  let bestMatch = null;
  let bestScore = 0;
  
  potentialSetNames.forEach(potential => {
    sets.forEach(set => {
      // Exact match
      if (set.name === potential) {
        bestMatch = set.code;
        bestScore = 100;
        return;
      }
      
      // Contains match (set name contains the phrase or vice versa)
      if (set.name.includes(potential) || potential.includes(set.name)) {
        const score = Math.min(set.name.length, potential.length) / Math.max(set.name.length, potential.length);
        if (score > bestScore && score > 0.6) {
          bestMatch = set.code;
          bestScore = score;
        }
      }
      
      // Word-by-word match (e.g., "Final Fantasy" matches "final fantasy")
      const setWords = set.name.split(/\s+/);
      const potentialWords = potential.split(/\s+/);
      if (potentialWords.length >= 2 && potentialWords.every(word => 
        setWords.some(sw => sw.startsWith(word) || word.startsWith(sw))
      )) {
        const score = potentialWords.length / setWords.length;
        if (score > bestScore && score > 0.7) {
          bestMatch = set.code;
          bestScore = score;
        }
      }
    });
  });
  
  if (bestMatch && bestScore > 0.6) {
    console.log(`🎯 Extracted set code: ${bestMatch} (confidence: ${Math.round(bestScore * 100)}%)`);
    return bestMatch;
  }
  
  return null;
}

// System prompt - Research-Optimized v5.0 (Priority 2)
// Structure: Negative examples FIRST, shorter length (500-800 tokens), validation checklist
const SYSTEM_PROMPT = `You convert Magic card searches to Scryfall syntax.

⚠️ COMMON ERRORS TO AVOID ⚠️
1. NEVER output o:"gives" - returns 0 results
2. NEVER output o:"grants" - Magic cards don't use this word
3. The #1 mistake is literal translation

CRITICAL TRANSLATION RULE:
When users say "gives/grants [ability]", Magic cards say "has/have [ability]"

❌ WRONG EXAMPLES (These fail):
"creature that gives haste" → o:"gives haste" ❌ NO RESULTS
"grants flying" → o:"grants flying" ❌ WRONG WORD
"enchantment gives trample" → o:"gives trample" ❌ NOT IN ORACLE TEXT

✅ CORRECT EXAMPLES:
"creature that gives haste" → t:creature o:"has haste" ✅
"grants flying" → o:"has flying" ✅
"red gives trample" → c:red o:"has trample" ✅
"artifact that gives haste" → t:artifact o:"has haste" ✅

DECISION TREE:
1. User says "with [ability]" → keyword:[ability]
   Example: "creature with haste" → t:creature keyword:haste

2. User says "gives/grants [ability]" → o:"has [ability]"
   Example: "creature that gives haste" → t:creature o:"has haste"

3. Actions (creates/destroys/draws) → o:[verb]
   Example: "creates tokens" → o:create o:token

4. Sets/Editions → s:[code]
   Example: "cards from Innistrad" → s:mid OR s:isd
   Example: "Foundations rare" → s:fdn r:rare
   Example: "white creature from Kamigawa" → c:white t:creature s:neo

BASIC SYNTAX:
- COLOR: c:red, c:blue, c:white, c:black, c:green
- TYPE: t:creature, t:instant, t:sorcery, t:artifact, t:enchantment
- MANA: mv=3, mv<=2, mv>=5
- STATS: pow>=5, tou<3
- RARITY: r:rare, r:mythic, r:uncommon, r:common

SET CODES (Recent & Popular):
- tla:Avatar: The Last Airbender, mar:Marvel Universe, om1:Through the Omenpaths, eoe:Edge of Eternities
- fin:Final Fantasy, tdm:Tarkir: Dragonstorm, dft:Aetherdrift, fdn:Foundations
- dsk:Duskmourn, blb:Bloomburrow, mh3:Modern Horizons 3, otj:Outlaws of Thunder Junction
- mkm:Murders at Karlov Manor, lci:Lost Caverns of Ixalan, woe:Wilds of Eldraine
- mat:March of the Machine Aftermath, mom:March of the Machine, one:Phyrexia All Will Be One
- bro:Brothers War, dmu:Dominaria United, snc:Streets of New Capenna, neo:Kamigawa Neon Dynasty
- vow:Crimson Vow, mid:Midnight Hunt, afr:Forgotten Realms, stx:Strixhaven
- khm:Kaldheim, znr:Zendikar Rising, m21:Core 2021, iko:Ikoria, thb:Theros Beyond Death
- eld:Eldraine, m20:Core 2020, war:War of the Spark, rna:Ravnica Allegiance
- grn:Guilds of Ravnica, dom:Dominaria, rix:Rivals of Ixalan, xln:Ixalan
- hou:Hour of Devastation, akh:Amonkhet, aer:Aether Revolt, kld:Kaladesh
- emn:Eldritch Moon, soi:Shadows over Innistrad

VALIDATION CHECKLIST (before responding):
1. Does output contain "gives" or "grants"?
2. If YES → REWRITE using "has" or "have"
3. If NO → proceed

OUTPUT: Return ONLY the Scryfall query, nothing else.`;

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

  console.log('🚀 API handler started');
  console.log('📁 Current working directory:', process.cwd());
  console.log('📦 Validators loaded:', typeof validateScryfallQuery === 'function');

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
      console.log('🔑 Checking GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'Present' : 'MISSING');
      
      if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY environment variable is not set');
      }
      
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      
      const fullPrompt = `${SYSTEM_PROMPT}\n\nUser request: ${prompt}`;
      
      console.log('📞 Calling Gemini API...');
      
      // Priority 1: Optimized configuration for determinism
      const result = await model.generateContent(fullPrompt, {
        generationConfig: {
          temperature: 0.0,      // Maximum determinism
          topP: 0.95,
          topK: 1,               // Force single best token
          maxOutputTokens: 500   // Keep responses concise
        }
      });
      console.log('✅ Gemini API call successful');
      
      const response = await result.response;
      console.log('✅ Got response from Gemini');
      
      // ⚠️ response.text() può essere chiamato solo UNA volta!
      let rawQuery;
      try {
        rawQuery = response.text();
        console.log('✅ Got text from response');
      } catch (textError) {
        console.error('❌ Error calling response.text():', textError);
        throw new Error(`Failed to extract text from Gemini response: ${textError.message}`);
      }
      
      console.log('📝 Raw Gemini response:', rawQuery);
      
      // Rimuovi markdown code blocks se presenti
      scryfallQuery = rawQuery.trim().replace(/^```[\w]*\n?/gm, '').replace(/```$/gm, '').trim();
      
      console.log('🔍 Cleaned query (before validation):', scryfallQuery);
      
      // Priority 1: Apply post-processing validation
      scryfallQuery = validateAndCorrect(scryfallQuery);
      
      console.log('✅ Query after validation:', scryfallQuery);
      
      // Extract set code from user query and append if not already present
      const extractedSetCode = extractSetCodeFromQuery(prompt);
      if (extractedSetCode && !scryfallQuery.includes(`s:${extractedSetCode}`)) {
        scryfallQuery = `${scryfallQuery} s:${extractedSetCode}`.trim();
        console.log(`✅ Added extracted set code: s:${extractedSetCode}`);
      }
      
      if (!scryfallQuery || scryfallQuery.length === 0) {
        throw new Error('Gemini returned an empty query');
      }
      
      // Valida la query generata
      try {
        validateScryfallQuery(scryfallQuery);
        console.log('✅ Query validation passed');
      } catch (validationError) {
        console.error('❌ Query validation failed:', validationError.message);
        
        // Log errore (solo in ambiente locale, su Vercel usiamo solo console.log)
        try {
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
        } catch (logError) {
          // Se fallisce il logging su file (es. su Vercel), continua comunque
          console.error('Failed to write error log to file:', logError.message);
        }
        
        throw validationError;
      }
      
      console.log('✅ Generated Scryfall query:', scryfallQuery);
    } catch (error) {
      console.error('❌ Error generating query:', error);
      console.error('❌ Error name:', error.name);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
      return res.status(500).json({ 
        error: 'Failed to generate Scryfall query',
        details: error.message || 'Unknown error',
        errorName: error.name,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
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
      console.log('🔍 Final query:', finalQuery);
      
      const scryfallResponse = await axios.get(scryfallUrl, {
        timeout: 10000
      });

      console.log('✅ Scryfall API call successful, status:', scryfallResponse.status);

      const scryfallData = scryfallResponse.data;
      console.log('📊 Scryfall response keys:', Object.keys(scryfallData));
      
      const cards = scryfallData.data || [];
      const totalCards = scryfallData.total_cards || 0;
      const hasMore = scryfallData.has_more || false;
      
      console.log('📦 Cards received:', cards.length, 'Total:', totalCards, 'Has more:', hasMore);

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
      // Gestisce sia 404 che 422 con code "not_found" (query senza risultati)
      if ((error.response?.status === 404 || error.response?.status === 422) && 
          error.response?.data?.code === 'not_found') {
        console.log('ℹ️ No cards found for query:', finalQuery);
        return res.json({
          scryfall_query: finalQuery,
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
      if ((error.response?.status === 404 || error.response?.status === 422) && page > 1) {
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
    console.error('❌ Unexpected error:', error);
    console.error('❌ Error stack:', error.stack);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message || 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};