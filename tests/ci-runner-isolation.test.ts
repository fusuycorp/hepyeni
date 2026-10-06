import { describe, expect, it } from "bun:test";

const ci = await Bun.file(new URL("../.github/workflows/ci.yml", import.meta.url)).text();
const deploy = await Bun.file(new URL("../.github/workflows/deploy.yml", import.meta.url)).text();

// Parse the actual `runs-on:` values rather than grepping the whole file: the
// rationale comments below legitimately mention "self-hosted", and a raw
// substring check would trip on its own documentation.
const runnerTargets = (workflow: string): string[] =>
  workflow
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("runs-on:"))
    .map((line) => line.slice("runs-on:".length).trim());

const triggers = (workflow: string): string[] =>
  workflow
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[a-z_]+:$/.test(line));

describe("CI runner isolation", () => {
  // This repository is public, so `pull_request` fires for fork PRs too.
  // Untrusted PR code must therefore never execute on the self-hosted builder
  // (OCocuk): that host holds the registry credentials which production pulls
  // images with, so a fork PR running there could push a poisoned image tag.
  // Hosted minutes are free for public repos, so PR checks stay on GitHub's
  // ephemeral runners and the builder is reserved for push-to-main builds.
  it("never schedules PR-triggered CI on a self-hosted runner", () => {
    expect(triggers(ci)).toContain("pull_request:");

    const targets = runnerTargets(ci);
    expect(targets.length).toBeGreaterThan(0);
    for (const target of targets) {
      expect(target).not.toContain("self-hosted");
    }
  });

  // Following ADR-011 fleet consolidation, self-hosted builder OCocuk is
  // retired. All workflows (CI and deploy) execute strictly on ephemeral
  // GitHub-hosted runners (ubuntu-latest or ubuntu-24.04-arm). Deploy remains
  // strictly isolated from pull_request triggers to prevent untrusted execution of deployment steps.
  it("enforces ephemeral GitHub-hosted runners and prevents PR triggers on deploy", () => {
    const targets = runnerTargets(deploy);
    expect(targets.length).toBeGreaterThan(0);
    for (const target of targets) {
      expect(target).not.toContain("self-hosted");
    }
    expect(triggers(deploy)).not.toContain("pull_request:");
  });
});
