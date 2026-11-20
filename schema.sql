-- ==============================================================================
-- CRUNCH SNACKS - SUPABASE DATABASE SCHEMA & SEED (IDEMPOTENTE & SEGURO)
-- Proyecto: tivjxgevzavibkrqdgyn.supabase.co
-- ==============================================================================

-- 1. TABLA: PERMISOS
CREATE TABLE IF NOT EXISTS permissions (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(80) UNIQUE NOT NULL,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABLA: ROLES
CREATE TABLE IF NOT EXISTS roles (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABLA INTERMEDIA N:N: ROLE_PERMISSIONS
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id BIGINT REFERENCES roles(id) ON DELETE CASCADE,
    permission_id BIGINT REFERENCES permissions(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (role_id, permission_id)
);

-- 4. TABLA: USUARIOS
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(120) UNIQUE NOT NULL,
    full_name VARCHAR(120) NOT NULL,
    phone VARCHAR(30),
    password_hash VARCHAR(255) DEFAULT 'crunch2026',
    -- Cada cuenta debe tener 2 fichos iniciales gratis:
    fichos_balance INT DEFAULT 2 NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABLA INTERMEDIA N:N: USER_ROLES
CREATE TABLE IF NOT EXISTS user_roles (
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    role_id BIGINT REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
);

-- 6. TABLA: PRODUCTOS
CREATE TABLE IF NOT EXISTS products (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    price NUMERIC(12, 2) NOT NULL,
    description TEXT,
    is_ficho_eligible BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TABLA: VENTAS / COMPRAS HISTÓRICAS
CREATE TABLE IF NOT EXISTS sales (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    product_id BIGINT REFERENCES products(id) ON DELETE RESTRICT,
    quantity INT DEFAULT 1 NOT NULL,
    unit_price NUMERIC(12, 2) NOT NULL,
    total_price NUMERIC(12, 2) NOT NULL,
    fichos_granted INT DEFAULT 0 NOT NULL,
    description TEXT,
    created_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. TABLA: CÓDIGOS QR PARA FICHOS
CREATE TABLE IF NOT EXISTS qr_ficho_codes (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(64) UNIQUE NOT NULL,
    fichos_value INT DEFAULT 1 NOT NULL,
    is_used BOOLEAN DEFAULT FALSE NOT NULL,
    created_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    used_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
);

-- 9. TABLA: TRANSACCIONES DE FICHOS (AUDITORÍA)
CREATE TABLE IF NOT EXISTS ficho_transactions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    amount INT NOT NULL,
    balance_after INT NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    reference_id VARCHAR(100),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- SEMILLAS INICIALES (SEEDS OBLIGATORIOS SIN CONFLICTOS DE ID)
-- ==============================================================================

-- A. Permisos Básicos
INSERT INTO permissions (code, name, description) VALUES
    ('product:create', 'Crear Productos', 'Permite crear productos con precio'),
    ('product:read', 'Ver Productos', 'Consultar catálogo de snacks'),
    ('user:create', 'Crear Usuarios', 'Superadmin crea cuentas de clientes compradores con 2 fichos iniciales'),
    ('user:read', 'Ver Usuarios', 'Ver clientes y sus saldos de fichos'),
    ('sale:record', 'Ingresar Ventas', 'Registrar compras a usuarios y sumar fichos'),
    ('sale:read_all', 'Historial Global de Compras', 'Ver todas las compras registradas de todo el tiempo'),
    ('qr:generate', 'Generar Códigos QR', 'Generar códigos QR para sumar fichos'),
    ('ficho:claim', 'Reclamar Fichos QR', 'Escanear QR y sumar ficho a la cuenta'),
    ('ficho:redeem', 'Canjear Premio 7 Fichos', 'Canjear 7 fichos por Crispetas gratis')
ON CONFLICT (code) DO NOTHING;

-- B. Roles: Superadmin y Cliente
INSERT INTO roles (name, description) VALUES
    ('Superadmin', 'Administrador total con permisos de productos, usuarios, ventas y QR'),
    ('Cliente', 'Comprador que acumula y canjea fichos en snacks')
ON CONFLICT (name) DO NOTHING;

-- C. Asignar Permisos a Roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'Superadmin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'Cliente' AND p.code IN ('product:read', 'ficho:claim', 'ficho:redeem')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- D. PRIMER PRODUCTO EN LA DB: "Crispetas" a 2000 COP
-- "Los 7 fichos que hay en este momento unicamente contaran para el producto 'Crispetas' que debe ser ingresado como primer dato en la DB a 2000 COP."
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM products WHERE LOWER(TRIM(name)) = 'crispetas') THEN
        INSERT INTO products (name, price, description, is_ficho_eligible)
        VALUES (
            'Crispetas',
            2000.00,
            'Crispetas Crunch Gourmet - Primer dato en base de datos. Aplica exclusivamente para la dinámica de los 7 fichos.',
            TRUE
        );
    ELSE
        UPDATE products 
        SET price = 2000.00, is_ficho_eligible = TRUE 
        WHERE LOWER(TRIM(name)) = 'crispetas';
    END IF;
END $$;

-- Otros productos adicionales del menú Crunch
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM products WHERE LOWER(TRIM(name)) = 'papas rústicas sal marina') THEN
        INSERT INTO products (name, price, description, is_ficho_eligible)
        VALUES ('Papas Rústicas Sal Marina', 4500.00, 'Papas artesanales cocinadas lentamente con sal marina', FALSE);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM products WHERE LOWER(TRIM(name)) = 'palomitas caramelo crunch') THEN
        INSERT INTO products (name, price, description, is_ficho_eligible)
        VALUES ('Palomitas Caramelo Crunch', 4200.00, 'Palomitas gourmet con cobertura crocante de caramelo', FALSE);
    END IF;
END $$;

-- E. Usuario Superadmin: Santiago Sarmiento (Sin forzar ID para evitar error de clave duplicada)
INSERT INTO users (email, full_name, phone, password_hash, fichos_balance)
VALUES (
    'santiago@crunch.com',
    'Santiago Sarmiento',
    '+57 300 123 4567',
    'crunch2026',
    2
)
ON CONFLICT (email) DO UPDATE
SET full_name = EXCLUDED.full_name;

-- Vincular Superadmin con Rol Superadmin
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r
WHERE u.email = 'santiago@crunch.com' AND r.name = 'Superadmin'
ON CONFLICT (user_id, role_id) DO NOTHING;

-- F. Usuario Cliente Demo: Camila Morales (2 fichos iniciales gratis)
INSERT INTO users (email, full_name, phone, password_hash, fichos_balance)
VALUES (
    'camila@ejemplo.com',
    'Camila Morales',
    '+57 310 987 6543',
    'crunch2026',
    2
)
ON CONFLICT (email) DO UPDATE
SET full_name = EXCLUDED.full_name;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r
WHERE u.email = 'camila@ejemplo.com' AND r.name = 'Cliente'
ON CONFLICT (user_id, role_id) DO NOTHING;

-- Sincronizar secuencias de auto-incremento para evitar colisiones
SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE(MAX(id), 1)) FROM users;
SELECT setval(pg_get_serial_sequence('products', 'id'), COALESCE(MAX(id), 1)) FROM products;

-- ==============================================================================
-- POLÍTICAS ROW LEVEL SECURITY (RLS) PARA ACCESO DESDE JS
-- ==============================================================================
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_ficho_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ficho_transactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Public Full Access permissions" ON permissions;
    CREATE POLICY "Public Full Access permissions" ON permissions FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public Full Access roles" ON roles;
    CREATE POLICY "Public Full Access roles" ON roles FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public Full Access role_permissions" ON role_permissions;
    CREATE POLICY "Public Full Access role_permissions" ON role_permissions FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public Full Access users" ON users;
    CREATE POLICY "Public Full Access users" ON users FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public Full Access user_roles" ON user_roles;
    CREATE POLICY "Public Full Access user_roles" ON user_roles FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public Full Access products" ON products;
    CREATE POLICY "Public Full Access products" ON products FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public Full Access sales" ON sales;
    CREATE POLICY "Public Full Access sales" ON sales FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public Full Access qr_ficho_codes" ON qr_ficho_codes;
    CREATE POLICY "Public Full Access qr_ficho_codes" ON qr_ficho_codes FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public Full Access ficho_transactions" ON ficho_transactions;
    CREATE POLICY "Public Full Access ficho_transactions" ON ficho_transactions FOR ALL USING (true) WITH CHECK (true);
END $$;
