/**
 * Awareness — repo self-perception for cocapn.
 *
 * Reads git log, package.json, and file tree to generate
 * a first-person narrative: "I am [name], born [date], I have [n] files..."
 *
 * Uses only Node.js built-ins. Calls `git` CLI via child_process.
 */
export interface SelfDescription {
    name: string;
    born: string;
    age: string;
    commits: number;
    files: number;
    languages: string[];
    description: string;
    lastCommit: string;
    branch: string;
    authors: string[];
    recentActivity: string;
    feeling: string;
}
export declare class Awareness {
    private repoDir;
    constructor(repoDir: string);
    /** Generate first-person self-description */
    perceive(): SelfDescription;
    /** Render self-description as first-person narrative */
    narrate(): string;
    private getName;
    private getDescription;
    private getBirthDate;
    private getCommitCount;
    private getLastCommitTime;
    private getBranch;
    private getAuthors;
    private getRecentActivity;
    private inferFeeling;
    private detectLanguages;
    private countFiles;
    private walkDir;
    private readJson;
    private formatAge;
}
//# sourceMappingURL=awareness.d.ts.map