# **VIBE CRAFT** Architecture

## **1. Core Architecture Principles**

```
"Zero-deps core, BYOK everything, plugins as files, agents over HTTP"
```

## **2. Directory Structure**

```
vibecraft/
├── core/                    # Zero-dependency core
│   ├── loader.js           # Plugin loader
│   ├── agent-bus.js        # Agent communication
│   ├── asset-engine.js     # Asset generation pipeline
│   └── vibe-parser.js      # Natural language to AST
├── plugins/                # Copy-paste plugins
│   ├── agents/
│   │   ├── makerlog.js
│   │   ├── fishinglog.js
│   │   └── businesslog.js
│   ├── generators/
│   │   ├── snes-sprite.js
│   │   └── photoreal.js
│   └── research/
│       └── auto-research.js
├── config/
│   ├── keys.json           # BYOK storage (encrypted)
│   └── styles.json         # Art style definitions
├── assets/
│   ├── generated/          # Auto-generated assets
│   └── cache/             # Cached API responses
├── runs/                   # Vibe coding sessions
│   └── {timestamp}-{project}/
│       ├── spec.md         # Natural language spec
│       ├── ast.json        # Parsed structure
│       └── output/         # Generated app
├── crontabs/              # Background jobs
│   └── research-job.js
└── glue/                  # Agent communication layer
    └── http-bridge.js
```

## **3. Plugin Architecture**

### **Plugin Loader (`core/loader.js`)**
```javascript
// File-based plugin discovery
class PluginLoader {
  constructor(pluginPath) {
    this.plugins = new Map();
    this.scan(pluginPath);
  }
  
  scan(path) {
    // Read directory, find .js files, validate signature
    const files = fs.readdirSync(path);
    
    for (const file of files) {
      if (file.endsWith('.js')) {
        const plugin = require(path + '/' + file);
        if (this.validatePlugin(plugin)) {
          this.plugins.set(plugin.metadata.name, plugin);
        }
      }
    }
  }
  
  validatePlugin(plugin) {
    // Must export: metadata, init, handle
    return plugin.metadata && 
           plugin.init && 
           plugin.handle &&
           plugin.metadata.apiVersion === '1.0';
  }
}
```

### **Plugin Interface**
```javascript
// agents/makerlog.js
module.exports = {
  metadata: {
    name: 'makerlog',
    version: '1.0',
    apiVersion: '1.0',
    capabilities: ['log_creation', 'asset_generation'],
    endpoints: ['/api/makerlog']
  },
  
  // BYOK initialization
  init: async (keys) => {
    this.openai = new OpenAIApi(keys.openai);
    this.stability = new StabilityAPI(keys.stability);
  },
  
  // Message handler
  handle: async (message) => {
    switch (message.type) {
      case 'generate_asset':
        return await this.generateAsset(message.data);
      case 'log_entry':
        return await this.createLogEntry(message.data);
    }
  },
  
  // Plugin-specific methods
  generateAsset: async (spec) => {
    // Use asset engine
    return await AssetEngine.generate(spec, {
      style: 'snes',
      resolution: '64x64'
    });
  }
};
```

## **4. Agent-to-Agent Protocol**

### **Message Format**
```javascript
// Standard message envelope
{
  id: "msg_abc123",
  timestamp: 1625097600000,
  from: "makerlog",
  to: "businesslog",
  type: "asset_generated",
  data: {
    asset_id: "asset_123",
    url: "https://...",
    metadata: {...}
  },
  responseTo: "msg_prev123", // Optional for replies
  auth: {
    token: "agent_token_abc", // Signed JWT
    signature: "sig_base64"
  }
}
```

### **HTTP Bridge (`glue/http-bridge.js`)**
```javascript
class AgentHTTPBridge {
  constructor() {
    this.agentRegistry = new Map(); // name -> endpoint
  }
  
  // Register agent endpoint
  registerAgent(name, endpoint) {
    this.agentRegistry.set(name, endpoint);
  }
  
  // Send message to any agent
  async send(message) {
    const endpoint = this.agentRegistry.get(message.to);
    if (!endpoint) throw new Error(`Agent ${message.to} not found`);
    
    // Sign message
    message.auth = this.signMessage(message);
    
    const response = await fetch(endpoint + '/agent-message', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(message)
    });
    
    return await response.json();
  }
  
  // Localhost discovery
  async discoverLocalAgents() {
    // Try ports 3000-3010 for /agent/status
    for (let port = 3000; port <= 3010; port++) {
      try {
        const res = await fetch(`http://localhost:${port}/agent/status`);
        const info = await res.json();
        this.registerAgent(info.name, `http://localhost:${port}`);
      } catch (e) { continue; }
    }
  }
}
```

## **5. Asset Pipeline**

### **Style Configuration (`config/styles.json`)**
```json
{
  "snes": {
    "palette": "16-color",
    "resolution": ["64x64", "128x128"],
    "generator": "plugins/generators/snes-sprite.js",
    "parameters": {
      "pixel_art": true,
      "dithering": "floyd-steinberg"
    }
  },
  "photoreal": {
    "palette": "full",
    "resolution": ["512x512", "1024x1024", "4K"],
    "generator": "plugins/generators/photoreal.js",
    "parameters": {
      "engine": "stable-diffusion-xl",
      "steps": 50
    }
  },
  "ukiyoe": {
    "palette": "woodblock",
    "resolution": ["512x768"],
    "generator": "plugins/generators/ukiyoe.js",
    "artists": ["Hokusai", "Hiroshige"]
  }
}
```

### **Asset Engine (`core/asset-engine.js`)**
```javascript
class AssetEngine {
  static styles = require('../config/styles.json');
  
  static async generate(spec, options) {
    const style = this.styles[options.style];
    
    // Load appropriate generator
    const generator = require(path.join(__dirname, '..', style.generator));
    
    // Apply style parameters
    const params = {
      ...spec,
      ...style.parameters,
      resolution: options.resolution,
      apiKey: Keys.get('openai') // BYOK
    };
    
    // Generate
    const result = await generator.generate(params);
    
    // Cache
    await this.cacheAsset(result);
    
    return {