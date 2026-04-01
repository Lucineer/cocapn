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
exports.CocapnSidebar = void 0;
const vscode = __importStar(require("vscode"));
class CocapnSidebar {
    static viewType = 'cocapn.chatView';
    _view;
    _serverUrl;
    _extensionUri;
    _messages = [];
    constructor(extensionUri, serverUrl) {
        this._extensionUri = extensionUri;
        this._serverUrl = serverUrl;
    }
    resolveWebviewView(webviewView, _context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };
        webviewView.webview.html = this._getHtml(webviewView.webview);
        webviewView.webview.onDidReceiveMessage(async (msg) => {
            if (msg.type === 'ready') {
                this._postMessage({ type: 'status', text: `Connected to ${this._serverUrl}` });
                // Replay history
                for (const m of this._messages) {
                    this._postMessage({ type: m.role === 'user' ? 'user-message' : 'agent-reply', text: m.text });
                }
                return;
            }
            if (msg.type === 'chat') {
                this._messages.push({ role: 'user', text: msg.text });
                await this._handleChat(msg.text);
            }
        });
    }
    show() {
        this._view?.show?.(true);
    }
    async sendWithContext(prompt, contextText, fileName) {
        this.show();
        const fullPrompt = `[File: ${fileName}]\n${contextText}\n\n${prompt}`;
        this._messages.push({ role: 'user', text: prompt });
        this._postMessage({ type: 'user-message', text: `${prompt} (${fileName})` });
        await this._handleChat(fullPrompt);
    }
    async sendMessage(text) {
        this.show();
        this._messages.push({ role: 'user', text });
        this._postMessage({ type: 'user-message', text });
        await this._handleChat(text);
    }
    async _handleChat(text) {
        this._postMessage({ type: 'typing', text: '...' });
        try {
            const config = vscode.workspace.getConfiguration('cocapn');
            const apiKey = config.get('apiKey', '');
            const headers = { 'Content-Type': 'application/json' };
            if (apiKey) {
                headers['Authorization'] = `Bearer ${apiKey}`;
            }
            const resp = await fetch(`${this._serverUrl}/api/chat`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ message: text }),
            });
            if (!resp.ok) {
                const errText = await resp.text().catch(() => 'Unknown error');
                this._postMessage({ type: 'agent-reply', text: `Bridge error (${resp.status}): ${errText}` });
                return;
            }
            // Try streaming (NDJSON) first, fall back to regular JSON
            const contentType = resp.headers.get('content-type') || '';
            if (contentType.includes('text/event-stream') || contentType.includes('application/x-ndjson')) {
                let fullText = '';
                const reader = resp.body?.getReader();
                if (reader) {
                    const decoder = new TextDecoder();
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) {
                            break;
                        }
                        const chunk = decoder.decode(value, { stream: true });
                        for (const line of chunk.split('\n')) {
                            if (!line.trim()) {
                                continue;
                            }
                            try {
                                const parsed = JSON.parse(line);
                                if (parsed.text) {
                                    fullText += parsed.text;
                                    this._postMessage({ type: 'stream', text: fullText });
                                }
                                else if (parsed.reply) {
                                    fullText = parsed.reply;
                                    this._postMessage({ type: 'stream', text: fullText });
                                }
                            }
                            catch {
                                // Non-JSON chunk, append as text
                                fullText += line;
                                this._postMessage({ type: 'stream', text: fullText });
                            }
                        }
                    }
                    this._postMessage({ type: 'agent-reply', text: fullText });
                    this._messages.push({ role: 'agent', text: fullText });
                }
            }
            else {
                const data = await resp.json();
                const reply = data.reply || data.text || data.message || JSON.stringify(data);
                this._messages.push({ role: 'agent', text: reply });
                this._postMessage({ type: 'agent-reply', text: reply });
            }
        }
        catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            this._postMessage({ type: 'agent-reply', text: `Connection failed: ${errMsg}. Is cocapn running at ${this._serverUrl}?` });
        }
    }
    _postMessage(msg) {
        this._view?.webview.postMessage(msg);
    }
    _getHtml(webview) {
        const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'sidebar.css'));
        return /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="${cssUri}" />
</head>
<body>
  <div id="header">
    <div id="agent-info">
      <span id="agent-name">cocapn</span>
      <span id="agent-status" class="status-dot"></span>
    </div>
  </div>
  <div id="messages"></div>
  <div id="input-bar">
    <textarea id="input" rows="1" placeholder="Ask your agent..." autofocus></textarea>
    <button id="send" title="Send message">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M1 8l14-6-5 6 5 6z"/>
      </svg>
    </button>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    const messagesEl = document.getElementById('messages');
    const inputEl = document.getElementById('input');
    const sendEl = document.getElementById('send');
    const statusEl = document.getElementById('agent-status');
    const nameEl = document.getElementById('agent-name');
    let streamingEl = null;

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function formatCode(text) {
      // Basic markdown: code blocks
      let html = escapeHtml(text);
      html = html.replace(/\`\`\`(\\w*)\\n([\\s\\S]*?)\`\`\`/g, '<pre><code>$2</code></pre>');
      html = html.replace(/\`([^\`]+)\`/g, '<code class="inline">$1</code>');
      // Bold
      html = html.replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>');
      // Newlines
      html = html.replace(/\\n/g, '<br/>');
      return html;
    }

    function appendMessage(role, text) {
      const div = document.createElement('div');
      div.className = 'msg ' + role;
      div.innerHTML = role === 'user' ? escapeHtml(text) : formatCode(text);
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return div;
    }

    function setStatus(connected) {
      statusEl.className = 'status-dot ' + (connected ? 'connected' : 'disconnected');
    }

    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });
    sendEl.addEventListener('click', send);

    function send() {
      const text = inputEl.value.trim();
      if (!text) { return; }
      appendMessage('user', text);
      inputEl.value = '';
      inputEl.style.height = 'auto';
      vscode.postMessage({ type: 'chat', text });
    }

    // Auto-resize textarea
    inputEl.addEventListener('input', () => {
      inputEl.style.height = 'auto';
      inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
    });

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.type === 'user-message') {
        appendMessage('user', msg.text);
      } else if (msg.type === 'agent-reply') {
        if (streamingEl) { streamingEl.remove(); streamingEl = null; }
        appendMessage('agent', msg.text);
      } else if (msg.type === 'stream') {
        if (!streamingEl) {
          streamingEl = document.createElement('div');
          streamingEl.className = 'msg agent streaming';
          messagesEl.appendChild(streamingEl);
        }
        streamingEl.innerHTML = formatCode(msg.text);
        messagesEl.scrollTop = messagesEl.scrollHeight;
      } else if (msg.type === 'typing') {
        if (streamingEl) { streamingEl.remove(); }
        streamingEl = document.createElement('div');
        streamingEl.className = 'msg agent typing';
        streamingEl.textContent = '...';
        messagesEl.appendChild(streamingEl);
        messagesEl.scrollTop = messagesEl.scrollHeight;
      } else if (msg.type === 'status') {
        setStatus(true);
      } else if (msg.type === 'system') {
        appendMessage('system', msg.text);
      }
    });

    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
    }
}
exports.CocapnSidebar = CocapnSidebar;
//# sourceMappingURL=sidebar.js.map