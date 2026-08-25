export const inmOptions = [
  { value: "Visitante por Razones Humanitarias", template: "INM_TVRH" },
  { value: "Regularización migratoria", template: "INM_REGULARIZACION" },
  { value: "Cambio de condición de estancia", template: "INM_CAMBIO_CONDICION" },
  { value: "Canje / expedición de documento", template: "INM_CANJE" },
  { value: "Renovación", template: "INM_RENOVACION" },
  { value: "Reposición", template: "INM_REPOSICION" },
  { value: "Permiso para trabajar", template: "INM_PERMISO_TRABAJO" },
  { value: "Notificación de cambios", template: "INM_NOTIFICACION_CAMBIOS" },
  { value: "Constancia de inscripción de empleador", template: "INM_CONSTANCIA_EMPLEADOR" },
  { value: "Otro trámite migratorio", template: "INM_TRAMITE" }
] as const;

export function inmTemplateFor(subtype: string) {
  return inmOptions.find((item) => item.value === subtype)?.template ?? "INM_TRAMITE";
}
