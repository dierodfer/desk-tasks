// @ts-check
// Wails auto-generated bindings - runtime stubs for development
// In production, Wails injects real bindings

function call(method, ...args) {
  return window["go"]?.["main"]?.["App"]?.[method]?.(...args);
}

export function CreateTask(name) {
  return call("CreateTask", name);
}
export function GetAllTasks() {
  return call("GetAllTasks");
}
export function UpdateTask(task) {
  return call("UpdateTask", task);
}
export function DeleteTask(id) {
  return call("DeleteTask", id);
}
