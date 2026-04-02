"use strict";
/**
 * Fleet Protocol - Multi-agent coordination
 *
 * Extends A2A protocol with fleet-specific messages and semantics.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FleetClient = exports.fleetManager = exports.FleetManager = exports.FleetRegistry = exports.taskSplitter = exports.TaskSplitter = exports.FleetErrorCode = exports.DEFAULT_FLEET_CONFIG = void 0;
// Constants
var types_js_1 = require("./types.cjs");
Object.defineProperty(exports, "DEFAULT_FLEET_CONFIG", { enumerable: true, get: function () { return types_js_1.DEFAULT_FLEET_CONFIG; } });
Object.defineProperty(exports, "FleetErrorCode", { enumerable: true, get: function () { return types_js_1.FleetErrorCode; } });
// Classes
var task_splitter_js_1 = require("./task-splitter.cjs");
Object.defineProperty(exports, "TaskSplitter", { enumerable: true, get: function () { return task_splitter_js_1.TaskSplitter; } });
Object.defineProperty(exports, "taskSplitter", { enumerable: true, get: function () { return task_splitter_js_1.taskSplitter; } });
var fleet_registry_js_1 = require("./fleet-registry.cjs");
Object.defineProperty(exports, "FleetRegistry", { enumerable: true, get: function () { return fleet_registry_js_1.FleetRegistry; } });
var fleet_manager_js_1 = require("./fleet-manager.cjs");
Object.defineProperty(exports, "FleetManager", { enumerable: true, get: function () { return fleet_manager_js_1.FleetManager; } });
Object.defineProperty(exports, "fleetManager", { enumerable: true, get: function () { return fleet_manager_js_1.fleetManager; } });
var client_js_1 = require("./client.cjs");
Object.defineProperty(exports, "FleetClient", { enumerable: true, get: function () { return client_js_1.FleetClient; } });
//# sourceMappingURL=index.js.map