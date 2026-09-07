const $ = (selector) => document.querySelector(selector);
const views = ['workspace', 'projects', 'tasks', 'runs', 'settings'];
const state = {
  projects: [],
  tasks: [],
  runs: [],
  selectedRun: null,
  streams: new Map(),
  view: 'workspace',
  commandIndex: 0,
};

const commands = [
  { label: 'Open Workspace', hint: 'Dashboard and runtime overview', key: 'G', view: 'workspace' },
  { label: 'Open Projects', hint: 'Register and inspect project roots', key: 'P', view: 'projects' },
  { label: 'Open Tasks', hint: 'Create work and start agents', key: 'T', view: 'tasks' },
  { label: 'Open Runs', hint: 'Inspect evidence and verification', key: 'R', view: 'runs' },
  { label: 'Open Settings', hint: 'Runtime and workspace preferences', key: 'S', view: 'settings' },
  { label: 'Run deterministic demo', hint: 'Create a safe local verification run', key: 'D', action: 'demo' },
  { label: 'Refresh workspace', hint: 'Reload projects, tasks and runs', key: 'F', action: 'refresh' },
];

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'content-type': 'application/json', ...options.headers },
    ...options,
  });
  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }
  if (!response.ok) {
    throw new Error(data.error?.message || `Request failed (${response.status})`);
  }
  return data;
}

function esc(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[char]));
}

function formatTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatRelative(value) {
  if (!value) return 'No activity';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function statusClass(status = '') {
  const normalized = String(status).toLowerCase();
  if (normalized.includes('verify')) return 'verified';
  if (normalized.includes('fail') || normalized.includes('error')) return 'failed';
  if (normalized.includes('run')) return 'running';
  if (normalized.includes('pending') || normalized.includes('queue')) return 'pending';
  return '';
}

function setView(view) {
  state.view = view;
  views.forEach((name) => {
    const node = $(`#${name}-view`);
    if (node) node.classList.toggle('hidden', name !== view);
  });
  document.querySelectorAll('[data-view]').forEach((button) => {
    button.classList.toggle('active', button.dataset.view === view);
  });
  const title = view === 'workspace' ? 'Workspace' : view[0].toUpperCase() + view.slice(1);
  $('#page-title').textContent = title;
  $('#breadcrumb-page').textContent = title;
  window.location.hash = view === 'workspace' ? '' : view;
}

function showToast(title, message, kind = 'success') {
  const region = $('#toast-region');
  if (!region) return;
  const toast = document.createElement('div');
  toast.className = `toast ${kind}`;
  toast.innerHTML = `<strong>${esc(title)}</strong><small>${esc(message)}</small>`;
  region.appendChild(toast);
  window.setTimeout(() => toast.remove(), 4200);
}

function renderAll() {
  renderWorkspace();
  renderProjects();
  renderTasks();
  renderRuns();
  renderSettings();
  setView(state.view);
}

async function load() {
  const [projects, tasks, runs] = await Promise.all([
    api('/api/projects'),
    api('/api/tasks'),
    api('/api/runs'),
  ]);
  state.projects = projects.projects || [];
  state.tasks = tasks.tasks || [];
  state.runs = runs.runs || [];
  renderAll();
}

function metric(label, value, detail, positive = false) {
  return `<article class="metric-card"><div class="metric-top"><span>${esc(label)}</span><span>●</span></div><div class="metric-value">${esc(value)}</div><div class="metric-delta ${positive ? 'positive' : ''}">${esc(detail)}</div></article>`;
}

function renderWorkspace() {
  const verified = state.runs.filter((run) => run.state === 'verified').length;
  const failed = state.runs.filter((run) => run.state === 'failed').length;
  const active = state.runs.filter((run) => ['running', 'pending'].includes(run.state)).length;
  const verificationRate = state.runs.length ? `${Math.round((verified / state.runs.length) * 100)}%` : '—';
  const recent = [...state.runs].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 6);

  $('#workspace-view').innerHTML = `
    <div class="dashboard-hero">
      <article class="hero-panel">
        <span class="hero-kicker">NEXUS EXECUTION GRAPH</span>
        <h2>Build with a proof trail, not a promise.</h2>
        <p>Every run moves through a controlled workflow. Agents can plan and execute work, but the workspace only treats the result as complete after evidence satisfies the verification gate.</p>
        <div class="workflow-strip">
          ${['Plan', 'Build', 'Review', 'Fix', 'Verify'].map((step, index) => `<div class="workflow-step ${index === 4 ? 'active' : ''}"><span class="step-index">0${index + 1}</span><b>${step}</b><small>${['Scope work', 'Change safely', 'Find issues', 'Recover', 'Prove result'][index]}</small></div>`).join('')}
        </div>
      </article>
      <div class="metric-rail">
        ${metric('Projects', state.projects.length, 'Registered roots')}
        ${metric('Tasks', state.tasks.length, 'Work items')}
        ${metric('Verified', verified, `${verificationRate} verification rate`, true)}
        ${metric('Active', active, failed ? `${failed} failed run${failed === 1 ? '' : 's'}` : 'Runtime queue is clean', !failed)}
      </div>
    </div>

    <div class="section-grid">
      <article class="card">
        <div class="card-head"><div><h2>Recent execution</h2><p>Latest agent activity across your local workspace.</p></div><button class="text-button" id="open-runs">View all runs →</button></div>
        <div class="collection">${recent.length ? recent.map(runRow).join('') : '<div class="empty-state">No runs yet. Register a project and launch the demo to create your first verified trace.</div>'}</div>
      </article>
      <article class="card">
        <div class="card-head"><div><h2>Quick launch</h2><p>Safe actions for the local control plane.</p></div></div>
        <div class="callout"><span class="callout-icon">✦</span><div><strong>Deterministic demo</strong><p>Exercises Planner → Builder → Reviewer → Verifier without an external model key.</p></div></div>
        <button class="primary-button" id="workspace-demo" style="width:100%;justify-content:center;margin-top:10px" type="button">Launch demo run <b>↗</b></button>
        <button class="ghost-button" id="workspace-projects" style="width:100%;margin-top:8px" type="button">Register a project</button>
      </article>
    </div>

    <div class="section-grid">
      <article class="card">
        <div class="card-head"><div><h2>System posture</h2><p>What the control plane is watching right now.</p></div></div>
        <div class="system-grid">
          <div class="system-item"><span>Provider</span><b>Deterministic local</b></div>
          <div class="system-item"><span>Execution</span><b>Brokered tools</b></div>
          <div class="system-item"><span>Evidence</span><b>Required for verify</b></div>
          <div class="system-item"><span>Network</span><b>Local-first</b></div>
        </div>
      </article>
      <article class="card">
        <div class="card-head"><div><h2>Workspace guide</h2><p>Recommended first flow.</p></div></div>
        <div class="settings-list">
          <div class="setting-row"><div><strong>01 · Register</strong><small>Attach a local project root.</small></div><span class="chip">Projects</span></div>
          <div class="setting-row"><div><strong>02 · Describe</strong><small>Create a precise task prompt.</small></div><span class="chip">Tasks</span></div>
          <div class="setting-row"><div><strong>03 · Prove</strong><small>Inspect the evidence ledger.</small></div><span class="chip">Runs</span></div>
        </div>
      </article>
    </div>`;

  $('#open-runs').onclick = () => setView('runs');
  $('#workspace-demo').onclick = quickDemo;
  $('#workspace-projects').onclick = () => setView('projects');
  document.querySelectorAll('[data-run]').forEach((node) => { node.onclick = () => selectRun(node.dataset.run); });
}

function runRow(run) {
  const stateName = run.state || 'pending';
  return `<button class="list-button" data-run="${esc(run.id)}" type="button"><div class="run-row"><div class="row-main"><div><div class="row-title">${esc(run.summary || 'Untitled execution')}</div><div class="row-meta">${esc(run.id)} · ${esc(run.stage || 'queued')} · ${formatRelative(run.createdAt)}</div></div><span class="status-chip ${statusClass(stateName)}">${esc(stateName)}</span></div></div></button>`;
}

function renderProjects() {
  $('#projects-view').innerHTML = `
    <div class="split">
      <article class="card page-card">
        <div class="card-head"><div><h2>Register project</h2><p>Every project gets a declared local boundary.</p></div><span class="chip">SAFE ROOT</span></div>
        <div class="form-stack">
          <input class="field" id="project-name" placeholder="Project name" autocomplete="off">
          <input class="field" id="project-root" placeholder="Absolute local directory path" autocomplete="off">
          <span class="form-note">The runtime rejects paths that escape the registered project boundary.</span>
          <button class="primary-button" id="add-project" type="button">Register project <b>↗</b></button>
        </div>
      </article>
      <article class="card page-card">
        <div class="collection-title"><div><h2>Project registry</h2></div><small>${state.projects.length} registered</small></div>
        <div class="collection">${state.projects.length ? state.projects.map(projectRow).join('') : '<div class="empty-state">No projects registered yet.</div>'}</div>
      </article>
    </div>
    <article class="card page-card"><div class="card-head"><div><h2>Why projects matter</h2><p>NexusAI-OS treats a project root as a security boundary instead of giving agents a raw filesystem handle.</p></div></div><div class="system-grid"><div class="system-item"><span>Boundary</span><b>Explicit root</b></div><div class="system-item"><span>Traversal</span><b>Rejected</b></div><div class="system-item"><span>Tools</span><b>Brokered</b></div><div class="system-item"><span>Trace</span><b>Evidence linked</b></div></div></article>`;
  $('#add-project').onclick = createProject;
}

function projectRow(project) {
  return `<div class="project-row"><div class="row-main"><div><div class="row-title">${esc(project.name)}</div><div class="row-meta">${esc(project.root)}</div></div><span class="chip">${esc(project.id)}</span></div></div>`;
}

async function createProject() {
  const name = $('#project-name').value.trim();
  const root = $('#project-root').value.trim();
  if (!name || !root) {
    showToast('Project details missing', 'Enter both a project name and an absolute root path.', 'error');
    return;
  }
  try {
    const result = await api('/api/projects', { method: 'POST', body: JSON.stringify({ name, root }) });
    state.projects.push(result.project);
    renderAll();
    showToast('Project registered', `${name} is ready for controlled tasks.`);
  } catch (error) {
    showToast('Project registration failed', error.message, 'error');
  }
}

function renderTasks() {
  $('#tasks-view').innerHTML = `
    <div class="split">
      <article class="card page-card">
        <div class="card-head"><div><h2>Create task</h2><p>Turn an intent into a traceable run.</p></div><span class="chip">TASK QUEUE</span></div>
        <div class="form-stack">
          <select id="task-project" ${state.projects.length ? '' : 'disabled'}>${state.projects.map((project) => `<option value="${esc(project.id)}">${esc(project.name)}</option>`).join('')}</select>
          <input class="field" id="task-title" placeholder="Task title" autocomplete="off">
          <textarea id="task-prompt" rows="7" placeholder="Describe the desired change or use: DEMO: create verified artifact"></textarea>
          <span class="form-note">Tasks are executed by the runtime orchestration pipeline; completion is not inferred from text alone.</span>
          <button class="primary-button" id="add-task" type="button" ${state.projects.length ? '' : 'disabled'}>Create task <b>↗</b></button>
        </div>
      </article>
      <article class="card page-card">
        <div class="collection-title"><div><h2>Task queue</h2></div><small>${state.tasks.length} total</small></div>
        <div class="collection">${state.tasks.length ? [...state.tasks].reverse().map(taskRow).join('') : '<div class="empty-state">No tasks yet. Create one to start a run.</div>'}</div>
      </article>
    </div>`;
  $('#add-task').onclick = createTask;
  document.querySelectorAll('[data-start]').forEach((button) => { button.onclick = () => startRun(button.dataset.start); });
}

function taskRow(task) {
  const linkedProject = state.projects.find((project) => project.id === task.projectId);
  return `<div class="task-row"><div class="row-main"><div><div class="row-title">${esc(task.title)}</div><div class="row-meta">${esc(linkedProject?.name || task.projectId)} · ${esc(task.prompt)}</div></div><button class="primary-button" data-start="${esc(task.id)}" type="button">Run <b>↗</b></button></div></div>`;
}

async function createTask() {
  const projectId = $('#task-project').value;
  const title = $('#task-title').value.trim();
  const prompt = $('#task-prompt').value.trim();
  if (!projectId || !title || !prompt) {
    showToast('Task details missing', 'Choose a project and provide both a title and prompt.', 'error');
    return;
  }
  try {
    const result = await api('/api/tasks', { method: 'POST', body: JSON.stringify({ projectId, title, prompt }) });
    state.tasks.push(result.task);
    renderAll();
    showToast('Task created', `${title} is now in the queue.`);
  } catch (error) {
    showToast('Task creation failed', error.message, 'error');
  }
}

async function startRun(taskId) {
  try {
    showToast('Run started', 'The orchestration pipeline is executing.', 'success');
    const result = await api(`/api/tasks/${taskId}/run`, { method: 'POST' });
    if (result.run?.id) state.selectedRun = result.run.id;
    setView('runs');
    await refreshRuns();
  } catch (error) {
    showToast('Run failed to start', error.message, 'error');
  }
}

async function refreshRuns() {
  const result = await api('/api/runs');
  state.runs = result.runs || [];
  renderWorkspace();
  renderRuns();
  setView(state.view);
}

function renderRuns() {
  const selected = state.selectedRun ? state.runs.find((run) => run.id === state.selectedRun) : null;
  $('#runs-view').innerHTML = `<div class="runs-layout"><article class="card page-card"><div class="collection-title"><div><h2>Run history</h2></div><small>${state.runs.length} executions</small></div><div class="run-list">${state.runs.length ? [...state.runs].sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt))).map(runRow).join('') : '<div class="empty-state">No executions yet.</div>'}</div></article><article class="card page-card run-inspector">${selected ? runInspector(selected) : '<div class="empty-state" style="margin-top:40px"><strong>Select a run</strong><br>Live stages, evidence and rollback details appear here.</div>'}</article></div>`;
  document.querySelectorAll('[data-run]').forEach((node) => { node.onclick = () => selectRun(node.dataset.run); });
  const rollback = $('#rollback');
  if (rollback) rollback.onclick = rollbackRun;
}

function runInspector(run) {
  const stages = ['planner', 'builder', 'reviewer', 'fixer', 'verifier'];
  const currentIndex = Math.max(0, stages.indexOf(run.stage || 'planner'));
  const evidence = run.evidence || [];
  return `<div class="inspector-head"><div><p class="eyebrow">RUN INSPECTOR</p><h2>${esc(run.summary || 'Execution')}</h2><div class="inspector-id">${esc(run.id)} · created ${formatTime(run.createdAt)}</div></div><span class="status-chip ${statusClass(run.state)}">${esc(run.state || 'pending')}</span></div><div class="stage-timeline">${stages.map((stage, index) => `<div class="stage-node ${index <= currentIndex && run.state !== 'failed' ? 'done' : ''} ${index === currentIndex ? 'current' : ''}"><b>${esc(stage)}</b><small>${index <= currentIndex ? 'reached' : 'waiting'}</small></div>`).join('')}</div><div class="section-grid" style="margin-top:0"><section><h3>Evidence ledger</h3><div class="evidence-list">${evidence.length ? evidence.map((item) => `<div class="evidence-item"><div class="row-main"><strong class="row-title">${esc(item.name)}</strong><span class="${item.passed ? 'evidence-pass' : 'evidence-fail'}">${item.passed ? 'PASS' : 'FAIL'}</span></div><p>${esc(item.summary)}</p></div>`).join('') : '<div class="empty-state">No evidence recorded yet.</div>'}</div></section><section><h3>Changed files</h3><pre class="code">${esc((run.changedFiles || []).join('\n') || 'No files recorded')}</pre>${run.error ? `<h3>Failure</h3><div class="callout"><span class="callout-icon">!</span><div><strong>Runtime reported an error</strong><p>${esc(run.error)}</p></div></div>` : ''}${run.checkpoint && !run.rolledBackAt ? '<button class="danger-button" id="rollback" type="button" style="margin-top:10px">Rollback checkpoint</button>' : ''}${run.rolledBackAt ? `<p class="row-meta" style="margin-top:10px">Rolled back at ${esc(run.rolledBackAt)}</p>` : ''}</section></div>`;
}

async function selectRun(id) {
  try {
    state.selectedRun = id;
    const result = await api(`/api/runs/${id}`);
    const incoming = result.run;
    state.runs = state.runs.some((run) => run.id === id)
      ? state.runs.map((run) => run.id === id ? incoming : run)
      : [...state.runs, incoming];
    renderRuns();
    setView('runs');
    openRunStream(id);
  } catch (error) {
    showToast('Unable to inspect run', error.message, 'error');
  }
}

function openRunStream(id) {
  const existing = state.streams.get(id);
  if (existing) existing.close();
  const stream = new EventSource(`/api/runs/${encodeURIComponent(id)}/events`);
  state.streams.set(id, stream);
  stream.addEventListener('nexus', async () => {
    try { await refreshRuns(); } catch { /* stream can outlive the runtime */ }
  });
  stream.addEventListener('error', () => {});
}

async function rollbackRun() {
  if (!state.selectedRun) return;
  try {
    const confirmed = window.confirm('Rollback the selected run checkpoint?');
    if (!confirmed) return;
    await api(`/api/runs/${state.selectedRun}/rollback`, { method: 'POST' });
    showToast('Checkpoint rolled back', 'The selected execution was reverted to its recorded checkpoint.');
    await selectRun(state.selectedRun);
  } catch (error) {
    showToast('Rollback failed', error.message, 'error');
  }
}

function renderSettings() {
  $('#settings-view').innerHTML = `<div class="settings-grid"><article class="card page-card"><div class="card-head"><div><h2>Runtime profile</h2><p>Local-first defaults designed for predictable execution.</p></div><span class="chip">DEFAULT</span></div><div class="settings-list"><div class="setting-row"><div><strong>Provider</strong><small>Deterministic local provider</small></div><span class="chip">LOCAL</span></div><div class="setting-row"><div><strong>Server</strong><small>Node.js control center · port 4000</small></div><span class="chip">127.0.0.1</span></div><div class="setting-row"><div><strong>Filesystem access</strong><small>Available only through brokered tools</small></div><button class="toggle on" type="button" aria-label="Filesystem broker enabled"></button></div><div class="setting-row"><div><strong>Evidence gate</strong><small>Required before a run can become verified</small></div><button class="toggle on" type="button" aria-label="Evidence gate enabled"></button></div></div></article><article class="card page-card"><div class="card-head"><div><h2>Workspace behavior</h2><p>Client-side preferences for this control surface.</p></div></div><div class="settings-list"><div class="setting-row"><div><strong>Live run updates</strong><small>Keep an event stream open for the selected run.</small></div><button class="toggle on" type="button" aria-label="Live run updates"></button></div><div class="setting-row"><div><strong>Compact navigation</strong><small>Use keyboard commands to move between areas.</small></div><button class="toggle on" type="button" aria-label="Compact navigation"></button></div><div class="setting-row"><div><strong>Safe failure messaging</strong><small>Show runtime errors without exposing raw internals by default.</small></div><button class="toggle on" type="button" aria-label="Safe failure messaging"></button></div></div></article></div><article class="card page-card"><div class="card-head"><div><h2>Quality philosophy</h2><p>The UI mirrors the runtime boundary: intent, execution and proof stay visible as separate concepts.</p></div></div><div class="system-grid"><div class="system-item"><span>Planner</span><b>Defines scope</b></div><div class="system-item"><span>Builder</span><b>Changes project</b></div><div class="system-item"><span>Reviewer</span><b>Finds issues</b></div><div class="system-item"><span>Verifier</span><b>Checks evidence</b></div></div></article>`;
  document.querySelectorAll('.toggle').forEach((toggle) => {
    toggle.onclick = () => toggle.classList.toggle('on');
  });
}

async function quickDemo() {
  if (!state.projects.length) {
    setView('projects');
    showToast('Register a project first', 'The demo needs a declared project root before it can run.', 'error');
    return;
  }
  setView('tasks');
  const select = $('#task-project');
  const title = $('#task-title');
  const prompt = $('#task-prompt');
  if (!select || !title || !prompt) return;
  select.value = state.projects[0].id;
  title.value = 'Verified workspace demo';
  prompt.value = 'DEMO: create verified artifact';
  await createTask();
  const latest = state.tasks[state.tasks.length - 1];
  if (latest) await startRun(latest.id);
}

function renderCommandList(filter = '') {
  const query = filter.trim().toLowerCase();
  const visible = commands.filter((command) => `${command.label} ${command.hint}`.toLowerCase().includes(query));
  state.commandIndex = Math.min(state.commandIndex, Math.max(visible.length - 1, 0));
  $('#command-list').innerHTML = visible.map((command, index) => `<button class="command-item ${index === state.commandIndex ? 'selected' : ''}" data-command-index="${index}" type="button"><span><strong>${esc(command.label)}</strong><small>${esc(command.hint)}</small></span><kbd>${esc(command.key)}</kbd></button>`).join('') || '<div class="empty-state">No matching command.</div>';
  document.querySelectorAll('[data-command-index]').forEach((button) => {
    button.onclick = () => executeCommand(visible[Number(button.dataset.commandIndex)]);
  });
}

function openCommandPalette() {
  const overlay = $('#command-palette');
  overlay.classList.remove('hidden');
  state.commandIndex = 0;
  $('#command-input').value = '';
  renderCommandList('');
  window.setTimeout(() => $('#command-input').focus(), 0);
}

function closeOverlays() {
  document.querySelectorAll('.overlay').forEach((overlay) => overlay.classList.add('hidden'));
}

async function executeCommand(command) {
  closeOverlays();
  if (!command) return;
  if (command.view) {
    setView(command.view);
    return;
  }
  if (command.action === 'demo') await quickDemo();
  if (command.action === 'refresh') await refreshEverything();
}

async function refreshEverything() {
  try {
    await load();
    showToast('Workspace refreshed', 'Projects, tasks and runs are up to date.');
  } catch (error) {
    showToast('Refresh failed', error.message, 'error');
  }
}

function wireShortcuts() {
  document.querySelectorAll('[data-view]').forEach((button) => {
    button.onclick = () => setView(button.dataset.view);
  });
  document.querySelectorAll('[data-close-overlay]').forEach((node) => { node.onclick = closeOverlays; });
  $('#command-open').onclick = openCommandPalette;
  $('#command-palette-trigger').onclick = openCommandPalette;
  $('#help-open').onclick = () => { $('#shortcut-panel').classList.remove('hidden'); };
  $('#refresh-btn').onclick = refreshEverything;
  $('#demo-btn').onclick = quickDemo;
}

function wireKeyboard() {
  document.addEventListener('keydown', async (event) => {
    const tag = document.activeElement?.tagName;
    const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag);
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      openCommandPalette();
      return;
    }
    if (event.key === 'Escape') {
      closeOverlays();
      return;
    }
    if (typing) return;
    const shortcut = { g: 'workspace', p: 'projects', t: 'tasks', r: 'runs', s: 'settings' }[event.key.toLowerCase()];
    if (shortcut) {
      event.preventDefault();
      setView(shortcut);
    }
    if (event.key.toLowerCase() === 'h') $('#shortcut-panel').classList.remove('hidden');
    if (event.key.toLowerCase() === 'd') await quickDemo();
    if (event.key.toLowerCase() === 'f') await refreshEverything();
  });

  $('#command-input').addEventListener('input', (event) => {
    state.commandIndex = 0;
    renderCommandList(event.target.value);
  });
  $('#command-input').addEventListener('keydown', async (event) => {
    const query = event.target.value.trim().toLowerCase();
    const visible = commands.filter((command) => `${command.label} ${command.hint}`.toLowerCase().includes(query));
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      state.commandIndex = Math.min(state.commandIndex + 1, Math.max(visible.length - 1, 0));
      renderCommandList(event.target.value);
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      state.commandIndex = Math.max(state.commandIndex - 1, 0);
      renderCommandList(event.target.value);
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      await executeCommand(visible[state.commandIndex]);
    }
  });
}

async function boot() {
  wireShortcuts();
  wireKeyboard();
  const hashView = window.location.hash.replace('#', '');
  if (views.includes(hashView)) state.view = hashView;
  try {
    await api('/api/health');
    $('#connection').textContent = 'Runtime online';
    $('.status-dot').classList.add('online');
    await load();
  } catch (error) {
    $('#connection').textContent = 'Runtime unavailable';
    showToast('Runtime unavailable', error.message, 'error');
    renderAll();
  }
}

boot();
