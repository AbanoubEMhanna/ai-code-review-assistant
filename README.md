# AI Code Review Assistant

Local-first developer tool that reads Git diffs and generates practical code review feedback without requiring an OpenAI key.

## Stack

- CLI: Node.js + TypeScript
- Git integration: simple-git
- AI runtime: Ollama, LM Studio, or Anthropic
- Suggested local models: Qwen 3 or DeepSeek R1
- Output: Markdown review reports with persistent history

## Quick Start

### 1. Prerequisites

- Node.js 20+
- pnpm 10+ (`npm install -g pnpm`)
- One of the following AI backends:
  - [Ollama](https://ollama.com) running locally
  - [LM Studio](https://lmstudio.ai) with a server started
  - An [Anthropic API key](https://console.anthropic.com) for cloud-based reviews

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

---

## Commands

### Review Commands

All review commands share the same set of options (see [Shared Options](#shared-options) below).

#### `staged`

Review staged changes (`git add`).

```bash
node apps/cli/dist/index.js staged
node apps/cli/dist/index.js staged --json
node apps/cli/dist/index.js staged --fail-on high --no-save
```

#### `branch <base>`

Review all commits on HEAD that are not in `<base>`.

```bash
node apps/cli/dist/index.js branch main
node apps/cli/dist/index.js branch origin/main --output report.md
```

#### `file <path>`

Review unstaged or staged changes to a specific file.

```bash
node apps/cli/dist/index.js file src/app.ts
node apps/cli/dist/index.js file README.md --output readme-review.md
```

---

### Shared Options

All review commands (`staged`, `branch`, `file`) accept:

| Flag                        | Default                  | Description                                                                              |
| --------------------------- | ------------------------ | ---------------------------------------------------------------------------------------- |
| `-m, --model <model>`       | `qwen3:latest`           | Model name                                                                               |
| `-H, --host <url>`          | `http://localhost:11434` | AI host URL (Ollama/LM Studio only)                                                      |
| `-p, --provider <provider>` | `ollama`                 | `ollama`, `lmstudio`, or `anthropic`                                                     |
| `-k, --api-key <key>`       | `$ANTHROPIC_API_KEY`     | API key (Anthropic; or set env var)                                                      |
| `-t, --max-tokens <number>` | `4096`                   | Maximum tokens for AI response                                                           |
| `-o, --output <file>`       | —                        | Save Markdown report to file                                                             |
| `--json`                    | —                        | Output review as JSON                                                                    |
| `--fail-on <severity>`      | —                        | Exit 1 if any issue at this severity or above is found (`high`\|`medium`\|`low`\|`info`) |
| `--no-save`                 | —                        | Do not save this review to history                                                       |

---

### `ping`

Test connectivity to the configured AI provider.

```bash
node apps/cli/dist/index.js ping
node apps/cli/dist/index.js ping --provider anthropic --api-key sk-ant-...
node apps/cli/dist/index.js ping --json
```

Options: `--model`, `--host`, `--provider`, `--api-key`, `--json`

---

### `doctor`

Run a full health check: verify config, connectivity, and model availability.

```bash
node apps/cli/dist/index.js doctor
node apps/cli/dist/index.js doctor --provider anthropic
node apps/cli/dist/index.js doctor --json
```

Options: `--host`, `--provider`, `--model`, `--api-key`, `--json`

---

### `history` Commands

All reviews are automatically saved to `~/.ai-review/history/` (disable with `--no-save`).

#### `history list`

List saved reviews, newest first.

```bash
node apps/cli/dist/index.js history list
node apps/cli/dist/index.js history list --limit 50
node apps/cli/dist/index.js history list --source "staged changes"
node apps/cli/dist/index.js history list --json
```

| Option                   | Default | Description                         |
| ------------------------ | ------- | ----------------------------------- |
| `-n, --limit <number>`   | `20`    | Number of reviews to show           |
| `-s, --source <pattern>` | —       | Filter by diff source (exact match) |
| `--json`                 | —       | Output as JSON array                |

#### `history show <id>`

Show a saved review in full.

```bash
node apps/cli/dist/index.js history show abc123
node apps/cli/dist/index.js history show abc123 --json
```

#### `history export <id>`

Export a saved review as a Markdown file.

```bash
node apps/cli/dist/index.js history export abc123 --output review.md
```

#### `history stats`

Show aggregate statistics across all saved reviews.

```bash
node apps/cli/dist/index.js history stats
node apps/cli/dist/index.js history stats --source "staged changes"
node apps/cli/dist/index.js history stats --json
```

#### `history search <query>`

Search saved reviews by keyword (searches summary, source, model, and comments).

```bash
node apps/cli/dist/index.js history search "security"
node apps/cli/dist/index.js history search "null pointer" --limit 5
```

#### `history delete <id>`

Delete a saved review by ID.

```bash
node apps/cli/dist/index.js history delete abc123
```

#### `history clear`

Delete all saved reviews.

```bash
node apps/cli/dist/index.js history clear
```

---

### `config` Commands

#### `config show`

Show the active configuration and its source.

```bash
node apps/cli/dist/index.js config show
```

#### `config init`

Create a `.ai-reviewrc.json` file in the current directory with the current defaults.

```bash
node apps/cli/dist/index.js config init
```

---

## Configuration File

Create a `.ai-reviewrc.json` in your project root (or home directory) to persist defaults:

```json
{
  "model": "qwen3:latest",
  "host": "http://localhost:11434",
  "provider": "ollama",
  "maxTokens": 4096
}
```

The config file is optional. Priority order: `--flag` > environment variable > config file > built-in default.

### Environment Variables

| Variable            | Description                                          |
| ------------------- | ---------------------------------------------------- |
| `AI_HOST`           | Default AI host URL                                  |
| `AI_PROVIDER`       | Default provider (`ollama`, `lmstudio`, `anthropic`) |
| `AI_MODEL`          | Default model name                                   |
| `ANTHROPIC_API_KEY` | Anthropic API key                                    |

Copy `.env.example` to `.env` to set these locally.

---

## AI Providers

### Ollama (default)

```bash
node apps/cli/dist/index.js staged
# or explicitly:
node apps/cli/dist/index.js staged --provider ollama --host http://localhost:11434 --model qwen3:latest
```

### LM Studio

```bash
node apps/cli/dist/index.js staged \
  --provider lmstudio \
  --host http://localhost:1234 \
  --model "lmstudio-community/qwen3-8b"
```

### Anthropic

```bash
export ANTHROPIC_API_KEY=sk-ant-...
node apps/cli/dist/index.js staged \
  --provider anthropic \
  --model claude-sonnet-4-6
```

Or pass the key inline:

```bash
node apps/cli/dist/index.js staged \
  --provider anthropic \
  --api-key sk-ant-... \
  --model claude-sonnet-4-6
```

---

## CI / Git Hook Integration

Use `--fail-on` to block commits or CI when issues of a given severity are found:

```bash
# Fail if any HIGH severity issue is found
node apps/cli/dist/index.js staged --fail-on high

# Fail if any MEDIUM or above issue is found
node apps/cli/dist/index.js branch main --fail-on medium --no-save
```

Exit codes: `0` = success (no issues above threshold), `1` = issues found or error.

---

## JSON Output

All review commands support `--json` for machine-readable output:

```bash
node apps/cli/dist/index.js staged --json | jq '.stats'
node apps/cli/dist/index.js history list --json | jq '.[0].summary'
```

The JSON schema follows the `ReviewReport` type from `packages/shared/src/types.ts`.

---

## Monorepo Layout

```
apps/cli/          TypeScript CLI — the main entry point
apps/web/          Optional review dashboard (future)
apps/api/          Optional review API (future)
packages/ai/       Model clients (Ollama + LM Studio + Anthropic) and review prompts
packages/shared/   Shared types — ReviewReport, ReviewComment, ReviewSeverity
packages/db/       Optional persisted review storage (future)
```

## Development

```bash
pnpm install       # Install dependencies
pnpm build         # Build all packages
pnpm test          # Run tests
pnpm lint          # Run linter
pnpm format        # Auto-format code
```

## Roadmap

See [docs/roadmap.md](docs/roadmap.md).
