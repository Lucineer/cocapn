/**
 * cocapn serve — Serve web UI locally with API proxy
 */
import { Command } from "commander";
import { type IncomingMessage, type ServerResponse } from "http";
export declare function getMimeType(filePath: string): string;
export interface ServeOptions {
    port: string;
    open: boolean;
    production: boolean;
    repo: string;
}
export declare function resolveUiDir(): string | null;
export declare function createServeHandler(uiDir: string, bridgePort: number): (req: IncomingMessage, res: ServerResponse) => void;
export declare function createServeCommand(): Command;
//# sourceMappingURL=serve.d.ts.map