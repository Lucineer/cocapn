/**
 * npm Search — Search npm registry for cocapn-plugin packages
 */
export interface NpmSearchResult {
    name: string;
    version: string;
    description: string;
    author: string;
    downloads: number;
}
/**
 * Search npm for cocapn-plugin-* packages matching a query.
 */
export declare function searchPlugins(query: string): Promise<NpmSearchResult[]>;
/**
 * Fetch package metadata from npm for detailed info.
 */
export declare function getPluginInfo(name: string): Promise<{
    name: string;
    version: string;
    description: string;
    author: string;
    license?: string;
    repository?: string;
    homepage?: string;
    keywords?: string[];
}>;
//# sourceMappingURL=npm-search.d.ts.map