# GitHub Action — Run Cocapn Agent on Push

Clone your repo, push to main, and your cocapn agent runs automatically. No server required.

## Quick Start

Add this to your cocapn-powered repo (`.github/workflows/cocapn.yml`):

```yaml
name: Cocapn Agent
on:
  push:
    branches: [main]
  schedule:
    - cron: '0 */6 * * *'  # every 6 hours

jobs:
  agent:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Install cocapn CLI
        run: npm install -g cocapn
      - name: Run agent
        run: cocapn start --mode private &
      - name: Validate
        run: cocapn status --json
```

## Using the Action

The `action.yml` at the repo root provides a reusable action with inputs and outputs:

```yaml
jobs:
  agent:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: ./              # uses the action.yml in your repo
        with:
          config-path: cocapn/config.yml
          mode: private
          test: 'true'
          deploy: 'false'
```

### Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `config-path` | Path to cocapn config | `cocapn/config.yml` |
| `mode` | Agent mode: `private`, `public`, `maintenance` | `private` |
| `test` | Run tests after validation | `true` |
| `deploy` | Deploy after validation passes | `false` |
| `working-directory` | Working directory for the agent | `.` |
| `health-timeout` | Seconds to wait for health check | `30` |

### Outputs

| Output | Description |
|--------|-------------|
| `status` | Agent status: `healthy`, `degraded`, or `offline` |
| `brain-facts` | Number of facts in the brain |
| `brain-memories` | Number of memories in the brain |
| `brain-wiki` | Number of wiki pages |
| `test-results` | Test results: `pass`, `fail`, or `skipped` |

## Secrets Configuration

Your cocapn agent needs API keys to talk to LLM providers. Set these as GitHub Secrets:

**Settings → Secrets and variables → Actions → New repository secret**

| Secret | Description | Required |
|--------|-------------|----------|
| `DEEPSEEK_API_KEY` | DeepSeek API key | If using DeepSeek |
| `OPENAI_API_KEY` | OpenAI API key | If using OpenAI |
| `ANTHROPIC_API_KEY` | Anthropic API key | If using Anthropic |
| `COCAPN_FLEET_KEY` | Fleet coordination key | For multi-agent |

The action passes these to the agent via environment variables:

```yaml
- uses: ./
  with:
    mode: private
  env:
    DEEPSEEK_API_KEY: ${{ secrets.DEEPSEEK_API_KEY }}
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

## Example Workflows

### Minimal — just validate on push

```yaml
name: Validate Brain
on:
  push:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./
        with:
          test: 'false'
```

### Full — validate, test, and deploy

```yaml
name: Full Pipeline
on:
  push:
    branches: [main]

jobs:
  agent:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: ./
        with:
          mode: private
          test: 'true'
          deploy: 'true'
        env:
          DEEPSEEK_API_KEY: ${{ secrets.DEEPSEEK_API_KEY }}
```

### Scheduled — maintenance mode every 6 hours

```yaml
name: Maintenance
on:
  schedule:
    - cron: '0 */6 * * *'

jobs:
  maintenance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: ./
        with:
          mode: maintenance
          test: 'false'
```

### Use outputs in later steps

```yaml
jobs:
  agent:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - id: cocapn
        uses: ./
      - name: Check results
        run: |
          echo "Status: ${{ steps.cocapn.outputs.status }}"
          echo "Facts: ${{ steps.cocapn.outputs.brain-facts }}"
          echo "Memories: ${{ steps.cocapn.outputs.brain-memories }}"
          echo "Tests: ${{ steps.cocapn.outputs.test-results }}"

          if [ "${{ steps.cocapn.outputs.status }}" = "degraded" ]; then
            echo "::warning::Agent is in degraded state"
          fi
```

## What Happens on Each Run

1. **Checkout** — Full repo history (for RepoLearner)
2. **Install** — cocapn CLI from npm
3. **Start** — Agent runs in configured mode
4. **Health check** — Waits up to 30s for `localhost:3100/api/status`
5. **Brain validation** — Checks facts.json, memories.json, soul.md, wiki/
6. **Tests** — Runs `npm test` if enabled
7. **Deploy** — Runs `cocapn deploy` if enabled
8. **Report** — Sets outputs and GitHub Step Summary

## Status Values

| Status | Meaning |
|--------|---------|
| `healthy` | Agent started, health check passed, all brain files valid |
| `degraded` | Agent started but brain files are missing or malformed |
| `offline` | Agent did not start within timeout |

## Troubleshooting

**Agent won't start** — Make sure your `config.yml` is valid and all required API keys are set as secrets.

**Tests fail** — Run tests locally first: `cd packages/local-bridge && npx vitest run`

**Health check timeout** — Increase `health-timeout` input: `with: { health-timeout: '60' }`

**Permissions error** — The workflow needs `contents: read` permission (included by default).
