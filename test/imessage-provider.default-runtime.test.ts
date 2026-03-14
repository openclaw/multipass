import { describe, expect, it } from "vitest";
import { resolveIMessageAdapterConfig } from "../src/providers/builtin/imessage.js";
import type { ProviderConfig } from "../src/config/schema.js";

function createConfig(imessage?: Partial<NonNullable<ProviderConfig["imessage"]>>): ProviderConfig {
  return {
    adapter: "imessage",
    capabilities: ["probe"],
    env: [],
    imessage: {
      gatewayDurationMs: 60_000,
      recorder: {},
      ...imessage,
    },
    platform: "imessage",
    status: "active",
  };
}

describe("imessage provider default runtime", () => {
  it("builds remote gateway config from explicit provider settings", () => {
    const config = createConfig({
      apiKey: "api-key",
      local: false,
      serverUrl: "https://imessage.example.com",
    });

    expect(resolveIMessageAdapterConfig(config)).toEqual({
      apiKey: "api-key",
      local: false,
      serverUrl: "https://imessage.example.com",
    });
  });

  it("falls back to env-based remote gateway config", () => {
    const config = createConfig();

    expect(
      resolveIMessageAdapterConfig(config, {
        IMESSAGE_API_KEY: "env-api-key",
        IMESSAGE_LOCAL: "false",
        IMESSAGE_SERVER_URL: "https://env-imessage.example.com",
      }),
    ).toEqual({
      apiKey: "env-api-key",
      local: false,
      serverUrl: "https://env-imessage.example.com",
    });
  });

  it("fails fast when remote mode is missing api key or server url", () => {
    const config = createConfig();

    expect(() =>
      resolveIMessageAdapterConfig(config, {
        IMESSAGE_API_KEY: undefined,
        IMESSAGE_LOCAL: "false",
        IMESSAGE_SERVER_URL: undefined,
      }),
    ).toThrow(/remote mode/u);
  });
});
