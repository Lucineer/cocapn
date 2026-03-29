/**
 * Self Assembler — orchestrates automatic configuration on first run
 *
 * When a new cocapn instance starts:
 * 1. Detects the repo's tech stack
 * 2. Matches to the best template
 * 3. Discovers available modules
 * 4. Loads skill cartridges from modules
 * 5. Configures router rules
 * 6. Returns assembly result
 */

import { existsSync, readdirSync } from "fs";
import { join } from "path";
import { RepoDetector, type RepoProfile } from "./detector.js";
import { TemplateMatcher, type TemplateMatch } from "./matcher.js";

export interface AssemblyResult {
  /** Detected repository profile */
  profile: RepoProfile;
  /** Matched template */
  template: TemplateMatch;
  /** Discovered modules */
  modules: string[];
  /** Discovered skills */
  skills: string[];
  /** Generated configuration */
  config: Record<string, unknown>;
  /** Assembly duration in ms */
  duration: number;
  /** Whether assembly was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

// Default skill paths
const DEFAULT_SKILL_PATHS = [
  "./skills",
  "../skills",
  "../../skills",
  "./node_modules/cocapn-skills",
  "../../node_modules/cocapn-skills",
];

/**
 * Self Assembler — automatic configuration
 */
export class SelfAssembler {
  private detector: RepoDetector;
  private matcher: TemplateMatcher;

  constructor(private repoRoot: string) {
    this.detector = new RepoDetector(repoRoot);
    this.matcher = new TemplateMatcher(
      join(repoRoot, "../../templates")
    ); // Default templates dir
  }

  /**
   * Run the full assembly process
   */
  async assemble(): Promise<AssemblyResult> {
    const startTime = Date.now();

    try {
      // 1. Detect repo profile
      const profile = await this.detector.detect();

      // 2. Match template
      const template = await this.matcher.match(profile);

      // 3. Discover modules
      const modules = await this.discoverModules();

      // 4. Load skill cartridges
      const skills = await this.discoverSkills();

      // 5. Generate configuration
      const config = this.generateConfig(profile, template, modules);

      const duration = Date.now() - startTime;

      return {
        profile,
        template,
        modules,
        skills,
        config,
        duration,
        success: true,
      };
    } catch (err) {
      const duration = Date.now() - startTime;
      const error =
        err instanceof Error ? err.message : String(err);

      return {
        profile: {
          language: "unknown",
          framework: undefined,
          packageManager: "npm",
          hasTests: false,
          hasCI: false,
          testCommand: "",
          buildCommand: undefined,
          entryPoints: [],
          totalFiles: 0,
          totalDirs: 0,
        },
        template: {
          template: "bare",
          confidence: 0,
          modules: [],
          personality: "generic",
          displayName: "Bare Setup",
          description: "Minimal cocapn setup",
        },
        modules: [],
        skills: [],
        config: {},
        duration,
        success: false,
        error,
      };
    }
  }

  /**
   * Discover available modules in the repo
   */
  private async discoverModules(): Promise<string[]> {
    const modules: string[] = [];

    // Check node_modules/cocapn-modules/
    const modulesDir = join(this.repoRoot, "node_modules", "cocapn-modules");
    if (existsSync(modulesDir)) {
      const entries = readdirSync(modulesDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const moduleJson = join(modulesDir, entry.name, "module.json");
          if (existsSync(moduleJson)) {
            modules.push(entry.name);
          }
        }
      }
    }

    // Check modules/ directory in repo
    const localModulesDir = join(this.repoRoot, "modules");
    if (existsSync(localModulesDir)) {
      const entries = readdirSync(localModulesDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const moduleYml = join(localModulesDir, entry.name, "module.yml");
          if (existsSync(moduleYml)) {
            modules.push(entry.name);
          }
        }
      }
    }

    return modules;
  }

  /**
   * Discover available skill cartridges
   */
  private async discoverSkills(): Promise<string[]> {
    const skills: string[] = [];

    // Check default skill paths
    for (const skillPath of DEFAULT_SKILL_PATHS) {
      const resolvedPath = join(this.repoRoot, skillPath);
      if (existsSync(resolvedPath)) {
        const skillFiles = this.findSkillFiles(resolvedPath);
        skills.push(...skillFiles);
      }
    }

    // Check cocapn/skills/ directory
    const cocapnSkillsDir = join(this.repoRoot, "cocapn", "skills");
    if (existsSync(cocapnSkillsDir)) {
      const skillFiles = this.findSkillFiles(cocapnSkillsDir);
      skills.push(...skillFiles);
    }

    return Array.from(new Set(skills)); // Deduplicate
  }

  /**
   * Find skill.json files in a directory
   */
  private findSkillFiles(dir: string): string[] {
    const skills: string[] = [];

    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name === "skill.json") {
          skills.push(join(dir, entry.name));
        } else if (entry.isDirectory()) {
          const subDir = join(dir, entry.name);
          const subSkills = this.findSkillFiles(subDir);
          skills.push(...subSkills);
        }
      }
    } catch {
      // Ignore errors
    }

    return skills;
  }

  /**
   * Generate configuration from profile and template
   */
  private generateConfig(
    profile: RepoProfile,
    template: TemplateMatch,
    modules: string[]
  ): Record<string, unknown> {
    return {
      // Language detection
      language: profile.language,
      framework: profile.framework,

      // Template selection
      template: {
        name: template.template,
        confidence: template.confidence,
        displayName: template.displayName,
        description: template.description,
      },

      // Personality
      personality: {
        file: `personalities/${template.personality}.md`,
        systemPrompt: undefined,
      },

      // Modules to install
      modules: template.modules,

      // Available modules (discovered)
      availableModules: modules,

      // Skills to load
      skills: [], // Will be populated by skill loader

      // Commands
      commands: {
        test: profile.testCommand,
        build: profile.buildCommand,
      },

      // Router configuration
      router: {
        // Auto-configure routing based on template
        autoRouting: true,
        // Enable intent detection
        intentDetection: true,
        // Route by capability
        capabilityRouting: true,
      },

      // Memory configuration
      memory: {
        facts: "memory/facts.json",
        procedures: "memory/procedures",
        relationships: "memory/relationships.json",
      },

      // Sync configuration
      sync: {
        interval: 300,
        memoryInterval: 60,
        autoCommit: profile.hasCI,
        autoPush: false,
      },

      // Assembly timestamp
      assembledAt: new Date().toISOString(),
    };
  }

  /**
   * Get assembly status as a human-readable string
   */
  static formatStatus(result: AssemblyResult): string {
    if (!result.success) {
      return `❌ Assembly failed: ${result.error}`;
    }

    const lines = [
      "✅ Assembly complete",
      "",
      "📊 Repository Profile:",
      `  Language: ${result.profile.language}`,
      `  Framework: ${result.profile.framework || "none"}`,
      `  Package Manager: ${result.profile.packageManager}`,
      `  Tests: ${result.profile.hasTests ? "yes" : "no"}`,
      `  CI/CD: ${result.profile.hasCI ? "yes" : "no"}`,
      `  Files: ${result.profile.totalFiles}`,
      "",
      "🎨 Template Match:",
      `  Template: ${result.template.displayName} (${result.template.template})`,
      `  Confidence: ${(result.template.confidence * 100).toFixed(0)}%`,
      `  Personality: ${result.template.personality}`,
      "",
      "📦 Modules:",
      ...result.template.modules.map((m) => `  - ${m}`),
      "",
      "🔧 Configuration:",
      `  Test command: ${result.profile.testCommand || "none"}`,
      `  Build command: ${result.profile.buildCommand || "none"}`,
      "",
      `⏱️  Completed in ${result.duration}ms`,
    ];

    return lines.join("\n");
  }
}
