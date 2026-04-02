/**
 * Handler interface for typed WebSocket messages.
 *
 * Each handler is a plain function (not a class method). It receives:
 *   - ws:  the WebSocket connection to send responses to
 *   - msg: the parsed TypedMessage
 *   - ctx: a HandlerContext with all services the handler might need
 *
 * Handlers are async and may throw — the dispatcher catches and sends
 * an error frame automatically.
 */
export {};
//# sourceMappingURL=types.js.map