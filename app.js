// 1) Despliega el Apps Script como Web App.
// 2) Copia la URL /exec y pégala aquí.
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbw8gVzmw_c450nTwcYOJxUGgmq6DA0-uxXEWDbmkgd2xK8HR0NLWWHKB39_jFVi1QZR/exec';

const state = {
  locales: [],
  productos: [],
  inventory: JSON.parse(localStorage.getItem('smapp_inventory') || 'null'),
  details: JSON.parse(localStorage.getItem('smapp_details') || '[]')
};

const $ = (id) => document.getElementById(id);

function setMessage(el, text, type='') {
  el.textContent = text || '';
  el.className = `message ${type}`.trim();
}

function normalize(s) {
  return String(s || '').trim().toLowerCase();
}

function moneylessNumber(v) {
  if (v === '' || v === null || v === undefined) return '';
  const n = Number(v);
  return Number.isFinite(n) ? n : v;
}

async function apiGet(params={}) {
  if (!WEB_APP_URL.startsWith('https://script.google.com/')) throw new Error('Falta configurar WEB_APP_URL en app.js.');
  const url = new URL(WEB_APP_URL);
  Object.entries(params).forEach(([k,v]) => url.searchParams.set(k,v));
  const res = await fetch(url.toString(), { method:'GET', redirect:'follow' });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Error del servidor.');
  return data;
}

async function apiPost(payload) {
  if (!WEB_APP_URL.startsWith('https://script.google.com/')) throw new Error('Falta configurar WEB_APP_URL en app.js.');
  const res = await fetch(WEB_APP_URL, {
    method:'POST',
    headers:{'Content-Type':'text/plain;charset=utf-8'},
    body:JSON.stringify(payload),
    redirect:'follow'
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Error del servidor.');
  return data;
}

async function bootstrap() {
  try {
    const data = await apiGet({action:'bootstrap'});
    state.locales = data.locales || [];
    state.productos = data.productos || [];
    $('connectionBadge').textContent = 'Conectado';
    $('connectionBadge').className = 'badge ok';
    renderLocales();
    renderProductOptions();
    if (state.inventory) {
      try {
        const live = await apiGet({action:'inventory', inventoryId:state.inventory.id});
        state.inventory = live.inventory;
        state.details = live.details || [];
        persist();
        if (state.inventory.estado === 'Finalizado') await showResults();
        else showInventory();
      } catch (_) {
        clearSession();
        showSetup();
      }
    }
  } catch (err) {
    $('connectionBadge').textContent = 'Sin conexión';
    $('connectionBadge').className = 'badge error';
    setMessage($('setupMessage'), err.message, 'error');
    renderFallbackLocales();
  }
}

function renderFallbackLocales() {
  state.locales = [
    {id:'CFUIO', nombre:'Casa de las Flores'},
    {id:'PBUIO', nombre:'Piano Bar'},
    {id:'LMMEC', nombre:'Love Me Manta'},
    {id:'LMUIO', nombre:'Love Me Quito'},
    {id:'LFUIO', nombre:'La Fabrica'},
    {id:'SMUIO', nombre:'Shot me'}
  ];
  renderLocales();
}

function renderLocales() {
  $('localSelect').innerHTML = '<option value="">Selecciona un local</option>' +
    state.locales.map(l => `<option value="${l.id}">${l.nombre} (${l.id})</option>`).join('');
}

function renderProductOptions() {
  const counted = new Set(state.details.map(d => d.codigo));
  $('productOptions').innerHTML = state.productos
    .filter(p => !counted.has(p.codigo))
    .map(p => `<option value="${p.codigo} — ${escapeHtml(p.producto)}"></option>`)
    .join('');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function parseProductInput(value) {
  const raw = String(value || '').trim();
  const code = raw.split('—')[0].trim().split(' - ')[0].trim();
  return state.productos.find(p => p.codigo === code) ||
    state.productos.find(p => normalize(p.producto) === normalize(raw));
}

function persist() {
  localStorage.setItem('smapp_inventory', JSON.stringify(state.inventory));
  localStorage.setItem('smapp_details', JSON.stringify(state.details));
}

function clearSession() {
  state.inventory = null;
  state.details = [];
  localStorage.removeItem('smapp_inventory');
  localStorage.removeItem('smapp_details');
}

function showSetup() {
  $('setupPanel').classList.remove('hidden');
  $('inventoryPanel').classList.add('hidden');
  $('resultPanel').classList.add('hidden');
}

function showInventory() {
  $('setupPanel').classList.add('hidden');
  $('inventoryPanel').classList.remove('hidden');
  $('resultPanel').classList.add('hidden');
  const local = state.locales.find(l => l.id === state.inventory.localId);
  $('inventoryTitle').textContent = local ? local.nombre : state.inventory.localId;
  $('inventoryMeta').textContent = `${state.inventory.responsable} · ${state.inventory.id} · ${state.inventory.fecha}`;
  renderCounted();
}

function renderCounted() {
  $('countedCount').textContent = state.details.length;
  if (!state.details.length) {
    $('countedTableBody').innerHTML = '<tr><td colspan="3" class="empty">Todavía no hay productos registrados.</td></tr>';
  } else {
    $('countedTableBody').innerHTML = state.details.map(d => `
      <tr>
        <td><strong>${escapeHtml(d.codigo)}</strong></td>
        <td>${escapeHtml(d.producto || '')}</td>
        <td class="num">${escapeHtml(d.cantidad)}</td>
      </tr>`).join('');
  }
  renderProductOptions();
}

async function createInventory() {
  const localId = $('localSelect').value;
  const responsable = $('responsableInput').value.trim();
  if (!localId || !responsable) return setMessage($('setupMessage'), 'Selecciona el local e ingresa el responsable.', 'error');
  const btn = $('createInventoryBtn'); btn.disabled = true;
  setMessage($('setupMessage'), 'Creando inventario...');
  try {
    const data = await apiPost({action:'createInventory', localId, responsable});
    state.inventory = data.inventory;
    state.details = [];
    persist();
    showInventory();
  } catch (err) {
    setMessage($('setupMessage'), err.message, 'error');
  } finally { btn.disabled = false; }
}

async function addProduct() {
  const product = parseProductInput($('productSearch').value);
  const quantityRaw = $('quantityInput').value;
  const quantity = Number(quantityRaw);
  if (!product) return setMessage($('entryMessage'), 'Selecciona un producto válido.', 'error');
  if (quantityRaw === '' || !Number.isFinite(quantity)) return setMessage($('entryMessage'), 'Ingresa una cantidad válida. El 0 sí es permitido.', 'error');
  if (state.details.some(d => d.codigo === product.codigo)) return setMessage($('entryMessage'), 'Ese producto ya fue contado.', 'error');
  const btn = $('addProductBtn'); btn.disabled = true;
  setMessage($('entryMessage'), 'Guardando...');
  try {
    const data = await apiPost({action:'addDetail', inventoryId:state.inventory.id, codigo:product.codigo, cantidad:quantity});
    state.details.push(data.detail);
    persist();
    $('productSearch').value = '';
    $('quantityInput').value = '';
    setMessage($('entryMessage'), 'Producto registrado.', 'ok');
    renderCounted();
    $('productSearch').focus();
  } catch (err) {
    setMessage($('entryMessage'), err.message, 'error');
  } finally { btn.disabled = false; }
}

async function finalizeInventory() {
  if (!confirm('¿Seguro que deseas finalizar este inventario? Después no podrá modificarse.')) return;
  const btn = $('finalizeBtn'); btn.disabled = true;
  try {
    await apiPost({action:'finalizeInventory', inventoryId:state.inventory.id});
    state.inventory.estado = 'Finalizado';
    persist();
    await showResults();
  } catch (err) {
    alert(err.message);
  } finally { btn.disabled = false; }
}

async function showResults() {
  $('setupPanel').classList.add('hidden');
  $('inventoryPanel').classList.add('hidden');
  $('resultPanel').classList.remove('hidden');
  $('resultSubtitle').textContent = `Inventario ${state.inventory.id} · ${state.inventory.localId}`;
  try {
    const data = await apiGet({action:'conciliation', inventoryId:state.inventory.id, _ts:Date.now()});
    renderConciliation(data.rows || []);
  } catch (err) {
    $('conciliationTableBody').innerHTML = `<tr><td colspan="6" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

function renderConciliation(rows) {
  const keys = ['Cuadrado','Faltante','Sobrante','No contado','No existe en Contífico'];
  const counts = Object.fromEntries(keys.map(k => [k,0]));
  rows.forEach(r => counts[r.estado] = (counts[r.estado] || 0) + 1);
  $('kpiGrid').innerHTML = keys.map(k => `<div class="kpi"><div class="label">${k}</div><div class="value">${counts[k] || 0}</div></div>`).join('');

  if (!rows.length) {
    $('conciliationTableBody').innerHTML = '<tr><td colspan="6" class="empty">No hay resultados de conciliación. Verifica que exista stock contable cargado para este local.</td></tr>';
    return;
  }

  $('conciliationTableBody').innerHTML = rows.map(r => {
    const cls = r.estado.replaceAll(' ','-');
    return `<tr>
      <td><strong>${escapeHtml(r.codigo)}</strong></td>
      <td>${escapeHtml(r.producto || '')}</td>
      <td class="num">${escapeHtml(moneylessNumber(r.fisico))}</td>
      <td class="num">${escapeHtml(moneylessNumber(r.contable))}</td>
      <td class="num">${escapeHtml(moneylessNumber(r.diferencia))}</td>
      <td><span class="status ${escapeHtml(cls)}">${escapeHtml(r.estado)}</span></td>
    </tr>`;
  }).join('');
}

$('createInventoryBtn').addEventListener('click', createInventory);
$('addProductBtn').addEventListener('click', addProduct);
$('quantityInput').addEventListener('keydown', e => { if (e.key === 'Enter') addProduct(); });
$('finalizeBtn').addEventListener('click', finalizeInventory);
$('resetSessionBtn').addEventListener('click', () => { clearSession(); showSetup(); });
$('newInventoryBtn').addEventListener('click', () => { clearSession(); $('responsableInput').value=''; showSetup(); });

bootstrap();
