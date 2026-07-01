import { describe, expect, it } from "vitest";
import {
  generateBashCompletion,
  generateZshCompletion,
  generateFishCompletion,
} from "./completion.js";

const TOP_COMMANDS = [
  "staged",
  "branch",
  "file",
  "ping",
  "doctor",
  "history",
  "config",
  "completion",
];
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

describe("generateBashCompletion()", () => {
  it("returns a non-empty string", () => {
    expect(generateBashCompletion()).toBeTruthy();
  });

  it("ends with a newline", () => {
    expect(generateBashCompletion().endsWith("\n")).toBe(true);
  });

  it("defines a complete function and registers it", () => {
    const script = generateBashCompletion();
    expect(script).toContain("_ai_review()");
    expect(script).toContain("complete -F _ai_review ai-review");
  });

  it("includes all top-level commands", () => {
    const script = generateBashCompletion();
    for (const cmd of TOP_COMMANDS) {
      expect(script).toContain(cmd);
    }
  });

  it("includes all shared review flags", () => {
    const script = generateBashCompletion();
    for (const flag of SHARED_FLAGS) {
      expect(script).toContain(flag);
    }
  });

  it("includes history subcommands", () => {
    const script = generateBashCompletion();
    for (const cmd of HISTORY_CMDS) {
      expect(script).toContain(cmd);
    }
  });

  it("includes config subcommands", () => {
    const script = generateBashCompletion();
    for (const cmd of CONFIG_CMDS) {
      expect(script).toContain(cmd);
    }
  });

  it("completes --shell flag with bash zsh fish", () => {
    const script = generateBashCompletion();
    expect(script).toContain("bash zsh fish");
  });

  it("suggests the -s alias alongside --shell", () => {
    const script = generateBashCompletion();
    expect(script).toContain('compgen -W "--shell -s"');
  });

  it("respects custom binName", () => {
    const script = generateBashCompletion("my-review");
    expect(script).toContain("_my_review()");
    expect(script).toContain("complete -F _my_review my-review");
    expect(script).not.toContain("ai-review");
  });

  it("converts hyphens to underscores in function name", () => {
    const script = generateBashCompletion("foo-bar-baz");
    expect(script).toContain("_foo_bar_baz()");
  });

  it("contains shell-appropriate variable references", () => {
    const script = generateBashCompletion();
    expect(script).toContain("COMP_WORDS");
    expect(script).toContain("COMP_CWORD");
    expect(script).toContain("COMPREPLY");
    expect(script).toContain("compgen");
  });
});

describe("generateZshCompletion()", () => {
  it("returns a non-empty string", () => {
    expect(generateZshCompletion()).toBeTruthy();
  });

  it("ends with a newline", () => {
    expect(generateZshCompletion().endsWith("\n")).toBe(true);
  });

  it("starts with #compdef directive", () => {
    expect(generateZshCompletion().startsWith("#compdef ai-review")).toBe(true);
  });

  it("defines and registers the completion function with compdef", () => {
    const script = generateZshCompletion();
    expect(script).toContain("_ai_review()");
    expect(script).toContain("compdef _ai_review ai-review");
  });

  it("includes all top-level commands with descriptions", () => {
    const script = generateZshCompletion();
    for (const cmd of TOP_COMMANDS) {
      expect(script).toContain(cmd);
    }
  });

  it("includes history subcommands", () => {
    const script = generateZshCompletion();
    for (const cmd of HISTORY_CMDS) {
      expect(script).toContain(cmd);
    }
  });

  it("includes config subcommands", () => {
    const script = generateZshCompletion();
    for (const cmd of CONFIG_CMDS) {
      expect(script).toContain(cmd);
    }
  });

  it("uses _describe for completion", () => {
    const script = generateZshCompletion();
    expect(script).toContain("_describe");
  });

  it("suggests the -s alias alongside --shell", () => {
    const script = generateZshCompletion();
    expect(script).toContain("'-s[Shell to generate completion for]'");
  });

  it("respects custom binName", () => {
    const script = generateZshCompletion("my-review");
    expect(script).toContain("#compdef my-review");
    expect(script).toContain("_my_review()");
    expect(script).toContain("compdef _my_review my-review");
  });
});

describe("generateFishCompletion()", () => {
  it("returns a non-empty string", () => {
    expect(generateFishCompletion()).toBeTruthy();
  });

  it("ends with a newline", () => {
    expect(generateFishCompletion().endsWith("\n")).toBe(true);
  });

  it("disables default file completion", () => {
    const script = generateFishCompletion();
    expect(script).toContain("complete -c ai-review -f");
  });

  it("includes all top-level commands", () => {
    const script = generateFishCompletion();
    for (const cmd of TOP_COMMANDS) {
      expect(script).toContain(cmd);
    }
  });

  it("includes history subcommands", () => {
    const script = generateFishCompletion();
    for (const cmd of HISTORY_CMDS) {
      expect(script).toContain(cmd);
    }
  });

  it("includes config subcommands", () => {
    const script = generateFishCompletion();
    for (const cmd of CONFIG_CMDS) {
      expect(script).toContain(cmd);
    }
  });

  it("uses __fish_use_subcommand for top-level commands", () => {
    const script = generateFishCompletion();
    expect(script).toContain("__fish_use_subcommand");
  });

  it("uses __fish_seen_subcommand_from for nested completions", () => {
    const script = generateFishCompletion();
    expect(script).toContain("__fish_seen_subcommand_from");
  });

  it("includes shell options for completion --shell", () => {
    const script = generateFishCompletion();
    expect(script).toContain("bash zsh fish");
  });

  it("respects custom binName", () => {
    const script = generateFishCompletion("my-review");
    expect(script).toContain("complete -c my-review -f");
    expect(script).not.toContain("complete -c ai-review");
  });
});
