import { afterEach, describe, expect, it } from "vitest";

import { startLearningServer } from "../server.mjs";

const servers = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise((resolve) => {
          server.close(resolve);
        }),
    ),
  );
});

async function start() {
  const server = await startLearningServer({ port: 0 });
  servers.push(server);
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Expected an IP server address");
  return `http://127.0.0.1:${address.port}`;
}

describe("LR Machine server", () => {
  it("serves the dashboard and structured project data", async () => {
    const baseUrl = await start();
    const [page, api] = await Promise.all([
      fetch(`${baseUrl}/`),
      fetch(`${baseUrl}/api/project`),
    ]);

    expect(page.status).toBe(200);
    expect(page.headers.get("content-security-policy")).toContain(
      "default-src 'self'",
    );
    expect(await page.text()).toContain("LEARNING MACHINE");

    expect(api.status).toBe(200);
    const data = await api.json();
    expect(data.project.name).toBe("kflow-code");
    expect(data.progress.currentTask.id).toBe("P0.3");
    expect(JSON.stringify(data)).not.toContain(process.cwd());
  });

  it("rejects mutation and traversal-shaped snapshot requests", async () => {
    const baseUrl = await start();
    const [post, traversal] = await Promise.all([
      fetch(`${baseUrl}/api/project`, { method: "POST" }),
      fetch(`${baseUrl}/snapshots/%2e%2e%2fpackage.json`),
    ]);

    expect(post.status).toBe(405);
    expect([400, 404]).toContain(traversal.status);
  });
});
