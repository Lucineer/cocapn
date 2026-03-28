# cocapn-ui — React SPA

The UI is a React 18 single-page application served from GitHub Pages at your domain (e.g. `you.makerlog.ai`). It connects to the local bridge via WebSocket and is skinned per domain.

## Development

```bash
cd packages/ui
npm install
npm run dev        # Vite dev server at http://localhost:5173
npm run build      # Production build → dist/
npm run preview    # Preview production build
```

## Domain Skinning

Each supported domain has a skin that sets the color palette, typography, and default soul prompt:

| Domain | Skin | Focus |
|--------|------|-------|
| makerlog.ai | maker | Building, shipping, maker culture |
| studylog.ai | study | Learning, notes, spaced repetition |
| activelog.ai | active | Fitness, habits, health tracking |
| lifelog.ai | life | Journaling, reflection, life logging |

Skins are CSS variable overrides loaded from `skin/variables.css` in your public repo. Install a custom skin with `cocapn-bridge module add <skin-module-url>`.

### Skin CSS format

```css
/* skin/variables.css */
:root {
  --color-primary: #6366f1;
  --color-bg: #0f0f13;
  --color-surface: #1a1a24;
  --color-text: #e2e8f0;
  --font-display: 'Inter', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --border-radius: 8px;
}
```

## Environment Variables

```env
VITE_BRIDGE_URL=ws://localhost:8787   # WebSocket bridge URL
VITE_DOMAIN=makerlog.ai               # Active domain skin
VITE_SKIN=maker                       # Explicit skin override
```

For production (GitHub Pages), these are embedded at build time via `vite.config.ts`.

## Components

```
src/
├── App.tsx              # Root — connects to bridge, dispatches routes
├── components/
│   ├── Terminal.tsx     # xterm.js terminal for agent output
│   ├── Chat.tsx         # Conversation UI
│   ├── Wiki.tsx         # Markdown wiki viewer/editor
│   ├── Tasks.tsx        # Task list (kanban)
│   └── Fleet.tsx        # Agent status dashboard
├── hooks/
│   ├── useBridge.ts     # WebSocket connection + message dispatch
│   └── useAuth.ts       # GitHub PAT / JWT auth flow
├── skin/
│   ├── themes.ts        # Domain → skin mapping
│   └── loader.ts        # Dynamic CSS variable injection
└── main.tsx
```

## Deployment (GitHub Pages)

Your public repo is pre-configured for GitHub Pages via a GitHub Actions workflow:

```bash
# Build and push to gh-pages branch
cd packages/ui
npm run build
git subtree push --prefix=dist origin gh-pages
```

Or let the GitHub Actions workflow handle it on every push to `main`.

## Offline Support

The UI includes a service worker that caches the shell (App + navigation) so it loads instantly even without a bridge connection. When the bridge is unreachable, a "Disconnected — bridge offline" banner shows and the wiki/tasks remain readable from cache.
