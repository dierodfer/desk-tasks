package main

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	bolt "go.etcd.io/bbolt"
)

var tasksBucket = []byte("tasks")

// Task represents a single task item.
type Task struct {
	ID        uint64 `json:"id"`
	Name      string `json:"name"`
	Status    string `json:"status"`   // "pending" or "completed"
	Priority  string `json:"priority"` // "low", "medium", "high"
	Contact   string `json:"contact"`
	Order     uint64 `json:"order"` // insertion order for stable sort
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

// CreateTask creates a new task with the given name.
func (a *App) CreateTask(name string) (Task, error) {
	var task Task
	err := a.db.Update(func(tx *bolt.Tx) error {
		b := tx.Bucket(tasksBucket)
		id, _ := b.NextSequence()
		task = Task{
			ID:        id,
			Name:      name,
			Status:    "pending",
			Priority:  "low",
			Contact:   "",
			Order:     id,
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
	err := a.db.View(func(tx *bolt.Tx) error {
		b := tx.Bucket(tasksBucket)
		return b.ForEach(func(k, v []byte) error {
			var t Task
			if err := json.Unmarshal(v, &t); err != nil {
				return err
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
		if task.Status != "" {
			current.Status = task.Status
		}
		if task.Priority != "" {
			current.Priority = task.Priority
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
