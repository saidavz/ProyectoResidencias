# RESUMEN EJECUTIVO - Arquitectura del Sistema

**Documento de Referencia Rápida**
**Proyecto:** Sistema de Gestión de Compras y Inventario
**Versión:** 1.0
**Fecha:** 26 de Abril de 2026

---

## 🏗️ ARQUITECTURA DEL SISTEMA

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (HTML5/CSS3/JS)                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  index.html  │  │ stock.html   │  │ io.html      │  ...     │
│  │ (Dashboard)  │  │ (Inventory)  │  │ (Movements)  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│         ▲                  ▲                  ▲                  │
│         │                  │                  │                  │
│  ┌──────┴──────────────────┴──────────────────┴──────────────┐  │
│  │         Fetch API (REST Calls)                           │  │
│  │         auth.js, bom.js, reports.js, etc.               │  │
│  └──────┬──────────────────┬──────────────────┬──────────────┘  │
│         │                  │                  │                  │
└─────────┼──────────────────┼──────────────────┼──────────────────┘
          │                  │                  │
          │                  │                  │
┌─────────▼──────────────────▼──────────────────▼──────────────────┐
│                    API REST (Express.js)                         │
│                        PORT: 3000                                │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│   /api/auth          /api/products       /api/stock          │
│   /api/users         /api/projects       /api/bom            │
│   /api/purchases     /api/movements      /api/vendors        │
│   /api/networks      /api/requisitions   /api/reports        │
│                                                                │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │ SQL Queries (pg/node-postgres)
                 │
┌────────────────▼────────────────────────────────────────────────┐
│              PostgreSQL Database                                │
│         bd_purchase_system (localhost:5432)                    │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│   Tables: user_ | product | bom_project | project            │
│            purchase | stock | movements | vendor | network    │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## 📊 FLUJO DE COMPONENTES

### Capas de Aplicación

```
┌─────────────────────────┐
│   PRESENTACIÓN           │  HTML/CSS/JS
│   (Vistas de Usuario)    │  Bootstrap, Bootstrap Icons
└────────────┬────────────┘
             │
┌────────────▼────────────┐
│   LÓGICA FRONTEND        │  JavaScript Vanilla
│   (Gestión de Estado)    │  Fetch API, Sessions
└────────────┬────────────┘
             │
        API REST
             │
┌────────────▼────────────┐
│   LÓGICA BACKEND         │  Express.js
│   (Endpoints)            │  Middleware, Validación
└────────────┬────────────┘
             │
┌────────────▼────────────┐
│   DATOS                  │  PostgreSQL
│   (Persistencia)         │  Tablas, Índices
└─────────────────────────┘
```

---

## 📁 MAPEO DE ARCHIVOS

### Backend - purchase.js
```
purchase.js
├── Configuración Express
│   ├── CORS habilitado
│   ├── JSON parsing
│   ├── Static files serving
│   └── Multer setup
│
├── Funciones Utilitarias
│   ├── sanitizePid()
│   ├── getPidCandidates()
│   ├── resolveExistingUserPid()
│   └── requireMovementUserPid()
│
├── Endpoints (70+)
│   ├── /api/auth/...
│   ├── /api/users/...
│   ├── /api/products/...
│   ├── /api/projects/...
│   ├── /api/purchases/...
│   ├── /api/stock/...
│   ├── /api/bom/...
│   ├── /api/movements/...
│   ├── /api/vendors/...
│   ├── /api/networks/...
│   └── /api/requisitions/...
│
├── Vistas Estáticas
│   ├── /stock.html
│   ├── /recordPurchase.html
│   ├── /purchaseTracking.html
│   ├── /requisition.html
│   ├── /bom.html
│   ├── /index.html
│   └── /
│
└── Servidor
    └── app.listen(3000)
```

### Frontend - Archivos HTML
```
index.html
├── Dashboard principal
├── Navegación
├── User info bar
└── Links a módulos

stock.html
├── Vista de inventario
├── Filtros
└── Movimientos

io.html
├── Entrada/Salida QR
├── Registro de movimientos
└── Manejo de proyectos inactivos

recordPurchase.html
├── Formulario de compra
├── Autocompletes (Proyecto, Type/Brand, Vendor)
├── Tabla de items
└── Cálculo BOM

(+ 5 más: purchaseTracking, requisition, bom, bomView, createQr, reports)
```

### Frontend - Archivos JavaScript
```
auth.js
├── Autenticación (QR/Credenciales)
├── Gestión de sesiones
├── Monitor de inactividad
└── Control de roles

bom.js
├── Carga de Excel
└── Autocompletado de proyectos

bomView.js
├── Visualización de BOM
└── Filtrado

reports.js
├── Generación de reportes
├── Gráficos (Chart.js)
└── KPIs

printQr.js
└── Impresión de QR

script.js
└── Funciones globales

purchase.js (backend)
└── Servidor Express
```

### Frontend - Estilos
```
style.css
├── Login UI
├── Navbar
├── User info bar
├── Componentes Bootstrap
├── Layouts (Grid/Flex)
└── Responsivos
```

---

## 🔄 FLUJOS PRINCIPALES

### 1️⃣ FLUJO: ENTRADA DE MERCANCÍA (Inbound)

```
START
  │
  ├─ User abre io.html
  │
  ├─ Escanea QR del producto
  │
  ├─ GET /api/stock/available/:qr_code
  │
  ├─ ¿Proyecto inactivo?
  │  ├─ SÍ → GET /api/projects/check
  │  │      └─ Muestra modal rack selection
  │  └─ NO → Continúa
  │
  ├─ User confirma cantidad
  │
  ├─ POST /api/inbound O /api/inbound-with-rack
  │
  ├─ Backend:
  │  ├─ Valida producto
  │  ├─ Actualiza stock
  │  ├─ Registra movimiento
  │  └─ Si inactivo: Cambia project + marca BOM Delivered
  │
  ├─ Retorna confirmación
  │
  └─ END

SUCCESS: Item registrado, BOM actualizado
```

### 2️⃣ FLUJO: REGISTRO DE COMPRA

```
START
  │
  ├─ User abre recordPurchase.html
  │
  ├─ Selecciona PROYECTO
  │
  ├─ GET /api/products/types-by-project/:no_project
  │
  ├─ Selecciona TYPE o BRAND (autocompletado dual)
  │
  ├─ GET /api/products/bom-calculation?...
  │
  ├─ Selecciona VENDOR (autocomplete)
  │
  ├─ Selecciona NETWORK
  │
  ├─ Completa cantidad, precio, fecha
  │
  ├─ AGREGAR a tabla
  │
  ├─ (Puede agregar más ítems)
  │
  ├─ Presiona SUBMIT
  │
  ├─ POST /api/purchases
  │
  ├─ Backend procesa cada línea
  │
  ├─ Retorna confirmación
  │
  └─ END

SUCCESS: Compra registrada, BOM actualizado
```

### 3️⃣ FLUJO: AUTENTICACIÓN

```
START
  │
  ├─ User accede a página protegida
  │
  ├─ auth.js ejecuta requireAuth()
  │
  ├─ ¿Usuario en sessionStorage?
  │  ├─ NO → Redirige a /index.html (login)
  │  └─ SÍ → Continúa
  │
  ├─ ¿Sesión expirada por inactividad?
  │  ├─ SÍ (Técnico + 30min) → Logout + Redirige
  │  └─ NO → Continúa
  │
  ├─ User elige QR o Credenciales
  │
  ├─ QR:
  │  ├─ Escanea código
  │  └─ POST /api/auth/validate-qr
  │
  ├─ Credenciales:
  │  ├─ User + Password
  │  └─ POST /api/auth/validate-credentials
  │
  ├─ Backend valida
  │
  ├─ Retorna usuario + roles
  │
  ├─ Frontend: setUser() en sessionStorage
  │
  ├─ Inicia monitor de inactividad
  │
  └─ END

SUCCESS: Usuario logueado, acceso permitido
```

---

## 📌 ENDPOINTS CRÍTICOS POR MÓDULO

### Autenticación (3 endpoints)
| Endpoint | Método | Uso |
|----------|--------|-----|
| /api/auth/validate-qr | POST | Login con QR |
| /api/auth/validate-credentials | POST | Login con usuario/pass |
| /api/db-check | GET | Verificar BD |

### Productos & BOM (5 endpoints)
| Endpoint | Método | Uso |
|----------|--------|-----|
| /api/products/bom-calculation | GET | Obtener productos por tipo/marca |
| /api/products/types-by-project/:no | GET | Tipos/marcas del proyecto |
| /api/bom | POST | Cargar BOM (Excel) |
| /api/bomView | GET | Ver BOM del sistema |
| /api/bom-project/update-status | PATCH | Cambiar estado BOM |

### Inventario (8 endpoints)
| Endpoint | Método | Uso |
|----------|--------|-----|
| /api/inbound | POST | Entrada de mercancía |
| /api/inbound-with-rack | POST | Entrada con rack |
| /api/outbound | POST | Salida de mercancía |
| /api/stock | GET | Todo el stock |
| /api/stock/by-project | GET | Stock por proyecto |
| /api/movements | POST | Registrar movimiento |
| /api/movements/history | GET | Historial |
| /api/stock/available/:qr | GET | Disponibilidad |

### Compras (4 endpoints)
| Endpoint | Método | Uso |
|----------|--------|-----|
| /api/purchases | POST | Crear compra |
| /api/purchases | GET | Listar compras |
| /api/purchases/status | PUT | Actualizar estado |
| /api/requisitions/save | POST | Guardar requisición |

### Proyectos (7 endpoints)
| Endpoint | Método | Uso |
|----------|--------|-----|
| /api/projects/all | GET | Todos los proyectos |
| /api/projects/active | GET | Solo activos |
| /api/projects/check/:no | GET | Verificar estado |
| /api/projects | POST | Crear proyecto |
| /api/projects/:no/status | PUT | Cambiar estado |
| /api/projects/with-movements | GET | Con movimientos |
| /api/projects-with-purchase | GET | Con compras |

---

## 🎯 MATRIZ DE COMPONENTES

### Por Tipo

#### 🔐 Seguridad & Autenticación
- `auth.js` (frontend)
- `/api/auth/*` (backend)
- Session storage
- Inactividad monitor

#### 📦 Producto & Catálogo
- `bom.js`, `bomView.js` (frontend)
- `/api/products/*` (backend)
- `/api/bom/*` (backend)
- Excel upload support

#### 💳 Compras & Requisiciones
- `recordPurchase.html` (frontend)
- `/api/purchases/*` (backend)
- `/api/requisitions/*` (backend)
- Dual autocomplete (Type/Brand)

#### 🏪 Inventario & Movimientos
- `io.html`, `stock.html` (frontend)
- `/api/stock/*` (backend)
- `/api/inbound*` (backend)
- `/api/outbound` (backend)
- `/api/movements/*` (backend)
- QR scanning support

#### 📊 Reportes & Analytics
- `reports.js` (frontend)
- `/api/dead-inventory` (backend)
- `/api/trackingCards` (backend)
- Chart.js integration

#### 🏢 Proyectos & Configuración
- Multiple HTML pages (frontend)
- `/api/projects/*` (backend)
- `/api/networks/*` (backend)
- `/api/vendors/*` (backend)

---

## 🛠️ TECNOLOGÍAS ESPECÍFICAS

### Backend Stack
```javascript
Node.js
├── Express 4.21.2
├── PostgreSQL (pg 8.16.3)
├── Multer 1.4.5 (file uploads)
├── CORS 2.8.5
└── XLSX 0.18.5 (Excel parsing)
```

### Frontend Stack
```javascript
HTML5 / CSS3 / JavaScript
├── Bootstrap 5.3.2 (CSS Framework)
├── Bootstrap Icons 1.10.5
├── Google Fonts (Poppins)
├── Fetch API (HTTP)
└── Chart.js (Gráficos) - opcional
```

### Database
```sql
PostgreSQL 13+
├── Tables: 9+
├── Relationships: FK constraints
├── Indexes: Performance optimization
└── Transactions: Data integrity
```

---

## 📊 ESTADÍSTICAS DEL SISTEMA

| Métrica | Cantidad |
|---------|----------|
| **Endpoints API** | 70+ |
| **Archivos HTML** | 10 |
| **Archivos JavaScript** | 7+ |
| **Tablas BD** | 9+ |
| **Dependencias NPM** | 5 |
| **Roles de Usuario** | 4+ |
| **Tipos de Movimiento** | 2+ |

---

## 🚀 PUNTOS CLAVE DE ARQUITECTURA

### Fortalezas
✅ REST API bien definida  
✅ Separación clara frontend/backend  
✅ Autenticación robusta (QR + Credenciales)  
✅ Transaccionalidad en movimientos críticos  
✅ Soporte para múltiples proyectos/usuarios  
✅ Manejo especial de proyectos inactivos  

### Características Únicas
🎯 Autocompletado dual (Type/Brand)  
🎯 Detección automática de proyectos inactivos  
🎯 QR scanning integrado  
🎯 Monitor de sesión por inactividad  
🎯 Cálculo dinámico de BOM  
🎯 Excel import/export  

### Areas de Extensión
🔧 Reportes adicionales  
🔧 Integración con sistemas externos  
🔧 Mobile app (usar misma API)  
🔧 Webhooks para notificaciones  
🔧 Auditoría y logging avanzado  

---

## 📞 REFERENCIAS RÁPIDAS

### Para Desarrolladores
- **Documentación detallada:** COMPONENTES_TECNICO_DETALLADO.md
- **Arquitectura completa:** COMPONENTES_ARQUITECTURA.md
- **API Base:** http://localhost:3000/api
- **BD:** postgres://localhost:5432/bd_purchase_system

### Para Consultores
- **Flujos de negocio:** Revisar secciones de FLUJO en este documento
- **Modelos de datos:** Tablas PostgreSQL
- **Integraciones:** API REST JSON

### Para Testing
- **/api/db-check** - Estado de la BD
- **/api/bomView/debug** - Debugging de BOM

---

## 📝 CAMBIOS RECIENTES (Según Memory)

### Versión del 16-03-2026
- Adición de manejo especial para proyectos inactivos
- Modal para selección de rack en inbound
- Actualización automática de BOM status a 'Delivered'

### Versión del 22-03-2026
- Fix: Movimientos de cantidad grande (74+)
- Cambio: Una llamada con cantidad total en vez de loop
- Mejorado: BOM update con cantidad correcta

### Versión del 24-04-2026 (recordPurchase v2)
- Eliminación múltiple de items (checkboxes)
- Autocompletado dual Type/Brand
- Vendor autocomplete mejorado
- Actualización dinámica de totales

---

**Versión: 1.0**  
**Última actualización: 26 de Abril de 2026**  
**Estado: Documentación Completa**

