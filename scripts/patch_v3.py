from pathlib import Path
import json

page_path = Path('app/page.tsx')
css_path = Path('app/globals.css')
package_path = Path('package.json')
ci_path = Path('.github/workflows/ci.yml')

text = page_path.read_text(encoding='utf-8')

# Sidebar branding and version.
old = '<div className="brand"><div className="logo">FC</div><div><b>FERNÁNDEZ CONDE</b><small>OS · V2.0</small></div></div>'
new = '<div className="brand brandV3"><div className="brandPlate"><img className="brandWordmark" src="./brand/fernandez-conde-horizontal.jpg" alt="Fernández Conde"/></div><small>OS · V3</small></div>'
assert old in text
text = text.replace(old, new, 1)

# Keep finances explicitly separate.
text = text.replace('<div className="financeLink">FINANZAS<br/><b>Sistema independiente</b></div>', '<div className="financeLink">FINANZAS<br/><b>Sin integrar · sistema independiente</b></div>', 1)

# Copy updates.
text = text.replace('description="V2 consulta la información estructurada de FC OS; todavía no modifica Finanzas ni ejecuta acciones jurídicas autónomas."', 'description="V3 consulta la información estructurada de FC OS; Finanzas permanece fuera de esta versión y Jarvis no ejecuta acciones jurídicas autónomas."', 1)
text = text.replace('<p>Cada etapa conserva programación, resultado, notas y siguiente actuación.</p>', '<p>Actualiza el estado en segundos. Abre los detalles solo cuando necesites documentar fechas, resultado, notas o la siguiente actuación.</p>', 1)
text = text.replace('No hay documentos registrados. V2 permite registrar metadatos y enlaces; el almacenamiento de archivos llegará después.', 'No hay documentos registrados. V3 mantiene el registro simple de metadatos y enlaces; el almacenamiento físico de archivos seguirá para una versión posterior.', 1)

# Simplified client capture.
old = '{modal === "client" && <Modal title="Nuevo cliente" close={() => setModal(null)}><form onSubmit={addClient}><Field name="name" label="Nombre completo" required/><div className="grid2"><Field name="nationality" label="Nacionalidad"/><Field name="phone" label="Teléfono"/></div><Field name="email" label="Correo" type="email"/><TextArea name="notes" label="Observaciones"/><Actions/></form></Modal>}'
new = '{modal === "client" && <Modal title="Nuevo cliente" close={() => setModal(null)}><form onSubmit={addClient}><div className="quickIntro"><span>CAPTURA RÁPIDA</span><b>Solo el nombre es indispensable.</b><p>Los datos de contacto y observaciones pueden completarse después.</p></div><Field name="name" label="Nombre completo" required/><details className="advancedDetails"><summary>Agregar más datos <span>Opcional</span></summary><div className="advancedDetailsBody"><div className="grid2"><Field name="nationality" label="Nacionalidad"/><Field name="phone" label="Teléfono"/></div><Field name="email" label="Correo" type="email"/><TextArea name="notes" label="Observaciones"/></div></details><Actions/></form></Modal>}'
assert old in text
text = text.replace(old, new, 1)

# Simplified matter capture.
old = '{modal === "matter" && <Modal title="Nuevo asunto" close={() => setModal(null)} wide><form onSubmit={addMatter}><Select name="client" label="Cliente" required options={clients.map((client) => [client.id, client.full_name])}/><MatterSubtype/><div className="grid3"><Select name="priority" label="Prioridad" options={priorities.map((item) => [item,item])}/><Field name="authority" label="Autoridad"/><Field name="office" label="Oficina"/></div><Field name="fileNumber" label="Expediente / NUT / folio"/><TextArea name="summary" label="Resumen estratégico"/><div className="grid2"><Field name="nextAction" label="Siguiente actuación"/><Field name="nextActionDue" label="Fecha de la siguiente actuación" type="datetime-local"/></div><Actions/></form></Modal>}'
new = '{modal === "matter" && <Modal title="Nuevo asunto" close={() => setModal(null)} wide><form onSubmit={addMatter}><div className="quickIntro"><span>CAPTURA RÁPIDA</span><b>Cliente + tipo de asunto y listo.</b><p>FC OS generará automáticamente el workflow. El resto puede documentarse cuando ya exista información real.</p></div><Select name="client" label="Cliente" required options={clients.map((client) => [client.id, client.full_name])}/><MatterSubtype/><details className="advancedDetails"><summary>Agregar datos del expediente <span>Opcional</span></summary><div className="advancedDetailsBody"><div className="grid3"><Select name="priority" label="Prioridad" defaultValue="NORMAL" options={priorities.map((item) => [item,item])}/><Field name="authority" label="Autoridad"/><Field name="office" label="Oficina"/></div><Field name="fileNumber" label="Expediente / NUT / folio"/><TextArea name="summary" label="Resumen estratégico"/><div className="grid2"><Field name="nextAction" label="Siguiente actuación"/><Field name="nextActionDue" label="Fecha de la siguiente actuación" type="datetime-local"/></div></div></details><Actions/></form></Modal>}'
assert old in text
text = text.replace(old, new, 1)

# Simplified incident capture.
old = '{modal === "incident" && selectedMatter && <Modal title="Registrar incidencia" close={() => setModal(null)}><form onSubmit={addIncident}><Field name="title" label="Incidencia" required/><div className="grid2"><Select name="severity" label="Severidad" options={[["MEDIUM","Media"],["HIGH","Alta"],["CRITICAL","Crítica"],["LOW","Baja"]]}/><Field name="due" label="Fecha crítica" type="datetime-local"/></div><Select name="stage" label="Etapa relacionada" options={[["","General"],...stages.map((stage) => [stage.id,stage.workflow_template_stages?.name ?? "Etapa"])]}/><TextArea name="description" label="Descripción y estrategia"/><Actions/></form></Modal>}'
new = '{modal === "incident" && selectedMatter && <Modal title="Registrar incidencia" close={() => setModal(null)}><form onSubmit={addIncident}><div className="quickIntro compact"><span>REGISTRO RÁPIDO</span><b>Describe el problema y su severidad.</b></div><Field name="title" label="Incidencia" required/><Select name="severity" label="Severidad" defaultValue="MEDIUM" options={[["MEDIUM","Media"],["HIGH","Alta"],["CRITICAL","Crítica"],["LOW","Baja"]]}/><details className="advancedDetails"><summary>Agregar contexto <span>Opcional</span></summary><div className="advancedDetailsBody"><Field name="due" label="Fecha crítica" type="datetime-local"/><Select name="stage" label="Etapa relacionada" options={[["","General"],...stages.map((stage) => [stage.id,stage.workflow_template_stages?.name ?? "Etapa"])]}/><TextArea name="description" label="Descripción y estrategia"/></div></details><Actions/></form></Modal>}'
assert old in text
text = text.replace(old, new, 1)

# Simplified task capture.
old = '{modal === "task" && <Modal title="Nueva tarea o término" close={() => setModal(null)}><form onSubmit={addTask}><Field name="title" label="Título" required/><div className="grid2"><Select name="taskType" label="Tipo" options={taskTypes.map(([value,label]) => [value,label])}/><Select name="priority" label="Prioridad" options={priorities.map((item) => [item,item])}/></div><Field name="due" label="Fecha y hora" type="datetime-local"/><Select name="matter" label="Expediente" defaultValue={selectedMatter?.id ?? ""} options={[["","General"],...matters.map((matter) => [matter.id,matter.title])]}/><TextArea name="description" label="Instrucciones"/><Actions/></form></Modal>}'
new = '{modal === "task" && <Modal title="Nueva tarea o término" close={() => setModal(null)}><form onSubmit={addTask}><div className="quickIntro compact"><span>CAPTURA RÁPIDA</span><b>Qué hay que hacer y cuándo.</b></div><Field name="title" label="Título" required/><Field name="due" label="Fecha y hora" type="datetime-local"/><details className="advancedDetails"><summary>Más opciones <span>Opcional</span></summary><div className="advancedDetailsBody"><div className="grid2"><Select name="taskType" label="Tipo" options={taskTypes.map(([value,label]) => [value,label])}/><Select name="priority" label="Prioridad" defaultValue="NORMAL" options={priorities.map((item) => [item,item])}/></div><Select name="matter" label="Expediente" defaultValue={selectedMatter?.id ?? ""} options={[["","General"],...matters.map((matter) => [matter.id,matter.title])]}/><TextArea name="description" label="Instrucciones"/></div></details><Actions/></form></Modal>}'
assert old in text
text = text.replace(old, new, 1)

# Simplified document capture.
old = '{modal === "document" && selectedMatter && <Modal title="Registrar documento" close={() => setModal(null)}><form onSubmit={addDocument}><Field name="name" label="Nombre del documento" required/><div className="grid2"><Select name="category" label="Categoría" options={[["COMAR","COMAR"],["INM","INM"],["AMPARO","Amparo"],["EVIDENCE","Prueba"],["CLIENT","Cliente"],["OTHER","Otro"]]}/><Field name="documentDate" label="Fecha del documento" type="date"/></div><Select name="stage" label="Etapa relacionada" options={[["","Sin etapa"],...stages.map((stage) => [stage.id,stage.workflow_template_stages?.name ?? "Etapa"])]}/><Field name="url" label="Enlace al archivo (opcional)" type="url"/><TextArea name="notes" label="Notas"/><Actions/></form></Modal>}'
new = '{modal === "document" && selectedMatter && <Modal title="Registrar documento" close={() => setModal(null)}><form onSubmit={addDocument}><div className="quickIntro compact"><span>EXPEDIENTE DIGITAL</span><b>Identifica el documento.</b></div><Field name="name" label="Nombre del documento" required/><Select name="category" label="Categoría" options={[["COMAR","COMAR"],["INM","INM"],["AMPARO","Amparo"],["EVIDENCE","Prueba"],["CLIENT","Cliente"],["OTHER","Otro"]]}/><details className="advancedDetails"><summary>Agregar metadatos <span>Opcional</span></summary><div className="advancedDetailsBody"><Field name="documentDate" label="Fecha del documento" type="date"/><Select name="stage" label="Etapa relacionada" options={[["","Sin etapa"],...stages.map((stage) => [stage.id,stage.workflow_template_stages?.name ?? "Etapa"])]}/><Field name="url" label="Enlace al archivo" type="url"/><TextArea name="notes" label="Notas"/></div></details><Actions/></form></Modal>}'
assert old in text
text = text.replace(old, new, 1)

# Simplified linked amparo capture.
old = '{modal === "amparo" && selectedMatter && <Modal title="Crear amparo vinculado" close={() => setModal(null)} wide><form onSubmit={addAmparo}><div className="grid2"><Select name="type" label="Tipo" options={[["AMPARO_INDIRECTO","Amparo indirecto"],["AMPARO_DIRECTO","Amparo directo"]]}/><Select name="priority" label="Prioridad" defaultValue="HIGH" options={priorities.map((item) => [item,item])}/></div><div className="grid2"><Field name="authority" label="Órgano jurisdiccional / autoridad"/><Field name="fileNumber" label="Número de amparo"/></div><TextArea name="summary" label="Actos reclamados / estrategia inicial"/><div className="grid2"><Field name="nextAction" label="Siguiente actuación"/><Field name="nextActionDue" label="Fecha" type="datetime-local"/></div><Actions/></form></Modal>}'
new = '{modal === "amparo" && selectedMatter && <Modal title="Crear amparo vinculado" close={() => setModal(null)} wide><form onSubmit={addAmparo}><div className="quickIntro"><span>SUBPROCEDIMIENTO VINCULADO</span><b>Elige el tipo de amparo.</b><p>Se creará con su workflow completo y ligado al expediente principal.</p></div><Select name="type" label="Tipo" options={[["AMPARO_INDIRECTO","Amparo indirecto"],["AMPARO_DIRECTO","Amparo directo"]]}/><details className="advancedDetails"><summary>Agregar datos iniciales <span>Opcional</span></summary><div className="advancedDetailsBody"><Select name="priority" label="Prioridad" defaultValue="HIGH" options={priorities.map((item) => [item,item])}/><div className="grid2"><Field name="authority" label="Órgano jurisdiccional / autoridad"/><Field name="fileNumber" label="Número de amparo"/></div><TextArea name="summary" label="Actos reclamados / estrategia inicial"/><div className="grid2"><Field name="nextAction" label="Siguiente actuación"/><Field name="nextActionDue" label="Fecha" type="datetime-local"/></div></div></details><Actions/></form></Modal>}'
assert old in text
text = text.replace(old, new, 1)

# Replace stage editor with progressive disclosure.
start = text.index('function StageEditor(')
end = text.index('\nfunction Auth()', start)
new_stage = '''function StageEditor({ stage, index, onSave }: { stage: Stage; index: number; onSave: (stage: Stage, data: Record<string,string>) => void }) {
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
}'''
text = text[:start] + new_stage + text[end:]

# Auth branding.
old = '<div className="authBrand"><div className="logo">FC</div><div><b>FERNÁNDEZ CONDE</b><div className="muted">OS · V2</div></div></div>'
new = '<div className="authBrand brandAuthV3"><img className="authLogoMark" src="./brand/fernandez-conde-mark.jpg" alt="Isotipo Fernández Conde"/><div className="authBrandText"><img className="authLogoWordmark" src="./brand/fernandez-conde-horizontal.jpg" alt="Fernández Conde"/><div className="muted">OS · V3</div></div></div>'
assert old in text
text = text.replace(old, new, 1)

page_path.write_text(text, encoding='utf-8')

# V3 visual identity overrides. Preserve the V2 base and override deliberately.
css = css_path.read_text(encoding='utf-8')
marker = '/* FERNANDEZ CONDE OS V3 */'
if marker not in css:
    css += r'''

/* FERNANDEZ CONDE OS V3 */
:root{--navy:#051731;--navy2:#0a2345;--gold:#a88749;--goldSoft:#f6f0e3;--ink:#101b2b;--muted:#66707d;--line:#e2dfd8;--nav:#051731;--paper:#fff;--bg:#f6f5f2;--soft:#faf9f6}
html,body{background:var(--bg)}
.side{background:linear-gradient(180deg,#051731 0%,#071d3a 100%);padding:21px 16px}
.brandV3{display:grid;gap:7px;margin-bottom:25px}
.brandPlate{background:#fff;border-radius:9px;padding:7px 8px;box-shadow:0 4px 14px rgba(0,0,0,.13);overflow:hidden}
.brandWordmark{display:block;width:100%;height:auto;aspect-ratio:2.595/1;object-fit:contain}
.brandV3 small{color:#cfb47d!important;text-align:right;padding-right:3px;font-weight:800;letter-spacing:.16em}
.nav button{color:#b9c1cc}.nav button:hover{background:rgba(255,255,255,.07)}.nav button.on{background:rgba(255,255,255,.1);border-left-color:var(--gold);color:#fff}
.financeLink{border-top-color:rgba(255,255,255,.12);color:#8995a5}.financeLink b,.userbox button{color:#d4ba84}
.primary{background:var(--navy);border-color:var(--navy);box-shadow:0 1px 1px rgba(5,23,49,.08)}.primary:hover{background:var(--navy2)}
.secondary{border-color:#dcd8cf}.secondary:hover{background:#faf8f3;border-color:#cfbf9f}
.globalSearch{border-color:#ddd9d0}.globalSearch:focus-within{border-color:#b99a5f;box-shadow:0 0 0 3px rgba(168,135,73,.1)}
.ey{color:var(--gold)}
.pageHead h1,.caseHero h1,.sectionTitle h2,.trackingHead h2,.authCard h2{color:var(--navy)}
.card,.panel,.caseHero,.trackingHead,.stageCard,.modal{border-color:var(--line);box-shadow:0 1px 2px rgba(5,23,49,.025)}
.card.emphasis{border-color:#d8c39b;background:#fffcf5}.metricIcon{color:var(--gold)}
.filters button.active{background:var(--navy);border-color:var(--navy)}
.tag{background:var(--goldSoft);color:#725a2d}.avatar{background:var(--goldSoft);color:#735b2f}
.progress span{background:linear-gradient(90deg,#92713a,var(--gold))}
.caseTabs{background:#ece9e2}.caseTabs button.active{color:var(--navy);box-shadow:0 1px 3px rgba(5,23,49,.08)}
.timelineDot{border-color:var(--gold)}
.nextAction{background:#fbf7ee;border-color:#e8dcc5;color:var(--gold)}
.stageCard.in_progress{border-left-color:var(--gold)}
.auth{background:radial-gradient(circle at 50% 15%,#102c52 0,#051731 46%,#031124 100%)}
.authCard{width:min(520px,100%);padding:30px;border:1px solid rgba(168,135,73,.22);box-shadow:0 25px 75px rgba(0,0,0,.28)}
.brandAuthV3{align-items:center;gap:16px;padding-bottom:17px;border-bottom:1px solid #ece8df;margin-bottom:22px}
.authLogoMark{width:74px;height:74px;object-fit:cover;border-radius:10px;flex:none}
.authBrandText{min-width:0;flex:1}.authLogoWordmark{display:block;width:min(280px,100%);height:auto}.authBrandText .muted{margin-top:4px;color:#9b8150;font-weight:800;letter-spacing:.13em;font-size:10px}
.quickIntro{background:linear-gradient(135deg,#faf7ef,#fff);border:1px solid #e6dbc5;border-left:3px solid var(--gold);border-radius:10px;padding:13px 14px;margin:7px 0 15px}.quickIntro.compact{padding:10px 12px}.quickIntro span{display:block;color:var(--gold);font-size:8px;font-weight:900;letter-spacing:.16em;margin-bottom:4px}.quickIntro b{display:block;color:var(--navy);font:17px Georgia,serif}.quickIntro p{font-size:10px;color:var(--muted);margin:4px 0 0;line-height:1.5}
.advancedDetails,.stageDetails{border:1px solid #e3dfd6;border-radius:9px;background:#fbfaf7;margin-top:12px;overflow:hidden}.advancedDetails>summary,.stageDetails>summary{list-style:none;cursor:pointer;padding:11px 13px;color:#4e5660;font-size:10px;font-weight:800;display:flex;justify-content:space-between;align-items:center;gap:10px}.advancedDetails>summary::-webkit-details-marker,.stageDetails>summary::-webkit-details-marker{display:none}.advancedDetails>summary:after,.stageDetails>summary:after{content:'＋';color:var(--gold);font-size:15px;margin-left:auto}.advancedDetails[open]>summary:after,.stageDetails[open]>summary:after{content:'−'}.advancedDetails>summary span{font-size:8px;color:#9a8255;background:#f2eadb;padding:3px 6px;border-radius:99px;margin-left:auto}.advancedDetailsBody,.stageDetailsBody{border-top:1px solid #e7e2d9;padding:13px;background:#fff}
.quickStage{padding:12px 13px}.quickStage .stageTop{align-items:center}.stageIdentity{min-width:0}.quickStageActions{display:flex;align-items:center;gap:7px;flex:none}.quickSave{border:1px solid var(--navy);background:var(--navy);color:#fff;border-radius:7px;padding:7px 10px;font-size:9px;font-weight:800}.quickSave:hover{background:var(--navy2)}
.stageSnapshot{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}.stageSnapshot span{font-size:8px;color:#725d38;background:#f7f1e5;border-radius:99px;padding:3px 6px}
.stageDetails{margin-top:10px;background:#faf9f6}.stageDetails>summary{padding:8px 10px;font-size:9px;font-weight:700;color:#737981}.stageDetails>summary span{font-weight:500;font-size:8px;color:#9a9da1;margin-left:5px}.stageDetailsBody .stageFields{margin-top:0}
.modal .field{margin-top:9px}.modal .advancedDetails .field:first-child{margin-top:0}
.matterTypeHelper{display:grid;grid-template-columns:1fr 1fr;gap:10px}.matterTypeHelper>.field:only-child{grid-column:1/-1}
@media(max-width:850px){.side{background:var(--navy)}.brandV3{grid-template-columns:150px auto;align-items:center;margin-bottom:10px}.brandPlate{padding:4px 5px}.brandV3 small{text-align:left}.quickStage .stageTop{display:grid}.quickStageActions{width:100%;justify-content:space-between}.quickStageActions .stateSelect{flex:1}.stageDetails>summary span{display:none}.matterTypeHelper{grid-template-columns:1fr}.authLogoMark{width:60px;height:60px}.authCard{padding:22px}.brandAuthV3{gap:10px}}
'''
css_path.write_text(css, encoding='utf-8')

package = json.loads(package_path.read_text(encoding='utf-8'))
package['version'] = '0.3.0'
package_path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

ci = ci_path.read_text(encoding='utf-8')
ci = ci.replace('branches: [v2-development]', 'branches: [v2-development, v3-development]')
ci_path.write_text(ci, encoding='utf-8')

print('Fernández Conde OS V3 patch applied')
