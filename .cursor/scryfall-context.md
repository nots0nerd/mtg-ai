# Scryfall API Context

This project uses Scryfall API for Magic: The Gathering card searches.

## Quick Reference

When converting natural language to Scryfall queries:

- Abilities → use `o:` (oracle text)
- Types → use `t:`
- Mana cost → use `mv:` or `cmc:`
- Colors → use `c:` (w/u/b/r/g)

## Validation

Always validate queries against `.cursorrules` before execution.

## Common Abilities Mapping

When users mention abilities, convert to `o:` operator:

- "flying" → `o:flying`
- "trample" → `o:trample`
- "haste" → `o:haste`
- "first strike" → `o:"first strike"`
- "deathtouch" → `o:deathtouch`
- "lifelink" → `o:lifelink`
- "vigilance" → `o:vigilance`
- "reach" → `o:reach`
- "flash" → `o:flash`

## Example Conversions

1. User: "creatures with flying"
   Query: `t:creature o:flying`

2. User: "cheap blue cards"
   Query: `c:u mv<3`

3. User: "red dragon under 5 mana"
   Query: `c:red t:dragon mv<5`

4. User: "instant that draws cards"
   Query: `t:instant o:"draw"`


