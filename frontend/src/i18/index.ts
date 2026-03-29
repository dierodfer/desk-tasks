export type Locale = "es" | "en";

type TranslationVars = Record<string, string | number>;

const ES_MESSAGES = {
  addTask: "Anadir tarea",
  taskAlreadyCreating: "Ya hay una tarea en creacion",
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
  taskNamePlaceholder: "Nombre de la tarea...",
  enterHint: "Enter ↵",
  emptyState: "No hay tareas aun. Haz clic en + para crear una.",
  priorityHigh: "Alta",
  priorityMedium: "Media",
  priorityLow: "Baja",
  priorityHighLower: "alta",
  priorityMediumLower: "media",
  priorityLowLower: "baja",
  completedSectionTitle: "Completadas ({count})",
  markPending: "Marcar pendiente",
  markCompleted: "Marcar completada",
  priorityTitle: "Prioridad: {priority}",
  currentPriorityTooltip: "Prioridad actual: {priority}. Cambiar prioridad",
  currentPriorityAria: "Prioridad actual {priority}. Click para cambiar",
  prioritySelectorAria: "Selector de prioridad",
  priorityOptionTooltip: "Prioridad {priority}",
  clickToEditName: "Click para editar nombre",
  contactPlaceholder: "Nombre de contacto o correo",
  clickToEditContact: "Click para editar contacto",
  addContact: "Anadir contacto",
  contactWord: "contacto",
  deleteTask: "Eliminar tarea",
};

export type TranslationKey = keyof typeof ES_MESSAGES;
type MessageCatalog = Record<TranslationKey, string>;

const EN_MESSAGES: MessageCatalog = {
  addTask: "Add task",
  taskAlreadyCreating: "A task is already being created",
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
  taskNamePlaceholder: "Task name...",
  enterHint: "Enter ↵",
  emptyState: "No tasks yet. Click + to add one.",
  priorityHigh: "High",
  priorityMedium: "Medium",
  priorityLow: "Low",
  priorityHighLower: "high",
  priorityMediumLower: "medium",
  priorityLowLower: "low",
  completedSectionTitle: "Completed ({count})",
  markPending: "Mark pending",
  markCompleted: "Mark completed",
  priorityTitle: "Priority: {priority}",
  currentPriorityTooltip: "Current priority: {priority}. Change priority",
  currentPriorityAria: "Current priority {priority}. Click to change",
  prioritySelectorAria: "Priority selector",
  priorityOptionTooltip: "Priority {priority}",
  clickToEditName: "Click to edit name",
  contactPlaceholder: "Contact name or email",
  clickToEditContact: "Click to edit contact",
  addContact: "Add contact",
  contactWord: "contact",
  deleteTask: "Delete task",
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
