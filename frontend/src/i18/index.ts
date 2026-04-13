export type Locale = "es" | "en";

type TranslationVars = Record<string, string | number>;

const ES_MESSAGES = {
  addTask: "Anadir tarea",
  taskAlreadyCreating: "Ya hay una tarea en creacion",
  cancelNewTask: "Cerrar nueva tarea",
  settings: "Configuracion",
  settingsMenuAria: "Configuracion de aplicacion",
  themeSectionLabel: "Tema",
  languageSectionLabel: "Idioma",
  languageSpanish: "Espanol",
  languageEnglish: "Ingles",
  themeLight: "Claro",
  themeDark: "Oscuro",
  themeOcean: "Oceano",
  themeSunset: "Atardecer",
  newTaskPriorityAria: "Prioridad de la nueva tarea",
  taskNamePlaceholder: "Nombre de la tarea...",
  enterHint: "Enter ↵",
  emptyState: "No hay tareas aun. Haz clic en + para crear una.",
  priorityHigh: "Alta",
  priorityMedium: "Media",
  priorityLow: "Baja",
  priorityHighLower: "alta",
  priorityMediumLower: "media",
  priorityLowLower: "baja",
  onHoldSectionTitle: "En reposo ({count})",
  sendToHold: "Enviar a reposo",
  holdMenuAria: "Opciones de reposo",
  holdOptionTomorrow: "Hasta manana (08:00)",
  holdOptionIndefinite: "Indefinida",
  holdOptionTodayTime: "A una hora concreta...",
  holdTimePickerAria: "Selector de hora de reactivacion",
  holdTimeInputLabel: "Reactivar a las",
  holdTimeCancel: "Cancelar",
  holdTimeConfirm: "Aceptar",
  holdTodayPrompt: "Introduce una hora de reactivacion (HH:MM)",
  holdInvalidTime: "Hora invalida. Usa formato HH:MM.",
  holdPastTime: "La hora seleccionada ya ha pasado.",
  holdUntilLabel: "Hasta {date}",
  holdIndefiniteBadge: "Indefinida",
  restoreFromHold: "Quitar de reposo",
  moveToPending: "Mover a pendiente",
  completedSectionTitle: "Completadas ({count})",
  markPending: "Marcar pendiente",
  markCompleted: "Marcar completada",
  priorityTitle: "Prioridad: {priority}",
  currentPriorityTooltip: "Prioridad: {priority}",
  currentPriorityAria: "Prioridad {priority}",
  prioritySelectorAria: "Selector de prioridad",
  priorityOptionTooltip: "{priority}",
  clickToEditName: "Click para editar nombre",
  contactPlaceholder: "Nombre de contacto o correo",
  clickToEditContact: "Click para editar contacto",
  addContact: "Anadir contacto",
  contactWord: "contacto",
  deleteTask: "Eliminar tarea",
  deleteConfirmAction: "Confirmar",
  exitApp: "Salir",
  taskActions: "Acciones",
  postponeTooltip: "Aplazar",
};

export type TranslationKey = keyof typeof ES_MESSAGES;
type MessageCatalog = Record<TranslationKey, string>;

const EN_MESSAGES: MessageCatalog = {
  addTask: "Add task",
  taskAlreadyCreating: "A task is already being created",
  cancelNewTask: "Close new task",
  settings: "Settings",
  settingsMenuAria: "Application settings",
  themeSectionLabel: "Theme",
  languageSectionLabel: "Language",
  languageSpanish: "Spanish",
  languageEnglish: "English",
  themeLight: "Light",
  themeDark: "Dark",
  themeOcean: "Ocean",
  themeSunset: "Sunset",
  newTaskPriorityAria: "New task priority",
  taskNamePlaceholder: "Task name...",
  enterHint: "Enter ↵",
  emptyState: "No tasks yet. Click + to add one.",
  priorityHigh: "High",
  priorityMedium: "Medium",
  priorityLow: "Low",
  priorityHighLower: "high",
  priorityMediumLower: "medium",
  priorityLowLower: "low",
  onHoldSectionTitle: "On hold ({count})",
  sendToHold: "Send to hold",
  holdMenuAria: "Hold options",
  holdOptionTomorrow: "Until tomorrow (08:00)",
  holdOptionIndefinite: "Indefinite",
  holdOptionTodayTime: "At a specific time...",
  holdTimePickerAria: "Reactivation time selector",
  holdTimeInputLabel: "Reactivate at",
  holdTimeCancel: "Cancel",
  holdTimeConfirm: "Apply",
  holdTodayPrompt: "Enter a reactivation time (HH:MM)",
  holdInvalidTime: "Invalid time. Use HH:MM format.",
  holdPastTime: "The selected time has already passed.",
  holdUntilLabel: "Until {date}",
  holdIndefiniteBadge: "Indefinite",
  restoreFromHold: "Remove from hold",
  moveToPending: "Move to pending",
  completedSectionTitle: "Completed ({count})",
  markPending: "Mark pending",
  markCompleted: "Mark completed",
  priorityTitle: "Priority: {priority}",
  currentPriorityTooltip: "Priority: {priority}.",
  currentPriorityAria: "Priority {priority}.",
  prioritySelectorAria: "Priority selector",
  priorityOptionTooltip: "{priority}",
  clickToEditName: "Click to edit name",
  contactPlaceholder: "Contact name or email",
  clickToEditContact: "Click to edit contact",
  addContact: "Add contact",
  contactWord: "contact",
  deleteTask: "Delete task",
  deleteConfirmAction: "Confirm",
  exitApp: "Exit",
  taskActions: "Actions",
  postponeTooltip: "Postpone",
};

const MESSAGES: Record<Locale, MessageCatalog> = {
  es: ES_MESSAGES,
  en: EN_MESSAGES,
};

export type Translator = (key: TranslationKey, vars?: TranslationVars) => string;

export const LOCALE_STORAGE_KEY = "desk-tasks-locale";

export const LOCALE_OPTIONS: Array<{ value: Locale; labelKey: TranslationKey }> = [
  { value: "es", labelKey: "languageSpanish" },
  { value: "en", labelKey: "languageEnglish" },
];

export function isLocale(value: string | null): value is Locale {
  return value === "es" || value === "en";
}

export function detectInitialLocale(): Locale {
  if (typeof navigator === "undefined") return "en";
  return navigator.language.toLowerCase().startsWith("es") ? "es" : "en";
}

function formatMessage(message: string, vars?: TranslationVars): string {
  if (!vars) return message;
  return message.replace(/\{(\w+)\}/g, (fullMatch, key: string) => {
    const value = vars[key];
    return value === undefined ? fullMatch : String(value);
  });
}

export function createTranslator(locale: Locale): Translator {
  const catalog = MESSAGES[locale] ?? MESSAGES.en;
  return (key, vars) => formatMessage(catalog[key], vars);
}
