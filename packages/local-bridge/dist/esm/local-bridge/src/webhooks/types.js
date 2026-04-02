/**
 * Webhook types for Cocapn webhook system.
 *
 * Provides types for webhooks, events, and deliveries.
 */
/**
 * Mapped event types from external webhooks.
 * These are the event types that webhooks can subscribe to.
 */
export const CocapnEventType = {
    // Skill events
    SKILL_LOADED: 'skill.loaded',
    SKILL_UNLOADED: 'skill.unloaded',
    SKILL_EXECUTED: 'skill.executed',
    // Task events
    TASK_COMPLETED: 'task.completed',
    TASK_FAILED: 'task.failed',
    TASK_TRIGGERED: 'task.triggered',
    // Brain events
    BRAIN_WRITE: 'brain.write',
    BRAIN_READ: 'brain.read',
    // Tree search events
    TREE_SEARCH_COMPLETED: 'tree_search.completed',
    TREE_SEARCH_FAILED: 'tree_search.failed',
    // Error events
    ERROR: 'error',
    // External webhook events
    GITHUB_PUSH: 'github.push',
    GITHUB_PR: 'github.pull_request',
    GITHUB_ISSUE: 'github.issue',
    SLACK_COMMAND: 'slack.command',
    SLACK_INTERACTION: 'slack.interaction',
    DISCORD_INTERACTION: 'discord.interaction',
};
//# sourceMappingURL=types.js.map