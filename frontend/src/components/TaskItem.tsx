import { useState, useRef, useEffect, useCallback } from "react";
import type { Task } from "../wailsjs/go/main/App";
import { useOutsideClick } from "../hooks/useOutsideClick";
import { CheckIcon, UserIcon, CloseIcon, ChevronDownIcon } from "./Icons";
import type { TranslationKey, Translator } from "../i18";

interface TaskItemProps {
  task: Task;
  t: Translator;
  isEditing: boolean;
  onToggleComplete: () => void;
  onUpdate: (task: Task) => void;
  onDelete: () => void;
  onEditStart: () => void;
  onEditEnd: () => void;
}

type EditField = "name" | "contact" | null;

const PRIORITIES = ["high", "medium", "low"] as const;

function getPriorityLabelKey(priority: string): TranslationKey {
  switch (priority) {
    case "high":
      return "priorityHighLower";
    case "medium":
      return "priorityMediumLower";
    default:
      return "priorityLowLower";
  }
}

export function TaskItem({
  task,
  t,
  isEditing,
  onToggleComplete,
  onUpdate,
  onDelete,
  onEditStart,
  onEditEnd,
}: TaskItemProps) {
  const [editField, setEditField] = useState<EditField>(null);
  const [editValue, setEditValue] = useState("");
  const [isPriorityMenuOpen, setIsPriorityMenuOpen] = useState(false);
  const editRef = useRef<HTMLInputElement>(null);
  const priorityMenuRef = useRef<HTMLDivElement>(null);
  const isCompleted = task.status === "completed";
  const currentPriority = t(getPriorityLabelKey(task.priority));

  useEffect(() => {
    if (editField) {
      editRef.current?.focus();
      editRef.current?.select();
    }
  }, [editField]);

  useEffect(() => {
    if (!isEditing) setEditField(null);
  }, [isEditing]);

  const closePriorityMenu = useCallback(() => {
    setIsPriorityMenuOpen(false);
    onEditEnd();
  }, [onEditEnd]);

  useOutsideClick(priorityMenuRef, isPriorityMenuOpen, closePriorityMenu);

  const startEdit = useCallback(
    (field: EditField) => {
      if (isCompleted) return;
      onEditStart();
      setEditField(field);
      setEditValue(field === "name" ? task.name : task.contact);
    },
    [isCompleted, onEditStart, task.name, task.contact],
  );

  const commitEdit = useCallback(() => {
    if (!editField) return;
    const trimmed = editValue.trim();
    if (editField === "name" && trimmed && trimmed !== task.name) {
      onUpdate({ ...task, name: trimmed });
    } else if (editField === "contact" && trimmed !== task.contact) {
      onUpdate({ ...task, contact: trimmed });
    }
    setEditField(null);
    onEditEnd();
  }, [editField, editValue, task, onUpdate, onEditEnd]);

  const cancelEdit = useCallback(() => {
    setEditField(null);
    onEditEnd();
  }, [onEditEnd]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") commitEdit();
    else if (e.key === "Escape") cancelEdit();
  };

  const handlePriorityChange = (priority: string) => {
    onUpdate({ ...task, priority });
    setIsPriorityMenuOpen(false);
    onEditEnd();
  };

  const togglePriorityMenu = () => {
    if (isCompleted) return;
    setIsPriorityMenuOpen((prev) => {
      const next = !prev;
      if (next) onEditStart();
      else onEditEnd();
      return next;
    });
  };

  return (
    <div className={`task-item ${isCompleted ? "completed" : ""}`}>
      <button
        className={`task-check ${isCompleted ? "checked" : ""}`}
        onClick={onToggleComplete}
        title={isCompleted ? t("markPending") : t("markCompleted")}
      >
        {isCompleted && <CheckIcon />}
      </button>

      {isCompleted ? (
        <div className={`priority-dot ${task.priority}`} title={t("priorityTitle", { priority: currentPriority })} />
      ) : (
        <div className="priority-control" ref={priorityMenuRef}>
          <button
            className={`priority-current p-${task.priority} tooltip-trigger`}
            onClick={togglePriorityMenu}
            data-tooltip={t("currentPriorityTooltip", { priority: currentPriority })}
            aria-expanded={isPriorityMenuOpen}
            aria-label={t("currentPriorityAria", { priority: currentPriority })}
          >
            <span className="dot" />
            <ChevronDownIcon className={`priority-chevron ${isPriorityMenuOpen ? "open" : ""}`} />
          </button>

          {isPriorityMenuOpen && (
            <div className="priority-selector" role="menu" aria-label={t("prioritySelectorAria")}>
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  className={`priority-btn p-${p} tooltip-trigger ${task.priority === p ? "active" : ""}`}
                  onClick={() => handlePriorityChange(p)}
                  data-tooltip={t("priorityOptionTooltip", { priority: t(getPriorityLabelKey(p)) })}
                >
                  <span className="dot" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="task-content">
        {editField === "name" ? (
          <input
            ref={editRef}
            className="inline-edit"
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={commitEdit}
          />
        ) : (
          <div
            className={`task-name ${isCompleted ? "completed-text" : ""}`}
            onClick={() => startEdit("name")}
            title={t("clickToEditName")}
          >
            {task.name}
          </div>
        )}

        <div className="task-meta">
          {editField === "contact" ? (
            <input
              ref={editRef}
              className="inline-edit-small"
              type="text"
              placeholder={t("contactPlaceholder")}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={commitEdit}
            />
          ) : task.contact ? (
            <span className="task-contact" onClick={() => startEdit("contact")} title={t("clickToEditContact")}>
              <UserIcon /> {task.contact}
            </span>
          ) : (
            !isCompleted && (
              <span className="task-contact task-contact--empty" onClick={() => startEdit("contact")} title={t("addContact")}>
                <UserIcon /> {t("contactWord")}
              </span>
            )
          )}
        </div>
      </div>

      <button className="delete-btn" onClick={onDelete} title={t("deleteTask")}>
        <CloseIcon />
      </button>
    </div>
  );
}
