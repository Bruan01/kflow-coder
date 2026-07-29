(() => {
  "use strict";

  const byId = (id) => document.getElementById(id);
  const escapeHtml = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const renderInline = (value) =>
    escapeHtml(value)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  function renderMarkdown(markdown) {
    const lines = String(markdown ?? "").split(/\r?\n/);
    const output = [];
    let inCode = false;
    let code = [];
    let listOpen = false;

    const closeList = () => {
      if (listOpen) output.push("</ul>");
      listOpen = false;
    };

    for (const line of lines) {
      if (line.trim().startsWith("```")) {
        closeList();
        if (inCode) {
          output.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
          code = [];
        }
        inCode = !inCode;
        continue;
      }
      if (inCode) {
        code.push(line);
        continue;
      }
      const heading = line.match(/^(#{1,4})\s+(.+)$/);
      if (heading) {
        closeList();
        const level = Math.min(heading[1].length + 2, 6);
        output.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
        continue;
      }
      const bullet = line.match(/^[-*]\s+(.+)$/);
      if (bullet) {
        if (!listOpen) output.push("<ul>");
        listOpen = true;
        output.push(`<li>${renderInline(bullet[1])}</li>`);
        continue;
      }
      closeList();
      if (line.trim()) output.push(`<p>${renderInline(line.trim())}</p>`);
    }

    closeList();
    if (inCode)
      output.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
    return output.join("");
  }

  const formatDate = (value) => {
    try {
      return new Intl.DateTimeFormat("zh-CN", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value));
    } catch {
      return String(value ?? "");
    }
  };

  function renderPhases(data) {
    const activeId = data.progress.currentTask?.id?.split(".")[0] ?? "P0";
    byId("phaseRail").innerHTML = data.progress.phases
      .map((phase) => {
        const state =
          phase.verified === phase.total && phase.total > 0
            ? "verified"
            : phase.completed > 0
              ? "active"
              : "pending";
        const active = phase.id.includes(activeId) ? "is-current" : "";
        return `<a class="phase-item ${state} ${active}" href="#learning">
          <span class="phase-node"></span>
          <span><strong>${escapeHtml(phase.id)}</strong><small>${escapeHtml(phase.title || "阶段")}</small></span>
          <em>${phase.verified}/${phase.total}</em>
        </a>`;
      })
      .join("");
  }

  function renderCurrent(data) {
    const current = data.progress.currentTask ?? {
      id: "—",
      text: "TODO.md 尚未定义当前任务",
    };
    byId("currentTaskId").textContent = current.id ?? "UNNUMBERED";
    const cleanText = current.text.replace(/^P\d+(?:\.\d+)?\s*/i, "");
    const [heading, ...rest] = cleanText.split("：");
    byId("currentHeading").textContent = heading || cleanText;
    byId("currentTaskText").textContent =
      rest.join("：") || "遵循 TODO 中定义的验收边界推进。";

    const totals = data.progress.totals;
    byId("completionPercent").textContent = `${totals.completionPercent}%`;
    byId("progressRing").style.setProperty(
      "--progress",
      `${Math.max(0, Math.min(100, totals.completionPercent)) * 3.6}deg`,
    );
    byId("completedCount").textContent =
      `${totals.completed} / ${totals.total}`;
    byId("verifiedCount").textContent = `${totals.verified} / ${totals.total}`;
  }

  function renderLearning(data) {
    byId("learningTimeline").innerHTML = data.learningEntries.length
      ? data.learningEntries
          .slice(0, 8)
          .map((entry, index) => {
            const keyFields = entry.fields.slice(0, 4);
            return `<article class="log-entry" style="--delay:${index * 55}ms">
              <div class="log-marker"><span>${escapeHtml(entry.taskId ?? "LOG")}</span></div>
              <div class="log-card">
                <header><time>${escapeHtml(entry.date)}</time><h3>${escapeHtml(entry.title)}</h3></header>
                <dl>${keyFields
                  .map(
                    (field) =>
                      `<div><dt>${escapeHtml(field.label)}</dt><dd>${renderInline(field.value)}</dd></div>`,
                  )
                  .join("")}</dl>
              </div>
            </article>`;
          })
          .join("")
      : '<p class="empty-state">尚无学习记录。完成任务后先写证据，再生成快照。</p>';
  }

  function renderCommands(data) {
    byId("commandList").innerHTML = data.commands
      .map(
        (item) => `<article class="command-card">
          <div><span class="terminal-prompt">$</span><code>pnpm ${escapeHtml(item.name)}</code></div>
          <p>${escapeHtml(item.description)}</p>
          <small>${escapeHtml(item.command)}</small>
        </article>`,
      )
      .join("");
  }

  function renderApi(data) {
    byId("apiList").innerHTML = data.api.length
      ? data.api
          .map(
            (item) => `<article class="api-card">
              <span class="api-kind">${escapeHtml(item.kind)}</span>
              <div><strong>${escapeHtml(item.name)}</strong><code>${escapeHtml(item.path)}:${item.line}</code></div>
              <p>${escapeHtml(item.signature)}</p>
            </article>`,
          )
          .join("")
      : '<p class="empty-state">尚无公开导出。API 只在代码真实存在后出现。</p>';
  }

  function renderGit(data) {
    byId("gitBranch").textContent = data.git.branch;
    byId("gitHead").textContent = data.git.head;
    byId("changeList").innerHTML = data.git.changes.length
      ? data.git.changes
          .slice(0, 12)
          .map(
            (change) =>
              `<div class="change-row"><span>${escapeHtml(change.state)}</span><code>${escapeHtml(change.path)}</code></div>`,
          )
          .join("")
      : '<p class="empty-state compact">工作区干净。</p>';
    byId("commitList").innerHTML = data.git.commits.length
      ? data.git.commits
          .map(
            (commit) =>
              `<div class="commit-row"><code>${escapeHtml(commit.hash)}</code><span>${escapeHtml(commit.subject)}</span><time>${escapeHtml(commit.date)}</time></div>`,
          )
          .join("")
      : '<p class="empty-state compact">尚无提交记录。</p>';
  }

  function renderSnapshots(data) {
    const isSnapshot = Boolean(data.snapshot);
    byId("snapshotList").innerHTML = data.snapshots.length
      ? data.snapshots
          .slice(0, 12)
          .map((snapshot) => {
            const href = isSnapshot
              ? "#"
              : `/snapshots/${encodeURIComponent(snapshot.name)}`;
            return `<a class="snapshot-card" href="${href}">
              <span class="snapshot-stamp">HTML</span>
              <strong>${escapeHtml(snapshot.name)}</strong>
              <time>${formatDate(snapshot.modifiedAt)}</time>
            </a>`;
          })
          .join("")
      : '<p class="empty-state">第一份开发快照尚未生成。</p>';
  }

  function render(data) {
    document.title = `${data.project.name} / Learning Machine`;
    byId("projectName").textContent = data.project.name.toUpperCase();
    byId("projectVersion").textContent = `VERSION ${data.project.version}`;
    byId("modeLabel").textContent = data.snapshot
      ? `归档快照 / ${data.snapshot.title}`
      : `实时读取 / ${data.git.branch}@${data.git.head}`;
    byId("refreshButton").hidden = Boolean(data.snapshot);
    byId("generatedAt").textContent = `采样于 ${formatDate(data.generatedAt)}`;

    byId("noteCount").textContent = data.learningEntries.length;
    byId("apiCount").textContent = data.api.length;
    byId("commandCount").textContent = data.commands.length;
    byId("changeCount").textContent = data.git.changes.length;
    byId("visionContent").innerHTML = renderMarkdown(data.visionMarkdown);

    renderPhases(data);
    renderCurrent(data);
    renderLearning(data);
    renderCommands(data);
    renderApi(data);
    renderGit(data);
    renderSnapshots(data);

    document.documentElement.classList.add("is-ready");
  }

  async function load() {
    const embedded = byId("lr-data");
    if (embedded) {
      render(JSON.parse(embedded.textContent));
      return;
    }
    const response = await fetch("/api/project", { cache: "no-store" });
    if (!response.ok)
      throw new Error(`Project data request failed: ${response.status}`);
    render(await response.json());
  }

  byId("refreshButton").addEventListener("click", () => {
    byId("modeLabel").textContent = "重新采样中…";
    load().catch(showError);
  });

  function showError(error) {
    byId("modeLabel").textContent = "采样失败";
    byId("currentHeading").textContent = "无法读取项目数据";
    byId("currentTaskText").textContent =
      error instanceof Error ? error.message : String(error);
    document.documentElement.classList.add("is-ready");
  }

  load().catch(showError);
})();
