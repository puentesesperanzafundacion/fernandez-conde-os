from pathlib import Path
import json

page = Path('app/page.tsx')
text = page.read_text(encoding='utf-8')

replacements = [
    (
        'function fmtDate(value: string | null, withTime = false) {\n  if (!value) return "—";\n  const date = new Date(value);',
        'function fmtDate(value: string | null, withTime = false) {\n  if (!value) return "—";\n  const date = /^\\d{4}-\\d{2}-\\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);'
    ),
    (
        'async function askJarvis(event?: FormEvent<HTMLFormElement>) {\n    event?.preventDefault();\n    const q = jarvisQuery.trim().toLowerCase();',
        'async function askJarvis(event?: FormEvent<HTMLFormElement>, override?: string) {\n    event?.preventDefault();\n    const q = (override ?? jarvisQuery).trim().toLowerCase();'
    ),
    (
        '<div className="quickPrompts">{["¿Qué tengo hoy?","Incidencias críticas","Asuntos COMAR","Amparos abiertos"].map((prompt) => <button key={prompt} onClick={() => { setJarvisQuery(prompt); setTimeout(() => void askJarvis(), 0); }}>{prompt}</button>)}</div>',
        '<div className="quickPrompts">{["¿Qué tengo hoy?","Incidencias críticas","Asuntos COMAR","Amparos abiertos"].map((prompt) => <button key={prompt} onClick={() => { setJarvisQuery(prompt); void askJarvis(undefined, prompt); }}>{prompt}</button>)}</div>'
    ),
    (
        '<form onSubmit={addMatter}><div className="grid2"><Select name="client" label="Cliente" required options={clients.map((client) => [client.id, client.full_name])}/><Select name="type" label="Materia" required options={[["COMAR","COMAR"],["INM","Migración / INM"]]} /></div><MatterSubtype/>',
        '<form onSubmit={addMatter}><Select name="client" label="Cliente" required options={clients.map((client) => [client.id, client.full_name])}/><MatterSubtype/>'
    ),
    (
        'function Select({ name, label, options, required = false, defaultValue }: { name: string; label: string; options: readonly (readonly [string,string])[] | [string,string][]; required?: boolean; defaultValue?: string })',
        'function Select({ name, label, options, required = false, defaultValue }: { name: string; label: string; options: ReadonlyArray<ReadonlyArray<string>>; required?: boolean; defaultValue?: string })'
    ),
    (
        'function SelectInline({ name, options, defaultValue }: { name: string; options: readonly (readonly [string,string])[] | [string,string][]; defaultValue?: string })',
        'function SelectInline({ name, options, defaultValue }: { name: string; options: ReadonlyArray<ReadonlyArray<string>>; defaultValue?: string })'
    ),
    (
        '    await supabase.from("matters").update(matterPatch).eq("id", selectedMatter.id);\n    await supabase.from("case_events").insert({',
        '    await supabase.from("matters").update(matterPatch).eq("id", selectedMatter.id);\n    setSelectedMatter((current) => current ? { ...current, updated_at: String(matterPatch.updated_at), next_action: data.nextAction || current.next_action, next_action_due_at: data.nextAction ? (matterPatch.next_action_due_at ?? null) : current.next_action_due_at } : current);\n    await supabase.from("case_events").insert({'
    ),
]

for old, new in replacements:
    if old not in text:
        raise SystemExit(f'Expected fragment not found:\n{old[:180]}')
    text = text.replace(old, new, 1)

page.write_text(text, encoding='utf-8')

package_path = Path('package.json')
package = json.loads(package_path.read_text(encoding='utf-8'))
package['version'] = '0.2.0'
package_path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('V2 patch applied')
