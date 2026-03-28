# Troubleshooting

## Bridge won't start

### `Repo path does not exist`

```
[bridge] Repo path does not exist: /path/to/repo
```

The path passed to `--repo` doesn't exist. Check the path, or run `cocapn-bridge init` first.

### `Failed to parse cocapn/config.yml`

Your config file has a YAML syntax error. Validate it:

```bash
node -e "const {parse}=require('yaml'); parse(require('fs').readFileSync('cocapn/config.yml','utf8'))"
```

### Port already in use

```
Error: listen EADDRINUSE: address already in use :::8787
```

Another bridge is running, or the port is taken. Use a different port:

```bash
cocapn-bridge --repo ~/brain --port 8788
```

Or kill the existing process:

```bash
lsof -ti:8787 | xargs kill
```

---

## Secret / encryption issues

### `age identity not found — call loadIdentity() first`

The bridge started before the age identity was loaded. This usually means `secret init` was never run:

```bash
cocapn-bridge secret init
```

If you migrated from another machine, you need to either import your old identity key or rotate:

```bash
# Option A: import existing identity
cat your-backup-identity.age > ~/.config/cocapn/identity.age
chmod 0600 ~/.config/cocapn/identity.age

# Option B: generate new key and re-encrypt
cocapn-bridge secret init
cocapn-bridge secret rotate
```

### `Cannot decrypt: no recipients matched`

The secret was encrypted for a different age public key. This happens when you rotate keys without running `secret rotate` first (e.g. manually replacing `identity.age`). Fix: restore the old identity key and run `secret rotate`.

### `keytar` unavailable (Linux without libsecret)

If keytar fails to load, the bridge falls back to `~/.config/cocapn/identity.age`. To install libsecret on Debian/Ubuntu:

```bash
sudo apt install libsecret-1-dev
npm rebuild keytar
```

Or on systems without a keychain daemon (e.g. headless servers), the file fallback works without any extra steps.

---

## WebSocket / authentication issues

### Browser shows "Disconnected"

1. Check the bridge is running: `ps aux | grep cocapn-bridge`
2. Check the port: `curl -i http://localhost:8787` (should get a 426 Upgrade Required)
3. Check the browser console for WebSocket errors
4. Verify the bridge URL in `cocapn.yml` matches what the UI uses

### `AUTH_FAIL` — Invalid token

- **GitHub PAT**: check the token has `repo` and `read:user` scopes. Test it: `curl -H "Authorization: Bearer <token>" https://api.github.com/user`
- **Fine-grained PAT**: must be scoped to your private and public repos, not just one of them
- **Fleet JWT**: token may be expired (1 hour TTL). The bridge or client should re-issue it.

### `AUTH_FAIL` — rate limited

GitHub's `/user` endpoint allows ~5000 requests/hour per token. If you're hitting this, check whether something is creating many connections. The bridge caches the auth result per connection.

---

## Git sync issues

### `Merge conflicts written to: …`

The bridge detected a conflict between local and remote changes. The conflict markers are written to the files. Resolve them:

```bash
cd ~/brain
git status          # see conflicting files
# Edit files, resolve <<< === >>> markers
git add -A
git commit -m "resolve conflict"
```

### `[git] Error: remote: Permission denied`

Your SSH key or PAT doesn't have write access to the private repo. Check:

```bash
ssh -T git@github.com      # should say "Hi username!"
git remote -v              # verify the remote URL
```

### Bridge is not auto-committing

Check `sync.autoCommit` in `cocapn/config.yml`:

```yaml
sync:
  autoCommit: true
  autoPush: true
  interval: 30
```

Also check `cocapn/audit.log` for `file.commit` entries — if they're absent, the watcher may not be detecting changes. Try touching a file to trigger a change event.

---

## Module issues

### `Hook failed: exit code 1`

The module's install/enable hook exited with an error. Check:

```bash
# Run the hook manually to see output
COCAPN_REPO_ROOT="$(pwd)" \
COCAPN_MODULE_DIR="modules/habit-tracker" \
node modules/habit-tracker/hooks/install.js
```

### `Version requirement not met`

```
Module requires cocapn >=0.2.0 but current version is 0.1.0
```

Update the bridge:

```bash
npm update -g cocapn-bridge
```

Or, if you're developing the module, lower the `cocapnVersion` requirement in `module.yml`.

### Module write blocked (sandbox violation)

```
[sandbox] Blocked write to /path/outside/allowed: /etc/passwd
```

The module tried to write outside its allowed directories. This is a bug in the module — report it to the module author. The bridge will continue running but the hook will fail.

---

## Agent issues

### Agent never responds

1. Check the audit log: `tail -f cocapn/audit.log | jq .`
2. Look for `agent.spawn` followed by `agent.stop` immediately — this means the process crashed
3. Test the agent CLI directly:
   ```bash
   echo '[{"role":"user","content":"Hello"}]' | COCAPN_SOUL="Test" claude --print
   ```
4. Check that `claude` (or `pi`) is in your PATH: `which claude`

### `COCAPN_SOUL is empty`

The soul file wasn't found. Check:

```bash
ls cocapn/soul.md        # must exist in your private repo
cat cocapn/config.yml    # soul.path should match
```

### Agent output not streaming

The bridge streams output as `STREAM_CHUNK` messages. If your UI shows nothing:

1. Check WebSocket messages in browser DevTools (Network → WS)
2. Look for `STREAM_CHUNK` frames — if absent, the agent isn't writing to stdout
3. Some agents buffer stdout; try `process.stdout.write(...)` instead of `console.log`

---

## Cloudflare tunnel issues

### `cloudflared not found`

Install cloudflared:

```bash
# macOS
brew install cloudflare/cloudflare/cloudflared

# Linux
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
  -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared
```

### Tunnel URL changes on restart

The free `--url` mode generates a random subdomain each time. To get a stable tunnel URL, create a named tunnel with a Cloudflare account:

```bash
cloudflared tunnel login
cloudflared tunnel create cocapn
cloudflared tunnel route dns cocapn bridge.yourdomain.com
```

Then start the bridge with `--tunnel` (the bridge will use the named tunnel config if `~/.cloudflared/config.yml` exists).

---

## Getting more help

- Check `cocapn/audit.log` — it records every action with timestamps and results
- Start the bridge with `DEBUG=* cocapn-bridge --repo ~/brain` for verbose logging
- Open an issue on GitHub with the relevant audit log entries (redact any sensitive values)
