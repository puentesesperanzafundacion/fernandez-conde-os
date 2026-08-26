export type JarvisMatter = {
  id: string;
  client_id: string;
  matter_type: string;
  subtype: string | null;
  title: string;
  status: string;
  priority: string;
  summary: string | null;
  authority: string | null;
  office: string | null;
  external_file_number: string | null;
  next_action: string | null;
  next_action_due_at: string | null;
  updated_at: string;
};

export type JarvisTask = {
  id: string;
  title: string;
  priority: string;
  status: string;
  due_at: string | null;
  matter_id: string | null;
  task_type: string;
  is_legal_deadline: boolean;
};

export type JarvisIncident = {
  id: string;
  matter_id?: string;
  title: string;
  severity: string;
  status: string;
};

export type JarvisPriorityItem = {
  id: string;
  rank: number;
  level: "CRITICAL" | "HIGH" | "MEDIUM";
  title: string;
  detail: string;
  matter_id: string | null;
  source: "TASK" | "INCIDENT" | "STAGNANT" | "MISSING_ACTION";
};

const DAY = 86_400_000;

export function daysSince(value: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / DAY));
}

export function isPast(value: string | null) {
  return Boolean(value && new Date(value).getTime() < Date.now());
}

export function dueWithin(value: string | null, days: number) {
  if (!value) return false;
  const diff = new Date(value).getTime() - Date.now();
  return diff >= 0 && diff <= days * DAY;
}

export function missingMatterFields(matter: JarvisMatter) {
  const missing: string[] = [];
  if (!matter.external_file_number) missing.push("Expediente / NUT / folio");
  if (!matter.authority) missing.push("Autoridad");
  if (!matter.summary) missing.push("Resumen estratégico");
  if (!matter.next_action) missing.push("Siguiente actuación");
  return missing;
}

export function matterHealth(matter: JarvisMatter, tasks: JarvisTask[], incidents: JarvisIncident[]) {
  let score = 100;
  const matterTasks = tasks.filter((task) => task.matter_id === matter.id && task.status !== "DONE");
  const matterIncidents = incidents.filter((incident) => incident.matter_id === matter.id && incident.status !== "RESOLVED");
  const overdue = matterTasks.filter((task) => isPast(task.due_at));
  const urgent = matterTasks.filter((task) => task.priority === "URGENT");
  const critical = matterIncidents.filter((incident) => incident.severity === "CRITICAL");
  const high = matterIncidents.filter((incident) => incident.severity === "HIGH");
  const staleDays = daysSince(matter.updated_at);
  const missing = missingMatterFields(matter);

  if (overdue.length) score -= Math.min(30, 18 + (overdue.length - 1) * 4);
  if (urgent.length) score -= 8;
  if (critical.length) score -= Math.min(30, critical.length * 18);
  if (high.length) score -= Math.min(16, high.length * 8);
  if (staleDays > 30) score -= staleDays > 60 ? 18 : 10;
  if (!matter.next_action) score -= 10;
  score -= Math.min(12, missing.length * 3);
  score = Math.max(0, Math.min(100, score));

  const label = score >= 85 ? "Estable" : score >= 70 ? "Vigilar" : score >= 50 ? "Atención" : "Crítico";
  const tone = score >= 85 ? "GOOD" : score >= 70 ? "WATCH" : score >= 50 ? "ATTENTION" : "CRITICAL";

  return { score, label, tone, overdue: overdue.length, critical: critical.length, high: high.length, staleDays, missing };
}

export function buildPriorityQueue(matters: JarvisMatter[], tasks: JarvisTask[], incidents: JarvisIncident[]) {
  const items: JarvisPriorityItem[] = [];
  const openMatters = matters.filter((matter) => matter.status === "OPEN");
  const openTasks = tasks.filter((task) => task.status !== "DONE");

  for (const task of openTasks) {
    let rank = 0;
    let level: JarvisPriorityItem["level"] = "MEDIUM";
    let detail = "Tarea pendiente";
    if (isPast(task.due_at)) {
      rank = task.is_legal_deadline ? 110 : 100;
      level = "CRITICAL";
      detail = task.is_legal_deadline ? "Término legal vencido" : "Tarea vencida";
    } else if (task.priority === "URGENT") {
      rank = 92;
      level = "CRITICAL";
      detail = "Prioridad urgente";
    } else if (dueWithin(task.due_at, 1)) {
      rank = 88;
      level = "HIGH";
      detail = "Vence dentro de 24 horas";
    } else if (dueWithin(task.due_at, 3)) {
      rank = 74;
      level = "HIGH";
      detail = "Vence dentro de 3 días";
    }
    if (rank) items.push({ id: `task-${task.id}`, rank, level, title: task.title, detail, matter_id: task.matter_id, source: "TASK" });
  }

  for (const incident of incidents.filter((item) => item.status !== "RESOLVED")) {
    if (!incident.matter_id) continue;
    if (incident.severity === "CRITICAL") items.push({ id: `incident-${incident.id}`, rank: 96, level: "CRITICAL", title: incident.title, detail: "Incidencia crítica abierta", matter_id: incident.matter_id, source: "INCIDENT" });
    else if (incident.severity === "HIGH") items.push({ id: `incident-${incident.id}`, rank: 78, level: "HIGH", title: incident.title, detail: "Incidencia alta abierta", matter_id: incident.matter_id, source: "INCIDENT" });
  }

  for (const matter of openMatters) {
    const staleDays = daysSince(matter.updated_at);
    if (staleDays > 30) items.push({ id: `stale-${matter.id}`, rank: staleDays > 60 ? 67 : 54, level: staleDays > 60 ? "HIGH" : "MEDIUM", title: matter.title, detail: `Sin movimiento registrado hace ${staleDays} días`, matter_id: matter.id, source: "STAGNANT" });
    if (!matter.next_action) items.push({ id: `action-${matter.id}`, rank: matter.priority === "URGENT" ? 72 : 45, level: matter.priority === "URGENT" ? "HIGH" : "MEDIUM", title: matter.title, detail: "No tiene siguiente actuación definida", matter_id: matter.id, source: "MISSING_ACTION" });
  }

  return items.sort((a, b) => b.rank - a.rank);
}

export function briefingDate() {
  return new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
}
