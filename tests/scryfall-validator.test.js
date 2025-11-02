const { validateScryfallQuery, ABILITIES } = require('../src/scryfall/validators');

console.log('🧪 Running Scryfall Validator Tests...\n');

// Test cases: query e se dovrebbe passare o fallire
const TEST_CASES = [
  // ✅ Query CORRETTE (dovrebbero passare)
  { query: 'mv=1 t:creature o:flying', shouldPass: true, description: 'Basic creature with ability' },
  { query: 'c:red t:dragon mv<5', shouldPass: true, description: 'Color, type, and mana filter' },
  { query: 't:instant o:"draw a card"', shouldPass: true, description: 'Text search with quotes' },
  { query: 'c:white t:creature o:lifelink o:vigilance', shouldPass: true, description: 'Multiple abilities' },
  { query: 't:legendary (t:goblin or t:elf)', shouldPass: true, description: 'OR logic with parentheses' },
  { query: 'pow>tou t:creature', shouldPass: true, description: 'Power/toughness comparison' },
  { query: 'is:reserved usd>50', shouldPass: true, description: 'Reserved list with price' },
  { query: 't:planeswalker loy=3', shouldPass: true, description: 'Planeswalker loyalty' },
  { query: 'o:":" t:artifact', shouldPass: true, description: 'Activated abilities search' },
  { query: 'id:wubrg mv<=4', shouldPass: true, description: 'Color identity' },

  // ❌ Query SBAGLIATE (dovrebbero fallire)
  { query: 'kv:flying', shouldPass: false, description: 'Invalid operator: kv:' },
  { query: 'keyword:trample', shouldPass: false, description: 'Invalid operator: keyword:' },
  { query: 'ability:haste', shouldPass: false, description: 'Invalid operator: ability:' },
  { query: 'skill:deathtouch', shouldPass: false, description: 'Invalid operator: skill:' },
  { query: 't:creature kv:flying', shouldPass: false, description: 'Mixed valid and invalid operators' },
];

let passed = 0;
let failed = 0;

// Esegui tutti i test
TEST_CASES.forEach(({ query, shouldPass, description }, index) => {
  try {
    validateScryfallQuery(query);
    
    // Se arriviamo qui, la validazione è passata
    if (shouldPass) {
      console.log(`✅ Test ${index + 1}: PASS - ${description}`);
      console.log(`   Query: "${query}"\n`);
      passed++;
    } else {
      console.log(`❌ Test ${index + 1}: FAIL - ${description}`);
      console.log(`   Query: "${query}"`);
      console.log(`   Expected: validation error, Got: passed validation\n`);
      failed++;
    }
  } catch (error) {
    // Se arriviamo qui, la validazione è fallita
    if (!shouldPass) {
      console.log(`✅ Test ${index + 1}: PASS - ${description}`);
      console.log(`   Query: "${query}"`);
      console.log(`   Error caught: ${error.message}\n`);
      passed++;
    } else {
      console.log(`❌ Test ${index + 1}: FAIL - ${description}`);
      console.log(`   Query: "${query}"`);
      console.log(`   Expected: pass validation, Got: ${error.message}\n`);
      failed++;
    }
  }
});

// Risultato finale
console.log('═'.repeat(60));
console.log(`\n📊 Test Results:`);
console.log(`   ✅ Passed: ${passed}/${TEST_CASES.length}`);
console.log(`   ❌ Failed: ${failed}/${TEST_CASES.length}`);
console.log(`   📈 Success Rate: ${((passed / TEST_CASES.length) * 100).toFixed(1)}%\n`);

// Exit code: 0 se tutti passano, 1 se almeno uno fallisce
process.exit(failed > 0 ? 1 : 0);


