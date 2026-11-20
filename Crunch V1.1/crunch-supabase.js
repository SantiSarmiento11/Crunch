/**
 * Crunch Snacks - Supabase Pure JavaScript Engine
 * Maneja toda la lógica de negocio directamente en JS y se comunica con Supabase DB.
 * Proyecto: https://tivjxgevzavibkrqdgyn.supabase.co
 */

(function (window) {
  const SUPABASE_PROJECT_URL = "https://tivjxgevzavibkrqdgyn.supabase.co";
  
  // Clave pública (Anon Key). Se lee de localStorage o configuración
  const STORAGE_KEY_ANON = "crunch_supabase_anon_key";

  // Memoria / LocalStorage Fallback (para garantizar funcionamiento offline o previo a ingresar anon key)
  const LOCAL_DB_KEY = "crunch_local_db_state";

  function getSavedAnonKey() {
    return localStorage.getItem(STORAGE_KEY_ANON) || "";
  }

  function setSavedAnonKey(key) {
    if (key) {
      localStorage.setItem(STORAGE_KEY_ANON, key.trim());
    } else {
      localStorage.removeItem(STORAGE_KEY_ANON);
    }
  }

  // Inicializar cliente Supabase si window.supabase está disponible
  let supabaseClient = null;

  function initClient() {
    const key = getSavedAnonKey();
    if (window.supabase && key) {
      try {
        supabaseClient = window.supabase.createClient(SUPABASE_PROJECT_URL, key);
        console.log("Cliente Supabase JS inicializado con éxito.");
      } catch (e) {
        console.warn("No se pudo inicializar cliente Supabase:", e);
        supabaseClient = null;
      }
    } else {
      supabaseClient = null;
    }
    return supabaseClient;
  }

  // =========================================================================
  // LOCAL FALLBACK DB (Garantiza que la UI funcione sin romperse en ningún caso)
  // =========================================================================
  function getLocalDB() {
    const defaultData = {
      products: [
        {
          id: 1,
          name: "Crispetas",
          price: 2000.0,
          description: "Crispetas Crunch Gourmet - Primer dato en la DB. Aplica para los 7 fichos.",
          is_ficho_eligible: true,
          created_at: new Date().toISOString()
        },
        {
          id: 2,
          name: "Papas Rústicas Sal Marina",
          price: 4500.0,
          description: "Papas artesanales cocinadas lentamente con sal marina",
          is_ficho_eligible: false,
          created_at: new Date().toISOString()
        },
        {
          id: 3,
          name: "Palomitas Caramelo Crunch",
          price: 4200.0,
          description: "Palomitas gourmet con cobertura crocante de caramelo",
          is_ficho_eligible: false,
          created_at: new Date().toISOString()
        }
      ],
      users: [
        {
          id: 1,
          full_name: "Santiago Sarmiento",
          email: "santiago@crunch.com",
          phone: "+57 300 123 4567",
          fichos_balance: 2, // 2 fichos iniciales
          roles: [{ name: "Superadmin" }],
          created_at: new Date().toISOString()
        },
        {
          id: 2,
          full_name: "Camila Morales",
          email: "camila@ejemplo.com",
          phone: "+57 310 987 6543",
          fichos_balance: 2, // 2 fichos iniciales
          roles: [{ name: "Cliente" }],
          created_at: new Date().toISOString()
        }
      ],
      sales: [
        {
          id: 1,
          user_id: 1,
          product_id: 1,
          quantity: 2,
          unit_price: 2000.0,
          total_price: 4000.0,
          fichos_granted: 2,
          description: "Venta inicial mostrador sede principal",
          customer_name: "Santiago Sarmiento",
          customer_email: "santiago@crunch.com",
          product_name: "Crispetas",
          created_at: new Date().toISOString()
        }
      ],
      qr_codes: [
        {
          id: 1,
          code: "CRUNCH-F1-BIENVENIDA",
          fichos_value: 1,
          is_used: false,
          created_at: new Date().toISOString()
        }
      ],
      ficho_transactions: [
        {
          id: 1,
          user_id: 1,
          amount: 2,
          balance_after: 2,
          transaction_type: "WELCOME_GIFT",
          description: "Bienvenida Crunch: 2 fichos iniciales gratis de cortesía",
          created_at: new Date().toISOString()
        }
      ]
    };

    try {
      const stored = localStorage.getItem(LOCAL_DB_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(defaultData));
    return defaultData;
  }

  function saveLocalDB(data) {
    try {
      localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  // =========================================================================
  // SERVICIOS & LÓGICA DE NEGOCIO EN JS
  // =========================================================================
  const CrunchDB = {
    PROJECT_URL: SUPABASE_PROJECT_URL,

    getAnonKey: getSavedAnonKey,
    setAnonKey: function(key) {
      setSavedAnonKey(key);
      initClient();
    },

    isSupabaseConnected: function() {
      return !!supabaseClient;
    },

    async testSupabaseConnection() {
      if (!supabaseClient) initClient();
      if (!supabaseClient) return { success: false, message: "Anon Key no configurada" };
      try {
        const { data, error } = await supabaseClient.from("products").select("id, name, price").limit(1);
        if (error) throw error;
        return { success: true, message: "Conectado a Supabase correctamente", data };
      } catch (err) {
        return { success: false, message: err.message || "Error al conectar con Supabase" };
      }
    },

    // 1. OBTENER PRODUCTOS (Crispetas a 2.000 COP primero)
    async getProducts() {
      if (supabaseClient) {
        try {
          const { data, error } = await supabaseClient
            .from("products")
            .select("*")
            .order("id", { ascending: true });
          if (!error && data && data.length > 0) return data;
        } catch (e) {
          console.warn("Fallo lectura Supabase products, usando local:", e);
        }
      }
      const db = getLocalDB();
      return db.products.sort((a, b) => a.id - b.id);
    },

    // 2. CREAR PRODUCTO (Solo Superadmin)
    async createProduct({ name, price, description = "", is_ficho_eligible = true }) {
      const priceNum = parseFloat(price) || 0;
      const productPayload = {
        name: name.trim(),
        price: priceNum,
        description: description.trim(),
        is_ficho_eligible: !!is_ficho_eligible
      };

      if (supabaseClient) {
        try {
          const { data, error } = await supabaseClient
            .from("products")
            .insert([productPayload])
            .select()
            .single();
          if (!error && data) return data;
        } catch (e) {
          console.warn("Fallo insertar producto en Supabase, usando local:", e);
        }
      }

      // Local
      const db = getLocalDB();
      const newProd = {
        id: db.products.length ? Math.max(...db.products.map(p => p.id)) + 1 : 1,
        ...productPayload,
        created_at: new Date().toISOString()
      };
      db.products.push(newProd);
      saveLocalDB(db);
      return newProd;
    },

    // 3. OBTENER USUARIOS
    async getUsers() {
      if (supabaseClient) {
        try {
          const { data, error } = await supabaseClient
            .from("users")
            .select("*, user_roles(roles(*))")
            .order("id", { ascending: false });
          if (!error && data) {
            return data.map(u => ({
              ...u,
              roles: u.user_roles ? u.user_roles.map(ur => ur.roles) : []
            }));
          }
        } catch (e) {
          console.warn("Fallo getUsers Supabase, usando local:", e);
        }
      }
      const db = getLocalDB();
      return db.users.sort((a, b) => b.id - a.id);
    },

    // 4. CREAR CUENTA DE USUARIO (Con 2 fichos iniciales gratis)
    // "Al crear cada cuenta debe tener 2 fichos iniciales gratis"
    async createUser({ full_name, email, phone = "", initial_fichos = 2, role = "Cliente" }) {
      const emailClean = email.toLowerCase().trim();
      const fichosStart = parseInt(initial_fichos) >= 0 ? parseInt(initial_fichos) : 2;

      if (supabaseClient) {
        try {
          // A. Insertar usuario
          const { data: newUser, error: userErr } = await supabaseClient
            .from("users")
            .insert([{
              full_name: full_name.trim(),
              email: emailClean,
              phone: phone.trim(),
              fichos_balance: fichosStart,
              password_hash: "crunch2026",
              is_active: true
            }])
            .select()
            .single();

          if (userErr) throw userErr;

          // B. Asignar rol
          const { data: roleData } = await supabaseClient
            .from("roles")
            .select("id")
            .eq("name", role)
            .single();

          if (roleData) {
            await supabaseClient.from("user_roles").insert([{
              user_id: newUser.id,
              role_id: roleData.id
            }]);
          }

          // C. Registrar transacción de 2 fichos de regalo de bienvenida
          if (fichosStart > 0) {
            await supabaseClient.from("ficho_transactions").insert([{
              user_id: newUser.id,
              amount: fichosStart,
              balance_after: fichosStart,
              transaction_type: "WELCOME_GIFT",
              description: `Bienvenida Crunch: ${fichosStart} fichos iniciales gratis`
            }]);
          }

          newUser.roles = [{ name: role }];
          return newUser;
        } catch (e) {
          console.warn("Fallo crear usuario en Supabase, guardando en local:", e);
        }
      }

      // Local fallback
      const db = getLocalDB();
      const existing = db.users.find(u => u.email.toLowerCase() === emailClean);
      if (existing) throw new Error(`El correo ${emailClean} ya está registrado.`);

      const newUser = {
        id: db.users.length ? Math.max(...db.users.map(u => u.id)) + 1 : 1,
        full_name: full_name.trim(),
        email: emailClean,
        phone: phone.trim(),
        fichos_balance: fichosStart,
        roles: [{ name: role }],
        created_at: new Date().toISOString()
      };

      db.users.push(newUser);
      db.ficho_transactions.push({
        id: Date.now(),
        user_id: newUser.id,
        amount: fichosStart,
        balance_after: fichosStart,
        transaction_type: "WELCOME_GIFT",
        description: `Bienvenida Crunch: ${fichosStart} fichos iniciales gratis`,
        created_at: new Date().toISOString()
      });

      saveLocalDB(db);
      return newUser;
    },

    // 5. REGISTRAR VENTA
    // "Los 7 fichos que hay en este momento unicamente contaran para el producto 'Crispetas'"
    async createSale({ user_id, product_id, quantity = 1, description = "", created_by_user_id = null }) {
      const qty = parseInt(quantity) || 1;
      const uid = parseInt(user_id);
      const pid = parseInt(product_id);

      // Traer producto
      const products = await this.getProducts();
      const product = products.find(p => p.id === pid);
      if (!product) throw new Error("Producto no encontrado.");

      // Traer usuario
      const users = await this.getUsers();
      const user = users.find(u => u.id === uid);
      if (!user) throw new Error("Cliente no encontrado.");

      const unitPrice = parseFloat(product.price);
      const totalPrice = Math.round(unitPrice * qty * 100) / 100;

      // REGLA: Los fichos aplican para "Crispetas" ($2.000 COP)
      let fichosGranted = 0;
      if (product.name.trim().toLowerCase() === "crispetas" || product.is_ficho_eligible) {
        fichosGranted = qty;
      }

      if (supabaseClient) {
        try {
          // Insertar venta en Supabase
          const { data: saleData, error: saleErr } = await supabaseClient
            .from("sales")
            .insert([{
              user_id: uid,
              product_id: pid,
              quantity: qty,
              unit_price: unitPrice,
              total_price: totalPrice,
              fichos_granted: fichosGranted,
              description: description.trim(),
              created_by_user_id: created_by_user_id
            }])
            .select()
            .single();

          if (saleErr) throw saleErr;

          // Si otorgó fichos, actualizar saldo del cliente y registrar transacción
          if (fichosGranted > 0) {
            const newBalance = (user.fichos_balance || 0) + fichosGranted;
            await supabaseClient
              .from("users")
              .update({ fichos_balance: newBalance })
              .eq("id", uid);

            await supabaseClient.from("ficho_transactions").insert([{
              user_id: uid,
              amount: fichosGranted,
              balance_after: newBalance,
              transaction_type: "PURCHASE",
              reference_id: `SALE-${saleData.id}`,
              description: `Compra de ${qty}x ${product.name} (+${fichosGranted} ficho(s))`
            }]);
          }

          saleData.customer_name = user.full_name;
          saleData.customer_email = user.email;
          saleData.product_name = product.name;
          return saleData;
        } catch (e) {
          console.warn("Fallo registrar venta en Supabase, usando local:", e);
        }
      }

      // Local Fallback
      const db = getLocalDB();
      const localUser = db.users.find(u => u.id === uid);
      if (fichosGranted > 0 && localUser) {
        localUser.fichos_balance = (localUser.fichos_balance || 0) + fichosGranted;
      }

      const sale = {
        id: db.sales.length ? Math.max(...db.sales.map(s => s.id)) + 1 : 1,
        user_id: uid,
        product_id: pid,
        quantity: qty,
        unit_price: unitPrice,
        total_price: totalPrice,
        fichos_granted: fichosGranted,
        description: description.trim(),
        customer_name: user.full_name,
        customer_email: user.email,
        product_name: product.name,
        created_at: new Date().toISOString()
      };

      db.sales.push(sale);
      if (fichosGranted > 0) {
        db.ficho_transactions.push({
          id: Date.now(),
          user_id: uid,
          amount: fichosGranted,
          balance_after: localUser.fichos_balance,
          transaction_type: "PURCHASE",
          reference_id: `SALE-${sale.id}`,
          description: `Compra de ${qty}x ${product.name} (+${fichosGranted} ficho(s))`,
          created_at: new Date().toISOString()
        });
      }

      saveLocalDB(db);
      return sale;
    },

    // 6. HISTORIAL GLOBAL DE TODAS LAS COMPRAS REGISTRADAS
    // "un panel de admin para ver todas las compras registradas de todo el tiempo, con su fecha producto, descripción etc"
    async getAllSales() {
      if (supabaseClient) {
        try {
          const { data, error } = await supabaseClient
            .from("sales")
            .select(`
              *,
              users:user_id(id, full_name, email),
              products:product_id(id, name, price)
            `)
            .order("created_at", { ascending: false });

          if (!error && data) {
            return data.map(s => ({
              id: s.id,
              user_id: s.user_id,
              product_id: s.product_id,
              quantity: s.quantity,
              unit_price: parseFloat(s.unit_price),
              total_price: parseFloat(s.total_price),
              fichos_granted: s.fichos_granted,
              description: s.description,
              created_at: s.created_at,
              customer_name: s.users ? s.users.full_name : "Cliente General",
              customer_email: s.users ? s.users.email : "",
              product_name: s.products ? s.products.name : `Producto #${s.product_id}`
            }));
          }
        } catch (e) {
          console.warn("Fallo getAllSales en Supabase, usando local:", e);
        }
      }
      const db = getLocalDB();
      return db.sales.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },

    // 7. GENERAR CÓDIGO QR PARA FICHOS
    // "se iran sumando a través de codigos QR generados por el Superadmin, que te redirige a la página y reclama tu ficho"
    async generateQRCode({ fichos_value = 1, creator_id = null }) {
      const randToken = Math.random().toString(36).substring(2, 8).toUpperCase();
      const code = `CRUNCH-F${fichos_value}-${randToken}`;

      if (supabaseClient) {
        try {
          const { data, error } = await supabaseClient
            .from("qr_ficho_codes")
            .insert([{
              code: code,
              fichos_value: fichos_value,
              is_used: false,
              created_by_user_id: creator_id
            }])
            .select()
            .single();

          if (!error && data) {
            data.claim_url = `${window.location.origin}/Crunch V1.1/index.html?claim=${code}`;
            return data;
          }
        } catch (e) {
          console.warn("Fallo generateQR en Supabase, usando local:", e);
        }
      }

      // Local
      const db = getLocalDB();
      const qr = {
        id: db.qr_codes.length ? Math.max(...db.qr_codes.map(q => q.id)) + 1 : 1,
        code: code,
        fichos_value: fichos_value,
        is_used: false,
        created_at: new Date().toISOString(),
        claim_url: `${window.location.origin}/Crunch V1.1/index.html?claim=${code}`
      };
      db.qr_codes.push(qr);
      saveLocalDB(db);
      return qr;
    },

    // 8. LISTAR CÓDIGOS QR
    async getQRCodes() {
      if (supabaseClient) {
        try {
          const { data, error } = await supabaseClient
            .from("qr_ficho_codes")
            .select("*")
            .order("created_at", { ascending: false });
          if (!error && data) {
            return data.map(q => ({
              ...q,
              claim_url: `${window.location.origin}/Crunch V1.1/index.html?claim=${q.code}`
            }));
          }
        } catch (e) {
          console.warn("Fallo getQRCodes en Supabase, usando local:", e);
        }
      }
      const db = getLocalDB();
      return db.qr_codes.map(q => ({
        ...q,
        claim_url: `${window.location.origin}/Crunch V1.1/index.html?claim=${q.code}`
      })).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },

    // 9. RECLAMAR FICHO MEDIANTE CÓDIGO QR
    async claimQRCode(code, user_id) {
      const codeClean = code.trim().toUpperCase();
      const uid = parseInt(user_id);

      if (supabaseClient) {
        try {
          // Buscar QR
          const { data: qr, error: qrErr } = await supabaseClient
            .from("qr_ficho_codes")
            .select("*")
            .eq("code", codeClean)
            .single();

          if (qrErr || !qr) throw new Error(`El código QR '${codeClean}' no existe.`);
          if (qr.is_used) throw new Error("Este código QR ya fue reclamado.");

          // Traer usuario
          const { data: user } = await supabaseClient
            .from("users")
            .select("fichos_balance, full_name")
            .eq("id", uid)
            .single();

          const newBalance = (user ? user.fichos_balance : 0) + qr.fichos_value;

          // Marcar QR como usado
          await supabaseClient
            .from("qr_ficho_codes")
            .update({
              is_used: true,
              used_by_user_id: uid,
              used_at: new Date().toISOString()
            })
            .eq("id", qr.id);

          // Actualizar saldo usuario
          await supabaseClient
            .from("users")
            .update({ fichos_balance: newBalance })
            .eq("id", uid);

          // Registrar transacción
          await supabaseClient.from("ficho_transactions").insert([{
            user_id: uid,
            amount: qr.fichos_value,
            balance_after: newBalance,
            transaction_type: "QR_CLAIM",
            reference_id: codeClean,
            description: `Reclamo de código QR ${codeClean} (+${qr.fichos_value} ficho)`
          }]);

          return {
            success: true,
            fichos_added: qr.fichos_value,
            new_balance: newBalance,
            message: `¡Sumaste +${qr.fichos_value} ficho(s) con éxito!`
          };
        } catch (e) {
          console.warn("Fallo claimQR en Supabase, intentando local:", e);
        }
      }

      // Local fallback
      const db = getLocalDB();
      const qr = db.qr_codes.find(q => q.code === codeClean);
      if (!qr) throw new Error(`El código QR '${codeClean}' no existe.`);
      if (qr.is_used) throw new Error("Este código QR ya fue reclamado.");

      const localUser = db.users.find(u => u.id === uid) || db.users[0];
      qr.is_used = true;
      qr.used_by_user_id = localUser.id;
      qr.used_at = new Date().toISOString();

      localUser.fichos_balance = (localUser.fichos_balance || 0) + qr.fichos_value;

      db.ficho_transactions.push({
        id: Date.now(),
        user_id: localUser.id,
        amount: qr.fichos_value,
        balance_after: localUser.fichos_balance,
        transaction_type: "QR_CLAIM",
        reference_id: codeClean,
        description: `Reclamo de código QR ${codeClean} (+${qr.fichos_value} ficho)`,
        created_at: new Date().toISOString()
      });

      saveLocalDB(db);

      return {
        success: true,
        fichos_added: qr.fichos_value,
        new_balance: localUser.fichos_balance,
        message: `¡Sumaste +${qr.fichos_value} ficho(s) con éxito!`
      };
    },

    // 10. CANJEAR 7 FICHOS POR CRISPETAS GRATIS
    async redeemSevenFichos(user_id) {
      const uid = parseInt(user_id);
      const users = await this.getUsers();
      const user = users.find(u => u.id === uid);
      if (!user) throw new Error("Usuario no encontrado.");
      if (user.fichos_balance < 7) {
        throw new Error(`Saldo insuficiente (${user.fichos_balance}/7 fichos). Necesitas 7 fichos.`);
      }

      const newBalance = user.fichos_balance - 7;

      if (supabaseClient) {
        try {
          await supabaseClient
            .from("users")
            .update({ fichos_balance: newBalance })
            .eq("id", uid);

          await supabaseClient.from("ficho_transactions").insert([{
            user_id: uid,
            amount: -7,
            balance_after: newBalance,
            transaction_type: "REWARD_REDEMPTION",
            description: "¡Canje Exitoso! 7 fichos por 1 Crispetas Crunch 100% Gratis"
          }]);

          return { success: true, remaining_fichos: newBalance };
        } catch (e) {
          console.warn("Fallo redeem en Supabase, usando local:", e);
        }
      }

      // Local fallback
      const db = getLocalDB();
      const localUser = db.users.find(u => u.id === uid);
      if (localUser) localUser.fichos_balance = newBalance;
      saveLocalDB(db);

      return { success: true, remaining_fichos: newBalance };
    }
  };

  // Exponer globalmente
  window.CrunchDB = CrunchDB;
  initClient();

})(window);
