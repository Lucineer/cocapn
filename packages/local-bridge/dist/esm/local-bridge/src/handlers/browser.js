/**
 * BROWSER handler — headless browser automation via Playwright.
 *
 * Provides visual verification, screenshot capture, element interaction,
 * and console error monitoring for web testing and automation.
 *
 * Expects message types:
 *   - BROWSER_LAUNCH    { headless?, timeout?, viewport?, allowedDomains? }
 *   - BROWSER_NAVIGATE  { url }
 *   - BROWSER_SCREENSHOT { fullPage?, selector? }
 *   - BROWSER_CLICK     { selector }
 *   - BROWSER_TYPE      { selector, text }
 *   - BROWSER_TEXT      { selector? }
 *   - BROWSER_WAIT      { selector, timeout? }
 *   - BROWSER_EVALUATE  { script }
 *   - BROWSER_TITLE     {}
 *   - BROWSER_ERRORS    {}
 *   - BROWSER_CLOSE     {}
 *
 * Emits response types:
 *   - BROWSER_RESULT    { success, data?, error?, ... }
 *
 * Security:
 *   - Only allows navigation to localhost URLs by default
 *   - Configurable domain whitelist via allowedDomains
 *   - Timeout enforcement (30s default)
 *   - Auto-close on idle (5 min timeout)
 *   - Only one browser session at a time
 */
import { getDefaultBrowser } from "../tools/browser.js";
/**
 * Browser message types
 */
const BROWSER_LAUNCH = "BROWSER_LAUNCH";
const BROWSER_NAVIGATE = "BROWSER_NAVIGATE";
const BROWSER_SCREENSHOT = "BROWSER_SCREENSHOT";
const BROWSER_CLICK = "BROWSER_CLICK";
const BROWSER_TYPE = "BROWSER_TYPE";
const BROWSER_TEXT = "BROWSER_TEXT";
const BROWSER_WAIT = "BROWSER_WAIT";
const BROWSER_EVALUATE = "BROWSER_EVALUATE";
const BROWSER_TITLE = "BROWSER_TITLE";
const BROWSER_ERRORS = "BROWSER_ERRORS";
const BROWSER_CLOSE = "BROWSER_CLOSE";
/**
 * Send a browser result response
 */
function sendResult(ws, id, result) {
    // Remove sender reference from context to avoid circular serialization
    const { sender, ...safeContext } = {};
    ws.send(JSON.stringify({
        type: "BROWSER_RESULT",
        id,
        ...result,
    }));
}
/**
 * BROWSER_LAUNCH — launch headless browser
 */
export const handleBrowserLaunch = async (ws, _clientId, msg, _ctx) => {
    const headless = msg["headless"] ?? true;
    const timeout = msg["timeout"] ?? 30000;
    const viewport = msg["viewport"] ?? {
        width: 1280,
        height: 720,
    };
    const allowedDomains = msg["allowedDomains"] ?? [
        "localhost",
        "127.0.0.1",
        "::1",
    ];
    try {
        const browser = getDefaultBrowser({
            headless,
            timeout,
            viewport,
            allowedDomains,
        });
        if (browser.isLaunched()) {
            sendResult(ws, msg.id, {
                success: false,
                error: "Browser is already launched. Close the current session first.",
            });
            return;
        }
        await browser.launch();
        const sessionInfo = browser.getSessionInfo();
        sendResult(ws, msg.id, {
            success: true,
            data: sessionInfo,
        });
    }
    catch (error) {
        sendResult(ws, msg.id, {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        });
    }
};
/**
 * BROWSER_NAVIGATE — navigate to URL
 */
export const handleBrowserNavigate = async (ws, _clientId, msg, _ctx) => {
    const url = msg["url"];
    if (!url) {
        sendResult(ws, msg.id, {
            success: false,
            error: "Missing required field: url",
        });
        return;
    }
    try {
        const browser = getDefaultBrowser();
        if (!browser.isLaunched()) {
            sendResult(ws, msg.id, {
                success: false,
                error: "Browser is not launched. Call BROWSER_LAUNCH first.",
            });
            return;
        }
        const result = await browser.navigate(url);
        sendResult(ws, msg.id, result);
    }
    catch (error) {
        sendResult(ws, msg.id, {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        });
    }
};
/**
 * BROWSER_SCREENSHOT — take screenshot
 */
export const handleBrowserScreenshot = async (ws, _clientId, msg, _ctx) => {
    const fullPage = msg["fullPage"];
    const selector = msg["selector"];
    try {
        const browser = getDefaultBrowser();
        if (!browser.isLaunched()) {
            sendResult(ws, msg.id, {
                success: false,
                error: "Browser is not launched. Call BROWSER_LAUNCH first.",
            });
            return;
        }
        const result = await browser.screenshot({ fullPage, selector });
        sendResult(ws, msg.id, result);
    }
    catch (error) {
        sendResult(ws, msg.id, {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        });
    }
};
/**
 * BROWSER_CLICK — click element
 */
export const handleBrowserClick = async (ws, _clientId, msg, _ctx) => {
    const selector = msg["selector"];
    if (!selector) {
        sendResult(ws, msg.id, {
            success: false,
            error: "Missing required field: selector",
        });
        return;
    }
    try {
        const browser = getDefaultBrowser();
        if (!browser.isLaunched()) {
            sendResult(ws, msg.id, {
                success: false,
                error: "Browser is not launched. Call BROWSER_LAUNCH first.",
            });
            return;
        }
        const result = await browser.click(selector);
        sendResult(ws, msg.id, result);
    }
    catch (error) {
        sendResult(ws, msg.id, {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        });
    }
};
/**
 * BROWSER_TYPE — type text into element
 */
export const handleBrowserType = async (ws, _clientId, msg, _ctx) => {
    const selector = msg["selector"];
    const text = msg["text"];
    if (!selector || text === undefined) {
        sendResult(ws, msg.id, {
            success: false,
            error: "Missing required fields: selector, text",
        });
        return;
    }
    try {
        const browser = getDefaultBrowser();
        if (!browser.isLaunched()) {
            sendResult(ws, msg.id, {
                success: false,
                error: "Browser is not launched. Call BROWSER_LAUNCH first.",
            });
            return;
        }
        const result = await browser.type(selector, text);
        sendResult(ws, msg.id, result);
    }
    catch (error) {
        sendResult(ws, msg.id, {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        });
    }
};
/**
 * BROWSER_TEXT — get text content
 */
export const handleBrowserText = async (ws, _clientId, msg, _ctx) => {
    const selector = msg["selector"];
    try {
        const browser = getDefaultBrowser();
        if (!browser.isLaunched()) {
            sendResult(ws, msg.id, {
                success: false,
                error: "Browser is not launched. Call BROWSER_LAUNCH first.",
            });
            return;
        }
        const result = await browser.getText(selector);
        sendResult(ws, msg.id, result);
    }
    catch (error) {
        sendResult(ws, msg.id, {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        });
    }
};
/**
 * BROWSER_WAIT — wait for element
 */
export const handleBrowserWait = async (ws, _clientId, msg, _ctx) => {
    const selector = msg["selector"];
    const timeout = msg["timeout"];
    if (!selector) {
        sendResult(ws, msg.id, {
            success: false,
            error: "Missing required field: selector",
        });
        return;
    }
    try {
        const browser = getDefaultBrowser();
        if (!browser.isLaunched()) {
            sendResult(ws, msg.id, {
                success: false,
                error: "Browser is not launched. Call BROWSER_LAUNCH first.",
            });
            return;
        }
        const result = await browser.waitFor(selector, timeout);
        sendResult(ws, msg.id, result);
    }
    catch (error) {
        sendResult(ws, msg.id, {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        });
    }
};
/**
 * BROWSER_EVALUATE — evaluate JavaScript
 */
export const handleBrowserEvaluate = async (ws, _clientId, msg, _ctx) => {
    const script = msg["script"];
    if (!script) {
        sendResult(ws, msg.id, {
            success: false,
            error: "Missing required field: script",
        });
        return;
    }
    try {
        const browser = getDefaultBrowser();
        if (!browser.isLaunched()) {
            sendResult(ws, msg.id, {
                success: false,
                error: "Browser is not launched. Call BROWSER_LAUNCH first.",
            });
            return;
        }
        const result = await browser.evaluate(script);
        sendResult(ws, msg.id, result);
    }
    catch (error) {
        sendResult(ws, msg.id, {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        });
    }
};
/**
 * BROWSER_TITLE — get page title
 */
export const handleBrowserTitle = async (ws, _clientId, msg, _ctx) => {
    try {
        const browser = getDefaultBrowser();
        if (!browser.isLaunched()) {
            sendResult(ws, msg.id, {
                success: false,
                error: "Browser is not launched. Call BROWSER_LAUNCH first.",
            });
            return;
        }
        const title = await browser.getTitle();
        sendResult(ws, msg.id, {
            success: true,
            data: title,
        });
    }
    catch (error) {
        sendResult(ws, msg.id, {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        });
    }
};
/**
 * BROWSER_ERRORS — get console errors
 */
export const handleBrowserErrors = async (ws, _clientId, msg, _ctx) => {
    try {
        const browser = getDefaultBrowser();
        if (!browser.isLaunched()) {
            sendResult(ws, msg.id, {
                success: false,
                error: "Browser is not launched. Call BROWSER_LAUNCH first.",
            });
            return;
        }
        const errors = browser.getConsoleErrors();
        sendResult(ws, msg.id, {
            success: true,
            data: errors,
        });
    }
    catch (error) {
        sendResult(ws, msg.id, {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        });
    }
};
/**
 * BROWSER_CLOSE — close browser
 */
export const handleBrowserClose = async (ws, _clientId, msg, _ctx) => {
    try {
        const browser = getDefaultBrowser();
        if (!browser.isLaunched()) {
            sendResult(ws, msg.id, {
                success: false,
                error: "Browser is not launched.",
            });
            return;
        }
        await browser.close();
        sendResult(ws, msg.id, {
            success: true,
            data: "Browser closed successfully",
        });
    }
    catch (error) {
        sendResult(ws, msg.id, {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        });
    }
};
/**
 * Router for all browser message types
 */
export const handleBrowser = async (ws, clientId, msg, ctx) => {
    const browserAction = msg["action"];
    switch (browserAction) {
        case "launch":
            return handleBrowserLaunch(ws, clientId, msg, ctx);
        case "navigate":
            return handleBrowserNavigate(ws, clientId, msg, ctx);
        case "screenshot":
            return handleBrowserScreenshot(ws, clientId, msg, ctx);
        case "click":
            return handleBrowserClick(ws, clientId, msg, ctx);
        case "type":
            return handleBrowserType(ws, clientId, msg, ctx);
        case "text":
            return handleBrowserText(ws, clientId, msg, ctx);
        case "wait":
            return handleBrowserWait(ws, clientId, msg, ctx);
        case "evaluate":
            return handleBrowserEvaluate(ws, clientId, msg, ctx);
        case "title":
            return handleBrowserTitle(ws, clientId, msg, ctx);
        case "errors":
            return handleBrowserErrors(ws, clientId, msg, ctx);
        case "close":
            return handleBrowserClose(ws, clientId, msg, ctx);
        default:
            sendResult(ws, msg.id, {
                success: false,
                error: `Unknown browser action: ${browserAction}`,
            });
    }
};
// Export all individual handlers for registration
export const browserHandlers = {
    BROWSER_LAUNCH: handleBrowserLaunch,
    BROWSER_NAVIGATE: handleBrowserNavigate,
    BROWSER_SCREENSHOT: handleBrowserScreenshot,
    BROWSER_CLICK: handleBrowserClick,
    BROWSER_TYPE: handleBrowserType,
    BROWSER_TEXT: handleBrowserText,
    BROWSER_WAIT: handleBrowserWait,
    BROWSER_EVALUATE: handleBrowserEvaluate,
    BROWSER_TITLE: handleBrowserTitle,
    BROWSER_ERRORS: handleBrowserErrors,
    BROWSER_CLOSE: handleBrowserClose,
};
//# sourceMappingURL=browser.js.map