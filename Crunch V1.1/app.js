/**
 * Crunch Snacks V1.1 - Pure JavaScript Client App
 * Sin datos simulados: Todas las consultas y validaciones van directo a Supabase DB.
 * Responsive fluido: Se adapta a escritorio completo y dispositivos móviles.
 */

// ==========================================================================
// 1. ESTADO DE USUARIO (SOLO DATOS REALES DE BASE DE DATOS)
// ==========================================================================
let currentUser = null;
let currentView = "login";

// ==========================================================================
// 2. INICIALIZACIÓN
// ==========================================================================
document.addEventListener("DOMContentLoaded", async () => {
  await updateSupabaseStatusBadge();

  // Intentar restaurar sesión activa real
  const savedUserJson = localStorage.getItem("crunch_active_user");
  if (savedUserJson) {
    try {
      const parsed = JSON.parse(savedUserJson);
      if (parsed && parsed.email) {
        // Validar directamente contra Supabase
        await refreshUserFromDB(parsed.email);
      }
    } catch (e) {
      console.warn("Sesión expirada o inválida:", e);
      currentUser = null;
    }
  }

  // Cargar catálogo oficial desde la DB
  await loadCatalogFromDB();

  // Detectar código QR en URL (?claim=CRUNCH-... o ?code=...)
  const urlParams = new URLSearchParams(window.location.search);
  const claimCode = urlParams.get("claim") || urlParams.get("code");
  if (claimCode) {
    if (currentUser) {
      await processQRClaim(claimCode);
    } else {
      sessionStorage.setItem("pending_ficho_code", claimCode);
      showToast("Código QR Detectado", "Inicia sesión o crea tu cuenta para reclamar tu ficho.");
      showView("login");
    }
    try {
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (e) {}
  } else {
    showView(currentUser ? "info" : "login");
  }
});

// ==========================================================================
// 3. CONEXIÓN SUPABASE & STATUS BADGE
// ==========================================================================
async function updateSupabaseStatusBadge() {
  const dot = document.getElementById("client-db-dot");
  const text = document.getElementById("client-db-text");
  if (!dot || !text || !window.CrunchDB) return;

  const res = await window.CrunchDB.testSupabaseConnection();
  if (res.success) {
    dot.style.background = "#10B981"; // Verde
    text.textContent = "Supabase DB Activa";
  } else {
    dot.style.background = "#F59E0B"; // Amarillo
    text.textContent = "Conectar DB";
  }
}

function openSupabaseModal() {
  const modal = document.getElementById("modal-supabase");
  const input = document.getElementById("client-supabase-anon-key-input");
  if (input) input.value = window.CrunchDB.getAnonKey();
  if (modal) modal.style.display = "flex";
}

function closeSupabaseModal() {
  const modal = document.getElementById("modal-supabase");
  if (modal) modal.style.display = "none";
}

async function saveClientSupabaseKey() {
  const input = document.getElementById("client-supabase-anon-key-input");
  const key = input ? input.value.trim() : "";
  window.CrunchDB.setAnonKey(key);
  closeSupabaseModal();

  showToast("Conectando...", "Verificando conexión con Supabase.");
  const res = await window.CrunchDB.testSupabaseConnection();
  if (res.success) {
    showToast("¡Conectado!", "Conectado exitosamente a Supabase DB.");
    await updateSupabaseStatusBadge();
    await loadCatalogFromDB();
    if (currentUser && currentUser.email) {
      await refreshUserFromDB(currentUser.email);
    }
  } else {
    showToast("Error de Conexión", res.message);
    await updateSupabaseStatusBadge();
  }
}

// ==========================================================================
// 4. AUTENTICACIÓN DIRECTA CON SUPABASE (SIN DATOS HARDCODEADOS)
// ==========================================================================
async function handleLoginSubmit(event) {
  event.preventDefault();
  const emailInput = document.getElementById("login-email");
  const email = emailInput ? emailInput.value.trim().toLowerCase() : "";

  if (!email) {
    showToast("Aviso", "Por favor ingresa tu correo electrónico.");
    return;
  }

  showToast("Consultando DB...", "Buscando usuario en Supabase.");

  try {
    const users = await window.CrunchDB.getUsers();
    const foundUser = users.find(u => u.email.toLowerCase() === email);

    if (!foundUser) {
      showToast("Usuario no encontrado", "No existe cuenta con este correo. Regístrate en la pestaña de abajo.");
      return;
    }

    currentUser = {
      id: foundUser.id,
      name: foundUser.full_name,
      email: foundUser.email,
      phone: foundUser.phone,
      fichos: foundUser.fichos_balance,
      isSuperadmin: (foundUser.roles || []).some(r => r.name === "Superadmin")
    };

    localStorage.setItem("crunch_active_user", JSON.stringify(currentUser));
    showToast("Bienvenido", `Hola ${currentUser.name}. Saldo: ${currentUser.fichos} fichos.`);
    showView("info");

    // Verificar si había un QR pendiente
    const pendingCode = sessionStorage.getItem("pending_ficho_code");
    if (pendingCode) {
      sessionStorage.removeItem("pending_ficho_code");
      setTimeout(() => processQRClaim(pendingCode), 400);
    }
  } catch (err) {
    showToast("Error de Base de Datos", err.message);
  }
}

async function handleRegisterSubmit(event) {
  event.preventDefault();
  const nameInput = document.getElementById("reg-name");
  const emailInput = document.getElementById("reg-email");

  const full_name = nameInput ? nameInput.value.trim() : "";
  const email = emailInput ? emailInput.value.trim().toLowerCase() : "";

  if (!full_name || !email) {
    showToast("Aviso", "Por favor completa nombre y correo.");
    return;
  }

  showToast("Registrando en DB...", "Creando cuenta con 2 fichos iniciales gratis.");

  try {
    // Inserta directo en Supabase DB
    const createdUser = await window.CrunchDB.createUser({
      full_name,
      email,
      initial_fichos: 2, // Por regla: 2 fichos gratis de bienvenida
      role: "Cliente"
    });

    currentUser = {
      id: createdUser.id,
      name: createdUser.full_name,
      email: createdUser.email,
      phone: createdUser.phone,
      fichos: createdUser.fichos_balance,
      isSuperadmin: false
    };

    localStorage.setItem("crunch_active_user", JSON.stringify(currentUser));
    triggerConfetti();
    showToast("¡Cuenta Creada en DB!", `Bienvenido ${currentUser.name}. Recibiste 2 fichos gratis de regalo.`);
    showView("info");

    const pendingCode = sessionStorage.getItem("pending_ficho_code");
    if (pendingCode) {
      sessionStorage.removeItem("pending_ficho_code");
      setTimeout(() => processQRClaim(pendingCode), 400);
    }
  } catch (err) {
    showToast("Error de Registro", err.message);
  }
}

function handleLogout() {
  currentUser = null;
  localStorage.removeItem("crunch_active_user");
  showToast("Sesión Cerrada", "Has salido de tu cuenta.");
  showView("login");
}

async function refreshUserFromDB(email) {
  try {
    const users = await window.CrunchDB.getUsers();
    const foundUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (foundUser) {
      currentUser = {
        id: foundUser.id,
        name: foundUser.full_name,
        email: foundUser.email,
        phone: foundUser.phone,
        fichos: foundUser.fichos_balance,
        isSuperadmin: (foundUser.roles || []).some(r => r.name === "Superadmin")
      };
      localStorage.setItem("crunch_active_user", JSON.stringify(currentUser));
      updateAllPageComponents();
    }
  } catch (e) {
    console.warn("Fallo al refrescar usuario desde DB:", e);
  }
}

// ==========================================================================
// 5. CONTROL DE VISTAS (LOGIN vs DASHBOARD DE USUARIO)
// ==========================================================================
function showView(viewName) {
  currentView = viewName;
  const viewLogin = document.getElementById("view-login");
  const viewInfo = document.getElementById("view-user-info");
  const navUserPill = document.getElementById("nav-user-pill-container");
  const navFichosCta = document.getElementById("nav-fichos-cta");
  const navAuthBtn = document.getElementById("nav-auth-toggle-btn");
  const bottomNav = document.getElementById("mobile-bottom-nav");
  const adminBtn = document.getElementById("nav-admin-shortcut");

  if (viewName === "login" || !currentUser) {
    if (viewLogin) viewLogin.classList.remove("hidden");
    if (viewInfo) viewInfo.classList.add("hidden");

    if (navUserPill) navUserPill.classList.add("hidden");
    if (navFichosCta) navFichosCta.classList.add("hidden");
    if (navAuthBtn) navAuthBtn.classList.add("hidden");
    if (adminBtn) adminBtn.classList.add("hidden");
    if (bottomNav) bottomNav.classList.add("hidden");

    toggleAuthMode("login");
  } else {
    if (viewLogin) viewLogin.classList.add("hidden");
    if (viewInfo) viewInfo.classList.remove("hidden");

    if (navUserPill) navUserPill.classList.remove("hidden");
    if (navFichosCta) navFichosCta.classList.remove("hidden");
    if (navAuthBtn) navAuthBtn.classList.remove("hidden");
    if (bottomNav) bottomNav.classList.remove("hidden");

    if (adminBtn) {
      if (currentUser.isSuperadmin) {
        adminBtn.classList.remove("hidden");
      } else {
        adminBtn.classList.add("hidden");
      }
    }

    updateAllPageComponents();
    loadUserHistoryFromDB();
  }
}

function toggleAuthMode(mode) {
  const formLogin = document.getElementById("auth-login-form");
  const formRegister = document.getElementById("auth-register-form");
  const headerTitle = document.getElementById("login-header-title");
  const headerSub = document.getElementById("login-header-sub");

  if (mode === "register") {
    if (formLogin) formLogin.classList.add("hidden");
    if (formRegister) formRegister.classList.remove("hidden");
    if (headerTitle) headerTitle.textContent = "Únete a Crunch Club";
    if (headerSub) headerSub.textContent = "Crea tu cuenta hoy y recibe 2 Fichos Gratis de regalo de bienvenida.";
  } else {
    if (formLogin) formLogin.classList.remove("hidden");
    if (formRegister) formRegister.classList.add("hidden");
    if (headerTitle) headerTitle.textContent = "Cada crujido cuenta";
    if (headerSub) headerSub.textContent = "En tu 7ª compra de Crispetas, Crunch invita. Ingresa a tu billetera.";
  }
}

// ==========================================================================
// 6. ACTUALIZACIÓN VISUAL DEL ESTADO (BILLETERA & 7 FICHOS)
// ==========================================================================
function updateAllPageComponents() {
  if (!currentUser) return;

  const fichos = Math.min(currentUser.fichos, 7);
  const remaining = Math.max(0, 7 - fichos);
  const isSeven = fichos >= 7;
  const progressPercent = Math.round((fichos / 7) * 100);

  // Top Bar
  const navFichosBadge = document.getElementById("nav-fichos-badge");
  if (navFichosBadge) navFichosBadge.textContent = `${fichos}/7`;

  const navUserPillName = document.getElementById("nav-user-pill-name");
  if (navUserPillName) navUserPillName.textContent = currentUser.name.split(" ")[0];

  const topAvatar = document.getElementById("top-user-avatar");
  const clubAvatarInitials = document.getElementById("club-avatar-initials");
  const initials = currentUser.name
    .split(" ")
    .map(n => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "CR";

  if (topAvatar) topAvatar.textContent = initials;
  if (clubAvatarInitials) clubAvatarInitials.textContent = initials;

  // Perfil Card
  const clubUserName = document.getElementById("club-user-name");
  const clubUserEmail = document.getElementById("club-user-email");
  const clubTierBadge = document.getElementById("club-tier-badge");

  if (clubUserName) clubUserName.textContent = currentUser.name;
  if (clubUserEmail) clubUserEmail.textContent = currentUser.email;
  if (clubTierBadge) {
    clubTierBadge.textContent = isSeven
      ? "¡Crispetas Gratis Listas para Canjear!"
      : (currentUser.isSuperadmin ? "Superadmin Crunch" : "Miembro Crunch Club");
  }

  // Métricas
  const metricFichos = document.getElementById("metric-fichos-count");
  const metricRemaining = document.getElementById("metric-remaining-count");
  const metricPercent = document.getElementById("metric-progress-percent");

  if (metricFichos) metricFichos.textContent = `${fichos} / 7`;
  if (metricRemaining) {
    metricRemaining.textContent = isSeven ? "¡Canje listo!" : `${remaining} Crispetas`;
  }
  if (metricPercent) metricPercent.textContent = `${progressPercent}%`;

  // Billetera & Barra de Progreso
  const progressFill = document.getElementById("wallet-progress-fill");
  const percentText = document.getElementById("wallet-percent-text");
  const summaryText = document.getElementById("wallet-summary-text");

  if (progressFill) progressFill.style.width = `${progressPercent}%`;
  if (percentText) percentText.textContent = `${progressPercent}%`;

  if (summaryText) {
    if (isSeven) {
      summaryText.innerHTML = `<strong>¡Meta Cumplida!</strong> Tus 7 fichos están completos. Reclama tu paquete de <strong>Crispetas 100% Gratis</strong>.`;
    } else {
      summaryText.innerHTML = `Tienes <strong>${fichos} de 7</strong> fichos para Crispetas (faltan <strong>${remaining}</strong> para tu premio).`;
    }
  }

  // Slots 1 al 7
  const trackSlots = document.querySelectorAll(".mobile-ficho-item");
  trackSlots.forEach(slot => {
    const index = parseInt(slot.getAttribute("data-index"), 10);
    if (index <= fichos) {
      slot.classList.add("completed");
    } else {
      slot.classList.remove("completed");
    }
  });

  // Botón de Canje de 7 Fichos
  const btnClaim = document.getElementById("btn-claim-reward");
  if (btnClaim) {
    if (isSeven) {
      btnClaim.classList.remove("hidden");
    } else {
      btnClaim.classList.add("hidden");
    }
  }
}

// ==========================================================================
// 7. CARGA DINÁMICA DE HISTORIAL DESDE LA BASE DE DATOS
// ==========================================================================
async function loadUserHistoryFromDB() {
  if (!currentUser) return;
  const historyList = document.getElementById("history-list");
  const countBadge = document.getElementById("history-count-badge");
  if (!historyList) return;

  try {
    const allSales = await window.CrunchDB.getAllSales();
    const userSales = allSales.filter(s => s.user_id === currentUser.id);

    if (countBadge) {
      countBadge.textContent = `${userSales.length} compras`;
    }

    if (userSales.length === 0) {
      historyList.innerHTML = `
        <div style="text-align: center; color: var(--gris-text-muted); font-size: 0.8rem; padding: 20px 8px;">
          No tienes compras registradas en la base de datos aún.<br>
          <span style="font-size: 0.75rem; color: #64748B;">Tu cuenta cuenta con 2 fichos gratis de bienvenida.</span>
        </div>
      `;
      return;
    }

    historyList.innerHTML = userSales.slice(0, 10).map(s => {
      const dateFormatted = new Date(s.created_at).toLocaleDateString("es-CO", {
        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
      });
      return `
        <div class="mobile-history-row">
          <div class="history-name-date">
            <span class="history-product-name">${escapeHtml(s.product_name)}</span>
            <span class="history-date">${dateFormatted} &middot; $${s.total_price.toLocaleString("es-CO")} COP</span>
          </div>
          <span class="history-ficho-badge">${s.fichos_granted > 0 ? `+${s.fichos_granted} Ficho${s.fichos_granted > 1 ? 's' : ''}` : 'Compra'}</span>
        </div>
      `;
    }).join("");

  } catch (err) {
    historyList.innerHTML = `<div style="text-align: center; color: #EF4444; font-size: 0.8rem; padding: 12px;">Error al cargar compras: ${err.message}</div>`;
  }
}

// ==========================================================================
// 8. CATÁLOGO DINÁMICO DESDE SUPABASE DB
// ==========================================================================
async function loadCatalogFromDB() {
  const container = document.getElementById("catalog-products-grid");
  if (!container || !window.CrunchDB) return;

  try {
    const products = await window.CrunchDB.getProducts();

    if (!products || products.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 30px; color: var(--gris-text-muted);">
          No hay productos registrados en la base de datos de Supabase.<br>
          <span style="font-size: 0.8rem;">Crea productos desde el Panel de Superadmin o ejecuta schema.sql.</span>
        </div>
      `;
      return;
    }

    container.innerHTML = products.map(p => {
      const isCrispetas = p.name.trim().toLowerCase() === "crispetas";
      const priceFormatted = parseFloat(p.price).toLocaleString("es-CO");
      return `
        <div class="mobile-snack-card" style="display: flex; flex-direction: column; justify-content: space-between;">
          <div class="snack-thumb-box" style="background: ${isCrispetas ? 'linear-gradient(135deg, #011C51, #0A2F7C)' : '#F8FAFC'}; height: 140px; display: flex; align-items: center; justify-content: center; position: relative;">
            <div style="text-align: center; color: ${isCrispetas ? '#FECC35' : '#011C51'};">
              <span style="font-size: 2.2rem; display: block; line-height: 1;">🍿</span>
              <span style="font-size: 0.75rem; font-weight: 800; text-transform: uppercase;">Crunch Gourmet</span>
            </div>
            ${isCrispetas ? '<span class="snack-thumb-badge" style="background: #FEA704; color: #011C51; font-weight: 900;">★ 7 Fichos Oficial</span>' : (p.is_ficho_eligible ? '<span class="snack-thumb-badge">+1 Ficho</span>' : '')}
          </div>
          <div class="snack-thumb-info" style="padding: 14px; flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <h4 class="snack-thumb-title" style="font-size: 0.95rem; font-weight: 800; color: #011C51; margin-bottom: 4px;">${escapeHtml(p.name)}</h4>
              <p style="font-size: 0.75rem; color: #64748B; margin-bottom: 8px;">${escapeHtml(p.description || 'Snack Crunch delicioso y artesanal.')}</p>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
              <span class="snack-thumb-price" style="font-size: 1rem; font-weight: 900; color: #011C51;">$${priceFormatted} COP</span>
              ${isCrispetas ? '<span style="font-size: 0.7rem; font-weight: 800; color: #B45309; background: #FFFBEB; padding: 2px 6px; border-radius: 4px;">Premio Gratis</span>' : ''}
            </div>
          </div>
        </div>
      `;
    }).join("");

  } catch (err) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 24px; color: #EF4444; font-size: 0.85rem;">
        No se pudo cargar el catálogo de Supabase: ${err.message}<br>
        <button onclick="openSupabaseModal()" class="btn-mobile-secondary" style="margin-top: 10px; width: auto; display: inline-flex; padding: 8px 16px;">
          Configurar Conexión DB
        </button>
      </div>
    `;
  }
}

// ==========================================================================
// 9. RECLAMO DE CÓDIGOS QR & INPUT DE COMPRA (DIRECTO EN SUPABASE DB)
// ==========================================================================
async function handleRegisterPurchase(event) {
  event.preventDefault();
  const input = document.getElementById("purchase-code-input");
  const code = input ? input.value.trim() : "";
  if (!code) return;

  await processQRClaim(code);
  if (input) input.value = "";
}

async function processQRClaim(code) {
  if (!code) return;

  if (!currentUser) {
    sessionStorage.setItem("pending_ficho_code", code);
    showToast("Inicia Sesión", "Ingresa a tu cuenta para reclamar tu ficho.");
    showView("login");
    return;
  }

  showToast("Validando con DB...", `Comprobando código QR ${code} en Supabase.`);

  try {
    const res = await window.CrunchDB.claimQRCode(code, currentUser.id);
    currentUser.fichos = res.new_balance;
    localStorage.setItem("crunch_active_user", JSON.stringify(currentUser));
    updateAllPageComponents();
    triggerConfetti();
    showToast("¡Ficho Reclamado!", res.message);
    await loadUserHistoryFromDB();
  } catch (err) {
    showToast("Aviso Código QR", err.message);
  }
}

// ==========================================================================
// 10. CANJE DE 7 FICHOS POR CRISPETAS GRATIS (DIRECTO EN DB)
// ==========================================================================
function openClaimModal() {
  const modal = document.getElementById("modal-claim");
  if (modal) {
    modal.classList.remove("hidden");
    triggerConfetti();
  }
}

function closeClaimModal() {
  const modal = document.getElementById("modal-claim");
  if (modal) modal.classList.add("hidden");
}

async function confirmRewardRedemption() {
  if (!currentUser) return;
  showToast("Procesando Canje...", "Actualizando saldo en Supabase DB.");

  try {
    const res = await window.CrunchDB.redeemSevenFichos(currentUser.id);
    currentUser.fichos = res.remaining_fichos;
    localStorage.setItem("crunch_active_user", JSON.stringify(currentUser));
    closeClaimModal();
    updateAllPageComponents();
    triggerConfetti();
    showToast("¡Crispetas Canjeadas!", "Premio validado en la base de datos. Reclámalo en tienda con tu correo.");
    await loadUserHistoryFromDB();
  } catch (err) {
    showToast("Aviso Canje", err.message);
  }
}

// ==========================================================================
// 11. TOAST NOTIFICATION & CONFETTI
// ==========================================================================
let toastTimer = null;
function showToast(title, message) {
  const toast = document.getElementById("toast");
  const toastTitle = document.getElementById("toast-title");
  const toastMessage = document.getElementById("toast-message");

  if (!toast) return;

  if (toastTitle) toastTitle.textContent = title;
  if (toastMessage) toastMessage.textContent = message;

  toast.classList.remove("hidden");

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.add("hidden");
  }, 4000);
}

function triggerConfetti() {
  const canvas = document.getElementById("confetti-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const confettiCount = 100;
  const colors = ["#011C51", "#FEA704", "#FECC35", "#FEDE6C", "#FFFFFF"];
  const particles = [];

  for (let i = 0; i < confettiCount; i++) {
    particles.push({
      x: window.innerWidth / 2 + (Math.random() - 0.5) * 220,
      y: window.innerHeight / 2 - 100,
      r: Math.random() * 5 + 3,
      d: Math.random() * confettiCount,
      color: colors[Math.floor(Math.random() * colors.length)],
      tilt: Math.random() * 10 - 10,
      tiltAngleIncremental: Math.random() * 0.07 + 0.05,
      tiltAngle: 0,
      vx: (Math.random() - 0.5) * 14,
      vy: Math.random() * -10 - 4,
      gravity: 0.35,
      friction: 0.98
    });
  }

  let animationFrame;
  let frameCount = 0;

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    frameCount++;

    particles.forEach(p => {
      p.tiltAngle += p.tiltAngleIncremental;
      p.vy += p.gravity;
      p.vx *= p.friction;
      p.x += p.vx;
      p.y += p.vy;
      p.tilt = Math.sin(p.tiltAngle) * 12;

      ctx.beginPath();
      ctx.lineWidth = p.r;
      ctx.strokeStyle = p.color;
      ctx.moveTo(p.x + p.tilt + p.r / 2, p.y);
      ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
      ctx.stroke();
    });

    if (frameCount < 140) {
      animationFrame = requestAnimationFrame(render);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      cancelAnimationFrame(animationFrame);
    }
  }

  render();
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

function handleBottomNav(target) {
  if (target === "wallet") {
    const el = document.getElementById("seccion-billetera");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  } else if (target === "add") {
    const el = document.getElementById("seccion-acciones");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  } else if (target === "catalog") {
    const el = document.getElementById("seccion-catalogo");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  } else if (target === "help") {
    const el = document.getElementById("seccion-soporte");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  }
}

window.addEventListener("click", e => {
  const modalClaim = document.getElementById("modal-claim");
  if (e.target === modalClaim) closeClaimModal();
});
