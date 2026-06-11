import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  CreateTask,
  GetAllTasks,
  UpdateTask,
  DeleteTask,
  QuitApp,
} from "./wailsjs/go/main/App";
import type { Task } from "./wailsjs/go/main/App";
import { TaskItem } from "./components/TaskItem";
import { CheckIcon, ChevronRightIcon, CloseIcon, GearIcon } from "./components/Icons";
import { useOutsideClick } from "./hooks/useOutsideClick";
import { TaskModel, MAX_NAME_LENGTH } from "./models/TaskModel";
import { getTomorrowAtEightAM, parseTodayTimeInput } from "./lib/holdTime";
import {
  createTranslator,
  detectInitialLocale,
  isLocale,
  LOCALE_OPTIONS,
  LOCALE_STORAGE_KEY,
  type Locale,
  type TranslationKey,
} from "./i18";

declare const __APP_VERSION__: string;

type ThemeName = "light" | "dark" | "ocean" | "sunset";
type HoldPreset = "tomorrow" | "indefinite" | "today-time";

const THEME_OPTIONS: Array<{ value: ThemeName; labelKey: TranslationKey }> = [
  { value: "light", labelKey: "themeLight" },
  { value: "dark", labelKey: "themeDark" },
  { value: "ocean", labelKey: "themeOcean" },
  { value: "sunset", labelKey: "themeSunset" },
];

const VALID_THEMES = new Set<string>(THEME_OPTIONS.map((o) => o.value));

const PRIORITY_SECTIONS: Array<{ key: "high" | "medium" | "low"; labelKey: TranslationKey }> = [
  { key: "high", labelKey: "priorityHigh" },
  { key: "medium", labelKey: "priorityMedium" },
  { key: "low", labelKey: "priorityLow" },
];

const NEW_TASK_PRIORITIES: Array<{ value: "high" | "medium" | "low"; labelKey: TranslationKey }> = [
  { value: "high", labelKey: "priorityHigh" },
  { value: "medium", labelKey: "priorityMedium" },
  { value: "low", labelKey: "priorityLow" },
];

const TASK_STATUS_PENDING = "pending";
const TASK_STATUS_COMPLETED = "completed";
const TASK_STATUS_ON_HOLD = "on_hold";

const noop = () => {};

const appVersion =
  typeof __APP_VERSION__ === "string" && __APP_VERSION__.trim().length > 0
    ? __APP_VERSION__.trim()
    : "dev";

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showInput, setShowInput] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<"high" | "medium" | "low">("low");
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [onHoldOpen, setOnHoldOpen] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [theme, setTheme] = useState<ThemeName>("light");
  const [locale, setLocale] = useState<Locale>(() => detectInitialLocale());
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [newlyCreatedTaskId, setNewlyCreatedTaskId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const createAnimationTimeoutRef = useRef<number | null>(null);
  const errorTimeoutRef = useRef<number | null>(null);
  const t = useMemo(() => createTranslator(locale), [locale]);

  const closeThemeMenu = useCallback(() => setThemeMenuOpen(false), []);
  useOutsideClick(settingsMenuRef, themeMenuOpen, closeThemeMenu);

  const showError = useCallback((message: string) => {
    setErrorMessage(message);
    if (errorTimeoutRef.current) {
      window.clearTimeout(errorTimeoutRef.current);
    }
    errorTimeoutRef.current = window.setTimeout(() => {
      setErrorMessage(null);
      errorTimeoutRef.current = null;
    }, 5000);
  }, []);

  const dismissError = useCallback(() => {
    if (errorTimeoutRef.current) {
      window.clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = null;
    }
    setErrorMessage(null);
  }, []);

  const loadTasks = useCallback(async () => {
    try {
      const all = await GetAllTasks();
      setTasks(all || []);
    } catch {
      showError(t("errorGeneric"));
    }
  }, [showError, t]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadTasks();
    }, 60_000);
    return () => window.clearInterval(intervalId);
  }, [loadTasks]);

  useEffect(() => {
    const handleFocusOrVisible = () => {
      if (document.visibilityState === "visible") {
        void loadTasks();
      }
    };
    window.addEventListener("focus", handleFocusOrVisible);
    document.addEventListener("visibilitychange", handleFocusOrVisible);
    return () => {
      window.removeEventListener("focus", handleFocusOrVisible);
      document.removeEventListener("visibilitychange", handleFocusOrVisible);
    };
  }, [loadTasks]);

  useEffect(() => {
    if (showInput) inputRef.current?.focus();
  }, [showInput]);

  useEffect(() => {
    const saved = window.localStorage.getItem("desk-tasks-theme");
    if (saved && VALID_THEMES.has(saved)) {
      setTheme(saved as ThemeName);
    }
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(saved)) {
      setLocale(saved);
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem("desk-tasks-theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = locale;
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }, [locale]);

  useEffect(() => {
    return () => {
      if (createAnimationTimeoutRef.current) {
        window.clearTimeout(createAnimationTimeoutRef.current);
      }
      if (errorTimeoutRef.current) {
        window.clearTimeout(errorTimeoutRef.current);
      }
    };
  }, []);

  const handleCreate = useCallback(async () => {
    if (isCreatingTask) return;
    const name = inputValue.trim();
    if (!name) return;
    setIsCreatingTask(true);
    try {
      const newTask = await CreateTask(name, newTaskPriority);
      setTasks((prev) => [...prev, newTask]);
      setNewlyCreatedTaskId(newTask.id);
      if (createAnimationTimeoutRef.current) {
        window.clearTimeout(createAnimationTimeoutRef.current);
      }
      createAnimationTimeoutRef.current = window.setTimeout(() => {
        setNewlyCreatedTaskId(null);
        createAnimationTimeoutRef.current = null;
      }, 450);
      setInputValue("");
      setNewTaskPriority("low");
      setShowInput(false);
    } catch {
      showError(t("errorGeneric"));
    } finally {
      setIsCreatingTask(false);
    }
  }, [isCreatingTask, inputValue, newTaskPriority, showError, t]);

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleCreate();
    else if (e.key === "Escape") {
      setShowInput(false);
      setInputValue("");
      setNewTaskPriority("low");
    }
  };

  const handleUpdate = useCallback(async (task: Task) => {
    try {
      const updated = await UpdateTask(task);
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch {
      showError(t("errorGeneric"));
    }
  }, [showError, t]);

  const handleDelete = useCallback(async (id: number) => {
    try {
      await DeleteTask(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch {
      showError(t("errorGeneric"));
    }
  }, [showError, t]);

  const handleToggleComplete = useCallback(async (task: Task) => {
    const newStatus = task.status === TASK_STATUS_PENDING
      ? TASK_STATUS_COMPLETED
      : TASK_STATUS_PENDING;
    try {
      const updated = await UpdateTask({ ...task, status: newStatus, holdUntil: "" });
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch {
      showError(t("errorGeneric"));
    }
  }, [showError, t]);

  const handleResumeFromHold = useCallback(async (task: Task) => {
    try {
      const updated = await UpdateTask({ ...task, status: TASK_STATUS_PENDING, holdUntil: "" });
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch {
      showError(t("errorGeneric"));
    }
  }, [showError, t]);

  const handleSendToHold = useCallback(async (task: Task, preset: HoldPreset, timeText?: string) => {
    let holdDate: Date | null = null;

    if (preset === "tomorrow") {
      holdDate = getTomorrowAtEightAM();
    } else if (preset === "today-time") {
      holdDate = parseTodayTimeInput(timeText ?? "");
      if (!holdDate) {
        return;
      }
    }

    const holdUntil = holdDate ? holdDate.toISOString() : "";
    try {
      const updated = await UpdateTask({
        ...task,
        status: TASK_STATUS_ON_HOLD,
        holdUntil,
      });
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch {
      showError(t("errorGeneric"));
    }
  }, [showError, t]);

  const handleEditStart = useCallback((id: number) => setEditingId(id), []);
  const handleEditEnd = useCallback(() => setEditingId(null), []);

  const pendingTasks = useMemo(
    () => TaskModel.sortByPriorityAndOrder(tasks.filter((t) => t.status === TASK_STATUS_PENDING)),
    [tasks],
  );
  const onHoldTasks = useMemo(
    () => TaskModel.sortOnHold(tasks.filter((t) => t.status === TASK_STATUS_ON_HOLD)),
    [tasks],
  );
  const completedTasks = useMemo(
    () => TaskModel.sortByPriorityAndOrder(tasks.filter((t) => t.status === TASK_STATUS_COMPLETED)),
    [tasks],
  );

  const pendingSections = useMemo(
    () =>
      PRIORITY_SECTIONS.map((s) => ({
        ...s,
        items: pendingTasks.filter((t) => t.priority === s.key),
      })),
    [pendingTasks],
  );

  const handleAddTaskClick = useCallback(() => {
    if (isCreatingTask) return;
    if (showInput) {
      void handleCreate();
      return;
    }
    setShowInput(true);
    setEditingId(null);
  }, [isCreatingTask, showInput, handleCreate]);

  const addTaskLabel = isCreatingTask
    ? t("taskAlreadyCreating")
    : t("addTask");

  return (
    <div className="app">
      <div className="header">
        <button
          className="add-btn tooltip-trigger tooltip-right"
          onMouseDown={(e) => {
            if (showInput) e.preventDefault();
          }}
          onClick={handleAddTaskClick}
          data-tooltip={addTaskLabel}
          aria-label={addTaskLabel}
        >
          +
        </button>

        <div className="settings-menu-wrap" ref={settingsMenuRef}>
          <button
            className="settings-btn tooltip-trigger tooltip-left"
            onClick={() => setThemeMenuOpen((prev) => !prev)}
            data-tooltip={t("settings")}
            aria-label={t("settings")}
            aria-expanded={themeMenuOpen}
          >
            <GearIcon />
          </button>

          {themeMenuOpen && (
            <div className="theme-menu" role="menu" aria-label={t("settingsMenuAria")}>
              <div className="settings-menu-label">{t("themeSectionLabel")}</div>
              {THEME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  className={`theme-menu-item ${theme === option.value ? "active" : ""}`}
                  onClick={() => { setTheme(option.value); setThemeMenuOpen(false); }}
                >
                  <span>{t(option.labelKey)}</span>
                  {theme === option.value && (
                    <CheckIcon size={13} stroke="currentColor" strokeWidth={2.5} />
                  )}
                </button>
              ))}
              <div className="settings-menu-divider" />
              <div className="settings-menu-label">{t("languageSectionLabel")}</div>
              {LOCALE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  className={`theme-menu-item ${locale === option.value ? "active" : ""}`}
                  onClick={() => {
                    setLocale(option.value);
                    setThemeMenuOpen(false);
                  }}
                >
                  <span>{t(option.labelKey)}</span>
                  {locale === option.value && (
                    <CheckIcon size={13} stroke="currentColor" strokeWidth={2.5} />
                  )}
                </button>
              ))}
              <div className="settings-menu-divider" />
              <button
                className="theme-menu-item settings-exit-item"
                onClick={() => {
                  setThemeMenuOpen(false);
                  QuitApp();
                }}
              >
                <span>{t("exitApp")}</span>
              </button>
              <div className="theme-menu-version">v{appVersion}</div>
            </div>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="error-banner" role="alert">
          <span>{errorMessage}</span>
          <button
            className="error-banner-dismiss"
            onClick={dismissError}
            aria-label={t("dismissError")}
          >
            <CloseIcon />
          </button>
        </div>
      )}

      <div className="task-list">
        {showInput && (
          <div className="inline-input-row">
            <div className="new-task-priority-points" role="radiogroup" aria-label={t("newTaskPriorityAria")}>
              {NEW_TASK_PRIORITIES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={newTaskPriority === option.value}
                  aria-label={`${t("newTaskPriorityAria")}: ${t(option.labelKey)}`}
                  className={`priority-btn new-task-priority-btn p-${option.value} ${newTaskPriority === option.value ? "active" : ""}`}
                  disabled={isCreatingTask}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setNewTaskPriority(option.value)}
                  data-tooltip={t("priorityOptionTooltip", { priority: t(option.labelKey) })}
                >
                  <span className="dot" />
                </button>
              ))}
            </div>
            <input
              ref={inputRef}
              type="text"
              placeholder={t("taskNamePlaceholder")}
              value={inputValue}
              maxLength={MAX_NAME_LENGTH}
              disabled={isCreatingTask}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleInputKeyDown}
              onBlur={() => {
                if (!isCreatingTask && !inputValue.trim()) {
                  setShowInput(false);
                  setNewTaskPriority("low");
                }
              }}
            />
            <span className="hint">{t("enterHint")}</span>
          </div>
        )}

        {tasks.length === 0 && !showInput && (
          <div className="empty-state">{t("emptyState")}</div>
        )}

        {pendingSections.map((section) => {
          if (section.items.length === 0) return null;
          return (
            <div key={section.key} className="priority-section">
              <div className={`section-label priority-${section.key}`}>
                {t(section.labelKey)}
              </div>
              {section.items.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  t={t}
                  isEditing={editingId === task.id}
                  isNewlyCreated={newlyCreatedTaskId === task.id}
                  onToggleComplete={() => handleToggleComplete(task)}
                  onUpdate={handleUpdate}
                  onDelete={() => handleDelete(task.id)}
                  onEditStart={() => handleEditStart(task.id)}
                  onEditEnd={handleEditEnd}
                  onSendToHold={(preset, timeText) => handleSendToHold(task, preset, timeText)}
                />
              ))}
            </div>
          );
        })}

        {onHoldTasks.length > 0 && (
          <div className="on-hold-section">
            <button
              className="completed-header on-hold-header"
              onClick={() => setOnHoldOpen((v) => !v)}
            >
              <ChevronRightIcon className={`chevron ${onHoldOpen ? "open" : ""}`} />
              {t("onHoldSectionTitle", { count: onHoldTasks.length })}
            </button>

            {onHoldOpen && (
              <div className="on-hold-items">
                {onHoldTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    t={t}
                    isEditing={editingId === task.id}
                    isNewlyCreated={newlyCreatedTaskId === task.id}
                    holdNote={TaskModel.formatHoldNote(task, locale, t)}
                    onToggleComplete={() => handleResumeFromHold(task)}
                    onUpdate={handleUpdate}
                    onDelete={() => handleDelete(task.id)}
                    onEditStart={() => handleEditStart(task.id)}
                    onEditEnd={handleEditEnd}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {completedTasks.length > 0 && (
          <div className="completed-section">
            <button
              className="completed-header"
              onClick={() => setCompletedOpen((v) => !v)}
            >
              <ChevronRightIcon className={`chevron ${completedOpen ? "open" : ""}`} />
              {t("completedSectionTitle", { count: completedTasks.length })}
            </button>

            {completedOpen && (
              <div className="completed-items">
                {completedTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    t={t}
                    isEditing={false}
                    isNewlyCreated={newlyCreatedTaskId === task.id}
                    onToggleComplete={() => handleToggleComplete(task)}
                    onUpdate={handleUpdate}
                    onDelete={() => handleDelete(task.id)}
                    onEditStart={noop}
                    onEditEnd={noop}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
