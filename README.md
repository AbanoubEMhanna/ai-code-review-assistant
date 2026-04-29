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

## Monorepo Layout

- `apps/web`: optional review dashboard
- `apps/api`: optional review API
- `packages/ai`: model clients and review prompts
- `packages/db`: optional persisted review storage
- `packages/shared`: shared schemas and report types

## Next Steps

1. Create the TypeScript CLI package.
2. Add diff loading from Git.
3. Implement review prompts for staged, branch, and single-file reviews.
4. Add Markdown output with file-level findings.

## Local-first AI

This project is designed to run with Ollama or LM Studio and does not require paid AI API keys.

