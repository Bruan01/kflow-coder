const ENTRY_HEADING = /^##\s+(\d{4}-\d{2}-\d{2})\s*\/\s*(.+)$/;
const FIELD = /^-\s+\*\*(.+?)：\*\*\s*(.*)$/;
const TASK_ID = /\b(P\d+(?:\.\d+)?)\b/i;

export function parseLearningLog(markdown) {
  const entries = [];
  let current = null;

  for (const rawLine of markdown.split(/\r?\n/)) {
    const heading = rawLine.trim().match(ENTRY_HEADING);
    if (heading) {
      current = {
        date: heading[1],
        title: heading[2].trim(),
        taskId: heading[2].match(TASK_ID)?.[1]?.toUpperCase() ?? null,
        fields: [],
        raw: [],
      };
      entries.push(current);
      continue;
    }

    if (!current) {
      continue;
    }

    current.raw.push(rawLine);
    const field = rawLine.trim().match(FIELD);
    if (field) {
      current.fields.push({ label: field[1].trim(), value: field[2].trim() });
    }
  }

  return entries
    .map((entry) => ({ ...entry, raw: entry.raw.join("\n").trim() }))
    .reverse();
}

export function collectVerifiedTaskIds(entries) {
  return new Set(entries.map((entry) => entry.taskId).filter(Boolean));
}
