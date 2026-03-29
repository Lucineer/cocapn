# cocapn

[![npm version](https://img.shields.io/npm/v/cocapn.svg)](https://www.npmjs.com/package/cocapn)
[![MIT license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Cocapn** — The self-hosted AI agent runtime by Superinstance.

Manage AI agents with persistent Git-backed memory, module system, and fleet communication — all running locally with optional cloud enhancement.

## Install

```bash
npm install -g cocapn
```

Or use with npx:

```bash
npx cocapn <command>
```

## Commands

### Core

```bash
cocapn init [dir]           # Initialize a cocapn project
cocapn start                # Start the bridge
cocapn status               # Show bridge status
cocapn deploy               # Deploy to Cloudflare Workers
cocapn version              # Show version
```

### Skills

```bash
cocapn skill list           # List available skills
cocapn skill load <name>    # Load a skill
cocapn skill unload <name>  # Unload a skill
```

### Templates

```bash
cocapn template search <q>  # Search template registry
cocapn template install <n> # Install a template
cocapn template publish     # Publish current directory
```

### Analysis & Monitoring

```bash
cocapn tree <task>          # Start tree search for a task
cocapn graph                # Show knowledge graph stats
cocapn tokens               # Show token usage stats
cocapn health               # Health check (local + cloud)
```

## Quick Start

```bash
# Create a new project
npx create-cocapn my-cocapn
cd my-cocapn

# Or initialize in an existing repo
cocapn init .

# Start the bridge
cocapn start
```

## Options

Bridge commands accept these options:

- `-H, --host <host>`: Bridge host (default: localhost)
- `-p, --port <port>`: Bridge port (default: 3100)
- `-t, --token <token>`: Auth token

## License

MIT
