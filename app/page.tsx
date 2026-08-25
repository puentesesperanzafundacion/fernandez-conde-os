"use client";

import { useMemo, useState } from "react";

type StageState = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED" | "NOT_APPLICABLE";

type Template = {
  code: string;
  name: string;
  description: string;
  stages: string[];
  incidents: string[];
};

const templates: Template[] = [
  {
    code: "COMAR",
    name: "COMAR · Reconocimiento de la condición de refugiado",
    description: "Flujo principal COMAR con incidencias y posibilidad de vincular amparo.",
    stages: [
      "Apertura y diagnóstico",
      "Solicitud de reconocimiento",
      "Recepción / radicación",
      "Ratificación (si aplica)",
      "Constancia de trámite",
      "Cuestionario / formulario",
      "Cita de entrevista",
      "Entrevista de elegibilidad",
      "Pruebas / elementos complementarios",
      "Análisis / espera de resolución",
      "Resolución",
      "Notificación",
      "Ruta posterior",
      "Cierre administrativo"
    ],
    incidents: [
      "Solicitud fuera de plazo",
      "Negativa u obstáculo de acceso",
      "Prevención / requerimiento",
      "Cambio de entidad / traslado",
      "Control de comparecencias",
      "Inasistencia",
      "Reprogramación",
      "Intérprete / barrera lingüística",
      "Entrevista complementaria",
      "Ampliación de plazo",
      "Omisión / dilación",
      "Riesgo de abandono",
      "Desistimiento",
      "Grupo familiar / separación",
      "NNA / protección reforzada",
      "Recurso administrativo",
      "Amparo vinculado"
    ]
  },
  {
    code: "INM",
    name: "INM · Trámite migratorio",
    description: "Motor genérico para trámites migratorios y sus distintas modalidades.",
    stages: [
      "Diagnóstico migratorio",
      "Selección de trámite y modalidad",
      "Integración de requisitos",
      "Cita / presentación",
      "Ingreso del trámite",
      "Prevención / comparecencia",
      "En estudio",
      "Resolución",
      "Documentación / biométricos",
      "Entrega / conclusión",
      "Ruta posterior"
    ],
    incidents: [
      "Prevención",
      "Problema de cita",
      "Pago / derechos",
      "Documento faltante o inconsistente",
      "Vencimiento / plazo crítico",
      "Omisión / falta de resolución",
      "Negativa",
      "Error material / datos",
      "Reposición / pérdida",
      "Verificación migratoria",
      "Procedimiento administrativo migratorio",
      "Amparo vinculado"
    ]
  },
  {
    code: "AMPARO_INDIRECTO",
    name: "Amparo indirecto",
    description: "Asunto autónomo o subprocedimiento vinculado a COMAR o INM.",
    stages: [
      "Análisis de procedencia",
      "Demanda",
      "Presentación y turno",
      "Auto inicial",
      "Desahogo de prevención",
      "Tercero interesado",
      "Incidente de suspensión",
      "Informe justificado",
      "Pruebas / alegatos",
      "Audiencia constitucional",
      "Sentencia",
      "Notificación de sentencia",
      "Recursos",
      "Ejecutoria",
      "Cumplimiento",
      "Incidentes de ejecución",
      "Archivo"
    ],
    incidents: [
      "Prevención",
      "Desechamiento",
      "Incompetencia / remisión",
      "Diferimiento",
      "Informe omitido o incompleto",
      "Suspensión provisional",
      "Suspensión definitiva",
      "Incumplimiento de suspensión",
      "Queja",
      "Revisión",
      "Reclamación",
      "Riesgo de sobreseimiento",
      "Incumplimiento / exceso / defecto"
    ]
  },
  {
    code: "AMPARO_DIRECTO",
    name: "Amparo directo",
    description: "Flujo base para amparo directo, revisión excepcional y cumplimiento.",
    stages: [
      "Análisis de procedencia",
      "Demanda",
      "Presentación ante autoridad responsable",
      "Tercero interesado",
      "Remisión al Tribunal Colegiado",
      "Turno y radicación",
      "Auto inicial",
      "Amparo adhesivo",
      "Alegatos / actuaciones previas",
      "Proyecto / listado",
      "Sentencia",
      "Revisión excepcional",
      "Cumplimiento",
      "Archivo"
    ],
    incidents: [
      "Prevención",
      "Desechamiento",
      "Remisión tardía o incompleta",
      "Reclamación",
      "Revisión",
      "Incidencia de cumplimiento"
    ]
  }
];

const states: { value: StageState; label: string }[] = [
  { value: "PENDING", label: "○ Pendiente" },
  { value: "IN_PROGRESS", label: "◐ En curso" },
  { value: "COMPLETED", label: "✓ Completado" },
  { value: "BLOCKED", label: "! Incidencia" },
  { value: "NOT_APPLICABLE", label: "— No aplica" }
];

export default function Home() {
  const [selected, setSelected] = useState("COMAR");
  const [stageStates, setStageStates] = useState<Record<string, StageState>>({});
  const template = useMemo(() => templates.find((item) => item.code === selected) ?? templates[0], [selected]);
  const completed = template.stages.filter((_, index) => stageStates[`${selected}:${index}`] === "COMPLETED").length;
  const progress = Math.round((completed / template.stages.length) * 100);

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><div className="mark">FC</div><div><strong>FERNÁNDEZ CONDE</strong><span>OS · V1</span></div></div>
        <nav>{["Inicio", "Clientes", "Asuntos", "Seguimiento", "Tareas", "Jarvis"].map((item) => <button key={item} className={item === "Seguimiento" ? "active" : ""}>{item}</button>)}</nav>
        <div className="environment">ENTORNO INDEPENDIENTE<br/><b>No conectado a Finanzas</b></div>
      </aside>

      <section className="content">
        <header><div><p className="eyebrow">SEGUIMIENTO PROCESAL</p><h1>Motor de asuntos</h1><p>Etapas configurables, incidencias y subprocedimientos vinculados.</p></div><button className="primary">+ Nuevo asunto</button></header>

        <div className="metrics">
          <article><span>Plantillas V1</span><strong>{templates.length}</strong></article>
          <article><span>Etapas</span><strong>{template.stages.length}</strong></article>
          <article><span>Incidencias</span><strong>{template.incidents.length}</strong></article>
          <article><span>Avance demo</span><strong>{progress}%</strong></article>
        </div>

        <section className="panel">
          <div className="panelHead"><div><p className="eyebrow">PLANTILLA</p><h2>{template.name}</h2><p>{template.description}</p></div><select value={selected} onChange={(event) => setSelected(event.target.value)}>{templates.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></div>
          <div className="timeline">
            {template.stages.map((stage, index) => {
              const key = `${selected}:${index}`;
              const current = stageStates[key] ?? "PENDING";
              return <article className="stage" key={key}><div className="number">{index + 1}</div><div><h3>{stage}</h3><p>La etapa podrá registrar fecha, responsable, notas, actuaciones y término.</p></div><select className="state" value={current} onChange={(event) => setStageStates((prev) => ({...prev, [key]: event.target.value as StageState}))}>{states.map((state) => <option key={state.value} value={state.value}>{state.label}</option>)}</select></article>;
            })}
          </div>
        </section>

        <section className="panel"><div className="panelHead"><div><p className="eyebrow">INCIDENCIAS</p><h2>Eventos que rompen el flujo normal</h2><p>Se registran por separado para conservar la cronología jurídica del expediente.</p></div></div><div className="incidentGrid">{template.incidents.map((incident) => <article key={incident}><span>INCIDENCIA</span><h3>{incident}</h3><p>Puede vincularse a una etapa, tarea, fecha límite y actuación.</p></article>)}</div></section>
      </section>
    </main>
  );
}
