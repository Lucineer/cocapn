import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getConcept,
  listConcepts,
  getConceptsByCategory,
  searchConcepts,
  getConceptsByResearchArea,
  CONCEPTS,
} from '../src/concepts/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONCEPTS_DIR = join(__dirname, '..', 'src', 'concepts');

const EXPECTED_SLUGS = [
  'adversarial-reviewer',
  'dream-simulator',
  'socratic-mentor',
  'temporal-agent',
  'swarm-intelligence',
  'recursive-improver',
  'context-weaver',
  'ritual-agent',
];

const REQUIRED_FILES = [
  'soul.md',
  'concept.md',
  'config.yml',
  'theme.css',
  'implementation-notes.md',
  'experiments.md',
];

function parseYamlFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const frontmatter: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const [key, ...rest] = line.split(':');
    if (key && rest.length > 0) {
      frontmatter[key.trim()] = rest.join(':').trim();
    }
  }
  return frontmatter;
}

describe('concept directory structure', () => {
  for (const slug of EXPECTED_SLUGS) {
    describe(slug, () => {
      it('has all required files', () => {
        for (const file of REQUIRED_FILES) {
          const filepath = join(CONCEPTS_DIR, slug, file);
          expect(existsSync(filepath), `Missing ${file} in ${slug}`).toBe(true);
        }
      });

      it('has wiki directory with at least 3 pages', () => {
        const wikiDir = join(CONCEPTS_DIR, slug, 'wiki');
        expect(existsSync(wikiDir), `Missing wiki/ in ${slug}`).toBe(true);
        const wikiFiles = readdirSync(wikiDir).filter((f) => f.endsWith('.md'));
        expect(wikiFiles.length, `${slug} should have at least 3 wiki pages`).toBeGreaterThanOrEqual(3);
      });
    });
  }
});

describe('soul.md frontmatter', () => {
  for (const slug of EXPECTED_SLUGS) {
    describe(slug, () => {
      it('has valid YAML frontmatter with required fields', () => {
        const soulPath = join(CONCEPTS_DIR, slug, 'soul.md');
        const content = readFileSync(soulPath, 'utf-8');
        const frontmatter = parseYamlFrontmatter(content);

        expect(frontmatter.name, `${slug} soul.md missing name`).toBeDefined();
        expect(frontmatter.version, `${slug} soul.md missing version`).toBeDefined();
        expect(frontmatter.tone, `${slug} soul.md missing tone`).toBeDefined();
        expect(frontmatter.model, `${slug} soul.md missing model`).toBeDefined();
      });

      it('has Identity section', () => {
        const soulPath = join(CONCEPTS_DIR, slug, 'soul.md');
        const content = readFileSync(soulPath, 'utf-8');
        expect(content).toContain('# Identity');
      });

      it('has Personality section', () => {
        const soulPath = join(CONCEPTS_DIR, slug, 'soul.md');
        const content = readFileSync(soulPath, 'utf-8');
        expect(content).toContain('## Personality');
      });

      it('has What You Do section', () => {
        const soulPath = join(CONCEPTS_DIR, slug, 'soul.md');
        const content = readFileSync(soulPath, 'utf-8');
        expect(content).toContain('## What You Do');
      });

      it('has What You Don\'t Do section', () => {
        const soulPath = join(CONCEPTS_DIR, slug, 'soul.md');
        const content = readFileSync(soulPath, 'utf-8');
        expect(content).toContain("## What You Don't Do");
      });

      it('has Memory Priorities section', () => {
        const soulPath = join(CONCEPTS_DIR, slug, 'soul.md');
        const content = readFileSync(soulPath, 'utf-8');
        expect(content).toContain('## Memory Priorities');
      });

      it('has Public Face section', () => {
        const soulPath = join(CONCEPTS_DIR, slug, 'soul.md');
        const content = readFileSync(soulPath, 'utf-8');
        expect(content).toContain('## Public Face');
      });
    });
  }
});

describe('concept.md content validation', () => {
  for (const slug of EXPECTED_SLUGS) {
    describe(slug, () => {
      it('has real content (at least 50 lines)', () => {
        const conceptPath = join(CONCEPTS_DIR, slug, 'concept.md');
        const content = readFileSync(conceptPath, 'utf-8');
        const lines = content.split('\n').filter((l) => l.trim().length > 0);
        expect(lines.length, `${slug} concept.md should have substantial content`).toBeGreaterThanOrEqual(50);
      });

      it('mentions novelty or why it is novel', () => {
        const conceptPath = join(CONCEPTS_DIR, slug, 'concept.md');
        const content = readFileSync(conceptPath, 'utf-8').toLowerCase();
        const hasNovelty =
          content.includes('novel') ||
          content.includes('unique') ||
          content.includes('why this works') ||
          content.includes('why it works') ||
          content.includes('research');
        expect(hasNovelty, `${slug} concept.md should explain its novelty`).toBe(true);
      });
    });
  }
});

describe('config.yml validation', () => {
  for (const slug of EXPECTED_SLUGS) {
    describe(slug, () => {
      it('has config section with mode', () => {
        const configPath = join(CONCEPTS_DIR, slug, 'config.yml');
        const content = readFileSync(configPath, 'utf-8');
        expect(content).toContain('config:');
        expect(content).toMatch(/mode:\s*(local|hybrid|cloud)/);
      });

      it('has llm configuration', () => {
        const configPath = join(CONCEPTS_DIR, slug, 'config.yml');
        const content = readFileSync(configPath, 'utf-8');
        expect(content).toContain('llm:');
        expect(content).toContain('provider:');
        expect(content).toContain('model:');
      });

      it('has features section', () => {
        const configPath = join(CONCEPTS_DIR, slug, 'config.yml');
        const content = readFileSync(configPath, 'utf-8');
        expect(content).toContain('features:');
      });

      it('has valid LLM temperature', () => {
        const configPath = join(CONCEPTS_DIR, slug, 'config.yml');
        const content = readFileSync(configPath, 'utf-8');
        const tempMatch = content.match(/temperature:\s*([\d.]+)/);
        expect(tempMatch, `${slug} missing temperature`).not.toBeNull();
        const temp = parseFloat(tempMatch![1]);
        expect(temp).toBeGreaterThanOrEqual(0);
        expect(temp).toBeLessThanOrEqual(1);
      });

      it('has concept-specific features', () => {
        const configPath = join(CONCEPTS_DIR, slug, 'config.yml');
        const content = readFileSync(configPath, 'utf-8');
        expect(content).toContain('brain:');
        expect(content).toContain('capabilities:');
      });
    });
  }
});

describe('theme.css validation', () => {
  for (const slug of EXPECTED_SLUGS) {
    describe(slug, () => {
      it('has CSS custom properties', () => {
        const themePath = join(CONCEPTS_DIR, slug, 'theme.css');
        const content = readFileSync(themePath, 'utf-8');
        expect(content).toContain(':root');
        expect(content).toContain('--color-primary');
        expect(content).toContain('--color-secondary');
        expect(content).toContain('--color-accent');
        expect(content).toContain('--color-background');
        expect(content).toContain('--color-surface');
        expect(content).toContain('--color-text');
      });

      it('has valid color format', () => {
        const themePath = join(CONCEPTS_DIR, slug, 'theme.css');
        const content = readFileSync(themePath, 'utf-8');
        const colorMatches = content.match(/--color-\w+:\s*(#[0-9a-fA-F]{3,8})/g);
        expect(colorMatches, `${slug} has no valid colors`).not.toBeNull();
        expect(colorMatches!.length).toBeGreaterThanOrEqual(5);
      });

      it('has font definitions', () => {
        const themePath = join(CONCEPTS_DIR, slug, 'theme.css');
        const content = readFileSync(themePath, 'utf-8');
        expect(content).toContain('--font-body');
        expect(content).toContain('--font-heading');
        expect(content).toContain('--font-mono');
      });
    });
  }
});

describe('implementation-notes.md validation', () => {
  for (const slug of EXPECTED_SLUGS) {
    describe(slug, () => {
      it('has substantial content', () => {
        const implPath = join(CONCEPTS_DIR, slug, 'implementation-notes.md');
        const content = readFileSync(implPath, 'utf-8');
        const lines = content.split('\n').filter((l) => l.trim().length > 0);
        expect(lines.length, `${slug} implementation-notes.md should have substantial content`).toBeGreaterThanOrEqual(30);
      });
    });
  }
});

describe('experiments.md validation', () => {
  for (const slug of EXPECTED_SLUGS) {
    describe(slug, () => {
      it('has at least 2 experiments proposed', () => {
        const expPath = join(CONCEPTS_DIR, slug, 'experiments.md');
        const content = readFileSync(expPath, 'utf-8');
        const experimentMatches = content.match(/##\s+Experiment\s+\d|^#\s+Experiment\s+\d/gi);
        expect(experimentMatches, `${slug} experiments.md should propose at least 2 experiments`).not.toBeNull();
        expect(experimentMatches!.length).toBeGreaterThanOrEqual(2);
      });
    });
  }
});

describe('concept registry (index.ts)', () => {
  it('exports all 8 concepts', () => {
    const concepts = listConcepts();
    expect(concepts).toHaveLength(8);
  });

  it('all expected slugs are present', () => {
    const concepts = listConcepts();
    const slugs = concepts.map((c) => c.slug);
    for (const slug of EXPECTED_SLUGS) {
      expect(slugs).toContain(slug);
    }
  });

  it('each concept has required metadata fields', () => {
    for (const meta of CONCEPTS) {
      expect(meta.slug).toBeDefined();
      expect(meta.name).toBeDefined();
      expect(meta.description).toBeDefined();
      expect(meta.category).toBeDefined();
      expect(meta.tags).toBeInstanceOf(Array);
      expect(meta.tags.length).toBeGreaterThan(0);
      expect(meta.icon).toBeDefined();
      expect(meta.novelty).toBeDefined();
      expect(meta.researchAreas).toBeInstanceOf(Array);
      expect(meta.researchAreas.length).toBeGreaterThan(0);
    }
  });

  it('getConcept returns full concept for valid slug', () => {
    const concept = getConcept('adversarial-reviewer');
    expect(concept).toBeDefined();
    expect(concept!.soul).toContain('Adversarial Reviewer');
    expect(concept!.concept).toContain('novel');
    expect(concept!.config).toContain('config:');
    expect(concept!.theme).toContain(':root');
    expect(concept!.implementationNotes).toBeDefined();
    expect(concept!.experiments).toBeDefined();
    expect(concept!.wiki.length).toBeGreaterThanOrEqual(3);
  });

  it('getConcept returns undefined for invalid slug', () => {
    expect(getConcept('nonexistent')).toBeUndefined();
  });

  it('getConceptsByCategory filters correctly', () => {
    const reasoning = getConceptsByCategory('reasoning');
    expect(reasoning.length).toBeGreaterThanOrEqual(2);
    expect(reasoning.map((c) => c.slug)).toContain('adversarial-reviewer');
    expect(reasoning.map((c) => c.slug)).toContain('temporal-agent');
  });

  it('searchConcepts finds by name', () => {
    const results = searchConcepts('swarm');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].slug).toBe('swarm-intelligence');
  });

  it('searchConcepts finds by tag', () => {
    const results = searchConcepts('meta-learning');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.map((r) => r.slug)).toContain('recursive-improver');
  });

  it('searchConcepts finds by research area', () => {
    const results = searchConcepts('Socratic');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.map((r) => r.slug)).toContain('socratic-mentor');
  });

  it('getConceptsByResearchArea filters correctly', () => {
    const results = getConceptsByResearchArea('ensemble');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.map((r) => r.slug)).toContain('swarm-intelligence');
  });
});
