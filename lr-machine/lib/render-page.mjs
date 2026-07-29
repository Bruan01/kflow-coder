function serializeData(data) {
  return JSON.stringify(data)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

export function renderPage({
  data = null,
  css = "",
  js = "",
  inlineAssets = false,
} = {}) {
  const styles = inlineAssets
    ? `<style>${css}</style>`
    : '<link rel="stylesheet" href="/assets/styles.css">';
  const dataScript = data
    ? `<script id="lr-data" type="application/json">${serializeData(data)}</script>`
    : "";
  const applicationScript = inlineAssets
    ? `<script>${js.replaceAll("</script", "<\\/script")}</script>`
    : '<script src="/assets/app.js" defer></script>';
  const mode = data?.snapshot ? "snapshot" : "live";

  return `<!doctype html>
<html lang="zh-CN" data-mode="${mode}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="description" content="KFlow Code learning progress, verified evidence, and API archive">
  <title>KFlow / Learning Machine</title>
  ${styles}
</head>
<body>
  <div class="paper-grid" aria-hidden="true"></div>
  <header class="topbar">
    <a class="brand" href="/" aria-label="KFlow Learning Machine home">
      <span class="brand-mark">KF</span>
      <span><strong>LEARNING MACHINE</strong><small>实验记录与工程证据</small></span>
    </a>
    <div class="topbar-status">
      <span class="signal" aria-hidden="true"></span>
      <span id="modeLabel">正在读取项目状态</span>
      <button id="refreshButton" class="text-button" type="button">重新采样</button>
    </div>
  </header>

  <div class="layout">
    <aside class="sidebar" aria-label="项目阶段">
      <div class="sidebar-heading">
        <span class="eyebrow">RESEARCH ROUTE</span>
        <strong id="projectName">KFLOW CODE</strong>
        <span id="projectVersion" class="muted">loading</span>
      </div>
      <nav id="phaseRail" class="phase-rail"></nav>
      <div class="sidebar-note">
        <span>完成不是模型的声明。</span>
        <strong>完成是证据的集合。</strong>
      </div>
    </aside>

    <main class="content">
      <section class="hero-panel reveal" aria-labelledby="currentHeading">
        <div class="hero-copy">
          <span class="eyebrow">CURRENT EXPERIMENT</span>
          <p id="currentTaskId" class="task-code">—</p>
          <h1 id="currentHeading">正在定位当前唯一任务</h1>
          <p id="currentTaskText" class="hero-description"></p>
          <div class="evidence-legend" aria-label="状态图例">
            <span><i class="dot pending"></i>未开始</span>
            <span><i class="dot completed"></i>已完成</span>
            <span><i class="dot verified"></i>有证据</span>
          </div>
        </div>
        <div class="progress-instrument" aria-label="项目完成度">
          <div id="progressRing" class="progress-ring">
            <div><strong id="completionPercent">0%</strong><span>CHECKED</span></div>
          </div>
          <dl class="instrument-readout">
            <div><dt>已完成</dt><dd id="completedCount">0 / 0</dd></div>
            <div><dt>已验证</dt><dd id="verifiedCount">0 / 0</dd></div>
          </dl>
        </div>
      </section>

      <section class="metric-strip reveal" aria-label="项目指标">
        <article><span>LEARNING NOTES</span><strong id="noteCount">0</strong><small>认知变化记录</small></article>
        <article><span>REAL API</span><strong id="apiCount">0</strong><small>真实导出声明</small></article>
        <article><span>COMMANDS</span><strong id="commandCount">0</strong><small>当前可运行脚本</small></article>
        <article><span>WORKTREE</span><strong id="changeCount">0</strong><small>尚未提交变更</small></article>
      </section>

      <section id="learning" class="section-block reveal">
        <div class="section-title">
          <div><span class="eyebrow">OBSERVATION LOG</span><h2>最近学习记录</h2></div>
          <span class="section-index">01</span>
        </div>
        <div id="learningTimeline" class="timeline"></div>
      </section>

      <section id="api" class="section-block reveal">
        <div class="section-title">
          <div><span class="eyebrow">IMPLEMENTED SURFACE</span><h2>KFC API 与命令</h2></div>
          <span class="section-index">02</span>
        </div>
        <div class="api-layout">
          <div><h3 class="subheading">PACKAGE COMMANDS</h3><div id="commandList" class="command-list"></div></div>
          <div><h3 class="subheading">SOURCE EXPORTS</h3><div id="apiList" class="api-list"></div></div>
        </div>
      </section>

      <section id="git" class="section-block reveal">
        <div class="section-title">
          <div><span class="eyebrow">REPOSITORY SIGNAL</span><h2>Git 开发状态</h2></div>
          <span class="section-index">03</span>
        </div>
        <div class="git-grid">
          <article class="git-summary"><span>BRANCH</span><strong id="gitBranch">—</strong><code id="gitHead">—</code></article>
          <div><h3 class="subheading">WORKTREE</h3><div id="changeList" class="change-list"></div></div>
          <div><h3 class="subheading">RECENT COMMITS</h3><div id="commitList" class="commit-list"></div></div>
        </div>
      </section>

      <section id="snapshots" class="section-block reveal">
        <div class="section-title">
          <div><span class="eyebrow">IMMUTABLE EVIDENCE</span><h2>HTML 学习快照</h2></div>
          <span class="section-index">04</span>
        </div>
        <div id="snapshotList" class="snapshot-list"></div>
      </section>

      <details id="vision" class="vision-panel reveal">
        <summary><span>PROJECT PREMISE</span><strong>展开项目愿景与边界</strong></summary>
        <div id="visionContent" class="prose"></div>
      </details>
    </main>
  </div>

  <footer class="footer">
    <span>KFLOW CODE / LR MACHINE</span>
    <span id="generatedAt">未采样</span>
  </footer>

  ${dataScript}
  ${applicationScript}
</body>
</html>`;
}
