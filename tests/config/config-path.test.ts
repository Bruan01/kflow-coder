import { describe, expect, it } from "vitest";

import {
  resolveConfigPath,
  resolveCredentialsPath,
  resolveSessionsDirectory,
} from "../../src/config/config-path.js";

describe("resolveConfigPath", () => {
  it("uses an explicit KFC_CONFIG_PATH and resolves relative paths from cwd", () => {
    expect(
      resolveConfigPath(
        { KFC_CONFIG_PATH: "settings/kfc.json" },
        { homeDirectory: "/home/learner", currentDirectory: "/workspace" },
      ),
    ).toBe("/workspace/settings/kfc.json");
  });

  it("prefers XDG_CONFIG_HOME over the home fallback", () => {
    expect(
      resolveConfigPath(
        { XDG_CONFIG_HOME: "/xdg" },
        { homeDirectory: "/home/learner", currentDirectory: "/workspace" },
      ),
    ).toBe("/xdg/kfc/config.json");
  });

  it("falls back to ~/.config/kfc/config.json", () => {
    expect(
      resolveConfigPath(
        {},
        { homeDirectory: "/home/learner", currentDirectory: "/workspace" },
      ),
    ).toBe("/home/learner/.config/kfc/config.json");
  });
});

describe("resolveCredentialsPath", () => {
  it("uses an explicit credentials path and resolves it from cwd", () => {
    expect(
      resolveCredentialsPath(
        { KFC_CREDENTIALS_PATH: "secrets/provider.json" },
        "/workspace/config.json",
        { homeDirectory: "/home/learner", currentDirectory: "/workspace" },
      ),
    ).toBe("/workspace/secrets/provider.json");
  });

  it("defaults to credentials.json beside config.json", () => {
    expect(
      resolveCredentialsPath({}, "/home/learner/.config/kfc/config.json", {
        homeDirectory: "/home/learner",
        currentDirectory: "/workspace",
      }),
    ).toBe("/home/learner/.config/kfc/credentials.json");
  });
});

describe("resolveSessionsDirectory", () => {
  it("keeps session journals beside the resolved config under a private directory", () => {
    expect(
      resolveSessionsDirectory(
        { KFC_CONFIG_PATH: "settings/kfc.json" },
        { homeDirectory: "/home/learner", currentDirectory: "/workspace" },
      ),
    ).toBe("/workspace/settings/sessions");
  });
});
