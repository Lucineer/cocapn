# Skins & Domains

A **skin** is a CSS variable override file that gives your Cocapn instance its visual identity. Each supported domain ships with a default skin, and you can install community skins or create your own.

## Built-in domain skins

| Domain | Skin id | Aesthetic | Focus |
|--------|---------|-----------|-------|
| makerlog.ai | `maker` | Dark green terminal | Building, shipping |
| studylog.ai | `study` | Warm amber, serif | Learning, notes |
| activelog.ai | `active` | High-contrast blue | Fitness, habits |
| lifelog.ai | `life` | Soft lavender | Journaling, reflection |

## Skin file format

Skins live in `skin/` of your **public repo**:

```
skin/
└── makerlog/
    ├── theme.css      # CSS custom properties
    └── layout.json    # Panel layout configuration (optional)
```

### theme.css

```css
/* skin/makerlog/theme.css */
:root {
  /* Color palette */
  --color-primary:       #00ff88;   /* Accent, links, active states */
  --color-primary-dim:   #00cc6a;   /* Hover states */
  --color-bg:            #0a0a0a;   /* Page background */
  --color-surface:       #111111;   /* Cards, panels */
  --color-surface-raised:#1a1a1a;   /* Modals, dropdowns */
  --color-border:        #222222;   /* Borders, dividers */
  --color-text:          #e0e0e0;   /* Body text */
  --color-text-muted:    #666666;   /* Secondary / placeholder text */
  --color-error:         #ff4444;   /* Error states */
  --color-warning:       #ffaa00;   /* Warning states */
  --color-success:       #00ff88;   /* Success states */

  /* Typography */
  --font-display:  'Inter', system-ui, sans-serif;
  --font-mono:     'JetBrains Mono', 'Fira Code', monospace;
  --font-size-sm:  0.875rem;
  --font-size-base:1rem;
  --font-size-lg:  1.125rem;
  --line-height:   1.6;

  /* Layout */
  --border-radius-sm: 4px;
  --border-radius:    8px;
  --border-radius-lg: 12px;
  --sidebar-width:    260px;
  --terminal-bg:      #050505;
}
```

### layout.json

```json
{
  "sidebar": {
    "show": true,
    "sections": ["agents", "wiki", "tasks", "modules"]
  },
  "main": {
    "default": "terminal"
  },
  "terminal": {
    "fontFamily": "JetBrains Mono",
    "fontSize": 14,
    "cursorStyle": "block"
  }
}
```

## Creating a custom skin

1. Create `skin/<your-skin-name>/theme.css` in your public repo
2. Override whatever variables you want (unset variables inherit the domain default)
3. Commit and push — GitHub Pages rebuilds automatically
4. Tell the bridge which skin to use in `cocapn.yml` of your public repo:

```yaml
# cocapn.yml
skin: my-custom-skin
```

## Installing a community skin module

```bash
cocapn-bridge module add https://github.com/someone/cocapn-skin-cyberpunk
# or from chat: "install skin cyberpunk"
```

Skin modules copy their CSS into `skin/<name>/` in your public repo and set `skin:` in `cocapn.yml`.

## Writing a skin module

```
my-skin/
├── module.yml
└── theme.css
```

```yaml
# module.yml
name: my-skin
version: 1.0.0
type: skin
description: A high-contrast accessible skin
cocapnVersion: ">=0.1.0"
```

```css
/* theme.css — will be copied to skin/my-skin/theme.css */
:root {
  --color-primary: #ff6b35;
  --color-bg: #1a1a2e;
  /* ... */
}
```

The module installer copies `theme.css` to `skin/<name>/theme.css` in the public repo and updates `cocapn.yml` to activate it.

## Domain setup

### Using a built-in domain (e.g. makerlog.ai)

The `cocapn init` wizard handles this. Your subdomain is `<username>.makerlog.ai`, using the shared wildcard DNS record.

### Using a custom domain

1. Set `domain: yourdomain.com` during `cocapn init` or edit `cocapn.yml`
2. Edit `CNAME` in your public repo to `yourdomain.com`
3. Add a DNS CNAME record: `yourdomain.com → <username>.github.io`
4. Enable "Enforce HTTPS" in GitHub Pages settings
5. For A2A fleet verification, the bridge checks a `_cocapn` CNAME record:
   - Add: `_cocapn.yourdomain.com → fleet.cocapn.io`
   - This proves you control the domain and enables cross-domain agent routing

### Domain verification for fleet auth

When another bridge tries to route an A2A message to your domain, it verifies:
1. DNS `CNAME _cocapn.<domain>` resolves to one of the accepted fleet suffixes
2. A valid fleet JWT signed with the shared fleet key accompanies the request

See [Fleet configuration](fleet.md) for details.
