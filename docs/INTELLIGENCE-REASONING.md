# cocapn Architecture: The Repository as Intelligence Layer

## Core Philosophy
The repository isn't just source control—it's the agent's lived experience. We're building **embodied cognition for codebases**.

## Overall System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Coding Agent Ecosystem                   │
│  (Claude Code, Cursor, Devin, Copilot, etc.)               │
└─────────────────────────────┬───────────────────────────────┘
                              │ Query API
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     COCAPN Repo-Agent                        │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐    │
│  │ Perception  │  │ Memory      │  │ Reasoning        │    │
│  │ Layer       │  │ Systems     │  │ Engine           │    │
│  │ - File watcher│ │ - LTM/STM   │  │ - LLM orchestration│  │
│  │ - Git hooks │  │ - Vector DB │  │ - RAG pipelines  │    │
│  └─────────────┘  └─────────────┘  └──────────────────┘    │
│              │              │              │                │
│      ┌───────▼──────────────▼──────────────▼──────┐         │
│      │          Knowledge Graph                    │         │
│      │  (Code + Docs + History + Lore + Research) │         │
│      └─────────────────────┬──────────────────────┘         │
└────────────────────────────┼────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                      Git Repository                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  • Source Code                                       │  │
│  │  • CLAUDE.md (generated)                            │  │
│  │  • .cocapn/ (knowledge artifacts)                   │  │
│  │  • wiki/ (auto-generated)                           │  │
│  │  • research/ (deep dives)                           │  │
│  │  • lore/ (game-specific)                            │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 1. Auto-Generated CLAUDE.md

### Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    Understanding Pipeline                    │
│                                                              │
│  ┌────────────┐   ┌────────────┐   ┌──────────────────┐    │
│  │ Extraction │ → │ Synthesis  │ → │ Generation       │    │
│  │ Phase      │   │ Phase      │   │ Phase            │    │
│  └────────────┘   └────────────┘   └──────────────────┘    │
│        │                  │                    │            │
│   Code/Commits     Architectural     Context-Aware          │
│   PRs/Issues      Reasoning          Documentation          │
│   Team Chat       Design Patterns    Generation             │
└─────────────────────────────────────────────────────────────┘
```

### Data Structures
```typescript
interface ProjectUnderstanding {
  // The WHY layer
  purpose: {
    businessGoals: string[];
    userProblems: string[];
    valuePropositions: string[];
  };
  
  // The HOW layer
  architecture: {
    decisions: Array<{
      id: string;
      decision: string;
      rationale: string;
      alternatives: string[];
      consequences: string[];
      timestamp: Date;
      author?: string;
    }>;
    patterns: Array<{
      pattern: string;
      implementation: string;
      whyEffective: string;
      whereUsed: string[];
    }>;
  };
  
  // The WHAT layer
  currentState: {
    healthMetrics: {
      testCoverage: number;
      dependencyHealth: number;
      complexityScore: number;
    };
    hotSpots: Array<{
      file: string;
      reason: string;
      attentionNeeded: boolean;
    }>;
  };
}

interface CLAUDEmdConfig {
  updateTriggers: {
    onMajorCommit: boolean;
    onArchitectureChange: boolean;
    weekly: boolean;
  };
  sections: {
    includePurpose: boolean;
    includeArchitecture: boolean;
    includeDevelopmentGuide: boolean;
    includeTroubleshooting: boolean;
  };
}
```

### Algorithm
1. **Extract Understanding**
   - Use LLM to analyze commit messages with `git log --pretty=format:"%H|%an|%ad|%s|%b" --date=iso`
   - Parse PR descriptions and code reviews for decision context
   - Analyze issue history for problem evolution

2. **Synthesize WHY**
   - Cluster related changes into "decision epochs"
   - Trace architectural evolution: `git log --all --graph --oneline --decorate`
   - Identify pivot points and their drivers

3. **Generate CLAUDE.md**
   - Template-based generation with LLM filling
   - Include "The Story So Far" section
   - Add "Common Pitfalls & Solutions"
   - Generate "If You're New Here" onboarding guide

### Integration
- Store understanding in `.cocapn/understanding.json`
- Generate CLAUDE.md on post-commit hooks
- Version understanding alongside code

### Implementation Plan
```typescript
// Week 1: Extraction pipeline
class UnderstandingExtractor {
  async extractFromGitHistory(): Promise<GitHistoryAnalysis> { /* ... */ }
  async analyzeCodebaseStructure(): Promise<ArchitectureAnalysis> { /* ... */ }
}

// Week 2: Synthesis engine
class UnderstandingSynthesizer {
  async identifyDecisionPatterns(): Promise<DecisionClusters> { /* ... */ }
  async inferProjectPurpose(): Promise<ProjectPurpose> { /* ... */ }
}

// Week 3: Generation system
class CLAUDEGenerator {
  async generateMarkdown(understanding: ProjectUnderstanding): Promise<string> { /* ... */ }
  async updateOnChange(diff: GitDiff): Promise<void> { /* ... */ }
}
```

### Failure Modes
- **Historical Misinterpretation**: LLM misreads commit context
  - Mitigation: Human-in-the-loop validation for key decisions
- **Information Overload**: Too detailed, loses narrative
  - Mitigation: Progressive disclosure, TL;DR sections
- **Staleness**: Fails to update for subtle changes
  - Mitigation: Change detection with semantic diffing

## 2. Internal Wikipedia

### Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    Knowledge Graph Builder                  │
│                                                              │
│  ┌─────────────┐    ┌────────────┐    ┌────────────┐       │
│  │ Extractors  │ →  │ Linker     │ →  │ Curator    │       │
│  │ • Code      │    │ • Entity   │    │ • Quality  │       │
│  │ • Comments  │    │ • Temporal │    │ • Relevance│       │
│  │ • Commits   │    │ • Semantic │    │ • Priority │       │
│  └─────────────┘    └────────────┘    └────────────┘       │
│         │                │                     │            │
│    Raw Facts        Knowledge Graph      Developer           │
│                                           Feedback           │
└─────────────────────────────────────────────────────────────┘
```

### Data Structures
```typescript
interface WikiNode {
  id: string;
  type: 'concept' | 'file' | 'function' | 'decision' | 'person' | 'technology';
  title: string;
  content: string;
  embeddings: number[]; // For semantic search
  metadata: {
    source: string; // e.g., "src/auth.ts:42", "commit:abc123"
    confidence: number;
    lastUpdated: Date;
    freshness: number; // Based on recency and activity
  };
  relationships: Array<{
    targetId: string;
    type: 'references' | 'dependsOn' | 'alternativeTo' | 'evolvedFrom';
    strength: number;
  }>;
}

interface KnowledgeGraph {
  nodes: Map<string, WikiNode>;
  indices: {
    semantic: VectorIndex;
    temporal: TimelineIndex;
    hierarchical: TreeIndex;
  };
}
```

### Algorithm: Noise-Reduced Growth
1. **Extract with Confidence Scoring**
   ```python
   # Pseudo-algorithm
   for file in codebase:
       for comment in extract_comments(file):
           confidence = calculate_confidence(comment)
           if confidence > THRESHOLD:
               create_wiki_node(comment)
       
       for function in extract_functions(file):
           node = create_function_node(function)
           node.relationships = find_caller_callee(function)
   ```

2. **Link with Context**
   - Temporal links from commit history
   - Semantic links from code structure
   - Cross-reference links from imports/exports

3. **Prune with Relevance**
   - Decay factor: `relevance = freshness * activity * developer_interest`
   - Archive low-relevance nodes to `.cocapn/wiki/archive/`

### Integration
- Store in `.cocapn/wiki/` as structured JSON
- Use SQLite + vector extension for search
- Web interface via local server

### Implementation Plan
1. **Phase 1 (2 weeks)**: Basic extractors for comments and docstrings
2. **Phase 2 (2 weeks)**: Linker with entity recognition
3. **Phase 3 (1 week)**: Search interface (keyword + semantic)
4. **Phase 4 (1 week)**: Curator UI with voting/flagging

### Failure Modes
- **Link Sprawl**: Everything links to everything
  - Mitigation: Relationship strength thresholding
- **Stale Knowledge**: Outdated information persists
  - Mitigation: Temporal decay + change detection
- **Over-Curation**: Developer becomes bottleneck
  - Mitigation: Automated quality scoring + batch review

## 3. AutoResearch (Karpathy-style)

### Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    Parallel Research Engine                  │
│                                                              │
│  ┌────────────┐   ┌─────────────┐   ┌────────────────┐     │
│  │ Topic      │ → │ Research    │ → │ Synthesis      │     │
│  │ Discovery  │   │ Agents      │   │ & Evaluation   │     │
│  └────────────┘   └─────────────┘   └────────────────┘     │
│        │                │  │  │              │              │
│    Code Analysis   Agent1 Agent2 ...  Human + AI            │
│    Tech Radar           └─┴─┘          Review               │
│    Dependencies                                         │
└─────────────────────────────────────────────────────────────┘
```

### Data Structures
```typescript
interface ResearchTopic {
  id: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  sources: {
    internal: string[]; // Code patterns, tech debt, etc.
    external: string[]; // Industry trends, library updates
  };
  status: 'pending' | 'researching' | 'synthesizing' | 'review' | 'archived';
}

interface ResearchDocument {
  id: string;
  topicId: string;
  versions: Array<{
    content: string;
    researcher: string; // Agent ID or 'human'
    timestamp: Date;
    citations: Array<{ source: string; relevance: number }>;
  }>;
  evaluations: Array<{
    evaluator: string; // Developer email
    score: number; // 1-5
    feedback: string;
    actionable: boolean;
  }>;
  metadata: {
    tokensUsed: number;
    cost: number;
    researchDepth: 'shallow' | 'medium' | 'deep';
  };
}
```

### Algorithm: Practical Research Pipeline
1. **Topic Discovery**
   ```typescript
   // Detect research needs from:
   // 1. Outdated dependencies (package.json)
   // 2. Complex code that could be simplified
   // 3. Emerging patterns in commit history
   // 4. Developer queries about alternatives
   ```

2. **Parallel Research**
   - Agent 1: Deep dive on primary approach
   - Agent 2: Explore alternative solutions
   - Agent 3: Cost/benefit analysis
   - All share partial findings via shared memory

3. **Human Steering**
   - Voting interface in CLI/IDE
   - "Research further" / "Good enough" / "Wrong direction" buttons
   - Feedback loop trains research quality

### Integration
- Store in `.cocapn/research/`
- Integrate with package.json for dependency research
- Hook into IDE for "research this pattern" context menu

### Implementation Plan
1. **Week 1-2**: Topic discovery from codebase analysis
2. **Week 3**: Multi-agent research orchestration
3. **Week 4**: Human feedback interface
4. **Week 5**: Cost optimization (caching, model selection)

### Failure Modes
- **Cost Explosion**: Unlimited research burns budget
  - Mitigation: Token budgets per topic, approval thresholds
- **Relevance Drift**: Research goes off-topic
  - Mitigation: Continuous alignment checks, human redirection
- **Analysis Paralysis**: Too much research, no decisions
  - Mitigation: Executive summaries, decision frameworks

## 4. Repo as Teacher for Coding Agents

### Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    Teaching Interface                        │
│                                                              │
│       Coding Agent Query                                    │
│             │                                                │
│  ┌──────────▼──────────┐                                    │
│  │   Question Analyzer  │                                    │
│  │  • Intent Detection  │                                    │
│  │  • Context Inference │                                    │
│  └──────────┬──────────┘                                    │
│             │                                                │
│  ┌──────────▼──────────┐      ┌─────────────────────┐       │
│  │  Answer Orchestrator ├─────▶ Knowledge Sources   │       │
│  │  • Multi-hop RAG     │      │ • Code             │       │
│  │  • Reasoning Chain   │      │ • History          │       │
│  └──────────┬──────────┘      │ • Decisions        │       │
│             │                  │ • Trade-offs       │       │
│  ┌──────────▼──────────┐      └─────────────────────┘       │
│  │  Response Formatter  │                                    │
│  │  • Pedagogical Style │                                    │
│  │  • Detail Level      │                                    │
│  └──────────────────────┘                                    │
└─────────────────────────────────────────────────────────────┘
```

### Data Structures
```typescript
interface TeachingContext {
  query: string;
  inferredIntent: 'understand' | 'debug' | 'modify' | 'learn';
  coderContext: {
    experienceLevel: 'beginner' | 'intermediate' | 'expert';
    currentFile?: string;
    recentChanges?: string[];
  };
  pedagogicalStyle: {
    detailLevel: 'overview' | 'detailed' | 'exhaustive';
    includeExamples: boolean;
    includeWarnings: boolean;
    includeAlternatives: boolean;
  };
}

interface TeachingResponse {
  directAnswer: string;
  contextLayers: Array<{
    title: string;
    content: string;
    relevance: number;
  }>;
  references: Array<{
    type: 'code' | 'commit' | 'documentation';
    location: string;
    excerpt: string;
  }>;
  furtherQuestions: string[]; // Anticipated follow-ups
  confidence: number;
}
```

### Algorithm: Inference-Based Teaching
1. **Intent Detection**
   ```typescript
   // Classify question type
   const intents = {
     'why-is-auth-handled-this-way': 'architectural-rationale',
     'how-does-this-function-work': 'implementation-detail',
     'what-should-i-change': 'modification-guidance'
   };
   ```

2. **Multi-Hop Retrieval**
   - First hop: Find relevant code
   - Second hop: Find historical context (commits, PRs)
   - Third hop: Find related design decisions
   - Fourth hop: Find similar patterns elsewhere

3. **Answer Generation**
   - Start with direct answer
   - Add rationale layer
   - Add trade-off analysis
   - Add "what if" scenarios
   - End with actionable guidance

### What Makes a Good Answer?
1. **Completeness**: Answers the literal question AND the implied need
2. **Contextual**: References specific code and history
3. **Actionable**: Provides clear next steps
4. **Pedagogical**: Teaches patterns, not just facts
5. **Honest**: Acknowledges uncertainty when present

### Integration
- REST API for coding agents
- Streaming responses for interactive teaching
- Cache frequent questions in `.cocapn/teaching_cache/`

### Implementation Plan
1. **Week 1-2**: Intent classifier and context analyzer
2. **Week 3-4**: Multi-hop RAG implementation
3. **Week 5**: Response quality optimization
4. **Week 6**: Integration with major coding agents

### Failure Modes
- **Over-Inference**: Assumes wrong intent
  - Mitigation: Confidence scoring + clarification questions
- **Context Leakage**: Includes irrelevant details
  - Mitigation: Relevance scoring + progressive disclosure
- **Hallucinated History**: Makes up git history
  - Mitigation: Source attribution + verification

## 5. Silmarillion Pattern (Game Dev Plugin)

### Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    Lore Generation Engine                   │
│                                                              │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐       │
│  │ World       │ → │ Lore        │ → │ Consistency │       │
│  │ Analyzer    │   │ Generator   │   │ Enforcer    │       │
│  └─────────────┘   └─────────────┘   └─────────────┘       │
│        │                │                    │              │
│    Game Code       Multi-Agent          Canon Checker       │
│    Assets          Creation                                 │
│    Design Docs                                         │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                 Living Encyclopedia                   │  │
│  │  • Characters  • Locations  • History  • Cultures    │  │
│  └──────────────────────────────────────────────────────┘  │
│                    │                    │                   │
│              Developer            Game