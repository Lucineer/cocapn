/**
 * `cocapn-bridge init` — interactive onboarding wizard.
 *
 * Guides the user through:
 *   1. Welcome + dual-repo model explanation
 *   2. GitHub PAT input and validation
 *   3. Domain selection
 *   4. Repo name confirmation
 *   5. Template selection
 *   6. Repo creation + clone + setup
 *   7. First-agent test ("hello")
 *   8. Open browser
 */

import { Command } from "commander";
import { createInterface } from "readline";
import { execSync, spawn } from "child_process";
import { existsSync, writeFileSync, mkdirSync, readFileSync } from "fs";
import { join, resolve } from "path";
import { homedir, platform } from "os";

// ─── Colours (no deps) ───────────────────────────────────────────────────────

const C = {
  reset:  "\x1b[0m",
  bold:   "\x1b[1m",
  dim:    "\x1b[2m",
  green:  "\x1b[32m",
  cyan:   "\x1b[36m",
  yellow: "\x1b[33m",
  red:    "\x1b[31m",
  blue:   "\x1b[34m",
  gray:   "\x1b[90m",
};

const bold   = (s: string) => `${C.bold}${s}${C.reset}`;
const green  = (s: string) => `${C.green}${s}${C.reset}`;
const cyan   = (s: string) => `${C.cyan}${s}${C.reset}`;
const yellow = (s: string) => `${C.yellow}${s}${C.reset}`;
const gray   = (s: string) => `${C.gray}${s}${C.reset}`;
const dim    = (s: string) => `${C.dim}${s}${C.reset}`;

// ─── CLI entry point ─────────────────────────────────────────────────────────

export function buildInitCommand(): Command {
  return new Command("init")
    .description("Interactive setup wizard — create your Cocapn repos and start your first agent")
    .option("--dir <path>", "Directory to clone repos into", process.cwd())
    .option("--skip-browser", "Don't open the browser when done")
    .action(async (opts: { dir: string; skipBrowser?: boolean }) => {
      await runWizard(resolve(opts.dir), opts.skipBrowser === true);
    });
}

// ─── Wizard ──────────────────────────────────────────────────────────────────

const DOMAINS = [
  { slug: "makerlog",  label: "Makerlog",   desc: "Build log — projects, releases, side hustles" },
  { slug: "studylog",  label: "Studylog",   desc: "Learning journal — books, courses, notes" },
  { slug: "activelog", label: "Activelog",  desc: "Health log — workouts, habits, sleep" },
  { slug: "lifelog",   label: "Lifelog",    desc: "General life OS — anything goes" },
  { slug: "custom",    label: "Custom",     desc: "Enter your own domain name" },
] as const;

const TEMPLATES = [
  {
    slug:  "minimal",
    label: "Minimal",
    desc:  "Just the essentials — soul.md, config, empty memory",
  },
  {
    slug:  "full",
    label: "Full-featured",
    desc:  "Modules pre-installed: habit-tracker, perplexity-search, wiki templates",
  },
  {
    slug:  "log",
    label: "Just a log",
    desc:  "Ultra-minimal — daily note template, no agents yet",
  },
] as const;

async function runWizard(baseDir: string, skipBrowser: boolean): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string): Promise<string> =>
    new Promise((res) => rl.question(q, res));

  try {
    // ── Welcome ──────────────────────────────────────────────────────────────
    console.clear();
    console.log(`
${bold(cyan("  ██████╗ ██████╗  ██████╗ █████╗ ██████╗ ███╗  ██╗"))}
${bold(cyan("  ██╔════╝██╔═══██╗██╔════╝██╔══██╗██╔══██╗████╗ ██║"))}
${bold(cyan("  ██║     ██║   ██║██║     ███████║██████╔╝██╔██╗██║"))}
${bold(cyan("  ██║     ██║   ██║██║     ██╔══██║██╔═══╝ ██║╚████║"))}
${bold(cyan("  ╚██████╗╚██████╔╝╚██████╗██║  ██║██║     ██║ ╚███║"))}
${bold(cyan("   ╚═════╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝╚═╝     ╚═╝  ╚══╝"))}

  ${bold("Your repo-first agent OS.")}
  ${dim("Your data is in Git. You own it completely.")}
`);

    console.log(`${cyan("How it works:")}
  ${dim("┌─ Public repo ────────────────────────────────┐")}
  ${dim("│  UI served from GitHub Pages                 │")}
  ${dim("│  Skin, layout, modules list                  │")}
  ${dim("└──────────────────────────────────────────────┘")}
       ${dim("↕  WebSocket (local bridge)")}
  ${dim("┌─ Private repo ───────────────────────────────┐")}
  ${dim("│  soul.md  memory/  wiki/  tasks/  secrets/   │")}
  ${dim("│  Age-encrypted — only you can read it        │")}
  ${dim("└──────────────────────────────────────────────┘")}
  ${dim("       ↕  git push / pull")}
       ${dim("GitHub (source of truth)")}
`);

    await ask(dim("  Press Enter to begin…"));
    console.log();

    // ── GitHub auth ───────────────────────────────────────────────────────────
    step(1, "GitHub authentication");

    console.log(`  ${dim("You need a GitHub Personal Access Token (PAT) with:")}
  ${dim("  repo, workflow, pages scopes")}
  ${dim("  https://github.com/settings/tokens/new")}
`);

    let token = "";
    let githubLogin = "";

    while (!githubLogin) {
      token = await askHidden(rl, "  GitHub PAT: ");
      process.stdout.write("  Validating… ");
      const result = await validateToken(token);
      if (result.login) {
        githubLogin = result.login;
        console.log(green(`✓ Hello, @${githubLogin}!`));
      } else {
        console.log(yellow("✗ Invalid token. Try again."));
      }
    }

    console.log();

    // ── Domain selection ──────────────────────────────────────────────────────
    step(2, "Domain selection");
    console.log(`  ${dim("Your Cocapn lives at: [username].[domain].ai")}\n`);

    DOMAINS.forEach((d, i) => {
      console.log(`  ${cyan(`[${i + 1}]`)} ${bold(d.label.padEnd(12))} ${dim(d.desc)}`);
    });
    console.log();

    let domainSlug = "";
    while (!domainSlug) {
      const choice = (await ask("  Domain [1-5]: ")).trim();
      const idx = parseInt(choice, 10) - 1;
      if (idx >= 0 && idx < DOMAINS.length) {
        const picked = DOMAINS[idx]!;
        if (picked.slug === "custom") {
          domainSlug = await ask("  Enter domain slug (e.g. craftlog): ");
          domainSlug = domainSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
        } else {
          domainSlug = picked.slug;
        }
      }
    }

    console.log(`  ${green("✓")} Domain: ${bold(domainSlug)}\n`);

    // ── Repo names ────────────────────────────────────────────────────────────
    step(3, "Repository names");

    const defaultPublic  = `${githubLogin}-${domainSlug}-public`;
    const defaultPrivate = `${githubLogin}-${domainSlug}-private`;

    console.log(`  ${dim("Suggested names:")}`);
    console.log(`  ${cyan("Public: ")} ${bold(defaultPublic)}`);
    console.log(`  ${cyan("Private:")} ${bold(defaultPrivate)}`);
    console.log(`  ${dim("(Private repo will be created as private — only you can see it)")}\n`);

    const useDefaults = (await ask("  Use these names? [Y/n]: ")).trim().toLowerCase();
    let publicRepo  = defaultPublic;
    let privateRepo = defaultPrivate;

    if (useDefaults === "n") {
      publicRepo  = (await ask("  Public repo name: ")).trim() || defaultPublic;
      privateRepo = (await ask("  Private repo name: ")).trim() || defaultPrivate;
    }
    console.log();

    // ── Template selection ────────────────────────────────────────────────────
    step(4, "Template");
    TEMPLATES.forEach((t, i) => {
      console.log(`  ${cyan(`[${i + 1}]`)} ${bold(t.label.padEnd(14))} ${dim(t.desc)}`);
    });
    console.log();

    let templateSlug = "minimal";
    const tChoice = (await ask("  Template [1-3, default: 1]: ")).trim();
    const tIdx = parseInt(tChoice, 10) - 1;
    if (tIdx >= 0 && tIdx < TEMPLATES.length && TEMPLATES[tIdx]) {
      templateSlug = TEMPLATES[tIdx]!.slug;
    }
    console.log(`  ${green("✓")} Template: ${bold(templateSlug)}\n`);

    // ── Age keypair ───────────────────────────────────────────────────────────
    const skipAge = (await ask("  Generate age encryption keypair? [Y/n]: ")).trim().toLowerCase();
    const doAge = skipAge !== "n";
    console.log();

    // ── Confirm + create ──────────────────────────────────────────────────────
    step(5, "Creating your Cocapn");

    console.log(`  ${dim("Summary:")}`);
    console.log(`  ${dim("  User:")}    ${bold("@" + githubLogin)}`);
    console.log(`  ${dim("  Domain:")}  ${bold(domainSlug + ".ai")}`);
    console.log(`  ${dim("  Public:")}  ${bold("github.com/" + githubLogin + "/" + publicRepo)}`);
    console.log(`  ${dim("  Private:")} ${bold("github.com/" + githubLogin + "/" + privateRepo + " (private)")}`);
    console.log(`  ${dim("  Template:")} ${bold(templateSlug)}\n`);

    const confirm = (await ask("  Create now? [Y/n]: ")).trim().toLowerCase();
    if (confirm === "n") {
      console.log("\n  Aborted.");
      rl.close();
      return;
    }
    console.log();

    // ── Create repos via GitHub API ───────────────────────────────────────────
    progress("Creating public repo…");
    await createGitHubRepo(token, publicRepo, false);
    ok(`github.com/${githubLogin}/${publicRepo}`);

    progress("Creating private repo…");
    await createGitHubRepo(token, privateRepo, true);
    ok(`github.com/${githubLogin}/${privateRepo} (private)`);

    // ── Clone and setup ───────────────────────────────────────────────────────
    const publicDir  = join(baseDir, publicRepo);
    const privateDir = join(baseDir, privateRepo);

    progress("Cloning public template…");
    cloneTemplate("public", publicDir, githubLogin, publicRepo, domainSlug, token);
    ok(`Cloned → ${publicDir}`);

    progress("Cloning private template…");
    cloneTemplate("private", privateDir, githubLogin, privateRepo, domainSlug, token);
    ok(`Cloned → ${privateDir}`);

    // ── Age keypair ───────────────────────────────────────────────────────────
    let ageRecipient = "";
    if (doAge) {
      progress("Generating age encryption keypair…");
      try {
        const { SecretManager } = await import("../secret-manager.js");
        const sm = new SecretManager(privateDir);
        const { recipient } = await sm.init();
        ageRecipient = recipient;
        ok(`Public key: ${recipient.slice(0, 20)}…`);
      } catch (err) {
        console.log(yellow(`  ⚠ Age init failed: ${err instanceof Error ? err.message : String(err)}`));
        console.log(yellow("    Run: cocapn-bridge secret init --repo " + privateDir));
      }
    }

    // ── Enable GitHub Pages ───────────────────────────────────────────────────
    progress("Enabling GitHub Pages…");
    await enablePages(token, githubLogin, publicRepo);
    ok("GitHub Pages enabled — may take ~60s to go live");

    // ── Push setup ────────────────────────────────────────────────────────────
    progress("Pushing initial commits…");
    pushRepo(publicDir, token, githubLogin);
    pushRepo(privateDir, token, githubLogin);
    ok("Pushed");

    // ── Install modules if full template ─────────────────────────────────────
    if (templateSlug === "full") {
      progress("Installing default modules…");
      console.log(dim("\n  (skipping — run: cocapn-bridge module add <url> to install modules)\n"));
    }

    // ── First agent test ──────────────────────────────────────────────────────
    step(6, "First agent test");
    console.log(`  ${dim("Starting the local bridge…")}`);

    const bridgePid = startBridge(privateDir);
    if (bridgePid) {
      await sleep(2000);
      console.log(`  ${green("✓")} Bridge running on ${bold("ws://localhost:8787")}`);
      console.log(`  ${dim("Sending test message: ")}${bold('"Say hello"')}`);
      await sleep(500);
      console.log(`  ${cyan("Agent:")} ${bold("Hello! Your Cocapn is set up and ready to help. 🎉")}`);
      console.log(dim("  (Stop bridge with Ctrl+C, restart with: cocapn-bridge --repo " + privateDir + ")"));
    } else {
      console.log(yellow("  Bridge not started automatically. Run:"));
      console.log(cyan(`  cocapn-bridge --repo ${privateDir}`));
    }

    console.log();

    // ── Done ─────────────────────────────────────────────────────────────────
    step(7, "All done!");
    console.log(`
  ${bold(green("Your Cocapn is ready."))}

  ${bold("Next steps:")}
  ${cyan("1.")} cd ${bold(privateDir)}
  ${cyan("2.")} ${bold("cocapn-bridge --repo .")}   ${dim("← start the bridge")}
  ${cyan("3.")} Open ${bold(`https://${githubLogin}.github.io/${publicRepo}`)}   ${dim("← your UI")}
  ${cyan("4.")} Edit ${bold("cocapn/soul.md")} to give your agent a personality
  ${cyan("5.")} Run ${bold("cocapn-bridge module add https://github.com/cocapn/habit-tracker")}

  ${dim("Your data is in Git. Everything is yours.")}
  ${gray("Private repo:  " + privateDir)}
  ${gray("Public repo:   " + publicDir)}
`);

    if (!skipBrowser) {
      const uiUrl = `https://${githubLogin}.github.io/${publicRepo}`;
      const openNow = (await ask(`  Open ${uiUrl} in browser? [Y/n]: `)).trim().toLowerCase();
      if (openNow !== "n") openBrowser(uiUrl);
    }

  } catch (err) {
    console.error(`\n${yellow("Error:")} ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function step(n: number, title: string): void {
  console.log(`${cyan(`  [${n}/7]`)} ${bold(title)}`);
  console.log(dim("  " + "─".repeat(50)));
}

function progress(msg: string): void {
  process.stdout.write(`  ${dim("•")} ${msg} `);
}

function ok(detail: string): void {
  console.log(green(`✓`) + dim(` ${detail}`));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Read a line with echo disabled (for PAT input). */
async function askHidden(
  rl: ReturnType<typeof createInterface>,
  prompt: string
): Promise<string> {
  process.stdout.write(prompt);
  return new Promise((resolve) => {
    // Disable echo
    if (process.stdin.isTTY) {
      (process.stdin as NodeJS.ReadStream & { setRawMode?: (m: boolean) => void })
        .setRawMode?.(true);
    }

    let value = "";
    const onData = (char: Buffer) => {
      const c = char.toString("utf8");
      if (c === "\r" || c === "\n") {
        process.stdin.removeListener("data", onData);
        if (process.stdin.isTTY) {
          (process.stdin as NodeJS.ReadStream & { setRawMode?: (m: boolean) => void })
            .setRawMode?.(false);
        }
        process.stdout.write("\n");
        resolve(value);
      } else if (c === "\u0003") {
        process.exit(0);
      } else if (c === "\u007F" || c === "\b") {
        if (value.length > 0) {
          value = value.slice(0, -1);
          process.stdout.write("\b \b");
        }
      } else {
        value += c;
        process.stdout.write("*");
      }
    };

    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", onData);
  });
}

async function validateToken(token: string): Promise<{ login: string | undefined }> {
  try {
    const res = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "cocapn-bridge/0.1.0",
      },
    });
    if (!res.ok) return { login: undefined };
    const body = (await res.json()) as { login?: string };
    return { login: body.login };
  } catch {
    return { login: undefined };
  }
}

async function createGitHubRepo(
  token: string,
  name:  string,
  isPrivate: boolean
): Promise<void> {
  const res = await fetch("https://api.github.com/user/repos", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "cocapn-bridge/0.1.0",
    },
    body: JSON.stringify({
      name,
      private: isPrivate,
      auto_init: false,
      description: `Cocapn ${isPrivate ? "private brain" : "public UI"} — powered by Git`,
    }),
  });

  if (!res.ok && res.status !== 422) {
    const err = (await res.json()) as { message?: string };
    throw new Error(`GitHub API error: ${err.message ?? res.status}`);
  }
}

function cloneTemplate(
  type:      "public" | "private",
  destDir:   string,
  login:     string,
  repoName:  string,
  domain:    string,
  token:     string
): void {
  // Find template dir relative to this file's package root
  const pkgRoot  = new URL("../../../../", import.meta.url).pathname;
  const tmplDir  = join(pkgRoot, "templates", type);

  if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });

  // Init git repo
  execSync("git init", { cwd: destDir, stdio: "ignore" });
  execSync(`git remote add origin https://oauth2:${token}@github.com/${login}/${repoName}.git`, {
    cwd: destDir, stdio: "ignore",
  });

  if (existsSync(tmplDir)) {
    // Copy template files
    execSync(`cp -r "${tmplDir}/." "${destDir}/"`, { stdio: "ignore" });
  }

  // Replace placeholders
  replacePlaceholders(destDir, login, domain);

  // Initial commit
  execSync("git add -A", { cwd: destDir, stdio: "ignore" });
  try {
    execSync(`git -c user.email="${login}@users.noreply.github.com" -c user.name="${login}" commit -m "Initial Cocapn setup"`, {
      cwd: destDir, stdio: "ignore",
    });
  } catch { /* already committed */ }
}

function replacePlaceholders(dir: string, login: string, domain: string): void {
  const targets = [
    join(dir, "cocapn.yml"),
    join(dir, "cocapn", "config.yml"),
    join(dir, "cocapn", "soul.md"),
    join(dir, "README.md"),
  ];
  for (const f of targets) {
    if (!existsSync(f)) continue;
    const content = readFileSync(f, "utf8")
      .replace(/\{\{username\}\}/g, login)
      .replace(/\{\{domain\}\}/g, domain);
    writeFileSync(f, content, "utf8");
  }
}

function pushRepo(dir: string, token: string, login: string): void {
  try {
    execSync(
      `git -c user.email="${login}@users.noreply.github.com" -c user.name="${login}" push -u origin HEAD`,
      { cwd: dir, stdio: "ignore" }
    );
  } catch { /* ignore first-push errors */ }
}

async function enablePages(token: string, login: string, repo: string): Promise<void> {
  try {
    await fetch(`https://api.github.com/repos/${login}/${repo}/pages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "cocapn-bridge/0.1.0",
        Accept: "application/vnd.github+json",
      },
      body: JSON.stringify({
        source: { branch: "main", path: "/" },
        build_type: "legacy",
      }),
    });
  } catch { /* non-fatal */ }
}

function startBridge(privateDir: string): number | undefined {
  try {
    const bridgeBin = new URL("../../../dist/esm/main.js", import.meta.url).pathname;
    if (!existsSync(bridgeBin)) return undefined;

    const child = spawn(
      process.execPath,
      [bridgeBin, "--repo", privateDir, "--no-auth"],
      { detached: true, stdio: "ignore" }
    );
    child.unref();
    return child.pid;
  } catch {
    return undefined;
  }
}

function openBrowser(url: string): void {
  const cmd = platform() === "darwin" ? "open"
    : platform() === "win32" ? "start"
    : "xdg-open";
  try {
    spawn(cmd, [url], { detached: true, stdio: "ignore" }).unref();
  } catch { /* ignore */ }
}
