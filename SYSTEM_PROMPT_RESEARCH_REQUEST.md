# MTG AI Search - System Prompt Challenge

## Project Description

**MTG AI Search** is a web application that allows Magic: The Gathering players to search for cards using natural language queries. The app converts casual, human language into precise Scryfall API syntax.

### Architecture
- **Frontend**: React (Vite) - User interface with search, filters, and pagination
- **Backend**: Node.js serverless function (Vercel)
- **AI Layer**: Google Gemini API for natural language → Scryfall query conversion
- **Data Source**: Scryfall API (comprehensive MTG card database)

### Example User Flow
1. User types: *"red two mana creature that gives trample"*
2. Gemini converts to: `c:red mv=2 t:creature o:"has trample"`
3. Scryfall returns matching cards
4. Frontend displays results with pagination

### Key Technical Challenge
The core problem is **semantic translation** between natural language and Magic's actual Oracle text syntax. Users speak in everyday terms, but Magic cards use specific templated language.

---

## The Struggle: The "Gives vs. Has" Problem

### Core Issue
When users search for cards that **grant abilities to other creatures**, they naturally say:
- *"creature that gives haste"*
- *"enchantment that grants flying"*
- *"artifact that gives trample"*

However, **Magic cards almost NEVER use the word "gives" or "grants"** in their Oracle text. Instead, they say:
- *"Creatures you control **have** haste"*
- *"Enchanted creature **has** flying"*
- *"Artifacts you control **have** trample"*

### The Translation Gap

| User Says | Naïve Translation (❌ WRONG) | Correct Translation (✅ RIGHT) |
|-----------|------------------------------|--------------------------------|
| "gives haste" | `o:"gives haste"` | `o:"has haste"` or `o:"have haste"` |
| "grants flying" | `o:"grants flying"` | `o:"has flying"` |
| "gives trample" | `o:"gives trample"` | `o:"has trample"` |

**Why the naïve approach fails:**
- Searching for `o:"gives haste"` returns ~0-2 cards
- Searching for `o:"has haste"` returns hundreds of relevant cards
- Users expect the latter, but Gemini naturally translates to the former

### What We've Tried (Chronologically)

#### Attempt 1: Verbose Instructions (500+ words)
```
SYSTEM_PROMPT (long version):
- Detailed explanations of Scryfall syntax
- Multiple operator examples (o:, keyword:, t:, c:, mv:)
- Explanations about Oracle text vs. abilities
- Examples of correct queries
```
**Result**: Gemini often ignored long instructions, still made literal translations

#### Attempt 2: Structured Decision Tree
```
SYSTEM_PROMPT (decision tree version):
- "IF user says 'with [ability]' THEN use keyword:"
- "IF user says 'gives [ability]' THEN use o:"
- Step-by-step logic flow
```
**Result**: Improved, but Gemini still used `o:"gives haste"` instead of `o:"has haste"`

#### Attempt 3: Explicit Negative Examples
```
SYSTEM_PROMPT (negative examples version):
❌ WRONG EXAMPLES (NEVER DO THIS):
- o:"gives haste" ❌ WRONG!
- o:"grants flying" ❌ WRONG!

✅ CORRECT:
- "gives haste" → o:"has haste"
```
**Result**: Better, but still inconsistent under edge cases

#### Attempt 4: Ultra-Simplified with Warnings (Current)
```
SYSTEM_PROMPT (ultra-simple v4.0):
🚨 CRITICAL RULE #1: NEVER USE "gives" or "grants" IN QUERIES!

When user says "gives/grants [ability]", Magic cards actually say "has/have [ability]".

[Prominent negative examples at the top]
[Decision tree]
[More examples with the problematic query as a direct example]
```
**Result**: Significantly improved, but we just deployed this and need to validate across more queries

### Why This Is Hard

1. **Semantic Gap**: The user's mental model ("gives") doesn't match Magic's templating ("has")
2. **Domain Knowledge**: Requires understanding MTG card design patterns
3. **Context Sensitivity**: Sometimes "gives" IS correct (e.g., flavor text, or very old cards)
4. **Literal Translation Bias**: LLMs naturally want to preserve the user's exact words
5. **Competing Patterns**: Need to distinguish:
   - Cards WITH ability: `keyword:haste` (the card itself has haste)
   - Cards that GRANT ability: `o:"have haste"` (gives haste to others)

### Current Status
We've iterated through 4+ versions of the SYSTEM_PROMPT. Each iteration improved results, but we're still not at 100% accuracy. We need a deeper understanding of:
- How to effectively override literal translation instincts in LLMs
- Best practices for domain-specific translation prompting
- Whether pre-processing, post-processing, or few-shot examples would help
- If there are better AI architectures for this problem (fine-tuning, RAG, etc.)

---

## Research Request for AI

### Objective
We need comprehensive research and actionable recommendations to solve a persistent prompt engineering challenge in our MTG card search application.

### Research Questions

#### 1. Core Prompt Engineering
**Question**: What are the most effective techniques to make LLMs translate natural language into domain-specific query syntax where the user's vocabulary doesn't match the target system's vocabulary?

**Specific to our case**:
- User says "gives haste" but system requires "has haste"
- How do we teach this semantic mapping reliably?
- Should negative examples come before or after positive ones?
- What's the optimal prompt length for GPT/Gemini models?
- Does repeating critical rules multiple times help or harm?

#### 2. LLM Behavioral Analysis
**Question**: Why do LLMs have a "literal translation bias"? What cognitive/architectural reasons cause them to preserve the user's exact words even when instructed otherwise?

**Please investigate**:
- Research papers on LLM translation behavior
- Studies on instruction-following vs. pattern-matching
- Known biases in Gemini specifically (vs GPT-4, Claude, etc.)
- Whether this is a training data issue or an inherent limitation

#### 3. Alternative Architectures
**Question**: Are there better approaches than a single SYSTEM_PROMPT for this task?

**Please explore**:
- **Few-shot learning**: Should we provide 20+ examples inline with each request?
- **Fine-tuning**: Would fine-tuning Gemini/GPT on MTG query pairs solve this?
- **RAG (Retrieval-Augmented Generation)**: Could we retrieve similar queries from a database?
- **Multi-step reasoning**: Should we use chain-of-thought or ask the model to explain its translation?
- **Validation layer**: Should we add a second AI call to validate/correct the first?
- **Hybrid approach**: Use AI for parsing intent, then rule-based logic for translation?

#### 4. Domain-Specific Solutions
**Question**: How have other projects solved similar problems?

**Please find case studies of**:
- SQL query generation from natural language (similar problem space)
- Legal/medical terminology translation (semantic gaps)
- API query builders with LLMs
- Magic: The Gathering or other game search engines (if any exist)
- Academic papers on domain-specific LLM prompting

#### 5. Gemini-Specific Optimizations
**Question**: Are there Gemini API features or techniques we're not using?

**Please investigate**:
- Gemini's "grounding" feature (if applicable)
- Temperature/top_p settings for deterministic translation
- System instructions vs. user message placement
- Gemini Pro vs. Flash for this task
- Any Gemini-specific prompt engineering guidelines from Google

#### 6. Testing & Validation
**Question**: How should we systematically test and improve our prompts?

**Please recommend**:
- How to build a test suite of challenging queries
- Metrics to track (accuracy, consistency, edge case handling)
- A/B testing approaches for prompts
- Tools for prompt versioning and regression testing

### Deliverables Requested

1. **Executive Summary** (1 page)
   - Top 3 recommendations we should implement immediately
   - Likelihood each will solve our problem

2. **Deep Dive Report** (5-10 pages)
   - Answers to all 6 research questions above
   - Cited sources (papers, blog posts, documentation)
   - Specific code examples or prompt templates when relevant

3. **Action Plan** (1-2 pages)
   - Prioritized list of experiments to run
   - Estimated effort and impact for each
   - What to try first, second, third

4. **Appendix: Alternative Prompts** (optional)
   - 3-5 completely different SYSTEM_PROMPT approaches to test
   - Based on your research findings

### Context for Your Research

**Current SYSTEM_PROMPT** (latest version, just deployed):
```
You convert Magic card searches to Scryfall syntax.

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

[... decision tree and more examples ...]
```

**Test Query That We're Using**:
- User: *"red two mana creature that gives trample"*
- Expected: `c:red mv=2 t:creature o:"has trample"`
- Previous bad output: `c:red mv=2 t:creature o:"gives trample"`

**Success Criteria**:
- 95%+ accuracy on a test set of 100 diverse queries
- Correct handling of "gives/grants" phrases
- Correct distinction between "with [ability]" (keyword:) and "gives [ability]" (o:)

### Why This Matters

This problem is a microcosm of a larger challenge in AI: **bridging the gap between how humans naturally speak and how systems are actually structured**. Solving this for MTG cards could inform:
- SQL query builders
- API search interfaces
- Medical/legal terminology translation
- Any domain where jargon doesn't match common language

We've spent significant time iterating, and while we're getting better results, we need your research expertise to find the optimal solution.

---

## How to Use This Document

If you're the AI conducting this research:
1. Read the entire document carefully
2. Focus on the 6 research questions
3. Prioritize actionable, implementable solutions
4. Cite sources and provide code examples
5. Think creatively - we may have overlooked obvious solutions

If you're a human reading this:
- This is a real, deployed application: https://mtg-ai-search.vercel.app
- The codebase is in `/Users/valerio/Desktop/MTG`
- We're using Google Gemini API (`AIzaSyAzLyw9HjRko1z0cFO78l53_FeUAQnQ4vU`)
- We're open to major architectural changes if they solve the problem

---

## Contact & Next Steps

After receiving your research report, we will:
1. Review findings with the development team
2. Implement top 3 recommendations
3. Run A/B tests with real users
4. Report back on results

Thank you for helping us solve this challenging prompt engineering problem!

---

*Document created: 2025-11-04*  
*Project: MTG AI Search*  
*AI: Claude Sonnet 4.5*  
*Status: Active Development - System Prompt Optimization Phase*

