from pathlib import Path
import json

page_path = Path('app/page.tsx')
css_path = Path('app/globals.css')
package_path = Path('package.json')

text = page_path.read_text(encoding='utf-8')

# Jarvis Core import.
needle = 'import { inmOptions, inmTemplateFor } from "@/lib/inm-workflows";\n'
addition = needle + 'import { briefingDate, buildPriorityQueue, matterHealth, missingMatterFields, type JarvisPriorityItem } from "@/lib/jarvis-core";\n'
assert needle in text
text = text.replace(needle, addition, 1)

# V4 state for omnipresent command center.
needle = '  const [jarvisAnswer, setJarvisAnswer] = useState("Pregunta por clientes, asuntos, términos, COMAR, INM, amparos o incidencias.");\n'
addition = needle + '  const [commandOpen, setCommandOpen] = useState(false);\n  const [commandQuery, setCommandQuery] = useState("");\n'
assert needle in text
text = text.replace(needle, addition, 1)

# Keyboard shortcut Ctrl/Cmd+K.
needle = '  useEffect(() => {\n    if (user) void bootstrap();\n'
addition = '''  useEffect(() => {
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
'''
assert needle in text
text = text.replace(needle, addition, 1)

# Extend Jarvis query behavior before the existing incident branch.
needle = '    if (!q) return;\n    if (q.includes("incidencia") || q.includes("problema")) {\n'
addition = '''    if (!q) return;
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
'''
assert needle in text
text = text.replace(needle, addition, 1)

# Insert helpers and V4 derived intelligence.
needle = '''  function matterTitle(id: string) {
    return matters.find((matter) => matter.id === id)?.title ?? "Asunto";
  }

  const openMatters = useMemo(() => matters.filter((matter) => matter.status === "OPEN"), [matters]);
'''
addition = '''  function matterTitle(id: string) {
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
'''
assert needle in text
text = text.replace(needle, addition, 1)

needle = '  const stagnantMatters = useMemo(() => openMatters.filter((matter) => Date.now() - new Date(matter.updated_at).getTime() > 30 * 86_400_000), [openMatters]);\n'
addition = needle + '''  const jarvisQueue = useMemo(() => buildPriorityQueue(openMatters, openTasks, allIncidents), [openMatters, openTasks, allIncidents]);
  const incompleteMatters = useMemo(() => openMatters.filter((matter) => missingMatterFields(matter).length >= 2), [openMatters]);
  const lowestHealth = useMemo(() => openMatters.map((matter) => ({ matter, health: matterHealth(matter, tasks, allIncidents) })).sort((a, b) => a.health.score - b.health.score).slice(0, 6), [openMatters, tasks, allIncidents]);
'''
assert needle in text
text = text.replace(needle, addition, 1)

needle = '''  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
'''
addition = '''  const commandMatches = useMemo(() => {
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
'''
assert needle in text
text = text.replace(needle, addition, 1)

# Version labels.
text = text.replace('OS · V3', 'OS · V4')
text = text.replace('V3 consulta la información estructurada de FC OS;', 'V4 combina reglas operativas y consulta contextual sobre FC OS;')

# Global bar: omnipresent Jarvis.
needle = '          <button className="primary" onClick={() => setModal("matter")}><Plus size={16}/> Nuevo asunto</button>\n'
addition = '''          <div className="globalActions"><button className="jarvisTrigger" onClick={() => openJarvis()}><span>✦</span> Jarvis <kbd>Ctrl K</kbd></button><button className="primary" onClick={() => setModal("matter")}><Plus size={16}/> Nuevo asunto</button></div>
'''
assert needle in text
text = text.replace(needle, addition, 1)

# Dashboard briefing before metrics.
needle = '''            <PageHead eyebrow="PANEL DEL DESPACHO" title="Control operativo" description="Prioridades, términos, expedientes e incidencias en una sola vista." />
            <div className="cards">
'''
addition = '''            <PageHead eyebrow="PANEL DEL DESPACHO" title="Control operativo" description="V4 prioriza lo que requiere atención antes de que tengas que buscarlo." />
            <section className="jarvisBriefing">
              <div className="jarvisBriefingHead"><div><div className="ey">JARVIS BRIEFING · {briefingDate()}</div><h2>{jarvisQueue.length ? `${jarvisQueue.length} señales operativas detectadas` : "Operación bajo control"}</h2><p>{jarvisQueue.length ? "Ordenadas por urgencia, riesgo y vencimiento. Jarvis no modifica expedientes sin una acción tuya." : "No hay vencidos, incidencias altas ni alertas operativas relevantes."}</p></div><button className="jarvisPrimary" onClick={() => openJarvis("¿Qué debo hacer?")}>✦ ¿Qué debo hacer?</button></div>
              <div className="jarvisPriorityStrip">{jarvisQueue.slice(0,4).map((item) => <button key={item.id} onClick={() => openPriorityItem(item)}><span className={`jarvisLevel ${item.level.toLowerCase()}`}>{item.level}</span><b>{item.title}</b><small>{item.detail}{item.matter_id ? ` · ${matterTitle(item.matter_id)}` : ""}</small></button>)}{!jarvisQueue.length && <div className="jarvisCalm">✓ Sin prioridades críticas detectadas.</div>}</div>
              <div className="jarvisBriefingFoot"><span>{incompleteMatters.length} expediente(s) por completar</span><span>{stagnantMatters.length} sin movimiento &gt;30 días</span><button onClick={() => openJarvis("Expedientes incompletos")}>Revisar calidad de datos →</button></div>
            </section>
            <div className="cards">
'''
assert needle in text
text = text.replace(needle, addition, 1)

# Selected matter: contextual Jarvis pulse.
needle = '''        {tab === "asuntos" && selectedMatter && (
          <MatterCenter
'''
addition = '''        {tab === "asuntos" && selectedMatter && (
          <>
          <section className="jarvisCasePulse">
            <div className="jarvisCaseScore"><span>JARVIS · SALUD</span><strong className={`health-${selectedHealth?.tone.toLowerCase()}`}>{selectedHealth?.score ?? 100}</strong><small>/100 · {selectedHealth?.label}</small></div>
            <div className="jarvisCaseRead"><b>{selectedHealth && selectedHealth.score < 70 ? "Este expediente requiere atención." : "Expediente operativo estable."}</b><p>{selectedMissing.length ? `Conviene completar: ${selectedMissing.join(", ")}.` : "No detecto campos operativos esenciales pendientes."}</p></div>
            <div className="jarvisCaseActions"><button onClick={() => openJarvis("Analiza este expediente")}>✦ Analizar</button>{selectedMissing.length > 0 && <button onClick={() => setModal("editMatter")}>Completar ficha</button>}{selectedHealth?.overdue ? <button onClick={() => setMatterTab("tareas")}>Revisar vencidos ({selectedHealth.overdue})</button> : null}{!selectedMatter.next_action && <button onClick={() => setModal("editMatter")}>Definir siguiente actuación</button>}</div>
          </section>
          <MatterCenter
'''
assert needle in text
text = text.replace(needle, addition, 1)

needle = '''            onOpenLinked={(matter) => void openMatter(matter)}
          />
        )}
'''
addition = '''            onOpenLinked={(matter) => void openMatter(matter)}
          />
          </>
        )}
'''
assert needle in text
text = text.replace(needle, addition, 1)

# Jarvis workspace before conversation panel.
needle = '''            <PageHead eyebrow="JARVIS · LECTURA" title="Consulta del despacho" description="V4 combina reglas operativas y consulta contextual sobre FC OS; Finanzas permanece fuera de esta versión y Jarvis no ejecuta acciones jurídicas autónomas." />
            <section className="jarvisPanel">
'''
addition = '''            <PageHead eyebrow="JARVIS CORE · V4" title="Centro de inteligencia operativa" description="Reglas, prioridades, calidad de expedientes y consulta contextual. Finanzas permanece fuera de esta versión." action={<button className="jarvisPrimary" onClick={() => openJarvis("¿Qué debo hacer?")}>✦ ¿Qué debo hacer?</button>} />
            <div className="jarvisWorkspace">
              <section className="jarvisWorkspaceCard"><div className="ey">PRIORIDAD</div><h3>Cola recomendada</h3>{jarvisQueue.slice(0,5).map((item,index) => <button className="jarvisQueueRow" key={item.id} onClick={() => openPriorityItem(item)}><span>{index+1}</span><div><b>{item.title}</b><small>{item.detail}</small></div><span className={`jarvisLevel ${item.level.toLowerCase()}`}>{item.level}</span></button>)}{!jarvisQueue.length && <Empty text="Sin prioridades críticas." />}</section>
              <section className="jarvisWorkspaceCard"><div className="ey">SALUD OPERATIVA</div><h3>Expedientes a vigilar</h3>{lowestHealth.map(({matter,health}) => <button className="healthRow" key={matter.id} onClick={() => void openMatter(matter)}><strong className={`health-${health.tone.toLowerCase()}`}>{health.score}</strong><div><b>{matter.title}</b><small>{health.label} · {health.missing.length} dato(s) pendiente(s)</small></div></button>)}{!lowestHealth.length && <Empty text="Todavía no hay expedientes." />}</section>
              <section className="jarvisWorkspaceCard"><div className="ey">CALIDAD DE DATOS</div><h3>{incompleteMatters.length} expediente(s) incompletos</h3><p className="jarvisWorkspaceText">V3 permitió capturar rápido; V4 detecta qué conviene completar después sin volver obligatorios esos campos al inicio.</p><button className="secondary" onClick={() => openJarvis("Expedientes incompletos")}>Ver faltantes</button></section>
            </div>
            <section className="jarvisPanel">
'''
assert needle in text
text = text.replace(needle, addition, 1)

# Insert command palette before ordinary modals.
needle = '      {modal === "client" && <Modal title="Nuevo cliente"'
addition = '''      {commandOpen && <div className="commandOverlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setCommandOpen(false); }}><div className="commandPalette"><div className="commandHeader"><span className="commandSpark">✦</span><input autoFocus value={commandQuery} onChange={(event) => setCommandQuery(event.target.value)} placeholder={selectedMatter ? `Preguntar sobre ${selectedMatter.title}…` : "Buscar o preguntar a Jarvis…"}/><kbd>ESC</kbd></div><div className="commandQuick">{["¿Qué debo hacer?","Expedientes incompletos","Incidencias críticas","Amparos abiertos"].map((prompt) => <button key={prompt} onClick={() => { setCommandQuery(prompt); setJarvisQuery(prompt); void askJarvis(undefined,prompt); }}>{prompt}</button>)}</div>{commandQuery && (commandMatches.clients.length > 0 || commandMatches.matters.length > 0) && <div className="commandResults"><div className="commandLabel">RESULTADOS</div>{commandMatches.clients.map((client) => <button key={client.id} onClick={() => { setSelectedClient(client); setSelectedMatter(null); setTab("clientes"); setCommandOpen(false); }}><span>CLIENTE</span><b>{client.full_name}</b></button>)}{commandMatches.matters.map((matter) => <button key={matter.id} onClick={() => { void openMatter(matter); setCommandOpen(false); }}><span>{matter.matter_type}</span><b>{matter.title}</b><small>{matter.external_file_number || matter.subtype}</small></button>)}</div>}<form className="commandAsk" onSubmit={(event) => { event.preventDefault(); setJarvisQuery(commandQuery); void askJarvis(undefined,commandQuery); }}><button className="jarvisPrimary" disabled={!commandQuery.trim()}>✦ Consultar a Jarvis</button></form><div className="commandAnswer"><div className="commandLabel">JARVIS</div><p>{jarvisAnswer}</p></div><div className="commandFooter"><span>Ctrl/⌘ + K para abrir desde cualquier pantalla</span><span>V4 no ejecuta cambios automáticamente</span></div></div></div>}

      {modal === "client" && <Modal title="Nuevo cliente"'''
assert needle in text
text = text.replace(needle, addition, 1)

page_path.write_text(text, encoding='utf-8')

css = css_path.read_text(encoding='utf-8')
css += r'''

/* V4 · Jarvis Core */
.globalActions{display:flex;align-items:center;gap:8px}.jarvisTrigger,.jarvisPrimary{border:1px solid #a88749;background:#071a37;color:#fff;border-radius:9px;padding:10px 13px;display:inline-flex;align-items:center;gap:8px;font-weight:700}.jarvisTrigger:hover,.jarvisPrimary:hover{background:#0b2449}.jarvisTrigger span,.jarvisPrimary:first-letter{color:#d0af68}.jarvisTrigger kbd{font-size:8px;font-weight:600;color:#c9ced7;border:1px solid #43536b;border-radius:5px;padding:2px 5px;background:#0b2347}.jarvisBriefing{background:linear-gradient(135deg,#051731 0%,#0b264d 68%,#18365d 100%);color:#fff;border:1px solid #a88749;border-radius:16px;padding:20px;margin-bottom:15px;box-shadow:0 10px 30px rgba(5,23,49,.12)}.jarvisBriefing .ey{color:#d0af68;text-transform:capitalize}.jarvisBriefingHead{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.jarvisBriefing h2{font:24px Georgia,serif;margin:3px 0 5px}.jarvisBriefing p{font-size:11px;color:#bdc6d3;margin:0}.jarvisBriefing .jarvisPrimary{background:#fff;color:#071a37;border-color:#fff;white-space:nowrap}.jarvisPriorityStrip{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:17px}.jarvisPriorityStrip>button{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.055);color:#fff;border-radius:10px;padding:11px;text-align:left;display:grid;gap:5px}.jarvisPriorityStrip>button:hover{background:rgba(255,255,255,.1)}.jarvisPriorityStrip b{font-size:11px}.jarvisPriorityStrip small{font-size:8px;color:#b9c3d0;line-height:1.45}.jarvisCalm{grid-column:1/-1;border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:14px;color:#c9d7ce;font-size:11px}.jarvisBriefingFoot{border-top:1px solid rgba(255,255,255,.12);margin-top:14px;padding-top:11px;display:flex;gap:16px;align-items:center;color:#aeb9c8;font-size:9px}.jarvisBriefingFoot button{margin-left:auto;border:0;background:transparent;color:#d8bb7d;font-size:9px}.jarvisLevel{display:inline-block;width:max-content;border-radius:999px;padding:3px 6px;font-size:7px;font-weight:900;letter-spacing:.08em}.jarvisLevel.critical{background:#5c1e24;color:#ffdfe1}.jarvisLevel.high{background:#62471d;color:#ffe6ae}.jarvisLevel.medium{background:#30435e;color:#dce8f7}.jarvisCasePulse{display:grid;grid-template-columns:auto 1fr auto;gap:16px;align-items:center;background:#071a37;color:#fff;border:1px solid #a88749;border-radius:12px;padding:13px 16px;margin-bottom:10px}.jarvisCaseScore{display:grid;grid-template-columns:auto auto;align-items:end;column-gap:5px;min-width:110px}.jarvisCaseScore>span{grid-column:1/-1;font-size:7px;color:#d0af68;font-weight:900;letter-spacing:.13em}.jarvisCaseScore strong{font:30px Georgia,serif;line-height:1}.jarvisCaseScore small{font-size:8px;color:#aebaca;padding-bottom:3px}.jarvisCaseRead b{font-size:11px}.jarvisCaseRead p{font-size:9px;color:#b6c0ce;margin:3px 0 0}.jarvisCaseActions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.jarvisCaseActions button{border:1px solid #344b69;background:#0b2449;color:#fff;border-radius:7px;padding:7px 9px;font-size:8px}.jarvisCaseActions button:first-child{border-color:#a88749;color:#ead09b}.health-good{color:#73ae88!important}.health-watch{color:#d0af68!important}.health-attention{color:#df9a49!important}.health-critical{color:#e16b70!important}.jarvisWorkspace{display:grid;grid-template-columns:1.2fr 1fr .8fr;gap:10px;margin-bottom:14px}.jarvisWorkspaceCard{background:#fff;border:1px solid var(--line);border-radius:12px;padding:15px}.jarvisWorkspaceCard h3{font:17px Georgia,serif;margin:2px 0 11px}.jarvisQueueRow,.healthRow{width:100%;border:0;border-top:1px solid var(--line);background:#fff;text-align:left;padding:9px 0;display:grid;align-items:center;gap:9px}.jarvisQueueRow{grid-template-columns:20px 1fr auto}.healthRow{grid-template-columns:38px 1fr}.jarvisQueueRow:first-of-type,.healthRow:first-of-type{border-top:0}.jarvisQueueRow>span:first-child{width:19px;height:19px;border-radius:50%;background:#f2eee5;display:grid;place-items:center;font-size:8px;font-weight:800;color:#715b34}.jarvisQueueRow b,.healthRow b{display:block;font-size:10px}.jarvisQueueRow small,.healthRow small{display:block;font-size:8px;color:var(--muted);margin-top:2px}.healthRow>strong{font:20px Georgia,serif}.jarvisWorkspaceText{font-size:10px!important;color:var(--muted)!important;line-height:1.55;margin-bottom:12px!important}.commandOverlay{position:fixed;inset:0;background:rgba(1,10,24,.66);backdrop-filter:blur(5px);z-index:200;display:grid;place-items:start center;padding:10vh 14px}.commandPalette{width:min(720px,96vw);background:#fbfbfa;border:1px solid #a88749;border-radius:15px;box-shadow:0 28px 90px rgba(0,0,0,.35);overflow:hidden}.commandHeader{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px;padding:14px 16px;background:#071a37}.commandSpark{font-size:20px;color:#c9a35c}.commandHeader input{border:0;outline:0;background:transparent;color:#fff;font-size:15px}.commandHeader input::placeholder{color:#8390a3}.commandHeader kbd{font-size:8px;color:#98a5b6;border:1px solid #394b65;border-radius:5px;padding:3px 6px}.commandQuick{display:flex;gap:6px;overflow:auto;padding:10px 12px;border-bottom:1px solid var(--line)}.commandQuick button{white-space:nowrap;border:1px solid #ded8cb;background:#f7f3eb;color:#5f4e2e;border-radius:999px;padding:6px 9px;font-size:8px}.commandResults{padding:6px 10px;border-bottom:1px solid var(--line)}.commandResults button{width:100%;display:grid;gap:2px;text-align:left;border:0;background:transparent;padding:8px;border-radius:7px}.commandResults button:hover{background:#f2f2ef}.commandResults span,.commandLabel{font-size:7px;font-weight:900;letter-spacing:.12em;color:#a27f42}.commandResults b{font-size:10px}.commandResults small{font-size:8px;color:var(--muted)}.commandAsk{padding:10px 12px 0;display:flex;justify-content:flex-end}.commandAsk .jarvisPrimary{padding:8px 11px;font-size:9px}.commandAsk .jarvisPrimary:disabled{opacity:.45;cursor:not-allowed}.commandAnswer{padding:13px 16px}.commandAnswer p{font-size:11px;line-height:1.6;color:#363b42;margin:6px 0 0}.commandFooter{border-top:1px solid var(--line);padding:8px 13px;display:flex;justify-content:space-between;color:#8a8f96;font-size:7px}.jarvisPanel{border-color:#d9c69d}
@media(max-width:1050px){.jarvisPriorityStrip{grid-template-columns:repeat(2,1fr)}.jarvisWorkspace{grid-template-columns:1fr 1fr}.jarvisWorkspaceCard:last-child{grid-column:1/-1}.jarvisCasePulse{grid-template-columns:auto 1fr}.jarvisCaseActions{grid-column:1/-1;justify-content:flex-start}}
@media(max-width:700px){.globalActions{gap:5px}.jarvisTrigger{padding:9px}.jarvisTrigger kbd{display:none}.jarvisBriefing{padding:15px}.jarvisBriefingHead{display:grid}.jarvisBriefing .jarvisPrimary{width:max-content}.jarvisPriorityStrip{grid-template-columns:1fr}.jarvisBriefingFoot{flex-wrap:wrap}.jarvisBriefingFoot button{margin-left:0}.jarvisCasePulse{grid-template-columns:1fr;gap:9px}.jarvisWorkspace{grid-template-columns:1fr}.jarvisWorkspaceCard:last-child{grid-column:auto}.commandOverlay{padding-top:6vh}.commandFooter{display:grid;gap:3px}}
'''
css_path.write_text(css, encoding='utf-8')

package = json.loads(package_path.read_text(encoding='utf-8'))
package['version'] = '0.4.0'
package_path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

print('Fernández Conde OS V4 patch applied')
