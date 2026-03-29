// Wails bindings type declarations
// These match the Go Task struct and App methods

export interface Task {
  id: number;
  name: string;
  status: string;
  priority: string;
  contact: string;
  order: number;
  createdAt: string;
}

export function CreateTask(name: string): Promise<Task>;
export function GetAllTasks(): Promise<Task[]>;
export function UpdateTask(task: Task): Promise<Task>;
export function DeleteTask(id: number): Promise<void>;
