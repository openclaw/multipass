import { MultipassError } from "../core/errors.js";
import type { ManifestDefinition } from "../config/schema.js";
import { LoopbackProviderAdapter } from "./builtin/loopback.js";
import { SlackProviderAdapter } from "./builtin/slack.js";
import { ScriptProviderAdapter } from "./builtin/script.js";
import { OPENCLAW_SUPPORT_CATALOG } from "./catalog.js";
import type { ProviderAdapter, ProviderContext } from "./types.js";

export type Registry = {
  catalog: typeof OPENCLAW_SUPPORT_CATALOG;
  resolve(providerId: string, fixtureId: string): ProviderAdapter;
};

export function createRegistry(manifest: ManifestDefinition, manifestPath: string): Registry {
  return {
    catalog: OPENCLAW_SUPPORT_CATALOG,
    resolve(providerId, fixtureId) {
      const fixture = manifest.fixtures.find((entry) => entry.id === fixtureId);
      if (!fixture) {
        throw new MultipassError(`Unknown fixture: ${fixtureId}`, { kind: "config" });
      }

      const config = manifest.providers[providerId];
      if (!config) {
        throw new MultipassError(`Unknown provider: ${providerId}`, { kind: "config" });
      }

      if (config.status === "disabled") {
        throw new MultipassError(`Provider "${providerId}" is disabled.`, { kind: "config" });
      }

      const context: ProviderContext = {
        config,
        fixture,
        manifestPath,
        providerId,
        userName: manifest.userName,
      };

      if (config.adapter === "loopback") {
        return new LoopbackProviderAdapter(providerId, config, manifest.userName);
      }

      if (config.adapter === "slack") {
        return new SlackProviderAdapter(providerId, config, manifest.userName);
      }

      return new ScriptProviderAdapter(context);
    },
  };
}
