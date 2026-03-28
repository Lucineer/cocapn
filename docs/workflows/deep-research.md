# Workflow: Deep Research

> Use the auto-researcher agent to populate your wiki overnight while you sleep.

This workflow queues a research task before you go to bed and wakes up to a fully populated wiki section — with sources, summaries, and cross-links to existing notes.

## What it does

1. Accept a research topic from the user
2. Use Perplexity (via the `perplexity-search` module) to gather recent sources
3. Synthesize findings into structured Markdown
4. Write to `wiki/research/<topic>/` with an index, source notes, and a summary
5. Cross-link to related existing wiki pages
6. Commit everything to Git so it's versioned and backed up

## Prerequisites

- `perplexity-search` module installed: `cocapn-bridge module add https://github.com/cocapn/perplexity-search`
- `PERPLEXITY_API_KEY` secret set: `cocapn-bridge secret add PERPLEXITY_API_KEY`
- A `researcher` agent definition (or use the default agent with the Perplexity MCP server)

## The researcher agent

```yaml
# cocapn/agents/researcher.agent.yml
id: researcher
name: Deep Researcher
type: local
command: claude
mcp:
  servers:
    - name: perplexity
      command: node
      args: ["modules/perplexity-search/server.js"]
env:
  PERPLEXITY_API_KEY: "secret:PERPLEXITY_API_KEY"
soulAppend: |
  You are a research specialist. When asked to research a topic:

  1. Search Perplexity for 5-10 authoritative sources using the search tool
  2. Read each source carefully
  3. Create a directory: wiki/research/<topic-slug>/
  4. Write these files:
     - index.md: Executive summary (300-500 words), key findings, open questions
     - sources.md: Annotated bibliography with one paragraph per source
     - notes/<source-slug>.md: Detailed notes for each important source
  5. Cross-link to existing wiki pages where relevant (use [[wiki/page]] syntax)
  6. Do not hallucinate — if you're uncertain, say so and mark it as "needs verification"
  7. End with a "Next steps" section: what to read next, what experiments to run
```

## Triggering the research

### Manual trigger (before bed)

```
[Chat to researcher agent]
Research "mechanistic interpretability in large language models" and
populate my wiki. Focus on:
- What we know about circuits and features
- Recent work from Anthropic and DeepMind
- Practical implications for alignment
Take as long as you need — I'm going to sleep.
```

The bridge keeps the agent running in the background. When it finishes, the results are auto-committed to your private repo.

### Queuing multiple topics

```
Please queue these research tasks for tonight:
1. "CRISPR base editing off-target effects" — for wiki/biology/
2. "Rust async runtime internals" — for wiki/engineering/
3. "Sleep debt and cognitive performance" — for wiki/health/

Run them sequentially so I don't hit API rate limits.
```

## What gets written

After researching "mechanistic interpretability":

```
wiki/
└── research/
    └── mechanistic-interpretability/
        ├── index.md                    ← Executive summary
        ├── sources.md                  ← Annotated bibliography
        └── notes/
            ├── anthropic-features-circuits.md
            ├── superposition-hypothesis.md
            ├── sae-sparse-autoencoders.md
            └── deepmind-activation-patching.md
```

### Example index.md

```markdown
# Mechanistic Interpretability — Research Summary

*Researched: 2025-01-15 | Sources: 8 | Confidence: High*

## Executive Summary

Mechanistic interpretability is the study of understanding neural networks by
reverse-engineering their internal computations into human-understandable algorithms...

## Key Findings

1. **Superposition**: Models represent more features than they have dimensions by
   overlapping representations. Features compete for neurons.
2. **Circuits**: Small subgraphs of neurons implement specific algorithms
   (e.g., "induction heads" implement in-context learning).
3. **SAEs**: Sparse autoencoders can decompose MLP activations into interpretable features.

## Open Questions

- Do circuits generalize across model sizes?
- Can we use interpretability to detect deceptive alignment?

## Related Wiki Pages

- [[wiki/alignment/overview]] — broader context
- [[wiki/engineering/transformers]] — architecture background

## Next Steps

1. Read the Anthropic "Scaling Monosemanticity" paper in full
2. Experiment: run an SAE on a small local model
3. Follow up: activation patching tutorial from TransformerLens

*Sources: 8 | Last updated: 2025-01-15 | See [sources.md](sources.md)*
```

## Reviewing the research

The next morning:

```
[Chat]
What did you find out about mechanistic interpretability?
Give me a 2-minute briefing, then we can dig in.
```

The agent reads from `wiki/research/mechanistic-interpretability/index.md` and summarizes.

## Rate limiting and cost

The Perplexity Sonar API charges per request. To avoid surprise bills:

- The `perplexity-search` module caps searches per session (default: 20)
- Set a budget in `cocapn/modules.json` or the module's config
- Use `PERPLEXITY_MAX_SEARCHES=10` env var to limit per-run

For academic research, consider the `zotero-bridge` module which pulls from your existing Zotero library for free before falling back to Perplexity.

## Offline-capable variant

If you don't have a Perplexity key, the researcher can work with locally available sources:

```
Research "CRISPR base editing" using only:
- Files already in wiki/biology/
- PDFs in ~/Documents/papers/ (read them with the file tool)
- No external searches
```

This produces a synthesis of your existing notes rather than new research — useful for exam prep or project briefs.
