// ============================================================
//  APP.JS — Unidos Mayoreo · Sistema de Visitas
// ============================================================

const PROBLEMS = [
  'Garantías lentas','Taller lento','Repuestos faltantes','Cobros excesivos',
  'Falta de agente','Horario de retiro','Push money inconsistente','Promesas incumplidas',
  'Notas de crédito pendientes','Comunicación deficiente','Otro'
];

let visits = [];
let starVal = 0;
let editId = null;
let isConfigured = CONFIG.SCRIPT_URL !== 'TU_URL_DE_APPS_SCRIPT';

// ── INIT ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (!isConfigured) {
    document.getElementById('config-banner').classList.remove('hidden');
  } else {
    document.getElementById('config-banner').classList.add('hidden');
  }
  buildPills();
  document.getElementById('f-date').value = today();
  addPedido();
  addAccion();
  loadVisits();
});

// ── UTILIDADES ────────────────────────────────────────────
function today() {
  return new Date().toISOString().split('T')[0];
}

function toast(msg, ok = true) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.background = ok ? '#1E8449' : '#922B21';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}

function setStar(n) {
  starVal = n;
  document.getElementById('f-sat').value = n;
  document.querySelectorAll('.star').forEach((s, i) => s.classList.toggle('on', i < n));
}

// ── NAVEGACIÓN ────────────────────────────────────────────
function nav(p) {
  document.querySelectorAll('.page').forEach(e => e.classList.remove('active'));
  document.querySelectorAll('.nav button').forEach((b, i) =>
    b.classList.toggle('active', ['analysis', 'charts', 'form'][i] === p)
  );
  document.getElementById('page-' + p).classList.add('active');
  if (p === 'analysis') renderTable();
  if (p === 'charts') renderCharts();
  if (p === 'form' && !editId) resetForm();
}

// ── PILLS (PROBLEMAS) ─────────────────────────────────────
function buildPills() {
  document.getElementById('pills-group').innerHTML = PROBLEMS
    .map(p => `<span class="pill" data-p="${p}" onclick="this.classList.toggle('on')">${p}</span>`)
    .join('');
}

function getProblems() {
  return Array.from(document.querySelectorAll('#pills-group .pill.on')).map(p => p.dataset.p);
}

// ── FILAS DINÁMICAS ───────────────────────────────────────
function addPedido(data = {}) {
  const id = 'pd' + Date.now() + Math.random();
  const div = document.createElement('div');
  div.className = 'dyn-row dyn-row-3';
  div.id = id;
  div.innerHTML = `
    <input type="text" placeholder="Ej: Discos diamante" value="${data.cat || ''}">
    <input type="number" placeholder="0" value="${data.monto || ''}">
    <input type="text" placeholder="Observación" value="${data.obs || ''}">
    <button class="btn-rm" onclick="document.getElementById('${id}').remove()">×</button>`;
  document.getElementById('pedido-rows').appendChild(div);
}

function addAccion(data = {}) {
  const id = 'ac' + Date.now() + Math.random();
  const div = document.createElement('div');
  div.className = 'dyn-row dyn-row-4';
  div.id = id;
  div.innerHTML = `
    <input type="text" placeholder="Describir acción" value="${data.accion || ''}">
    <input type="text" placeholder="Responsable" value="${data.resp || ''}">
    <input type="date" value="${data.fecha || ''}">
    <select>
      <option ${data.prio === 'Alta' ? 'selected' : ''}>Alta</option>
      <option ${data.prio === 'Media' ? 'selected' : ''}>Media</option>
      <option ${data.prio === 'Baja' ? 'selected' : ''}>Baja</option>
    </select>
    <button class="btn-rm" onclick="document.getElementById('${id}').remove()">×</button>`;
  document.getElementById('accion-rows').appendChild(div);
}

function getPedidos() {
  return Array.from(document.querySelectorAll('#pedido-rows .dyn-row')).map(r => {
    const i = r.querySelectorAll('input');
    return { cat: i[0].value, monto: i[1].value, obs: i[2].value };
  }).filter(p => p.cat.trim());
}

function getAcciones() {
  return Array.from(document.querySelectorAll('#accion-rows .dyn-row')).map(r => {
    const i = r.querySelectorAll('input');
    const s = r.querySelector('select');
    return { accion: i[0].value, resp: i[1].value, fecha: i[2].value, prio: s ? s.value : '' };
  }).filter(a => a.accion.trim());
}

// ── FORMULARIO ────────────────────────────────────────────
function resetForm() {
  editId = null;
  starVal = 0;
  document.getElementById('form-ttl').textContent = 'Registrar nueva visita';
  document.getElementById('f-eid').value = '';
  ['f-date','f-agent','f-zone','f-code','f-name','f-type','f-contact','f-phone',
   'f-dias','f-mora','f-fact','f-nc','f-dev','f-reclamos','f-competencia','f-garantia',
   'f-pop','f-obs','f-pedido-realizado','f-nextv','f-comments','f-firma'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('f-date').value = today();
  document.getElementById('f-sat').value = 0;
  document.querySelectorAll('.star').forEach(s => s.classList.remove('on'));
  document.getElementById('pedido-rows').innerHTML = '';
  document.getElementById('accion-rows').innerHTML = '';
  buildPills();
  addPedido();
  addAccion();
}

function populateForm(v) {
  document.getElementById('form-ttl').textContent = 'Editar visita';
  document.getElementById('f-eid').value = v.id;
  const set = (id, val) => { const e = document.getElementById(id); if (e && val !== undefined) e.value = val || ''; };
  set('f-date', v.date); set('f-agent', v.agent); set('f-zone', v.zone);
  set('f-code', v.code); set('f-name', v.name); set('f-type', v.type);
  set('f-contact', v.contact); set('f-phone', v.phone);
  set('f-dias', v.dias); set('f-mora', v.mora); set('f-fact', v.fact);
  set('f-nc', v.nc); set('f-dev', v.dev);
  set('f-reclamos', v.reclamos); set('f-competencia', v.competencia);
  set('f-garantia', v.garantia); set('f-pop', v.pop); set('f-obs', v.obs);
  set('f-pedido-realizado', v.pedidoRealizado); set('f-nextv', v.nextv);
  set('f-comments', v.comments); set('f-firma', v.firma);
  setStar(v.satisfaccion || 0);
  buildPills();
  (v.problems || []).forEach(p => {
    const el = document.querySelector(`#pills-group [data-p="${p}"]`);
    if (el) el.classList.add('on');
  });
  document.getElementById('pedido-rows').innerHTML = '';
  (v.pedidos || []).forEach(p => addPedido(p));
  if (!(v.pedidos || []).length) addPedido();
  document.getElementById('accion-rows').innerHTML = '';
  (v.acciones || []).forEach(a => addAccion(a));
  if (!(v.acciones || []).length) addAccion();
}

// ── GUARDAR VISITA ────────────────────────────────────────
async function saveVisit() {
  const code = document.getElementById('f-code').value.trim();
  const name = document.getElementById('f-name').value.trim();
  const date = document.getElementById('f-date').value;
  if (!code || !name || !date) {
    toast('Código, nombre y fecha son obligatorios.', false);
    return;
  }

  const v = {
    id: editId || Date.now().toString(),
    code, name, date,
    agent: document.getElementById('f-agent').value.trim(),
    zone: document.getElementById('f-zone').value,
    type: document.getElementById('f-type').value,
    contact: document.getElementById('f-contact').value.trim(),
    phone: document.getElementById('f-phone').value.trim(),
    dias: document.getElementById('f-dias').value,
    mora: document.getElementById('f-mora').value,
    fact: document.getElementById('f-fact').value,
    nc: document.getElementById('f-nc').value,
    dev: document.getElementById('f-dev').value,
    problems: getProblems(),
    reclamos: document.getElementById('f-reclamos').value.trim(),
    competencia: document.getElementById('f-competencia').value.trim(),
    garantia: document.getElementById('f-garantia').value.trim(),
    pop: document.getElementById('f-pop').value.trim(),
    obs: document.getElementById('f-obs').value.trim(),
    pedidos: getPedidos(),
    acciones: getAcciones(),
    pedidoRealizado: document.getElementById('f-pedido-realizado').value,
    satisfaccion: parseInt(document.getElementById('f-sat').value) || 0,
    nextv: document.getElementById('f-nextv').value,
    comments: document.getElementById('f-comments').value.trim(),
    firma: document.getElementById('f-firma').value.trim(),
    status: editId ? (visits.find(x => x.id === editId) || {}).status || 'Pendiente' : 'Pendiente',
    createdAt: editId ? (visits.find(x => x.id === editId) || {}).createdAt : new Date().toISOString()
  };

  const btn = document.getElementById('save-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Guardando...';

  if (isConfigured) {
    try {
      const res = await fetch(CONFIG.SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action: editId ? 'update' : 'save', visit: v })
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Error desconocido');
    } catch (e) {
      toast('Error al guardar en Google Sheets: ' + e.message, false);
      btn.disabled = false;
      btn.innerHTML = '<i class="ti ti-device-floppy"></i> Guardar visita';
      return;
    }
  }

  // Siempre guarda local también como respaldo
  if (editId) {
    const i = visits.findIndex(x => x.id === editId);
    if (i >= 0) visits[i] = v;
  } else {
    visits.unshift(v);
  }
  localStorage.setItem('um-visits', JSON.stringify(visits));

  btn.disabled = false;
  btn.innerHTML = '<i class="ti ti-device-floppy"></i> Guardar visita';
  toast('Visita guardada exitosamente.');
  editId = null;
  nav('analysis');
}

// ── CARGAR VISITAS ────────────────────────────────────────
async function loadVisits() {
  if (isConfigured) {
    try {
      const res = await fetch(CONFIG.SCRIPT_URL + '?action=getAll');
      const data = await res.json();
      if (data.ok && data.visits) {
        visits = data.visits;
        localStorage.setItem('um-visits', JSON.stringify(visits));
        renderTable();
        updateMetrics();
        return;
      }
    } catch (e) {
      console.warn('No se pudo cargar desde Sheets, usando caché local.', e);
    }
  }
  // Fallback a localStorage
  const local = localStorage.getItem('um-visits');
  visits = local ? JSON.parse(local) : [];
  renderTable();
  updateMetrics();
}

// ── EDITAR ────────────────────────────────────────────────
function editVisit(id) {
  const v = visits.find(x => x.id === id);
  if (!v) return;
  editId = id;
  populateForm(v);
  nav('form');
}

// ── MÉTRICAS ──────────────────────────────────────────────
function updateMetrics() {
  document.getElementById('hdr-count').textContent = visits.length;
  document.getElementById('m-tot').textContent = visits.length;
  document.getElementById('m-res').textContent = visits.filter(v => v.status === 'Resuelto').length;
  document.getElementById('m-pro').textContent = visits.filter(v => v.status === 'En proceso').length;
  document.getElementById('m-pen').textContent = visits.filter(v => v.status === 'Pendiente').length;
}

// ── TABLA ─────────────────────────────────────────────────
function renderTable() {
  updateMetrics();
  const tb = document.getElementById('tbl-body');
  if (!visits.length) {
    tb.innerHTML = '<tr><td colspan="8"><div class="empty-state">No hay visitas registradas aún. Haga clic en "+ Nueva visita" para comenzar.</div></td></tr>';
    return;
  }
  tb.innerHTML = visits.map(v => {
    const probs = (v.problems || []).slice(0, 3).map(p => `<span class="badge b-red">${p}</span>`).join('');
    const extra = (v.problems || []).length > 3 ? `<span class="badge b-orange">+${(v.problems || []).length - 3} más</span>` : '';
    const acts = (v.acciones || []).slice(0, 2).map(a => `<li>${a.accion}</li>`).join('');
    const sc = v.status === 'Resuelto' ? 'st-r' : v.status === 'En proceso' ? 'st-p' : 'st-n';
    const sat = v.satisfaccion ? '⭐'.repeat(v.satisfaccion) : '—';
    return `<tr>
      <td><span class="code">${v.code}</span></td>
      <td><div class="cl-name">${v.name}</div><div class="cl-sub">${v.type || ''}</div><div class="cl-sub">${v.date || ''}</div></td>
      <td>${v.zone || ''}</td>
      <td style="max-width:180px;font-size:12px;color:#666">${(v.reclamos || v.obs || '').substring(0, 70)}${((v.reclamos || v.obs || '').length > 70 ? '…' : '')}</td>
      <td>${probs}${extra}${!(v.problems || []).length ? '<span style="color:#bbb;font-size:11px">Sin problemas</span>' : ''}</td>
      <td><ul class="act-list">${acts}</ul></td>
      <td><span class="st ${sc}">${v.status}</span><div style="font-size:11px;margin-top:4px">${sat}</div></td>
      <td><button class="edit-btn" onclick="editVisit('${v.id}')"><i class="ti ti-edit"></i> Editar</button></td>
    </tr>`;
  }).join('');
}

// ── GRÁFICOS ──────────────────────────────────────────────
function renderCharts() {
  const el = document.getElementById('charts-inner');
  if (!visits.length) {
    el.innerHTML = '<div class="empty-state" style="background:white;border-radius:8px;padding:48px">No hay datos aún.</div>';
    return;
  }
  const byS = {}, byZ = {}, byP = {}, bySat = [0, 0, 0, 0, 0];
  visits.forEach(v => {
    byS[v.status] = (byS[v.status] || 0) + 1;
    if (v.zone) byZ[v.zone] = (byZ[v.zone] || 0) + 1;
    (v.problems || []).forEach(p => byP[p] = (byP[p] || 0) + 1);
    if (v.satisfaccion >= 1 && v.satisfaccion <= 5) bySat[v.satisfaccion - 1]++;
  });
  const topP = Object.entries(byP).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxP = topP.length ? topP[0][1] : 1;
  const sCols = { 'Resuelto': '#3B6D11', 'En proceso': '#185FA5', 'Pendiente': '#854F0B' };
  const sBars = Object.entries(byS).map(([k, v]) =>
    `<div class="bar-row"><div class="bar-lbl">${k}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.round(v / visits.length * 100)}%;background:${sCols[k] || '#888'}"><span>${v}</span></div></div><div class="bar-pct">${Math.round(v / visits.length * 100)}%</div></div>`
  ).join('');
  const pBars = topP.map(([k, v]) =>
    `<div class="bar-row"><div class="bar-lbl">${k}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.round(v / maxP * 100)}%;background:#B03A2E"><span>${v}</span></div></div></div>`
  ).join('');
  const zCards = Object.entries(byZ).sort((a, b) => b[1] - a[1]).map(([z, c]) =>
    `<div class="zone-card"><div class="zone-num">${c}</div><div class="zone-nm">${z}</div></div>`
  ).join('');
  const satArr = visits.filter(v => v.satisfaccion);
  const satAvg = satArr.length ? (satArr.reduce((s, v) => s + (v.satisfaccion || 0), 0) / satArr.length).toFixed(1) : '—';
  const maxSat = Math.max(...bySat, 1);
  el.innerHTML = `
  <div class="ch-grid">
    <div class="ch-card"><div class="ch-title">Visitas por estado</div>${sBars}</div>
    <div class="ch-card"><div class="ch-title">Visitas por zona</div><div class="zone-grid">${zCards}</div></div>
  </div>
  <div class="ch-grid">
    <div class="ch-card"><div class="ch-title">Problemas más frecuentes</div>${pBars || '<p style="font-size:13px;color:#888">Sin datos</p>'}</div>
    <div class="ch-card">
      <div class="ch-title">Satisfacción del cliente · promedio: ${satAvg}</div>
      <div style="display:flex;gap:8px;align-items:flex-end;height:80px;margin-top:12px">
        ${bySat.map((n, i) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
          <div style="width:100%;background:#D4832A;border-radius:4px 4px 0 0;height:${Math.max(4, Math.round(n / maxSat * 70))}px"></div>
          <span style="font-size:11px;color:#888">${i + 1}★</span>
          <span style="font-size:11px;font-weight:600">${n}</span>
        </div>`).join('')}
      </div>
    </div>
  </div>`;
}
