"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CocapnTerminal = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Terminal integration — agent suggests commands, user approves.
 */
class CocapnTerminal {
    _terminal;
    suggestCommand(command, description) {
        const detail = description || command;
        vscode.window.showInformationMessage(`Cocapn suggests: ${detail}`, 'Run in terminal', 'Copy', 'Dismiss').then((choice) => {
            if (choice === 'Run in terminal') {
                this._runInTerminal(command);
            }
            else if (choice === 'Copy') {
                vscode.env.clipboard.writeText(command);
                vscode.window.showInformationMessage('Command copied to clipboard');
            }
        });
    }
    _runInTerminal(command) {
        if (!this._terminal || this._terminal.exitStatus !== undefined) {
            this._terminal = vscode.window.createTerminal('Cocapn');
        }
        this._terminal.show();
        this._terminal.sendText(command);
    }
    dispose() {
        this._terminal?.dispose();
    }
}
exports.CocapnTerminal = CocapnTerminal;
//# sourceMappingURL=terminal.js.map