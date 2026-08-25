"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type Client = { id:string; full_name:string; nationality:string|null; phone:string|null; email:string|null };
type Matter = { id:string; client_id:string; parent_matter_id:string|null; matter_type:string; subtype:string|null; title:string; status:string; authority:string|null; office:string|null; external_file_number:string|null; opened_at:string };
type Stage = { id:string; state:string; notes:string|null; due_at:string|null; workflow_template_stages:{ name:string; description:string|null; position:number } | null };
type Incident = { id:string; title:string; description:string|null; severity:string; status:string; occurred_at:string };
type Task = { id:string; title:string; description:string|null; priority:string; status:string; due_at:string|null; matter_id:string|null; client_id:string|null };
type Event = { id:string; title:string; description:string|null; event_type:string; event_at:string };
type Tab = "inicio"|"clientes"|"asuntos"|"tareas"|"jarvis";

const inmModalities = [
  "Cambio de condición de estancia", "Regularización migratoria", "Canje", "Renovación", "Reposición",
  "Visitante por Razones Humanitarias", "Permiso para trabajar", "Notificación de cambios",
  "Constancia de inscripción de empleador", "Certificado de situación migratoria", "Otro trámite migratorio"
];

function uuid(){ return crypto.randomUUID(); }
function fmtDate(v:string|null){ if(!v) return "—"; return new Intl.DateTimeFormat("es-MX",{dateStyle:"medium"}).format(new Date(v)); }

export default function Home(){
  const [user,setUser]=useState<User|null>(null);
  const [loading,setLoading]=useState(true);
  const [orgId,setOrgId]=useState<string|null>(null);
  const [tab,setTab]=useState<Tab>("inicio");
  const [clients,setClients]=useState<Client[]>([]);
  const [matters,setMatters]=useState<Matter[]>([]);
  const [tasks,setTasks]=useState<Task[]>([]);
  const [selectedMatter,setSelectedMatter]=useState<Matter|null>(null);
  const [stages,setStages]=useState<Stage[]>([]);
  const [incidents,setIncidents]=useState<Incident[]>([]);
  const [events,setEvents]=useState<Event[]>([]);
  const [modal,setModal]=useState<null|"client"|"matter"|"incident"|"task"|"amparo">(null);
  const [notice,setNotice]=useState("");

  useEffect(()=>{
    let mounted=true;
    (async()=>{
      const {data:{user}}=await supabase.auth.getUser();
      if(mounted){ setUser(user); setLoading(false); }
    })();
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setUser(s?.user??null));
    return()=>{mounted=false;subscription.unsubscribe()};
  },[]);

  useEffect(()=>{ if(user) bootstrap(); else {setOrgId(null);setClients([]);setMatters([]);setTasks([]);} },[user]);

  async function bootstrap(){
    if(!user) return;
    setLoading(true); setNotice("");
    const {data:member,error}=await supabase.from("organization_members").select("organization_id").eq("user_id",user.id).maybeSingle();
    if(error){ setNotice(error.message); setLoading(false); return; }
    let oid=member?.organization_id as string|undefined;
    if(!oid){
      oid=uuid();
      const a=await supabase.from("organizations").insert({id:oid,name:"Fernández Conde",created_by:user.id});
      if(a.error){setNotice(a.error.message);setLoading(false);return;}
      const b=await supabase.from("organization_members").insert({organization_id:oid,user_id:user.id,role:"owner"});
      if(b.error){setNotice(b.error.message);setLoading(false);return;}
    }
    setOrgId(oid); await loadBase(oid); setLoading(false);
  }

  async function loadBase(oid=orgId){
    if(!oid) return;
    const [c,m,t]=await Promise.all([
      supabase.from("clients").select("id,full_name,nationality,phone,email").eq("organization_id",oid).order("full_name"),
      supabase.from("matters").select("id,client_id,parent_matter_id,matter_type,subtype,title,status,authority,office,external_file_number,opened_at").eq("organization_id",oid).order("created_at",{ascending:false}),
      supabase.from("tasks").select("id,title,description,priority,status,due_at,matter_id,client_id").eq("organization_id",oid).order("due_at",{ascending:true,nullsFirst:false})
    ]);
    if(c.error||m.error||t.error) setNotice(c.error?.message||m.error?.message||t.error?.message||"");
    setClients((c.data??[]) as Client[]); setMatters((m.data??[]) as Matter[]); setTasks((t.data??[]) as Task[]);
  }

  async function openMatter(m:Matter){ setSelectedMatter(m); setTab("asuntos"); await loadMatter(m.id); }
  async function loadMatter(id:string){
    const wf=await supabase.from("matter_workflows").select("id").eq("matter_id",id).eq("status","ACTIVE").maybeSingle();
    let stageData:Stage[]=[];
    if(wf.data?.id){
      const s=await supabase.from("matter_stage_instances").select("id,state,notes,due_at,workflow_template_stages(name,description,position)").eq("matter_workflow_id",wf.data.id);
      stageData=((s.data??[]) as unknown as Stage[]).sort((a,b)=>(a.workflow_template_stages?.position??0)-(b.workflow_template_stages?.position??0));
    }
    const [i,e]=await Promise.all([
      supabase.from("matter_incidents").select("id,title,description,severity,status,occurred_at").eq("matter_id",id).order("occurred_at",{ascending:false}),
      supabase.from("case_events").select("id,title,description,event_type,event_at").eq("matter_id",id).order("event_at",{ascending:false})
    ]);
    setStages(stageData); setIncidents((i.data??[]) as Incident[]); setEvents((e.data??[]) as Event[]);
  }

  async function addClient(e:FormEvent<HTMLFormElement>){
    e.preventDefault(); if(!orgId||!user)return; const f=new FormData(e.currentTarget);
    const r=await supabase.from("clients").insert({organization_id:orgId,full_name:f.get("name"),nationality:f.get("nationality")||null,phone:f.get("phone")||null,email:f.get("email")||null,created_by:user.id});
    if(r.error){setNotice(r.error.message);return;} setModal(null); await loadBase();
  }

  async function createMatterRecord(clientId:string,type:string,subtype:string,title:string,parent:string|null=null){
    if(!orgId||!user) return null;
    const templateCode= type==="COMAR"?"COMAR_RECONOCIMIENTO":type==="INM"?"INM_TRAMITE":type;
    const t=await supabase.from("workflow_templates").select("id").eq("code",templateCode).is("organization_id",null).single();
    if(t.error){setNotice(t.error.message);return null;}
    const mid=uuid();
    const m=await supabase.from("matters").insert({id:mid,organization_id:orgId,client_id:clientId,parent_matter_id:parent,matter_type:type,subtype,title,status:"OPEN",created_by:user.id});
    if(m.error){setNotice(m.error.message);return null;}
    const w=await supabase.from("matter_workflows").insert({matter_id:mid,workflow_template_id:t.data.id}).select("id").single();
    if(w.error){setNotice(w.error.message);return null;}
    const defs=await supabase.from("workflow_template_stages").select("id").eq("workflow_template_id",t.data.id).order("position");
    if(defs.error){setNotice(defs.error.message);return null;}
    if(defs.data.length){
      const si=await supabase.from("matter_stage_instances").insert(defs.data.map(x=>({matter_workflow_id:w.data.id,template_stage_id:x.id,state:"PENDING"})));
      if(si.error){setNotice(si.error.message);return null;}
    }
    await supabase.from("case_events").insert({matter_id:mid,event_type:"MATTER_CREATED",title:"Asunto creado",description:title,created_by:user.id});
    return mid;
  }

  async function addMatter(e:FormEvent<HTMLFormElement>){
    e.preventDefault(); const f=new FormData(e.currentTarget); const clientId=String(f.get("client")); const type=String(f.get("type")); const subtype=type==="INM"?String(f.get("subtype")):"Reconocimiento de la condición de refugiado"; const title=`${type} · ${clients.find(c=>c.id===clientId)?.full_name??"Cliente"}`;
    const id=await createMatterRecord(clientId,type,subtype,title); if(id){setModal(null); await loadBase(); const m=(await supabase.from("matters").select("id,client_id,parent_matter_id,matter_type,subtype,title,status,authority,office,external_file_number,opened_at").eq("id",id).single()).data as Matter; if(m)openMatter(m);}
  }

  async function addAmparo(e:FormEvent<HTMLFormElement>){
    e.preventDefault(); if(!selectedMatter)return; const f=new FormData(e.currentTarget); const type=String(f.get("type")); const title=`${type==="AMPARO_INDIRECTO"?"Amparo indirecto":"Amparo directo"} vinculado · ${clientName(selectedMatter.client_id)}`;
    const id=await createMatterRecord(selectedMatter.client_id,type,"Vinculado a "+selectedMatter.title,title,selectedMatter.id); if(id){setModal(null);await loadBase();}
  }

  async function updateStage(s:Stage,state:string){
    if(!user||!selectedMatter)return;
    const patch:{state:string;started_at?:string;completed_at?:string|null}={state};
    if(state==="IN_PROGRESS") patch.started_at=new Date().toISOString();
    if(state==="COMPLETED") patch.completed_at=new Date().toISOString(); else patch.completed_at=null;
    const r=await supabase.from("matter_stage_instances").update(patch).eq("id",s.id);
    if(r.error){setNotice(r.error.message);return;}
    await supabase.from("case_events").insert({matter_id:selectedMatter.id,stage_instance_id:s.id,event_type:"STAGE_CHANGED",title:`Etapa: ${s.workflow_template_stages?.name}`,description:`Estado → ${state}`,created_by:user.id});
    await loadMatter(selectedMatter.id);
  }

  async function addIncident(e:FormEvent<HTMLFormElement>){
    e.preventDefault(); if(!selectedMatter||!user)return; const f=new FormData(e.currentTarget); const title=String(f.get("title")); const severity=String(f.get("severity")); const description=String(f.get("description")||"");
    const r=await supabase.from("matter_incidents").insert({matter_id:selectedMatter.id,title,severity,description,status:"OPEN",created_by:user.id}); if(r.error){setNotice(r.error.message);return;}
    await supabase.from("case_events").insert({matter_id:selectedMatter.id,event_type:"INCIDENT_CREATED",title:`Incidencia: ${title}`,description,created_by:user.id}); setModal(null); await loadMatter(selectedMatter.id);
  }

  async function addTask(e:FormEvent<HTMLFormElement>){
    e.preventDefault(); if(!orgId||!user)return; const f=new FormData(e.currentTarget); const matterId=String(f.get("matter")||"")||selectedMatter?.id||null;
    const matter=matters.find(x=>x.id===matterId); const r=await supabase.from("tasks").insert({organization_id:orgId,matter_id:matterId,client_id:matter?.client_id??null,title:f.get("title"),description:f.get("description")||null,priority:f.get("priority"),due_at:f.get("due")?new Date(String(f.get("due"))).toISOString():null,created_by:user.id,assigned_to:user.id}); if(r.error){setNotice(r.error.message);return;} setModal(null); await loadBase();
  }

  async function toggleTask(t:Task){ const next=t.status==="DONE"?"PENDING":"DONE"; await supabase.from("tasks").update({status:next,completed_at:next==="DONE"?new Date().toISOString():null}).eq("id",t.id); await loadBase(); }

  function clientName(id:string){return clients.find(c=>c.id===id)?.full_name??"Cliente"}
  const openMatters=useMemo(()=>matters.filter(m=>m.status==="OPEN"),[matters]);
  const urgentTasks=useMemo(()=>tasks.filter(t=>t.status!=="DONE"&&["HIGH","URGENT"].includes(t.priority)),[tasks]);
  const linked=useMemo(()=>selectedMatter?matters.filter(m=>m.parent_matter_id===selectedMatter.id):[],[matters,selectedMatter]);

  if(loading) return <div className="spinner">Cargando Fernández Conde OS…</div>;
  if(!user) return <Auth/>;

  return <div className="shell">
    <aside className="side">
      <div className="brand"><div className="logo">FC</div><div><b>FERNÁNDEZ CONDE</b><small>OS · V1.1</small></div></div>
      <div className="nav">{[["inicio","Inicio"],["clientes","Clientes"],["asuntos","Asuntos"],["tareas","Tareas"],["jarvis","Jarvis"]].map(([k,l])=><button key={k} className={tab===k?"on":""} onClick={()=>{setTab(k as Tab);if(k!=="asuntos")setSelectedMatter(null)}}>{l}</button>)}</div>
      <div className="userbox">{user.email}<br/><button onClick={()=>supabase.auth.signOut()}>Cerrar sesión</button></div>
    </aside>
    <main className="content">
      {notice&&<div className="authMsg error" style={{marginBottom:12}}>{notice}</div>}
      {tab==="inicio"&&<>
        <div className="top"><div><div className="ey">PANEL DEL DESPACHO</div><h1>Fernández Conde OS</h1><p>Control procesal separado de Fernández Conde Finanzas.</p></div><button className="primary" onClick={()=>setModal("matter")}>+ Nuevo asunto</button></div>
        <div className="cards"><div className="card"><small>Clientes</small><strong>{clients.length}</strong></div><div className="card"><small>Asuntos abiertos</small><strong>{openMatters.length}</strong></div><div className="card"><small>Tareas críticas</small><strong>{urgentTasks.length}</strong></div><div className="card"><small>Amparos vinculados</small><strong>{matters.filter(m=>m.parent_matter_id).length}</strong></div></div>
        <section className="panel"><div className="sectionTitle"><div><div className="ey">PRIORIDAD</div><h2>Asuntos abiertos</h2></div></div>{openMatters.length?<div className="list">{openMatters.slice(0,8).map(m=><MatterRow key={m.id} m={m} client={clientName(m.client_id)} onOpen={()=>openMatter(m)}/>)}</div>:<div className="empty">Todavía no hay asuntos.</div>}</section>
        <section className="panel"><div className="sectionTitle"><h2>Tareas pendientes</h2><button className="secondary" onClick={()=>setModal("task")}>+ Tarea</button></div>{tasks.filter(t=>t.status!=="DONE").length?<div className="list">{tasks.filter(t=>t.status!=="DONE").slice(0,8).map(t=><TaskRow key={t.id} t={t} onToggle={()=>toggleTask(t)}/>)}</div>:<div className="empty">Sin tareas pendientes.</div>}</section>
      </>}

      {tab==="clientes"&&<><div className="top"><div><div className="ey">CLIENTES</div><h1>Registro maestro</h1></div><button className="primary" onClick={()=>setModal("client")}>+ Cliente</button></div><section className="panel">{clients.length?<div className="list">{clients.map(c=><div className="listItem" key={c.id}><div><h3>{c.full_name}</h3><div className="muted">{c.nationality||"Sin nacionalidad"} · {c.phone||c.email||"Sin contacto"}</div></div><span className="tag">{matters.filter(m=>m.client_id===c.id).length} asuntos</span></div>)}</div>:<div className="empty">Crea el primer cliente.</div>}</section></>}

      {tab==="asuntos"&&!selectedMatter&&<><div className="top"><div><div className="ey">ASUNTOS</div><h1>Expedientes y procedimientos</h1></div><button className="primary" onClick={()=>setModal("matter")}>+ Asunto</button></div><section className="panel">{matters.length?<div className="list">{matters.map(m=><MatterRow key={m.id} m={m} client={clientName(m.client_id)} onOpen={()=>openMatter(m)}/>)}</div>:<div className="empty">No hay asuntos registrados.</div>}</section></>}

      {tab==="asuntos"&&selectedMatter&&<MatterDetail matter={selectedMatter} client={clientName(selectedMatter.client_id)} stages={stages} incidents={incidents} events={events} linked={linked} onBack={()=>setSelectedMatter(null)} onStage={updateStage} onIncident={()=>setModal("incident")} onTask={()=>setModal("task")} onAmparo={()=>setModal("amparo")} onLinked={openMatter}/>} 

      {tab==="tareas"&&<><div className="top"><div><div className="ey">TAREAS</div><h1>Control de pendientes</h1></div><button className="primary" onClick={()=>setModal("task")}>+ Tarea</button></div><section className="panel">{tasks.length?<div className="list">{tasks.map(t=><TaskRow key={t.id} t={t} onToggle={()=>toggleTask(t)}/>)}</div>:<div className="empty">Sin tareas.</div>}</section></>}

      {tab==="jarvis"&&<Jarvis clients={clients} matters={matters} tasks={tasks}/>} 
    </main>
    {modal==="client"&&<Modal title="Nuevo cliente" close={()=>setModal(null)}><form onSubmit={addClient}><div className="grid2"><Field name="name" label="Nombre completo" required/><Field name="nationality" label="Nacionalidad"/><Field name="phone" label="Teléfono"/><Field name="email" label="Correo" type="email"/></div><Actions/></form></Modal>}
    {modal==="matter"&&<Modal title="Nuevo asunto" close={()=>setModal(null)}><form onSubmit={addMatter}><div className="field"><label>Cliente</label><select name="client" required><option value="">Selecciona…</option>{clients.map(c=><option key={c.id} value={c.id}>{c.full_name}</option>)}</select></div><div className="grid2" style={{marginTop:12}}><div className="field"><label>Procedimiento</label><select name="type"><option value="COMAR">COMAR</option><option value="INM">Migración / INM</option></select></div><div className="field"><label>Modalidad INM (si aplica)</label><select name="subtype">{inmModalities.map(x=><option key={x}>{x}</option>)}</select></div></div><Actions/></form></Modal>}
    {modal==="amparo"&&selectedMatter&&<Modal title="Crear amparo vinculado" close={()=>setModal(null)}><form onSubmit={addAmparo}><p>Se creará un expediente judicial independiente, ligado a <b>{selectedMatter.title}</b>.</p><div className="field" style={{marginTop:14}}><label>Tipo</label><select name="type"><option value="AMPARO_INDIRECTO">Amparo indirecto</option><option value="AMPARO_DIRECTO">Amparo directo</option></select></div><Actions/></form></Modal>}
    {modal==="incident"&&<Modal title="Registrar incidencia" close={()=>setModal(null)}><form onSubmit={addIncident}><Field name="title" label="Incidencia" required/><div className="field" style={{marginTop:12}}><label>Severidad</label><select name="severity"><option value="MEDIUM">Media</option><option value="HIGH">Alta</option><option value="CRITICAL">Crítica</option><option value="LOW">Baja</option></select></div><div className="field" style={{marginTop:12}}><label>Descripción</label><textarea name="description"/></div><Actions/></form></Modal>}
    {modal==="task"&&<Modal title="Nueva tarea" close={()=>setModal(null)}><form onSubmit={addTask}><Field name="title" label="Tarea" required/><div className="grid2" style={{marginTop:12}}><div className="field"><label>Prioridad</label><select name="priority"><option>NORMAL</option><option>HIGH</option><option>URGENT</option><option>LOW</option></select></div><Field name="due" label="Fecha límite" type="datetime-local"/></div><div className="field" style={{marginTop:12}}><label>Asunto</label><select name="matter" defaultValue={selectedMatter?.id??""}><option value="">General</option>{matters.map(m=><option key={m.id} value={m.id}>{m.title}</option>)}</select></div><div className="field" style={{marginTop:12}}><label>Descripción</label><textarea name="description"/></div><Actions/></form></Modal>}
  </div>
}

function Auth(){ const [mode,setMode]=useState<"in"|"up">("in"); const [msg,setMsg]=useState(""); async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget),email=String(f.get("email")),password=String(f.get("password"));setMsg("");if(mode==="in"){const r=await supabase.auth.signInWithPassword({email,password});if(r.error)setMsg(r.error.message)}else{const r=await supabase.auth.signUp({email,password});setMsg(r.error?r.error.message:"Cuenta creada. Revisa tu correo para confirmar y después inicia sesión.")}} return <div className="auth"><div className="authCard"><div className="authBrand"><div className="logo">FC</div><div><b>FERNÁNDEZ CONDE</b><div className="muted">OS · acceso del despacho</div></div></div><h2>{mode==="in"?"Iniciar sesión":"Crear acceso"}</h2><p>Base independiente de Fernández Conde Finanzas.</p>{msg&&<div className="authMsg">{msg}</div>}<form onSubmit={submit} style={{marginTop:18}}><Field name="email" label="Correo" type="email" required/><div style={{height:10}}/><Field name="password" label="Contraseña" type="password" required/><button className="primary" style={{width:"100%",marginTop:16}}>{mode==="in"?"Entrar":"Crear cuenta"}</button></form><button className="secondary" style={{width:"100%",marginTop:8}} onClick={()=>setMode(mode==="in"?"up":"in")}>{mode==="in"?"Crear una cuenta":"Ya tengo cuenta"}</button></div></div> }
function Field({name,label,type="text",required=false}:{name:string;label:string;type?:string;required?:boolean}){return <div className="field"><label>{label}</label><input name={name} type={type} required={required}/></div>}
function Actions(){return <div className="actions"><button className="primary" type="submit">Guardar</button></div>}
function Modal({title,close,children}:{title:string;close:()=>void;children:React.ReactNode}){return <div className="modalBack" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}><div className="modal"><div className="rowBetween"><h2>{title}</h2><button className="secondary" onClick={close}>Cerrar</button></div>{children}</div></div>}
function MatterRow({m,client,onOpen}:{m:Matter;client:string;onOpen:()=>void}){return <button className="listItem" onClick={onOpen} style={{width:"100%",textAlign:"left"}}><div><h3>{m.title}</h3><div className="muted">{client} · {m.subtype||m.matter_type}</div></div><div><span className="tag">{m.matter_type}</span>{m.parent_matter_id&&<span className="tag">Vinculado</span>}</div></button>}
function TaskRow({t,onToggle}:{t:Task;onToggle:()=>void}){return <div className="listItem"><div><h3 className={t.status==="DONE"?"taskDone":""}>{t.title}</h3><div className="muted">{t.priority} · {fmtDate(t.due_at)}</div></div><button className="secondary" onClick={onToggle}>{t.status==="DONE"?"Reabrir":"Completar"}</button></div>}
function MatterDetail({matter,client,stages,incidents,events,linked,onBack,onStage,onIncident,onTask,onAmparo,onLinked}:{matter:Matter;client:string;stages:Stage[];incidents:Incident[];events:Event[];linked:Matter[];onBack:()=>void;onStage:(s:Stage,state:string)=>void;onIncident:()=>void;onTask:()=>void;onAmparo:()=>void;onLinked:(m:Matter)=>void}){return <><div className="breadcrumb"><button className="secondary" onClick={onBack}>← Asuntos</button></div><div className="top"><div><div className="ey">{matter.matter_type}</div><h1>{matter.title}</h1><p>{client} · {matter.subtype}</p></div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button className="secondary" onClick={onTask}>+ Tarea</button><button className="secondary" onClick={onIncident}>+ Incidencia</button>{["COMAR","INM"].includes(matter.matter_type)&&<button className="primary" onClick={onAmparo}>+ Amparo vinculado</button>}</div></div><section className="panel"><div className="sectionTitle"><div><div className="ey">WORKFLOW</div><h2>Seguimiento procesal</h2></div></div>{stages.length?<div className="timeline">{stages.map((s,i)=><div className="stage" key={s.id}><div className="num">{i+1}</div><div><h3>{s.workflow_template_stages?.name}</h3><p>{s.workflow_template_stages?.description}</p></div><select className={s.state==="COMPLETED"?"done":s.state==="BLOCKED"?"blocked":""} value={s.state} onChange={e=>onStage(s,e.target.value)}><option value="PENDING">○ Pendiente</option><option value="IN_PROGRESS">◐ En curso</option><option value="COMPLETED">✓ Completado</option><option value="BLOCKED">! Incidencia</option><option value="NOT_APPLICABLE">— No aplica</option></select></div>)}</div>:<div className="empty">Sin workflow.</div>}</section><div className="grid2"><section className="panel"><div className="sectionTitle"><h2>Incidencias</h2></div>{incidents.length?incidents.map(i=><div className="event" key={i.id}><span className="tag">{i.severity}</span><h3>{i.title}</h3><p>{i.description}</p><time>{fmtDate(i.occurred_at)}</time></div>):<div className="empty">Sin incidencias.</div>}</section><section className="panel"><div className="sectionTitle"><h2>Cronología</h2></div>{events.length?events.map(e=><div className="event" key={e.id}><h3>{e.title}</h3><p>{e.description}</p><time>{fmtDate(e.event_at)}</time></div>):<div className="empty">Sin actuaciones.</div>}</section></div>{linked.length>0&&<section className="panel"><h2>Procedimientos vinculados</h2><div className="list">{linked.map(m=><MatterRow key={m.id} m={m} client={client} onOpen={()=>onLinked(m)}/>)}</div></section>}</>}
function Jarvis({clients,matters,tasks}:{clients:Client[];matters:Matter[];tasks:Task[]}){const [q,setQ]=useState("");const answer=useMemo(()=>{const s=q.toLowerCase();if(!q)return "Preguntas disponibles en V1.1: “¿qué tengo pendiente?”, “asuntos COMAR”, “asuntos INM”, “amparos”, “clientes”.";if(s.includes("pendiente"))return `${tasks.filter(t=>t.status!=="DONE").length} tareas pendientes; ${matters.filter(m=>m.status==="OPEN").length} asuntos abiertos.`;if(s.includes("comar"))return `${matters.filter(m=>m.matter_type==="COMAR").length} asuntos COMAR registrados.`;if(s.includes("inm")||s.includes("migr"))return `${matters.filter(m=>m.matter_type==="INM").length} asuntos migratorios registrados.`;if(s.includes("amparo"))return `${matters.filter(m=>m.matter_type.startsWith("AMPARO")).length} amparos registrados, ${matters.filter(m=>m.parent_matter_id).length} vinculados a otro procedimiento.`;if(s.includes("cliente"))return `${clients.length} clientes registrados.`;return "V1.1 todavía limita Jarvis a consultas estructuradas. El siguiente paso será interpretación libre y cruces más complejos."},[q,clients,matters,tasks]);return <><div className="top"><div><div className="ey">JARVIS · CONSULTA</div><h1>Asistente del despacho</h1><p>Solo lectura en V1.1.</p></div></div><section className="panel jarvis"><pre>{answer}</pre><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Pregunta: ¿qué tengo pendiente?"/></section></>}
