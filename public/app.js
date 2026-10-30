const statuses = ["Wishlist", "Applied", "Interview", "Offer", "Rejected"];
const listElement = document.querySelector("#applicationList");
const emptyState = document.querySelector("#emptyState");
const form = document.querySelector("#applicationForm");
const formError = document.querySelector("#formError");
const searchInput = document.querySelector("#searchInput");
const statusFilter = document.querySelector("#statusFilter");
const formPanel = document.querySelector("#formPanel");
let applications = [];
let searchTimer;
let toastTimer;

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error ?? `Request failed (${response.status}).`);
  }
  return response.status === 204 ? null : response.json();
}

function setFormError(message = "") {
  formError.textContent = message;
  formError.hidden = !message;
}

function formatDate(value) {
  if (!value) return "Date not set";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" })
    .format(new Date(`${value}T00:00:00`));
}

function renderPipeline(byStatus) {
  const pipeline = document.querySelector("#pipeline");
  pipeline.replaceChildren();
  for (const status of statuses) {
    const item = document.createElement("button");
    item.className = "pipeline-item";
    item.type = "button";
    item.setAttribute("aria-label", `Filter applications by ${status}`);
    item.setAttribute("aria-pressed", String(statusFilter.value === status));
    const label = document.createElement("span");
    label.className = "pipeline-label";
    label.textContent = status;
    const count = document.createElement("strong");
    count.className = "pipeline-count";
    count.textContent = byStatus[status] ?? 0;
    const track = document.createElement("span");
    track.className = "pipeline-track";
    const fill = document.createElement("span");
    fill.className = "pipeline-fill";
    fill.style.width = `${byStatus[status] ? Math.max(12, (byStatus[status] / Math.max(1, ...Object.values(byStatus))) * 100) : 0}%`;
    track.append(fill);
    item.append(label, count, track);
    item.addEventListener("click", () => {
      statusFilter.value = statusFilter.value === status ? "" : status;
      statusFilter.dispatchEvent(new Event("change"));
    });
    pipeline.append(item);
  }
}

function renderStats(stats) {
  document.querySelector("#statTotal").textContent = stats.total;
  document.querySelector("#statActive").textContent = stats.active;
  document.querySelector("#statInterviews").textContent = stats.interviews;
  document.querySelector("#statResponseRate").textContent = stats.responseRate;
  renderPipeline(stats.byStatus);
}

function createActionButton(label, symbol, handler) {
  const button = document.createElement("button");
  button.className = "icon-button";
  button.type = "button";
  button.textContent = symbol;
  button.setAttribute("aria-label", label);
  button.addEventListener("click", handler);
  return button;
}

function renderApplication(application) {
  const card = document.createElement("article");
  card.className = "application-card";

  const identity = document.createElement("div");
  identity.className = "company-row";
  const logo = document.createElement("span");
  logo.className = "company-logo";
  logo.setAttribute("aria-hidden", "true");
  logo.textContent = application.company.trim().charAt(0).toUpperCase();
  const details = document.createElement("div");
  const company = document.createElement("p");
  company.className = "company-name";
  company.textContent = application.company;
  const role = document.createElement("p");
  role.className = "role-name";
  role.textContent = application.role;
  details.append(company, role);
  if (application.url) {
    const link = document.createElement("a");
    link.href = application.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Open job posting ↗";
    link.className = "job-link";
    details.append(link);
  }
  identity.append(logo, details);

  const meta = document.createElement("div");
  meta.className = "application-meta";
  const badge = document.createElement("span");
  badge.className = `status-badge status-${application.status.toLowerCase()}`;
  badge.textContent = application.status;
  const date = document.createElement("time");
  date.className = "application-date";
  date.dateTime = application.appliedOn ?? "";
  date.textContent = formatDate(application.appliedOn);
  const actions = document.createElement("div");
  actions.className = "card-actions";
  actions.append(
    createActionButton(`Edit ${application.company}`, "✎", () => beginEdit(application)),
    createActionButton(`Delete ${application.company}`, "×", () => deleteApplication(application))
  );
  meta.append(badge, date, actions);
  card.append(identity, meta);
  return card;
}

function renderApplications() {
  listElement.replaceChildren(...applications.map(renderApplication));
  document.querySelector("#applicationCount").textContent = applications.length;
  const isEmpty = applications.length === 0;
  emptyState.hidden = !isEmpty;
  listElement.hidden = isEmpty;
  if (isEmpty && (searchInput.value || statusFilter.value)) {
    document.querySelector("#emptyTitle").textContent = "No matches just yet.";
    document.querySelector("#emptyCopy").textContent = "Try another search or clear the status filter.";
    document.querySelector("#emptyAddButton").hidden = true;
    document.querySelector("#emptySteps").hidden = true;
  } else if (isEmpty) {
    document.querySelector("#emptyAddButton").hidden = false;
    document.querySelector("#emptySteps").hidden = false;
  }
}

async function refreshDashboard() {
  const params = new URLSearchParams();
  if (searchInput.value.trim()) params.set("search", searchInput.value.trim());
  if (statusFilter.value) params.set("status", statusFilter.value);
  try {
    const [stats, result] = await Promise.all([
      api("/api/stats"),
      api(`/api/applications${params.size ? `?${params}` : ""}`)
    ]);
    applications = result;
    renderStats(stats);
    renderApplications();
  } catch (error) {
    setFormError(`Could not load your dashboard. ${error.message}`);
  }
}

function resetForm() {
  form.reset();
  document.querySelector("#applicationId").value = "";
  document.querySelector("#status").value = "Applied";
  document.querySelector("#formTitle").textContent = "Add a role";
  document.querySelector("#formEyebrow").textContent = "A NEW OPPORTUNITY";
  document.querySelector("#submitButton").innerHTML = 'Add to my search <span>↗</span>';
  document.querySelector("#cancelEditButton").hidden = true;
  setFormError();
}

function beginEdit(application) {
  document.querySelector("#applicationId").value = application.id;
  document.querySelector("#company").value = application.company;
  document.querySelector("#role").value = application.role;
  document.querySelector("#status").value = application.status;
  document.querySelector("#appliedOn").value = application.appliedOn ?? "";
  document.querySelector("#url").value = application.url ?? "";
  document.querySelector("#notes").value = application.notes;
  document.querySelector("#formTitle").textContent = "Edit role";
  document.querySelector("#formEyebrow").textContent = "UPDATE YOUR PIPELINE";
  document.querySelector("#submitButton").innerHTML = 'Save changes <span>↗</span>';
  document.querySelector("#cancelEditButton").hidden = false;
  setFormError();
  formPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  document.querySelector("#company").focus({ preventScroll: true });
}

async function deleteApplication(application) {
  if (!window.confirm(`Remove ${application.role} at ${application.company}?`)) return;
  try {
    await api(`/api/applications/${application.id}`, { method: "DELETE" });
    showToast("Application removed.");
    await refreshDashboard();
  } catch (error) {
    setFormError(error.message);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setFormError();
  const id = document.querySelector("#applicationId").value;
  const payload = {
    company: document.querySelector("#company").value,
    role: document.querySelector("#role").value,
    status: document.querySelector("#status").value,
    appliedOn: document.querySelector("#appliedOn").value || null,
    url: document.querySelector("#url").value || null,
    notes: document.querySelector("#notes").value
  };

  const submitButton = document.querySelector("#submitButton");
  submitButton.disabled = true;
  try {
    await api(id ? `/api/applications/${id}` : "/api/applications", {
      method: id ? "PATCH" : "POST",
      body: JSON.stringify(payload)
    });
    resetForm();
    showToast(id ? "Your changes are saved." : "Added to your search.");
    await refreshDashboard();
  } catch (error) {
    setFormError(error.message);
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector("#cancelEditButton").addEventListener("click", resetForm);
document.querySelector("#mobileAddButton").addEventListener("click", () => {
  formPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  document.querySelector("#company").focus({ preventScroll: true });
});
document.querySelector("#emptyAddButton").addEventListener("click", () => {
  formPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  document.querySelector("#company").focus({ preventScroll: true });
});
searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(refreshDashboard, 180);
});
statusFilter.addEventListener("change", refreshDashboard);
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    searchInput.focus();
  }
  if (event.key === "Escape" && document.activeElement === searchInput) {
    searchInput.value = "";
    refreshDashboard();
  }
});
document.querySelector("#todayLabel").textContent = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric"
}).format(new Date());
refreshDashboard();
