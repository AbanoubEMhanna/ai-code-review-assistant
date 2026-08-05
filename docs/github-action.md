# GitHub Action

Run the AI code review CLI directly in a workflow to review a pull request's diff and
optionally fail the job when high-severity issues are found.

## Usage

```yaml
name: AI Code Review

on:
  pull_request:

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: AbanoubEMhanna/ai-code-review-assistant@main
        with:
          base: ${{ github.event.pull_request.base.ref }}
          provider: anthropic
          model: claude-sonnet-4-6
          api-key: ${{ secrets.ANTHROPIC_API_KEY }}
          fail-on: high
```

`fetch-depth: 0` is required on the checkout step — the CLI diffs `HEAD` against `base`
using the full commit history, which a shallow clone doesn't have.

## Inputs

| Input        | Default                  | Description                                                                                                    |
| ------------ | ------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `base`       | `main`                   | Base ref to diff `HEAD` against.                                                                               |
| `provider`   | `anthropic`              | `ollama`, `lmstudio`, or `anthropic`.                                                                          |
| `model`      | `claude-sonnet-4-6`      | Model name.                                                                                                    |
| `host`       | `http://localhost:11434` | AI host URL (`ollama`/`lmstudio` only — e.g. a self-hosted runner).                                            |
| `api-key`    | —                        | API key for `anthropic`. Required when `provider` is `anthropic`.                                              |
| `max-tokens` | —                        | Maximum tokens for the AI response.                                                                            |
| `fail-on`    | `high`                   | Fail the job if an issue at this severity or above is found. Set to an empty string to never fail on findings. |
| `output`     | `ai-review-report.md`    | Path (relative to the workspace) to write the Markdown report to.                                              |

## Outputs

| Output        | Description                                                                                                                               |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `report-path` | Path to the generated Markdown report, for use in a follow-up step (e.g. uploading it as a build artifact or posting it as a PR comment). |

## Using a self-hosted Ollama/LM Studio runner

The `anthropic` provider works on GitHub-hosted runners since it only needs outbound
HTTPS. `ollama` and `lmstudio` require the model server to be reachable from the
runner — typically a self-hosted runner with Ollama/LM Studio already running, pointed
to via `host`.
