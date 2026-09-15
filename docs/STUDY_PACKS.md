# SÓCRATES DS — Persistent Study Packs

## Why this exists

A reading should not disappear after one session. SÓCRATES turns each Reading Mission into a persistent source-grounded study object that can be reopened, regenerated and used for retrieval practice.

## Pack contract

Each pack contains:

1. **Orientation letter** — why the reading matters and how to approach it.
2. **One-page summary** — thesis, key ideas, misconception and self-test.
3. **Concept cards** — term, intuition, formal relation, misconception and locator.
4. **Infographic specification** — nodes, edges and visual narrative.
5. **Practice** — recall, derivation/reasoning and transfer.
6. **Checklist** — evidence-oriented study checks.

The operational Reading Room checklist remains separate: only that checklist records evidence and triggers spaced reviews.

## Grounding

```text
selected reading unit
      ↓
source chunk retrieval
      ↓
bounded evidence + locators
      ↓
AI Study Pack
      ↓
persist per learner
      ↓
reopen / regenerate
```

Rules:

- source-specific claims must come from retrieved source chunks;
- long source passages are not reproduced;
- evidence locators are stored with the pack;
- generation does not change mastery;
- if AI generation fails, SÓCRATES persists an evidence-only fallback pack rather than hallucinating;
- versions are append-only at product level: regeneration creates a new version instead of overwriting previous learning material.

## Private readings

V0.9 inherits the V0.8 private-ingestion contract. A learner can upload a text-based PDF, bind it to a course, and receive a page-aware Reading Mission. The same private source can then generate a Study Pack without becoming visible to another user.

## Runtime

Production AI uses the same Vercel AI Gateway path as Reading Coach when available. The deterministic fallback keeps the reading workflow useful even without model availability.
