import { describe, expect, it } from "vitest";
import { resolveDiscordAdapterConfig } from "../src/providers/builtin/discord.js";
import type { ProviderConfig } from "../src/config/schema.js";

function createConfig(discord?: Partial<NonNullable<ProviderConfig["discord"]>>): ProviderConfig {
  return {
    adapter: "discord",
    capabilities: ["probe"],
    discord: {
      gatewayDurationMs: 60_000,
      recorder: {},
      webhook: {
        host: "127.0.0.1",
        path: "/discord/interactions",
        port: 8788,
      },
      ...discord,
    },
    env: [],
    platform: "discord",
    status: "active",
  };
}

describe("discord provider default runtime", () => {
  it("builds native discord adapter config from provider settings", () => {
    const config = createConfig({
      applicationId: "123456789012345678",
      botToken: "discord-token",
      mentionRoleIds: ["111", "222"],
      publicKey: "a".repeat(64),
    });

    expect(resolveDiscordAdapterConfig(config, "multipass")).toEqual({
      applicationId: "123456789012345678",
      botToken: "discord-token",
      mentionRoleIds: ["111", "222"],
      publicKey: "a".repeat(64),
      userName: "multipass",
    });
  });

  it("falls back to env-based config", () => {
    const config = createConfig();

    expect(
      resolveDiscordAdapterConfig(config, "multipass", {
        DISCORD_APPLICATION_ID: "123456789012345678",
        DISCORD_BOT_TOKEN: "env-token",
        DISCORD_PUBLIC_KEY: "b".repeat(64),
      }),
    ).toEqual({
      applicationId: "123456789012345678",
      botToken: "env-token",
      publicKey: "b".repeat(64),
      userName: "multipass",
    });
  });

  it("fails fast when required discord credentials are missing", () => {
    const config = createConfig();

    expect(() =>
      resolveDiscordAdapterConfig(config, "multipass", {
        DISCORD_APPLICATION_ID: undefined,
        DISCORD_BOT_TOKEN: undefined,
        DISCORD_PUBLIC_KEY: undefined,
      }),
    ).toThrow(/application ID is required/u);
  });
});
