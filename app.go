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
		panic(fmt.Sprintf("failed to create data dir: %v", err))
	}

	dbPath := filepath.Join(dbDir, "tasks.db")
	db, err := bolt.Open(dbPath, 0600, &bolt.Options{Timeout: 1 * time.Second})
	if err != nil {
		panic(fmt.Sprintf("failed to open database: %v", err))
	}
	a.db = db

	// Ensure bucket exists.
	err = a.db.Update(func(tx *bolt.Tx) error {
		_, err := tx.CreateBucketIfNotExists(tasksBucket)
		return err
	})
	if err != nil {
		panic(fmt.Sprintf("failed to create bucket: %v", err))
	}
}

func (a *App) shutdown(ctx context.Context) {
	if a.db != nil {
		a.db.Close()
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

// GetAllTasks returns all tasks.
func (a *App) GetAllTasks() ([]Task, error) {
	var tasks []Task
	now := time.Now().UTC()
	err := a.db.Update(func(tx *bolt.Tx) error {
		b := tx.Bucket(tasksBucket)
		return b.ForEach(func(k, v []byte) error {
			var t Task
			if err := json.Unmarshal(v, &t); err != nil {
				return err
			}
			if t.Status == taskStatusOnHold && shouldReleaseHold(now, t.HoldUntil) {
				t.Status = taskStatusPending
				t.HoldUntil = ""
				buf, err := json.Marshal(t)
				if err != nil {
					return err
				}
				if err := b.Put(k, buf); err != nil {
					return err
				}
			}
			tasks = append(tasks, t)
			return nil
		})
	})
	if tasks == nil {
		tasks = []Task{}
	}
	return tasks, err
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
		// Update only the fields that are explicitly set.
		if task.Name != "" {
			current.Name = task.Name
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
		current.Contact = task.Contact
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
