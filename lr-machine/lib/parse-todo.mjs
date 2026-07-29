const PHASE_HEADING = /^##\s+(P\d+(?:[–-]P?\d+)?)(?:：|:)?\s*(.*)$/;
const CHECKBOX = /^- \[([ xX])\]\s+(.*)$/;
const TASK_ID = /\b(P\d+(?:\.\d+)?)\b/i;

function cleanMarkdown(value) {
  return value
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseTodo(markdown, verifiedTaskIds = new Set()) {
  const phases = [];
  let activePhase = null;
  let inCurrentTask = false;
  let currentTask = null;

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();
    const heading = line.match(PHASE_HEADING);

    if (heading) {
      activePhase = {
        id: heading[1].replace("-", "–"),
        title: cleanMarkdown(heading[2]),
        tasks: [],
      };
      phases.push(activePhase);
      inCurrentTask = false;
      continue;
    }

    if (/^##\s+当前唯一任务/.test(line)) {
      activePhase = null;
      inCurrentTask = true;
      continue;
    }

    if (/^##\s+/.test(line)) {
      activePhase = null;
      inCurrentTask = false;
      continue;
    }

    if (inCurrentTask && line && !currentTask) {
      const text = cleanMarkdown(line);
      const id = text.match(TASK_ID)?.[1]?.toUpperCase() ?? null;
      currentTask = { id, text };
    }

    const checkbox = line.match(CHECKBOX);
    if (!activePhase || !checkbox) {
      continue;
    }

    const text = cleanMarkdown(checkbox[2]);
    const id = text.match(TASK_ID)?.[1]?.toUpperCase() ?? null;
    const completed = checkbox[1].toLowerCase() === "x";
    activePhase.tasks.push({
      id,
      text,
      completed,
      verified: completed && id !== null && verifiedTaskIds.has(id),
    });
  }

  const tasks = phases.flatMap((phase) => phase.tasks);
  const completed = tasks.filter((task) => task.completed).length;
  const verified = tasks.filter((task) => task.verified).length;
  const total = tasks.length;

  return {
    phases: phases.map((phase) => {
      const phaseCompleted = phase.tasks.filter(
        (task) => task.completed,
      ).length;
      const phaseVerified = phase.tasks.filter((task) => task.verified).length;
      return {
        ...phase,
        completed: phaseCompleted,
        verified: phaseVerified,
        total: phase.tasks.length,
      };
    }),
    currentTask,
    totals: {
      total,
      completed,
      verified,
      completionPercent:
        total === 0 ? 0 : Math.round((completed / total) * 100),
      verificationPercent:
        total === 0 ? 0 : Math.round((verified / total) * 100),
    },
  };
}
