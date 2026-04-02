/**
 * cocapn wiki — Manage agent wiki from the CLI.
 *
 * Reads/writes cocapn/wiki/*.md files directly. No bridge required.
 */
import { Command } from "commander";
export interface WikiPageMeta {
    slug: string;
    path: string;
    created: string;
    modified: string;
    size: number;
}
export interface WikiPage extends WikiPageMeta {
    content: string;
}
export interface WikiSearchResult {
    slug: string;
    snippet: string;
    line: number;
}
export declare function resolveWikiDir(repoRoot: string): string | null;
export declare function ensureWikiDir(repoRoot: string): string;
export declare function listPages(wikiDir: string): WikiPageMeta[];
export declare function getPage(wikiDir: string, slug: string): WikiPage | null;
export declare function searchWiki(wikiDir: string, query: string): WikiSearchResult[];
export declare function createWikiCommand(): Command;
//# sourceMappingURL=wiki.d.ts.map