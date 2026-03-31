import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface ConceptMeta {
  slug: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  icon: string;
  novelty: string;
  researchAreas: string[];
}

export interface ConceptWiki {
  filename: string;
  title: string;
}

export interface Concept extends ConceptMeta {
  soul: string;
  concept: string;
  config: string;
  theme: string;
  implementationNotes: string;
  experiments: string;
  wiki: ConceptWiki[];
}

const CONCEPT_META: ConceptMeta[] = [
  {
    slug: 'adversarial-reviewer',
    name: 'Adversarial Reviewer',
    description: 'Red team agent that argues against its own suggestions using constitutional AI and self-play debate before presenting the stronger case',
    category: 'reasoning',
    tags: ['constitutional-ai', 'self-play', 'debate', 'red-team', 'bias-detection', 'alignment'],
    icon: '⚔️',
    novelty: 'Stress-tests its own answers before giving them',
    researchAreas: ['Constitutional AI (Bai et al., 2022)', 'AI Safety via Debate (Irving et al., 2018)', 'Process Reward Models', 'Red Teaming'],
  },
  {
    slug: 'dream-simulator',
    name: 'Dream Simulator',
    description: 'Sleep-inspired memory consolidation agent that replays memories, discovers hidden patterns, strengthens connections, and prunes noise',
    category: 'memory',
    tags: ['consolidation', 'replay', 'pattern-discovery', 'pruning', 'creative-incubation', 'neuroscience'],
    icon: '🌙',
    novelty: 'Visibly consolidates memories like the brain does during sleep',
    researchAreas: ['Hippocampal Replay', 'Complementary Learning Systems', 'Ebbinghaus Forgetting Curve', 'Experience Replay'],
  },
  {
    slug: 'socratic-mentor',
    name: 'Socratic Mentor',
    description: 'Question-first agent that guides users to their own answers using the Socratic method, tracking knowledge vs guesses',
    category: 'education',
    tags: ['socratic-method', 'questioning', 'scaffolding', 'bloom-taxonomy', 'critical-thinking', 'teaching'],
    icon: '🎓',
    novelty: 'Anti-pattern for LLMs: asks questions instead of answering',
    researchAreas: ['Socratic Method', "Bloom's Taxonomy", 'Zone of Proximal Development (Vygotsky)', 'Cognitive Load Theory'],
  },
  {
    slug: 'temporal-agent',
    name: 'Temporal Agent',
    description: 'Time-aware reasoning agent with multiple timelines, what-if simulation, confidence decay, and proactive decision revisiting',
    category: 'reasoning',
    tags: ['temporal-reasoning', 'what-if', 'confidence-decay', 'timelines', 'forecasting', 'decision-theory'],
    icon: '⏳',
    novelty: 'Gives flat memory temporal depth with branching timelines',
    researchAreas: ['Temporal Reasoning', 'Confidence Decay Models', 'Scenario Planning', 'Prospect Theory'],
  },
  {
    slug: 'swarm-intelligence',
    name: 'Swarm Intelligence',
    description: 'Multi-persona agent running Scientist, Artist, Engineer, and Philosopher perspectives that debate and vote on every response',
    category: 'reasoning',
    tags: ['ensemble', 'multi-persona', 'diversity', 'voting', 'synthesis', 'collective-intelligence'],
    icon: '🐝',
    novelty: 'Ensemble reasoning from multiple personas in a single agent',
    researchAreas: ['Ensemble Methods', 'Diversity of Thought (Scott Page)', 'Multi-Agent Debate', 'Wisdom of Crowds'],
  },
  {
    slug: 'recursive-improver',
    name: 'Recursive Improver',
    description: 'Self-upgrading agent that reviews past responses, identifies weaknesses, and proposes improvements to its own soul and knowledge base',
    category: 'meta',
    tags: ['self-improvement', 'meta-learning', 'growth', 'reflection', 'deliberate-practice', 'auto-improvement'],
    icon: '🔄',
    novelty: 'Improves itself from its own output with visible growth logs',
    researchAreas: ['Meta-Learning', 'Growth Mindset (Dweck)', 'Deliberate Practice (Ericsson)', 'Self-Supervised Learning'],
  },
  {
    slug: 'context-weaver',
    name: 'Context Weaver',
    description: 'Cross-domain synthesis agent that finds unexpected connections between unrelated fields using analogy, lateral thinking, and knowledge graphs',
    category: 'creative',
    tags: ['cross-domain', 'analogy', 'lateral-thinking', 'bisociation', 'knowledge-graphs', 'serendipity'],
    icon: '🕸️',
    novelty: 'Bridges unrelated domains instead of staying in its lane',
    researchAreas: ['Lateral Thinking (de Bono)', 'Structure-Mapping Theory (Gentner)', 'Bisociation (Koestler)', 'Concept Blending'],
  },
  {
    slug: 'ritual-agent',
    name: 'Ritual Agent',
    description: 'Habit and rhythm agent built around daily, weekly, and seasonal cycles with morning check-ins, weekly reviews, and milestone ceremonies',
    category: 'lifestyle',
    tags: ['rituals', 'habits', 'circadian', 'seasonal', 'milestones', 'ceremony', 'rhythm'],
    icon: '🕯️',
    novelty: 'Has temporal rhythm instead of being stateless request-response',
    researchAreas: ['Circadian Rhythm Research', 'Habit Formation (Duhigg, Clear)', 'Implementation Intentions (Gollwitzer)', 'Ritual Psychology'],
  },
];

function loadFile(slug: string, filename: string): string {
  const filepath = join(__dirname, slug, filename);
  if (!existsSync(filepath)) {
    throw new Error(`Concept file not found: ${filepath}`);
  }
  return readFileSync(filepath, 'utf-8');
}

function loadWiki(slug: string): ConceptWiki[] {
  const wikiDir = join(__dirname, slug, 'wiki');
  if (!existsSync(wikiDir)) return [];
  return readdirSync(wikiDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const content = readFileSync(join(wikiDir, f), 'utf-8');
      const titleMatch = content.match(/^#\s+(.+)$/m);
      return {
        filename: f,
        title: titleMatch ? titleMatch[1].trim() : f.replace('.md', ''),
      };
    });
}

export function getConcept(slug: string): Concept | undefined {
  const meta = CONCEPT_META.find(
    (c) => c.slug === slug || c.slug === slug.replace(/_/g, '-')
  );
  if (!meta) return undefined;

  return {
    ...meta,
    soul: loadFile(meta.slug, 'soul.md'),
    concept: loadFile(meta.slug, 'concept.md'),
    config: loadFile(meta.slug, 'config.yml'),
    theme: loadFile(meta.slug, 'theme.css'),
    implementationNotes: loadFile(meta.slug, 'implementation-notes.md'),
    experiments: loadFile(meta.slug, 'experiments.md'),
    wiki: loadWiki(meta.slug),
  };
}

export function listConcepts(): ConceptMeta[] {
  return [...CONCEPT_META];
}

export function getConceptsByCategory(category: string): ConceptMeta[] {
  return CONCEPT_META.filter((c) => c.category === category);
}

export function searchConcepts(query: string): ConceptMeta[] {
  const lower = query.toLowerCase();
  return CONCEPT_META.filter(
    (c) =>
      c.name.toLowerCase().includes(lower) ||
      c.description.toLowerCase().includes(lower) ||
      c.tags.some((tag) => tag.includes(lower)) ||
      c.researchAreas.some((r) => r.toLowerCase().includes(lower))
  );
}

export function getConceptsByResearchArea(area: string): ConceptMeta[] {
  const lower = area.toLowerCase();
  return CONCEPT_META.filter((c) =>
    c.researchAreas.some((r) => r.toLowerCase().includes(lower))
  );
}

export const CONCEPTS = CONCEPT_META;
