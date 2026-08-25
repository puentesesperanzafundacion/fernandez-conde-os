# Fernández Conde OS — V2.0

## Objetivo
Convertir la ficha de expediente en el centro operativo del sistema sin modificar Fernández Conde Finanzas.

## Cambios principales
- Respaldo V1.1: `backup/pre-v2-20260825`.
- Ficha integral de expediente con prioridad, resumen, autoridad, oficina, expediente/NUT/folio y siguiente actuación.
- Seguimiento por etapa con estado, fecha programada, fecha real, resultado, notas y próxima actuación.
- Cronología automática mediante `case_events`.
- Centro de tareas y términos con tipos TASK, DEADLINE, HEARING, FOLLOW_UP y DOCUMENT.
- Registro de metadatos/documentos y enlaces externos por expediente.
- Buscador global de clientes y asuntos.
- Dashboard de atención inmediata, incidencias y asuntos sin movimiento.
- Jarvis V2 en modo lectura.
- Asuntos vinculados y amparos como expedientes independientes relacionados.

## Workflows
### COMAR
Se mantiene el flujo de reconocimiento y se agrega control recurrente de comparecencias/asistencia.

### INM
Plantillas específicas:
- TVRH.
- Regularización migratoria.
- Cambio de condición de estancia.
- Canje / expedición.
- Renovación.
- Reposición.
- Permiso para trabajar.
- Notificación de cambios.
- Constancia de inscripción de empleador.
- Workflow genérico como respaldo.

### Amparo indirecto
El incidente de suspensión se desglosa en:
- apertura/solicitud;
- suspensión provisional;
- informe previo;
- audiencia incidental;
- suspensión definitiva;
- cumplimiento e incidencias de suspensión.

## Aislamiento financiero
FC OS no escribe en Fernández Conde Finanzas. No se migraron ni modificaron tablas, autenticación o repositorio de la app financiera.
