import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProviderConfig } from "../src/config/schema.js";
import type { ProviderContext } from "../src/providers/types.js";
import { createTempDir, disposeTempDir } from "./test-helpers.js";

const directories: string[] = [];
const envSnapshot = { ...process.env };

afterEach(async () => {
  vi.resetModules();
  vi.doUnmock("@beeper/chat-adapter-matrix");
  vi.doUnmock("@chat-adapter/state-memory");
  vi.doUnmock("chat");
  for (const key of Object.keys(process.env)) {
    if (!(key in envSnapshot)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, envSnapshot);
  await Promise.all(directories.splice(0).map(disposeTempDir));
});

async function createConfig(
  matrix?: Partial<NonNullable<ProviderConfig["matrix"]>>,
): Promise<ProviderConfig> {
  const directory = await createTempDir();
  directories.push(directory);

  return {
    adapter: "matrix",
    capabilities: ["probe"],
    env: [],
    matrix: {
      recorder: { path: path.join(directory, "matrix.jsonl") },
      ...matrix,
    },
    platform: "matrix",
    status: "active",
  };
}

function createContext(config: ProviderConfig): ProviderContext {
  return {
    config,
    fixture: {
      env: [],
      id: "matrix-fixture",
      inboundMatch: { author: "assistant", nonce: "contains", strategy: "contains" },
      mode: "probe",
      provider: "matrix-native",
      retries: 0,
      tags: [],
      target: { id: "!room:example.com", metadata: {} },
      timeoutMs: 100,
    },
    manifestPath: "/tmp/multipass.yaml",
    providerId: "matrix-native",
    userName: "multipass",
  };
}

async function importProviderWithMocks() {
  vi.resetModules();

  const fetchChannelInfo = vi.fn(async () => ({ ok: true }));
  const postMessage = vi.fn(async (threadId: string) => ({ id: "sent", threadId }));
  const createMatrixAdapter = vi.fn(() => ({
    fetchChannelInfo,
    postMessage,
  }));

  vi.doMock("@beeper/chat-adapter-matrix", () => ({
    createMatrixAdapter,
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

  const module = await import("../src/providers/builtin/matrix.js");
  return {
    MatrixProviderAdapter: module.MatrixProviderAdapter,
    createMatrixAdapter,
    fetchChannelInfo,
  };
}

describe("matrix provider default runtime", () => {
  it("forwards config-based password auth to the community adapter", async () => {
    const { MatrixProviderAdapter, createMatrixAdapter, fetchChannelInfo } =
      await importProviderWithMocks();
    const config = await createConfig({
      auth: {
        password: "secret",
        type: "password",
        userID: "@bot:example.com",
        username: "bot",
      },
      baseURL: "https://matrix.example.com",
      commandPrefix: "!",
      recoveryKey: "recovery",
      roomAllowlist: ["!room:example.com"],
    });
    const provider = new MatrixProviderAdapter("matrix-native", config, "multipass");

    await expect(provider.probe(createContext(config))).resolves.toMatchObject({ healthy: true });

    expect(createMatrixAdapter).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: {
          password: "secret",
          type: "password",
          userID: "@bot:example.com",
          username: "bot",
        },
        baseURL: "https://matrix.example.com",
        commandPrefix: "!",
        recoveryKey: "recovery",
        roomAllowlist: ["!room:example.com"],
        userName: "multipass",
      }),
    );
    expect(fetchChannelInfo).toHaveBeenCalledWith("matrix:!room%3Aexample.com");
  });

  it("falls back to env auth and base url", async () => {
    process.env.MATRIX_ACCESS_TOKEN = "env-token";
    process.env.MATRIX_BASE_URL = "https://env-matrix.example.com";
    process.env.MATRIX_USER_ID = "@env:example.com";

    const { MatrixProviderAdapter, createMatrixAdapter } = await importProviderWithMocks();
    const config = await createConfig();
    const provider = new MatrixProviderAdapter("matrix-native", config, "multipass");

    await expect(provider.probe(createContext(config))).resolves.toMatchObject({ healthy: true });

    expect(createMatrixAdapter).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: {
          accessToken: "env-token",
          type: "accessToken",
          userID: "@env:example.com",
        },
        baseURL: "https://env-matrix.example.com",
      }),
    );
  });

  it("fails fast when matrix base url is missing", async () => {
    const { MatrixProviderAdapter } = await importProviderWithMocks();
    const config = await createConfig({
      auth: {
        accessToken: "token",
        type: "accessToken",
      },
    });
    const provider = new MatrixProviderAdapter("matrix-native", config, "multipass");

    await expect(provider.probe(createContext(config))).rejects.toMatchObject({ kind: "config" });
  });

  it("fails fast when matrix auth is missing", async () => {
    const { MatrixProviderAdapter } = await importProviderWithMocks();
    const config = await createConfig({
      baseURL: "https://matrix.example.com",
    });
    const provider = new MatrixProviderAdapter("matrix-native", config, "multipass");

    await expect(provider.probe(createContext(config))).rejects.toMatchObject({ kind: "config" });
  });
});
