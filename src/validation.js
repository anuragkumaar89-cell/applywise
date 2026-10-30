export const STATUSES = ["Wishlist", "Applied", "Interview", "Offer", "Rejected"];

const editableFields = new Set(["company", "role", "status", "appliedOn", "url", "notes"]);

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function validateUrl(value) {
  if (value === null || value === "") {
    return null;
  }
  if (typeof value !== "string" || value.length > 2048) {
    throw new HttpError(400, "Application URL must be at most 2048 characters.");
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new HttpError(400, "Enter a valid application URL.");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new HttpError(400, "Application URL must use HTTP or HTTPS.");
  }
  return url.toString();
}

export function validateApplication(input, existing = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new HttpError(400, "Request body must be a JSON object.");
  }

  for (const key of Object.keys(input)) {
    if (!editableFields.has(key)) {
      throw new HttpError(400, `Unknown field: ${key}.`);
    }
  }

  const company = input.company === undefined ? existing.company : input.company;
  const role = input.role === undefined ? existing.role : input.role;
  const status = input.status === undefined ? existing.status ?? "Wishlist" : input.status;
  const appliedOn = input.appliedOn === undefined ? existing.appliedOn ?? null : input.appliedOn;
  const url = input.url === undefined ? existing.url ?? null : input.url;
  const notes = input.notes === undefined ? existing.notes ?? "" : input.notes;

  if (typeof company !== "string" || !company.trim() || company.trim().length > 120) {
    throw new HttpError(400, "Company is required and must be at most 120 characters.");
  }
  if (typeof role !== "string" || !role.trim() || role.trim().length > 160) {
    throw new HttpError(400, "Role is required and must be at most 160 characters.");
  }
  if (!STATUSES.includes(status)) {
    throw new HttpError(400, `Status must be one of: ${STATUSES.join(", ")}.`);
  }
  if (appliedOn !== null && appliedOn !== "" && !isValidDate(appliedOn)) {
    throw new HttpError(400, "Application date must be a valid date in YYYY-MM-DD format.");
  }
  if (typeof notes !== "string" || notes.length > 4000) {
    throw new HttpError(400, "Notes must be at most 4000 characters.");
  }

  return {
    company: company.trim(),
    role: role.trim(),
    status,
    appliedOn: appliedOn || null,
    url: validateUrl(url),
    notes: notes.trim()
  };
}
