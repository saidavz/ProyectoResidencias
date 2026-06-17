# COMPONENTES TÉCNICOS DETALLADOS - Manual de Desarrollo

**Especificación Técnica Detallada**
**Proyecto:** Sistema de Gestión de Compras y Inventario
**Fecha:** 26 de Abril de 2026

---

## TABLA DE CONTENIDOS

1. [Componentes Backend Detallados](#componentes-backend-detallados)
2. [Componentes Frontend Detallados](#componentes-frontend-detallados)
3. [Flujos de Datos](#flujos-de-datos)
4. [Integraciones y Dependencias](#integraciones-y-dependencias)

---

## Componentes Backend Detallados

### 📁 MÓDULOS PRINCIPALES

#### **purchase.js** - Servidor Express.js
**Ubicación:** `/purchase.js`

**Configuración:**
```javascript
import express from 'express';
import pg from 'pg';
import cors from 'cors';
import multer from 'multer';
import xlsx from 'xlsx';

const app = express();
const PORT = 3000;
app.use(cors());
app.use(express.json());
app.use(express.static('.'));
```

**Pool de conexión PostgreSQL:**
- Host: localhost
- Base de datos: bd_purchase_system
- Usuario: postgres
- Puerto: 5432

**Archivos de carga:** Multer configurado para `/uploads/`

---

### 🔐 MÓDULO DE AUTENTICACIÓN

#### **Funciones de Validación PID**

**`sanitizePid(rawPid)`**
- Entrada: `string` - PID sin procesar
- Salida: `string` - PID limpio
- Función: Elimina caracteres de control y espacios
- Elimina sufijo de puntos al final (`;`)

**`getPidCandidates(normalizedPid)`**
- Entrada: `string` - PID normalizado
- Salida: `Array<string>` - Posibles variantes del PID
- Genera candidatos removiendo letras finales (ej: "C")
- Útil para diferentes formatos de escaneo

**`resolveExistingUserPid(rawPid)`** - Async
- Entrada: `string` - PID sin procesar
- Salida: `string|null` - PID del usuario o null
- Valida que el usuario exista en tabla `user_`
- Busca en BD con normalización

**`requireMovementUserPid(req, res, endpointName)`** - Async
- Entrada: Express req/res + nombre endpoint
- Salida: `string|null` - PID validado o null
- Middleware para validar usuario en movimientos
- Retorna 401 si usuario inválido

---

#### **Endpoints de Autenticación**

**POST `/api/auth/validate-qr`**
- Parámetros: `{ pid: string }`
- Retorna: `{ ok: boolean, user: Object, message: string }`
- Valida código QR contra tabla user_
- Retorna datos del usuario (pid, user_name, rol, etc.)

**POST `/api/auth/validate-credentials`**
- Parámetros: `{ userName: string, password: string }`
- Retorna: `{ ok: boolean, user: Object, message: string }`
- Valida usuario y contraseña
- Compara contraseña hasheada o en texto plano

---

### 👥 MÓDULO DE GESTIÓN DE USUARIOS

#### **POST `/api/users` - Crear Usuario**
- **Body:** `{ pid, user_name, last_name, user_password, rol }`
- **Validaciones:** PID único, campos requeridos
- **Retorna:** `{ ok: boolean, user: Object }`

#### **GET `/api/users/search` - Buscar Usuarios**
- **Query:** `searchTerm, limit, offset`
- **Búsqueda:** En pid, user_name, last_name
- **Retorna:** `Array<User>`

#### **POST `/api/users/delete` - Eliminar Usuario**
- **Body:** `{ pid }`
- **Validaciones:** Usuario existe, no es último admin
- **Retorna:** `{ ok: boolean }`

---

### 📦 MÓDULO DE PRODUCTOS

#### **GET `/api/products/bom-calculation`**
- **Query Parameters:**
  - `no_project` (required)
  - `type_p` (optional) - Tipo de producto
  - `brand` (optional) - Marca
  - `network` (optional) - Red
- **Lógica:**
  - Si type_p Y brand: `WHERE type_p=$1 OR brand=$2`
  - Si solo type_p: `WHERE type_p=$1`
  - Si solo brand: `WHERE brand=$1`
- **Retorna:** Array de productos con cálculo de BOM
- **Campos por producto:**
  ```javascript
  {
    no_part,
    description,
    type_p,
    brand,
    unit,
    no_project,
    quantity_required,
    quantity_available,
    pending_quantity,
    total_value,
    purchase_status
  }
  ```

#### **GET `/api/products/types-by-project/:no_project`**
- **Funcionalidad Nueva (v2):** Autocompletado dual
- **Retorna:** Array con estructura:
  ```javascript
  [
    { value: "Resistencia", category: "type", type_p: "Resistencia" },
    { value: "Sony", category: "brand", brand: "Sony" },
    ...
  ]
  ```
- **Origen de datos:** Productos en BOM del proyecto

#### **GET `/api/products/types`**
- **Retorna:** Array de tipos únicos de productos

---

### 🏢 MÓDULO DE PROYECTOS

#### **GET `/api/projects/check/:no_project`**
- **Funcionalidad:** Verificar si proyecto está activo o inactivo
- **Retorna:** `{ is_inactive: boolean, status: string }`
- **Caso de uso:** Detectar proyectos inactivos para prompt de rack

#### **GET `/api/projects/all`**
- **Retorna:** Todos los proyectos activos e inactivos

#### **GET `/api/projects/all-including-inactive`**
- **Retorna:** Proyectos incluyendo inactivos

#### **GET `/api/projects/with-movements`**
- **Retorna:** Solo proyectos que tienen movimientos registrados

#### **POST `/api/projects` - Crear Proyecto**
- **Body:** `{ no_project, name_project, status }`
- **Validaciones:** no_project único
- **Retorna:** Proyecto creado

#### **PUT `/api/projects/:no_project/status`**
- **Body:** `{ status }`
- **Valores permitidos:** 'active', 'inactive', 'completed'
- **Transaccional:** Actualiza múltiples registros relacionados

---

### 📥 MÓDULO DE STOCK E INVENTARIO

#### **POST `/api/inbound`** - Registrar Entrada de Mercancía
- **Body:** 
  ```javascript
  {
    qr_code,       // Código QR del producto
    quantity,      // Cantidad
    warehouse,     // Almacén
    rack,          // Estante
    no_project,    // Proyecto
    no_part,       // Número de parte
    pid            // Usuario que registra
  }
  ```
- **Lógica:**
  1. Obtiene stock actual
  2. Actualiza disponibilidad
  3. Registra movimiento
  4. Si proyecto inactivo: cambia no_project a 'AUT-STOCK'

#### **POST `/api/inbound-with-rack`** - Entrada con Rack Específico
- **Similar a inbound pero:** 
- Requiere especificación de rack
- Usado para proyectos inactivos

#### **POST `/api/outbound`** - Registrar Salida
- **Body:** Similar a inbound
- **Lógica:**
  1. Valida cantidad disponible
  2. Resta de inventario
  3. Registra movimiento
  4. Actualiza BOM si corresponde

#### **GET `/api/stock`** - Obtener Todo el Stock
- **Query:** `warehouse, rack, project, part`
- **Retorna:** Array de items en stock con disponibilidad

#### **GET `/api/stock/by-project`**
- **Retorna:** Stock agrupado por proyecto

#### **GET `/api/stock/available/:qr_code`**
- **Retorna:** Disponibilidad específica del QR code

---

### 🛒 MÓDULO DE COMPRAS Y REQUISICIONES

#### **POST `/api/purchases` - Crear Compra/PO**
- **Body:**
  ```javascript
  {
    no_project,
    no_part,
    quantity,
    unit_price,
    vendor_id,
    purchase_date,
    purchase_status,  // 'pending', 'quoted', 'approved', 'received'
    network,
    pid
  }
  ```
- **Retorna:** ID de compra y registro creado

#### **GET `/api/purchases`**
- **Query:** `status, project, vendor`
- **Retorna:** Array de compras con paginación

#### **PUT `/api/purchases/status`**
- **Body:** `{ purchase_id, new_status }`
- **Estados permitidos:** pending, quoted, approved, received, cancelled

#### **POST `/api/requisitions/save`**
- **Guarda requisiciones del sistema**
- **Body incluye:** Proyecto, partes, cantidades, descripción

---

### 📚 MÓDULO BOM (Bill of Materials)

#### **POST `/api/bom` - Cargar BOM desde Excel**
- **Multipart Form Data:** Archivo Excel
- **Procesamiento:**
  1. Lee archivo con XLSX
  2. Extrae datos de hojas
  3. Valida estructura
  4. Inserta en tabla `bom_project`
  5. Crea registros de stock
- **Retorna:** `{ ok: boolean, records_imported: number, message: string }`

#### **DELETE `/api/bom/:no_project`**
- **Elimina** todo el BOM de un proyecto
- **Cascada:** También afecta stock relacionado

#### **GET `/api/bomView`**
- **Retorna:** Vista consolidada de BOM con:
  - Número de parte
  - Descripción
  - Cantidad requerida
  - Cantidad disponible
  - Estado de compra
  - Proyecto

#### **PATCH `/api/bom-project/update-status`**
- **Body:** `{ no_project, no_part, new_status }`
- **Estados:** Pending, Delivered, Cancelled, etc.
- **Usado por:** Inbound para marcar partes entregadas

---

### 📊 MÓDULO DE MOVIMIENTOS

#### **POST `/api/movements` - Registrar Movimiento General**
- **Body:**
  ```javascript
  {
    movement_type,    // 'INBOUND', 'OUTBOUND'
    no_part,
    quantity,
    from_location,
    to_location,
    no_project,
    pid,              // Usuario
    notes,
    reference_id     // PO ID, requisition ID, etc.
  }
  ```
- **Características especiales:**
  - Detecta proyecto inactivo
  - Actualiza BOM state a 'Delivered'
  - Maneja cantidad en UNA llamada (no loop)
  - Transaccional

#### **GET `/api/movements/history`**
- **Query:** `project, part, limit, offset`
- **Retorna:** Historial de movimientos ordenado por fecha DESC

#### **GET `/api/movements/last`**
- **Retorna:** Último movimiento registrado

---

### 📈 MÓDULO DE REPORTES Y ANÁLISIS

#### **GET `/api/dead-inventory`**
- **Lógica:** Obtiene items sin movimiento en período
- **Retorna:** 
  ```javascript
  [
    {
      no_part,
      description,
      quantity,
      last_movement_date,
      days_inactive,
      warehouse,
      value
    }
  ]
  ```

#### **GET `/api/trackingCards`**
- **Retorna:** Tarjetas de seguimiento para dashboard
- **Incluye:** Totales, pendientes, status distribution

---

### 🏪 MÓDULO DE PROVEEDORES (VENDORS)

#### **GET `/api/vendors`**
- **Retorna:** Lista de todos los proveedores
- **Campos:** id, name, contact, email, phone

#### **GET `/api/vendors/search`**
- **Query:** `searchTerm`
- **Búsqueda:** En nombre, contacto, email
- **Retorna:** Array filtrado

#### **POST `/api/vendors`**
- **Body:** `{ name, contact, email, phone, address }`
- **Retorna:** Vendor creado con ID

---

### 🌐 MÓDULO DE REDES (NETWORKS)

#### **GET `/api/networks`**
- **Retorna:** Todas las redes disponibles

#### **GET `/api/network/balance/:network`**
- **Retorna:** Balance disponible de la red

#### **POST `/api/networks`**
- **Crea nueva red de distribución**

#### **PUT `/api/networks/:network`**
- **Actualiza parámetros de red**

#### **DELETE `/api/networks/:network`**
- **Elimina red** (solo si no tiene compras activas)

---

### 🛠️ FUNCIONES UTILITARIAS BACKEND

**`sanitizePid(rawPid)`** - Limpia PIDs de entrada
**`getPidCandidates(normalizedPid)`** - Genera variantes para búsqueda
**`resolveExistingUserPid(rawPid)`** - Valida PID en BD

---

## Componentes Frontend Detallados

### 📄 ARCHIVO: auth.js

**Propósito:** Control de autenticación y sesiones

#### **Funciones Principales:**

**`getUser()`**
- Retorna: Usuario actual desde sessionStorage
- Normaliza datos de usuario

**`setUser(user)`**
- Establece usuario en sessionStorage
- Inicia monitor de inactividad

**`clearUser()`**
- Limpia datos de sesión
- Detiene timer de inactividad

**`validateQr(pid)`** - Async
- Llamada POST a `/api/auth/validate-qr`
- Retorna: Usuario validado o error
- Maneja escaneo de código QR

**`validateCredentials(userName, password)`** - Async
- Llamada POST a `/api/auth/validate-credentials`
- Validación de credenciales
- Manejo de errores de autenticación

**`requireAuth(options)`**
- Middleware que protege páginas
- Redirige a login si no está autenticado
- Opciones: `{ roles: [...], requiredRoles: [...] }`

**`checkSessionInactivity()`**
- Verifica si sesión expiró
- Para usuarios técnicos: expira después de inactividad
- Para otros: mantiene sesión abierta

**`bindActivityEvents()`**
- Listener en: click, keydown, touchstart, mousemove
- Registra actividad para cálculo de inactividad

**`logout(redirectTo)`**
- Limpia sesión
- Redirige a login
- Parámetro opcional: página de redirección

---

### 📦 ARCHIVO: bom.js

**Propósito:** Gestión de carga y visualización de BOM desde Excel

#### **Funciones:**

**`loadExistingProjects()`** - Async
- GET `/api/projects/all`
- Carga proyectos para autocompletado
- Almacena en `existingProjects[]`

**`updateProjectSuggestions(searchText)`**
- Filtra proyectos por búsqueda
- Actualiza datalist dinámicamente

**Upload Form Handler**
- Detecta cambios en input file
- Valida formato Excel
- Envía POST a `/api/bom` con FormData
- Muestra resultado: éxito o error

---

### 📊 ARCHIVO: bomView.js

**Propósito:** Visualización y filtrado de datos BOM

#### **Funciones:**

**`loadBOMData()`** - Async
- GET `/api/bomView`
- Obtiene todos los BOM del sistema

**`displayBOMData(data)`**
- Renderiza tabla HTML
- Columnas: no_part, description, required, available, status
- Cada fila linkeable al detalle

**`loadProjects()`** - Async
- GET `/api/projects/active`
- Carga proyectos en select dropdown
- Permite filtrado por proyecto

---

### 💳 ARCHIVO: recordPurchase.html + JS Integrado

**Propósito:** Interfaz de registro de compras con características avanzadas

#### **Componentes Frontend:**

**Selector de Proyecto**
- Input autocompleted
- Valida existencia
- Carga automáticamente tipos/marcas

**Type or Brand Autocomplete** (v2)
- Campo dual búsqueda: TIPOS Y MARCAS
- Endpoint: `/api/products/types-by-project/:no_project`
- Estructura:
  ```
  PRODUCT TYPES
    ├─ Resistencia
    ├─ Capacitor
    └─ Semiconductor
  
  BRANDS
    ├─ Sony
    ├─ Samsung
    └─ LG
  ```
- Detecta categoría seleccionada vía `dataset.type`

**Vendor Autocomplete**
- Reemplaza select fijo
- GET `/api/vendors` + search
- Busca por nombre o ID
- Guarda `id_vendor` en campo hidden

**Tabla de Items Agregados**
- Checkbox por fila
- Checkbox "Select All"
- Botón "Delete Selected Items"
- Actualización dinámica de total
- Eliminación con confirmación

**Cálculo de BOM**
- GET `/api/products/bom-calculation`
- Parámetros: `no_project`, `type_p` O `brand`, `network`
- Retorna productos con cantidades

---

### 📈 ARCHIVO: reports.js

**Propósito:** Sistema de reportes con múltiples vistas

#### **Estructuras de Datos:**

**REPORT_MODES:**
```javascript
{
  "pending-purchases": {
    pendingLabel: "expense records",
    filterMode: "po"
  },
  "dead-inventory": {
    filterMode: "dead"
  }
}
```

#### **Variables Principales:**

- `allPurchases` - Array de todas las compras
- `allProjects` - Array de proyectos
- `pendingPurchases` - Compras filtradas
- `currentFilteredRows` - Filas después de filtros
- `statusChart` - Instancia Chart.js para estado
- `projectsChart` - Instancia Chart.js para proyectos
- `activeReportType` - Tipo de reporte visible

#### **Funciones:**

**`loadPendingPurchases()`** - Async
- GET `/api/purchases?status=pending`
- Carga compras pendientes

**`displayPendingPurchases(purchases)`**
- Renderiza tabla de compras
- Mapea estado de compra
- Calcula KPIs:
  - Total de compras
  - Pendientes vs Citadas
  - Proyectos con pendientes

**`initStatusChart()`**
- Chart.js: Gráfico de pastel de estados
- Actualiza en tiempo real

**`initProjectsChart()`**
- Chart.js: Gráfico de barras por proyecto
- Ordena por cantidad

---

### 🔄 ARCHIVO: io.html (Entrada/Salida de Stock)

**Propósito:** Interfaz para movimientos de stock con QR

#### **Funciones Especiales:**

**`isProjectInactive(no_project)`** - Async
- GET `/api/projects/check/:no_project`
- Detecta proyectos inactivos
- Retorna: boolean

**`promptRackForInactiveProject(no_project, no_part)`** - Async
- Muestra modal para seleccionar rack
- Almacena en `inactiveProjectRackMap`
- Evita re-preguntar por mismo proyecto:part

**`registerMovement(cantidad)`** - Async
- POST `/api/movements` O `/api/inbound`
- Parámetro: cantidad (NO loop)
- Detecta proyecto inactivo → prompt rack
- Actualiza estado BOM a 'Delivered'

#### **Características Especiales:**

**Manejo de Proyectos Inactivos:**
1. User escanea QR de proyecto inactivo
2. Sistema detecta vía `/api/projects/check`
3. Muestra modal de selección de rack
4. Guarda selección en mapa para reusar
5. Registra INBOUND + actualiza BOM status

---

### 🎨 ARCHIVO: style.css

**Propósito:** Estilos globales del sistema

#### **Temas Principales:**

**Login UI:**
- Overlay full-screen
- Card centrada
- Estilos para QR mode y credentials mode
- Animaciones de escaneo

**Navbar:**
- Bootstrap navbar dark gradient
- Logo + navegación
- Responsive toggle

**User Info Bar:**
- Información de usuario logueado
- Badge de rol
- Botón logout

**Componentes Bootstrap:**
- Tablas con hover
- Modales personalizadas
- Alertas temáticas
- Botones con iconografía

**Layout Grid:**
- CSS Grid para dashboards
- Flex para componentes
- Media queries responsivas

---

### 🏗️ ESTRUCTURA DE DATOS PRINCIPAL

#### **Usuario Autenticado**
```javascript
{
  pid,
  user_name,
  last_name,
  rol,           // 'admin', 'technician', 'manager', 'viewer'
  last_activity, // timestamp
  session_id     // UUID
}
```

#### **Proyecto**
```javascript
{
  no_project,    // Identificador único
  name_project,  // Nombre descriptivo
  status,        // 'active', 'inactive', 'completed'
  created_date,
  updated_date
}
```

#### **Producto (Stock)**
```javascript
{
  qr_code,
  no_part,
  description,
  warehouse,
  rack,
  no_project,
  quantity,
  unit,
  purchase_price,
  available
}
```

#### **Compra (Purchase)**
```javascript
{
  id,
  no_project,
  no_part,
  quantity,
  unit_price,
  total_price,
  vendor_id,
  vendor_name,
  purchase_date,
  purchase_status, // 'pending', 'quoted', 'approved', 'received'
  network,
  created_by,
  created_date
}
```

---

## Flujos de Datos

### 🔄 Flujo: Registro de Entrada de Mercancía (Inbound)

```
User (io.html)
    ↓ Escanea QR
POST /api/stock/available/:qr_code
    ↓ Obtiene datos del producto
HTML UI actualiza con producto
    ↓ User escanea cantidad (manual o automática)
¿Proyecto Inactivo?
    ├─ SÍ → GET /api/projects/check/:no_project
    │       ├─ SÍ → Muestra modal de rack
    │       ├─ User selecciona rack
    │       └─ Guarda en inactiveProjectRackMap
    └─ NO → Continúa
User confirma entrada
    ↓
POST /api/inbound o /api/inbound-with-rack
    ↓ Backend:
    1. Valida datos del producto
    2. Actualiza tabla stock (quantity += input)
    3. Registra en tabla movements
    4. Si proyecto inactivo: 
       - Cambia no_project a 'AUT-STOCK'
       - UPDATE bom_project SET status = 'Delivered'
    5. Retorna confirmación
    ↓
HTML actualiza: Muestra confirmación con timestamp
```

### 🔄 Flujo: Registro de Compra (Purchase)

```
User (recordPurchase.html)
    ↓ Selecciona Proyecto
GET /api/products/types-by-project/:no_project
    ↓ Carga tipos y marcas
    ↓ Selecciona Type o Brand
GET /api/products/bom-calculation?no_project=...&type_p=...&brand=...
    ↓ Retorna productos disponibles en BOM
    ↓ User selecciona proveedor (Vendor autocomplete)
GET /api/vendors/search
    ↓ Selecciona red (Network)
    ↓ Completa: Cantidad, Precio, Fecha
    ↓ Agrega producto a tabla
    ↓ (Puede agregar múltiples)
    ↓ User presiona Submit
POST /api/purchases
    ├─ Body: no_project, no_part[], quantities[], prices[]
    ├─ Backend valida cada línea
    └─ Inserta múltiples registros en purchase
    ↓
HTML: Muestra confirmación y limpiar formulario
```

### 🔐 Flujo: Autenticación

```
User abre index.html
    ↓ auth.js ejecuta requireAuth()
    ↓ ¿Usuario en sessionStorage? 
    ├─ NO → Redirige a login
    └─ SÍ → ¿Sesión expirada?
        ├─ SÍ → Clearuser(), Redirige a login
        └─ NO → Continúa, Inicia monitor inactividad
    ↓
User elige modo:
├─ QR Mode (default)
│   ├─ User escanea QR
│   └─ POST /api/auth/validate-qr
│       ├─ Backend valida pid en user_
│       ├─ Retorna user + roles
│       └─ Frontend: setUser(), sessionStorage
│
└─ Credentials Mode
    ├─ User ingresa user_name + password
    └─ POST /api/auth/validate-credentials
        ├─ Backend verifica credenciales
        ├─ Retorna user + roles
        └─ Frontend: setUser(), sessionStorage
    ↓
User logueado, inicia sistema
    ↓ Cada 30seg: checkSessionInactivity()
    ├─ ¿Hay actividad?
    │   ├─ NO + Técnico + >30min → logout automático
    │   └─ SÍ → Continúa
    └─ Reinicia timer
```

---

## Integraciones y Dependencias

### 📚 Dependencias Externas (NPM)

| Paquete | Versión | Uso |
|---------|---------|-----|
| express | ^4.21.2 | Servidor HTTP y routing |
| pg | ^8.16.3 | Driver PostgreSQL |
| cors | ^2.8.5 | Permitir CORS |
| multer | ^1.4.5-lts.1 | Manejo de file uploads |
| xlsx | ^0.18.5 | Lectura/escritura Excel |

### 🌐 Librerías Frontend (CDN)

| Librería | Versión | Uso |
|----------|---------|-----|
| Bootstrap | 5.3.2 | Framework CSS |
| Bootstrap Icons | 1.10.5 | Iconografía |
| Google Fonts | Poppins | Tipografía |

### 🗄️ Base de Datos

**PostgreSQL 13+** con tablas:
- user_
- product
- bom_project
- project
- purchase
- stock
- movements
- network
- vendor
- (más según necesidad)

---

## 📌 Notas Importantes de Desarrollo

### Performance
- Consultas SQL usan índices en columnas frecuentemente buscadas
- Paginación en endpoints de lista (limit/offset)
- Caching de proyectos y proveedores en frontend

### Seguridad
- Validación y sanitización de PID
- Roles y permisos validados en backend
- Sesiones en sessionStorage (no localStorage)
- Logout automático por inactividad

### Escalabilidad
- Estructura modular en backend
- API REST bien definida
- Frontend desacoplado del backend
- Soporte para múltiples usuarios y proyectos

### Testing
- Endpoints de debug: `/api/db-check`, `/api/bomView/debug`
- Logging en movimientos de inventario
- Mensajes de error descriptivos

---

**Documento Finalizado: 26/04/2026**

