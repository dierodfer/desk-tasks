import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  CreateTask,
  GetAllTasks,
  UpdateTask,
  DeleteTask,
} from "./wailsjs/go/main/App";
import type { Task } from "./wailsjs/go/main/App";
import { TaskItem } from "./components/TaskItem";
import { CheckIcon, ChevronRightIcon, GearIcon } from "./components/Icons";
import { useOutsideClick } from "./hooks/useOutsideClick";

declare const __APP_VERSION__: string;

type ThemeName = "light" | "dark" | "ocean" | "sunset";

const THEME_OPTIONS: Array<{ value: ThemeName; label: string }> = [
  { value: "light", label: "Claro" },
  { value: "dark", label: "Oscuro" },
  { value: "ocean", label: "Ocean" },
  { value: "sunset", label: "Sunset" },
];

const VALID_THEMES = new Set<string>(THEME_OPTIONS.map((o) => o.value));

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

const PRIORITY_SECTIONS: Array<{ key: "high" | "medium" | "low"; label: string }> = [
  { key: "high", label: "Alta" },
  { key: "medium", label: "Media" },
  { key: "low", label: "Baja" },
];

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 2;
    const pb = PRIORITY_ORDER[b.priority] ?? 2;
    return pa !== pb ? pa - pb : a.order - b.order;
  });
}

const noop = () => {};

const appVersion =
  typeof __APP_VERSION__ === "string" && __APP_VERSION__.trim().length > 0
    ? __APP_VERSION__.trim()
    : "dev";

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showInput, setShowInput] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [theme, setTheme] = useState<ThemeName>("light");
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const settingsMenuRef = useRef<HTMLDivElement>(null);

  const closeThemeMenu = useCallback(() => setThemeMenuOpen(false), []);
  useOutsideClick(settingsMenuRef, themeMenuOpen, closeThemeMenu);

  const loadTasks = useCallback(async () => {
    const all = await GetAllTasks();
    setTasks(all || []);
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);

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
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem("desk-tasks-theme", theme);
  }, [theme]);

  const handleCreate = async () => {
    if (isCreatingTask) return;
    const name = inputValue.trim();
    if (!name) return;
    setIsCreatingTask(true);
    try {
      const newTask = await CreateTask(name);
      setTasks((prev) => [...prev, newTask]);
      setInputValue("");
      setShowInput(false);
    } finally {
      setIsCreatingTask(false);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleCreate();
    else if (e.key === "Escape") { setShowInput(false); setInputValue(""); }
  };

  const handleUpdate = useCallback(async (task: Task) => {
    const updated = await UpdateTask(task);
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }, []);

  const handleDelete = useCallback(async (id: number) => {
    await DeleteTask(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleToggleComplete = useCallback(async (task: Task) => {
    const newStatus = task.status === "pending" ? "completed" : "pending";
    const updated = await UpdateTask({ ...task, status: newStatus });
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }, []);

  const handleEditStart = useCallback((id: number) => setEditingId(id), []);
  const handleEditEnd = useCallback(() => setEditingId(null), []);

  const pendingTasks = useMemo(
    () => sortTasks(tasks.filter((t) => t.status === "pending")),
    [tasks],
  );
  const completedTasks = useMemo(
    () => sortTasks(tasks.filter((t) => t.status === "completed")),
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

  return (
    <div className="app">
      <div className="header">
        <button
          className="add-btn tooltip-trigger"
          onClick={() => {
            if (showInput || isCreatingTask) return;
            setShowInput(true);
            setEditingId(null);
          }}
          data-tooltip={showInput ? "Ya hay una tarea en creación" : "Añadir tarea"}
          aria-label={showInput ? "Ya hay una tarea en creación" : "Añadir tarea"}
          disabled={showInput || isCreatingTask}
        >
          +
        </button>

        <div className="settings-menu-wrap" ref={settingsMenuRef}>
          <button
            className="settings-btn tooltip-trigger"
            onClick={() => setThemeMenuOpen((prev) => !prev)}
            data-tooltip="Configuración"
            aria-label="Configuración de tema"
            aria-expanded={themeMenuOpen}
          >
            <GearIcon />
          </button>

          {themeMenuOpen && (
            <div className="theme-menu" role="menu" aria-label="Seleccionar tema">
              {THEME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  className={`theme-menu-item ${theme === option.value ? "active" : ""}`}
                  onClick={() => { setTheme(option.value); setThemeMenuOpen(false); }}
                >
                  <span>{option.label}</span>
                  {theme === option.value && (
                    <CheckIcon size={13} stroke="currentColor" strokeWidth={2.5} />
                  )}
                </button>
              ))}
              <div className="theme-menu-version">v{appVersion}</div>
            </div>
          )}
        </div>
      </div>

      <div className="task-list">
        {showInput && (
          <div className="inline-input-row">
            <input
              ref={inputRef}
              type="text"
              placeholder="Task name..."
              value={inputValue}
              disabled={isCreatingTask}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleInputKeyDown}
              onBlur={() => {
                if (!isCreatingTask && !inputValue.trim()) setShowInput(false);
              }}
            />
            <span className="hint">Enter ↵</span>
          </div>
        )}

        {pendingTasks.length === 0 && !showInput && (
          <div className="empty-state">No tasks yet. Click + to add one.</div>
        )}

        {pendingSections.map((section) => {
          if (section.items.length === 0) return null;
          return (
            <div key={section.key} className="priority-section">
              <div className={`section-label priority-${section.key}`}>
                {section.label}
              </div>
              {section.items.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  isEditing={editingId === task.id}
                  onToggleComplete={() => handleToggleComplete(task)}
                  onUpdate={handleUpdate}
                  onDelete={() => handleDelete(task.id)}
                  onEditStart={() => handleEditStart(task.id)}
                  onEditEnd={handleEditEnd}
                />
              ))}
            </div>
          );
        })}

        {completedTasks.length > 0 && (
          <div className="completed-section">
            <button
              className="completed-header"
              onClick={() => setCompletedOpen((v) => !v)}
            >
              <ChevronRightIcon className={`chevron ${completedOpen ? "open" : ""}`} />
              Completed ({completedTasks.length})
            </button>

            {completedOpen &&
              completedTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  isEditing={false}
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
    </div>
  );
}
