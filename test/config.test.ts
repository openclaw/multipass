import { describe, expect, it } from "vitest";
import { ManifestSchema } from "../src/config/schema.js";

describe("manifest schema", () => {
  it("parses a valid loopback fixture", () => {
    const manifest = ManifestSchema.parse({
      configVersion: 1,
      fixtures: [
        {
          id: "loopback-roundtrip",
          mode: "roundtrip",
          provider: "local",
          target: { id: "echo-bot" },
        },
      ],
      providers: {
        local: {
          adapter: "loopback",
          platform: "loopback",
        },
      },
    });

    expect(manifest.fixtures[0]?.timeoutMs).toBe(30_000);
    expect(manifest.fixtures[0]?.inboundMatch.author).toBe("assistant");
  });

  it("rejects script providers without script config", () => {
    expect(() =>
      ManifestSchema.parse({
        configVersion: 1,
        fixtures: [],
        providers: {
          slack: {
            adapter: "script",
            platform: "slack",
          },
        },
      }),
    ).toThrow(/script adapter requires a script configuration/);
  });

  it("parses a native slack provider with webhook defaults", () => {
    const manifest = ManifestSchema.parse({
      configVersion: 1,
      fixtures: [
        {
          id: "slack-agent",
          mode: "agent",
          provider: "slack-native",
          target: {
            channelId: "C1234567890",
            id: "C1234567890",
          },
        },
      ],
      providers: {
        "slack-native": {
          adapter: "slack",
          platform: "slack",
          slack: {},
        },
      },
    });

    expect(manifest.providers["slack-native"]?.slack?.webhook.port).toBe(8787);
    expect(manifest.providers["slack-native"]?.slack?.webhook.path).toBe("/slack/events");
  });

  it("rejects slack providers on the wrong platform", () => {
    expect(() =>
      ManifestSchema.parse({
        configVersion: 1,
        fixtures: [],
        providers: {
          slack: {
            adapter: "slack",
            platform: "discord",
          },
        },
      }),
    ).toThrow(/slack adapter must use platform=slack/);
  });
});
