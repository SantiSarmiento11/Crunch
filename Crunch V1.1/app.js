/**
 * Crunch Snacks V1.1 - Pure JavaScript Mobile App Engine
 * UI/UX Especializada para Teléfonos Móviles
 * Paleta Oficial:
 * - Azul #011C51 | Naranja #FEA704 | Amarillo #FECC35 | Blanco #FFFFFF | Gris #F5F6FA
 * Cero Emojis - Iconografía 100% SVG
 * Conectado con Supabase DB vía crunch-supabase.js
 */

// ==========================================================================
// 1. ESTADO GLOBAL & PERSISTENCIA (LOCALSTORAGE / SESSIONSTORAGE / SUPABASE)
// ==========================================================================
const DEFAULT_USER_STATE = {
  isLoggedIn: false,
  id: 1,
  name: "Santiago Sarmiento",
  email: "santiago@crunch.com",
  tier: "Crunch Enthusiast",
  fichos: 2, // Por regla de negocio: cada cuenta inicia con 2 fichos gratis
  isSuperadmin: true,
  history: [],
  totalRewardsClaimed: 0
};

let currentUser = loadUserData();
let currentView = currentUser.isLoggedIn ? "info" : "login";

function loadUserData() {
  try {
    const saved = localStorage.getItem("crunch_user_data");
    const sessionActive = sessionStorage.getItem("crunch_session_active") === "true";
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_USER_STATE, ...parsed, isLoggedIn: sessionActive };
    }
  } catch (e) {
    console.error("Error al acceder al almacenamiento:", e);
  }
  return { ...DEFAULT_USER_STATE, isLoggedIn: false };
}

function saveUserData() {
  try {
    localStorage.setItem("crunch_user_data", JSON.stringify(currentUser));
  } catch (e) {
    console.error("Error al guardar en localStorage:", e);
  }
  updateAllPageComponents();
}

// ==========================================================================
// 2. SINCRONIZACIÓN CON SUPABASE DB EN JAVASCRIPT
// ==========================================================================
async function syncUserDataWithSupabase() {
  if (!window.CrunchDB) return;

  try {
    const users = await window.CrunchDB.getUsers();
    const match = users.find(u => u.email.toLowerCase() === currentUser.email.toLowerCase());
    if (match) {
      currentUser.id = match.id;
      currentUser.name = match.full_name;
      currentUser.fichos = match.fichos_balance;
      currentUser.isSuperadmin = (match.roles || []).some(r => r.name === "Superadmin");
      
      const adminBtn = document.getElementById("nav-admin-shortcut");
      if (adminBtn) {
        if (currentUser.isSuperadmin) {
          adminBtn.classList.remove("hidden");
        } else {
          adminBtn.classList.add("hidden");
        }
      }

      saveUserData();
    }

    // Cargar compras del usuario
    const sales = await window.CrunchDB.getAllSales();
    const mySales = sales.filter(s => s.user_id === currentUser.id);
    if (mySales.length > 0) {
      currentUser.history = mySales.map(s => ({
        id: s.id,
        product: s.product_name || "Crispetas",
        date: new Date(s.created_at).toLocaleDateString("es-CO", { day: "2-digit", month: "short" }),
        fichoNumber: s.fichos_granted > 0 ? `+${s.fichos_granted}` : "Compra"
      }));
      saveUserData();
    }
  } catch (err) {
    console.warn("Aviso al sincronizar con DB:", err);
  }
}

// ==========================================================================
// 3. CONTROL DE VISTAS MÓVILES
// ==========================================================================
function showView(viewName) {
  currentView = viewName;
  const viewLogin = document.getElementById("view-login");
  const viewInfo = document.getElementById("view-user-info");
  const navUserPill = document.getElementById("nav-user-pill-container");
  const navFichosCta = document.getElementById("nav-fichos-cta");
  const navAuthBtn = document.getElementById("nav-auth-toggle-btn");
  const bottomNav = document.getElementById("mobile-bottom-nav");
  const topBar = document.querySelector(".mobile-top-bar");
  const adminBtn = document.getElementById("nav-admin-shortcut");

  if (viewName === "login") {
    if (viewLogin) viewLogin.classList.remove("hidden");
    if (viewInfo) viewInfo.classList.add("hidden");

    if (navUserPill) navUserPill.classList.add("hidden");
    if (navFichosCta) navFichosCta.classList.add("hidden");
    if (navAuthBtn) navAuthBtn.classList.add("hidden");
    if (adminBtn) adminBtn.classList.add("hidden");

    if (bottomNav) bottomNav.classList.add("hidden");
    if (topBar) topBar.classList.add("top-bar-centered");

    toggleAuthMode("login");

    const mainContent = document.querySelector(".mobile-main-content");
    if (mainContent) mainContent.scrollTop = 0;
  } else {
    currentUser.isLoggedIn = true;
    try {
      sessionStorage.setItem("crunch_session_active", "true");
    } catch (e) {}
    saveUserData();

    if (viewLogin) viewLogin.classList.add("hidden");
    if (viewInfo) viewInfo.classList.remove("hidden");

    if (navUserPill) navUserPill.classList.remove("hidden");
    if (navFichosCta) navFichosCta.classList.remove("hidden");
    if (navAuthBtn) navAuthBtn.classList.remove("hidden");
    if (adminBtn && currentUser.isSuperadmin) adminBtn.classList.remove("hidden");

    if (bottomNav) bottomNav.classList.remove("hidden");
    if (topBar) topBar.classList.remove("top-bar-centered");

    setActiveBottomTab("wallet");
    updateAllPageComponents();
    syncUserDataWithSupabase();
  }
}

function handleLogoClick() {
  if (currentUser.isLoggedIn) {
    showView("info");
    const el = document.getElementById("seccion-perfil");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  } else {
    showView("login");
  }
}

function handleNavAuthClick() {
  if (currentUser.isLoggedIn) {
    handleLogout();
  } else {
    showView("login");
  }
}

// ==========================================================================
// 4. NAVEGACIÓN INFERIOR MÓVIL
// ==========================================================================
function handleBottomNav(target) {
  setActiveBottomTab(target);

  if (currentView !== "info") {
    showView("info");
  }

  if (target === "wallet") {
    const el = document.getElementById("seccion-billetera");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  } else if (target === "add") {
    const el = document.getElementById("seccion-acciones");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
      setTimeout(() => {
        const input = document.getElementById("purchase-code-input");
        if (input) input.focus();
      }, 350);
    }
  } else if (target === "catalog") {
    const el = document.getElementById("seccion-catalogo");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  } else if (target === "help") {
    const el = document.getElementById("seccion-soporte");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  }
}

function setActiveBottomTab(tabName) {
  const tabs = {
    wallet: document.getElementById("tab-nav-wallet"),
    add: document.getElementById("tab-nav-add"),
    catalog: document.getElementById("tab-nav-catalog"),
    help: document.getElementById("tab-nav-help")
  };

  Object.keys(tabs).forEach(k => {
    if (tabs[k]) {
      if (k === tabName) {
        tabs[k].classList.add("active");
      } else {
        tabs[k].classList.remove("active");
      }
    }
  });
}

// ==========================================================================
// 5. ACTUALIZACIÓN DINÁMICA DE LA INTERFAZ
// ==========================================================================
function updateAllPageComponents() {
  // REGLA: Los 7 fichos aplican para "Crispetas" ($2.000 COP)
  const fichos = Math.min(currentUser.fichos, 7);
  const remaining = Math.max(0, 7 - fichos);
  const isSeven = fichos >= 7;
  const progressPercent = Math.round((fichos / 7) * 100);

  // A. Top Bar
  const navFichosBadge = document.getElementById("nav-fichos-badge");
  if (navFichosBadge) navFichosBadge.textContent = `${fichos}/7`;

  const navUserPillName = document.getElementById("nav-user-pill-name");
  if (navUserPillName) navUserPillName.textContent = (currentUser.name || "Usuario").split(" ")[0];

  const topAvatar = document.getElementById("top-user-avatar");
  const clubAvatarInitials = document.getElementById("club-avatar-initials");
  const initials = (currentUser.name || "SS")
    .split(" ")
    .map(n => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "SS";

  if (topAvatar) topAvatar.textContent = initials;
  if (clubAvatarInitials) clubAvatarInitials.textContent = initials;

  // B. Perfil de Usuario
  const clubUserName = document.getElementById("club-user-name");
  const clubUserEmail = document.getElementById("club-user-email");
  const clubTierBadge = document.getElementById("club-tier-badge");

  if (clubUserName) clubUserName.textContent = currentUser.name;
  if (clubUserEmail) clubUserEmail.textContent = currentUser.email;
  if (clubTierBadge) {
    clubTierBadge.textContent = isSeven ? "¡Crispetas Gratis Desbloqueadas!" : (currentUser.isSuperadmin ? "Superadmin Crunch" : currentUser.tier);
  }

  // C. Métricas Resumidas
  const metricFichos = document.getElementById("metric-fichos-count");
  const metricRemaining = document.getElementById("metric-remaining-count");
  const metricPercent = document.getElementById("metric-progress-percent");
  const metricRewards = document.getElementById("metric-rewards-claimed");

  if (metricFichos) metricFichos.textContent = `${fichos} / 7`;
  if (metricRemaining) {
    metricRemaining.textContent = isSeven ? "¡Canje listo!" : `${remaining} Crispetas`;
  }
  if (metricPercent) metricPercent.textContent = `${progressPercent}%`;
  if (metricRewards) {
    metricRewards.textContent = `${currentUser.totalRewardsClaimed || 0} Crispetas`;
  }

  // D. Billetera de Fichos
  const progressFill = document.getElementById("wallet-progress-fill");
  const percentText = document.getElementById("wallet-percent-text");
  const summaryText = document.getElementById("wallet-summary-text");

  if (progressFill) progressFill.style.width = `${progressPercent}%`;
  if (percentText) percentText.textContent = `${progressPercent}%`;

  if (summaryText) {
    if (isSeven) {
      summaryText.innerHTML = `<strong>¡Meta Cumplida!</strong> Tus 7 fichos están listos. Reclama tu paquete de <strong>Crispetas 100% Gratis</strong>.`;
    } else {
      summaryText.innerHTML = `Tienes <strong>${fichos} de 7</strong> fichos para Crispetas (faltan <strong>${remaining}</strong> para tu premio).`;
    }
  }

  // E. Ranuras de Fichos (Slots 1 al 7)
  const trackSlots = document.querySelectorAll(".mobile-ficho-item");
  trackSlots.forEach(slot => {
    const index = parseInt(slot.getAttribute("data-index"), 10);
    if (index <= fichos) {
      slot.classList.add("completed");
    } else {
      slot.classList.remove("completed");
    }
  });

  // F. Botón de Canje al llegar a 7
  const btnClaim = document.getElementById("btn-claim-reward");
  if (btnClaim) {
    if (isSeven) {
      btnClaim.classList.remove("hidden");
    } else {
      btnClaim.classList.add("hidden");
    }
  }

  // G. Renderizar Historial
  renderHistoryList();
}

function renderHistoryList() {
  const historyList = document.getElementById("history-list");
  const countBadge = document.getElementById("history-count-badge");
  if (!historyList) return;

  if (!currentUser.history || currentUser.history.length === 0) {
    historyList.innerHTML = `
      <div style="text-align: center; color: var(--gris-text-muted); font-size: 0.75rem; padding: 18px 8px;">
        Cuenta con 2 fichos de cortesía iniciales. Suma comprando Crispetas o escanea un QR.
      </div>
    `;
    if (countBadge) countBadge.textContent = "2 fichos iniciales";
    return;
  }

  if (countBadge) {
    countBadge.textContent = `${currentUser.history.length} compras`;
  }

  const itemsHtml = currentUser.history
    .slice()
    .reverse()
    .slice(0, 6)
    .map(item => `
      <div class="mobile-history-row">
        <div class="history-name-date">
          <span class="history-product-name">${escapeHtml(item.product)}</span>
          <span class="history-date">${escapeHtml(item.date)}</span>
        </div>
        <span class="history-ficho-badge">${item.fichoNumber}</span>
      </div>
    `)
    .join("");

  historyList.innerHTML = itemsHtml;
}

// ==========================================================================
// 6. AUTENTICACIÓN: LOGIN & REGISTRO (CON 2 FICHOS INICIALES GRATIS)
// ==========================================================================
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

async function handleLoginSubmit(event) {
  event.preventDefault();
  const email = document.getElementById("login-email").value.trim();

  // Buscar en Supabase DB
  let foundUser = null;
  if (window.CrunchDB) {
    try {
      const users = await window.CrunchDB.getUsers();
      foundUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    } catch (e) {}
  }

  currentUser.isLoggedIn = true;
  currentUser.email = email;
  if (foundUser) {
    currentUser.id = foundUser.id;
    currentUser.name = foundUser.full_name;
    currentUser.fichos = foundUser.fichos_balance;
    currentUser.isSuperadmin = (foundUser.roles || []).some(r => r.name === "Superadmin");
  } else {
    currentUser.id = Date.now();
    currentUser.name = email.split("@")[0].replace(".", " ");
    currentUser.fichos = 2; // Inicia con 2 fichos
    currentUser.isSuperadmin = email.includes("santiago");
  }

  sessionStorage.setItem("crunch_session_active", "true");
  saveUserData();

  showToast("Bienvenido", `Hola ${currentUser.name.split(" ")[0]}. Saldo: ${currentUser.fichos} fichos.`);
  showView("info");

  // Reclamar QR pendiente si venía en el enlace
  checkPendingQRClaim();
}

async function handleRegisterSubmit(event) {
  event.preventDefault();
  const full_name = document.getElementById("reg-name").value.trim();
  const email = document.getElementById("reg-email").value.trim();

  try {
    let createdUser = null;
    if (window.CrunchDB) {
      // Registrar usuario en Supabase DB con 2 fichos iniciales gratis
      createdUser = await window.CrunchDB.createUser({
        full_name,
        email,
        initial_fichos: 2,
        role: "Cliente"
      });
    }

    currentUser.isLoggedIn = true;
    currentUser.id = createdUser ? createdUser.id : Date.now();
    currentUser.name = full_name;
    currentUser.email = email;
    currentUser.fichos = 2; // 2 FICHOS INICIALES GRATIS OBLIGATORIOS
    currentUser.isSuperadmin = false;

    sessionStorage.setItem("crunch_session_active", "true");
    saveUserData();

    triggerConfetti();
    showToast("¡Cuenta Creada!", `¡Bienvenido ${full_name.split(" ")[0]}! Tienes 2 fichos gratis de bienvenida.`);
    showView("info");

    checkPendingQRClaim();
  } catch (err) {
    showToast("Aviso Registro", err.message || "Error al registrar cuenta.");
  }
}

function handleQuickDemoLogin() {
  document.getElementById("login-email").value = "santiago@crunch.com";
  document.getElementById("login-password").value = "crunch2026";
  const fakeEvt = { preventDefault: () => {} };
  handleLoginSubmit(fakeEvt);
}

function handleLogout() {
  currentUser.isLoggedIn = false;
  try {
    sessionStorage.removeItem("crunch_session_active");
  } catch (e) {}
  saveUserData();
  showToast("Sesión Cerrada", "Has vuelto a la pantalla de ingreso.");
  showView("login");
}

// ==========================================================================
// 7. SISTEMA DE RECLAMO DE CÓDIGOS QR & COMPRAS
// ==========================================================================
async function handleRegisterPurchase(event) {
  event.preventDefault();
  const input = document.getElementById("purchase-code-input");
  const code = input ? input.value.trim() : "";
  if (!code) return;

  await claimQRCode(code);
  if (input) input.value = "";
}

async function claimQRCode(code) {
  if (!code) return;

  if (!currentUser.isLoggedIn) {
    sessionStorage.setItem("pending_ficho_code", code);
    showToast("Inicia Sesión", "Ingresa a tu cuenta para reclamar tu ficho.");
    showView("login");
    return;
  }

  try {
    if (window.CrunchDB) {
      const res = await window.CrunchDB.claimQRCode(code, currentUser.id);
      currentUser.fichos = res.new_balance;
      saveUserData();
      triggerConfetti();
      showToast("¡Ficho Reclamado!", res.message || "+1 Ficho sumado con éxito.");
      await syncUserDataWithSupabase();
    } else {
      currentUser.fichos = Math.min(currentUser.fichos + 1, 7);
      saveUserData();
      showToast("+1 Ficho Sumado", `Código ${code} procesado.`);
    }
  } catch (err) {
    showToast("Aviso Código QR", err.message || "Código inválido o ya reclamado.");
  }
}

function checkPendingQRClaim() {
  const pending = sessionStorage.getItem("pending_ficho_code");
  if (pending && currentUser.isLoggedIn) {
    sessionStorage.removeItem("pending_ficho_code");
    setTimeout(() => {
      claimQRCode(pending);
    }, 500);
  }
}

function quickAddFicho(productName) {
  if (productName.toLowerCase() !== "crispetas") {
    showToast("Regla de Fichos", `Los fichos de fidelización aplican para 'Crispetas' ($2.000 COP).`);
  }
  currentUser.fichos = Math.min(currentUser.fichos + 1, 7);
  saveUserData();
  if (currentUser.fichos >= 7) {
    triggerConfetti();
    showToast("¡7 Fichos Completados!", "Tu paquete de Crispetas gratis está listo para canjear.");
    setTimeout(openClaimModal, 300);
  } else {
    showToast("+1 Ficho Sumado", `Saldo actual: ${currentUser.fichos}/7 fichos.`);
  }
}

function reachSevenFichosDemo() {
  currentUser.fichos = 7;
  saveUserData();
  triggerConfetti();
  showToast("¡7 Fichos!", "Listo para canjear tus Crispetas gratis.");
  setTimeout(openClaimModal, 400);
}

function resetFichosDemo() {
  currentUser.fichos = 2; // Reiniciar a los 2 fichos iniciales gratis
  saveUserData();
  showToast("Billetera Reiniciada", "Saldo restablecido a 2 fichos iniciales gratis.");
}

// ==========================================================================
// 8. CANJE DE CRISPETAS (7MO FICHO)
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
  try {
    if (window.CrunchDB) {
      const res = await window.CrunchDB.redeemSevenFichos(currentUser.id);
      currentUser.fichos = res.remaining_fichos;
    } else {
      currentUser.fichos = Math.max(0, currentUser.fichos - 7);
    }

    currentUser.totalRewardsClaimed = (currentUser.totalRewardsClaimed || 0) + 1;
    saveUserData();
    closeClaimModal();
    triggerConfetti();
    showToast("¡Crispetas Canjeadas!", "Cupón generado: CRUNCH-CRISPETAS-7F. Reclámalo en tienda.");
  } catch (err) {
    showToast("Aviso Canje", err.message || "Error al canjear fichos.");
  }
}

// ==========================================================================
// 9. TOAST & CONFETTI
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

window.addEventListener("click", e => {
  const modalClaim = document.getElementById("modal-claim");
  if (e.target === modalClaim) closeClaimModal();
});

// ==========================================================================
// 10. INICIALIZACIÓN & DETECCIÓN DE CÓDIGO QR EN URL
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
  // 1. Detectar si viene un código QR en la URL (?claim=CRUNCH-... o ?code=...)
  // "que te redirige a la página y reclama tu ficho"
  const urlParams = new URLSearchParams(window.location.search);
  const claimCode = urlParams.get("claim") || urlParams.get("code");

  if (claimCode) {
    if (currentUser.isLoggedIn) {
      claimQRCode(claimCode);
    } else {
      sessionStorage.setItem("pending_ficho_code", claimCode);
      showToast("¡Código QR Detectado!", "Inicia sesión o regístrate para sumar tu ficho.");
    }
    try {
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (e) {}
  }

  // 2. Control inicial de vistas
  if (currentUser.isLoggedIn) {
    showView("info");
  } else {
    showView("login");
  }
});
