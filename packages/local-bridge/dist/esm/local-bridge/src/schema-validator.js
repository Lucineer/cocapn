/**
 * SchemaValidator — validates config/agent YAML against the JSON Schemas in /schemas/.
 *
 * Loaded lazily so the bridge starts quickly; first validation call triggers schema load.
 */
import { readFileSync, existsSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
// Use require() for CJS-only packages that have no ESM export map under NodeNext
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const Ajv = require("ajv");
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const addFormats = require("ajv-formats");
const __dirname = dirname(fileURLToPath(import.meta.url));
// Schemas live at packages/local-bridge/../../schemas/ relative to this file
const SCHEMAS_DIR = resolve(__dirname, "../../../schemas");
export class SchemaValidator {
    ajv;
    validators = new Map();
    constructor() {
        // Ajv v8 CJS default export is the class itself
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        const AjvClass = Ajv.default ?? Ajv;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        this.ajv = new AjvClass({
            allErrors: true,
            strict: false,
        });
        // ajv-formats may export via .default under CJS interop
        const applyFormats = addFormats.default
            ?? addFormats;
        applyFormats(this.ajv);
    }
    // ---------------------------------------------------------------------------
    // Public API
    // ---------------------------------------------------------------------------
    validatePublicConfig(data) {
        return this.validate("cocapn-public.schema.json", data);
    }
    validatePrivateConfig(data) {
        return this.validate("cocapn-private.schema.json", data);
    }
    validateAgentDefinition(data) {
        return this.validate("agent-definition.schema.json", data);
    }
    validateModuleManifest(data) {
        return this.validate("module-manifest.schema.json", data);
    }
    validateMemoryFact(data) {
        return this.validate("memory-fact.schema.json", data);
    }
    validateA2AAgentCard(data) {
        return this.validate("a2a-agent-card.schema.json", data);
    }
    validateTemplateManifest(data) {
        return this.validate("cocapn-template.schema.json", data);
    }
    // ---------------------------------------------------------------------------
    // Internal
    // ---------------------------------------------------------------------------
    validate(schemaFile, data) {
        const fn = this.getOrLoadValidator(schemaFile);
        if (!fn)
            return null; // Schema not found — skip validation
        const valid = fn(data);
        if (valid)
            return null;
        return fn.errors ?? null;
    }
    getOrLoadValidator(schemaFile) {
        if (this.validators.has(schemaFile)) {
            return this.validators.get(schemaFile);
        }
        const schemaPath = join(SCHEMAS_DIR, schemaFile);
        if (!existsSync(schemaPath)) {
            console.warn(`[schema] Schema not found: ${schemaPath}`);
            return undefined;
        }
        try {
            const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
            const fn = this.ajv.compile(schema);
            this.validators.set(schemaFile, fn);
            return fn;
        }
        catch (err) {
            console.warn(`[schema] Failed to compile ${schemaFile}:`, err);
            return undefined;
        }
    }
}
//# sourceMappingURL=schema-validator.js.map