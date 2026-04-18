export function formatTaskLabel(taskId: string) {
  if (taskId.startsWith('任务')) {
    return taskId;
  }

  if (taskId.startsWith('T') && taskId.length > 1) {
    return `任务 ${taskId.slice(1)}`;
  }

  return `任务 ${taskId}`;
}
