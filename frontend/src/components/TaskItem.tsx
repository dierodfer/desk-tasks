import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react";
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
type OpenMenu = "priority" | "action" | null;
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

function getStatusToggleLabel(t: Translator, isCompleted: boolean, isOnHold: boolean): string {
  if (isCompleted) return t("markPending");
  if (isOnHold) return t("restoreFromHold");
  return t("markCompleted");
}

function buildTaskItemClass(opts: {
  isCompleted: boolean;
  isOnHold: boolean;
  isPendingTransition: boolean;
  isNewlyCreated: boolean;
  menuOpen: boolean;
}): string {
  const classes = ["task-item"];
  if (opts.isCompleted) classes.push("completed");
  if (opts.isOnHold) classes.push("on-hold");
  if (opts.isPendingTransition) classes.push("status-to-pending");
  if (opts.isNewlyCreated) classes.push("just-created");
  if (opts.menuOpen) classes.push("menu-open");
  return classes.join(" ");
}

interface PriorityControlProps {
  task: Task;
  t: Translator;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onSelect: (priority: string) => void;
  onEditStart: () => void;
  onEditEnd: () => void;
}

function PriorityControl({
  task,
  t,
  isOpen,
  onOpen,
  onClose,
  onSelect,
  onEditStart,
  onEditEnd,
}: Readonly<PriorityControlProps>) {
  const menuRef = useRef<HTMLDivElement>(null);
  const currentPriority = t(getPriorityLabelKey(task.priority));

  const close = useCallback(() => {
    onClose();
    onEditEnd();
  }, [onClose, onEditEnd]);

  useOutsideClick(menuRef, isOpen, close);

  const toggle = () => {
    if (isOpen) {
      close();
    } else {
      onOpen();
      onEditStart();
    }
  };

  const handleSelect = (priority: string) => {
    onSelect(priority);
    close();
  };

  return (
    <div className="priority-control" ref={menuRef}>
      <button
        type="button"
        className={`priority-current p-${task.priority} tooltip-trigger`}
        onClick={toggle}
        data-tooltip={t("currentPriorityTooltip", { priority: currentPriority })}
        aria-expanded={isOpen}
        aria-label={t("currentPriorityAria", { priority: currentPriority })}
      >
        <span className="dot" />
        <ChevronDownIcon className={`priority-chevron ${isOpen ? "open" : ""}`} />
      </button>

      {isOpen && (
        <div className="priority-selector" role="menu" aria-label={t("prioritySelectorAria")}>
          {PRIORITIES.map((p) => (
            <button
              key={p}
              type="button"
              className={`priority-btn p-${p} tooltip-trigger ${task.priority === p ? "active" : ""}`}
              onClick={() => handleSelect(p)}
              data-tooltip={t("priorityOptionTooltip", { priority: t(getPriorityLabelKey(p)) })}
            >
              <span className="dot" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface HoldMenuProps {
  t: Translator;
  taskId: number;
  isTimePickerOpen: boolean;
  holdTimeValue: string;
  holdTimeError: string;
  onTimeChange: (value: string) => void;
  onSelectPreset: (preset: HoldPreset) => void;
  onTimeCancel: () => void;
  onTimeConfirm: () => void;
}

function HoldMenu({
  t,
  taskId,
  isTimePickerOpen,
  holdTimeValue,
  holdTimeError,
  onTimeChange,
  onSelectPreset,
  onTimeCancel,
  onTimeConfirm,
}: Readonly<HoldMenuProps>) {
  return (
    <div className="hold-menu" role="menu" aria-label={t("holdMenuAria")}>
      {isTimePickerOpen ? (
        <fieldset className="hold-time-panel" aria-label={t("holdTimePickerAria")}>
          <label className="hold-time-label" htmlFor={`hold-time-${taskId}`}>
            {t("holdTimeInputLabel")}
          </label>
          <input
            id={`hold-time-${taskId}`}
            className="hold-time-input"
            type="time"
            value={holdTimeValue}
            step={60}
            onChange={(e) => onTimeChange(e.target.value)}
          />
          {holdTimeError && <div className="hold-time-error">{holdTimeError}</div>}
          <div className="hold-time-actions">
            <button type="button" className="hold-time-btn hold-time-btn-secondary" onClick={onTimeCancel}>
              {t("holdTimeCancel")}
            </button>
            <button type="button" className="hold-time-btn hold-time-btn-primary" onClick={onTimeConfirm}>
              {t("holdTimeConfirm")}
            </button>
          </div>
        </fieldset>
      ) : (
        <>
          <button type="button" className="hold-menu-item" onClick={() => onSelectPreset("tomorrow")}>{t("holdOptionTomorrow")}</button>
          <button type="button" className="hold-menu-item" onClick={() => onSelectPreset("indefinite")}>{t("holdOptionIndefinite")}</button>
          <button type="button" className="hold-menu-item" onClick={() => onSelectPreset("today-time")}>{t("holdOptionTodayTime")}</button>
        </>
      )}
    </div>
  );
}

interface ActionMenuProps {
  task: Task;
  t: Translator;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onEditContact: () => void;
  onSendToHold?: (preset: HoldPreset, timeText?: string) => void;
  onEditStart: () => void;
  onEditEnd: () => void;
}

function ActionMenu({
  task,
  t,
  isOpen,
  onOpen,
  onClose,
  onEditContact,
  onSendToHold,
  onEditStart,
  onEditEnd,
}: Readonly<ActionMenuProps>) {
  const [isHoldMenuOpen, setIsHoldMenuOpen] = useState(false);
  const [isHoldTimePickerOpen, setIsHoldTimePickerOpen] = useState(false);
  const [holdTimeValue, setHoldTimeValue] = useState(getDefaultHoldTime);
  const [holdTimeError, setHoldTimeError] = useState("");
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const holdMenuRef = useRef<HTMLDivElement>(null);

  const resetHoldState = useCallback(() => {
    setIsHoldMenuOpen(false);
    setIsHoldTimePickerOpen(false);
    setHoldTimeError("");
  }, []);

  const closeActionMenu = useCallback(() => {
    onClose();
    resetHoldState();
  }, [onClose, resetHoldState]);

  useOutsideClick(actionMenuRef, isOpen, closeActionMenu);

  const closeHoldMenu = useCallback(() => {
    resetHoldState();
    onEditEnd();
  }, [resetHoldState, onEditEnd]);

  useOutsideClick(holdMenuRef, isHoldMenuOpen, closeHoldMenu);

  // Reset the hold sub-state whenever the action menu is dismissed externally.
  useEffect(() => {
    if (!isOpen) resetHoldState();
  }, [isOpen, resetHoldState]);

  const toggleActionMenu = () => {
    if (isOpen) {
      closeActionMenu();
    } else {
      onOpen();
    }
  };

  const toggleHoldMenu = () => {
    if (!onSendToHold) return;
    setIsHoldMenuOpen((prev) => {
      const next = !prev;
      setIsHoldTimePickerOpen(false);
      setHoldTimeError("");
      if (next) onEditStart();
      else onEditEnd();
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
    resetHoldState();
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
    resetHoldState();
    onEditEnd();
    onSendToHold("today-time", normalized);
  };

  const handleTimeChange = (value: string) => {
    setHoldTimeValue(value);
    if (holdTimeError) setHoldTimeError("");
  };

  const handleContactClick = () => {
    closeActionMenu();
    onEditContact();
  };

  return (
    <div className="action-menu-control" ref={actionMenuRef}>
      <button
        type="button"
        className={`action-menu-btn ${isOpen ? "active" : ""}`}
        onClick={toggleActionMenu}
        aria-expanded={isOpen}
        aria-label={t("taskActions") ?? "Actions"}
      >
        <MoreIcon className="action-menu-icon" />
      </button>

      {isOpen && (
        <div className="task-inline-actions">
          <button
            type="button"
            className="action-menu-item tooltip-trigger"
            onClick={handleContactClick}
            data-tooltip={task.contact || t("addContact")}
          >
            <UserIcon />
          </button>

          {onSendToHold && (
            <div className="hold-control" ref={holdMenuRef}>
              <button
                type="button"
                className={`action-menu-item tooltip-trigger ${isHoldMenuOpen ? "active" : ""}`}
                onClick={toggleHoldMenu}
                aria-expanded={isHoldMenuOpen}
                aria-label={t("sendToHold")}
                data-tooltip={t("postponeTooltip")}
              >
                <PostponeIcon className="hold-icon" />
              </button>

              {isHoldMenuOpen && (
                <HoldMenu
                  t={t}
                  taskId={task.id}
                  isTimePickerOpen={isHoldTimePickerOpen}
                  holdTimeValue={holdTimeValue}
                  holdTimeError={holdTimeError}
                  onTimeChange={handleTimeChange}
                  onSelectPreset={handleHoldOption}
                  onTimeCancel={handleHoldTimeCancel}
                  onTimeConfirm={handleHoldTimeConfirm}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface TaskContentProps {
  task: Task;
  t: Translator;
  isCompleted: boolean;
  isOnHold: boolean;
  isEditing: boolean;
  holdNote?: string;
  onUpdate: (task: Task) => void;
  onEditStart: () => void;
  onEditEnd: () => void;
}

interface TaskContentHandle {
  startEdit: (field: EditField) => void;
}

const TaskContent = forwardRef<TaskContentHandle, Readonly<TaskContentProps>>(function TaskContent(
  { task, t, isCompleted, isOnHold, isEditing, holdNote, onUpdate, onEditStart, onEditEnd },
  ref,
) {
  const [editField, setEditField] = useState<EditField>(null);
  const [editValue, setEditValue] = useState("");
  const nameEditRef = useRef<HTMLTextAreaElement>(null);
  const contactEditRef = useRef<HTMLInputElement>(null);

  const taskNameFontSize = getTaskNameFontSize(task.name.length);
  const displayedName = truncateText(task.name, MAX_NAME_LENGTH);
  const isNameTruncated = displayedName !== task.name;
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
    if (!isEditing) setEditField(null);
  }, [isEditing]);

  const startEdit = useCallback(
    (field: EditField) => {
      if (isCompleted) return;
      onEditStart();
      setEditField(field);
      setEditValue(field === "name" ? task.name : task.contact);
    },
    [isCompleted, onEditStart, task.name, task.contact],
  );

  useImperativeHandle(ref, () => ({ startEdit }), [startEdit]);

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

  return (
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
        <button
          type="button"
          className={`task-name ${isCompleted ? "completed-text" : ""}`}
          style={{ fontSize: taskNameFontSize }}
          onClick={() => startEdit("name")}
          title={isNameTruncated ? task.name : t("clickToEditName")}
        >
          {displayedName}
        </button>
      )}

      {editField === "contact" && (
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
      )}
      {editField !== "contact" && task.contact && (
        <div className="task-meta">
          <button
            type="button"
            className="task-contact"
            onClick={() => startEdit("contact")}
            title={isContactTruncated ? task.contact : t("clickToEditContact")}
          >
            <UserIcon /> {displayedContact}
          </button>
        </div>
      )}
      {isOnHold && holdNote && (
        <div className="task-meta">
          <span className="task-hold-note">{holdNote}</span>
        </div>
      )}
    </div>
  );
});

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
}: Readonly<TaskItemProps>) {
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isPendingTransition, setIsPendingTransition] = useState(false);
  const deleteConfirmRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<TaskContentHandle>(null);
  const pendingTransitionTimeoutRef = useRef<number | null>(null);

  const isCompleted = task.status === "completed";
  const isOnHold = task.status === "on_hold";
  const currentPriority = t(getPriorityLabelKey(task.priority));
  const statusToggleLabel = getStatusToggleLabel(t, isCompleted, isOnHold);
  const deleteLabel = isDeleteConfirmOpen ? t("deleteConfirmAction") : t("deleteTask");

  const closeMenus = useCallback(() => setOpenMenu(null), []);

  useEffect(() => {
    if (!isEditing) setOpenMenu(null);
  }, [isEditing]);

  useEffect(() => {
    return () => {
      if (pendingTransitionTimeoutRef.current) {
        window.clearTimeout(pendingTransitionTimeoutRef.current);
      }
    };
  }, []);

  const closeDeleteConfirm = useCallback(() => {
    setIsDeleteConfirmOpen(false);
  }, []);

  useOutsideClick(deleteConfirmRef, isDeleteConfirmOpen, closeDeleteConfirm);

  const handlePrioritySelect = (priority: string) => {
    onUpdate({ ...task, priority });
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

  const rootClassName = buildTaskItemClass({
    isCompleted,
    isOnHold,
    isPendingTransition,
    isNewlyCreated,
    menuOpen: openMenu !== null || isDeleteConfirmOpen,
  });

  return (
    <div className={rootClassName}>
      <button
        type="button"
        className={`task-check ${isCompleted ? "checked" : ""}`}
        onClick={handleToggleStatus}
        disabled={isPendingTransition}
        title={statusToggleLabel}
        aria-label={statusToggleLabel}
      >
        {isCompleted && <CheckIcon />}
      </button>

      {isCompleted || isOnHold ? (
        <div className={`priority-dot ${task.priority}`} title={t("priorityTitle", { priority: currentPriority })} />
      ) : (
        <PriorityControl
          task={task}
          t={t}
          isOpen={openMenu === "priority"}
          onOpen={() => setOpenMenu("priority")}
          onClose={closeMenus}
          onSelect={handlePrioritySelect}
          onEditStart={onEditStart}
          onEditEnd={onEditEnd}
        />
      )}

      <TaskContent
        ref={contentRef}
        task={task}
        t={t}
        isCompleted={isCompleted}
        isOnHold={isOnHold}
        isEditing={isEditing}
        holdNote={holdNote}
        onUpdate={onUpdate}
        onEditStart={onEditStart}
        onEditEnd={onEditEnd}
      />

      {!isCompleted && !isOnHold && (
        <ActionMenu
          task={task}
          t={t}
          isOpen={openMenu === "action"}
          onOpen={() => setOpenMenu("action")}
          onClose={closeMenus}
          onEditContact={() => contentRef.current?.startEdit("contact")}
          onSendToHold={onSendToHold}
          onEditStart={onEditStart}
          onEditEnd={onEditEnd}
        />
      )}

      {isOnHold && (
        <button
          type="button"
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
          type="button"
          className={`delete-btn ${isDeleteConfirmOpen ? "confirm-ready" : ""}`}
          onClick={handleDeleteClick}
          title={deleteLabel}
          aria-label={deleteLabel}
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
