"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  AlertTriangle,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Link2,
  Plus,
  Search,
  Scale,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { inmOptions, inmTemplateFor } from "@/lib/inm-workflows";
import { briefingDate, buildPriorityQueue, matterHealth, missingMatterFields, type JarvisPriorityItem } from "@/lib/jarvis-core";

type Client = {
  id: string;
  full_name: string;
  nationality: string | null;
  phone: string | null;
  email: string | null;
  notes?: string | null;
};

type Matter = {
  id: string;
  client_id: string;
  parent_matter_id: string | null;
  matter_type: string;
  subtype: string | null;
  title: string;
  status: string;
  priority: string;
  summary: string | null;
  authority: string | null;
  office: string | null;
  external_file_number: string | null;
  opened_at: string;
  next_action: string | null;
  next_action_due_at: string | null;
  updated_at: string;
};

type StageDefinition = {
  name: string;
  description: string | null;
  position: number;
};

type Stage = {
  id: string;
  state: string;
  started_at: string | null;
  completed_at: string | null;
  due_at: string | null;
  scheduled_at: string | null;
  actual_at: string | null;
  outcome: string | null;
  result: string | null;
  notes: string | null;
  next_action: string | null;
  next_action_due_at: string | null;
  workflow_template_stages: StageDefinition | null;
};

type Incident = {
  id: string;
  matter_id?: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  occurred_at: string;
};

type Task = {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  due_at: string | null;
  matter_id: string | null;
  client_id: string | null;
  task_type: string;
  is_legal_deadline: boolean;
};

type Event = {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  event_at: string;
};

type DocumentItem = {
  id: string;
  matter_id: string;
  stage_instance_id: string | null;
  category: string;
  name: string;
  document_date: string | null;
  external_url: string | null;
  notes: string | null;
  created_at: string;
};

type MainTab = "inicio" | "clientes" | "asuntos" | "tareas" | "jarvis";
type MatterTab = "resumen" | "seguimiento" | "cronologia" | "tareas" | "documentos" | "vinculados";
type ModalType = null | "client" | "matter" | "editMatter" | "incident" | "task" | "document" | "amparo";

const stageStates = [
  ["PENDING", "Pendiente"],
  ["IN_PROGRESS", "En curso"],
  ["COMPLETED", "Completado"],
  ["BLOCKED", "Incidencia"],
  ["NOT_APPLICABLE", "No aplica"],
] as const;

const priorities = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
const taskTypes = [
  ["TASK", "Tarea"],
  ["DEADLINE", "Término"],
  ["HEARING", "Audiencia / cita"],
  ["FOLLOW_UP", "Seguimiento"],
  ["DOCUMENT", "Documento"],
] as const;

function uuid() {
  return crypto.randomUUID();
}

function fmtDate(value: string | null, withTime = false) {
  if (!value) return "—";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return new Intl.DateTimeFormat("es-MX", withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }).format(date);
}

function dateInput(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function isOverdue(value: string | null) {
  return Boolean(value && new Date(value).getTime() < Date.now());
}

function withinDays(value: string | null, days: number) {
  if (!value) return false;
  const diff = new Date(value).getTime() - Date.now();
  return diff >= 0 && diff <= days * 86_400_000;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [tab, setTab] = useState<MainTab>("inicio");
  const [matterTab, setMatterTab] = useState<MatterTab>("resumen");
  const [clients, setClients] = useState<Client[]>([]);
  const [matters, setMatters] = useState<Matter[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [allIncidents, setAllIncidents] = useState<Incident[]>([]);
  const [selectedMatter, setSelectedMatter] = useState<Matter | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [modal, setModal] = useState<ModalType>(null);
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [matterFilter, setMatterFilter] = useState("ALL");
  const [jarvisQuery, setJarvisQuery] = useState("");
  const [jarvisAnswer, setJarvisAnswer] = useState("Pregunta por clientes, asuntos, términos, COMAR, INM, amparos o incidencias.");
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const { data: { user: current } } = await supabase.auth.getUser();
      if (mounted) {
        setUser(current);
        setLoading(false);
      }
    })();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((current) => !current);
      }
      if (event.key === "Escape") setCommandOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (user) void bootstrap();
    else {
      setOrgId(null);
      setClients([]);
      setMatters([]);
      setTasks([]);
      setAllIncidents([]);
    }
  }, [user]);

  async function bootstrap() {
    if (!user) return;
    setLoading(true);
    setNotice("");
    const { data: member, error } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) {
      setNotice(error.message);
      setLoading(false);
      return;
    }
    let oid = member?.organization_id as string | undefined;
    if (!oid) {
      oid = uuid();
      const org = await supabase.from("organizations").insert({ id: oid, name: "Fernández Conde", created_by: user.id });
      if (org.error) {
        setNotice(org.error.message);
        setLoading(false);
        return;
      }
      const membership = await supabase.from("organization_members").insert({ organization_id: oid, user_id: user.id, role: "owner" });
      if (membership.error) {
        setNotice(membership.error.message);
        setLoading(false);
        return;
      }
    }
    setOrgId(oid);
    await loadBase(oid);
    setLoading(false);
  }

  async function loadBase(oid = orgId) {
    if (!oid) return;
    const [clientResult, matterResult, taskResult, incidentResult] = await Promise.all([
      supabase.from("clients").select("id,full_name,nationality,phone,email,notes").eq("organization_id", oid).order("full_name"),
      supabase.from("matters").select("id,client_id,parent_matter_id,matter_type,subtype,title,status,priority,summary,authority,office,external_file_number,opened_at,next_action,next_action_due_at,updated_at").eq("organization_id", oid).order("updated_at", { ascending: false }),
      supabase.from("tasks").select("id,title,description,priority,status,due_at,matter_id,client_id,task_type,is_legal_deadline").eq("organization_id", oid).order("due_at", { ascending: true, nullsFirst: false }),
      supabase.from("matter_incidents").select("id,matter_id,title,description,severity,status,occurred_at").neq("status", "RESOLVED").order("occurred_at", { ascending: false }),
    ]);
    const error = clientResult.error || matterResult.error || taskResult.error || incidentResult.error;
    if (error) setNotice(error.message);
    setClients((clientResult.data ?? []) as Client[]);
    setMatters((matterResult.data ?? []) as Matter[]);
    setTasks((taskResult.data ?? []) as Task[]);
    setAllIncidents((incidentResult.data ?? []) as Incident[]);
  }

  async function openMatter(matter: Matter, nextTab: MatterTab = "resumen") {
    setSelectedMatter(matter);
    setSelectedClient(null);
    setTab("asuntos");
    setMatterTab(nextTab);
    await loadMatter(matter.id);
  }

  async function loadMatter(id: string) {
    const workflow = await supabase.from("matter_workflows").select("id").eq("matter_id", id).eq("status", "ACTIVE").maybeSingle();
    let stageData: Stage[] = [];
    if (workflow.data?.id) {
      const result = await supabase
        .from("matter_stage_instances")
        .select("id,state,started_at,completed_at,due_at,scheduled_at,actual_at,outcome,result,notes,next_action,next_action_due_at,workflow_template_stages(name,description,position)")
        .eq("matter_workflow_id", workflow.data.id);
      stageData = ((result.data ?? []) as unknown as Stage[]).sort(
        (a, b) => (a.workflow_template_stages?.position ?? 0) - (b.workflow_template_stages?.position ?? 0),
      );
      if (result.error) setNotice(result.error.message);
    }
    const [incidentResult, eventResult, documentResult] = await Promise.all([
      supabase.from("matter_incidents").select("id,matter_id,title,description,severity,status,occurred_at").eq("matter_id", id).order("occurred_at", { ascending: false }),
      supabase.from("case_events").select("id,title,description,event_type,event_at").eq("matter_id", id).order("event_at", { ascending: false }),
      supabase.from("matter_documents").select("id,matter_id,stage_instance_id,category,name,document_date,external_url,notes,created_at").eq("matter_id", id).order("created_at", { ascending: false }),
    ]);
    const error = incidentResult.error || eventResult.error || documentResult.error;
    if (error) setNotice(error.message);
    setStages(stageData);
    setIncidents((incidentResult.data ?? []) as Incident[]);
    setEvents((eventResult.data ?? []) as Event[]);
    setDocuments((documentResult.data ?? []) as DocumentItem[]);
  }

  function clientName(id: string) {
    return clients.find((client) => client.id === id)?.full_name ?? "Cliente";
  }

  function templateCodeFor(type: string, subtype: string) {
    if (type === "COMAR") return "COMAR_RECONOCIMIENTO";
    if (type === "INM") return inmTemplateFor(subtype);
    if (type === "AMPARO_INDIRECTO" || type === "AMPARO_DIRECTO") return type;
    return "INM_TRAMITE";
  }

  async function createMatterRecord(input: {
    clientId: string;
    type: string;
    subtype: string;
    title: string;
    parent?: string | null;
    priority?: string;
    authority?: string | null;
    office?: string | null;
    fileNumber?: string | null;
    summary?: string | null;
    nextAction?: string | null;
    nextActionDue?: string | null;
  }) {
    if (!orgId || !user) return null;
    const templateCode = templateCodeFor(input.type, input.subtype);
    const template = await supabase.from("workflow_templates").select("id").eq("code", templateCode).is("organization_id", null).single();
    if (template.error) {
      setNotice(template.error.message);
      return null;
    }
    const matterId = uuid();
    const matterInsert = await supabase.from("matters").insert({
      id: matterId,
      organization_id: orgId,
      client_id: input.clientId,
      parent_matter_id: input.parent ?? null,
      matter_type: input.type,
      subtype: input.subtype,
      title: input.title,
      status: "OPEN",
      priority: input.priority ?? "NORMAL",
      authority: input.authority ?? null,
      office: input.office ?? null,
      external_file_number: input.fileNumber ?? null,
      summary: input.summary ?? null,
      next_action: input.nextAction ?? null,
      next_action_due_at: input.nextActionDue ? new Date(input.nextActionDue).toISOString() : null,
      created_by: user.id,
    });
    if (matterInsert.error) {
      setNotice(matterInsert.error.message);
      return null;
    }
    const workflow = await supabase.from("matter_workflows").insert({ matter_id: matterId, workflow_template_id: template.data.id }).select("id").single();
    if (workflow.error) {
      setNotice(workflow.error.message);
      return null;
    }
    const definitions = await supabase.from("workflow_template_stages").select("id").eq("workflow_template_id", template.data.id).order("position");
    if (definitions.error) {
      setNotice(definitions.error.message);
      return null;
    }
    if (definitions.data.length) {
      const instances = await supabase.from("matter_stage_instances").insert(
        definitions.data.map((definition) => ({ matter_workflow_id: workflow.data.id, template_stage_id: definition.id, state: "PENDING" })),
      );
      if (instances.error) {
        setNotice(instances.error.message);
        return null;
      }
    }
    await supabase.from("case_events").insert({ matter_id: matterId, event_type: "MATTER_CREATED", title: "Asunto creado", description: input.title, created_by: user.id });
    return matterId;
  }

  async function addClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!orgId || !user) return;
    const form = new FormData(event.currentTarget);
    const result = await supabase.from("clients").insert({
      organization_id: orgId,
      full_name: form.get("name"),
      nationality: form.get("nationality") || null,
      phone: form.get("phone") || null,
      email: form.get("email") || null,
      notes: form.get("notes") || null,
      created_by: user.id,
    });
    if (result.error) {
      setNotice(result.error.message);
      return;
    }
    setModal(null);
    await loadBase();
  }

  async function addMatter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const clientId = String(form.get("client"));
    const type = String(form.get("type"));
    const subtype = type === "INM" ? String(form.get("subtype")) : "Reconocimiento de la condición de refugiado";
    const title = `${type === "COMAR" ? "COMAR" : "INM"} · ${clientName(clientId)}`;
    const id = await createMatterRecord({
      clientId,
      type,
      subtype,
      title,
      priority: String(form.get("priority") || "NORMAL"),
      authority: String(form.get("authority") || "") || null,
      office: String(form.get("office") || "") || null,
      fileNumber: String(form.get("fileNumber") || "") || null,
      summary: String(form.get("summary") || "") || null,
      nextAction: String(form.get("nextAction") || "") || null,
      nextActionDue: String(form.get("nextActionDue") || "") || null,
    });
    if (!id) return;
    setModal(null);
    await loadBase();
    const result = await supabase.from("matters").select("id,client_id,parent_matter_id,matter_type,subtype,title,status,priority,summary,authority,office,external_file_number,opened_at,next_action,next_action_due_at,updated_at").eq("id", id).single();
    if (result.data) await openMatter(result.data as Matter);
  }

  async function addAmparo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedMatter) return;
    const form = new FormData(event.currentTarget);
    const type = String(form.get("type"));
    const title = `${type === "AMPARO_INDIRECTO" ? "Amparo indirecto" : "Amparo directo"} · ${clientName(selectedMatter.client_id)}`;
    const id = await createMatterRecord({
      clientId: selectedMatter.client_id,
      type,
      subtype: `Vinculado a ${selectedMatter.title}`,
      title,
      parent: selectedMatter.id,
      priority: String(form.get("priority") || "HIGH"),
      authority: String(form.get("authority") || "") || null,
      fileNumber: String(form.get("fileNumber") || "") || null,
      summary: String(form.get("summary") || "") || null,
      nextAction: String(form.get("nextAction") || "") || null,
      nextActionDue: String(form.get("nextActionDue") || "") || null,
    });
    if (!id) return;
    setModal(null);
    await loadBase();
    await loadMatter(selectedMatter.id);
  }

  async function editMatter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedMatter || !user) return;
    const form = new FormData(event.currentTarget);
    const patch = {
      priority: String(form.get("priority")),
      status: String(form.get("status")),
      authority: String(form.get("authority") || "") || null,
      office: String(form.get("office") || "") || null,
      external_file_number: String(form.get("fileNumber") || "") || null,
      summary: String(form.get("summary") || "") || null,
      next_action: String(form.get("nextAction") || "") || null,
      next_action_due_at: form.get("nextActionDue") ? new Date(String(form.get("nextActionDue"))).toISOString() : null,
      updated_at: new Date().toISOString(),
    };
    const result = await supabase.from("matters").update(patch).eq("id", selectedMatter.id);
    if (result.error) {
      setNotice(result.error.message);
      return;
    }
    await supabase.from("case_events").insert({ matter_id: selectedMatter.id, event_type: "MATTER_UPDATED", title: "Ficha del expediente actualizada", description: patch.next_action ? `Siguiente actuación: ${patch.next_action}` : null, created_by: user.id });
    setModal(null);
    await loadBase();
    const refreshed = { ...selectedMatter, ...patch } as Matter;
    setSelectedMatter(refreshed);
    await loadMatter(selectedMatter.id);
  }

  async function saveStage(stage: Stage, data: Record<string, string>) {
    if (!selectedMatter || !user) return;
    const state = data.state;
    const patch: Record<string, string | null> = {
      state,
      scheduled_at: data.scheduled ? new Date(data.scheduled).toISOString() : null,
      actual_at: data.actual ? new Date(data.actual).toISOString() : null,
      outcome: data.outcome || null,
      result: data.result || null,
      notes: data.notes || null,
      next_action: data.nextAction || null,
      next_action_due_at: data.nextActionDue ? new Date(data.nextActionDue).toISOString() : null,
      updated_at: new Date().toISOString(),
    };
    if (state === "IN_PROGRESS" && !stage.started_at) patch.started_at = new Date().toISOString();
    if (state === "COMPLETED") patch.completed_at = stage.completed_at ?? new Date().toISOString();
    if (state !== "COMPLETED") patch.completed_at = null;
    const result = await supabase.from("matter_stage_instances").update(patch).eq("id", stage.id);
    if (result.error) {
      setNotice(result.error.message);
      return;
    }
    const matterPatch: Record<string, string | null> = { updated_at: new Date().toISOString() };
    if (data.nextAction) {
      matterPatch.next_action = data.nextAction;
      matterPatch.next_action_due_at = data.nextActionDue ? new Date(data.nextActionDue).toISOString() : null;
    }
    await supabase.from("matters").update(matterPatch).eq("id", selectedMatter.id);
    setSelectedMatter((current) => current ? { ...current, updated_at: String(matterPatch.updated_at), next_action: data.nextAction || current.next_action, next_action_due_at: data.nextAction ? (matterPatch.next_action_due_at ?? null) : current.next_action_due_at } : current);
    await supabase.from("case_events").insert({
      matter_id: selectedMatter.id,
      stage_instance_id: stage.id,
      event_type: "STAGE_UPDATED",
      title: `Etapa: ${stage.workflow_template_stages?.name ?? "Seguimiento"}`,
      description: `${state}${data.result ? ` · ${data.result}` : ""}${data.nextAction ? ` · Siguiente: ${data.nextAction}` : ""}`,
      created_by: user.id,
    });
    setNotice("Etapa guardada.");
    await loadBase();
    await loadMatter(selectedMatter.id);
  }

  async function addIncident(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedMatter || !user) return;
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title"));
    const description = String(form.get("description") || "");
    const severity = String(form.get("severity"));
    const stageId = String(form.get("stage") || "") || null;
    const dueAt = form.get("due") ? new Date(String(form.get("due"))).toISOString() : null;
    const result = await supabase.from("matter_incidents").insert({
      matter_id: selectedMatter.id,
      stage_instance_id: stageId,
      title,
      description,
      severity,
      status: "OPEN",
      due_at: dueAt,
      created_by: user.id,
    });
    if (result.error) {
      setNotice(result.error.message);
      return;
    }
    await supabase.from("matters").update({ updated_at: new Date().toISOString() }).eq("id", selectedMatter.id);
    await supabase.from("case_events").insert({ matter_id: selectedMatter.id, stage_instance_id: stageId, event_type: "INCIDENT_CREATED", title: `Incidencia: ${title}`, description, created_by: user.id });
    setModal(null);
    await loadBase();
    await loadMatter(selectedMatter.id);
  }

  async function resolveIncident(incident: Incident) {
    if (!selectedMatter || !user) return;
    const result = await supabase.from("matter_incidents").update({ status: "RESOLVED", resolved_at: new Date().toISOString() }).eq("id", incident.id);
    if (result.error) {
      setNotice(result.error.message);
      return;
    }
    await supabase.from("case_events").insert({ matter_id: selectedMatter.id, event_type: "INCIDENT_RESOLVED", title: `Incidencia resuelta: ${incident.title}`, created_by: user.id });
    await loadBase();
    await loadMatter(selectedMatter.id);
  }

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!orgId || !user) return;
    const form = new FormData(event.currentTarget);
    const matterId = String(form.get("matter") || "") || selectedMatter?.id || null;
    const matter = matters.find((item) => item.id === matterId);
    const type = String(form.get("taskType") || "TASK");
    const result = await supabase.from("tasks").insert({
      organization_id: orgId,
      matter_id: matterId,
      client_id: matter?.client_id ?? selectedMatter?.client_id ?? null,
      title: form.get("title"),
      description: form.get("description") || null,
      priority: form.get("priority"),
      task_type: type,
      is_legal_deadline: type === "DEADLINE",
      due_at: form.get("due") ? new Date(String(form.get("due"))).toISOString() : null,
      created_by: user.id,
      assigned_to: user.id,
    });
    if (result.error) {
      setNotice(result.error.message);
      return;
    }
    if (matterId) {
      await supabase.from("case_events").insert({ matter_id: matterId, event_type: "TASK_CREATED", title: `${type === "DEADLINE" ? "Término" : "Tarea"}: ${String(form.get("title"))}`, description: form.get("due") ? `Vence ${String(form.get("due"))}` : null, created_by: user.id });
      await supabase.from("matters").update({ updated_at: new Date().toISOString() }).eq("id", matterId);
    }
    setModal(null);
    await loadBase();
    if (selectedMatter) await loadMatter(selectedMatter.id);
  }

  async function toggleTask(task: Task) {
    const next = task.status === "DONE" ? "PENDING" : "DONE";
    await supabase.from("tasks").update({ status: next, completed_at: next === "DONE" ? new Date().toISOString() : null }).eq("id", task.id);
    await loadBase();
  }

  async function addDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedMatter || !orgId || !user) return;
    const form = new FormData(event.currentTarget);
    const result = await supabase.from("matter_documents").insert({
      organization_id: orgId,
      matter_id: selectedMatter.id,
      client_id: selectedMatter.client_id,
      stage_instance_id: String(form.get("stage") || "") || null,
      category: String(form.get("category") || "OTHER"),
      name: form.get("name"),
      document_date: form.get("documentDate") || null,
      external_url: form.get("url") || null,
      notes: form.get("notes") || null,
      uploaded_by: user.id,
    });
    if (result.error) {
      setNotice(result.error.message);
      return;
    }
    await supabase.from("case_events").insert({ matter_id: selectedMatter.id, event_type: "DOCUMENT_ADDED", title: `Documento: ${String(form.get("name"))}`, description: String(form.get("category") || ""), created_by: user.id });
    await supabase.from("matters").update({ updated_at: new Date().toISOString() }).eq("id", selectedMatter.id);
    setModal(null);
    await loadBase();
    await loadMatter(selectedMatter.id);
  }

  async function askJarvis(event?: FormEvent<HTMLFormElement>, override?: string) {
    event?.preventDefault();
    const q = (override ?? jarvisQuery).trim().toLowerCase();
    if (!q) return;
    if (q.includes("qué debo hacer") || q.includes("que debo hacer") || q.includes("prioridad") || q.includes("prioridades")) {
      const top = jarvisQueue.slice(0, 8);
      setJarvisAnswer(top.length ? `Prioridad recomendada: ${top.map((item, index) => `${index + 1}. ${item.title} — ${item.detail}`).join(" | ")}` : "No detecto asuntos que requieran atención inmediata.");
      return;
    }
    if (q.includes("incomplet") || q.includes("falta información") || q.includes("falta informacion")) {
      setJarvisAnswer(incompleteMatters.length ? `${incompleteMatters.length} expedientes requieren completar información operativa: ${incompleteMatters.slice(0, 8).map((matter) => `${matter.title} (${missingMatterFields(matter).join(", ")})`).join(" | ")}` : "No detecto expedientes con información operativa relevante pendiente de completar.");
      return;
    }
    if (selectedMatter && (q.includes("este expediente") || q.includes("qué falta") || q.includes("que falta") || q.includes("analiza") || q.includes("salud"))) {
      const health = matterHealth(selectedMatter, tasks, allIncidents);
      const pending = tasks.filter((task) => task.matter_id === selectedMatter.id && task.status !== "DONE");
      const risks = allIncidents.filter((incident) => incident.matter_id === selectedMatter.id && incident.status !== "RESOLVED");
      const missing = missingMatterFields(selectedMatter);
      setJarvisAnswer(`${selectedMatter.title}: salud operativa ${health.score}/100 (${health.label}). Etapa actual: ${currentStage?.workflow_template_stages?.name ?? "sin etapa identificada"}. ${pending.length} tarea(s) abierta(s), ${risks.length} incidencia(s) activa(s). ${missing.length ? `Falta completar: ${missing.join(", ")}.` : "Ficha operativa completa."} ${selectedMatter.next_action ? `Siguiente actuación: ${selectedMatter.next_action}.` : "No existe siguiente actuación definida."}`);
      return;
    }
    if (q.includes("incidencia") || q.includes("problema")) {
      const critical = allIncidents.filter((item) => ["HIGH", "CRITICAL"].includes(item.severity));
      setJarvisAnswer(critical.length ? `${critical.length} incidencias relevantes abiertas: ${critical.slice(0, 6).map((item) => `${item.title} (${matterTitle(item.matter_id ?? "")})`).join("; ")}.` : "No hay incidencias altas o críticas abiertas.");
      return;
    }
    if (q.includes("hoy") || q.includes("pendiente") || q.includes("término") || q.includes("termino")) {
      const pending = tasks.filter((task) => task.status !== "DONE" && (isOverdue(task.due_at) || withinDays(task.due_at, 1) || task.priority === "URGENT"));
      setJarvisAnswer(pending.length ? `Atención inmediata: ${pending.slice(0, 8).map((task) => `${task.title}${task.due_at ? ` (${fmtDate(task.due_at, true)})` : ""}`).join("; ")}.` : "No detecto tareas vencidas, términos para hoy ni tareas urgentes.");
      return;
    }
    const type = q.includes("comar") ? "COMAR" : q.includes("inm") || q.includes("migr") ? "INM" : q.includes("amparo") ? "AMPARO" : null;
    if (type) {
      const filtered = matters.filter((matter) => matter.status === "OPEN" && (type === "AMPARO" ? matter.matter_type.startsWith("AMPARO") : matter.matter_type === type));
      setJarvisAnswer(filtered.length ? `${filtered.length} asuntos ${type} abiertos. ${filtered.slice(0, 7).map((matter) => `${clientName(matter.client_id)} — ${matter.subtype ?? matter.matter_type}${matter.next_action ? `; siguiente: ${matter.next_action}` : ""}`).join(" | ")}` : `No hay asuntos ${type} abiertos.`);
      return;
    }
    const client = clients.find((item) => q.includes(item.full_name.toLowerCase()) || item.full_name.toLowerCase().split(" ").some((piece) => piece.length > 3 && q.includes(piece)));
    if (client) {
      const clientMatters = matters.filter((matter) => matter.client_id === client.id);
      setJarvisAnswer(`${client.full_name}: ${clientMatters.length} asuntos registrados. ${clientMatters.map((matter) => `${matter.title} [${matter.status}]${matter.next_action ? ` → ${matter.next_action}` : ""}`).join(" | ") || "Sin asuntos."}`);
      return;
    }
    setJarvisAnswer("No encontré una coincidencia clara. Prueba con el nombre de un cliente o preguntas como “qué tengo hoy”, “amparos abiertos”, “incidencias críticas” o “asuntos COMAR”.");
  }

  function matterTitle(id: string) {
    return matters.find((matter) => matter.id === id)?.title ?? "Asunto";
  }

  function openJarvis(seed = "") {
    setCommandQuery(seed);
    if (seed) {
      setJarvisQuery(seed);
      void askJarvis(undefined, seed);
    }
    setCommandOpen(true);
  }

  function openPriorityItem(item: JarvisPriorityItem) {
    if (!item.matter_id) {
      setTab("tareas");
      setCommandOpen(false);
      return;
    }
    const matter = matters.find((candidate) => candidate.id === item.matter_id);
    if (matter) void openMatter(matter, item.source === "TASK" ? "tareas" : "resumen");
    setCommandOpen(false);
  }

  const openMatters = useMemo(() => matters.filter((matter) => matter.status === "OPEN"), [matters]);
  const openTasks = useMemo(() => tasks.filter((task) => task.status !== "DONE"), [tasks]);
  const attentionTasks = useMemo(() => openTasks.filter((task) => isOverdue(task.due_at) || withinDays(task.due_at, 3) || task.priority === "URGENT"), [openTasks]);
  const stagnantMatters = useMemo(() => openMatters.filter((matter) => Date.now() - new Date(matter.updated_at).getTime() > 30 * 86_400_000), [openMatters]);
  const jarvisQueue = useMemo(() => buildPriorityQueue(openMatters, openTasks, allIncidents), [openMatters, openTasks, allIncidents]);
  const incompleteMatters = useMemo(() => openMatters.filter((matter) => missingMatterFields(matter).length >= 2), [openMatters]);
  const lowestHealth = useMemo(() => openMatters.map((matter) => ({ matter, health: matterHealth(matter, tasks, allIncidents) })).sort((a, b) => a.health.score - b.health.score).slice(0, 6), [openMatters, tasks, allIncidents]);
  const linkedMatters = useMemo(() => selectedMatter ? matters.filter((matter) => matter.parent_matter_id === selectedMatter.id || matter.id === selectedMatter.parent_matter_id) : [], [matters, selectedMatter]);
  const matterTasks = useMemo(() => selectedMatter ? tasks.filter((task) => task.matter_id === selectedMatter.id) : [], [tasks, selectedMatter]);
  const activeIncidents = useMemo(() => incidents.filter((incident) => incident.status !== "RESOLVED"), [incidents]);
  const visibleMatters = useMemo(() => matters.filter((matter) => matterFilter === "ALL" || (matterFilter === "AMPARO" ? matter.matter_type.startsWith("AMPARO") : matter.matter_type === matterFilter)), [matters, matterFilter]);
  const commandMatches = useMemo(() => {
    const q = commandQuery.trim().toLowerCase();
    if (!q) return { clients: [] as Client[], matters: [] as Matter[] };
    return {
      clients: clients.filter((client) => `${client.full_name} ${client.email ?? ""} ${client.phone ?? ""}`.toLowerCase().includes(q)).slice(0, 4),
      matters: matters.filter((matter) => `${matter.title} ${matter.subtype ?? ""} ${matter.external_file_number ?? ""} ${clientName(matter.client_id)}`.toLowerCase().includes(q)).slice(0, 5),
    };
  }, [commandQuery, clients, matters]);

  const selectedHealth = useMemo(() => selectedMatter ? matterHealth(selectedMatter, tasks, allIncidents) : null, [selectedMatter, tasks, allIncidents]);
  const selectedMissing = useMemo(() => selectedMatter ? missingMatterFields(selectedMatter) : [], [selectedMatter]);

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return { clients: [] as Client[], matters: [] as Matter[] };
    return {
      clients: clients.filter((client) => `${client.full_name} ${client.email ?? ""} ${client.phone ?? ""}`.toLowerCase().includes(q)).slice(0, 5),
      matters: matters.filter((matter) => `${matter.title} ${matter.subtype ?? ""} ${matter.external_file_number ?? ""} ${clientName(matter.client_id)}`.toLowerCase().includes(q)).slice(0, 6),
    };
  }, [search, clients, matters]);

  const progress = useMemo(() => {
    const applicable = stages.filter((stage) => stage.state !== "NOT_APPLICABLE");
    if (!applicable.length) return 0;
    return Math.round(applicable.filter((stage) => stage.state === "COMPLETED").length / applicable.length * 100);
  }, [stages]);
  const currentStage = useMemo(() => stages.find((stage) => !["COMPLETED", "NOT_APPLICABLE"].includes(stage.state)) ?? stages.at(-1), [stages]);

  if (loading) return <div className="spinner">Cargando Fernández Conde OS…</div>;
  if (!user) return <Auth />;

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand brandV3"><div className="brandPlate"><img className="brandWordmark" src="./brand/fernandez-conde-horizontal.jpg" alt="Fernández Conde"/></div><small>OS · V4</small></div>
        <nav className="nav">
          {[["inicio", "Inicio"], ["clientes", "Clientes"], ["asuntos", "Expedientes"], ["tareas", "Tareas y términos"], ["jarvis", "Jarvis"]].map(([key, label]) => (
            <button key={key} className={tab === key ? "on" : ""} onClick={() => { setTab(key as MainTab); if (key !== "asuntos") setSelectedMatter(null); if (key !== "clientes") setSelectedClient(null); }}>{label}</button>
          ))}
        </nav>
        <div className="financeLink">FINANZAS<br/><b>Sin integrar · sistema independiente</b></div>
        <div className="userbox">{user.email}<br/><button onClick={() => void supabase.auth.signOut()}>Cerrar sesión</button></div>
      </aside>

      <main className="content">
        <div className="globalBar">
          <div className="globalSearch">
            <Search size={17}/>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar cliente, expediente, NUT, folio, amparo…" />
            {search && <button onClick={() => setSearch("")}>×</button>}
            {search && (searchResults.clients.length > 0 || searchResults.matters.length > 0) && (
              <div className="searchDrop">
                {searchResults.clients.map((client) => <button key={client.id} onClick={() => { setSelectedClient(client); setTab("clientes"); setSearch(""); }}><span>CLIENTE</span><b>{client.full_name}</b></button>)}
                {searchResults.matters.map((matter) => <button key={matter.id} onClick={() => { void openMatter(matter); setSearch(""); }}><span>{matter.matter_type}</span><b>{matter.title}</b><small>{matter.external_file_number || matter.subtype}</small></button>)}
              </div>
            )}
          </div>
          <div className="globalActions"><button className="jarvisTrigger" onClick={() => openJarvis()}><span>✦</span> Jarvis <kbd>Ctrl K</kbd></button><button className="primary" onClick={() => setModal("matter")}><Plus size={16}/> Nuevo asunto</button></div>
        </div>

        {notice && <div className="notice">{notice}<button onClick={() => setNotice("")}>×</button></div>}

        {tab === "inicio" && (
          <>
            <PageHead eyebrow="PANEL DEL DESPACHO" title="Control operativo" description="V4 prioriza lo que requiere atención antes de que tengas que buscarlo." />
            <section className="jarvisBriefing">
              <div className="jarvisBriefingHead"><div><div className="ey">JARVIS BRIEFING · {briefingDate()}</div><h2>{jarvisQueue.length ? `${jarvisQueue.length} señales operativas detectadas` : "Operación bajo control"}</h2><p>{jarvisQueue.length ? "Ordenadas por urgencia, riesgo y vencimiento. Jarvis no modifica expedientes sin una acción tuya." : "No hay vencidos, incidencias altas ni alertas operativas relevantes."}</p></div><button className="jarvisPrimary" onClick={() => openJarvis("¿Qué debo hacer?")}>✦ ¿Qué debo hacer?</button></div>
              <div className="jarvisPriorityStrip">{jarvisQueue.slice(0,4).map((item) => <button key={item.id} onClick={() => openPriorityItem(item)}><span className={`jarvisLevel ${item.level.toLowerCase()}`}>{item.level}</span><b>{item.title}</b><small>{item.detail}{item.matter_id ? ` · ${matterTitle(item.matter_id)}` : ""}</small></button>)}{!jarvisQueue.length && <div className="jarvisCalm">✓ Sin prioridades críticas detectadas.</div>}</div>
              <div className="jarvisBriefingFoot"><span>{incompleteMatters.length} expediente(s) por completar</span><span>{stagnantMatters.length} sin movimiento &gt;30 días</span><button onClick={() => openJarvis("Expedientes incompletos")}>Revisar calidad de datos →</button></div>
            </section>
            <div className="cards">
              <Metric icon={<BriefcaseBusiness size={18}/>} label="Asuntos abiertos" value={openMatters.length} />
              <Metric icon={<CalendarClock size={18}/>} label="Atención ≤ 3 días" value={attentionTasks.length} emphasis={attentionTasks.length > 0} />
              <Metric icon={<AlertTriangle size={18}/>} label="Incidencias abiertas" value={allIncidents.length} emphasis={allIncidents.some((item) => item.severity === "CRITICAL")} />
              <Metric icon={<Clock3 size={18}/>} label="Sin movimiento >30d" value={stagnantMatters.length} />
            </div>

            <section className="panel">
              <SectionHead eyebrow="ATENCIÓN INMEDIATA" title="Qué requiere actuación" action={<button className="secondary" onClick={() => { setTab("tareas"); }}>Ver todas</button>} />
              {attentionTasks.length ? <div className="attentionList">{attentionTasks.slice(0, 8).map((task) => <TaskRow key={task.id} task={task} matter={task.matter_id ? matterTitle(task.matter_id) : "General"} onToggle={() => void toggleTask(task)} />)}</div> : <Empty text="No hay términos vencidos, tareas urgentes ni actuaciones dentro de los próximos tres días." />}
            </section>

            <div className="twoCols">
              <section className="panel">
                <SectionHead eyebrow="EXPEDIENTES" title="Actividad reciente" />
                <div className="list">{openMatters.slice(0, 7).map((matter) => <MatterRow key={matter.id} matter={matter} client={clientName(matter.client_id)} onOpen={() => void openMatter(matter)} />)}</div>
                {!openMatters.length && <Empty text="Todavía no hay expedientes." />}
              </section>
              <section className="panel">
                <SectionHead eyebrow="RIESGOS" title="Incidencias relevantes" />
                {allIncidents.length ? <div className="list">{allIncidents.slice(0, 7).map((incident) => <div className="riskRow" key={incident.id}><Severity value={incident.severity}/><div><b>{incident.title}</b><small>{matterTitle(incident.matter_id ?? "")}</small></div></div>)}</div> : <Empty text="Sin incidencias abiertas." />}
              </section>
            </div>
          </>
        )}

        {tab === "clientes" && (
          <>
            <PageHead eyebrow="CLIENTES" title={selectedClient ? selectedClient.full_name : "Directorio"} description={selectedClient ? "Ficha del cliente y asuntos relacionados." : "Personas vinculadas a asuntos del despacho."} action={<button className="secondary" onClick={() => setModal("client")}><Plus size={15}/> Cliente</button>} />
            {selectedClient ? (
              <>
                <section className="panel clientHero">
                  <div><span className="tag">CLIENTE</span><h2>{selectedClient.full_name}</h2><p>{selectedClient.nationality || "Nacionalidad no registrada"}</p></div>
                  <div className="clientFacts"><div><small>Teléfono</small><b>{selectedClient.phone || "—"}</b></div><div><small>Correo</small><b>{selectedClient.email || "—"}</b></div><div><small>Asuntos</small><b>{matters.filter((matter) => matter.client_id === selectedClient.id).length}</b></div></div>
                </section>
                <section className="panel"><SectionHead eyebrow="EXPEDIENTES" title="Asuntos del cliente" action={<button className="secondary" onClick={() => setSelectedClient(null)}>Volver al directorio</button>} /><div className="list">{matters.filter((matter) => matter.client_id === selectedClient.id).map((matter) => <MatterRow key={matter.id} matter={matter} client={selectedClient.full_name} onOpen={() => void openMatter(matter)} />)}</div></section>
              </>
            ) : (
              <section className="panel"><div className="clientGrid">{clients.map((client) => <button className="clientCard" key={client.id} onClick={() => setSelectedClient(client)}><div className="avatar">{client.full_name.split(" ").slice(0,2).map((piece) => piece[0]).join("")}</div><b>{client.full_name}</b><span>{client.nationality || "—"}</span><small>{matters.filter((matter) => matter.client_id === client.id).length} asunto(s)</small></button>)}</div>{!clients.length && <Empty text="No hay clientes registrados." />}</section>
            )}
          </>
        )}

        {tab === "asuntos" && !selectedMatter && (
          <>
            <PageHead eyebrow="EXPEDIENTES" title="Asuntos" description="COMAR, migración y litigio vinculados al cliente." />
            <div className="filters">{[["ALL","Todos"],["COMAR","COMAR"],["INM","INM"],["AMPARO","Amparo"]].map(([key,label]) => <button key={key} className={matterFilter === key ? "active" : ""} onClick={() => setMatterFilter(key)}>{label}</button>)}</div>
            <section className="panel"><div className="list">{visibleMatters.map((matter) => <MatterRow key={matter.id} matter={matter} client={clientName(matter.client_id)} onOpen={() => void openMatter(matter)} />)}</div>{!visibleMatters.length && <Empty text="No hay asuntos en este filtro." />}</section>
          </>
        )}

        {tab === "asuntos" && selectedMatter && (
          <>
          <section className="jarvisCasePulse">
            <div className="jarvisCaseScore"><span>JARVIS · SALUD</span><strong className={`health-${selectedHealth?.tone.toLowerCase()}`}>{selectedHealth?.score ?? 100}</strong><small>/100 · {selectedHealth?.label}</small></div>
            <div className="jarvisCaseRead"><b>{selectedHealth && selectedHealth.score < 70 ? "Este expediente requiere atención." : "Expediente operativo estable."}</b><p>{selectedMissing.length ? `Conviene completar: ${selectedMissing.join(", ")}.` : "No detecto campos operativos esenciales pendientes."}</p></div>
            <div className="jarvisCaseActions"><button onClick={() => openJarvis("Analiza este expediente")}>✦ Analizar</button>{selectedMissing.length > 0 && <button onClick={() => setModal("editMatter")}>Completar ficha</button>}{selectedHealth?.overdue ? <button onClick={() => setMatterTab("tareas")}>Revisar vencidos ({selectedHealth.overdue})</button> : null}{!selectedMatter.next_action && <button onClick={() => setModal("editMatter")}>Definir siguiente actuación</button>}</div>
          </section>
          <MatterCenter
            matter={selectedMatter}
            client={clientName(selectedMatter.client_id)}
            stages={stages}
            incidents={incidents}
            events={events}
            documents={documents}
            tasks={matterTasks}
            linked={linkedMatters}
            progress={progress}
            currentStage={currentStage}
            tab={matterTab}
            setTab={setMatterTab}
            onBack={() => { setSelectedMatter(null); setMatterTab("resumen"); }}
            onEdit={() => setModal("editMatter")}
            onIncident={() => setModal("incident")}
            onTask={() => setModal("task")}
            onDocument={() => setModal("document")}
            onAmparo={() => setModal("amparo")}
            onSaveStage={(stage, data) => void saveStage(stage, data)}
            onResolveIncident={(incident) => void resolveIncident(incident)}
            onToggleTask={(task) => void toggleTask(task)}
            onOpenLinked={(matter) => void openMatter(matter)}
          />
          </>
        )}

        {tab === "tareas" && (
          <>
            <PageHead eyebrow="CONTROL DE PLAZOS" title="Tareas y términos" description="Agenda procesal y operativa del despacho." action={<button className="secondary" onClick={() => setModal("task")}><Plus size={15}/> Tarea</button>} />
            <div className="taskSections">
              <TaskSection title="Vencidos" tasks={openTasks.filter((task) => isOverdue(task.due_at))} matters={matters} onToggle={toggleTask} danger />
              <TaskSection title="Próximos 7 días" tasks={openTasks.filter((task) => !isOverdue(task.due_at) && withinDays(task.due_at, 7))} matters={matters} onToggle={toggleTask} />
              <TaskSection title="Sin fecha / posteriores" tasks={openTasks.filter((task) => !task.due_at || (!isOverdue(task.due_at) && !withinDays(task.due_at, 7)))} matters={matters} onToggle={toggleTask} />
              <TaskSection title="Completados" tasks={tasks.filter((task) => task.status === "DONE").slice(0, 12)} matters={matters} onToggle={toggleTask} />
            </div>
          </>
        )}

        {tab === "jarvis" && (
          <>
            <PageHead eyebrow="JARVIS CORE · V4" title="Centro de inteligencia operativa" description="Reglas, prioridades, calidad de expedientes y consulta contextual. Finanzas permanece fuera de esta versión." action={<button className="jarvisPrimary" onClick={() => openJarvis("¿Qué debo hacer?")}>✦ ¿Qué debo hacer?</button>} />
            <div className="jarvisWorkspace">
              <section className="jarvisWorkspaceCard"><div className="ey">PRIORIDAD</div><h3>Cola recomendada</h3>{jarvisQueue.slice(0,5).map((item,index) => <button className="jarvisQueueRow" key={item.id} onClick={() => openPriorityItem(item)}><span>{index+1}</span><div><b>{item.title}</b><small>{item.detail}</small></div><span className={`jarvisLevel ${item.level.toLowerCase()}`}>{item.level}</span></button>)}{!jarvisQueue.length && <Empty text="Sin prioridades críticas." />}</section>
              <section className="jarvisWorkspaceCard"><div className="ey">SALUD OPERATIVA</div><h3>Expedientes a vigilar</h3>{lowestHealth.map(({matter,health}) => <button className="healthRow" key={matter.id} onClick={() => void openMatter(matter)}><strong className={`health-${health.tone.toLowerCase()}`}>{health.score}</strong><div><b>{matter.title}</b><small>{health.label} · {health.missing.length} dato(s) pendiente(s)</small></div></button>)}{!lowestHealth.length && <Empty text="Todavía no hay expedientes." />}</section>
              <section className="jarvisWorkspaceCard"><div className="ey">CALIDAD DE DATOS</div><h3>{incompleteMatters.length} expediente(s) incompletos</h3><p className="jarvisWorkspaceText">V3 permitió capturar rápido; V4 detecta qué conviene completar después sin volver obligatorios esos campos al inicio.</p><button className="secondary" onClick={() => openJarvis("Expedientes incompletos")}>Ver faltantes</button></section>
            </div>
            <section className="jarvisPanel">
              <div className="jarvisMark">J</div>
              <div className="jarvisBody"><p>{jarvisAnswer}</p></div>
              <form className="jarvisAsk" onSubmit={(event) => void askJarvis(event)}><input value={jarvisQuery} onChange={(event) => setJarvisQuery(event.target.value)} placeholder="Ej. ¿Qué tengo hoy? / Estado de Carlos / Amparos abiertos"/><button className="primary">Consultar</button></form>
              <div className="quickPrompts">{["¿Qué tengo hoy?","Incidencias críticas","Asuntos COMAR","Amparos abiertos"].map((prompt) => <button key={prompt} onClick={() => { setJarvisQuery(prompt); void askJarvis(undefined, prompt); }}>{prompt}</button>)}</div>
            </section>
          </>
        )}
      </main>

      {commandOpen && <div className="commandOverlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setCommandOpen(false); }}><div className="commandPalette"><div className="commandHeader"><span className="commandSpark">✦</span><input autoFocus value={commandQuery} onChange={(event) => setCommandQuery(event.target.value)} placeholder={selectedMatter ? `Preguntar sobre ${selectedMatter.title}…` : "Buscar o preguntar a Jarvis…"}/><kbd>ESC</kbd></div><div className="commandQuick">{["¿Qué debo hacer?","Expedientes incompletos","Incidencias críticas","Amparos abiertos"].map((prompt) => <button key={prompt} onClick={() => { setCommandQuery(prompt); setJarvisQuery(prompt); void askJarvis(undefined,prompt); }}>{prompt}</button>)}</div>{commandQuery && (commandMatches.clients.length > 0 || commandMatches.matters.length > 0) && <div className="commandResults"><div className="commandLabel">RESULTADOS</div>{commandMatches.clients.map((client) => <button key={client.id} onClick={() => { setSelectedClient(client); setSelectedMatter(null); setTab("clientes"); setCommandOpen(false); }}><span>CLIENTE</span><b>{client.full_name}</b></button>)}{commandMatches.matters.map((matter) => <button key={matter.id} onClick={() => { void openMatter(matter); setCommandOpen(false); }}><span>{matter.matter_type}</span><b>{matter.title}</b><small>{matter.external_file_number || matter.subtype}</small></button>)}</div>}<form className="commandAsk" onSubmit={(event) => { event.preventDefault(); setJarvisQuery(commandQuery); void askJarvis(undefined,commandQuery); }}><button className="jarvisPrimary" disabled={!commandQuery.trim()}>✦ Consultar a Jarvis</button></form><div className="commandAnswer"><div className="commandLabel">JARVIS</div><p>{jarvisAnswer}</p></div><div className="commandFooter"><span>Ctrl/⌘ + K para abrir desde cualquier pantalla</span><span>V4 no ejecuta cambios automáticamente</span></div></div></div>}

      {modal === "client" && <Modal title="Nuevo cliente" close={() => setModal(null)}><form onSubmit={addClient}><div className="quickIntro"><span>CAPTURA RÁPIDA</span><b>Solo el nombre es indispensable.</b><p>Los datos de contacto y observaciones pueden completarse después.</p></div><Field name="name" label="Nombre completo" required/><details className="advancedDetails"><summary>Agregar más datos <span>Opcional</span></summary><div className="advancedDetailsBody"><div className="grid2"><Field name="nationality" label="Nacionalidad"/><Field name="phone" label="Teléfono"/></div><Field name="email" label="Correo" type="email"/><TextArea name="notes" label="Observaciones"/></div></details><Actions/></form></Modal>}

      {modal === "matter" && <Modal title="Nuevo asunto" close={() => setModal(null)} wide><form onSubmit={addMatter}><div className="quickIntro"><span>CAPTURA RÁPIDA</span><b>Cliente + tipo de asunto y listo.</b><p>FC OS generará automáticamente el workflow. El resto puede documentarse cuando ya exista información real.</p></div><Select name="client" label="Cliente" required options={clients.map((client) => [client.id, client.full_name])}/><MatterSubtype/><details className="advancedDetails"><summary>Agregar datos del expediente <span>Opcional</span></summary><div className="advancedDetailsBody"><div className="grid3"><Select name="priority" label="Prioridad" defaultValue="NORMAL" options={priorities.map((item) => [item,item])}/><Field name="authority" label="Autoridad"/><Field name="office" label="Oficina"/></div><Field name="fileNumber" label="Expediente / NUT / folio"/><TextArea name="summary" label="Resumen estratégico"/><div className="grid2"><Field name="nextAction" label="Siguiente actuación"/><Field name="nextActionDue" label="Fecha de la siguiente actuación" type="datetime-local"/></div></div></details><Actions/></form></Modal>}

      {modal === "editMatter" && selectedMatter && <Modal title="Editar ficha del expediente" close={() => setModal(null)} wide><form onSubmit={editMatter}><div className="grid2"><Select name="priority" label="Prioridad" defaultValue={selectedMatter.priority} options={priorities.map((item) => [item,item])}/><Select name="status" label="Estado general" defaultValue={selectedMatter.status} options={[["OPEN","Abierto"],["PAUSED","Pausado"],["CLOSED","Cerrado"],["ARCHIVED","Archivado"]]}/></div><div className="grid2"><Field name="authority" label="Autoridad" defaultValue={selectedMatter.authority ?? ""}/><Field name="office" label="Oficina" defaultValue={selectedMatter.office ?? ""}/></div><Field name="fileNumber" label="Expediente / NUT / folio" defaultValue={selectedMatter.external_file_number ?? ""}/><TextArea name="summary" label="Resumen estratégico" defaultValue={selectedMatter.summary ?? ""}/><div className="grid2"><Field name="nextAction" label="Siguiente actuación" defaultValue={selectedMatter.next_action ?? ""}/><Field name="nextActionDue" label="Fecha" type="datetime-local" defaultValue={dateInput(selectedMatter.next_action_due_at)}/></div><Actions/></form></Modal>}

      {modal === "incident" && selectedMatter && <Modal title="Registrar incidencia" close={() => setModal(null)}><form onSubmit={addIncident}><div className="quickIntro compact"><span>REGISTRO RÁPIDO</span><b>Describe el problema y su severidad.</b></div><Field name="title" label="Incidencia" required/><Select name="severity" label="Severidad" defaultValue="MEDIUM" options={[["MEDIUM","Media"],["HIGH","Alta"],["CRITICAL","Crítica"],["LOW","Baja"]]}/><details className="advancedDetails"><summary>Agregar contexto <span>Opcional</span></summary><div className="advancedDetailsBody"><Field name="due" label="Fecha crítica" type="datetime-local"/><Select name="stage" label="Etapa relacionada" options={[["","General"],...stages.map((stage) => [stage.id,stage.workflow_template_stages?.name ?? "Etapa"])]}/><TextArea name="description" label="Descripción y estrategia"/></div></details><Actions/></form></Modal>}

      {modal === "task" && <Modal title="Nueva tarea o término" close={() => setModal(null)}><form onSubmit={addTask}><div className="quickIntro compact"><span>CAPTURA RÁPIDA</span><b>Qué hay que hacer y cuándo.</b></div><Field name="title" label="Título" required/><Field name="due" label="Fecha y hora" type="datetime-local"/><details className="advancedDetails"><summary>Más opciones <span>Opcional</span></summary><div className="advancedDetailsBody"><div className="grid2"><Select name="taskType" label="Tipo" options={taskTypes.map(([value,label]) => [value,label])}/><Select name="priority" label="Prioridad" defaultValue="NORMAL" options={priorities.map((item) => [item,item])}/></div><Select name="matter" label="Expediente" defaultValue={selectedMatter?.id ?? ""} options={[["","General"],...matters.map((matter) => [matter.id,matter.title])]}/><TextArea name="description" label="Instrucciones"/></div></details><Actions/></form></Modal>}

      {modal === "document" && selectedMatter && <Modal title="Registrar documento" close={() => setModal(null)}><form onSubmit={addDocument}><div className="quickIntro compact"><span>EXPEDIENTE DIGITAL</span><b>Identifica el documento.</b></div><Field name="name" label="Nombre del documento" required/><Select name="category" label="Categoría" options={[["COMAR","COMAR"],["INM","INM"],["AMPARO","Amparo"],["EVIDENCE","Prueba"],["CLIENT","Cliente"],["OTHER","Otro"]]}/><details className="advancedDetails"><summary>Agregar metadatos <span>Opcional</span></summary><div className="advancedDetailsBody"><Field name="documentDate" label="Fecha del documento" type="date"/><Select name="stage" label="Etapa relacionada" options={[["","Sin etapa"],...stages.map((stage) => [stage.id,stage.workflow_template_stages?.name ?? "Etapa"])]}/><Field name="url" label="Enlace al archivo" type="url"/><TextArea name="notes" label="Notas"/></div></details><Actions/></form></Modal>}

      {modal === "amparo" && selectedMatter && <Modal title="Crear amparo vinculado" close={() => setModal(null)} wide><form onSubmit={addAmparo}><div className="quickIntro"><span>SUBPROCEDIMIENTO VINCULADO</span><b>Elige el tipo de amparo.</b><p>Se creará con su workflow completo y ligado al expediente principal.</p></div><Select name="type" label="Tipo" options={[["AMPARO_INDIRECTO","Amparo indirecto"],["AMPARO_DIRECTO","Amparo directo"]]}/><details className="advancedDetails"><summary>Agregar datos iniciales <span>Opcional</span></summary><div className="advancedDetailsBody"><Select name="priority" label="Prioridad" defaultValue="HIGH" options={priorities.map((item) => [item,item])}/><div className="grid2"><Field name="authority" label="Órgano jurisdiccional / autoridad"/><Field name="fileNumber" label="Número de amparo"/></div><TextArea name="summary" label="Actos reclamados / estrategia inicial"/><div className="grid2"><Field name="nextAction" label="Siguiente actuación"/><Field name="nextActionDue" label="Fecha" type="datetime-local"/></div></div></details><Actions/></form></Modal>}
    </div>
  );
}

function MatterCenter(props: {
  matter: Matter;
  client: string;
  stages: Stage[];
  incidents: Incident[];
  events: Event[];
  documents: DocumentItem[];
  tasks: Task[];
  linked: Matter[];
  progress: number;
  currentStage?: Stage;
  tab: MatterTab;
  setTab: (tab: MatterTab) => void;
  onBack: () => void;
  onEdit: () => void;
  onIncident: () => void;
  onTask: () => void;
  onDocument: () => void;
  onAmparo: () => void;
  onSaveStage: (stage: Stage, data: Record<string,string>) => void;
  onResolveIncident: (incident: Incident) => void;
  onToggleTask: (task: Task) => void;
  onOpenLinked: (matter: Matter) => void;
}) {
  const { matter, client, stages, incidents, events, documents, tasks, linked, progress, currentStage, tab, setTab } = props;
  const activeIncidents = incidents.filter((incident) => incident.status !== "RESOLVED");
  return <>
    <button className="back" onClick={props.onBack}>← Todos los expedientes</button>
    <section className="caseHero">
      <div className="caseTitle"><div className="ey">EXPEDIENTE</div><div className="titleLine"><h1>{matter.title}</h1><Priority value={matter.priority}/></div><p>{client} · {matter.subtype || matter.matter_type}</p></div>
      <div className="caseActions"><button className="secondary" onClick={props.onEdit}>Editar ficha</button>{!matter.matter_type.startsWith("AMPARO") && <button className="primary" onClick={props.onAmparo}><Scale size={15}/> Vincular amparo</button>}</div>
      <div className="caseStats"><div><small>Avance</small><b>{progress}%</b><div className="progress"><span style={{width:`${progress}%`}}/></div></div><div><small>Etapa actual</small><b>{currentStage?.workflow_template_stages?.name ?? "—"}</b></div><div><small>Siguiente actuación</small><b>{matter.next_action || currentStage?.next_action || "—"}</b><span className={isOverdue(matter.next_action_due_at || currentStage?.next_action_due_at || null) ? "date dangerText" : "date"}>{fmtDate(matter.next_action_due_at || currentStage?.next_action_due_at || null, true)}</span></div><div><small>Incidencias abiertas</small><b>{activeIncidents.length}</b></div></div>
    </section>

    <div className="caseTabs">{[["resumen","Resumen"],["seguimiento","Seguimiento"],["cronologia","Cronología"],["tareas","Tareas"],["documentos","Documentos"],["vinculados","Vinculados"]].map(([key,label]) => <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key as MatterTab)}>{label}</button>)}</div>

    {tab === "resumen" && <div className="twoCols caseBody"><section className="panel"><SectionHead eyebrow="FICHA" title="Datos del expediente"/><div className="factGrid"><Fact label="Cliente" value={client}/><Fact label="Tipo" value={matter.matter_type}/><Fact label="Expediente / NUT / folio" value={matter.external_file_number}/><Fact label="Autoridad" value={matter.authority}/><Fact label="Oficina" value={matter.office}/><Fact label="Inicio" value={fmtDate(matter.opened_at)}/><Fact label="Estado" value={matter.status}/><Fact label="Prioridad" value={matter.priority}/></div><div className="summaryBox"><small>RESUMEN ESTRATÉGICO</small><p>{matter.summary || "Sin resumen estratégico registrado."}</p></div></section><section className="panel"><SectionHead eyebrow="CONTROL" title="Próxima actuación" action={<button className="secondary" onClick={props.onEdit}>Actualizar</button>}/><div className="nextAction"><CalendarClock size={25}/><div><b>{matter.next_action || "Sin actuación definida"}</b><p className={isOverdue(matter.next_action_due_at) ? "dangerText" : ""}>{fmtDate(matter.next_action_due_at, true)}</p></div></div><SectionHead eyebrow="INCIDENCIAS" title="Riesgos activos" action={<button className="secondary" onClick={props.onIncident}><Plus size={14}/> Incidencia</button>}/>{activeIncidents.length ? activeIncidents.slice(0,5).map((incident) => <IncidentRow key={incident.id} incident={incident} onResolve={() => props.onResolveIncident(incident)}/>) : <Empty text="Sin incidencias abiertas." />}</section></div>}

    {tab === "seguimiento" && <section className="trackingLayout"><div className="trackingHead"><div><div className="ey">MOTOR PROCESAL</div><h2>{stages.length} etapas</h2><p>Actualiza el estado en segundos. Abre los detalles solo cuando necesites documentar fechas, resultado, notas o la siguiente actuación.</p></div><button className="secondary" onClick={props.onIncident}><AlertTriangle size={15}/> Registrar incidencia</button></div><div className="stageStack">{stages.map((stage,index) => <StageEditor key={stage.id} stage={stage} index={index} onSave={props.onSaveStage}/>)}</div></section>}

    {tab === "cronologia" && <section className="panel"><SectionHead eyebrow="HISTORIAL" title="Cronología jurídica"/><div className="timeline">{events.map((event) => <div className="timelineItem" key={event.id}><div className="timelineDot"/><div className="timelineDate">{fmtDate(event.event_at,true)}</div><div><b>{event.title}</b><p>{event.description || event.event_type}</p></div></div>)}{!events.length && <Empty text="Aún no hay actuaciones registradas." />}</div></section>}

    {tab === "tareas" && <section className="panel"><SectionHead eyebrow="AGENDA DEL EXPEDIENTE" title="Tareas y términos" action={<button className="secondary" onClick={props.onTask}><Plus size={14}/> Tarea</button>}/>{tasks.length ? <div className="attentionList">{tasks.map((task) => <TaskRow key={task.id} task={task} matter={matter.title} onToggle={() => props.onToggleTask(task)}/>)}</div> : <Empty text="No hay tareas vinculadas a este expediente." />}</section>}

    {tab === "documentos" && <section className="panel"><SectionHead eyebrow="EXPEDIENTE DIGITAL" title="Documentos" action={<button className="secondary" onClick={props.onDocument}><Plus size={14}/> Documento</button>}/>{documents.length ? <div className="docGrid">{documents.map((document) => <article className="docCard" key={document.id}><FileText size={20}/><div><span className="tag">{document.category}</span><h3>{document.name}</h3><p>{fmtDate(document.document_date || document.created_at)}</p>{document.notes && <small>{document.notes}</small>}{document.external_url && <a href={document.external_url} target="_blank" rel="noreferrer">Abrir archivo ↗</a>}</div></article>)}</div> : <Empty text="No hay documentos registrados. V3 mantiene el registro simple de metadatos y enlaces; el almacenamiento físico de archivos seguirá para una versión posterior." />}</section>}

    {tab === "vinculados" && <section className="panel"><SectionHead eyebrow="RELACIONES" title="Asuntos vinculados" action={!matter.matter_type.startsWith("AMPARO") ? <button className="secondary" onClick={props.onAmparo}><Link2 size={14}/> Vincular amparo</button> : undefined}/>{linked.length ? <div className="list">{linked.map((item) => <button className="linkedRow" key={item.id} onClick={() => props.onOpenLinked(item)}><div><span className="tag">{item.matter_type}</span><b>{item.title}</b><small>{item.external_file_number || item.subtype}</small></div><ChevronRight size={18}/></button>)}</div> : <Empty text="No existen subprocedimientos o asuntos relacionados." />}</section>}
  </>;
}

function StageEditor({ stage, index, onSave }: { stage: Stage; index: number; onSave: (stage: Stage, data: Record<string,string>) => void }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSave(stage, Object.fromEntries([...form.entries()].map(([key,value]) => [key,String(value)])));
  }
  const statusClass = stage.state.toLowerCase();
  const hasDetail = Boolean(stage.scheduled_at || stage.actual_at || stage.outcome || stage.result || stage.notes || stage.next_action || stage.next_action_due_at);
  return <form className={`stageCard quickStage ${statusClass}`} onSubmit={submit}>
    <div className="stageIndex">{index+1}</div>
    <div className="stageMain">
      <div className="stageTop">
        <div className="stageIdentity"><h3>{stage.workflow_template_stages?.name}</h3><p>{stage.workflow_template_stages?.description}</p>{hasDetail && <div className="stageSnapshot">{stage.actual_at && <span>Real: {fmtDate(stage.actual_at)}</span>}{stage.outcome && <span>{stage.outcome}</span>}{stage.next_action && <span>→ {stage.next_action}</span>}</div>}</div>
        <div className="quickStageActions"><SelectInline name="state" defaultValue={stage.state} options={stageStates.map(([value,label]) => [value,label])}/><button className="quickSave" type="submit">Guardar</button></div>
      </div>
      <details className="stageDetails" open={false}>
        <summary>{hasDetail ? "Ver o editar detalles" : "Agregar detalles"}<span>Fechas · resultado · notas · siguiente actuación</span></summary>
        <div className="stageDetailsBody"><div className="stageFields"><Field name="scheduled" label="Programada" type="datetime-local" defaultValue={dateInput(stage.scheduled_at)}/><Field name="actual" label="Fecha real" type="datetime-local" defaultValue={dateInput(stage.actual_at)}/><Field name="outcome" label="Resultado corto" defaultValue={stage.outcome ?? ""}/><Field name="result" label="Resultado / determinación" defaultValue={stage.result ?? ""}/><Field name="nextAction" label="Siguiente actuación" defaultValue={stage.next_action ?? ""}/><Field name="nextActionDue" label="Fecha siguiente actuación" type="datetime-local" defaultValue={dateInput(stage.next_action_due_at)}/></div><TextArea name="notes" label="Notas de la etapa" defaultValue={stage.notes ?? ""}/><div className="stageSave"><button className="secondary" type="submit">Guardar todos los detalles</button></div></div>
      </details>
    </div>
  </form>;
}
function Auth() {
  const [mode, setMode] = useState<"in"|"up">("in");
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    setMessage("");
    if (mode === "in") {
      const result = await supabase.auth.signInWithPassword({ email, password });
      if (result.error) setMessage(result.error.message);
    } else {
      const result = await supabase.auth.signUp({ email, password });
      setMessage(result.error ? result.error.message : "Cuenta creada. Revisa tu correo para confirmar y después inicia sesión.");
    }
  }
  return <div className="auth"><div className="authCard"><div className="authBrand brandAuthV3"><img className="authLogoMark" src="./brand/fernandez-conde-mark.jpg" alt="Isotipo Fernández Conde"/><div className="authBrandText"><img className="authLogoWordmark" src="./brand/fernandez-conde-horizontal.jpg" alt="Fernández Conde"/><div className="muted">OS · V4</div></div></div><h2>{mode === "in" ? "Iniciar sesión" : "Crear acceso"}</h2><p>Sistema operativo jurídico. Finanzas permanece independiente.</p>{message && <div className="authMsg">{message}</div>}<form onSubmit={submit}><Field name="email" label="Correo" type="email" required/><Field name="password" label="Contraseña" type="password" required/><button className="primary full">{mode === "in" ? "Entrar" : "Crear cuenta"}</button></form><button className="secondary full" onClick={() => setMode(mode === "in" ? "up" : "in")}>{mode === "in" ? "Crear una cuenta" : "Ya tengo cuenta"}</button></div></div>;
}

function MatterSubtype() {
  const [type, setType] = useState("COMAR");
  return <div className="matterTypeHelper"><div className="field"><label>Tipo de asunto</label><select name="type" value={type} onChange={(event) => setType(event.target.value)}><option value="COMAR">COMAR</option><option value="INM">Migración / INM</option></select></div>{type === "INM" && <Select name="subtype" label="Trámite INM" options={inmOptions.map((item) => [item.value,item.value])}/>}</div>;
}

function PageHead({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="pageHead"><div><div className="ey">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}
function SectionHead({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: React.ReactNode }) {
  return <div className="sectionTitle"><div>{eyebrow && <div className="ey">{eyebrow}</div>}<h2>{title}</h2></div>{action}</div>;
}
function Metric({ icon, label, value, emphasis = false }: { icon: React.ReactNode; label: string; value: number; emphasis?: boolean }) {
  return <article className={`card ${emphasis ? "emphasis" : ""}`}><div className="metricIcon">{icon}</div><small>{label}</small><strong>{value}</strong></article>;
}
function MatterRow({ matter, client, onOpen }: { matter: Matter; client: string; onOpen: () => void }) {
  return <button className="matterRow" onClick={onOpen}><div className="matterRowMain"><div><span className="tag">{matter.matter_type}</span>{matter.parent_matter_id && <span className="tag linked">Vinculado</span>}</div><b>{matter.title}</b><small>{client} · {matter.subtype || "—"}</small></div><div className="matterRowMeta"><Priority value={matter.priority}/>{matter.next_action && <small>Siguiente: {matter.next_action}</small>}{matter.next_action_due_at && <span className={isOverdue(matter.next_action_due_at) ? "dangerText" : ""}>{fmtDate(matter.next_action_due_at)}</span>}</div><ChevronRight size={17}/></button>;
}
function TaskRow({ task, matter, onToggle }: { task: Task; matter: string; onToggle: () => void }) {
  return <div className={`taskRow ${isOverdue(task.due_at) && task.status !== "DONE" ? "overdue" : ""}`}><button className={`check ${task.status === "DONE" ? "done" : ""}`} onClick={onToggle}>{task.status === "DONE" ? <CheckCircle2 size={18}/> : ""}</button><div className="taskText"><div><span className="tag">{task.task_type}</span>{task.is_legal_deadline && <span className="tag deadline">LEGAL</span>}</div><b className={task.status === "DONE" ? "strike" : ""}>{task.title}</b><small>{matter}</small></div><div className="taskDue"><Priority value={task.priority}/><span>{fmtDate(task.due_at,true)}</span></div></div>;
}
function TaskSection({ title, tasks, matters, onToggle, danger = false }: { title: string; tasks: Task[]; matters: Matter[]; onToggle: (task: Task) => Promise<void>; danger?: boolean }) {
  return <section className={`panel ${danger && tasks.length ? "dangerPanel" : ""}`}><SectionHead title={`${title} · ${tasks.length}`}/>{tasks.length ? <div className="attentionList">{tasks.map((task) => <TaskRow key={task.id} task={task} matter={matters.find((matter) => matter.id === task.matter_id)?.title ?? "General"} onToggle={() => void onToggle(task)}/>)}</div> : <Empty text="Sin elementos en esta sección." />}</section>;
}
function IncidentRow({ incident, onResolve }: { incident: Incident; onResolve: () => void }) {
  return <div className="incidentRow"><Severity value={incident.severity}/><div><b>{incident.title}</b><p>{incident.description || "Sin descripción"}</p></div>{incident.status !== "RESOLVED" && <button className="secondary" onClick={onResolve}>Resolver</button>}</div>;
}
function Priority({ value }: { value: string }) { return <span className={`priority p-${value.toLowerCase()}`}>{value}</span>; }
function Severity({ value }: { value: string }) { return <span className={`severity s-${value.toLowerCase()}`}>{value}</span>; }
function Fact({ label, value }: { label: string; value: string | null | undefined }) { return <div className="fact"><small>{label}</small><b>{value || "—"}</b></div>; }
function Empty({ text }: { text: string }) { return <div className="empty">{text}</div>; }
function Modal({ title, close, children, wide = false }: { title: string; close: () => void; children: React.ReactNode; wide?: boolean }) { return <div className="modalBack" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><div className={`modal ${wide ? "wide" : ""}`}><div className="rowBetween"><h2>{title}</h2><button className="secondary" onClick={close}>Cerrar</button></div>{children}</div></div>; }
function Field({ name, label, type = "text", required = false, defaultValue = "" }: { name: string; label: string; type?: string; required?: boolean; defaultValue?: string }) { return <div className="field"><label>{label}</label><input name={name} type={type} required={required} defaultValue={defaultValue}/></div>; }
function TextArea({ name, label, defaultValue = "" }: { name: string; label: string; defaultValue?: string }) { return <div className="field"><label>{label}</label><textarea name={name} defaultValue={defaultValue}/></div>; }
function Select({ name, label, options, required = false, defaultValue }: { name: string; label: string; options: ReadonlyArray<ReadonlyArray<string>>; required?: boolean; defaultValue?: string }) { return <div className="field"><label>{label}</label><select name={name} required={required} defaultValue={defaultValue}>{options.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></div>; }
function SelectInline({ name, options, defaultValue }: { name: string; options: ReadonlyArray<ReadonlyArray<string>>; defaultValue?: string }) { return <select className="stateSelect" name={name} defaultValue={defaultValue}>{options.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>; }
function Actions() { return <div className="actions"><button className="primary" type="submit">Guardar</button></div>; }
