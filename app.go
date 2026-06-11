package main

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	bolt "go.etcd.io/bbolt"
)

var tasksBucket = []byte("tasks")

const (
	taskStatusPending   = "pending"
	taskStatusCompleted = "completed"
	taskStatusOnHold    = "on_hold"

	taskPriorityLow    = "low"
	taskPriorityMedium = "medium"
	taskPriorityHigh   = "high"

	maxTaskNameLength = 150
	maxContactLength  = 34
)

// Task represents a single task item.
type Task struct {
	ID        uint64 `json:"id"`
	Name      string `json:"name"`
	Status    string `json:"status"`   // "pending", "completed" or "on_hold"
	Priority  string `json:"priority"` // "low", "medium", "high"
	Contact   string `json:"contact"`
	Order     uint64 `json:"order"` // insertion order for stable sort
	HoldUntil string `json:"holdUntil"`
	CreatedAt string `json:"createdAt"`
}

// App struct holds the application state.
type App struct {
	ctx context.Context
	db  *bolt.DB
}

// NewApp creates a new App.
func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	dataDir, err := os.UserConfigDir()
	if err != nil {
		dataDir = "."
	}
	dbDir := filepath.Join(dataDir, "desk-tasks")
	if err := os.MkdirAll(dbDir, 0750); err != nil {
		a.fatalStartupError(fmt.Sprintf("Failed to create data directory:\n%v", err))
		return
	}

	dbPath := filepath.Join(dbDir, "tasks.db")
	db, err := bolt.Open(dbPath, 0600, &bolt.Options{Timeout: 1 * time.Second})
	if err != nil {
		a.fatalStartupError(fmt.Sprintf("Failed to open database:\n%v", err))
		return
	}
	a.db = db

	// Ensure bucket exists.
	err = a.db.Update(func(tx *bolt.Tx) error {
		_, err := tx.CreateBucketIfNotExists(tasksBucket)
		return err
	})
	if err != nil {
		a.fatalStartupError(fmt.Sprintf("Failed to initialize database:\n%v", err))
		return
	}
}

// fatalStartupError shows the user a native error dialog explaining why the
// app cannot start, then exits the process.
func (a *App) fatalStartupError(message string) {
	_, _ = runtime.MessageDialog(a.ctx, runtime.MessageDialogOptions{
		Type:    runtime.ErrorDialog,
		Title:   "Desk Tasks - Startup error",
		Message: message,
	})
	os.Exit(1)
}

func (a *App) shutdown(ctx context.Context) {
	if a.db != nil {
		if err := a.db.Close(); err != nil {
			fmt.Fprintf(os.Stderr, "failed to close database: %v\n", err)
		}
	}
}

// itob converts a uint64 to an 8-byte big endian byte slice.
func itob(v uint64) []byte {
	b := make([]byte, 8)
	binary.BigEndian.PutUint64(b, v)
	return b
}

func parsePriority(priority string) (string, bool) {
	switch priority {
	case taskPriorityHigh, taskPriorityMedium, taskPriorityLow:
		return priority, true
	default:
		return "", false
	}
}

func normalizePriority(priority string) string {
	if parsed, ok := parsePriority(priority); ok {
		return parsed
	}
	return taskPriorityLow
}

func parseStatus(status string) (string, bool) {
	switch status {
	case taskStatusPending, taskStatusCompleted, taskStatusOnHold:
		return status, true
	default:
		return "", false
	}
}

func parseHoldUntil(value string) (string, bool) {
	value = strings.TrimSpace(value)
	if value == "" {
		return "", true
	}
	ts, err := time.Parse(time.RFC3339, value)
	if err != nil {
		return "", false
	}
	return ts.UTC().Format(time.RFC3339), true
}

func shouldReleaseHold(now time.Time, holdUntil string) bool {
	holdUntil = strings.TrimSpace(holdUntil)
	if holdUntil == "" {
		return false
	}
	until, err := time.Parse(time.RFC3339, holdUntil)
	if err != nil {
		// Invalid data should not block the task forever.
		return true
	}
	return !until.After(now)
}

// CreateTask creates a new task with the given name.
func (a *App) CreateTask(name string, priority string) (Task, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return Task{}, fmt.Errorf("task name cannot be empty")
	}
	if len(name) > maxTaskNameLength {
		return Task{}, fmt.Errorf("task name exceeds maximum length of %d characters", maxTaskNameLength)
	}

	var task Task
	err := a.db.Update(func(tx *bolt.Tx) error {
		b := tx.Bucket(tasksBucket)
		id, err := b.NextSequence()
		if err != nil {
			return fmt.Errorf("failed to generate task id: %w", err)
		}

		task = Task{
			ID:        id,
			Name:      name,
			Status:    taskStatusPending,
			Priority:  normalizePriority(priority),
			Contact:   "",
			Order:     id,
			HoldUntil: "",
			CreatedAt: time.Now().UTC().Format(time.RFC3339),
		}
		buf, err := json.Marshal(task)
		if err != nil {
			return err
		}
		return b.Put(itob(id), buf)
	})
	return task, err
}

// GetAllTasks returns all tasks, releasing any holds that have expired.
func (a *App) GetAllTasks() ([]Task, error) {
	var tasks []Task
	var released []Task
	now := time.Now().UTC()

	err := a.db.View(func(tx *bolt.Tx) error {
		b := tx.Bucket(tasksBucket)
		return b.ForEach(func(_, v []byte) error {
			var t Task
			if err := json.Unmarshal(v, &t); err != nil {
				return err
			}
			if t.Status == taskStatusOnHold && shouldReleaseHold(now, t.HoldUntil) {
				t.Status = taskStatusPending
				t.HoldUntil = ""
				released = append(released, t)
			}
			tasks = append(tasks, t)
			return nil
		})
	})
	if err != nil {
		return nil, err
	}

	if len(released) > 0 {
		err = a.db.Update(func(tx *bolt.Tx) error {
			b := tx.Bucket(tasksBucket)
			for _, t := range released {
				buf, err := json.Marshal(t)
				if err != nil {
					return err
				}
				if err := b.Put(itob(t.ID), buf); err != nil {
					return err
				}
			}
			return nil
		})
		if err != nil {
			return nil, err
		}
	}

	if tasks == nil {
		tasks = []Task{}
	}
	return tasks, nil
}

// UpdateTask updates an existing task. Only provided fields are changed.
func (a *App) UpdateTask(task Task) (Task, error) {
	var updated Task
	err := a.db.Update(func(tx *bolt.Tx) error {
		b := tx.Bucket(tasksBucket)
		existing := b.Get(itob(task.ID))
		if existing == nil {
			return fmt.Errorf("task %d not found", task.ID)
		}
		var current Task
		if err := json.Unmarshal(existing, &current); err != nil {
			return err
		}
		// Task names are required and can never be cleared, so a blank Name
		// leaves the current name unchanged. A non-blank Name is trimmed and
		// length-validated the same way as CreateTask.
		if name := strings.TrimSpace(task.Name); name != "" {
			if len(name) > maxTaskNameLength {
				return fmt.Errorf("task name exceeds maximum length of %d characters", maxTaskNameLength)
			}
			current.Name = name
		}
		if status, ok := parseStatus(task.Status); ok {
			current.Status = status
		}
		if priority, ok := parsePriority(task.Priority); ok {
			current.Priority = priority
		}
		if holdUntil, ok := parseHoldUntil(task.HoldUntil); ok {
			current.HoldUntil = holdUntil
		} else if task.HoldUntil != "" {
			return fmt.Errorf("invalid holdUntil: expected RFC3339")
		}
		if current.Status != taskStatusOnHold {
			current.HoldUntil = ""
		}
		// Contact can be set to empty intentionally, so always update it.
		contact := strings.TrimSpace(task.Contact)
		if len(contact) > maxContactLength {
			return fmt.Errorf("contact exceeds maximum length of %d characters", maxContactLength)
		}
		current.Contact = contact
		updated = current
		buf, err := json.Marshal(updated)
		if err != nil {
			return err
		}
		return b.Put(itob(updated.ID), buf)
	})
	return updated, err
}

// DeleteTask removes a task by ID.
func (a *App) DeleteTask(id uint64) error {
	return a.db.Update(func(tx *bolt.Tx) error {
		b := tx.Bucket(tasksBucket)
		return b.Delete(itob(id))
	})
}

// QuitApp closes the desktop application.
func (a *App) QuitApp() {
	runtime.Quit(a.ctx)
}
