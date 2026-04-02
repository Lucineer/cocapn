"use strict";
/**
 * Fleet Task Splitter
 *
 * Decomposes complex tasks into subtasks and merges results.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskSplitter = exports.TaskSplitter = void 0;
// ---------------------------------------------------------------------------
// Task Splitting
// ---------------------------------------------------------------------------
class TaskSplitter {
    /**
     * Split a complex task into subtasks based on decomposition strategy
     */
    splitTask(description, strategy, input) {
        switch (strategy.type) {
            case 'parallel':
                return this.splitParallel(description, strategy);
            case 'sequential':
                return this.splitSequential(description, strategy);
            case 'map-reduce':
                return this.splitMapReduce(description, strategy);
            default:
                throw new Error(`Unknown decomposition strategy: ${strategy.type}`);
        }
    }
    /**
     * Split task into parallel independent subtasks
     */
    splitParallel(description, strategy) {
        const subtasks = strategy.subtasks;
        const estimatedDuration = subtasks.length > 0 ? Math.max(...subtasks.map(st => st.timeout)) : 0;
        return {
            subtasks,
            mergeStrategy: strategy.mergeStrategy,
            estimatedDuration,
        };
    }
    /**
     * Split task into sequential stages
     */
    splitSequential(description, strategy) {
        const subtasks = strategy.stages.map((stage, index) => {
            const subtask = {
                id: `${this.generateId()}-${index}`,
                description: `${stage.name}: ${description}`,
                input: {
                    role: 'user',
                    parts: [{ type: 'text', text: description }],
                },
                timeout: 300000, // 5 minutes default per stage
                priority: 5,
            };
            if (stage.assignedTo) {
                subtask.requiredSkills = [stage.assignedTo];
            }
            return subtask;
        });
        const estimatedDuration = subtasks.reduce((sum, st) => sum + st.timeout, 0);
        return {
            subtasks,
            mergeStrategy: 'concat',
            estimatedDuration,
        };
    }
    /**
     * Split task into map-reduce pattern
     */
    splitMapReduce(description, strategy) {
        // For map-reduce, create a mapper subtask
        const mapperSubtask = {
            id: this.generateId(),
            description: `Map: ${strategy.mapper.mapFunction} on ${description}`,
            input: strategy.mapper.input,
            requiredSkills: [strategy.mapper.mapFunction],
            timeout: 300000,
            priority: 5,
        };
        const estimatedDuration = mapperSubtask.timeout + 60000; // Mapper + reducer time
        return {
            subtasks: [mapperSubtask],
            mergeStrategy: 'custom', // Will be handled by reducer
            estimatedDuration,
        };
    }
    /**
     * Merge results from multiple subtasks based on strategy
     */
    mergeResults(results, mergeStrategy) {
        switch (mergeStrategy) {
            case 'concat':
                return this.mergeConcat(results);
            case 'vote':
                return this.mergeVote(results);
            case 'quorum':
                return this.mergeQuorum(results);
            case 'custom':
                return this.mergeCustom(results);
            default:
                throw new Error(`Unknown merge strategy: ${mergeStrategy}`);
        }
    }
    /**
     * Concatenate all results
     */
    mergeConcat(results) {
        const concatenated = results.map(r => r.result).join('\n\n');
        return {
            success: true,
            result: concatenated,
            errors: [],
        };
    }
    /**
     * Vote on best result (requires odd number of agents)
     */
    mergeVote(results) {
        // Count occurrences of each result
        const counts = new Map();
        for (const { result } of results) {
            const key = JSON.stringify(result);
            counts.set(key, (counts.get(key) || 0) + 1);
        }
        // Find most common
        let maxCount = 0;
        let winner = null;
        for (const [key, count] of counts) {
            if (count > maxCount) {
                maxCount = count;
                winner = key;
            }
        }
        if (!winner) {
            return {
                success: false,
                errors: ['No results to vote on'],
            };
        }
        return {
            success: true,
            result: JSON.parse(winner),
            errors: [],
        };
    }
    /**
     * Require quorum (2/3 majority)
     */
    mergeQuorum(results) {
        const total = results.length;
        const quorum = Math.ceil((2 * total) / 3);
        // Count successful results
        const successful = results.filter(r => r.result?.status === 'success');
        if (successful.length >= quorum) {
            return {
                success: true,
                result: {
                    message: `Quorum reached: ${successful.length}/${total} succeeded`,
                    results: successful.map(r => r.result),
                },
                errors: [],
            };
        }
        return {
            success: false,
            errors: [`Quorum not reached: ${successful.length}/${total} required ${quorum}`],
        };
    }
    /**
     * Custom merge (just return all results)
     */
    mergeCustom(results) {
        return {
            success: true,
            result: {
                results,
                count: results.length,
            },
            errors: [],
        };
    }
    /**
     * Determine best-fit agent for a task
     */
    determineAgentFit(subtask, agents) {
        const scores = agents
            .filter(agent => agent.status !== 'offline' && agent.status !== 'degraded')
            .map(agent => ({
            agentId: agent.id,
            score: this.calculateScore(agent, subtask),
            reasons: this.getScoreReasons(agent, subtask),
        }));
        // Sort by score descending
        scores.sort((a, b) => b.score - a.score);
        return scores;
    }
    /**
     * Calculate score for agent-task match
     */
    calculateScore(agent, subtask) {
        let score = 0;
        // Skill match (50 points)
        if (subtask.requiredSkills && subtask.requiredSkills.length > 0) {
            const skillMatch = subtask.requiredSkills.every(s => agent.skills.includes(s));
            if (skillMatch)
                score += 50;
        }
        else {
            // No specific skills required, give partial credit
            score += 25;
        }
        // Current load (30 points — inverse)
        score += (1 - agent.load) * 30;
        // Past performance (20 points)
        score += agent.successRate * 20;
        return score;
    }
    /**
     * Get human-readable reasons for score
     */
    getScoreReasons(agent, subtask) {
        const reasons = [];
        // Skill match
        if (subtask.requiredSkills && subtask.requiredSkills.length > 0) {
            const matchingSkills = subtask.requiredSkills.filter(s => agent.skills.includes(s));
            if (matchingSkills.length === subtask.requiredSkills.length) {
                reasons.push(`All required skills present: ${matchingSkills.join(', ')}`);
            }
            else {
                reasons.push(`Missing skills: ${subtask.requiredSkills.filter(s => !agent.skills.includes(s)).join(', ')}`);
            }
        }
        // Load
        if (agent.load < 0.3) {
            reasons.push('Low load');
        }
        else if (agent.load > 0.7) {
            reasons.push('High load');
        }
        // Success rate
        if (agent.successRate > 0.9) {
            reasons.push('Excellent success rate');
        }
        else if (agent.successRate < 0.7) {
            reasons.push('Low success rate');
        }
        return reasons;
    }
    /**
     * Generate unique ID
     */
    generateId() {
        return `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }
}
exports.TaskSplitter = TaskSplitter;
// ---------------------------------------------------------------------------
// Singleton instance
// ---------------------------------------------------------------------------
exports.taskSplitter = new TaskSplitter();
//# sourceMappingURL=task-splitter.js.map