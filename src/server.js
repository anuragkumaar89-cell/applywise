import { createServer as createHttpServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { openDatabase } from "./db.js";
import { HttpError, STATUSES, validateApplication } from "./validation.js";

const publicDirectory = fileURLToPath(new URL("../public/", import.meta.url));
const staticFiles = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]]
]);

function sendJson(response, status, value) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}

async function readJson(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1_000_000) {
      throw new HttpError(413, "Request body is too large.");
    }
  }

  try {
    return JSON.parse(body);
  } catch {
    throw new HttpError(400, "Request body must contain valid JSON.");
  }
}

function mapApplication(row) {
  return {
    id: row.id,
    company: row.company,
    role: row.role,
    status: row.status,
    appliedOn: row.applied_on,
    url: row.url,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function applicationList(db, url) {
  const search = (url.searchParams.get("search") ?? "").trim();
  const status = url.searchParams.get("status") ?? "";
  if (status && !STATUSES.includes(status)) {
    throw new HttpError(400, "Unknown application status.");
  }

  const conditions = [];
  const params = [];
  if (search) {
    conditions.push("(company LIKE ? COLLATE NOCASE OR role LIKE ? COLLATE NOCASE)");
    params.push(`%${search}%`, `%${search}%`);
  }
  if (status) {
    conditions.push("status = ?");
    params.push(status);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = db.prepare(`
    SELECT * FROM applications
    ${where}
    ORDER BY COALESCE(applied_on, substr(created_at, 1, 10)) DESC, id DESC
  `).all(...params);
  return rows.map(mapApplication);
}

function applicationStats(db) {
  const rows = db.prepare(`
    SELECT status, COUNT(*) AS count
    FROM applications
    GROUP BY status
  `).all();
  const byStatus = Object.fromEntries(STATUSES.map((status) => [status, 0]));
  for (const row of rows) {
    byStatus[row.status] = row.count;
  }

  const total = Object.values(byStatus).reduce((sum, count) => sum + count, 0);
  const responses = byStatus.Interview + byStatus.Offer + byStatus.Rejected;
  const submitted = total - byStatus.Wishlist;
  return {
    total,
    active: byStatus.Wishlist + byStatus.Applied + byStatus.Interview,
    interviews: byStatus.Interview,
    offers: byStatus.Offer,
    responseRate: submitted === 0 ? 0 : Math.round((responses / submitted) * 100),
    byStatus
  };
}

function createApiHandler(db) {
  return async (request, response, url) => {
    if (request.method === "GET" && url.pathname === "/api/health") {
      sendJson(response, 200, { status: "ok" });
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/stats") {
      sendJson(response, 200, applicationStats(db));
      return;
    }
    if (url.pathname === "/api/applications" && request.method === "POST") {
      const input = await readJson(request);
      const application = validateApplication(input);
      const result = db.prepare(`
        INSERT INTO applications (company, role, status, applied_on, url, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        application.company,
        application.role,
        application.status,
        application.appliedOn,
        application.url,
        application.notes
      );
      const created = db.prepare("SELECT * FROM applications WHERE id = ?").get(Number(result.lastInsertRowid));
      sendJson(response, 201, mapApplication(created));
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/applications") {
      sendJson(response, 200, applicationList(db, url));
      return;
    }

    const match = url.pathname.match(/^\/api\/applications\/(\d+)$/);
    if (!match) {
      throw new HttpError(404, "API route not found.");
    }
    const id = Number(match[1]);
    const existing = db.prepare("SELECT * FROM applications WHERE id = ?").get(id);
    if (!existing) {
      throw new HttpError(404, "Application not found.");
    }

    if (request.method === "GET") {
      sendJson(response, 200, mapApplication(existing));
      return;
    }
    if (request.method === "PATCH") {
      const input = await readJson(request);
      const application = validateApplication(input, mapApplication(existing));
      db.prepare(`
        UPDATE applications
        SET company = ?, role = ?, status = ?, applied_on = ?, url = ?, notes = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(
        application.company,
        application.role,
        application.status,
        application.appliedOn,
        application.url,
        application.notes,
        id
      );
      sendJson(response, 200, mapApplication(db.prepare("SELECT * FROM applications WHERE id = ?").get(id)));
      return;
    }
    if (request.method === "DELETE") {
      db.prepare("DELETE FROM applications WHERE id = ?").run(id);
      response.writeHead(204);
      response.end();
      return;
    }
    throw new HttpError(405, "Method not allowed.");
  };
}

export function createServer({ dbPath } = {}) {
  const db = openDatabase(dbPath);
  const handleApi = createApiHandler(db);
  const server = createHttpServer(async (request, response) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    response.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"
    );

    const url = new URL(request.url, "http://localhost");
    try {
      if (url.pathname.startsWith("/api/")) {
        await handleApi(request, response, url);
        return;
      }

      const file = staticFiles.get(url.pathname);
      if (!file || request.method !== "GET") {
        throw new HttpError(404, "Page not found.");
      }
      const [filename, contentType] = file;
      const contents = await readFile(join(publicDirectory, filename));
      response.writeHead(200, { "Content-Type": contentType });
      response.end(contents);
    } catch (error) {
      if (error instanceof HttpError) {
        sendJson(response, error.status, { error: error.message });
        return;
      }
      console.error("Request failed:", error);
      sendJson(response, 500, { error: "An unexpected server error occurred." });
    }
  });

  return {
    server,
    close() {
      db.close();
    }
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { server } = createServer();
  const port = Number(process.env.PORT ?? 3000);
  server.listen(port, "127.0.0.1", () => {
    console.log(`ApplyWise is running at http://localhost:${port}`);
  });
}
