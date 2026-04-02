/**
 * cocapn invite — Share agent with invite links
 *
 * Usage:
 *   cocapn invite create            — Create invite link
 *   cocapn invite create --readonly — Create read-only invite
 *   cocapn invite create --mode public --expires 7d
 *   cocapn invite list              — List active invites
 *   cocapn invite revoke <code>     — Revoke an invite
 *   cocapn invite accept <code>     — Accept an invite (clone + configure)
 */
import { Command } from "commander";
export interface Invite {
    code: string;
    createdAt: string;
    expiresAt: string;
    mode: "public" | "private" | "maintenance";
    readOnly: boolean;
    uses: number;
    publicRepo?: string;
    revokedAt?: string;
}
export interface CreateInviteOptions {
    mode?: string;
    readonly?: boolean;
    expires?: string;
}
export declare function createInvite(repoRoot: string, options?: CreateInviteOptions): Invite;
export declare function listInvites(repoRoot: string): Invite[];
export declare function revokeInvite(repoRoot: string, code: string): Invite;
export declare function acceptInvite(repoRoot: string, code: string, targetDir?: string): {
    invite: Invite;
    cloneDir: string;
};
export declare function createInviteCommand(): Command;
//# sourceMappingURL=invite.d.ts.map