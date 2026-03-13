import { access, readFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { MultipassError } from "../core/errors.js";
import { type ManifestDefinition, ManifestSchema } from "./schema.js";

const DEFAULT_CONFIG_CANDIDATES = ["multipass.yaml", "multipass.yml", "multipass.json"] as const;

export async function resolveConfigPath(explicitPath?: string): Promise<string> {
  if (explicitPath) {
    return path.resolve(explicitPath);
  }

  for (const candidate of DEFAULT_CONFIG_CANDIDATES) {
    const resolved = path.resolve(candidate);
    try {
      await access(resolved);
      return resolved;
    } catch {
      continue;
    }
  }

  throw new MultipassError(
    "No config file found. Create multipass.yaml, multipass.yml, or multipass.json.",
    { kind: "config" },
  );
}

export async function loadManifest(
  configPath?: string,
): Promise<{ manifest: ManifestDefinition; path: string }> {
  const resolvedPath = await resolveConfigPath(configPath);
  const raw = await readFile(resolvedPath, "utf8");
  const parsed = resolvedPath.endsWith(".json") ? JSON.parse(raw) : YAML.parse(raw);
  const manifest = ManifestSchema.parse(parsed);
  return { manifest, path: resolvedPath };
}
