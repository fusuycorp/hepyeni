import { describe, expect, it } from "bun:test";

const compose = await Bun.file(new URL("../docker-compose.yml", import.meta.url)).text();
const dockerfile = await Bun.file(new URL("../Dockerfile", import.meta.url)).text();
const envExample = await Bun.file(new URL("../.env.example", import.meta.url)).text();

describe("LLM deployment configuration", () => {
  it("passes LLM settings at container runtime", () => {
    for (const variable of ["FLAG_ENABLE_LLM_EXTRACT", "LLM_API_URL", "LLM_API_KEY", "LLM_MODEL"]) {
      expect(compose).toContain(`${variable}=`);
      expect(envExample).toContain(`${variable}=`);
    }
  });

  it("does not put the LLM secret in the image build", () => {
    expect(dockerfile).not.toContain("LLM_API_KEY");
    expect(dockerfile).not.toContain("ARG ");
    expect(dockerfile).not.toContain("ENV LLM_");
  });
});
