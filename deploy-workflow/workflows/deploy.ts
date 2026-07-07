import { sleep, FatalError, RetryableError } from "workflow";
import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const PAPERCLIP_DIR = join(import.meta.dirname, "../..");

type DeployResult = {
  url: string;
  healthStatus: number;
  durationMs: number;
};

async function ensureProjectJson() {
  "use step";
  const projectJsonPath = join(PAPERCLIP_DIR, ".vercel/project.json");
  const raw = readFileSync(projectJsonPath, "utf8");
  const config = JSON.parse(raw);

  if (config.settings?.rootDirectory !== null) {
    const fixed = {
      ...config,
      settings: { ...config.settings, rootDirectory: null },
    };
    writeFileSync(projectJsonPath, JSON.stringify(fixed, null, 2));
    return { fixed: true, previous: config.settings?.rootDirectory };
  }
  return { fixed: false };
}

async function runVercelBuild() {
  "use step";
  try {
    execSync("vercel build --yes --prod", {
      cwd: PAPERCLIP_DIR,
      stdio: "inherit",
      timeout: 300_000,
    });
  } catch (err) {
    throw new RetryableError(`vercel build failed: ${err}`, {
      retryAfter: "30s",
    });
  }
}

async function runVercelDeploy(): Promise<string> {
  "use step";
  try {
    const output = execSync("vercel deploy --prebuilt --prod", {
      cwd: PAPERCLIP_DIR,
      timeout: 120_000,
    });
    const url = output.toString().trim().split("\n").pop() ?? "";
    if (!url.startsWith("https://")) {
      throw new FatalError(`Unexpected deploy output: ${output}`);
    }
    return url;
  } catch (err) {
    if (err instanceof FatalError) throw err;
    throw new RetryableError(`vercel deploy failed: ${err}`, {
      retryAfter: "30s",
    });
  }
}

async function checkHealth(url: string): Promise<number> {
  "use step";
  const res = await fetch(`${url}/api/health`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status >= 500) {
    throw new RetryableError(`Health check returned ${res.status}`, {
      retryAfter: "10s",
    });
  }
  return res.status;
}

export async function deployPaperclip(): Promise<DeployResult> {
  "use workflow";
  const startMs = Date.now();

  await ensureProjectJson();
  await runVercelBuild();

  const url = await runVercelDeploy();

  // Wait for propagation before health check
  await sleep("10s");

  const healthStatus = await checkHealth(url);

  return {
    url,
    healthStatus,
    durationMs: Date.now() - startMs,
  };
}
