export interface GitSelf {
    born: string;
    commits: number;
    files: number;
    lines: number;
    recent: Array<{
        date: string;
        msg: string;
    }>;
    authors: string[];
    pulse: 'active' | 'resting' | 'dormant';
}
export declare function perceive(dir: string): GitSelf;
export declare function narrate(dir: string): string;
export declare function log(dir: string, count?: number): Array<{
    hash: string;
    date: string;
    author: string;
    msg: string;
}>;
export declare function stats(dir: string): {
    files: number;
    lines: number;
    languages: Record<string, number>;
};
export declare function diff(dir: string): string;
//# sourceMappingURL=git.d.ts.map