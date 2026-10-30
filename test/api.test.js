import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { createServer } from "../src/server.js";

let server;
let closeDatabase;
let baseUrl;
let temporaryDirectory;

before(async () => {
  temporaryDirectory = await mkdtemp(join(tmpdir(), "applywise-test-"));
  const application = createServer({ dbPath: join(temporaryDirectory, "test.sqlite") });
  server = application.server;
  closeDatabase = application.close;
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  closeDatabase();
  await rm(temporaryDirectory, { recursive: true, force: true });
});

async function request(path, options) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = response.status === 204 ? null : await response.json();
  return { response, body };
}

test("serves the dashboard and reports health", async () => {
  const page = await fetch(baseUrl);
  assert.equal(page.status, 200);
  assert.match(page.headers.get("content-type"), /text\/html/);

  const { response, body } = await request("/api/health");
  assert.equal(response.status, 200);
  assert.deepEqual(body, { status: "ok" });
});

test("creates applications, filters them, and reports pipeline stats", async () => {
  const created = await request("/api/applications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      company: "Northstar Labs",
      role: "Software Engineer",
      status: "Interview",
      appliedOn: "2026-10-28",
      url: "https://example.com/jobs/42",
      notes: "Technical round next week"
    })
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.body.company, "Northstar Labs");
  assert.equal(created.body.status, "Interview");
  assert.equal(created.body.appliedOn, "2026-10-28");

  const filtered = await request("/api/applications?search=northstar&status=Interview");
  assert.equal(filtered.body.length, 1);
  assert.equal(filtered.body[0].id, created.body.id);

  const wishlist = await request("/api/applications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ company: "Paper Kite", role: "Designer", status: "Wishlist" })
  });
  assert.equal(wishlist.response.status, 201);

  const stats = await request("/api/stats");
  assert.equal(stats.body.total, 2);
  assert.equal(stats.body.interviews, 1);
  assert.equal(stats.body.responseRate, 100);
});

test("updates and deletes an application", async () => {
  const created = await request("/api/applications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ company: "Acme", role: "Developer" })
  });
  const updated = await request(`/api/applications/${created.body.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "Offer" })
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.body.company, "Acme");
  assert.equal(updated.body.status, "Offer");

  const deleted = await request(`/api/applications/${created.body.id}`, { method: "DELETE" });
  assert.equal(deleted.response.status, 204);
  const missing = await request(`/api/applications/${created.body.id}`);
  assert.equal(missing.response.status, 404);
});

test("rejects invalid input and unknown fields", async () => {
  const invalidDate = await request("/api/applications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ company: "Acme", role: "Engineer", appliedOn: "2026-02-31" })
  });
  assert.equal(invalidDate.response.status, 400);
  assert.match(invalidDate.body.error, /valid date/);

  const unsafeUrl = await request("/api/applications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ company: "Acme", role: "Engineer", url: "javascript:alert(1)" })
  });
  assert.equal(unsafeUrl.response.status, 400);

  const unknownField = await request("/api/applications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ company: "Acme", role: "Engineer", isAdmin: true })
  });
  assert.equal(unknownField.response.status, 400);

  const malformedJson = await fetch(`${baseUrl}/api/applications`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{invalid"
  });
  assert.equal(malformedJson.status, 400);
});

test("rejects invalid status filters and missing application ids", async () => {
  const invalidFilter = await request("/api/applications?status=Hired");
  assert.equal(invalidFilter.response.status, 400);
  const missing = await request("/api/applications/99999");
  assert.equal(missing.response.status, 404);
});
