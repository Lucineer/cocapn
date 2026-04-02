/**
 * Skill Decision Tree — Zero-Shot Skill Discovery
 *
 * The decision tree enables zero-shot navigation of skills using
 * a tree structure, similar to the i-know-kung-fu pattern.
 * No LLM tokens needed for skill discovery.
 */
/**
 * Skill Decision Tree for zero-shot skill discovery
 *
 * Maps keywords to skills using a tree structure without LLM involvement.
 * Based on the i-know-kung-fu pattern.
 */
export class SkillDecisionTree {
    tree;
    skills = new Map();
    constructor() {
        this.tree = this.buildDefaultTree();
    }
    /**
     * Resolve keywords to matching skill(s)
     * @param keywords - Keywords to search for
     * @returns Array of matching skill names
     */
    resolve(keywords) {
        const matches = new Set();
        const lowerKeywords = keywords.map(k => k.toLowerCase());
        // Navigate tree for each keyword
        for (const keyword of lowerKeywords) {
            const result = this.navigateTree(keyword, this.tree, []);
            if (result) {
                matches.add(result);
            }
        }
        // Fallback: check all skill triggers directly
        if (matches.size === 0) {
            for (const [name, cartridge] of this.skills) {
                for (const trigger of cartridge.triggers) {
                    if (lowerKeywords.includes(trigger.toLowerCase())) {
                        matches.add(name);
                        break;
                    }
                }
            }
        }
        return Array.from(matches);
    }
    /**
     * Trace the path taken through the tree for each keyword
     * @param keywords - Keywords to search for
     * @returns Array of trace results with skill and path
     */
    trace(keywords) {
        const traces = [];
        const lowerKeywords = keywords.map(k => k.toLowerCase());
        for (const keyword of lowerKeywords) {
            const path = [];
            const result = this.navigateTree(keyword, this.tree, path);
            if (result) {
                traces.push({
                    skill: result,
                    path: [...path],
                });
            }
        }
        return traces;
    }
    /**
     * Rebuild the tree from registered skills
     * @param skills - Array of skill cartridges
     */
    rebuild(skills) {
        this.skills.clear();
        for (const skill of skills) {
            this.skills.set(skill.name, skill);
        }
        this.tree = this.buildTreeFromSkills(skills);
    }
    /**
     * Get the current tree structure (for debugging)
     * @returns The tree root node
     */
    getTree() {
        return this.tree;
    }
    /**
     * Navigate the tree for a single keyword
     * @param keyword - Keyword to search for
     * @param node - Current tree node
     * @param path - Path taken so far
     * @returns Skill name or null
     */
    navigateTree(keyword, node, path) {
        // Record the question
        path.push(node.question);
        // Check if any branch matches the keyword
        for (const [branchKey, branchValue] of Object.entries(node.branches)) {
            if (keyword.includes(branchKey.toLowerCase()) || branchKey.toLowerCase().includes(keyword)) {
                if (typeof branchValue === 'string') {
                    // Leaf node - skill name
                    return branchValue;
                }
                else {
                    // Internal node - continue navigation
                    return this.navigateTree(keyword, branchValue, path);
                }
            }
        }
        return null;
    }
    /**
     * Build the default decision tree
     * @returns Default tree root node
     */
    buildDefaultTree() {
        return {
            question: 'What type of task are you working on?',
            branches: {
                code: {
                    question: 'What kind of code work?',
                    branches: {
                        write: 'code-write',
                        refactor: 'code-refactor',
                        debug: 'code-debug',
                        test: 'code-test',
                        review: 'code-review',
                    },
                },
                research: {
                    question: 'What do you want to find?',
                    branches: {
                        information: 'research-search',
                        documentation: 'research-docs',
                        examples: 'research-examples',
                    },
                },
                communication: {
                    question: 'How do you want to communicate?',
                    branches: {
                        chat: 'comm-chat',
                        message: 'comm-message',
                        notify: 'comm-notify',
                    },
                },
                operations: {
                    question: 'What operation do you need?',
                    branches: {
                        deploy: 'ops-deploy',
                        schedule: 'ops-schedule',
                        publish: 'ops-publish',
                        monitor: 'ops-monitor',
                    },
                },
                security: {
                    question: 'What security task?',
                    branches: {
                        authenticate: 'sec-auth',
                        authorize: 'sec-authz',
                        encrypt: 'sec-encrypt',
                        audit: 'sec-audit',
                    },
                },
                analysis: {
                    question: 'What do you want to analyze?',
                    branches: {
                        data: 'analysis-data',
                        performance: 'analysis-perf',
                        logs: 'analysis-logs',
                    },
                },
            },
        };
    }
    /**
     * Build a tree from skill cartridges
     * @param skills - Array of skill cartridges
     * @returns Tree root node
     */
    buildTreeFromSkills(skills) {
        const categories = new Map();
        // Group skills by category
        for (const skill of skills) {
            const category = skill.category || 'code';
            if (!categories.has(category)) {
                categories.set(category, []);
            }
            categories.get(category).push(skill);
        }
        // Build tree branches from categories
        const branches = {};
        for (const [category, categorySkills] of categories) {
            if (categorySkills.length === 1) {
                branches[category] = categorySkills[0].name;
            }
            else {
                const categoryBranches = {};
                for (const skill of categorySkills) {
                    // Use first trigger as branch key
                    const key = skill.triggers[0] || skill.name;
                    categoryBranches[key] = skill.name;
                }
                branches[category] = {
                    question: `Which ${category} task?`,
                    branches: categoryBranches,
                };
            }
        }
        return {
            question: 'What type of task are you working on?',
            branches,
        };
    }
}
/**
 * Skill Matcher — Alternative keyword-based matching
 *
 * Simple keyword matching when decision tree is overkill.
 */
export class SkillMatcher {
    skills = new Map();
    triggerIndex = new Map(); // trigger -> skill names
    /**
     * Add a skill to the matcher
     * @param skill - Skill cartridge
     */
    add(skill) {
        this.skills.set(skill.name, skill);
        for (const trigger of skill.triggers) {
            const key = trigger.toLowerCase();
            if (!this.triggerIndex.has(key)) {
                this.triggerIndex.set(key, new Set());
            }
            this.triggerIndex.get(key).add(skill.name);
        }
    }
    /**
     * Match keywords to skills
     * @param keywords - Keywords to match
     * @returns Array of matching skill names
     */
    match(keywords) {
        const matches = new Set();
        for (const keyword of keywords) {
            const key = keyword.toLowerCase();
            const skills = this.triggerIndex.get(key);
            if (skills) {
                for (const skill of skills) {
                    matches.add(skill);
                }
            }
        }
        return Array.from(matches);
    }
    /**
     * Clear all skills
     */
    clear() {
        this.skills.clear();
        this.triggerIndex.clear();
    }
    /**
     * Get all registered skills
     * @returns Array of skill cartridges
     */
    getAll() {
        return Array.from(this.skills.values());
    }
}
//# sourceMappingURL=decision-tree.js.map