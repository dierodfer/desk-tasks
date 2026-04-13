package main

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	bolt "go.etcd.io/bbolt"
)

// newTestApp creates an App backed by a temporary BoltDB for integration tests.
func newTestApp(t *testing.T) *App {
	t.Helper()
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "test_tasks.db")
	db, err := bolt.Open(dbPath, 0600, &bolt.Options{Timeout: 1 * time.Second})
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	err = db.Update(func(tx *bolt.Tx) error {
		_, err := tx.CreateBucketIfNotExists(tasksBucket)
		return err
	})
	if err != nil {
		t.Fatalf("failed to create bucket: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	return &App{db: db}
}

func TestBoltDBOpensAndCloses(t *testing.T) {
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "open_close.db")
	db, err := bolt.Open(dbPath, 0600, &bolt.Options{Timeout: 1 * time.Second})
	if err != nil {
		t.Fatalf("BoltDB failed to open: %v", err)
	}
	if err := db.Close(); err != nil {
		t.Fatalf("BoltDB failed to close: %v", err)
	}
	if _, err := os.Stat(dbPath); os.IsNotExist(err) {
		t.Fatal("database file was not created on disk")
	}
}

func TestCreateAndGetTasks(t *testing.T) {
	app := newTestApp(t)

	task, err := app.CreateTask("integration task", "high")
	if err != nil {
		t.Fatalf("CreateTask failed: %v", err)
	}
	if task.ID == 0 {
		t.Fatal("expected non-zero task ID")
	}
	if task.Name != "integration task" {
		t.Fatalf("expected name 'integration task', got %q", task.Name)
	}
	if task.Priority != taskPriorityHigh {
		t.Fatalf("expected priority %q, got %q", taskPriorityHigh, task.Priority)
	}
	if task.Status != taskStatusPending {
		t.Fatalf("expected status %q, got %q", taskStatusPending, task.Status)
	}

	tasks, err := app.GetAllTasks()
	if err != nil {
		t.Fatalf("GetAllTasks failed: %v", err)
	}
	if len(tasks) != 1 {
		t.Fatalf("expected 1 task, got %d", len(tasks))
	}
}

func TestUpdateTask(t *testing.T) {
	app := newTestApp(t)

	task, err := app.CreateTask("to update", "low")
	if err != nil {
		t.Fatalf("CreateTask failed: %v", err)
	}

	updated, err := app.UpdateTask(Task{
		ID:       task.ID,
		Name:     "updated name",
		Status:   taskStatusCompleted,
		Priority: taskPriorityMedium,
	})
	if err != nil {
		t.Fatalf("UpdateTask failed: %v", err)
	}
	if updated.Name != "updated name" {
		t.Fatalf("expected name 'updated name', got %q", updated.Name)
	}
	if updated.Status != taskStatusCompleted {
		t.Fatalf("expected status %q, got %q", taskStatusCompleted, updated.Status)
	}
}

func TestDeleteTask(t *testing.T) {
	app := newTestApp(t)

	task, err := app.CreateTask("to delete", "low")
	if err != nil {
		t.Fatalf("CreateTask failed: %v", err)
	}

	if err := app.DeleteTask(task.ID); err != nil {
		t.Fatalf("DeleteTask failed: %v", err)
	}

	tasks, err := app.GetAllTasks()
	if err != nil {
		t.Fatalf("GetAllTasks failed: %v", err)
	}
	if len(tasks) != 0 {
		t.Fatalf("expected 0 tasks after delete, got %d", len(tasks))
	}
}

func TestCreateTaskEmptyNameFails(t *testing.T) {
	app := newTestApp(t)

	_, err := app.CreateTask("", "low")
	if err == nil {
		t.Fatal("expected error for empty task name, got nil")
	}
}

func TestHoldUntilAutoRelease(t *testing.T) {
	app := newTestApp(t)

	task, err := app.CreateTask("hold me", "low")
	if err != nil {
		t.Fatalf("CreateTask failed: %v", err)
	}

	past := time.Now().UTC().Add(-1 * time.Hour).Format(time.RFC3339)
	_, err = app.UpdateTask(Task{
		ID:        task.ID,
		Status:    taskStatusOnHold,
		HoldUntil: past,
	})
	if err != nil {
		t.Fatalf("UpdateTask failed: %v", err)
	}

	tasks, err := app.GetAllTasks()
	if err != nil {
		t.Fatalf("GetAllTasks failed: %v", err)
	}
	if len(tasks) != 1 {
		t.Fatalf("expected 1 task, got %d", len(tasks))
	}
	if tasks[0].Status != taskStatusPending {
		t.Fatalf("expected task to be auto-released to %q, got %q", taskStatusPending, tasks[0].Status)
	}
}
