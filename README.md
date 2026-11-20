# 🍿 Crunch Snacks - Sistema de Fidelización, Ventas y Club de Fichos

Sistema integral de fidelización, catálogo y registro de ventas para **Crunch Snacks**, desarrollado en **JavaScript puro (Vanilla JS)** y conectado en tiempo real a una base de datos relacional en **Supabase (PostgreSQL)**.

Cuenta con un **diseño responsive adaptativo** tanto para pantallas de escritorio completas como para dispositivos móviles, implementando una arquitectura estática sin necesidad de servidores intermedios.

---

## 🎨 Paleta de Color Oficial

El proyecto utiliza la identidad visual de marca de Crunch Snacks:
- **Azul Primario**: `#011C51`
- **Naranja Acento / CTA**: `#FEA704`
- **Amarillo Gold**: `#FECC35`
- **Blanco**: `#FFFFFF`
- **Gris Superficie**: `#F0F3F9` / `#F8FAFC`

---

## 🚀 Reglas de Negocio Implementadas

1. **Modelo de Autorización Relacional (N:N Rol N:N Permisos)**:
   - `users` $\leftrightarrow$ `user_roles` $\leftrightarrow$ `roles` $\leftrightarrow$ `role_permissions` $\leftrightarrow$ `permissions`.
   - **Superadmin**: Puede crear productos con precio, registrar ventas, crear cuentas de clientes compradores, generar códigos QR de fichos y consultar el historial global de todas las compras de todo el tiempo.
   - **Cliente**: Acumula fichos en sus compras, canjea códigos QR y redime premios.

2. **Primer Producto en Base de Datos ("Crispetas" a $2.000 COP)**:
   - Como primer dato obligatorio de la base de datos se encuentra registrado el producto **"Crispetas"** a **$2.000 COP** (`is_ficho_eligible = TRUE`).
   - La dinámica de los **7 fichos** aplica de forma exclusiva para el producto Crispetas.

3. **2 Fichos Iniciales Gratis de Bienvenida**:
   - Cada cuenta creada (ya sea registrada por el cliente o dada de alta por el Superadmin) inicia obligatoriamente con **2 fichos gratis de bienvenida** (`fichos_balance = 2`), registrando la auditoría en `ficho_transactions`.

4. **Acumulación de Fichos mediante Códigos QR**:
   - El Superadmin puede generar códigos QR únicos (`CRUNCH-F1-XXXXX`).
   - El código genera un enlace de reclamo (`?claim=CRUNCH-F1-XXXXX`).
   - Al escanear o ingresar a la página, el sistema valida en Supabase que el código no haya sido usado, incrementa **+1 ficho** al balance del usuario y marca el código como utilizado para evitar reusos.

5. **Registro de Ventas e Historial Global de Compras**:
   - El Superadmin puede ingresar compras asignadas a clientes registrados.
   - Si el producto vendido es **Crispetas**, el sistema suma automáticamente la cantidad de fichos correspondiente a la cuenta del comprador.
   - El panel incluye una vista auditada con **todas las compras registradas de todo el tiempo**, con fecha y hora, cliente, producto, precio unitario, total COP y descripción.

6. **Canje de 7 Fichos por Crispetas Gratis**:
   - Al alcanzar los 7 fichos, el usuario puede desbloquear y redimir su paquete de Crispetas 100% gratis, descontando 7 fichos de su saldo en la base de datos.

---

## 📁 Estructura del Proyecto

```text
Crunch/
├── admin/                           # Panel de Control para Superadmin
│   ├── index.html                   # Vistas: Historial, Ventas, Productos, Usuarios, QR
│   ├── admin.css                    # Estilos de escritorio y panel administrativo
│   ├── admin.js                     # Controlador del panel de administración
│   └── crunch-supabase.js           # Cliente y motor de base de datos Supabase
│
├── Crunch V1.1/                     # App de Clientes / Crunch Club
│   ├── index.html                   # Interfaz responsive (Billetera de fichos, catálogo)
│   ├── styles.css                   # Estilos fluidos para escritorio y móviles
│   ├── app.js                       # Controlador del club de fidelización y canjes
│   ├── crunch-supabase.js           # Cliente y motor de base de datos Supabase
│   └── assets/                      # Fotografías de snacks, isotipos y logos
│
├── schema.sql                       # Esquema DDL y semillas SQL para Supabase
├── index.html                       # Redirección raíz hacia la app
├── Crunch Logo.png                  # Logotipo principal de la marca
└── README.md                        # Documentación técnica del proyecto
```

---

## 🗄️ Modelo de Base de Datos (PostgreSQL en Supabase)

El archivo [`schema.sql`](schema.sql) contiene la definición completa de tablas y restricciones:

- **`permissions`**: Catálogo de permisos granulares (`product:create`, `sale:record`, `sale:read_all`, etc.).
- **`roles`**: Definición de roles (`Superadmin`, `Cliente`).
- **`role_permissions`**: Tabla intermedia N:N entre roles y permisos.
- **`users`**: Datos de usuarios, teléfono, clave y saldo de fichos (`fichos_balance DEFAULT 2`).
- **`user_roles`**: Tabla intermedia N:N entre usuarios y roles.
- **`products`**: Catálogo de productos con precio en COP y bandera `is_ficho_eligible`.
- **`sales`**: Historial de todas las compras con llaves foráneas a usuarios y productos.
- **`qr_ficho_codes`**: Registro de tokens QR únicos, valor en fichos, estado de uso y usuario que lo redimió.
- **`ficho_transactions`**: Libro de auditoría de cada movimiento de fichos (`WELCOME_GIFT`, `PURCHASE`, `QR_CLAIM`, `REWARD_REDEMPTION`).

---

## ⚙️ Guía de Configuración y Puesta en Marcha

### 1. Ejecutar el Script en Supabase
1. Ingresa a tu proyecto en [Supabase](https://supabase.com/dashboard/project/tivjxgevzavibkrqdgyn).
2. Ve a la sección **SQL Editor** en la barra lateral izquierda.
3. Haz clic en **New query**, copia y pega todo el contenido de [`schema.sql`](schema.sql).
4. Haz clic en **Run** (Ctrl + Enter) para crear las tablas, sembrar los roles, permisos, usuario Superadmin y el producto inicial **Crispetas a $2.000 COP**.

### 2. Obtener la Llave Pública (Anon Key)
1. En el panel de Supabase, entra a **Project Settings** (icono de engranaje ⚙️) &rarr; **API**.
2. En la sección **Project API keys**, copia el valor de **`anon` `public`**.

### 3. Conectar la Aplicación en 1 Clic
1. Abre el [Panel de Superadmin](admin/index.html) o la [App de Clientes](Crunch%20V1.1/index.html) en tu navegador.
2. En la barra superior, haz clic en el botón **"DB Supabase"** (o *"Supabase JS"*).
3. Pega tu **Anon Key** y haz clic en **Guardar & Conectar a DB**.
4. El indicador cambiará a verde (**"Supabase DB Activa"**) y cargará automáticamente todos los datos reales desde Supabase.

---

## 🖥️ Cómo Visualizar y Desplegar el Proyecto

Dado que el proyecto está desarrollado en tecnologías web puras (HTML5, CSS3, JavaScript):

### Modo Local:
Puedes abrir directamente los archivos `index.html` en cualquier navegador web, o iniciar un servidor estático rápido con:

```powershell
# Opción A (Python):
python -m http.server 8000

# Opción B (Node.js):
npx serve .
```

- **Panel de Superadmin**: `http://localhost:8000/admin/index.html`
- **App Móvil / Web Clientes**: `http://localhost:8000/Crunch%20V1.1/index.html`

### Despliegue en la Nube:
Compatible directamente con cualquier servicio de hosting estático:
- **Vercel**: Importar repositorio (Build command: vació / Output directory: `.`).
- **Netlify**: Arrastrar la carpeta raíz del proyecto.
- **GitHub Pages**: Habilitar en `Settings -> Pages -> Branch main`.

---

## 🔒 Seguridad y Persistencia
- Las consultas en JavaScript utilizan la librería oficial `@supabase/supabase-js` cargada vía CDN.
- Se configuraron políticas de **Row Level Security (RLS)** en PostgreSQL para permitir operaciones autorizadas mediante la clave pública anónima.
- Los códigos QR implementan bloqueo contra reuso: una vez reclamados, su estado cambia a `is_used = TRUE` en la base de datos, impidiendo reclamos duplicados.
