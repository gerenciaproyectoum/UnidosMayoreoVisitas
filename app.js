// ============================================================
//  APP.JS — Unidos Mayoreo · Supabase Edition
// ============================================================

// ── SUPABASE CLIENT ───────────────────────────────────────
const sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

// ── STATE ─────────────────────────────────────────────────
const PROBLEMS = [
  'Garantías lentas','Taller lento','Repuestos faltantes','Cobros excesivos',
  'Falta de agente','Horario de retiro','Push money inconsistente','Promesas incumplidas',
  'Notas de crédito pendientes','Comunicación deficiente','Otro'
];

let visits = [];
let usuarios = [];
let clientes = [];
let currentUser = null;
let currentProfile = null;
let starVal = 0;
let editId = null;
let currentPhotos = [];
let galleryPhotos = [];
let galleryIndex = 0;
let galleryClientName = '';

// ── INIT ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  showLoading('Iniciando sesión...');
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    await initApp(session.user);
  } else {
    hideLoading();
    showLogin();
  }

  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      await initApp(session.user);
    } else if (event === 'SIGNED_OUT') {
      showLogin();
    }
  });
});

async function initApp(user) {
  showLoading('Cargando...');
  currentUser = user;
  // Load profile
  const { data: profile } = await sb.from('usuarios').select('*').eq('id', user.id).single();
  currentProfile = profile;

  if (!profile || !profile.activo) {
    await sb.auth.signOut();
    hideLoading();
    showLoginError('Tu cuenta está inactiva. Contacta al administrador.');
    showLogin();
    return;
  }

  // Update UI chips
  document.getElementById('user-avatar').textContent = profile.nombre.charAt(0).toUpperCase();
  document.getElementById('user-name-chip').textContent = profile.nombre;
  document.getElementById('user-rol-chip').textContent = '· ' + rolLabel(profile.rol);

  // Show/hide admin nav
  const isAdmin = profile.rol === 'administrador';
  const isSupervisor = profile.rol === 'supervisor';
  document.getElementById('btn-nav-admin').style.display = (isAdmin || isSupervisor) ? '' : 'none';
  document.getElementById('nav-admin-sep').style.display = (isAdmin || isSupervisor) ? '' : 'none';

  // Hide "nueva visita" for lectura role
  if (profile.rol === 'lectura') {
    document.getElementById('btn-nueva-visita').style.display = 'none';
    document.getElementById('btn-nueva-visita2').style.display = 'none';
  }

  document.getElementById('login-page').style.display = 'none';
  document.getElementById('app-page').style.display = 'block';

  await Promise.all([loadVisits(), loadClientes(), loadAgentes()]);
  buildPills();
  document.getElementById('f-date').value = today();
  addPedido();
  addAccion();
  hideLoading();
}

function showLogin() {
  document.getElementById('login-page').style.display = 'block';
  document.getElementById('app-page').style.display = 'none';
}

function showLoginError(msg) {
  const el = document.getElementById('login-err');
  el.textContent = msg;
  el.classList.add('show');
}

// ── AUTH ──────────────────────────────────────────────────
async function doLogin() {
  const email = document.getElementById('l-email').value.trim();
  const pass = document.getElementById('l-pass').value;
  const btn = document.getElementById('login-btn');
  const err = document.getElementById('login-err');
  err.classList.remove('show');
  if (!email || !pass) { err.textContent = 'Ingresa tu correo y contraseña.'; err.classList.add('show'); return; }
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Ingresando...';
  const { error } = await sb.auth.signInWithPassword({ email, password: pass });
  if (error) {
    err.textContent = 'Correo o contraseña incorrectos.';
    err.classList.add('show');
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-login"></i> Ingresar';
  }
}

async function doLogout() {
  await sb.auth.signOut();
  currentUser = null;
  currentProfile = null;
  visits = [];
}

// ── UTILIDADES ────────────────────────────────────────────
function today() { return new Date().toISOString().split('T')[0]; }

function toast(msg, ok = true) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.background = ok ? '#1E8449' : '#922B21';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}

function showLoading(msg = 'Cargando...') {
  document.getElementById('loading-msg').textContent = msg;
  document.getElementById('loading').classList.add('show');
}
function hideLoading() { document.getElementById('loading').classList.remove('show'); }

function openModal(id) { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }

function rolLabel(rol) {
  return { administrador: 'Administrador', supervisor: 'Supervisor', agente: 'Agente', lectura: 'Solo lectura' }[rol] || rol;
}

function rolBadge(rol) {
  return `<span class="rol-badge rol-${rol}">${rolLabel(rol)}</span>`;
}

function setStar(n) {
  starVal = n;
  document.getElementById('f-sat').value = n;
  document.querySelectorAll('.star').forEach((s, i) => s.classList.toggle('on', i < n));
}

// ── NAVEGACIÓN ────────────────────────────────────────────
function nav(p) {
  document.querySelectorAll('.page').forEach(e => e.classList.remove('active'));
  document.querySelectorAll('.nav button').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + p).classList.add('active');
  const navMap = { analysis: 0, charts: 1, form: 2, admin: 3 };
  const navBtns = document.querySelectorAll('.nav button');
  if (navMap[p] !== undefined && navBtns[navMap[p]]) navBtns[navMap[p]].classList.add('active');
  if (p === 'analysis') renderTable();
  if (p === 'charts') { populateChartFilterOptions(); renderCharts(); }
  if (p === 'form' && !editId) resetForm();
  if (p === 'admin-users') { loadUsuarios(); }
  if (p === 'admin-clients') { renderClientsTable(); }
}

// ── PILLS ─────────────────────────────────────────────────
function buildPills() {
  document.getElementById('pills-group').innerHTML = PROBLEMS
    .map(p => `<span class="pill" data-p="${p}" onclick="this.classList.toggle('on')">${p}</span>`).join('');
}
function getProblems() {
  return Array.from(document.querySelectorAll('#pills-group .pill.on')).map(p => p.dataset.p);
}

// ── DYNAMIC ROWS ──────────────────────────────────────────
function addPedido(data = {}) {
  const id = 'pd' + Date.now() + Math.random();
  const div = document.createElement('div');
  div.className = 'dyn-row dyn-row-3'; div.id = id;
  div.innerHTML = `<input type="text" placeholder="Ej: Discos diamante" value="${data.cat||''}">
    <input type="number" placeholder="0" value="${data.monto||''}">
    <input type="text" placeholder="Observación" value="${data.obs||''}">
    <button class="btn-rm" onclick="document.getElementById('${id}').remove()">×</button>`;
  document.getElementById('pedido-rows').appendChild(div);
}

function addAccion(data = {}) {
  const id = 'ac' + Date.now() + Math.random();
  const div = document.createElement('div');
  div.className = 'dyn-row dyn-row-4'; div.id = id;
  div.innerHTML = `<input type="text" placeholder="Describir acción" value="${data.accion||''}">
    <input type="text" placeholder="Responsable" value="${data.resp||''}">
    <input type="date" value="${data.fecha||''}">
    <select><option ${data.prio==='Alta'?'selected':''}>Alta</option><option ${data.prio==='Media'?'selected':''}>Media</option><option ${data.prio==='Baja'?'selected':''}>Baja</option></select>
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

// ── FOTOS ─────────────────────────────────────────────────
function compressImage(file, maxWidth = 1280, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth) { height = Math.round(height * maxWidth / width); width = maxWidth; }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('No se pudo leer la imagen'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Error leyendo archivo'));
    reader.readAsDataURL(file);
  });
}

async function handlePhotoSelect(event) {
  const files = Array.from(event.target.files || []);
  for (const file of files) {
    try {
      const dataUrl = await compressImage(file);
      currentPhotos.push({ dataUrl, isNew: true, file });
    } catch(e) { toast('No se pudo procesar una foto.', false); }
  }
  renderPhotoGrid();
  event.target.value = '';
}

function renderPhotoGrid() {
  const grid = document.getElementById('photo-grid');
  const empty = document.getElementById('photo-empty');
  if (!currentPhotos.length) { grid.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  grid.innerHTML = currentPhotos.map((p, i) => {
    const src = p.isNew ? p.dataUrl : p.url;
    return `<div class="photo-thumb">
      <img src="${src}" onclick="openLightbox('${src.replace(/'/g,"\\'")}')" alt="Foto ${i+1}">
      <button type="button" class="photo-rm" onclick="removePhoto(${i})">×</button>
    </div>`;
  }).join('');
}

function removePhoto(i) { currentPhotos.splice(i, 1); renderPhotoGrid(); }

async function uploadPhotosToSupabase(visitId) {
  const urls = [];
  for (const p of currentPhotos) {
    if (!p.isNew) { urls.push(p.url); continue; }
    try {
      const base64 = p.dataUrl.split(',')[1];
      const mime = p.dataUrl.match(/data:(image\/[^;]+)/)[1];
      const ext = mime.split('/')[1];
      const fileName = `${visitId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const byteArr = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      const blob = new Blob([byteArr], { type: mime });
      const { data, error } = await sb.storage.from(CONFIG.STORAGE_BUCKET).upload(fileName, blob, { contentType: mime, upsert: false });
      if (error) throw error;
      const { data: { publicUrl } } = sb.storage.from(CONFIG.STORAGE_BUCKET).getPublicUrl(fileName);
      urls.push(publicUrl);
    } catch(e) { console.error('Error subiendo foto:', e); toast('No se pudo subir una foto.', false); }
  }
  return urls;
}

// ── GALERÍA / LIGHTBOX ────────────────────────────────────
function openGallery(photos, startIndex = 0, clientName = '') {
  galleryPhotos = photos; galleryIndex = startIndex; galleryClientName = clientName;
  renderGallery();
  document.getElementById('lightbox').classList.add('show');
  document.addEventListener('keydown', galleryKeyHandler);
}

function galleryKeyHandler(e) {
  if (e.key === 'ArrowLeft') galleryPrev();
  else if (e.key === 'ArrowRight') galleryNext();
  else if (e.key === 'Escape') closeLightbox();
}

function renderGallery() {
  const src = galleryPhotos[galleryIndex];
  const lb = document.getElementById('lightbox');
  const total = galleryPhotos.length;
  const strip = total > 1 ? `<div class="lb-strip">${galleryPhotos.map((p,i) =>
    `<div class="lb-thumb ${i===galleryIndex?'active':''}" onclick="galleryGoto(${i})"><img src="${p}" alt="Foto ${i+1}" onerror="this.parentElement.innerHTML='📷'"></div>`
  ).join('')}</div>` : '';
  lb.innerHTML = `<div onclick="event.stopPropagation()" style="display:flex;flex-direction:column;align-items:center;width:100%;max-width:900px">
    <div class="lb-header">
      <div class="lb-title"><i class="ti ti-camera"></i> Evidencia fotográfica${galleryClientName?' · '+galleryClientName:''}</div>
      <button class="lb-close" onclick="closeLightbox()">✕</button>
    </div>
    <div class="lb-main">
      ${total>1?`<button class="lb-nav lb-prev" onclick="galleryPrev()">‹</button>`:''}
      <div class="lb-img-wrap">
        <img id="gallery-img" src="${src}" alt="Evidencia ${galleryIndex+1}"
          onerror="document.getElementById('gallery-img').style.display='none';document.getElementById('lb-fall').style.display='flex'">
        <div id="lb-fall" class="lb-fallback"><div style="font-size:48px">🖼️</div><p style="color:rgba(255,255,255,.7)">No se puede mostrar</p><a href="${src}" target="_blank" rel="noopener" style="background:#D4832A;color:white;padding:8px 18px;border-radius:6px;text-decoration:none;font-weight:600">↗ Abrir</a></div>
      </div>
      ${total>1?`<button class="lb-nav lb-next" onclick="galleryNext()">›</button>`:''}
    </div>
    <div class="lb-counter">${total>1?`Foto ${galleryIndex+1} de ${total}`:''}</div>
    ${strip}
  </div>`;
}

function galleryGoto(i) { galleryIndex=i; renderGallery(); }
function galleryPrev() { galleryIndex=(galleryIndex-1+galleryPhotos.length)%galleryPhotos.length; renderGallery(); }
function galleryNext() { galleryIndex=(galleryIndex+1)%galleryPhotos.length; renderGallery(); }
function openLightbox(src) { openGallery([src],0); }
function closeLightbox() {
  document.getElementById('lightbox').classList.remove('show');
  document.getElementById('lightbox').innerHTML='';
  document.removeEventListener('keydown', galleryKeyHandler);
}
function handleLightboxBackdropClick(e) { if(e.target===document.getElementById('lightbox')) closeLightbox(); }

// ── CARGAR AGENTES ────────────────────────────────────────
async function loadAgentes() {
  const { data } = await sb.from('usuarios').select('id,nombre,rol').eq('activo', true).order('nombre');
  const agentes = (data || []).filter(u => u.rol === 'agente' || u.rol === 'supervisor');
  const sel = document.getElementById('f-agent');
  sel.innerHTML = '<option value="">— Seleccionar agente —</option>' +
    agentes.map(a => `<option value="${a.nombre}">${a.nombre}</option>`).join('');
  // Pre-select if current user is agente
  if (currentProfile && (currentProfile.rol === 'agente')) {
    sel.value = currentProfile.nombre;
    sel.disabled = true;
  }
}

// ── CARGAR CLIENTES ───────────────────────────────────────
async function loadClientes() {
  const { data } = await sb.from('clientes').select('*').eq('activo', true).order('nombre');
  clientes = data || [];
  populateClientSelect();
}

function populateClientSelect() {
  const sel = document.getElementById('f-client-select');
  sel.innerHTML = '<option value="">— Buscar en catálogo —</option>' +
    clientes.map(c => `<option value="${c.id}">${c.codigo} · ${c.nombre}</option>`).join('');
}

function fillClientData(clientId) {
  if (!clientId) return;
  const c = clientes.find(x => String(x.id) === String(clientId));
  if (!c) return;
  document.getElementById('f-code').value = c.codigo || '';
  document.getElementById('f-name').value = c.nombre || '';
  document.getElementById('f-type').value = c.tipo || '';
  document.getElementById('f-zone').value = c.zona || '';
  document.getElementById('f-contact').value = c.contacto || '';
  document.getElementById('f-phone').value = c.telefono || '';
}

// ── CARGAR VISITAS ────────────────────────────────────────
async function loadVisits() {
  let query = sb.from('visitas').select('*').order('created_at', { ascending: false });
  // Agentes solo ven sus visitas
  if (currentProfile && currentProfile.rol === 'agente') {
    query = query.eq('agent_id', currentUser.id);
  }
  const { data, error } = await query;
  if (error) { toast('Error cargando visitas.', false); return; }
  visits = data || [];
  renderTable();
  updateMetrics();
}

// ── TABLA ─────────────────────────────────────────────────
function updateMetrics() {
  document.getElementById('hdr-count').textContent = visits.length;
  document.getElementById('m-tot').textContent = visits.length;
  document.getElementById('m-res').textContent = visits.filter(v => v.status === 'Resuelto').length;
  document.getElementById('m-pro').textContent = visits.filter(v => v.status === 'En proceso').length;
  document.getElementById('m-pen').textContent = visits.filter(v => v.status === 'Pendiente').length;
}

function renderTable() {
  updateMetrics();
  const tb = document.getElementById('tbl-body');
  if (!visits.length) { tb.innerHTML = '<tr><td colspan="9"><div class="empty-state">No hay visitas registradas.</div></td></tr>'; return; }
  const canEdit = currentProfile && currentProfile.rol !== 'lectura';
  tb.innerHTML = visits.map(v => {
    const probs = (v.problems || []).slice(0,3).map(p => `<span class="badge b-red">${p}</span>`).join('');
    const extra = (v.problems||[]).length>3 ? `<span class="badge b-orange">+${(v.problems||[]).length-3}</span>` : '';
    const acts = (v.acciones||[]).slice(0,2).map(a=>`<li>${a.accion}</li>`).join('');
    const sc = v.status==='Resuelto'?'st-r':v.status==='En proceso'?'st-p':'st-n';
    const sat = v.satisfaccion ? '⭐'.repeat(v.satisfaccion) : '—';
    const nFotos = (v.fotos||[]).filter(Boolean).length;
    const fotosCell = nFotos
      ? `<span class="foto-badge" onclick="viewVisitPhotos('${v.id}')" title="Ver ${nFotos} foto(s)"><i class="ti ti-camera"></i> ${nFotos} foto${nFotos>1?'s':''}</span>`
      : '<span class="foto-none">—</span>';
    const editBtn = canEdit ? `<button class="edit-btn" onclick="editVisit('${v.id}')"><i class="ti ti-edit"></i> Editar</button>` : '';
    return `<tr>
      <td><span class="code">${v.code||''}</span></td>
      <td><div class="cl-name">${v.name||''}</div><div class="cl-sub">${v.type||''}</div><div class="cl-sub">${v.date||''}</div></td>
      <td>${v.zone||''}</td>
      <td style="max-width:160px;font-size:12px;color:#666">${(v.reclamos||v.obs||'').substring(0,70)}${(v.reclamos||v.obs||'').length>70?'…':''}</td>
      <td>${probs}${extra}${!(v.problems||[]).length?'<span style="color:#bbb;font-size:11px">Sin problemas</span>':''}</td>
      <td><ul class="act-list">${acts}</ul></td>
      <td>${fotosCell}</td>
      <td><span class="st ${sc}">${v.status}</span><div style="font-size:11px;margin-top:4px">${sat}</div></td>
      <td>${editBtn}</td>
    </tr>`;
  }).join('');
}

function viewVisitPhotos(id) {
  const v = visits.find(x => String(x.id) === String(id));
  const fotos = (v && v.fotos || []).filter(Boolean);
  if (!fotos.length) return;
  openGallery(fotos, 0, v.name || '');
}

// ── FORMULARIO ────────────────────────────────────────────
function resetForm() {
  editId = null; starVal = 0;
  document.getElementById('form-ttl').textContent = 'Registrar nueva visita';
  document.getElementById('f-eid').value = '';
  ['f-date','f-zone','f-code','f-name','f-type','f-contact','f-phone',
   'f-dias','f-mora','f-fact','f-nc','f-dev','f-reclamos','f-competencia','f-garantia',
   'f-pop','f-obs','f-pedido-realizado','f-nextv','f-comments','f-firma'].forEach(id => {
    const el = document.getElementById(id); if(el) el.value='';
  });
  document.getElementById('f-date').value = today();
  document.getElementById('f-sat').value = 0;
  document.getElementById('f-client-select').value = '';
  document.querySelectorAll('.star').forEach(s => s.classList.remove('on'));
  document.getElementById('pedido-rows').innerHTML = '';
  document.getElementById('accion-rows').innerHTML = '';
  currentPhotos = [];
  renderPhotoGrid();
  buildPills();
  addPedido(); addAccion();
  // Pre-select agente
  if (currentProfile && currentProfile.rol === 'agente') {
    document.getElementById('f-agent').value = currentProfile.nombre;
  }
}

function populateForm(v) {
  document.getElementById('form-ttl').textContent = 'Editar visita';
  document.getElementById('f-eid').value = v.id;
  const set = (id, val) => { const e=document.getElementById(id); if(e&&val!==undefined&&val!==null) e.value=val||''; };
  set('f-date',v.date); set('f-agent',v.agent); set('f-zone',v.zone);
  set('f-code',v.code); set('f-name',v.name); set('f-type',v.type);
  set('f-contact',v.contact); set('f-phone',v.phone);
  set('f-dias',v.dias); set('f-mora',v.mora); set('f-fact',v.fact);
  set('f-nc',v.nc); set('f-dev',v.dev);
  set('f-reclamos',v.reclamos); set('f-competencia',v.competencia);
  set('f-garantia',v.garantia); set('f-pop',v.pop); set('f-obs',v.obs);
  set('f-pedido-realizado',v.pedido_realizado); set('f-nextv',v.nextv);
  set('f-comments',v.comments); set('f-firma',v.firma);
  setStar(v.satisfaccion || 0);
  buildPills();
  (v.problems || []).forEach(p => {
    const el = document.querySelector(`#pills-group [data-p="${p}"]`);
    if(el) el.classList.add('on');
  });
  document.getElementById('pedido-rows').innerHTML='';
  (v.pedidos||[]).forEach(p=>addPedido(p));
  if(!(v.pedidos||[]).length) addPedido();
  document.getElementById('accion-rows').innerHTML='';
  (v.acciones||[]).forEach(a=>addAccion(a));
  if(!(v.acciones||[]).length) addAccion();
  currentPhotos = (v.fotos||[]).filter(Boolean).map(url=>({url,isNew:false}));
  renderPhotoGrid();
}

// ── GUARDAR VISITA ────────────────────────────────────────
async function saveVisit() {
  const code = document.getElementById('f-code').value.trim();
  const name = document.getElementById('f-name').value.trim();
  const date = document.getElementById('f-date').value;
  if (!code || !name || !date) { toast('Código, nombre y fecha son obligatorios.', false); return; }

  const btn = document.getElementById('save-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Guardando...';

  const visitId = editId || Date.now().toString();
  // Upload photos
  showLoading('Subiendo fotos...');
  const fotosUrls = await uploadPhotosToSupabase(visitId);
  hideLoading();

  const v = {
    id: visitId,
    code, name, date,
    agent: document.getElementById('f-agent').value.trim(),
    agent_id: currentUser.id,
    zone: document.getElementById('f-zone').value,
    type: document.getElementById('f-type').value,
    contact: document.getElementById('f-contact').value.trim(),
    phone: document.getElementById('f-phone').value.trim(),
    dias: parseInt(document.getElementById('f-dias').value)||null,
    mora: parseFloat(document.getElementById('f-mora').value)||null,
    fact: parseInt(document.getElementById('f-fact').value)||null,
    nc: parseInt(document.getElementById('f-nc').value)||null,
    dev: parseInt(document.getElementById('f-dev').value)||null,
    problems: getProblems(),
    reclamos: document.getElementById('f-reclamos').value.trim(),
    competencia: document.getElementById('f-competencia').value.trim(),
    garantia: document.getElementById('f-garantia').value.trim(),
    pop: document.getElementById('f-pop').value.trim(),
    obs: document.getElementById('f-obs').value.trim(),
    pedidos: getPedidos(),
    acciones: getAcciones(),
    fotos: fotosUrls,
    pedido_realizado: document.getElementById('f-pedido-realizado').value,
    satisfaccion: parseInt(document.getElementById('f-sat').value)||null,
    nextv: document.getElementById('f-nextv').value||null,
    comments: document.getElementById('f-comments').value.trim(),
    firma: document.getElementById('f-firma').value.trim(),
    status: editId ? (visits.find(x=>x.id===editId)||{}).status||'Pendiente' : 'Pendiente',
  };

  let error;
  if (editId) {
    ({ error } = await sb.from('visitas').update(v).eq('id', editId));
  } else {
    ({ error } = await sb.from('visitas').insert(v));
  }

  btn.disabled = false;
  btn.innerHTML = '<i class="ti ti-device-floppy"></i> Guardar visita';

  if (error) { toast('Error al guardar: ' + error.message, false); return; }
  toast('Visita guardada exitosamente.');
  editId = null;
  await loadVisits();
  nav('analysis');
}

function editVisit(id) {
  // Check permission
  const v = visits.find(x => String(x.id) === String(id));
  if (!v) return;
  if (currentProfile.rol === 'agente' && v.agent_id !== currentUser.id) {
    toast('No tienes permiso para editar esta visita.', false); return;
  }
  editId = id;
  populateForm(v);
  nav('form');
}

// ── USUARIOS (ADMIN) ──────────────────────────────────────
async function loadUsuarios() {
  const { data } = await sb.from('usuarios').select('*').order('nombre');
  usuarios = data || [];
  renderUsersTable();
}

function renderUsersTable() {
  const q = (document.getElementById('user-search')?.value||'').toLowerCase();
  const filtered = usuarios.filter(u => u.nombre.toLowerCase().includes(q) || u.correo.toLowerCase().includes(q));
  const tb = document.getElementById('users-tbl-body');
  if (!filtered.length) { tb.innerHTML='<tr><td colspan="5"><div class="empty-state">No se encontraron usuarios.</div></td></tr>'; return; }
  tb.innerHTML = filtered.map(u => `<tr>
    <td><div class="cl-name">${u.nombre}</div></td>
    <td style="font-size:12px">${u.correo}</td>
    <td>${rolBadge(u.rol)}</td>
    <td><span class="badge ${u.activo?'b-green':'b-gray'}">${u.activo?'Activo':'Inactivo'}</span></td>
    <td style="display:flex;gap:6px;flex-wrap:wrap">
      <button class="btn-sm blue" onclick="openUserModal('${u.id}')"><i class="ti ti-edit"></i> Editar</button>
      <button class="btn-sm red" onclick="openResetPassModal('${u.id}','${u.nombre.replace(/'/g,"\\'")}')"><i class="ti ti-key"></i> Contraseña</button>
    </td>
  </tr>`).join('');
}

function openUserModal(id = null) {
  document.getElementById('mu-id').value = id || '';
  document.getElementById('modal-user-title').textContent = id ? 'Editar usuario' : 'Nuevo usuario';
  document.getElementById('mu-pass-group').style.display = id ? 'none' : '';
  document.getElementById('mu-activo-group').style.display = id ? '' : 'none';
  if (id) {
    const u = usuarios.find(x => x.id === id);
    if (u) {
      document.getElementById('mu-nombre').value = u.nombre;
      document.getElementById('mu-correo').value = u.correo;
      document.getElementById('mu-rol').value = u.rol;
      document.getElementById('mu-activo').value = String(u.activo);
    }
  } else {
    document.getElementById('mu-nombre').value = '';
    document.getElementById('mu-correo').value = '';
    document.getElementById('mu-pass').value = '';
    document.getElementById('mu-rol').value = 'agente';
  }
  openModal('modal-user');
}

async function saveUser() {
  const id = document.getElementById('mu-id').value;
  const nombre = document.getElementById('mu-nombre').value.trim();
  const correo = document.getElementById('mu-correo').value.trim();
  const rol = document.getElementById('mu-rol').value;
  const pass = document.getElementById('mu-pass').value;
  const activo = document.getElementById('mu-activo').value === 'true';

  if (!nombre || !correo) { toast('Nombre y correo son obligatorios.', false); return; }

  showLoading('Guardando usuario...');

  if (!id) {
    // CREATE via Supabase Admin API is not available from client
    // We use signUp and then update profile
    if (!pass || pass.length < 6) { hideLoading(); toast('La contraseña debe tener al menos 6 caracteres.', false); return; }
    const { data: authData, error: authErr } = await sb.auth.signUp({ email: correo, password: pass });
    if (authErr) { hideLoading(); toast('Error: ' + authErr.message, false); return; }
    const newId = authData.user?.id;
    if (!newId) { hideLoading(); toast('No se pudo crear el usuario.', false); return; }
    const { error: profileErr } = await sb.from('usuarios').insert({ id: newId, nombre, correo, rol, activo: true });
    if (profileErr) { hideLoading(); toast('Error guardando perfil: ' + profileErr.message, false); return; }
  } else {
    const { error } = await sb.from('usuarios').update({ nombre, correo, rol, activo }).eq('id', id);
    if (error) { hideLoading(); toast('Error: ' + error.message, false); return; }
  }

  hideLoading();
  closeModal('modal-user');
  toast('Usuario guardado correctamente.');
  await loadUsuarios();
}

function openResetPassModal(id, nombre) {
  document.getElementById('rp-id').value = id;
  document.getElementById('rp-nombre').textContent = nombre;
  document.getElementById('rp-pass').value = '';
  openModal('modal-reset-pass');
}

async function resetPassword() {
  const id = document.getElementById('rp-id').value;
  const pass = document.getElementById('rp-pass').value;
  if (!pass || pass.length < 6) { toast('La contraseña debe tener al menos 6 caracteres.', false); return; }
  showLoading('Actualizando contraseña...');
  // Admin password reset requires service_role key, so we use Supabase's resetPasswordForEmail as workaround
  // For the admin panel we update using the admin API via edge function
  // Fallback: store a reset flag and the user can reset on next login
  // Best practice: use Supabase admin API from a trusted server
  // Here we send a reset email
  const u = usuarios.find(x => x.id === id);
  if (u) {
    const { error } = await sb.auth.resetPasswordForEmail(u.correo, {
      redirectTo: window.location.href
    });
    hideLoading();
    if (error) { toast('Error: ' + error.message, false); return; }
    closeModal('modal-reset-pass');
    toast('Se envió un correo para restablecer la contraseña.');
  } else {
    hideLoading();
    toast('Usuario no encontrado.', false);
  }
}

// ── CLIENTES (ADMIN) ──────────────────────────────────────
function renderClientsTable() {
  const q = (document.getElementById('client-search')?.value||'').toLowerCase();
  const filtered = clientes.filter(c => c.codigo.toLowerCase().includes(q) || c.nombre.toLowerCase().includes(q));
  const tb = document.getElementById('clients-tbl-body');
  if (!filtered.length) { tb.innerHTML='<tr><td colspan="7"><div class="empty-state">No se encontraron clientes.</div></td></tr>'; return; }
  tb.innerHTML = filtered.map(c => `<tr>
    <td><span class="code">${c.codigo}</span></td>
    <td><div class="cl-name">${c.nombre}</div></td>
    <td style="font-size:12px">${c.tipo||'—'}</td>
    <td style="font-size:12px">${c.zona||'—'}</td>
    <td style="font-size:12px">${c.contacto||'—'}</td>
    <td><span class="badge ${c.activo?'b-green':'b-gray'}">${c.activo?'Activo':'Inactivo'}</span></td>
    <td><button class="btn-sm blue" onclick="openClientModal(${c.id})"><i class="ti ti-edit"></i> Editar</button></td>
  </tr>`).join('');
}

function openClientModal(id = null) {
  document.getElementById('mc-id').value = id || '';
  document.getElementById('modal-client-title').textContent = id ? 'Editar cliente' : 'Nuevo cliente';
  if (id) {
    const c = clientes.find(x => x.id === id);
    if (c) {
      document.getElementById('mc-codigo').value = c.codigo||'';
      document.getElementById('mc-nombre').value = c.nombre||'';
      document.getElementById('mc-tipo').value = c.tipo||'';
      document.getElementById('mc-zona').value = c.zona||'';
      document.getElementById('mc-contacto').value = c.contacto||'';
      document.getElementById('mc-telefono').value = c.telefono||'';
    }
  } else {
    ['mc-codigo','mc-nombre','mc-contacto','mc-telefono'].forEach(x => document.getElementById(x).value='');
    document.getElementById('mc-tipo').value='';
    document.getElementById('mc-zona').value='';
  }
  openModal('modal-client');
}

async function saveClient() {
  const id = document.getElementById('mc-id').value;
  const codigo = document.getElementById('mc-codigo').value.trim();
  const nombre = document.getElementById('mc-nombre').value.trim();
  if (!codigo || !nombre) { toast('Código y nombre son obligatorios.', false); return; }

  const payload = {
    codigo, nombre,
    tipo: document.getElementById('mc-tipo').value,
    zona: document.getElementById('mc-zona').value,
    contacto: document.getElementById('mc-contacto').value.trim(),
    telefono: document.getElementById('mc-telefono').value.trim(),
  };

  showLoading('Guardando cliente...');
  let error;
  if (id) {
    ({ error } = await sb.from('clientes').update(payload).eq('id', id));
  } else {
    ({ error } = await sb.from('clientes').insert(payload));
  }
  hideLoading();
  if (error) { toast('Error: ' + error.message, false); return; }
  closeModal('modal-client');
  toast('Cliente guardado correctamente.');
  await loadClientes();
  renderClientsTable();
}

// ── GRÁFICOS ──────────────────────────────────────────────
function populateChartFilterOptions() {
  const zones = [...new Set(visits.map(v=>v.zone).filter(Boolean))].sort();
  const agents = [...new Set(visits.map(v=>v.agent).filter(Boolean))].sort();
  const problems = [...new Set(visits.flatMap(v=>v.problems||[]))].sort();
  const fill = (id, arr) => {
    const sel = document.getElementById(id); if(!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">— Todos —</option>' + arr.map(x=>`<option ${x===cur?'selected':''}>${x}</option>`).join('');
  };
  fill('cf-zone', zones); fill('cf-agent', agents); fill('cf-problem', problems);
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
    if(f.start && v.date < f.start) return false;
    if(f.end && v.date > f.end) return false;
    if(f.status && v.status !== f.status) return false;
    if(f.zone && v.zone !== f.zone) return false;
    if(f.problem && !(v.problems||[]).includes(f.problem)) return false;
    if(f.agent && v.agent !== f.agent) return false;
    return true;
  });
  renderCharts(filtered);
}

function resetChartFilters() {
  ['cf-date-start','cf-date-end','cf-status','cf-zone','cf-problem','cf-agent']
    .forEach(id => { document.getElementById(id).value=''; });
  renderCharts();
}

function renderCharts(list) {
  const data = list || visits;
  const cfCount = document.getElementById('cf-count');
  if(cfCount) cfCount.textContent = `Mostrando ${data.length} de ${visits.length} visitas`;
  const el = document.getElementById('charts-inner');
  if(!data.length) { el.innerHTML='<div class="empty-state" style="background:white;border-radius:8px;padding:48px">No hay datos para los filtros seleccionados.</div>'; return; }
  const byS={}, byZ={}, byP={}, bySat=[0,0,0,0,0];
  data.forEach(v => {
    byS[v.status]=(byS[v.status]||0)+1;
    if(v.zone) byZ[v.zone]=(byZ[v.zone]||0)+1;
    (v.problems||[]).forEach(p => byP[p]=(byP[p]||0)+1);
    if(v.satisfaccion>=1&&v.satisfaccion<=5) bySat[v.satisfaccion-1]++;
  });
  const topP = Object.entries(byP).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const maxP = topP.length ? topP[0][1] : 1;
  const sCols = {'Resuelto':'#3B6D11','En proceso':'#185FA5','Pendiente':'#854F0B'};
  const sBars = Object.entries(byS).map(([k,v]) =>
    `<div class="bar-row"><div class="bar-lbl">${k}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.round(v/data.length*100)}%;background:${sCols[k]||'#888'}"><span>${v}</span></div></div><div class="bar-pct">${Math.round(v/data.length*100)}%</div></div>`
  ).join('');
  const pBars = topP.map(([k,v]) =>
    `<div class="bar-row"><div class="bar-lbl">${k}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.round(v/maxP*100)}%;background:#B03A2E"><span>${v}</span></div></div></div>`
  ).join('');
  const zCards = Object.entries(byZ).sort((a,b)=>b[1]-a[1]).map(([z,c]) =>
    `<div class="zone-card"><div class="zone-num">${c}</div><div class="zone-nm">${z}</div></div>`
  ).join('');
  const satArr = data.filter(v=>v.satisfaccion);
  const satAvg = satArr.length ? (satArr.reduce((s,v)=>s+(v.satisfaccion||0),0)/satArr.length).toFixed(1) : '—';
  const maxSat = Math.max(...bySat,1);
  el.innerHTML = `
  <div class="ch-grid">
    <div class="ch-card"><div class="ch-title">Visitas por estado</div>${sBars}</div>
    <div class="ch-card"><div class="ch-title">Visitas por zona</div><div class="zone-grid">${zCards}</div></div>
  </div>
  <div class="ch-grid">
    <div class="ch-card"><div class="ch-title">Problemas más frecuentes</div>${pBars||'<p style="font-size:13px;color:#888">Sin datos</p>'}</div>
    <div class="ch-card">
      <div class="ch-title">Satisfacción · promedio: ${satAvg}</div>
      <div style="display:flex;gap:8px;align-items:flex-end;height:80px;margin-top:12px">
        ${bySat.map((n,i)=>`<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
          <div style="width:100%;background:#D4832A;border-radius:4px 4px 0 0;height:${Math.max(4,Math.round(n/maxSat*70))}px"></div>
          <span style="font-size:11px;color:#888">${i+1}★</span>
          <span style="font-size:11px;font-weight:600">${n}</span>
        </div>`).join('')}
      </div>
    </div>
  </div>`;
}
