import { useState, useRef, useEffect, useCallback } from "react";
import type { Task } from "../wailsjs/go/main/App";
import { useOutsideClick } from "../hooks/useOutsideClick";
import { CheckIcon, UserIcon, CloseIcon, ChevronDownIcon, PostponeIcon, MoreIcon } from "./Icons";
import type { TranslationKey, Translator } from "../i18";

interface TaskItemProps {
  task: Task;
  t: Translator;
  isEditing: boolean;
  isNewlyCreated?: boolean;
  holdNote?: string;
  onToggleComplete: () => void;
  onUpdate: (task: Task) => void;
  onDelete: () => void;
  onEditStart: () => void;
  onEditEnd: () => void;
  onSendToHold?: (preset: HoldPreset, timeText?: string) => void;
}

type EditField = "name" | "contact" | null;
type HoldPreset = "tomorrow" | "indefinite" | "today-time";
const HOLD_TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const PRIORITIES = ["high", "medium", "low"] as const;
const MAX_NAME_LENGTH = 150;
const MAX_CONTACT_LENGTH = 34;

function truncateText(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function getTaskNameFontSize(charCount: number): string {
  const maxFontSize = 13;
  const minFontSize = 10.5;
  const shrinkStart = 38;
  const shrinkEnd = MAX_NAME_LENGTH;

  if (charCount <= shrinkStart) return `${maxFontSize}px`;
  if (charCount >= shrinkEnd) return `${minFontSize}px`;

  const ratio = (charCount - shrinkStart) / (shrinkEnd - shrinkStart);
  const computed = maxFontSize - (maxFontSize - minFontSize) * ratio;
  return `${computed.toFixed(2)}px`;
}

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

function getDefaultHoldTime(): string {
  const date = new Date();
  date.setMinutes(0, 0, 0);
  date.setHours(date.getHours() + 1);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function TaskItem({
  task,
  t,
  isEditing,
  isNewlyCreated = false,
  holdNote,
  onToggleComplete,
  onUpdate,
  onDelete,
  onEditStart,
  onEditEnd,
  onSendToHold,
}: TaskItemProps) {
  const [editField, setEditField] = useState<EditField>(null);
  const [editValue, setEditValue] = useState("");
  const [isPriorityMenuOpen, setIsPriorityMenuOpen] = useState(false);
  const [isHoldMenuOpen, setIsHoldMenuOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [isPendingTransition, setIsPendingTransition] = useState(false);
  const [isHoldTimePickerOpen, setIsHoldTimePickerOpen] = useState(false);
  const [holdTimeValue, setHoldTimeValue] = useState(getDefaultHoldTime);
  const [holdTimeError, setHoldTimeError] = useState("");
  const nameEditRef = useRef<HTMLTextAreaElement>(null);
  const contactEditRef = useRef<HTMLInputElement>(null);
  const priorityMenuRef = useRef<HTMLDivElement>(null);
  const holdMenuRef = useRef<HTMLDivElement>(null);
  const deleteConfirmRef = useRef<HTMLDivElement>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const pendingTransitionTimeoutRef = useRef<number | null>(null);
  const isCompleted = task.status === "completed";
  const isOnHold = task.status === "on_hold";
  const currentPriority = t(getPriorityLabelKey(task.priority));
  const displayedName = truncateText(task.name, MAX_NAME_LENGTH);
  const isNameTruncated = displayedName !== task.name;
  const taskNameFontSize = getTaskNameFontSize(task.name.length);
  const displayedContact = truncateText(task.contact, MAX_CONTACT_LENGTH);
  const isContactTruncated = displayedContact !== task.contact;

  const adjustNameEditorHeight = useCallback(() => {
    const textarea = nameEditRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";

    const computed = window.getComputedStyle(textarea);
    const lineHeight = Number.parseFloat(computed.lineHeight) || 16;
    const maxHeight = lineHeight * 3;
    const nextHeight = Math.min(textarea.scrollHeight, maxHeight);

    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, []);

  useEffect(() => {
    if (editField === "name") {
      nameEditRef.current?.focus();
      nameEditRef.current?.select();
      adjustNameEditorHeight();
    }
    if (editField === "contact") {
      contactEditRef.current?.focus();
      contactEditRef.current?.select();
    }
  }, [editField, adjustNameEditorHeight]);

  useEffect(() => {
    if (editField === "name") {
      adjustNameEditorHeight();
    }
  }, [editField, editValue, adjustNameEditorHeight]);

  useEffect(() => {
    if (!isEditing) {
      setEditField(null);
      setIsPriorityMenuOpen(false);
      setIsHoldMenuOpen(false);
      setIsActionMenuOpen(false);
      setIsHoldTimePickerOpen(false);
      setHoldTimeError("");
    }
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

  const closeHoldMenu = useCallback(() => {
    setIsHoldMenuOpen(false);
    setIsHoldTimePickerOpen(false);
    setHoldTimeError("");
    onEditEnd();
  }, [onEditEnd]);

  useOutsideClick(holdMenuRef, isHoldMenuOpen, closeHoldMenu);

  const closeDeleteConfirm = useCallback(() => {
    setIsDeleteConfirmOpen(false);
  }, []);

  const closeActionMenu = useCallback(() => {
    setIsActionMenuOpen(false);
    setIsHoldMenuOpen(false);
    setIsHoldTimePickerOpen(false);
    setHoldTimeError("");
  }, []);

  useOutsideClick(actionMenuRef, isActionMenuOpen, closeActionMenu);
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
    if (e.key === "Enter" && !(editField === "name" && e.shiftKey)) commitEdit();
    else if (e.key === "Escape") cancelEdit();
  };

  const handlePriorityChange = (priority: string) => {
    onUpdate({ ...task, priority });
    setIsPriorityMenuOpen(false);
    onEditEnd();
  };

  const togglePriorityMenu = () => {
    if (isCompleted || isOnHold) return;
    setIsHoldMenuOpen(false);
    setIsPriorityMenuOpen((prev) => {
      const next = !prev;
      if (next) onEditStart();
      else onEditEnd();
      return next;
    });
  };

  const toggleActionMenu = () => {
    if (isCompleted || isOnHold) return;
    setIsPriorityMenuOpen(false);
    setIsActionMenuOpen((prev) => {
      const next = !prev;
      if (!next) {
        setIsHoldMenuOpen(false);
        setIsHoldTimePickerOpen(false);
        setHoldTimeError("");
      }
      return next;
    });
  };

  const toggleHoldMenu = () => {
    if (isCompleted || isOnHold || !onSendToHold) return;
    setIsPriorityMenuOpen(false);
    setIsHoldMenuOpen((prev) => {
      const next = !prev;
      if (next) {
        setIsHoldTimePickerOpen(false);
        setHoldTimeError("");
        onEditStart();
      } else {
        setIsHoldTimePickerOpen(false);
        setHoldTimeError("");
        onEditEnd();
      }
      return next;
    });
  };

  const handleHoldOption = (preset: HoldPreset) => {
    if (!onSendToHold) return;
    if (preset === "today-time") {
      setIsHoldTimePickerOpen(true);
      setHoldTimeError("");
      return;
    }
    setIsHoldMenuOpen(false);
    setIsHoldTimePickerOpen(false);
    setHoldTimeError("");
    onEditEnd();
    onSendToHold(preset);
  };

  const handleHoldTimeCancel = () => {
    setIsHoldTimePickerOpen(false);
    setHoldTimeError("");
  };

  const handleHoldTimeConfirm = () => {
    if (!onSendToHold) return;
    const normalized = holdTimeValue.trim();
    if (!HOLD_TIME_REGEX.test(normalized)) {
      setHoldTimeError(t("holdInvalidTime"));
      return;
    }

    setIsHoldMenuOpen(false);
    setIsHoldTimePickerOpen(false);
    setHoldTimeError("");
    onEditEnd();
    onSendToHold("today-time", normalized);
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
      className={`task-item ${isCompleted ? "completed" : ""} ${isOnHold ? "on-hold" : ""} ${isPendingTransition ? "status-to-pending" : ""} ${isNewlyCreated ? "just-created" : ""} ${(isPriorityMenuOpen || isHoldMenuOpen || isDeleteConfirmOpen || isActionMenuOpen) ? "menu-open" : ""}`}
    >
      <button
        className={`task-check ${isCompleted ? "checked" : ""}`}
        onClick={handleToggleStatus}
        disabled={isPendingTransition}
        title={isCompleted ? t("markPending") : isOnHold ? t("restoreFromHold") : t("markCompleted")}
        aria-label={isCompleted ? t("markPending") : isOnHold ? t("restoreFromHold") : t("markCompleted")}
      >
        {isCompleted && <CheckIcon />}
      </button>

      {isCompleted || isOnHold ? (
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
          <textarea
            ref={nameEditRef}
            className="inline-edit"
            rows={1}
            value={editValue}
            style={{ fontSize: taskNameFontSize }}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={commitEdit}
          />
        ) : (
          <div
            className={`task-name ${isCompleted ? "completed-text" : ""}`}
            style={{ fontSize: taskNameFontSize }}
            onClick={() => startEdit("name")}
            title={isNameTruncated ? task.name : t("clickToEditName")}
          >
            {displayedName}
          </div>
        )}

        {editField === "contact" ? (
          <div className="task-meta">
            <input
              ref={contactEditRef}
              className="inline-edit-small"
              type="text"
              placeholder={t("contactPlaceholder")}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={commitEdit}
            />
          </div>
        ) : task.contact ? (
          <div className="task-meta">
            <span
              className="task-contact"
              onClick={() => startEdit("contact")}
              title={isContactTruncated ? task.contact : t("clickToEditContact")}
            >
              <UserIcon /> {displayedContact}
            </span>
          </div>
        ) : null}
        {isOnHold && holdNote && (
          <div className="task-meta">
            <span className="task-hold-note">{holdNote}</span>
          </div>
        )}
      </div>

      {!isCompleted && !isOnHold && (
        <div className="action-menu-control" ref={actionMenuRef}>
          <button
            className={`action-menu-btn ${isActionMenuOpen ? "active" : ""}`}
            onClick={toggleActionMenu}
            aria-expanded={isActionMenuOpen}
            aria-label={t("taskActions") ?? "Actions"}
          >
            <MoreIcon className="action-menu-icon" />
          </button>

          {isActionMenuOpen && (
            <div className="task-inline-actions">
              <button
                className="action-menu-item tooltip-trigger"
                onClick={() => { setIsActionMenuOpen(false); startEdit("contact"); }}
                data-tooltip={task.contact || t("addContact")}
              >
                <UserIcon />
              </button>

              {onSendToHold && (
                <div className="hold-control" ref={holdMenuRef}>
                  <button
                    className={`action-menu-item tooltip-trigger ${isHoldMenuOpen ? "active" : ""}`}
                    onClick={toggleHoldMenu}
                    aria-expanded={isHoldMenuOpen}
                    aria-label={t("sendToHold")}
                    data-tooltip={t("postponeTooltip")}
                  >
                    <PostponeIcon className="hold-icon" />
                  </button>

                  {isHoldMenuOpen && (
                    <div className="hold-menu" role="menu" aria-label={t("holdMenuAria")}>
                      {isHoldTimePickerOpen ? (
                        <div className="hold-time-panel" role="group" aria-label={t("holdTimePickerAria")}>
                          <label className="hold-time-label" htmlFor={`hold-time-${task.id}`}>
                            {t("holdTimeInputLabel")}
                          </label>
                          <input
                            id={`hold-time-${task.id}`}
                            className="hold-time-input"
                            type="time"
                            value={holdTimeValue}
                            step={60}
                            onChange={(e) => {
                              setHoldTimeValue(e.target.value);
                              if (holdTimeError) setHoldTimeError("");
                            }}
                          />
                          {holdTimeError && <div className="hold-time-error">{holdTimeError}</div>}
                          <div className="hold-time-actions">
                            <button className="hold-time-btn hold-time-btn-secondary" onClick={handleHoldTimeCancel}>
                              {t("holdTimeCancel")}
                            </button>
                            <button className="hold-time-btn hold-time-btn-primary" onClick={handleHoldTimeConfirm}>
                              {t("holdTimeConfirm")}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <button className="hold-menu-item" onClick={() => handleHoldOption("tomorrow")}>{t("holdOptionTomorrow")}</button>
                          <button className="hold-menu-item" onClick={() => handleHoldOption("indefinite")}>{t("holdOptionIndefinite")}</button>
                          <button className="hold-menu-item" onClick={() => handleHoldOption("today-time")}>{t("holdOptionTodayTime")}</button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {isOnHold && (
        <button
          className="resume-btn"
          onClick={onToggleComplete}
          title={t("moveToPending")}
          aria-label={t("moveToPending")}
        >
          {t("moveToPending")}
        </button>
      )}

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
