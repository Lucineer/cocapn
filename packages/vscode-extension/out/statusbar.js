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
exports.CocapnStatusBar = void 0;
const vscode = __importStar(require("vscode"));
class CocapnStatusBar extends vscode.Disposable {
    _statusBarItem;
    _serverUrl;
    _connected = false;
    _tokenCount = 0;
    constructor(serverUrl) {
        super(() => this.dispose());
        this._serverUrl = serverUrl;
        this._statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this._statusBarItem.command = 'cocapn.openChat';
        this._statusBarItem.name = 'Cocapn';
        this._update();
        this._statusBarItem.show();
    }
    async checkConnection() {
        try {
            const resp = await fetch(`${this._serverUrl}/api/status`, {
                signal: AbortSignal.timeout(3000),
            });
            if (resp.ok) {
                const data = await resp.json();
                this._connected = true;
                const name = data.agentName || 'cocapn';
                const memCount = data.memoryCount || 0;
                this._statusBarItem.text = `$(hubot) ${name} $(circle-filled) ${memCount} memories`;
                this._statusBarItem.tooltip = `Cocapn: Connected — ${name}\n${memCount} memory entries`;
            }
            else {
                this._setDisconnected();
            }
        }
        catch {
            this._setDisconnected();
        }
        this._update();
    }
    addTokens(count) {
        this._tokenCount += count;
        this._update();
    }
    setConnected(connected) {
        this._connected = connected;
        this._update();
    }
    _setDisconnected() {
        this._connected = false;
        this._statusBarItem.text = '$(hubot) cocapn $(circle-slash)';
        this._statusBarItem.tooltip = 'Cocapn: Disconnected — click to open chat';
    }
    _update() {
        this._statusBarItem.show();
    }
    dispose() {
        this._statusBarItem.dispose();
    }
}
exports.CocapnStatusBar = CocapnStatusBar;
//# sourceMappingURL=statusbar.js.map