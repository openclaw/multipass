import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProviderConfig } from "../src/config/schema.js";
import type { ProviderContext } from "../src/providers/types.js";
import { createTempDir, disposeTempDir } from "./test-helpers.js";

const directories: string[] = [];
const envSnapshot = { ...process.env };

afterEach(async () => {
  vi.resetModules();
  vi.doUnmock("@chat-adapter/state-memory");
  vi.doUnmock("chat");
  vi.doUnmock("chat-adapter-imessage");
  for (const key of Object.keys(process.env)) {
    if (!(key in envSnapshot)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, envSnapshot);
  await Promise.all(directories.splice(0).map(disposeTempDir));
});

async function createConfig(
  imessage?: Partial<NonNullable<ProviderConfig["imessage"]>>,
): Promise<ProviderConfig> {
  const directory = await createTempDir();
  directories.push(directory);

  return {
    adapter: "imessage",
    capabilities: ["probe"],
    env: [],
    imessage: {
      gatewayDurationMs: 60_000,
      recorder: { path: path.join(directory, "imessage.jsonl") },
      ...imessage,
    },
    platform: "imessage",
    status: "active",
  };
}

function createContext(config: ProviderConfig): ProviderContext {
  return {
    config,
    fixture: {
      env: [],
      id: "imessage-fixture",
      inboundMatch: { author: "assistant", nonce: "contains", strategy: "contains" },
      mode: "probe",
      provider: "imessage-native",
      retries: 0,
      tags: [],
      target: { id: "chat-guid", metadata: {} },
      timeoutMs: 100,
    },
    manifestPath: "/tmp/multipass.yaml",
    providerId: "imessage-native",
    userName: "multipass",
  };
}

async function importProviderWithMocks() {
  vi.resetModules();

  const fetchThread = vi.fn(async () => ({ ok: true }));
  const createiMessageAdapter = vi.fn(() => ({
    fetchThread,
    postMessage: vi.fn(async (threadId: string) => ({ id: "sent", threadId })),
    startGatewayListener: vi.fn(async () => new Response("ok", { status: 200 })),
  }));

  vi.doMock("chat-adapter-imessage", () => ({
    createiMessageAdapter,
  }));
  vi.doMock("@chat-adapter/state-memory", () => ({
    createMemoryState: vi.fn(() => ({})),
  }));
  vi.doMock("chat", () => ({
    Chat: class {
      getState() {
        return { subscribe: vi.fn(async () => {}) };
      }
      async initialize() {}
      onDirectMessage() {}
      onNewMention() {}
      onNewMessage() {}
      onSubscribedMessage() {}
    },
  }));

  const module = await import("../src/providers/builtin/imessage.js");
  return {
    IMessageProviderAdapter: module.IMessageProviderAdapter,
    createiMessageAdapter,
    fetchThread,
  };
}

describe("imessage provider default runtime", () => {
  it("forwards remote gateway config to the community adapter", async () => {
    const { IMessageProviderAdapter, createiMessageAdapter, fetchThread } =
      await importProviderWithMocks();
    const config = await createConfig({
      apiKey: "api-key",
      local: false,
      serverUrl: "https://imessage.example.com",
    });
    const provider = new IMessageProviderAdapter("imessage-native", config, "multipass");

    await expect(provider.probe(createContext(config))).resolves.toMatchObject({ healthy: true });

    expect(createiMessageAdapter).toHaveBeenCalledWith({
      apiKey: "api-key",
      local: false,
      serverUrl: "https://imessage.example.com",
    });
    expect(fetchThread).toHaveBeenCalledWith("imessage:chat-guid");
  });

  it("falls back to env-based remote gateway config", async () => {
    process.env.IMESSAGE_LOCAL = "false";
    process.env.IMESSAGE_API_KEY = "env-api-key";
    process.env.IMESSAGE_SERVER_URL = "https://env-imessage.example.com";

    const { IMessageProviderAdapter, createiMessageAdapter } = await importProviderWithMocks();
    const config = await createConfig();
    const provider = new IMessageProviderAdapter("imessage-native", config, "multipass");

    await expect(provider.probe(createContext(config))).resolves.toMatchObject({ healthy: true });

    expect(createiMessageAdapter).toHaveBeenCalledWith({
      apiKey: "env-api-key",
      local: false,
      serverUrl: "https://env-imessage.example.com",
    });
  });

  it("fails fast when remote mode is missing api key or server url", async () => {
    process.env.IMESSAGE_LOCAL = "false";

    const { IMessageProviderAdapter } = await importProviderWithMocks();
    const config = await createConfig();
    const provider = new IMessageProviderAdapter("imessage-native", config, "multipass");

    await expect(provider.probe(createContext(config))).rejects.toMatchObject({ kind: "config" });
  });
});
