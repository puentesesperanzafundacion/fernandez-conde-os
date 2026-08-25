# Fernández Conde OS — V1

Proyecto paralelo e independiente de **Fernández Conde Finanzas**.

## Estado
Esta entrega contiene:
- prototipo del motor de seguimiento;
- catálogo inicial COMAR / INM / Amparo indirecto / Amparo directo;
- modelo de incidencias;
- arquitectura para subprocedimientos vinculados;
- esquema para un proyecto Supabase separado.

## Regla de aislamiento
**Fernández Conde Finanzas no se modifica.** FC OS utiliza repositorio y proyecto Supabase propios. La integración financiera futura será controlada y, inicialmente, de solo lectura.

## Arquitectura procesal
`Cliente → Asunto → Workflow → Etapas → Incidencias → Actuaciones → Tareas`

Un amparo puede ser un asunto autónomo o un subasunto relacionado mediante `parent_matter_id`, por ejemplo:

`COMAR / INM → Amparo indirecto → Suspensión / recursos / cumplimiento`

## V1
Dominios iniciales:
1. COMAR — reconocimiento de la condición de refugiado.
2. INM — trámites migratorios y sus modalidades.
3. Amparo indirecto.
4. Amparo directo.

Las etapas no son una lista rígida: pueden ser opcionales, repetibles, paralelas y registrar incidencias sin destruir la cronología principal.
