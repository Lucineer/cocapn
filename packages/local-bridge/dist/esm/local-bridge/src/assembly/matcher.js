/**
 * Template Matcher — matches repo profiles to templates
 *
 * Analyzes a repo profile and returns the best matching template
 * with a confidence score. Templates are matched based on:
 * - Language
 * - Framework
 * - Test setup
 * - CI/CD configuration
 * - Special file patterns (TTRPG, study, etc.)
 */
// Template definitions with matching rules
const TEMPLATES = {
    "cloud-worker": {
        name: "cloud-worker",
        displayName: "Cloud Worker",
        description: "Cloudflare Workers template with TypeScript and Hono",
        match: (profile) => {
            let score = 0;
            if (profile.language === "typescript")
                score += 0.4;
            if (profile.framework === "hono")
                score += 0.5;
            if (profile.packageManager === "npm" || profile.packageManager === "pnpm")
                score += 0.1;
            return score;
        },
        modules: ["cloud-module-pii", "cloud-module-router"],
        personality: "cloud-worker",
    },
    "web-app": {
        name: "web-app",
        displayName: "Web Application",
        description: "React/Vue web application template",
        match: (profile) => {
            let score = 0;
            if (profile.language === "typescript" || profile.language === "javascript")
                score += 0.3;
            if (profile.framework === "react" || profile.framework === "vue")
                score += 0.5;
            if (profile.hasTests)
                score += 0.1;
            if (profile.hasCI)
                score += 0.1;
            return score;
        },
        modules: ["git", "publisher"],
        personality: "web-assistant",
    },
    "python": {
        name: "python",
        displayName: "Python Project",
        description: "Python project template with Django/Flask support",
        match: (profile) => {
            let score = 0;
            if (profile.language === "python")
                score += 0.6;
            if (profile.framework === "django" ||
                profile.framework === "flask" ||
                profile.framework === "fastapi")
                score += 0.3;
            if (profile.hasTests)
                score += 0.1;
            return score;
        },
        modules: ["git", "publisher"],
        personality: "python-assistant",
    },
    "dmlog": {
        name: "dmlog",
        displayName: "DM Log",
        description: "TTRPG dungeon master template with dice rollers and combat tracking",
        match: (profile) => {
            let score = 0;
            if (profile.language === "typescript")
                score += 0.2;
            if (profile.framework === "react")
                score += 0.1;
            // Special files would be detected during repo scan
            // For now, lower base score
            return score;
        },
        modules: ["dice-roller", "combat-tracker", "initiative-tracker"],
        personality: "dungeon-master",
    },
    "studylog": {
        name: "studylog",
        displayName: "Study Log",
        description: "Education and research template with flashcards and quizzes",
        match: (profile) => {
            let score = 0;
            if (profile.language === "typescript")
                score += 0.2;
            if (profile.framework === "react")
                score += 0.1;
            // Lower base score, needs explicit selection
            return score;
        },
        modules: ["flashcards", "quiz-generator", "citation-manager"],
        personality: "study-assistant",
    },
    "makerlog": {
        name: "makerlog",
        displayName: "Maker Log",
        description: "Developer and manufacturer template with dev tools",
        match: (profile) => {
            let score = 0;
            if (profile.language === "typescript")
                score += 0.3;
            if (profile.language === "javascript")
                score += 0.2;
            if (profile.framework === "react" || profile.framework === "hono")
                score += 0.2;
            if (profile.hasTests)
                score += 0.1;
            if (profile.hasCI)
                score += 0.1;
            return score;
        },
        modules: ["git", "publisher", "testing-tools"],
        personality: "dev-assistant",
    },
    "businesslog": {
        name: "businesslog",
        displayName: "Business Log",
        description: "Professional and enterprise template with collaboration tools",
        match: (profile) => {
            let score = 0;
            if (profile.hasCI)
                score += 0.2;
            if (profile.hasTests)
                score += 0.1;
            // Enterprise focus
            if (profile.language === "typescript" || profile.language === "java")
                score += 0.2;
            return score;
        },
        modules: ["git", "publisher", "security"],
        personality: "business-assistant",
    },
    "activelog": {
        name: "activelog",
        displayName: "Active Log",
        description: "Health and fitness tracking template",
        match: (profile) => {
            let score = 0;
            if (profile.language === "typescript")
                score += 0.2;
            // Lower base score, needs explicit selection
            return score;
        },
        modules: ["fitness-tracker", "health-metrics"],
        personality: "fitness-coach",
    },
    "activeledger": {
        name: "activeledger",
        displayName: "Active Ledger",
        description: "Finance and crypto tracking template",
        match: (profile) => {
            let score = 0;
            if (profile.language === "typescript")
                score += 0.2;
            // Lower base score, needs explicit selection
            return score;
        },
        modules: ["crypto-tracker", "portfolio-manager"],
        personality: "finance-advisor",
    },
    "fishinglog": {
        name: "fishinglog",
        displayName: "Fishing Log",
        description: "Commercial and recreational fishing template",
        match: (profile) => {
            let score = 0;
            if (profile.language === "typescript")
                score += 0.2;
            // Lower base score, needs explicit selection
            return score;
        },
        modules: ["catch-log", "weather-integration", "gps-tracker"],
        personality: "fishing-guide",
    },
    "playerlog": {
        name: "playerlog",
        displayName: "Player Log",
        description: "Video gaming focused template",
        match: (profile) => {
            let score = 0;
            if (profile.language === "typescript")
                score += 0.2;
            if (profile.framework === "react")
                score += 0.1;
            return score;
        },
        modules: ["game-tracker", "achievement-tracker"],
        personality: "gaming-buddy",
    },
    "reallog": {
        name: "reallog",
        displayName: "Real Log",
        description: "Journalists and documentarians template",
        match: (profile) => {
            let score = 0;
            if (profile.language === "typescript")
                score += 0.2;
            return score;
        },
        modules: ["media-tools", "citation-manager", "publisher"],
        personality: "journalist-assistant",
    },
    "personallog": {
        name: "personallog",
        displayName: "Personal Log",
        description: "Generic personal assistant template (simplest onboarding)",
        match: (profile) => {
            // Always matches with low confidence as fallback
            return 0.3;
        },
        modules: ["git"],
        personality: "personal-assistant",
    },
    "bare": {
        name: "bare",
        displayName: "Bare Setup",
        description: "Minimal cocapn setup with no defaults",
        match: (profile) => {
            // Always matches with very low confidence
            return 0.1;
        },
        modules: [],
        personality: "generic",
    },
};
/**
 * Matches a repo profile to the best template
 */
export class TemplateMatcher {
    templatesDir;
    constructor(templatesDir) {
        this.templatesDir = templatesDir;
    }
    /**
     * Find the best matching template for a repo profile
     */
    async match(profile) {
        const scores = [];
        // Score each template
        for (const [key, template] of Object.entries(TEMPLATES)) {
            const confidence = template.match(profile);
            scores.push({ template: key, confidence });
        }
        // Sort by confidence (descending)
        scores.sort((a, b) => b.confidence - a.confidence);
        // Get the best match
        const best = scores[0];
        if (!best) {
            // Fallback to bare template
            return {
                template: "bare",
                confidence: 0,
                modules: [],
                personality: "generic",
                displayName: "Bare Setup",
                description: "Minimal cocapn setup",
            };
        }
        const templateDef = TEMPLATES[best.template];
        if (!templateDef) {
            // Fallback to bare template
            return {
                template: "bare",
                confidence: 0,
                modules: [],
                personality: "generic",
                displayName: "Bare Setup",
                description: "Minimal cocapn setup",
            };
        }
        return {
            template: best.template,
            confidence: best.confidence,
            modules: templateDef.modules,
            personality: templateDef.personality,
            displayName: templateDef.displayName,
            description: templateDef.description,
        };
    }
    /**
     * Get all available templates
     */
    listTemplates() {
        return Object.entries(TEMPLATES).map(([key, tpl]) => ({
            name: key,
            displayName: tpl.displayName,
            description: tpl.description,
        }));
    }
}
//# sourceMappingURL=matcher.js.map