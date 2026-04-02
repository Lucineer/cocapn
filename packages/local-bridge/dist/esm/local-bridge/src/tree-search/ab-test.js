/**
 * Tree Search A/B Testing Framework
 *
 * This module provides tools for comparing single-path execution
 * against tree search execution to measure actual value.
 *
 * The framework can:
 * - Run tasks with single-path execution
 * - Run tasks with tree search execution
 * - Compare results across multiple metrics
 * - Generate reports with aggregated statistics
 * - Store results in Brain for long-term tracking
 */
import { randomUUID } from 'crypto';
import { TreeSearch } from './index.js';
import { TreeSearchExecutor } from './executor.js';
// ─── ABTestRunner ─────────────────────────────────────────────────────────────
/**
 * A/B Test Runner — compares single-path vs tree search execution
 *
 * This class executes tasks using both approaches and compares the results.
 */
export class ABTestRunner {
    options;
    mockSingleResult;
    mockTreeResult;
    constructor(options) {
        this.options = {
            storeResults: false,
            singleTimeout: 60000, // 1 minute
            treeTimeout: 300000, // 5 minutes
            ...options,
        };
    }
    /**
     * Run a single task with single-path execution
     *
     * @param task - The task to execute
     * @returns Promise resolving to execution result
     */
    async runSingle(task) {
        // If mock result is set, use it (for testing)
        if (this.mockSingleResult) {
            const result = { ...this.mockSingleResult, taskId: task.id };
            this.mockSingleResult = undefined;
            return result;
        }
        const startTime = Date.now();
        try {
            // For single-path, we use a direct executor
            const executor = new TreeSearchExecutor({ repoRoot: task.repoRoot });
            // Execute with a straightforward approach
            const approach = `Single-path execution: ${task.description}`;
            const result = await executor.executeApproach(task.description, approach, task.repoRoot);
            const duration = Date.now() - startTime;
            const abResult = {
                taskId: task.id,
                approach: 'single',
                success: result.success,
                testPassRate: result.testPassRate,
                codeQualityScore: result.codeQualityScore,
                tokensUsed: result.tokenCost,
                duration,
                reworkNeeded: !result.success || result.testPassRate < 1.0,
                errors: result.errors,
                output: result.output,
                filesChanged: result.filesChanged,
                timestamp: new Date().toISOString(),
            };
            // Store result if Brain is available
            if (this.options.storeResults && this.options.brain) {
                await this.storeResult(task.id, abResult);
            }
            return abResult;
        }
        catch (error) {
            const duration = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            const abResult = {
                taskId: task.id,
                approach: 'single',
                success: false,
                testPassRate: 0,
                codeQualityScore: 0,
                tokensUsed: 0,
                duration,
                reworkNeeded: true,
                errors: [errorMessage],
                output: '',
                filesChanged: [],
                timestamp: new Date().toISOString(),
            };
            return abResult;
        }
    }
    /**
     * Run a single task with tree search
     *
     * @param task - The task to execute
     * @returns Promise resolving to execution result
     */
    async runTree(task) {
        // If mock result is set, use it (for testing)
        if (this.mockTreeResult) {
            const result = { ...this.mockTreeResult, taskId: task.id };
            this.mockTreeResult = undefined;
            return result;
        }
        const startTime = Date.now();
        try {
            // Create tree search instance
            const treeSearch = new TreeSearch(task.repoRoot, {
                maxNodes: 21,
                maxDepth: 5,
                enableBranching: true,
            });
            // Run tree search
            const result = await treeSearch.search(task.description);
            const duration = Date.now() - startTime;
            const bestNode = result.bestNode;
            const nodeResult = bestNode.result || {
                success: false,
                testPassRate: 0,
                codeQualityScore: 0,
                tokenCost: 0,
                output: 'No result available',
                filesChanged: [],
                errors: ['No result available from tree search'],
            };
            const abResult = {
                taskId: task.id,
                approach: 'tree',
                success: nodeResult.success,
                testPassRate: nodeResult.testPassRate,
                codeQualityScore: nodeResult.codeQualityScore,
                tokensUsed: result.totalTokensUsed,
                duration,
                reworkNeeded: !nodeResult.success || nodeResult.testPassRate < 1.0,
                errors: nodeResult.errors,
                output: nodeResult.output,
                filesChanged: nodeResult.filesChanged,
                timestamp: new Date().toISOString(),
            };
            // Store result if Brain is available
            if (this.options.storeResults && this.options.brain) {
                await this.storeResult(task.id, abResult);
            }
            return abResult;
        }
        catch (error) {
            const duration = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            const abResult = {
                taskId: task.id,
                approach: 'tree',
                success: false,
                testPassRate: 0,
                codeQualityScore: 0,
                tokensUsed: 0,
                duration,
                reworkNeeded: true,
                errors: [errorMessage],
                output: '',
                filesChanged: [],
                timestamp: new Date().toISOString(),
            };
            return abResult;
        }
    }
    /**
     * Run both approaches and compare
     *
     * @param task - The task to execute
     * @returns Promise resolving to comparison summary
     */
    async compare(task) {
        // Run both approaches
        const [singleResult, treeResult] = await Promise.all([
            this.runSingle(task),
            this.runTree(task),
        ]);
        // Calculate advantages
        const singleAdvantage = [];
        const treeAdvantage = [];
        // Token efficiency (lower is better)
        if (singleResult.tokensUsed < treeResult.tokensUsed) {
            const tokenDiff = ((treeResult.tokensUsed - singleResult.tokensUsed) / treeResult.tokensUsed) * 100;
            singleAdvantage.push({
                metric: 'tokens',
                value: tokenDiff,
                description: `Single used ${tokenDiff.toFixed(1)}% fewer tokens`,
            });
        }
        else if (treeResult.tokensUsed < singleResult.tokensUsed) {
            const tokenDiff = ((singleResult.tokensUsed - treeResult.tokensUsed) / singleResult.tokensUsed) * 100;
            treeAdvantage.push({
                metric: 'tokens',
                value: tokenDiff,
                description: `Tree used ${tokenDiff.toFixed(1)}% fewer tokens`,
            });
        }
        // Speed (lower duration is better)
        if (singleResult.duration < treeResult.duration) {
            const timeDiff = ((treeResult.duration - singleResult.duration) / treeResult.duration) * 100;
            singleAdvantage.push({
                metric: 'speed',
                value: timeDiff,
                description: `Single was ${timeDiff.toFixed(1)}% faster`,
            });
        }
        else if (treeResult.duration < singleResult.duration) {
            const timeDiff = ((singleResult.duration - treeResult.duration) / singleResult.duration) * 100;
            treeAdvantage.push({
                metric: 'speed',
                value: timeDiff,
                description: `Tree was ${timeDiff.toFixed(1)}% faster`,
            });
        }
        // Quality score
        const singleScore = (singleResult.testPassRate * 0.6 + singleResult.codeQualityScore * 0.4);
        const treeScore = (treeResult.testPassRate * 0.6 + treeResult.codeQualityScore * 0.4);
        const qualityDiff = ((treeScore - singleScore) / singleScore) * 100;
        if (qualityDiff > 0) {
            treeAdvantage.push({
                metric: 'quality',
                value: qualityDiff,
                description: `Tree quality was ${qualityDiff.toFixed(1)}% better`,
            });
        }
        else if (qualityDiff < 0) {
            singleAdvantage.push({
                metric: 'quality',
                value: Math.abs(qualityDiff),
                description: `Single quality was ${Math.abs(qualityDiff).toFixed(1)}% better`,
            });
        }
        // Success rate
        if (singleResult.success && !treeResult.success) {
            singleAdvantage.push({
                metric: 'success',
                value: 100,
                description: 'Single succeeded where tree failed',
            });
        }
        else if (!singleResult.success && treeResult.success) {
            treeAdvantage.push({
                metric: 'success',
                value: 100,
                description: 'Tree succeeded where single failed',
            });
        }
        // Determine winner
        let winner;
        if (singleResult.success && !treeResult.success) {
            winner = 'single';
        }
        else if (!singleResult.success && treeResult.success) {
            winner = 'tree';
        }
        else if (qualityDiff > 5) {
            winner = 'tree';
        }
        else if (qualityDiff < -5) {
            winner = 'single';
        }
        else {
            winner = 'tie';
        }
        return {
            taskId: task.id,
            description: task.description,
            singleResult,
            treeResult,
            winner,
            singleAdvantage,
            treeAdvantage,
            scoreDifference: qualityDiff,
        };
    }
    /**
     * Run a batch of tasks
     *
     * @param tasks - Array of tasks to execute
     * @returns Promise resolving to array of comparison summaries
     */
    async runBatch(tasks) {
        const results = [];
        for (const task of tasks) {
            try {
                const summary = await this.compare(task);
                results.push(summary);
            }
            catch (error) {
                console.error(`[ABTestRunner] Failed to run task ${task.id}:`, error);
                // Create a failure summary
                const failureResult = {
                    taskId: task.id,
                    approach: 'single',
                    success: false,
                    testPassRate: 0,
                    codeQualityScore: 0,
                    tokensUsed: 0,
                    duration: 0,
                    reworkNeeded: true,
                    errors: [error instanceof Error ? error.message : String(error)],
                    output: '',
                    filesChanged: [],
                    timestamp: new Date().toISOString(),
                };
                results.push({
                    taskId: task.id,
                    description: task.description,
                    singleResult: failureResult,
                    treeResult: { ...failureResult, approach: 'tree' },
                    winner: 'tie',
                    singleAdvantage: [],
                    treeAdvantage: [],
                    scoreDifference: 0,
                });
            }
        }
        return results;
    }
    /**
     * Aggregate results across all tasks
     *
     * @param results - Array of comparison summaries
     * @returns Aggregated statistics
     */
    aggregate(results) {
        const totalTasks = results.length;
        // Handle empty results
        if (totalTasks === 0) {
            return {
                totalTasks: 0,
                singleWins: 0,
                treeWins: 0,
                ties: 0,
                singleWinRate: 0,
                treeWinRate: 0,
                tieRate: 0,
                avgSingleTokens: 0,
                avgTreeTokens: 0,
                avgTokenDifference: 0,
                avgSingleDuration: 0,
                avgTreeDuration: 0,
                avgDurationDifference: 0,
                avgSingleTestPassRate: 0,
                avgTreeTestPassRate: 0,
                avgTestPassRateDifference: 0,
                avgSingleCodeQuality: 0,
                avgTreeCodeQuality: 0,
                avgCodeQualityDifference: 0,
                singleSuccessRate: 0,
                treeSuccessRate: 0,
                conclusions: ['No data available for analysis'],
            };
        }
        // Count wins
        let singleWins = 0;
        let treeWins = 0;
        let ties = 0;
        for (const result of results) {
            if (result.winner === 'single')
                singleWins++;
            else if (result.winner === 'tree')
                treeWins++;
            else
                ties++;
        }
        // Calculate averages
        const singleTokens = results.map(r => r.singleResult.tokensUsed);
        const treeTokens = results.map(r => r.treeResult.tokensUsed);
        const singleDuration = results.map(r => r.singleResult.duration);
        const treeDuration = results.map(r => r.treeResult.duration);
        const singleTestPassRate = results.map(r => r.singleResult.testPassRate);
        const treeTestPassRate = results.map(r => r.treeResult.testPassRate);
        const singleCodeQuality = results.map(r => r.singleResult.codeQualityScore);
        const treeCodeQuality = results.map(r => r.treeResult.codeQualityScore);
        const avgSingleTokens = singleTokens.reduce((a, b) => a + b, 0) / totalTasks;
        const avgTreeTokens = treeTokens.reduce((a, b) => a + b, 0) / totalTasks;
        const avgTokenDifference = avgSingleTokens > 0 ? ((avgSingleTokens - avgTreeTokens) / avgSingleTokens) * 100 : 0;
        const avgSingleDuration = singleDuration.reduce((a, b) => a + b, 0) / totalTasks;
        const avgTreeDuration = treeDuration.reduce((a, b) => a + b, 0) / totalTasks;
        const avgDurationDifference = avgSingleDuration > 0 ? ((avgSingleDuration - avgTreeDuration) / avgSingleDuration) * 100 : 0;
        const avgSingleTestPassRate = singleTestPassRate.reduce((a, b) => a + b, 0) / totalTasks;
        const avgTreeTestPassRate = treeTestPassRate.reduce((a, b) => a + b, 0) / totalTasks;
        const avgTestPassRateDifference = avgSingleTestPassRate > 0
            ? ((avgTreeTestPassRate - avgSingleTestPassRate) / avgSingleTestPassRate) * 100
            : 0;
        const avgSingleCodeQuality = singleCodeQuality.reduce((a, b) => a + b, 0) / totalTasks;
        const avgTreeCodeQuality = treeCodeQuality.reduce((a, b) => a + b, 0) / totalTasks;
        const avgCodeQualityDifference = avgSingleCodeQuality > 0
            ? ((avgTreeCodeQuality - avgSingleCodeQuality) / avgSingleCodeQuality) * 100
            : 0;
        const singleSuccessCount = results.filter(r => r.singleResult.success).length;
        const treeSuccessCount = results.filter(r => r.treeResult.success).length;
        const singleSuccessRate = singleSuccessCount / totalTasks;
        const treeSuccessRate = treeSuccessCount / totalTasks;
        // Calculate win rates for conclusions
        const calculatedSingleWinRate = singleWins / totalTasks;
        const calculatedTreeWinRate = treeWins / totalTasks;
        // Generate conclusions
        const conclusions = [];
        if (calculatedSingleWinRate > 0.6) {
            conclusions.push(`Single-path wins ${Math.round(calculatedSingleWinRate * 100)}% of the time - prefer for most tasks`);
        }
        else if (calculatedTreeWinRate > 0.6) {
            conclusions.push(`Tree search wins ${Math.round(calculatedTreeWinRate * 100)}% of the time - prefer for most tasks`);
        }
        if (avgTokenDifference < -50) {
            conclusions.push(`Tree search uses ${Math.round(Math.abs(avgTokenDifference))}% more tokens - use selectively`);
        }
        else if (avgTokenDifference > 0) {
            conclusions.push(`Tree search is token-efficient - safe to use broadly`);
        }
        if (avgDurationDifference < -50) {
            conclusions.push(`Tree search is ${Math.round(Math.abs(avgDurationDifference))}% slower - consider time constraints`);
        }
        if (avgCodeQualityDifference > 10) {
            conclusions.push(`Tree search improves code quality by ${Math.round(avgCodeQualityDifference)}% - use for critical tasks`);
        }
        if (Math.abs(avgCodeQualityDifference) < 5) {
            conclusions.push(`No significant quality difference - choose based on speed/cost`);
        }
        if (conclusions.length === 0) {
            conclusions.push('No clear winner - consider task-specific factors');
        }
        return {
            totalTasks,
            singleWins,
            treeWins,
            ties,
            singleWinRate: singleWins / totalTasks,
            treeWinRate: treeWins / totalTasks,
            tieRate: ties / totalTasks,
            avgSingleTokens,
            avgTreeTokens,
            avgTokenDifference,
            avgSingleDuration,
            avgTreeDuration,
            avgDurationDifference,
            avgSingleTestPassRate,
            avgTreeTestPassRate,
            avgTestPassRateDifference,
            avgSingleCodeQuality,
            avgTreeCodeQuality,
            avgCodeQualityDifference,
            singleSuccessRate,
            treeSuccessRate,
            conclusions,
        };
    }
    /**
     * Generate a markdown report from aggregated results
     *
     * @param aggregate - Aggregated statistics
     * @returns Markdown report
     */
    generateReport(aggregate) {
        const lines = [];
        lines.push('# Tree Search A/B Test Results');
        lines.push('');
        lines.push(`**Tasks:** ${aggregate.totalTasks}`);
        lines.push(`**Single-path wins:** ${aggregate.singleWins} (${Math.round(aggregate.singleWinRate * 100)}%)`);
        lines.push(`**Tree search wins:** ${aggregate.treeWins} (${Math.round(aggregate.treeWinRate * 100)}%)`);
        lines.push(`**Ties:** ${aggregate.ties} (${Math.round(aggregate.tieRate * 100)}%)`);
        lines.push('');
        lines.push('## Performance Metrics');
        lines.push('');
        lines.push('### Tokens');
        lines.push(`- **Single:** ${Math.round(aggregate.avgSingleTokens).toLocaleString()} tokens`);
        lines.push(`- **Tree:** ${Math.round(aggregate.avgTreeTokens).toLocaleString()} tokens`);
        lines.push(`- **Difference:** ${aggregate.avgTokenDifference > 0 ? '+' : ''}${aggregate.avgTokenDifference.toFixed(1)}%`);
        lines.push('');
        lines.push('### Duration');
        lines.push(`- **Single:** ${Math.round(aggregate.avgSingleDuration / 1000)}s`);
        lines.push(`- **Tree:** ${Math.round(aggregate.avgTreeDuration / 1000)}s`);
        lines.push(`- **Difference:** ${aggregate.avgDurationDifference > 0 ? '+' : ''}${aggregate.avgDurationDifference.toFixed(1)}%`);
        lines.push('');
        lines.push('### Quality');
        lines.push(`- **Single test pass rate:** ${(aggregate.avgSingleTestPassRate * 100).toFixed(1)}%`);
        lines.push(`- **Tree test pass rate:** ${(aggregate.avgTreeTestPassRate * 100).toFixed(1)}%`);
        lines.push(`- **Difference:** ${aggregate.avgTestPassRateDifference > 0 ? '+' : ''}${aggregate.avgTestPassRateDifference.toFixed(1)}%`);
        lines.push('');
        lines.push(`- **Single code quality:** ${(aggregate.avgSingleCodeQuality * 100).toFixed(1)}%`);
        lines.push(`- **Tree code quality:** ${(aggregate.avgTreeCodeQuality * 100).toFixed(1)}%`);
        lines.push(`- **Difference:** ${aggregate.avgCodeQualityDifference > 0 ? '+' : ''}${aggregate.avgCodeQualityDifference.toFixed(1)}%`);
        lines.push('');
        lines.push('### Success Rate');
        lines.push(`- **Single:** ${(aggregate.singleSuccessRate * 100).toFixed(1)}%`);
        lines.push(`- **Tree:** ${(aggregate.treeSuccessRate * 100).toFixed(1)}%`);
        lines.push('');
        lines.push('## Conclusions');
        lines.push('');
        for (const conclusion of aggregate.conclusions) {
            lines.push(`- ${conclusion}`);
        }
        lines.push('');
        lines.push('## Recommendation');
        lines.push('');
        if (aggregate.treeWinRate > 0.6 && aggregate.avgCodeQualityDifference > 10) {
            lines.push('**Use tree search** for most tasks - it produces significantly better quality.');
            if (aggregate.avgTokenDifference < -50) {
                lines.push('Consider token costs by using tree search selectively for complex tasks only.');
            }
        }
        else if (aggregate.singleWinRate > 0.6) {
            lines.push('**Prefer single-path execution** - it wins most of the time.');
            if (aggregate.avgCodeQualityDifference > 10) {
                lines.push('Use tree search only for critical tasks where quality is paramount.');
            }
            else {
                lines.push('Tree search does not provide enough benefit to justify the cost.');
            }
        }
        else {
            lines.push('No clear winner - choose based on task complexity and constraints.');
            lines.push('- **Simple tasks:** Use single-path (faster, cheaper)');
            lines.push('- **Complex tasks:** Use tree search (better quality)');
            lines.push('- **Time-critical:** Use single-path');
            lines.push('- **Quality-critical:** Use tree search');
        }
        return lines.join('\n');
    }
    /**
     * Store a result in Brain
     *
     * @param taskId - Task identifier
     * @param result - Result to store
     */
    async storeResult(taskId, result) {
        if (!this.options.brain) {
            return;
        }
        const key = `ab-test:${taskId}:${result.approach}`;
        const value = JSON.stringify(result);
        await this.options.brain.setFact(key, value);
    }
    /**
     * Set mock single result (for testing)
     *
     * @param result - Mock result to return
     */
    setMockSingleResult(result) {
        this.mockSingleResult = result;
    }
    /**
     * Set mock tree result (for testing)
     *
     * @param result - Mock result to return
     */
    setMockTreeResult(result) {
        this.mockTreeResult = result;
    }
    /**
     * Clear all mock results
     */
    clearMocks() {
        this.mockSingleResult = undefined;
        this.mockTreeResult = undefined;
    }
}
// ─── Helpers ─────────────────────────────────────────────────────────────────
/**
 * Create a simple A/B test task
 *
 * @param description - Task description
 * @param repoRoot - Repository root
 * @param files - Relevant files
 * @returns A new ABTestTask
 */
export function createABTestTask(description, repoRoot, files, expectedOutcome, complexity) {
    return {
        id: randomUUID(),
        description,
        repoRoot,
        files,
        expectedOutcome: expectedOutcome || 'Task completed successfully',
        complexity,
    };
}
/**
 * Create a mock A/B test result
 *
 * @param approach - Which approach
 * @param success - Whether successful
 * @param tokens - Tokens used
 * @param duration - Duration in ms
 * @returns A mock ABTestResult
 */
export function createMockResult(approach, success, tokens, duration, testPassRate = 1.0, codeQualityScore = 0.8) {
    // If success is false, default testPassRate and codeQualityScore to 0
    const actualTestPassRate = success ? testPassRate : 0;
    const actualCodeQualityScore = success ? codeQualityScore : 0;
    return {
        taskId: 'mock-task',
        approach,
        success,
        testPassRate: actualTestPassRate,
        codeQualityScore: actualCodeQualityScore,
        tokensUsed: tokens,
        duration,
        reworkNeeded: !success || actualTestPassRate < 1.0,
        errors: success ? [] : ['Mock failure'],
        output: success ? 'Mock output' : '',
        filesChanged: success ? ['mock-file.ts'] : [],
        timestamp: new Date().toISOString(),
    };
}
//# sourceMappingURL=ab-test.js.map