# Security Model

> Your data is in Git. You own it completely.

Cocapn is designed so that you never have to trust a third party with your secrets. The bridge runs on your machine. Secrets are encrypted before they reach Git. Agents run in isolated environments.

## Threat model

What Cocapn protects against:

| Threat | Mitigation |
|--------|-----------|
| Secret leaked into Git history | age encryption at rest; `.gitignore` for plaintext files |
| Agent exfiltrating host credentials | `filterEnv` strips all `*_KEY`, `*_TOKEN`, `*_SECRET` vars from agent subprocesses |
| Malicious module reading host secrets | Module sandbox: only `COCAPN_*` + module-specific env; write access limited to allowed dirs |
| Forged WebSocket messages | GitHub PAT verified against `api.github.com/user`; fleet JWTs with HMAC-SHA256 |
| Timing attacks on JWT verification | `timingSafeEqual` from `node:crypto` |
| A2A spoofing from untrusted domains | DNS CNAME verification (`_cocapn.<domain>`) before routing |
| Log leaking secrets | `maskSecrets()` applied to all command strings and detail fields in audit.log |

What Cocapn does **not** protect against:
- A compromised local machine (root access can read any process env or memory)
- A malicious git remote (only push to repos you control)
- Browser-side XSS (standard Content Security Policy applies)

## Secrets at rest

### age encryption

Secrets are encrypted using [age](https://age-encryption.org/) (Actually Good Encryption). The `age-encryption` npm package provides a WebAssembly implementation — no native binaries required.

```
plaintext "ANTHROPIC_API_KEY=sk-ant-…\n"
     ↓ age.Encrypter.encrypt(recipient)
ciphertext → secrets/ANTHROPIC_API_KEY.age  (committed to private repo)
```

The age recipient (public key) lives in `cocapn/age-recipients.txt` (safe to commit). The identity (private key) never touches the repo.

### Identity key storage

Priority order:
1. **OS keychain** via `keytar` (macOS Keychain, GNOME Keyring, Windows Credential Manager) — service `cocapn`, account `age-identity`
2. **File fallback**: `~/.config/cocapn/identity.age` with mode `0600`

The identity file is outside the git repo in both cases.

### Key rotation

```bash
cocapn-bridge secret rotate
```

This:
1. Decrypts all `secrets/*.age` files with the current identity
2. Generates a new age keypair
3. Re-encrypts all secrets with the new public key
4. Updates `cocapn/age-recipients.txt`
5. Stores the new identity in the keychain

**Back up your identity key.** If you lose it, you cannot decrypt your secrets. Export it:

```bash
# From keychain to a file (store in password manager)
security find-generic-password -s cocapn -a age-identity -w  # macOS
```

## GitHub token security

GitHub PATs are stored in the OS keychain only — never in files, never in env vars that persist beyond the bridge process lifetime.

Token classification:
- `ghp_*` — classic PAT (broad scopes)
- `github_pat_*` — fine-grained PAT (repository-scoped, preferred)
- `gho_*` — OAuth token

```bash
# Store securely in OS keychain
cocapn-bridge token set

# Verify scopes (checks api.github.com)
cocapn-bridge token verify
```

For the bridge to function, the PAT needs: `repo` (read/write private repos), `read:user` (auth).

Fine-grained PATs can be scoped to your two repos only — recommended.

## Agent sandboxing

### Environment filtering

`filterEnv` is called for every agent spawn. The agent subprocess receives:

**Allowed:**
- `COCAPN_*` — all Cocapn project variables (soul, repo root, agent id, secrets you explicitly inject)
- `PATH`, `HOME`, `USER`, `LOGNAME`, `SHELL` — basic system identity
- `TMPDIR`, `TEMP`, `TMP` — temp directory
- `TERM`, `COLORTERM` — terminal capabilities
- `LANG`, `LC_ALL`, `LC_CTYPE`, `TZ` — locale and timezone
- `NODE_PATH`, `NODE_ENV`, `npm_config_cache` — Node.js runtime

**Blocked (examples):**
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`
- `GITHUB_TOKEN`, `GH_TOKEN`, `GITHUB_PAT`
- Any variable matching `*SECRET*`, `*PASSWORD*`, `*CREDENTIAL*`

### Module write sandbox

Module hooks run with `COCAPN_ALLOWED_WRITE_DIRS` set to the allowed paths. The module manager validates all write paths before executing install/update/enable/disable operations.

Allowed write targets for modules:
- `modules/<name>/` — the module's own directory
- `wiki/` — knowledge base
- `tasks/` — task files
- `cocapn/memory/` — agent memory
- `cocapn/agents/` — agent definitions (for `agent`-type modules)
- `skin/` — CSS themes (for `skin`-type modules)

## Audit logging

Every sensitive action is appended to `cocapn/audit.log` as newline-delimited JSON:

```json
{"ts":"2025-01-15T10:30:00.000Z","action":"bash.exec","agent":"claude","user":"alice","command":"ls -la","result":"ok","durationMs":45}
{"ts":"2025-01-15T10:30:01.000Z","action":"secret.get","agent":undefined,"user":"alice","result":"ok","durationMs":2}
{"ts":"2025-01-15T10:30:05.000Z","action":"auth.connect","agent":undefined,"user":"alice","result":"ok","durationMs":120}
```

Secret values are masked before writing:
- `API_KEY=hunter2` → `API_KEY=***`
- `Bearer <token>` → `Bearer ***`
- `AGE-SECRET-KEY-1…` → `AGE-SECRET-KEY-1***`
- `ghp_<token>` → `ghp_***`

The log is never encrypted (so it can be inspected without the identity key) and is append-only (the logger never reads or overwrites existing entries).

Audited actions: `agent.spawn`, `agent.stop`, `agent.chat`, `agent.tool_call`, `bash.exec`, `file.edit`, `file.commit`, `secret.init`, `secret.add`, `secret.get`, `secret.rotate`, `token.set`, `token.verify`, `module.install`, `module.remove`, `module.update`, `module.enable`, `module.disable`, `auth.connect`, `auth.reject`, `a2a.route`, `a2a.domain_verify`.

## WebSocket authentication

Every WebSocket connection must authenticate before receiving any data. Two auth methods are supported:

### GitHub PAT

```
Client → { "type": "AUTH", "token": "github_pat_..." }
Bridge → GET https://api.github.com/user (Authorization: Bearer <token>)
Bridge → { "type": "AUTH_OK", "user": "alice" }  (or AUTH_FAIL)
```

The GitHub API response is cached per-connection. The token is never stored on disk.

### Fleet JWT

```
Client → { "type": "AUTH", "token": "eyJ..." }
Bridge → verifyJwt(token, fleetKey)  — HMAC-SHA256, checks exp + iss
Bridge → { "type": "AUTH_OK", "user": "bridge-<id>" }
```

Fleet JWTs are issued by `FleetKeyManager.signToken()` and expire after 1 hour. The fleet key is loaded from `secrets/fleet-key.age` at bridge startup.

## Reporting security issues

Open a GitHub issue marked `security` or email the maintainer directly. Do not post plaintext exploit details publicly.
