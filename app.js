// ============================================================
//  APP.JS — Unidos Mayoreo · Sistema de Visitas
// ============================================================
 
const PROBLEMS = [
  'Garantías lentas','Taller lento','Repuestos faltantes','Cobros excesivos',
  'Falta de agente','Horario de retiro','Push money inconsistente','Promesas incumplidas',
  'Notas de crédito pendientes','Comunicación deficiente','Otro'
];
 
// Mismo orden que las opciones del selector de zona en el formulario,
// más "Sin zona" para las visitas sin zona asignada. El orden es fijo
// para que cada zona conserve siempre el mismo color en los gráficos,
// sin importar cómo cambien los filtros o los totales.
const ZONES = ['Heredia','San José','Alajuela','Cartago','Limón','Puntarenas','Guanacaste','Sin zona'];
 
// Paleta categórica validada (contraste + separación para daltonismo).
// El orden de los colores es fijo: cada categoría siempre usa el mismo
// color, la identidad nunca depende del orden en que aparecen las barras.
const CHART_PALETTE = ['#e34948','#eb6834','#2a78d6','#008300','#1baf7a','#4a3aa7','#eda100','#e87ba4'];
 
// Colores de estado reservados (coinciden con los badges .st-r/.st-p/.st-n de la tabla).
const STATUS_COLORS = { 'Pendiente': '#e34948', 'En proceso': '#2a78d6', 'Resuelto': '#008300' };
 
function colorForZone(z) {
  const i = ZONES.indexOf(z);
  return CHART_PALETTE[(i >= 0 ? i : ZONES.length) % CHART_PALETTE.length];
}
function colorForProblem(p) {
  const i = PROBLEMS.indexOf(p);
  return CHART_PALETTE[(i >= 0 ? i : PROBLEMS.length) % CHART_PALETTE.length];
}
 
let visits = [];
let starVal = 0;
let editId = null;
let pendingDeleteId = null;
let currentPhotos = []; // [{dataUrl, isNew:true}] nuevas | [{url, isNew:false}] ya subidas
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
 
// Escapa comillas para poder insertar texto dinámico dentro de atributos
// onclick="..." con comillas simples.
function escAttr(str) {
  return String(str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
 
function escapeXml(s) {
  return String(s).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&apos;', '"': '&quot;' }[c]));
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
  if (p === 'charts') { populateChartFilterOptions(); renderCharts(); }
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
 
// ── EVIDENCIA FOTOGRÁFICA ─────────────────────────────────
function compressImage(file, maxWidth = 1280, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round(height * (maxWidth / width));
          width = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('No se pudo leer la imagen'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}
 
async function handlePhotoSelect(event) {
  const files = Array.from(event.target.files || []);
  for (const file of files) {
    try {
      const dataUrl = await compressImage(file);
      currentPhotos.push({ dataUrl, isNew: true });
    } catch (e) {
      console.error('Error procesando foto:', e);
      toast('No se pudo procesar una de las fotos.', false);
    }
  }
  renderPhotoGrid();
  event.target.value = ''; // permite volver a elegir el mismo archivo
}
 
function renderPhotoGrid() {
  const grid = document.getElementById('photo-grid');
  const empty = document.getElementById('photo-empty');
  if (!currentPhotos.length) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  grid.innerHTML = currentPhotos.map((p, i) => {
    const src = p.isNew ? p.dataUrl : p.url;
    return `<div class="photo-thumb">
      <img src="${src}" onclick="openLightbox('${src.replace(/'/g, "\\'")}')" alt="Evidencia ${i + 1}">
      <button type="button" class="photo-rm" onclick="removePhoto(${i})" title="Quitar foto">×</button>
    </div>`;
  }).join('');
}
 
function removePhoto(i) {
  currentPhotos.splice(i, 1);
  renderPhotoGrid();
}
 
// ── GALERÍA / LIGHTBOX ────────────────────────────────────
let galleryPhotos = [];
let galleryIndex = 0;
 
function openGallery(photos, startIndex = 0) {
  galleryPhotos = photos;
  galleryIndex = startIndex;
  renderGallery();
  document.getElementById('lightbox').classList.add('show');
}
 
function renderGallery() {
  const src = galleryPhotos[galleryIndex];
  const lb = document.getElementById('lightbox');
  const total = galleryPhotos.length;
 
  // Extraer el ID del archivo de Drive para usar la URL de thumbnail
  // que sí funciona en todos los navegadores
  let displaySrc = src;
  let driveFileId = null;
  if (src && src.includes('drive.google.com')) {
    const m = src.match(/[?&]id=([^&]+)/);
    if (m) {
      driveFileId = m[1];
      // URL de thumbnail de Google que funciona en desktop y mobile
      displaySrc = `https://drive.google.com/thumbnail?id=${driveFileId}&sz=w1280`;
    }
  }
 
  const navBtns = `
    <div style="display:flex;align-items:center;gap:16px;margin-top:10px">
      ${total > 1 ? `<button onclick="galleryPrev()" style="background:rgba(255,255,255,.15);border:none;color:white;width:38px;height:38px;border-radius:50%;font-size:20px;cursor:pointer">‹</button>` : ''}
      <span style="color:rgba(255,255,255,.7);font-size:13px">${total > 1 ? `Foto ${galleryIndex + 1} de ${total}` : 'Evidencia fotográfica'}</span>
      ${total > 1 ? `<button onclick="galleryNext()" style="background:rgba(255,255,255,.15);border:none;color:white;width:38px;height:38px;border-radius:50%;font-size:20px;cursor:pointer">›</button>` : ''}
      ${driveFileId ? `<a href="https://drive.google.com/file/d/${driveFileId}/view" target="_blank" rel="noopener" style="background:rgba(255,255,255,.15);color:white;width:38px;height:38px;border-radius:50%;font-size:14px;display:flex;align-items:center;justify-content:center;text-decoration:none" title="Abrir en Drive">↗</a>` : ''}
      <button onclick="closeLightbox()" style="background:rgba(255,255,255,.15);border:none;color:white;width:38px;height:38px;border-radius:50%;font-size:16px;cursor:pointer">✕</button>
    </div>`;
 
  lb.innerHTML = `
    <div onclick="event.stopPropagation()" style="position:relative;max-width:92vw;max-height:90vh;display:flex;flex-direction:column;align-items:center">
      <img id="gallery-img" src="${displaySrc}" alt="Evidencia ${galleryIndex + 1}"
        style="max-width:88vw;max-height:78vh;border-radius:8px;object-fit:contain;box-shadow:0 8px 32px rgba(0,0,0,.5)"
        onerror="document.getElementById('gallery-img').style.display='none';document.getElementById('gallery-fallback').style.display='flex'">
      <div id="gallery-fallback" style="display:none;background:#1e1e1e;border-radius:8px;padding:40px 60px;text-align:center;flex-direction:column;align-items:center;gap:14px">
        <div style="font-size:48px">🖼️</div>
        <div style="color:white;font-size:15px">No se puede mostrar la imagen aquí</div>
        ${driveFileId
          ? `<a href="https://drive.google.com/file/d/${driveFileId}/view" target="_blank" rel="noopener"
               style="background:#D4832A;color:white;padding:10px 22px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px">
               ↗ Abrir foto en Drive
             </a>`
          : `<a href="${src}" target="_blank" rel="noopener"
               style="background:#D4832A;color:white;padding:10px 22px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px">
               ↗ Abrir foto
             </a>`
        }
      </div>
      ${navBtns}
    </div>`; 
}
 
function galleryPrev() {
  galleryIndex = (galleryIndex - 1 + galleryPhotos.length) % galleryPhotos.length;
  renderGallery();
}
 
function galleryNext() {
  galleryIndex = (galleryIndex + 1) % galleryPhotos.length;
  renderGallery();
}
 
function openLightbox(src) {
  openGallery([src], 0);
}
 
function closeLightbox() {
  document.getElementById('lightbox').classList.remove('show');
  document.getElementById('lightbox').innerHTML = '';
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
  currentPhotos = [];
  renderPhotoGrid();
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
  currentPhotos = (v.fotos || []).filter(Boolean).map(url => ({ url, isNew: false }));
  renderPhotoGrid();
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
    fotos: currentPhotos.map(p => p.isNew ? p.dataUrl : p.url),
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
      // Reemplaza las fotos base64 locales por las URLs reales de Drive
      if (data.fotos) v.fotos = data.fotos;
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
  const v = visits.find(x => String(x.id) === String(id));
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
    tb.innerHTML = '<tr><td colspan="9"><div class="empty-state">No hay visitas registradas aún. Haga clic en "+ Nueva visita" para comenzar.</div></td></tr>';
    return;
  }
  tb.innerHTML = visits.map(v => {
    const probs = (v.problems || []).slice(0, 3).map(p => `<span class="badge b-red">${p}</span>`).join('');
    const extra = (v.problems || []).length > 3 ? `<span class="badge b-orange">+${(v.problems || []).length - 3} más</span>` : '';
    const acts = (v.acciones || []).slice(0, 2).map(a => `<li>${a.accion}</li>`).join('');
    const sc = v.status === 'Resuelto' ? 'st-r' : v.status === 'En proceso' ? 'st-p' : 'st-n';
    const sat = v.satisfaccion ? '⭐'.repeat(v.satisfaccion) : '—';
    const nFotos = (v.fotos || []).filter(Boolean).length;
    const fotosCell = nFotos
      ? `<span class="badge" style="background:#E6F1FB;color:#185FA5;cursor:pointer" onclick="viewVisitPhotos('${v.id}')"><i class="ti ti-camera"></i> ${nFotos}</span>`
      : '<span style="color:#bbb;font-size:11px">—</span>';
    return `<tr>
      <td><span class="code">${v.code}</span></td>
      <td><div class="cl-name">${v.name}</div><div class="cl-sub">${v.type || ''}</div><div class="cl-sub">${v.date || ''}</div></td>
      <td>${v.zone || ''}</td>
      <td style="max-width:180px;font-size:12px;color:#666">${(v.reclamos || v.obs || '').substring(0, 70)}${((v.reclamos || v.obs || '').length > 70 ? '…' : '')}</td>
      <td>${probs}${extra}${!(v.problems || []).length ? '<span style="color:#bbb;font-size:11px">Sin problemas</span>' : ''}</td>
      <td><ul class="act-list">${acts}</ul></td>
      <td>${fotosCell}</td>
      <td><span class="st ${sc}">${v.status}</span><div style="font-size:11px;margin-top:4px">${sat}</div></td>
      <td><div class="row-actions">
        <button class="edit-btn" onclick="editVisit('${v.id}')"><i class="ti ti-edit"></i> Editar</button>
        <button class="del-btn" onclick="confirmDeleteVisit('${v.id}','${escAttr(v.name)}')"><i class="ti ti-trash"></i> Eliminar</button>
      </div></td>
    </tr>`;
  }).join('');
}
 
// ── ELIMINAR VISITA ───────────────────────────────────────
function confirmDeleteVisit(id, name) {
  pendingDeleteId = id;
  document.getElementById('confirm-modal-msg').textContent =
    `Se eliminará permanentemente la visita de "${name}". Esta acción no se puede deshacer.`;
  const btn = document.getElementById('confirm-modal-btn');
  btn.disabled = false;
  btn.innerHTML = '<i class="ti ti-trash"></i> Eliminar';
  btn.onclick = () => deleteVisit(id);
  document.getElementById('confirm-modal').classList.add('show');
}
 
function hideConfirmModal() {
  document.getElementById('confirm-modal').classList.remove('show');
  pendingDeleteId = null;
}
 
async function deleteVisit(id) {
  const btn = document.getElementById('confirm-modal-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Eliminando...';
 
  if (isConfigured) {
    try {
      const res = await fetch(CONFIG.SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'delete', id })
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Error desconocido');
    } catch (e) {
      toast('No se pudo eliminar en Google Sheets: ' + e.message, false);
      btn.disabled = false;
      btn.innerHTML = '<i class="ti ti-trash"></i> Eliminar';
      return;
    }
  }
 
  visits = visits.filter(v => String(v.id) !== String(id));
  localStorage.setItem('um-visits', JSON.stringify(visits));
  hideConfirmModal();
  renderTable();
  toast('Visita eliminada correctamente.');
}
 
// ── VER FOTOS DE UNA VISITA (desde la tabla) ──────────────
function viewVisitPhotos(id) {
  const v = visits.find(x => String(x.id) === String(id));
  const fotos = (v && v.fotos || []).filter(Boolean);
  if (!fotos.length) return;
  openGallery(fotos, 0);
}
 
// ── FILTROS DE GRÁFICOS ───────────────────────────────────
function populateChartFilterOptions() {
  const zones = [...new Set(visits.map(v => v.zone).filter(Boolean))].sort();
  const agents = [...new Set(visits.map(v => v.agent).filter(Boolean))].sort();
  const problems = [...new Set(visits.flatMap(v => v.problems || []))].sort();
  const fill = (id, arr) => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">— Todos —</option>' +
      arr.map(x => `<option ${x === current ? 'selected' : ''}>${x}</option>`).join('');
  };
  fill('cf-zone', zones);
  fill('cf-agent', agents);
  fill('cf-problem', problems);
}
 
function getChartFilters() {
  return {
    start: document.getElementById('cf-date-start').value,
    end: document.getElementById('cf-date-end').value,
    status: document.getElementById('cf-status').value,
    zone: document.getElementById('cf-zone').value,
    problem: document.getElementById('cf-problem').value,
    agent: document.getElementById('cf-agent').value
  };
}
 
function applyChartFilters() {
  const f = getChartFilters();
  const filtered = visits.filter(v => {
    if (f.start && v.date < f.start) return false;
    if (f.end && v.date > f.end) return false;
    if (f.status && v.status !== f.status) return false;
    if (f.zone && v.zone !== f.zone) return false;
    if (f.problem && !(v.problems || []).includes(f.problem)) return false;
    if (f.agent && v.agent !== f.agent) return false;
    return true;
  });
  renderCharts(filtered);
}
 
function resetChartFilters() {
  ['cf-date-start', 'cf-date-end', 'cf-status', 'cf-zone', 'cf-problem', 'cf-agent']
    .forEach(id => { document.getElementById(id).value = ''; });
  renderCharts();
}
 
// ── GRÁFICOS DE BARRAS (SVG, con eje y grillas) ───────────
// Calcula un máximo "redondo" para el eje (ej: 0,5,10...35) dejando
// aire después del valor más alto, igual que en el dashboard de referencia.
function niceAxis(maxVal) {
  if (maxVal <= 0) return { axisMax: 5, step: 1 };
  const rough = maxVal / 6;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  let step;
  if (norm <= 1) step = 1 * mag;
  else if (norm <= 2) step = 2 * mag;
  else if (norm <= 5) step = 5 * mag;
  else step = 10 * mag;
  let axisMax = Math.ceil((maxVal * 1.15) / step) * step;
  if (axisMax <= maxVal) axisMax += step;
  return { axisMax, step };
}
 
// Genera un gráfico de barras horizontales en SVG: eje numérico con
// grillas verticales, barra por categoría con extremo redondeado y
// etiqueta de valor (y % opcional) justo después de la punta de la barra.
// Estimación aproximada del ancho de un texto en SVG (evita medir con
// el DOM real, suficiente para reservar espacio y no cortar etiquetas).
function estTextWidth(s, size = 12) {
  return String(s).length * size * 0.56;
}
 
function hBarChartSVG(items) {
  if (!items.length) return '<p style="font-size:13px;color:#888">Sin datos</p>';
  const W = 520, rowH = 30, barH = 18, topPad = 8, axisLblH = 20;
  // El ancho de la columna de etiquetas y del margen derecho se calculan
  // según el texto más largo, para que ninguna etiqueta quede cortada.
  const labelW = Math.min(210, Math.max(90, Math.round(Math.max(...items.map(i => estTextWidth(i.label))) + 24)));
  const rightPad = Math.min(120, Math.max(60, Math.round(Math.max(...items.map(i =>
    estTextWidth(i.pct != null ? `${i.value} (${i.pct}%)` : `${i.value}`, 12)
  )) + 24)));
  const plotW = W - labelW - rightPad;
  const maxVal = Math.max(...items.map(i => i.value), 1);
  const { axisMax, step } = niceAxis(maxVal);
  const baseY = topPad + items.length * rowH;
  const H = baseY + axisLblH + 6;
  const xScale = v => (v / axisMax) * plotW;
 
  const ticks = [];
  for (let t = 0; t <= axisMax + 1e-6; t += step) ticks.push(Math.round(t * 100) / 100);
 
  const gridlines = ticks.map(t => {
    const x = (labelW + xScale(t)).toFixed(1);
    return `<line x1="${x}" y1="${topPad - 2}" x2="${x}" y2="${(baseY + 2).toFixed(1)}" stroke="#e6e4de" stroke-width="1"/>`;
  }).join('');
 
  const axisLabels = ticks.map(t => {
    const x = (labelW + xScale(t)).toFixed(1);
    return `<text x="${x}" y="${(baseY + 16).toFixed(1)}" font-size="10.5" fill="#8b8a84" text-anchor="middle">${t}</text>`;
  }).join('');
 
  const baseline = `<line x1="${labelW}" y1="${(baseY + 2).toFixed(1)}" x2="${(labelW + plotW).toFixed(1)}" y2="${(baseY + 2).toFixed(1)}" stroke="#c9c7c0" stroke-width="1"/>`;
 
  const bars = items.map((it, i) => {
    const y = topPad + i * rowH + (rowH - barH) / 2;
    const w = Math.max(2, xScale(it.value));
    const midY = (y + barH / 2 + 4).toFixed(1);
    const valText = it.pct != null ? `${it.value} (${it.pct}%)` : `${it.value}`;
    return `<text x="${labelW - 10}" y="${midY}" font-size="12" fill="#54524c" text-anchor="end">${escapeXml(it.label)}</text>` +
      `<rect x="${labelW}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${barH}" rx="4" fill="${it.color}"/>` +
      `<text x="${(labelW + w + 8).toFixed(1)}" y="${midY}" font-size="12" font-weight="700" fill="#1a1a1a">${valText}</text>`;
  }).join('');
 
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" style="display:block;font-family:inherit">${gridlines}${baseline}${bars}${axisLabels}</svg>`;
}
 
function renderCharts(list) {
  const data = list || visits;
  const cfCount = document.getElementById('cf-count');
  if (cfCount) cfCount.textContent = `Mostrando ${data.length} de ${visits.length} visitas`;
 
  const el = document.getElementById('charts-inner');
  if (!data.length) {
    el.innerHTML = '<div class="empty-state" style="background:white;border-radius:8px;padding:48px">No hay datos para los filtros seleccionados.</div>';
    return;
  }
  const byS = {}, byZ = {}, byP = {}, bySat = [0, 0, 0, 0, 0];
  data.forEach(v => {
    byS[v.status] = (byS[v.status] || 0) + 1;
    const z = (v.zone || '').trim() || 'Sin zona';
    byZ[z] = (byZ[z] || 0) + 1;
    (v.problems || []).forEach(p => byP[p] = (byP[p] || 0) + 1);
    if (v.satisfaccion >= 1 && v.satisfaccion <= 5) bySat[v.satisfaccion - 1]++;
  });
 
  const sItems = Object.entries(byS).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({
    label: k, value: v, pct: Math.round(v / data.length * 1000) / 10, color: STATUS_COLORS[k] || '#8b8a84'
  }));
  const zItems = Object.entries(byZ).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({
    label: k, value: v, pct: Math.round(v / data.length * 1000) / 10, color: colorForZone(k)
  }));
  const pItems = Object.entries(byP).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => ({
    label: k, value: v, color: colorForProblem(k)
  }));
 
  const satArr = data.filter(v => v.satisfaccion);
  const satAvg = satArr.length ? (satArr.reduce((s, v) => s + (v.satisfaccion || 0), 0) / satArr.length).toFixed(1) : '—';
  const maxSat = Math.max(...bySat, 1);
 
  el.innerHTML = `
  <div class="ch-grid">
    <div class="ch-card"><div class="ch-title">Visitas por estado</div>${hBarChartSVG(sItems)}</div>
    <div class="ch-card"><div class="ch-title">Visitas por zona</div>${hBarChartSVG(zItems)}</div>
  </div>
  <div class="ch-grid">
    <div class="ch-card"><div class="ch-title">Problemas más frecuentes</div>${hBarChartSVG(pItems)}</div>
    <div class="ch-card">
      <div class="ch-title">Satisfacción del cliente · promedio: ${satAvg}</div>
      <div style="display:flex;gap:8px;align-items:flex-end;height:80px;margin-top:12px">
        ${bySat.map((n, i) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
          <div style="width:100%;background:#eda100;border-radius:4px 4px 0 0;height:${Math.max(4, Math.round(n / maxSat * 70))}px"></div>
          <span style="font-size:11px;color:#8b8a84">${i + 1}★</span>
          <span style="font-size:11px;font-weight:600">${n}</span>
        </div>`).join('')}
      </div>
    </div>
  </div>`;
}
