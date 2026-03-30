import { useState, useRef, useEffect, useCallback } from "react";
import type { Task } from "../wailsjs/go/main/App";
import { useOutsideClick } from "../hooks/useOutsideClick";
import { CheckIcon, UserIcon, CloseIcon, ChevronDownIcon } from "./Icons";
import type { TranslationKey, Translator } from "../i18";

interface TaskItemProps {
  task: Task;
  t: Translator;
  isEditing: boolean;
  isNewlyCreated?: boolean;
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
  isNewlyCreated = false,
  onToggleComplete,
  onUpdate,
  onDelete,
  onEditStart,
  onEditEnd,
}: TaskItemProps) {
  const [editField, setEditField] = useState<EditField>(null);
  const [editValue, setEditValue] = useState("");
  const [isPriorityMenuOpen, setIsPriorityMenuOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isPendingTransition, setIsPendingTransition] = useState(false);
  const editRef = useRef<HTMLInputElement>(null);
  const priorityMenuRef = useRef<HTMLDivElement>(null);
  const deleteConfirmRef = useRef<HTMLDivElement>(null);
  const pendingTransitionTimeoutRef = useRef<number | null>(null);
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

  useEffect(() => {
    return () => {
      if (pendingTransitionTimeoutRef.current) {
        window.clearTimeout(pendingTransitionTimeoutRef.current);
      }
    };
  }, []);

  const closePriorityMenu = useCallback(() => {
    setIsPriorityMenuOpen(false);
    onEditEnd();
  }, [onEditEnd]);

  useOutsideClick(priorityMenuRef, isPriorityMenuOpen, closePriorityMenu);

  const closeDeleteConfirm = useCallback(() => {
    setIsDeleteConfirmOpen(false);
  }, []);

  useOutsideClick(deleteConfirmRef, isDeleteConfirmOpen, closeDeleteConfirm);

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

  const handleDeleteClick = () => {
    if (isDeleteConfirmOpen) {
      setIsDeleteConfirmOpen(false);
      onDelete();
      return;
    }
    setIsDeleteConfirmOpen(true);
  };

  const handleToggleStatus = () => {
    if (!isCompleted) {
      onToggleComplete();
      return;
    }

    if (isPendingTransition) return;

    setIsPendingTransition(true);

    pendingTransitionTimeoutRef.current = window.setTimeout(() => {
      onToggleComplete();
      setIsPendingTransition(false);
      pendingTransitionTimeoutRef.current = null;
    }, 180);
  };

  return (
    <div
      className={`task-item ${isCompleted ? "completed" : ""} ${isPendingTransition ? "status-to-pending" : ""} ${isNewlyCreated ? "just-created" : ""}`}
    >
      <button
        className={`task-check ${isCompleted ? "checked" : ""}`}
        onClick={handleToggleStatus}
        disabled={isPendingTransition}
        title={isCompleted ? t("markPending") : t("markCompleted")}
        aria-label={isCompleted ? t("markPending") : t("markCompleted")}
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

      <div className="delete-control" ref={deleteConfirmRef}>
        <button
          className={`delete-btn ${isDeleteConfirmOpen ? "confirm-ready" : ""}`}
          onClick={handleDeleteClick}
          title={isDeleteConfirmOpen ? t("deleteConfirmAction") : t("deleteTask")}
          aria-label={isDeleteConfirmOpen ? t("deleteConfirmAction") : t("deleteTask")}
          aria-expanded={isDeleteConfirmOpen}
        >
          <span className="delete-icon-wrap" aria-hidden={isDeleteConfirmOpen}>
            <CloseIcon />
          </span>
          <span className="delete-label">{t("deleteConfirmAction")}</span>
        </button>
      </div>
    </div>
  );
}
