/**
 * Scryfall Query Validator
 * 
 * Validates Scryfall queries to ensure they use correct operators.
 * See .cursorrules for complete syntax reference.
 */

const VALID_OPERATORS = [
  'o:', 'oracle:', 'fo:', 'fulloracle:',
  'keyword:', // For searching cards that HAVE keyword abilities
  't:', 'type:',
  'c:', 'color:',
  'mv:', 'cmc:',
  'pow:', 'power:', 'tou:', 'toughness:',
  's:', 'set:', 'e:', 'edition:',
  'r:', 'rarity:',
  'is:', 'has:',
  'usd:', 'eur:', 'tix:',
  'm:', 'mana:',
  'id:', 'identity:',
  'ft:', 'flavor:',
  'loy:', 'loyalty:',
];

const INVALID_OPERATORS = ['kv:', 'ability:', 'skill:'];

// Formati validi MTG
const VALID_FORMATS = [
  'standard',
  'pioneer',
  'modern',
  'legacy',
  'vintage',
  'commander',
  'edh',
  'pauper',
  'historic',
  'explorer',
  'alchemy',
  'brawl',
  'future',
  'oldschool',
  'premodern',
  'duel',
  'penny'
];

// Criteri di ordinamento validi
const VALID_ORDER_BY = [
  'name',
  'set',
  'released',
  'rarity',
  'color',
  'usd',
  'tix',
  'eur',
  'cmc',
  'power',
  'toughness',
  'edhrec',
  'penny',
  'artist',
  'review'
];

// Direzioni valide
const VALID_DIRECTIONS = ['auto', 'asc', 'desc'];

/**
 * Validates a Scryfall query and throws an error if invalid operators are found.
 * 
 * @param {string} query - The Scryfall query to validate
 * @throws {Error} If invalid operators are found in the query
 */
function validateScryfallQuery(query) {
  INVALID_OPERATORS.forEach(invalid => {
    if (query.includes(invalid)) {
      throw new Error(
        `Invalid operator '${invalid}' found in query. ` +
        `Did you mean 'o:' for searching card text? ` +
        `See .cursorrules for correct syntax.`
      );
    }
  });
}

/**
 * Common abilities mapping for reference.
 * Use keyword: for cards that HAVE the ability (possession).
 * Use o: for cards that MENTION the ability in text.
 */
const ABILITIES = {
  // For cards WITH abilities (possession)
  flying: 'keyword:flying',
  trample: 'keyword:trample',
  haste: 'keyword:haste',
  deathtouch: 'keyword:deathtouch',
  lifelink: 'keyword:lifelink',
  vigilance: 'keyword:vigilance',
  reach: 'keyword:reach',
  flash: 'keyword:flash',
  'first strike': 'keyword:"first strike"',
  'double strike': 'keyword:"double strike"',
  hexproof: 'keyword:hexproof',
  indestructible: 'keyword:indestructible',
  shroud: 'keyword:shroud',
  ward: 'keyword:ward',
};

/**
 * Valida i parametri di filtro e ordinamento
 * 
 * @param {string} format - Formato del gioco
 * @param {string} order - Campo per l'ordinamento
 * @param {string} direction - Direzione ordinamento (asc/desc/auto)
 * @returns {string|null} Error message se ci sono errori, null altrimenti
 */
function validateFilters(format, order, direction) {
  const errors = [];
  
  if (format && !VALID_FORMATS.includes(format.toLowerCase()) && format !== 'all') {
    errors.push(`Invalid format '${format}'. Valid formats: ${VALID_FORMATS.join(', ')}`);
  }
  
  if (order && !VALID_ORDER_BY.includes(order.toLowerCase()) && order !== 'auto') {
    errors.push(`Invalid order '${order}'. Valid orders: ${VALID_ORDER_BY.join(', ')}`);
  }
  
  if (direction && !VALID_DIRECTIONS.includes(direction.toLowerCase())) {
    errors.push(`Invalid direction '${direction}'. Valid directions: ${VALID_DIRECTIONS.join(', ')}`);
  }
  
  return errors.length > 0 ? errors.join('; ') : null;
}

module.exports = {
  validateScryfallQuery,
  validateFilters,
  VALID_OPERATORS,
  INVALID_OPERATORS,
  ABILITIES,
  VALID_FORMATS,
  VALID_ORDER_BY,
  VALID_DIRECTIONS,
};

