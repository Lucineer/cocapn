/**
 * npm Search — Search npm registry for cocapn-plugin packages
 */
/**
 * Search npm for cocapn-plugin-* packages matching a query.
 */
export async function searchPlugins(query) {
    const searchQuery = `${query}+keywords:cocapn-plugin`;
    const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(searchQuery)}&size=20`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`npm search failed: ${response.statusText}`);
    }
    const data = await response.json();
    return data.objects.map((obj) => {
        const pkg = obj.package;
        let authorName = "";
        if (typeof pkg.author === "string") {
            authorName = pkg.author;
        }
        else if (pkg.author?.name) {
            authorName = pkg.author.name;
        }
        return {
            name: pkg.name,
            version: pkg.version,
            description: pkg.description || "",
            author: authorName,
            downloads: obj.score?.detail?.popularity || 0,
        };
    });
}
/**
 * Fetch package metadata from npm for detailed info.
 */
export async function getPluginInfo(name) {
    const url = `https://registry.npmjs.org/${encodeURIComponent(name)}`;
    const response = await fetch(url);
    if (!response.ok) {
        if (response.status === 404) {
            throw new Error(`Package not found: ${name}`);
        }
        throw new Error(`npm registry error: ${response.statusText}`);
    }
    const data = await response.json();
    const latest = data["dist-tags"];
    const latestVersion = latest?.["latest"] || Object.keys(data["versions"] || {})[0];
    const versionData = latestVersion
        ? data["versions"][latestVersion]
        : undefined;
    let authorName = "";
    const author = data["author"];
    if (typeof author === "string") {
        authorName = author;
    }
    else if (author?.name) {
        authorName = author.name;
    }
    const repo = versionData?.["repository"];
    let repository;
    if (typeof repo === "string") {
        repository = repo;
    }
    else if (repo?.url) {
        repository = repo.url;
    }
    return {
        name: name,
        version: latestVersion || "unknown",
        description: data["description"] || "",
        author: authorName,
        license: versionData?.["license"] || data["license"] || undefined,
        repository,
        homepage: versionData?.["homepage"] || data["homepage"] || undefined,
        keywords: data["keywords"],
    };
}
//# sourceMappingURL=npm-search.js.map