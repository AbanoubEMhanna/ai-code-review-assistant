# Architecture

Local AI code review assistant architecture notes.

## Target Shape

- CLI-first workflow that reads Git diffs and produces Markdown review reports.
- Optional API and web dashboard for saved reviews.
- AI package for LM Studio/Ollama adapters and review prompts.
- Shared package for report schemas, severity levels, and file annotations.
