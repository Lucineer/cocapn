/**
 * Discord webhook handler.
 *
 * Parses Discord interactions (slash commands, buttons, modals) and maps them to Cocapn events.
 */
import { createLogger } from '../../logger.js';
const logger = createLogger('webhooks:discord');
/**
 * Discord interaction types.
 */
export var DiscordInteractionType;
(function (DiscordInteractionType) {
    DiscordInteractionType[DiscordInteractionType["PING"] = 1] = "PING";
    DiscordInteractionType[DiscordInteractionType["APPLICATION_COMMAND"] = 2] = "APPLICATION_COMMAND";
    DiscordInteractionType[DiscordInteractionType["MESSAGE_COMPONENT"] = 3] = "MESSAGE_COMPONENT";
    DiscordInteractionType[DiscordInteractionType["APPLICATION_COMMAND_AUTOCOMPOMPLETE"] = 4] = "APPLICATION_COMMAND_AUTOCOMPOMPLETE";
    DiscordInteractionType[DiscordInteractionType["MODAL_SUBMIT"] = 5] = "MODAL_SUBMIT";
})(DiscordInteractionType || (DiscordInteractionType = {}));
/**
 * Discord interaction callback types.
 */
export var DiscordCallbackType;
(function (DiscordCallbackType) {
    DiscordCallbackType[DiscordCallbackType["PONG"] = 1] = "PONG";
    DiscordCallbackType[DiscordCallbackType["CHANNEL_MESSAGE_WITH_SOURCE"] = 4] = "CHANNEL_MESSAGE_WITH_SOURCE";
    DiscordCallbackType[DiscordCallbackType["DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE"] = 5] = "DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE";
    DiscordCallbackType[DiscordCallbackType["DEFERRED_UPDATE_MESSAGE"] = 6] = "DEFERRED_UPDATE_MESSAGE";
    DiscordCallbackType[DiscordCallbackType["UPDATE_MESSAGE"] = 7] = "UPDATE_MESSAGE";
    DiscordCallbackType[DiscordCallbackType["APPLICATION_COMMAND_AUTOCOMPLETE_RESULT"] = 8] = "APPLICATION_COMMAND_AUTOCOMPLETE_RESULT";
    DiscordCallbackType[DiscordCallbackType["MODAL"] = 9] = "MODAL";
})(DiscordCallbackType || (DiscordCallbackType = {}));
/**
 * Discord webhook handler.
 */
export class DiscordWebhookHandler {
    applicationId;
    publicKey;
    botToken;
    constructor(applicationId, publicKey, botToken) {
        this.applicationId = applicationId;
        this.publicKey = publicKey;
        this.botToken = botToken;
    }
    /**
     * Handle a Discord interaction.
     */
    async handleInteraction(interaction) {
        const cocapnEvents = [];
        try {
            switch (interaction.type) {
                case DiscordInteractionType.PING:
                    // Respond with PONG
                    return {
                        cocapnEvents: [],
                        response: { type: DiscordCallbackType.PONG },
                    };
                case DiscordInteractionType.APPLICATION_COMMAND:
                    // Slash command
                    cocapnEvents.push({
                        type: 'task.triggered',
                        payload: {
                            source: 'discord',
                            commandName: interaction.data?.name,
                            options: this.extractOptions(interaction.data?.options),
                            userId: interaction.user?.id,
                            userName: interaction.user?.username,
                            guildId: interaction.guild_id,
                            channelId: interaction.channel_id,
                            interactionToken: interaction.token,
                        },
                    });
                    break;
                case DiscordInteractionType.MESSAGE_COMPONENT:
                    // Button or select menu interaction
                    cocapnEvents.push({
                        type: 'interaction.action',
                        payload: {
                            source: 'discord',
                            customId: interaction.data?.name,
                            userId: interaction.user?.id,
                            userName: interaction.user?.username,
                            guildId: interaction.guild_id,
                            channelId: interaction.channel_id,
                            interactionToken: interaction.token,
                        },
                    });
                    break;
                case DiscordInteractionType.MODAL_SUBMIT:
                    // Modal form submission
                    cocapnEvents.push({
                        type: 'form.submission',
                        payload: {
                            source: 'discord',
                            customId: interaction.data?.name,
                            userId: interaction.user?.id,
                            userName: interaction.user?.username,
                            guildId: interaction.guild_id,
                            channelId: interaction.channel_id,
                            interactionToken: interaction.token,
                        },
                    });
                    break;
                default:
                    logger.debug('Unknown Discord interaction type', {
                        type: interaction.type,
                    });
                    break;
            }
            logger.info('Discord interaction processed', {
                type: interaction.type,
                user: interaction.user?.username,
            });
            // Defer response for commands that take time
            if (interaction.type === DiscordInteractionType.APPLICATION_COMMAND) {
                return {
                    cocapnEvents,
                    response: {
                        type: DiscordCallbackType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
                    },
                };
            }
            return { cocapnEvents };
        }
        catch (error) {
            logger.error('Failed to process Discord interaction', error, {
                type: interaction.type,
            });
            return { cocapnEvents: [] };
        }
    }
    /**
     * Extract options from interaction data.
     */
    extractOptions(options) {
        if (!options)
            return {};
        const result = {};
        for (const option of options) {
            result[option.name] = option.value;
        }
        return result;
    }
    /**
     * Verify Discord request signature.
     * Discord uses Ed25519 signatures.
     */
    static verifySignature(body, signature, timestamp, publicKey) {
        const crypto = require('crypto');
        try {
            const verify = crypto.createVerify('SHA256');
            verify.update(timestamp);
            verify.update(body);
            return verify.verify(publicKey, signature, 'base64');
        }
        catch (error) {
            logger.error('Failed to verify Discord signature', error);
            return false;
        }
    }
    /**
     * Send a follow-up message to an interaction.
     */
    async sendFollowUp(interactionToken, message) {
        if (!this.botToken) {
            throw new Error('Bot token required for follow-up messages');
        }
        try {
            const url = `https://discord.com/api/v10/webhooks/${this.applicationId}/${interactionToken}`;
            await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bot ${this.botToken}`,
                },
                body: JSON.stringify(message),
            });
        }
        catch (error) {
            logger.error('Failed to send Discord follow-up', error);
        }
    }
    /**
     * Edit an original interaction response.
     */
    async editOriginalResponse(interactionToken, message) {
        if (!this.botToken) {
            throw new Error('Bot token required for editing responses');
        }
        try {
            const url = `https://discord.com/api/v10/webhooks/${this.applicationId}/${interactionToken}/messages/@original`;
            await fetch(url, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bot ${this.botToken}`,
                },
                body: JSON.stringify(message),
            });
        }
        catch (error) {
            logger.error('Failed to edit Discord response', error);
        }
    }
    /**
     * Send a deferred response with a loading message.
     */
    createDeferredResponse() {
        return {
            type: DiscordCallbackType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: 'Processing your request...',
            },
        };
    }
    /**
     * Create an ephemeral response (only visible to the user).
     */
    createEphemeralResponse(content) {
        return {
            type: DiscordCallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content,
                flags: 64, // EPHEMERAL flag
            },
        };
    }
    /**
     * Create a public channel response.
     */
    createChannelResponse(content) {
        return {
            type: DiscordCallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content,
            },
        };
    }
    /**
     * Create a modal response.
     */
    createModalResponse(modal) {
        return {
            type: DiscordCallbackType.MODAL,
            data: modal,
        };
    }
}
//# sourceMappingURL=discord.js.map