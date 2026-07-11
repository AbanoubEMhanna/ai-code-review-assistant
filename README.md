# AI Code Review Assistant

Local-first developer tool that reads Git diffs and generates practical code review feedback without requiring an OpenAI key.

## Stack

- CLI: Node.js + TypeScript
- Git integration: simple-git
- Optional backend: NestJS
- Optional dashboard: React or Next.js
- AI runtime: Ollama or LM Studio
- Suggested local models: Qwen 3 or DeepSeek R1
- Output: Markdown review reports

## Quick Start

### 1. Prerequisites

- Node.js 20+
- pnpm 10+ (`npm install -g pnpm`)
- [Ollama](https://ollama.com) running locally **or** [LM Studio](https://lmstudio.ai) with a server started

```bash
# Pull a model in Ollama
ollama pull qwen3:latest
```

### 2. Install

```bash
git clone https://github.com/abanoubemhanna/ai-code-review-assistant.git
cd ai-code-review-assistant
pnpm install
```

### 3. Configure

```bash
cp .env.example .env
# Edit .env if you use a different model or port
```

### 4. Build

```bash
pnpm build
```

### 5. Use

```bash
# Review staged changes
node apps/cli/dist/index.js staged

# Review all commits on this branch vs main
node apps/cli/dist/index.js branch main

# Review changes to a specific file
node apps/cli/dist/index.js file src/app.ts

# Save a Markdown report
node apps/cli/dist/index.js staged --output review.md
```

**Options** (all commands):

| Flag                  | Default                  | Description                                                                 |
| --------------------- | ------------------------ | --------------------------------------------------------------------------- |
| `-m, --model`         | `qwen3:latest`           | Model name                                                                  |
| `-H, --host`          | `http://localhost:11434` | AI host URL                                                                 |
| `-p, --provider`      | `ollama`                 | `ollama` or `lmstudio`                                                      |
| `-o, --output`        | —                        | Save report to Markdown file                                                |
| `--ignore <pattern>`  | —                        | Glob pattern for files to exclude from review (repeatable)                  |
| `--no-default-ignore` | —                        | Disable the built-in ignore patterns (lockfiles, `dist/**`, minified files) |

### Ignoring files

By default, common noisy or generated files are excluded from what gets sent to the AI provider: lockfiles (`pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`), minified/sourcemap files (`*.min.js`, `*.min.css`, `*.map`), and `dist/**` / `build/**` output. This keeps reviews focused on code that was actually written by hand and avoids wasting tokens on generated diffs.

```bash
# Add extra patterns on top of the defaults
node apps/cli/dist/index.js staged --ignore "*.generated.ts" --ignore "vendor/**"

# Disable the built-in defaults entirely
node apps/cli/dist/index.js staged --no-default-ignore
```

Patterns without a `/` match the filename at any depth (like `.gitignore`); patterns with a `/` match the full path, and `**` matches across directories. You can also persist patterns in `.ai-reviewrc.json`:

```json
{
  "ignore": ["*.generated.ts", "vendor/**"]
}
```

**Using LM Studio:**

```bash
node apps/cli/dist/index.js staged \
  --provider lmstudio \
  --host http://localhost:1234 \
  --model "lmstudio-community/qwen3-8b"
```

## Monorepo Layout

- `apps/cli`: TypeScript CLI — the main entry point
- `apps/web`: optional review dashboard (future)
- `apps/api`: optional review API (future)
- `packages/ai`: model clients (Ollama + LM Studio) and review prompts
- `packages/shared`: shared types — `ReviewReport`, `ReviewComment`, `ReviewSeverity`
- `packages/db`: optional persisted review storage (future)

## Local-first AI

This project is designed to run with Ollama or LM Studio and does not require paid AI API keys.

## Roadmap

See [docs/roadmap.md](docs/roadmap.md).
