/**
 * Crunch Snacks - Supabase Pure JavaScript Engine
 * Conexión nativa por defecto integrada a Supabase DB
 * Proyecto: https://tivjxgevzavibkrqdgyn.supabase.co
 */

(function (window) {
  const SUPABASE_PROJECT_URL = "https://tivjxgevzavibkrqdgyn.supabase.co";
  // API Key pública / publishable integrada por defecto:
  const DEFAULT_PUBLISHABLE_KEY = "sb_publishable_dU8xyuE3WRcyeRNd8-RAyg_BDF_fFyn";
  const STORAGE_KEY_ANON = "crunch_supabase_anon_key";

  function getActiveKey() {
    return localStorage.getItem(STORAGE_KEY_ANON) || DEFAULT_PUBLISHABLE_KEY;
  }

  function setCustomKey(key) {
    if (key) {
      localStorage.setItem(STORAGE_KEY_ANON, key.trim());
    } else {
      localStorage.removeItem(STORAGE_KEY_ANON);
    }
  }

  let supabaseClient = null;

  function initClient() {
    const key = getActiveKey();
    if (window.supabase && key) {
      try {
        supabaseClient = window.supabase.createClient(SUPABASE_PROJECT_URL, key);
        console.log("Supabase JS conectado automáticamente a:", SUPABASE_PROJECT_URL);
      } catch (e) {
        console.error("Error al inicializar Supabase Client:", e);
        supabaseClient = null;
      }
    } else {
      supabaseClient = null;
    }
    return supabaseClient;
  }

  function requireClient() {
    if (!supabaseClient) initClient();
    if (!supabaseClient) {
      throw new Error("No se pudo establecer conexión con Supabase.");
    }
    return supabaseClient;
  }

  const CrunchDB = {
    PROJECT_URL: SUPABASE_PROJECT_URL,
    DEFAULT_KEY: DEFAULT_PUBLISHABLE_KEY,

    getAnonKey: getActiveKey,
    setAnonKey: function(key) {
      setCustomKey(key);
      initClient();
    },

    isSupabaseConnected: function() {
      return !!supabaseClient;
    },

    async testSupabaseConnection() {
      if (!supabaseClient) initClient();
      if (!supabaseClient) {
        return {
          success: false,
          message: "Cliente Supabase no inicializado."
        };
      }
      try {
        const { data, error } = await supabaseClient
          .from("products")
          .select("id, name, price")
          .limit(1);
        if (error) throw error;
        return { success: true, message: "Conectado a Supabase correctamente.", data };
      } catch (err) {
        return { success: false, message: err.message || "Error al conectar con Supabase." };
      }
    },

    // 1. OBTENER PRODUCTOS DIRECTO DE LA DB (Crispetas a $2.000 COP primero)
    async getProducts() {
      const client = requireClient();
      const { data, error } = await client
        .from("products")
        .select("*")
        .order("id", { ascending: true });

      if (error) throw new Error("Error al consultar productos en Supabase: " + error.message);
      return data || [];
    },

    // 2. CREAR PRODUCTO (Superadmin crea productos con precio)
    async createProduct({ name, price, description = "", is_ficho_eligible = true }) {
      const client = requireClient();
      const priceNum = parseFloat(price);
      if (isNaN(priceNum) || priceNum < 0) {
        throw new Error("El precio debe ser un número positivo en pesos COP.");
      }

      const { data, error } = await client
        .from("products")
        .insert([{
          name: name.trim(),
          price: priceNum,
          description: description ? description.trim() : null,
          is_ficho_eligible: !!is_ficho_eligible
        }])
        .select()
        .single();

      if (error) throw new Error("Error al crear producto en Supabase: " + error.message);
      return data;
    },

    // 3. OBTENER USUARIOS DIRECTO DE LA DB
    async getUsers() {
      const client = requireClient();
      const { data, error } = await client
        .from("users")
        .select("*, user_roles(roles(*))")
        .order("id", { ascending: false });

      if (error) throw new Error("Error al consultar usuarios en Supabase: " + error.message);
      
      return (data || []).map(u => ({
        ...u,
        roles: u.user_roles ? u.user_roles.map(ur => ur.roles) : []
      }));
    },

    // 4. CREAR CUENTA DE USUARIO (Con 2 fichos iniciales gratis)
    async createUser({ full_name, email, phone = "", initial_fichos = 2, role = "Cliente" }) {
      const client = requireClient();
      const emailClean = email.toLowerCase().trim();
      const fichosStart = parseInt(initial_fichos) >= 0 ? parseInt(initial_fichos) : 2;

      // Verificar si ya existe
      const { data: existing } = await client
        .from("users")
        .select("id")
        .eq("email", emailClean)
        .maybeSingle();

      if (existing) {
        throw new Error(`El correo '${emailClean}' ya se encuentra registrado en la base de datos.`);
      }

      // Insertar en tabla users
      const { data: newUser, error: userErr } = await client
        .from("users")
        .insert([{
          full_name: full_name.trim(),
          email: emailClean,
          phone: phone ? phone.trim() : null,
          fichos_balance: fichosStart,
          password_hash: "crunch2026",
          is_active: true
        }])
        .select()
        .single();

      if (userErr) throw new Error("Error al crear usuario en Supabase: " + userErr.message);

      // Asignar rol
      const { data: roleData } = await client
        .from("roles")
        .select("id")
        .eq("name", role)
        .maybeSingle();

      if (roleData) {
        await client.from("user_roles").insert([{
          user_id: newUser.id,
          role_id: roleData.id
        }]);
      }

      // Registrar auditoría de 2 fichos de regalo de bienvenida
      if (fichosStart > 0) {
        await client.from("ficho_transactions").insert([{
          user_id: newUser.id,
          amount: fichosStart,
          balance_after: fichosStart,
          transaction_type: "WELCOME_GIFT",
          description: `Bienvenida Crunch: ${fichosStart} fichos iniciales gratis de regalo`
        }]);
      }

      newUser.roles = [{ name: role }];
      return newUser;
    },

    // 5. REGISTRAR VENTA
    async createSale({ user_id, product_id, quantity = 1, description = "", created_by_user_id = null }) {
      const client = requireClient();
      const qty = parseInt(quantity) || 1;
      const uid = parseInt(user_id);
      const pid = parseInt(product_id);

      // Traer producto de DB
      const { data: product, error: pErr } = await client
        .from("products")
        .select("*")
        .eq("id", pid)
        .single();
      if (pErr || !product) throw new Error("Producto no encontrado en la base de datos.");

      // Traer cliente de DB
      const { data: user, error: uErr } = await client
        .from("users")
        .select("*")
        .eq("id", uid)
        .single();
      if (uErr || !user) throw new Error("Cliente no encontrado en la base de datos.");

      const unitPrice = parseFloat(product.price);
      const totalPrice = Math.round(unitPrice * qty * 100) / 100;

      // Regla de fichos: Crispetas otorga 1 ficho por unidad
      let fichosGranted = 0;
      if (product.name.trim().toLowerCase() === "crispetas" || product.is_ficho_eligible) {
        fichosGranted = qty;
      }

      // Insertar venta en sales
      const { data: saleData, error: sErr } = await client
        .from("sales")
        .insert([{
          user_id: uid,
          product_id: pid,
          quantity: qty,
          unit_price: unitPrice,
          total_price: totalPrice,
          fichos_granted: fichosGranted,
          description: description ? description.trim() : null,
          created_by_user_id: created_by_user_id
        }])
        .select()
        .single();

      if (sErr) throw new Error("Error al registrar venta en Supabase: " + sErr.message);

      // Si otorgó fichos, actualizar balance del usuario y registrar transacción
      if (fichosGranted > 0) {
        const newBalance = (user.fichos_balance || 0) + fichosGranted;
        await client
          .from("users")
          .update({ fichos_balance: newBalance })
          .eq("id", uid);

        await client.from("ficho_transactions").insert([{
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
    },

    // 6. HISTORIAL COMPLETO DE VENTAS DE TODO EL TIEMPO
    async getAllSales() {
      const client = requireClient();
      const { data, error } = await client
        .from("sales")
        .select(`
          *,
          users:user_id(id, full_name, email),
          products:product_id(id, name, price)
        `)
        .order("created_at", { ascending: false });

      if (error) throw new Error("Error al consultar historial de ventas: " + error.message);

      return (data || []).map(s => ({
        id: s.id,
        user_id: s.user_id,
        product_id: s.product_id,
        quantity: s.quantity,
        unit_price: parseFloat(s.unit_price),
        total_price: parseFloat(s.total_price),
        fichos_granted: s.fichos_granted || 0,
        description: s.description,
        created_at: s.created_at,
        customer_name: s.users ? s.users.full_name : "Cliente General",
        customer_email: s.users ? s.users.email : "",
        product_name: s.products ? s.products.name : `Producto #${s.product_id}`
      }));
    },

    // 7. GENERAR CÓDIGO QR PARA FICHOS
    async generateQRCode({ fichos_value = 1, creator_id = null }) {
      const client = requireClient();
      const randToken = Math.random().toString(36).substring(2, 8).toUpperCase();
      const code = `CRUNCH-F${fichos_value}-${randToken}`;

      const { data, error } = await client
        .from("qr_ficho_codes")
        .insert([{
          code: code,
          fichos_value: fichos_value,
          is_used: false,
          created_by_user_id: creator_id
        }])
        .select()
        .single();

      if (error) throw new Error("Error al generar código QR en Supabase: " + error.message);

      data.claim_url = `${window.location.origin}/Crunch V1.1/index.html?claim=${code}`;
      return data;
    },

    // 8. LISTAR CÓDIGOS QR
    async getQRCodes() {
      const client = requireClient();
      const { data, error } = await client
        .from("qr_ficho_codes")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw new Error("Error al consultar códigos QR: " + error.message);

      return (data || []).map(q => ({
        ...q,
        claim_url: `${window.location.origin}/Crunch V1.1/index.html?claim=${q.code}`
      }));
    },

    // 9. RECLAMAR FICHO MEDIANTE CÓDIGO QR
    async claimQRCode(code, user_id) {
      const client = requireClient();
      const codeClean = code.trim().toUpperCase();
      const uid = parseInt(user_id);

      const { data: qr, error: qrErr } = await client
        .from("qr_ficho_codes")
        .select("*")
        .eq("code", codeClean)
        .maybeSingle();

      if (qrErr || !qr) throw new Error(`El código QR '${codeClean}' no existe en la base de datos.`);
      if (qr.is_used) throw new Error("Este código QR ya fue reclamado.");

      const { data: user, error: uErr } = await client
        .from("users")
        .select("fichos_balance, full_name")
        .eq("id", uid)
        .single();

      if (uErr || !user) throw new Error("Usuario no encontrado en la base de datos.");

      const newBalance = (user.fichos_balance || 0) + qr.fichos_value;

      // Marcar QR como usado
      await client
        .from("qr_ficho_codes")
        .update({
          is_used: true,
          used_by_user_id: uid,
          used_at: new Date().toISOString()
        })
        .eq("id", qr.id);

      // Actualizar saldo del usuario
      await client
        .from("users")
        .update({ fichos_balance: newBalance })
        .eq("id", uid);

      // Registrar transacción
      await client.from("ficho_transactions").insert([{
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
    },

    // 10. CANJEAR 7 FICHOS POR CRISPETAS GRATIS
    async redeemSevenFichos(user_id) {
      const client = requireClient();
      const uid = parseInt(user_id);

      const { data: user, error: uErr } = await client
        .from("users")
        .select("*")
        .eq("id", uid)
        .single();

      if (uErr || !user) throw new Error("Usuario no encontrado.");
      if ((user.fichos_balance || 0) < 7) {
        throw new Error(`Saldo insuficiente (${user.fichos_balance || 0}/7 fichos). Necesitas 7 fichos.`);
      }

      const newBalance = user.fichos_balance - 7;

      await client
        .from("users")
        .update({ fichos_balance: newBalance })
        .eq("id", uid);

      await client.from("ficho_transactions").insert([{
        user_id: uid,
        amount: -7,
        balance_after: newBalance,
        transaction_type: "REWARD_REDEMPTION",
        description: "¡Canje Exitoso! 7 fichos por 1 Crispetas Crunch 100% Gratis"
      }]);

      return { success: true, remaining_fichos: newBalance };
    }
  };

  window.CrunchDB = CrunchDB;
  initClient();

})(window);
