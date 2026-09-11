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

  // The builder is legitimately used by deploy.yml, which is only triggerable
  // by a push to main or a manual dispatch — never by a pull request. If that
  // trigger ever widens, the check above would not catch it, so pin it here.
  it("keeps the self-hosted builder reachable only from non-PR triggers", () => {
    expect(runnerTargets(deploy).some((target) => target.includes("self-hosted"))).toBe(true);
    expect(triggers(deploy)).not.toContain("pull_request:");
  });
});
