export type Shell = "bash" | "zsh" | "fish";

const COMMANDS = ["staged", "branch", "file", "ping", "doctor", "history", "config", "completion"];

const HISTORY_CMDS = ["list", "show", "export", "stats", "delete", "clear", "search"];
const CONFIG_CMDS = ["show", "init"];
const SHARED_FLAGS = [
  "--model",
  "--host",
  "--provider",
  "--api-key",
  "--max-tokens",
  "--output",
  "--json",
  "--fail-on",
  "--no-save",
];

export function generateBashCompletion(binName = "ai-review"): string {
  const fn = `_${binName.replace(/-/g, "_")}`;
  const cmds = COMMANDS.join(" ");
  const sf = SHARED_FLAGS.join(" ");
  const hc = HISTORY_CMDS.join(" ");
  const cc = CONFIG_CMDS.join(" ");

  // \${ in template literals outputs ${ literally (breaks JS interpolation)
  return `# ${binName} bash completion
# Usage (add one of these to ~/.bashrc or ~/.bash_profile):
#   source <(${binName} completion --shell bash)
#   eval "$(${binName} completion --shell bash)"

${fn}() {
  local cur prev
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"

  if [[ $COMP_CWORD -eq 1 ]]; then
    COMPREPLY=($(compgen -W "${cmds}" -- "$cur"))
    return
  fi

  case "\${COMP_WORDS[1]}" in
    staged)
      COMPREPLY=($(compgen -W "${sf}" -- "$cur"))
      ;;
    branch)
      if [[ $COMP_CWORD -eq 2 ]]; then
        local branches
        branches=$(git branch --format='%(refname:short)' 2>/dev/null)
        COMPREPLY=($(compgen -W "$branches" -- "$cur"))
      else
        COMPREPLY=($(compgen -W "${sf}" -- "$cur"))
      fi
      ;;
    file)
      if [[ $COMP_CWORD -eq 2 ]]; then
        COMPREPLY=($(compgen -f -- "$cur"))
      else
        COMPREPLY=($(compgen -W "${sf}" -- "$cur"))
      fi
      ;;
    ping|doctor)
      COMPREPLY=($(compgen -W "--model --host --provider --api-key --json" -- "$cur"))
      ;;
    history)
      if [[ $COMP_CWORD -eq 2 ]]; then
        COMPREPLY=($(compgen -W "${hc}" -- "$cur"))
      fi
      ;;
    config)
      if [[ $COMP_CWORD -eq 2 ]]; then
        COMPREPLY=($(compgen -W "${cc}" -- "$cur"))
      fi
      ;;
    completion)
      if [[ "$prev" == "--shell" || "$prev" == "-s" ]]; then
        COMPREPLY=($(compgen -W "bash zsh fish" -- "$cur"))
      else
        COMPREPLY=($(compgen -W "--shell" -- "$cur"))
      fi
      ;;
  esac
}

complete -F ${fn} ${binName}
`;
}

export function generateZshCompletion(binName = "ai-review"): string {
  const fn = `_${binName.replace(/-/g, "_")}`;

  return `#compdef ${binName}
# ${binName} zsh completion
# Usage (add to ~/.zshrc):
#   source <(${binName} completion --shell zsh)

${fn}() {
  local -a top_cmds history_cmds config_cmds shared_flags

  top_cmds=(
    'staged:Review staged changes (git add)'
    'branch:Review commits on HEAD not in <base>'
    'file:Review changes to a specific file'
    'ping:Test connectivity to the AI provider'
    'doctor:Run a health-check diagnostic'
    'history:Manage saved review history'
    'config:Manage ai-review configuration'
    'completion:Output shell completion script'
  )

  shared_flags=(
    '--model[Model name]'
    '--host[AI host URL (Ollama/LM Studio)]'
    '--provider[Provider: ollama | lmstudio | anthropic]'
    '--api-key[API key]'
    '--max-tokens[Maximum response tokens]'
    '--output[Save Markdown report to file]'
    '--json[Output as JSON]'
    '--fail-on[Exit 1 on issues at or above severity: high|medium|low|info]'
    '--no-save[Do not save review to history]'
  )

  history_cmds=(
    'list:List saved reviews'
    'show:Show a saved review by ID'
    'export:Export a saved review as Markdown'
    'stats:Show aggregate statistics'
    'delete:Delete a saved review by ID'
    'clear:Delete all saved reviews'
    'search:Search saved reviews by keyword'
  )

  config_cmds=(
    'show:Show the active configuration'
    'init:Create a .ai-reviewrc.json with current defaults'
  )

  if (( CURRENT == 2 )); then
    _describe 'command' top_cmds
    return
  fi

  case $words[2] in
    staged)
      _describe 'flag' shared_flags
      ;;
    branch)
      if (( CURRENT == 3 )); then
        local -a branches
        branches=(\${(f)"$(git branch --format='%(refname:short)' 2>/dev/null)"})
        _describe 'branch' branches
      else
        _describe 'flag' shared_flags
      fi
      ;;
    file)
      if (( CURRENT == 3 )); then
        _files
      else
        _describe 'flag' shared_flags
      fi
      ;;
    ping|doctor)
      local -a conn_flags
      conn_flags=(
        '--model[Model name]'
        '--host[AI host URL]'
        '--provider[Provider: ollama | lmstudio | anthropic]'
        '--api-key[API key]'
        '--json[Output as JSON]'
      )
      _describe 'flag' conn_flags
      ;;
    history)
      if (( CURRENT == 3 )); then
        _describe 'history command' history_cmds
      fi
      ;;
    config)
      if (( CURRENT == 3 )); then
        _describe 'config command' config_cmds
      fi
      ;;
    completion)
      if [[ $words[CURRENT-1] == --shell || $words[CURRENT-1] == -s ]]; then
        local -a shells
        shells=('bash' 'zsh' 'fish')
        _describe 'shell' shells
      else
        _describe 'flag' '(--shell)'
      fi
      ;;
  esac
}

${fn} "$@"
`;
}

export function generateFishCompletion(binName = "ai-review"): string {
  return `# ${binName} fish completion
# Usage (add to fish config or save to completions dir):
#   ${binName} completion --shell fish | source
#   ${binName} completion --shell fish > ~/.config/fish/completions/${binName}.fish

# Disable default file completion
complete -c ${binName} -f

# ── top-level commands ──────────────────────────────────────────────────────
complete -c ${binName} -n '__fish_use_subcommand' -a staged     -d 'Review staged changes'
complete -c ${binName} -n '__fish_use_subcommand' -a branch     -d 'Review commits on HEAD not in <base>'
complete -c ${binName} -n '__fish_use_subcommand' -a file       -d 'Review changes to a specific file'
complete -c ${binName} -n '__fish_use_subcommand' -a ping       -d 'Test connectivity to the AI provider'
complete -c ${binName} -n '__fish_use_subcommand' -a doctor     -d 'Run a health-check diagnostic'
complete -c ${binName} -n '__fish_use_subcommand' -a history    -d 'Manage saved review history'
complete -c ${binName} -n '__fish_use_subcommand' -a config     -d 'Manage ai-review configuration'
complete -c ${binName} -n '__fish_use_subcommand' -a completion -d 'Output shell completion script'

# ── history subcommands ─────────────────────────────────────────────────────
complete -c ${binName} -n '__fish_seen_subcommand_from history' -a list   -d 'List saved reviews'
complete -c ${binName} -n '__fish_seen_subcommand_from history' -a show   -d 'Show a saved review by ID'
complete -c ${binName} -n '__fish_seen_subcommand_from history' -a export -d 'Export a saved review as Markdown'
complete -c ${binName} -n '__fish_seen_subcommand_from history' -a stats  -d 'Show aggregate statistics'
complete -c ${binName} -n '__fish_seen_subcommand_from history' -a delete -d 'Delete a saved review by ID'
complete -c ${binName} -n '__fish_seen_subcommand_from history' -a clear  -d 'Delete all saved reviews'
complete -c ${binName} -n '__fish_seen_subcommand_from history' -a search -d 'Search saved reviews by keyword'

# ── config subcommands ──────────────────────────────────────────────────────
complete -c ${binName} -n '__fish_seen_subcommand_from config' -a show -d 'Show the active configuration'
complete -c ${binName} -n '__fish_seen_subcommand_from config' -a init -d 'Create .ai-reviewrc.json with defaults'

# ── shared review flags (staged, branch, file) ──────────────────────────────
complete -c ${binName} -n '__fish_seen_subcommand_from staged branch file' -s m -l model      -d 'Model name'
complete -c ${binName} -n '__fish_seen_subcommand_from staged branch file' -s H -l host       -d 'AI host URL'
complete -c ${binName} -n '__fish_seen_subcommand_from staged branch file' -s p -l provider   -d 'Provider' -a 'ollama lmstudio anthropic'
complete -c ${binName} -n '__fish_seen_subcommand_from staged branch file' -s k -l api-key    -d 'API key'
complete -c ${binName} -n '__fish_seen_subcommand_from staged branch file' -s t -l max-tokens -d 'Maximum response tokens'
complete -c ${binName} -n '__fish_seen_subcommand_from staged branch file' -s o -l output     -d 'Save Markdown report to file' -F
complete -c ${binName} -n '__fish_seen_subcommand_from staged branch file' -l json            -d 'Output as JSON'
complete -c ${binName} -n '__fish_seen_subcommand_from staged branch file' -l fail-on         -d 'Exit 1 on severity or above' -a 'high medium low info'
complete -c ${binName} -n '__fish_seen_subcommand_from staged branch file' -l no-save         -d 'Do not save to history'

# ── connectivity flags (ping, doctor) ───────────────────────────────────────
complete -c ${binName} -n '__fish_seen_subcommand_from ping doctor' -s m -l model    -d 'Model name'
complete -c ${binName} -n '__fish_seen_subcommand_from ping doctor' -s H -l host     -d 'AI host URL'
complete -c ${binName} -n '__fish_seen_subcommand_from ping doctor' -s p -l provider -d 'Provider' -a 'ollama lmstudio anthropic'
complete -c ${binName} -n '__fish_seen_subcommand_from ping doctor' -s k -l api-key  -d 'API key'
complete -c ${binName} -n '__fish_seen_subcommand_from ping doctor' -l json          -d 'Output as JSON'

# ── completion flags ────────────────────────────────────────────────────────
complete -c ${binName} -n '__fish_seen_subcommand_from completion' -s s -l shell -d 'Shell type' -a 'bash zsh fish'
`;
}
