import { describe, expect, it } from "vitest";
import { createRegistry } from "../src/providers/registry.js";
import type { ManifestDefinition } from "../src/config/schema.js";

const manifest: ManifestDefinition = {
  configVersion: 1,
  fixtures: [
    {
      env: [],
      id: "fixture",
      inboundMatch: { author: "assistant", nonce: "contains", strategy: "contains" },
      mode: "roundtrip",
      provider: "local",
      retries: 0,
      tags: [],
      target: { id: "echo", metadata: {} },
      timeoutMs: 1000,
    },
  ],
  providers: {
    local: {
      adapter: "loopback",
      capabilities: ["probe", "send", "roundtrip", "agent"],
      env: [],
      platform: "loopback",
      status: "active",
    },
  },
  userName: "multipass",
};

describe("registry", () => {
  it("resolves configured providers", () => {
    const registry = createRegistry(manifest, "/tmp/multipass.yaml");
    const provider = registry.resolve("local", "fixture");
    expect(provider.id).toBe("local");
    expect(provider.status).toBe("ready");
  });

  it("throws for unknown providers", () => {
    const registry = createRegistry(manifest, "/tmp/multipass.yaml");
    expect(() => registry.resolve("missing", "fixture")).toThrow(/Unknown provider/);
  });

  it("throws for disabled providers", () => {
    const localProvider = manifest.providers.local;
    expect(localProvider).toBeDefined();

    const disabledManifest: ManifestDefinition = {
      ...manifest,
      providers: {
        local: {
          ...localProvider!,
          status: "disabled",
        },
      },
    };
    const registry = createRegistry(disabledManifest, "/tmp/multipass.yaml");
    expect(() => registry.resolve("local", "fixture")).toThrow(/disabled/);
  });

  it("resolves native slack providers", () => {
    const slackManifest: ManifestDefinition = {
      ...manifest,
      providers: {
        slack: {
          adapter: "slack",
          capabilities: ["probe", "send", "roundtrip", "agent"],
          env: [],
          platform: "slack",
          slack: {
            recorder: { path: "/tmp/multipass-slack-test.jsonl" },
            webhook: {
              host: "127.0.0.1",
              path: "/slack/events",
              port: 0,
            },
          },
          status: "active",
        },
      },
      fixtures: [
        {
          ...manifest.fixtures[0]!,
          id: "slack-fixture",
          provider: "slack",
          target: {
            channelId: "C1234567890",
            id: "C1234567890",
            metadata: {},
          },
        },
      ],
    };

    const registry = createRegistry(slackManifest, "/tmp/multipass.yaml");
    const provider = registry.resolve("slack", "slack-fixture");
    expect(provider.id).toBe("slack");
    expect(provider.platform).toBe("slack");
    expect(provider.status).toBe("ready");
  });
});
