// Crunch Snacks - Pure JS Admin Panel Controller
// Usa CrunchDB (Supabase Client JS + Fallback)

let cachedProducts = [];
let cachedUsers = [];

document.addEventListener("DOMContentLoaded", async () => {
  updateSupabaseStatusBadge();
  await loadDashboard();
});

// ================= SUPABASE STATUS & MODAL =================
async function updateSupabaseStatusBadge() {
  const dot = document.getElementById("supabase-dot");
  const text = document.getElementById("supabase-status-text");
  
  if (!window.CrunchDB) return;

  const res = await window.CrunchDB.testSupabaseConnection();
  if (res.success) {
    dot.style.background = "#10B981"; // Verde
    text.textContent = "Supabase DB Activa";
  } else {
    dot.style.background = "#F59E0B"; // Amarillo
    text.textContent = "Supabase JS (Configurar)";
  }
}

function openSupabaseModal() {
  const modal = document.getElementById("modal-supabase");
  const input = document.getElementById("supabase-anon-key-input");
  input.value = window.CrunchDB.getAnonKey();
  modal.style.display = "flex";
}

function closeSupabaseModal() {
  document.getElementById("modal-supabase").style.display = "none";
}

async function saveSupabaseKey() {
  const input = document.getElementById("supabase-anon-key-input");
  const key = input.value.trim();
  window.CrunchDB.setAnonKey(key);
  closeSupabaseModal();

  showToast("Probando conexión con Supabase...");
  const res = await window.CrunchDB.testSupabaseConnection();
  if (res.success) {
    showToast("¡Conectado exitosamente a Supabase DB!");
  } else {
    showToast(res.message, true);
  }
  updateSupabaseStatusBadge();
  loadDashboard();
}

function handleLogout() {
  window.location.href = "../Crunch V1.1/index.html";
}

// ================= NAVIGATION =================
function switchTab(tabId) {
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
  document.querySelectorAll(".view-section").forEach(sec => sec.classList.remove("active"));

  const targetSection = document.getElementById(`view-${tabId}`);
  if (targetSection) targetSection.classList.add("active");

  const clickedBtn = Array.from(document.querySelectorAll(".tab-btn")).find(b => 
    b.getAttribute("onclick") && b.getAttribute("onclick").includes(tabId)
  );
  if (clickedBtn) clickedBtn.classList.add("active");

  if (tabId === "ventas-historial") loadSalesHistory();
  if (tabId === "productos") loadProducts();
  if (tabId === "usuarios") loadUsers();
  if (tabId === "registrar-venta") prepareSaleForm();
  if (tabId === "qr") loadQRCodes();
  if (tabId === "resumen") loadDashboard();
}

// ================= DASHBOARD & KPIS =================
async function loadDashboard() {
  await Promise.all([
    loadSalesHistory(),
    loadProducts(),
    loadUsers()
  ]);
}

// ================= HISTORIAL GLOBAL DE VENTAS =================
// "un panel de admin para ver todas las compras registradas de todo el tiempo, con su fecha producto, descripción etc"
async function loadSalesHistory() {
  try {
    const sales = await window.CrunchDB.getAllSales();

    let totalSalesCOP = 0;
    let totalFichosGranted = 0;
    sales.forEach(s => {
      totalSalesCOP += s.total_price;
      totalFichosGranted += (s.fichos_granted || 0);
    });

    document.getElementById("kpi-total-sales").textContent = `$${totalSalesCOP.toLocaleString("es-CO")} COP`;
    document.getElementById("kpi-total-orders").textContent = sales.length;
    document.getElementById("kpi-total-fichos").textContent = `+${totalFichosGranted}`;

    const tableAll = document.getElementById("table-all-sales");
    const tableRecent = document.getElementById("table-recent-sales");

    if (sales.length === 0) {
      const emptyRow = `<tr><td colspan="9" style="text-align: center; color: var(--gris-text-muted); padding: 30px;">No hay ventas registradas aún. Ingresa la primera venta arriba.</td></tr>`;
      tableAll.innerHTML = emptyRow;
      tableRecent.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--gris-text-muted); padding: 20px;">Sin ventas aún.</td></tr>`;
      return;
    }

    const rowsAll = sales.map(s => {
      const dateFormatted = new Date(s.created_at).toLocaleString("es-CO", {
        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
      });
      return `
        <tr>
          <td><strong>#${s.id}</strong></td>
          <td>${dateFormatted}</td>
          <td>
            <strong>${escapeHtml(s.customer_name || 'N/A')}</strong><br>
            <span style="font-size: 0.75rem; color: var(--gris-text-muted);">${escapeHtml(s.customer_email || '')}</span>
          </td>
          <td><span class="badge badge-blue">${escapeHtml(s.product_name)}</span></td>
          <td>${s.quantity} und</td>
          <td>$${s.unit_price.toLocaleString("es-CO")}</td>
          <td><strong>$${s.total_price.toLocaleString("es-CO")} COP</strong></td>
          <td>
            ${s.fichos_granted > 0 
              ? `<span class="badge badge-fichos">+${s.fichos_granted} Ficho${s.fichos_granted > 1 ? 's' : ''}</span>`
              : `<span class="badge badge-neutral">0</span>`}
          </td>
          <td style="color: var(--gris-text-muted); max-width: 220px;">${escapeHtml(s.description || 'Sin notas')}</td>
        </tr>
      `;
    }).join("");

    tableAll.innerHTML = rowsAll;

    const recentRows = sales.slice(0, 5).map(s => {
      const dateShort = new Date(s.created_at).toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
      return `
        <tr>
          <td><strong>#${s.id}</strong></td>
          <td>${dateShort}</td>
          <td><strong>${escapeHtml(s.customer_name || 'N/A')}</strong></td>
          <td>${escapeHtml(s.product_name)}</td>
          <td>${s.quantity}</td>
          <td><strong>$${s.total_price.toLocaleString("es-CO")}</strong></td>
          <td>${s.fichos_granted > 0 ? `<span class="badge badge-fichos">+${s.fichos_granted}</span>` : '0'}</td>
        </tr>
      `;
    }).join("");
    tableRecent.innerHTML = recentRows;

  } catch (e) {
    console.error("Error cargando ventas:", e);
  }
}

// ================= PRODUCTOS =================
// "El Superadmin puede crear productos con precio... Los 7 fichos que hay en este momento unicamente contaran para el producto 'Crispetas' que debe ser ingresado como primer dato en la DB a 2000 COP."
async function loadProducts() {
  try {
    cachedProducts = await window.CrunchDB.getProducts();

    const tbody = document.getElementById("table-products");
    if (cachedProducts.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align: center;">No hay productos creados.</td></tr>`;
      return;
    }

    tbody.innerHTML = cachedProducts.map(p => `
      <tr>
        <td>#${p.id}</td>
        <td>
          <strong>${escapeHtml(p.name)}</strong>
          ${p.name.toLowerCase() === 'crispetas' ? ' <span class="badge badge-fichos">Regla 7 Fichos</span>' : ''}
          <div style="font-size: 0.75rem; color: var(--gris-text-muted);">${escapeHtml(p.description || '')}</div>
        </td>
        <td><strong>$${parseFloat(p.price).toLocaleString("es-CO")} COP</strong></td>
        <td>
          ${p.is_ficho_eligible ? '<span class="badge badge-success">Acumula</span>' : '<span class="badge badge-neutral">No acumula</span>'}
        </td>
      </tr>
    `).join("");

  } catch (e) {
    console.error("Error cargando productos:", e);
  }
}

async function handleCreateProduct(e) {
  e.preventDefault();
  const name = document.getElementById("prod-name").value.trim();
  const price = parseFloat(document.getElementById("prod-price").value);
  const description = document.getElementById("prod-desc").value.trim();
  const is_ficho_eligible = document.getElementById("prod-eligible").checked;

  try {
    const newProd = await window.CrunchDB.createProduct({ name, price, description, is_ficho_eligible });
    showToast(`Producto '${newProd.name}' guardado exitosamente`);
    document.getElementById("form-product").reset();
    loadProducts();
  } catch (err) {
    showToast(err.message || "Error al crear producto", true);
  }
}

// ================= USUARIOS (CLIENTES) =================
// "y puede crear también las cuentas de los usuarios que compren. Al crear cada cuenta debe tener 2 fichos iniciales gratis"
async function loadUsers() {
  try {
    cachedUsers = await window.CrunchDB.getUsers();
    document.getElementById("kpi-total-users").textContent = cachedUsers.length;

    const tbody = document.getElementById("table-users");
    tbody.innerHTML = cachedUsers.map(u => {
      const rolesBadges = (u.roles || []).map(r => 
        `<span class="badge ${r.name === 'Superadmin' ? 'badge-blue' : 'badge-neutral'}">${r.name}</span>`
      ).join(" ");
      return `
        <tr>
          <td>#${u.id}</td>
          <td><strong>${escapeHtml(u.full_name)}</strong></td>
          <td>${escapeHtml(u.email)}</td>
          <td>${rolesBadges || '<span class="badge badge-neutral">Cliente</span>'}</td>
          <td><span class="badge badge-fichos">${u.fichos_balance} Fichos</span></td>
        </tr>
      `;
    }).join("");

  } catch (e) {
    console.error("Error cargando usuarios:", e);
  }
}

async function handleCreateUser(e) {
  e.preventDefault();
  const full_name = document.getElementById("user-name").value.trim();
  const email = document.getElementById("user-email").value.trim();
  const phone = document.getElementById("user-phone").value.trim();
  const initial_fichos = parseInt(document.getElementById("user-fichos").value) || 2;

  try {
    const user = await window.CrunchDB.createUser({
      full_name,
      email,
      phone,
      initial_fichos,
      role: "Cliente"
    });
    showToast(`Cuenta para ${user.full_name} creada con ${initial_fichos} fichos gratis de bienvenida`);
    document.getElementById("form-user").reset();
    document.getElementById("user-fichos").value = 2;
    loadUsers();
  } catch (err) {
    showToast(err.message || "Error al crear usuario", true);
  }
}

// ================= INGRESAR VENTA =================
async function prepareSaleForm() {
  await Promise.all([loadProducts(), loadUsers()]);

  const userSelect = document.getElementById("sale-user-id");
  userSelect.innerHTML = `<option value="">-- Seleccionar cliente comprador --</option>` +
    cachedUsers.map(u => `<option value="${u.id}">${escapeHtml(u.full_name)} (${u.email}) - Saldo: ${u.fichos_balance} fichos</option>`).join("");

  const prodSelect = document.getElementById("sale-product-id");
  prodSelect.innerHTML = `<option value="">-- Seleccionar producto --</option>` +
    cachedProducts.map(p => `<option value="${p.id}" data-price="${p.price}" data-name="${escapeHtml(p.name)}" data-ficho="${p.is_ficho_eligible}">
      ${escapeHtml(p.name)} - $${parseFloat(p.price).toLocaleString("es-CO")} COP ${p.name.toLowerCase() === 'crispetas' ? '★ (+1 Ficho)' : ''}
    </option>`).join("");

  calculateSaleTotal();
}

function handleProductSelectChange() {
  calculateSaleTotal();
}

function calculateSaleTotal() {
  const prodSelect = document.getElementById("sale-product-id");
  const qtyInput = document.getElementById("sale-quantity");
  const totalPreview = document.getElementById("sale-total-preview");
  const fichosPreview = document.getElementById("sale-fichos-preview");

  const selectedOpt = prodSelect.options[prodSelect.selectedIndex];
  if (!selectedOpt || !selectedOpt.value) {
    totalPreview.value = "$0 COP";
    fichosPreview.value = "+0 Fichos";
    return;
  }

  const price = parseFloat(selectedOpt.dataset.price) || 0;
  const isEligible = selectedOpt.dataset.ficho === "true" || selectedOpt.dataset.name.toLowerCase() === "crispetas";
  const qty = parseInt(qtyInput.value) || 1;

  const total = price * qty;
  totalPreview.value = `$${total.toLocaleString("es-CO")} COP`;

  const fichos = isEligible ? qty : 0;
  fichosPreview.value = `+${fichos} Ficho${fichos === 1 ? '' : 's'}`;
}

async function handleCreateSale(e) {
  e.preventDefault();
  const user_id = parseInt(document.getElementById("sale-user-id").value);
  const product_id = parseInt(document.getElementById("sale-product-id").value);
  const quantity = parseInt(document.getElementById("sale-quantity").value) || 1;
  const description = document.getElementById("sale-description").value.trim();

  if (!user_id || !product_id) {
    showToast("Por favor selecciona cliente y producto", true);
    return;
  }

  try {
    const sale = await window.CrunchDB.createSale({
      user_id,
      product_id,
      quantity,
      description
    });

    showToast(`¡Venta #${sale.id} registrada! Se sumaron +${sale.fichos_granted} ficho(s) al cliente`);
    document.getElementById("form-sale").reset();
    calculateSaleTotal();
    switchTab("ventas-historial");
  } catch (err) {
    showToast(err.message || "Error al registrar venta", true);
  }
}

// ================= GENERADOR DE CÓDIGOS QR =================
// "y se iran sumando a través de codigos QR generados por el Superadmin, que te redirige a la página y reclama tu ficho"
async function loadQRCodes() {
  try {
    const qrs = await window.CrunchDB.getQRCodes();

    const grid = document.getElementById("qr-codes-grid");
    if (qrs.length === 0) {
      grid.innerHTML = `<p style="color: var(--gris-text-muted); grid-column: 1/-1; text-align: center; padding: 30px;">
        No has generado códigos QR todavía. Haz clic en el botón superior para generar uno.
      </p>`;
      return;
    }

    grid.innerHTML = qrs.map(q => {
      // Generar URL para código QR visual (usando servicio rápido de renderizado SVG/PNG o local)
      const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(q.claim_url)}&color=011C51`;
      return `
        <div class="qr-card">
          <img class="qr-img" src="${qrImageUrl}" alt="QR ${q.code}" loading="lazy">
          <div class="qr-code-text">${q.code}</div>
          <div style="margin-bottom: 8px;">
            ${q.is_used 
              ? '<span class="badge badge-neutral">Ya Reclamado</span>' 
              : '<span class="badge badge-success">Disponible (+1 Ficho)</span>'}
          </div>
          <div style="font-size: 0.75rem; color: var(--gris-text-muted); margin-bottom: 10px;">
            Creado: ${new Date(q.created_at).toLocaleDateString("es-CO")}
            ${q.used_at ? `<br>Reclamado: ${new Date(q.used_at).toLocaleDateString("es-CO")}` : ''}
          </div>
          <div style="display: flex; gap: 8px; justify-content: center;">
            <a href="${q.claim_url}" target="_blank" class="btn-sm btn-primary" style="text-decoration: none;">
              Abrir Enlace
            </a>
            <button class="btn-sm btn-accent" onclick="navigator.clipboard.writeText('${q.claim_url}').then(() => showToast('Enlace copiado al portapapeles'))">
              Copiar Link
            </button>
          </div>
        </div>
      `;
    }).join("");

  } catch (e) {
    console.error("Error cargando QRs:", e);
  }
}

async function handleGenerateQR() {
  try {
    const newQr = await window.CrunchDB.generateQRCode({ fichos_value: 1 });
    showToast(`¡Código QR ${newQr.code} generado (+1 ficho)!`);
    loadQRCodes();
  } catch (err) {
    showToast(err.message || "Error al generar QR", true);
  }
}

// ================= TOAST =================
function showToast(message, isError = false) {
  const toast = document.getElementById("admin-toast");
  const text = document.getElementById("toast-text");
  text.textContent = message;
  toast.classList.toggle("error", isError);
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3500);
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
