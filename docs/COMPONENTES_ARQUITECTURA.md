# Sistema de Gestión de Compras y Inventario - Componentes Técnicos

**Documento de Arquitectura: Backend y Frontend**
**Fecha:** 26 de Abril de 2026

---

## 📋 ÍNDICE

1. [Backend - Componentes](#backend---componentes)
2. [Frontend - Componentes](#frontend---componentes)
3. [Stack Tecnológico](#stack-tecnológico)
4. [Base de Datos](#base-de-datos)

---

## Backend - Componentes

### 📡 Servidor Principal
- **Archivo:** `purchase.js`
- **Framework:** Express.js
- **Puerto:** 3000
- **Tipo Módulo:** ES Modules

### 🔑 Dependencias Backend
```json
{
  "cors": "^2.8.5",
  "express": "^4.21.2",
  "multer": "^1.4.5-lts.1",
  "pg": "^8.16.3",
  "xlsx": "^0.18.5"
}
```

### 🗄️ Configuración de Base de Datos
- **Motor:** PostgreSQL
- **Host:** localhost
- **Puerto:** 5432
- **Base de datos:** bd_purchase_system
- **Usuario:** postgres

### 📊 Endpoints API Backend

#### 🔐 AUTENTICACIÓN
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/auth/validate-qr` | Validar login con código QR (PID) |
| POST | `/api/auth/validate-credentials` | Validar login con usuario y contraseña |
| GET | `/api/db-check` | Verificar estructura y estado de BD |

#### 👥 GESTIÓN DE USUARIOS
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/users` | Crear nuevo usuario |
| GET | `/api/users/search` | Buscar usuarios |
| POST | `/api/users/delete` | Eliminar usuario |

#### 📦 GESTIÓN DE PRODUCTOS
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/products` | Obtener todos los productos |
| GET | `/api/products/search` | Buscar productos |
| GET | `/api/products/bom-calculation` | Calcular BOM por tipo/marca |
| GET | `/api/products/byType` | Obtener productos por tipo |
| GET | `/api/products/types` | Obtener todos los tipos de productos |
| GET | `/api/products/types-by-project/:no_project` | Obtener tipos/marcas por proyecto |

#### 🏢 GESTIÓN DE PROYECTOS
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/projects/search` | Buscar proyectos |
| GET | `/api/projects/all` | Obtener todos los proyectos |
| GET | `/api/projects/all-including-inactive` | Obtener proyectos incluyendo inactivos |
| GET | `/api/projects/active` | Obtener solo proyectos activos |
| GET | `/api/projects/check/:no_project` | Verificar estado de proyecto |
| GET | `/api/projects/with-movements` | Obtener proyectos con movimientos |
| GET | `/api/projects-with-purchase` | Obtener proyectos con compras |
| GET | `/api/projects-po` | Obtener proyectos PO (Purchase Order) |
| POST | `/api/projects` | Crear proyecto |
| PUT | `/api/projects/:no_project/status` | Actualizar estado de proyecto |

#### 📋 GESTIÓN DE COMPRAS
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/purchases` | Obtener todas las compras |
| POST | `/api/purchases` | Crear registro de compra |
| PUT | `/api/purchases/status` | Actualizar estado de compra |
| GET | `/api/paquetes-calculados` | Obtener paquetes calculados |

#### 🏪 GESTIÓN DE REDES
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/networks` | Obtener todas las redes |
| GET | `/api/network/balance/:network` | Obtener balance de red |
| POST | `/api/networks` | Crear red |
| PUT | `/api/networks/:network` | Actualizar red |
| DELETE | `/api/networks/:network` | Eliminar red |

#### 📚 GESTIÓN DE BOM (Bill of Materials)
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/bom` | Cargar BOM desde archivo Excel |
| DELETE | `/api/bom/:no_project` | Eliminar BOM de proyecto |
| GET | `/api/bomView` | Obtener vista de BOM |
| PATCH | `/api/bom-project/update-status` | Actualizar estado de BOM project |
| GET | `/api/bom-projects/search` | Buscar BOM projects |

#### 📦 GESTIÓN DE STOCK
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/stock` | Obtener todo el stock |
| GET | `/api/stock/summary` | Obtener resumen de stock |
| GET | `/api/stock/by-project` | Obtener stock por proyecto |
| GET | `/api/stock/by-part-austocked/:noPart` | Stock AUT-STOCK por parte |
| GET | `/api/stock/by-part-inactive/:noPart` | Stock inactivo por parte |
| GET | `/api/stock/available/:qr_code` | Obtener disponibilidad por código QR |
| GET | `/api/stock/available-austocked/:noPart` | Stock disponible AUT-STOCK |
| GET | `/api/stock/qr-code` | Obtener stock por QR code |
| GET | `/api/stock/first-rack` | Obtener primer rack |
| GET | `/api/stock/distinct-filters` | Obtener filtros distintos de stock |
| POST | `/api/stock/entry` | Registrar entrada de stock |

#### 📥 MOVIMIENTOS DE INVENTARIO
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/inbound` | Registrar entrada de mercancía |
| POST | `/api/inbound-with-rack` | Registrar entrada con especificación de rack |
| POST | `/api/outbound` | Registrar salida de mercancía |
| POST | `/api/movements` | Registrar movimiento general |
| GET | `/api/movements/last` | Obtener último movimiento |
| GET | `/api/movements/history` | Obtener historial de movimientos |

#### 📋 REQUISICIONES
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/requisitions/save` | Guardar requisición |

#### 📊 PROVEEDORES
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/vendors` | Obtener todos los proveedores |
| GET | `/api/vendors/:id` | Obtener proveedor por ID |
| GET | `/api/vendors/search` | Buscar proveedores |
| POST | `/api/vendors` | Crear proveedor |

#### 📈 REPORTES Y ANÁLISIS
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/trackingCards` | Obtener tarjetas de seguimiento |
| GET | `/api/dead-inventory` | Obtener inventario inactivo |
| GET | `/api/bomView/debug` | Debug información de BOM |

#### 📄 VISTAS ESTÁTICAS
| Ruta | Descripción |
|------|-------------|
| GET `/stock.html` | Página de gestión de stock |
| GET `/recordPurchase.html` | Página de registro de compras |
| GET `/purchaseTracking.html` | Página de seguimiento de compras |
| GET `/requisition.html` | Página de requisiciones |
| GET `/bom.html` | Página de gestión BOM |
| GET `/index.html` | Página principal |
| GET `/` | Redirección a home |

---

## Frontend - Componentes

### 📄 Archivos HTML (Vistas)

| Archivo | Descripción | Funcionalidad |
|---------|-------------|---------------|
| `index.html` | Página principal y dashboard | Home del sistema, acceso a módulos |
| `stock.html` | Gestión de inventario | Consultar stock, movimientos de entrada/salida |
| `io.html` | Entrada/Salida de stock | Registro de inbound y outbound con QR |
| `recordPurchase.html` | Registro de compras | Crear y registrar órdenes de compra |
| `purchaseTracking.html` | Seguimiento de compras | Visualizar estado de compras |
| `requisition.html` | Requisiciones | Crear y gestionar requisiciones |
| `bom.html` | Gestión de BOM | Cargar/actualizar Bill of Materials |
| `bomView.html` | Visualización de BOM | Ver componentes del BOM |
| `createQr.html` | Generación de códigos QR | Crear códigos QR para productos |
| `reports.html` | Reportes y análisis | Reportes de compras, inventario muerto, etc. |

### 🎨 Estilos
| Archivo | Descripción |
|---------|-------------|
| `style.css` | Estilos globales y componentes |

**Librerías CSS utilizadas:**
- Bootstrap 5.3.2 (CDN)
- Bootstrap Icons 1.10.5 (CDN)
- Google Fonts: Poppins

### ⚙️ Archivos JavaScript (Lógica)

#### 🔐 Autenticación
| Archivo | Descripción |
|---------|-------------|
| `auth.js` | Sistema de autenticación: QR, credenciales, sesiones, inactividad, roles |

**Funciones principales:**
- `validateQr(pid)` - Validación de código QR
- `validateCredentials(userName, password)` - Validación de credenciales
- `requireAuth(options)` - Middleware de autenticación
- `logout(redirectTo)` - Cerrar sesión
- `getUser()` - Obtener usuario actual
- `setUser(user)` - Establecer usuario
- `checkSessionInactivity()` - Verificar inactividad

#### 📦 BOM (Bill of Materials)
| Archivo | Descripción |
|---------|-------------|
| `bom.js` | Carga de BOM desde archivos Excel |
| `bomView.js` | Visualización y consulta de datos BOM |

**Funciones principales (bom.js):**
- `loadExistingProjects()` - Cargar proyectos existentes
- `updateProjectSuggestions(searchText)` - Actualizar sugerencias
- Manejo de carga de archivos Excel

**Funciones principales (bomView.js):**
- `loadBOMData()` - Cargar datos de BOM desde API
- `displayBOMData(data)` - Mostrar datos en tabla
- `loadProjects()` - Cargar lista de proyectos

#### 🛒 Compras
| Archivo | Descripción |
|---------|-------------|
| `purchase.js` | Lógica backend de gestión de compras |

**Componentes en frontend (recordPurchase.html):**
- Selección de proyecto con autocompletado
- Campo "Type or Brand" con búsqueda dual
- Autocompletado de proveedores (Vendor)
- Selección de red
- Cálculo automático de BOM
- Eliminación múltiple de ítems
- Tabla con checkboxes

#### 📊 Reportes
| Archivo | Descripción |
|---------|-------------|
| `reports.js` | Lógica de generación y visualización de reportes |

**Tipos de reportes:**
- Compras pendientes (PO y Shopping Cart)
- Inventario inactivo
- Análisis por estado
- Análisis por proyecto
- KPIs de compras

#### 🖨️ Generación de QR
| Archivo | Descripción |
|---------|-------------|
| `printQr.js` | Generación e impresión de códigos QR |

**Funciones:**
- `printQRCodes()` - Imprimir códigos QR

#### 📋 Requisiciones
| Archivo | Descripción |
|---------|-------------|
| Lógica integrada en `requisition.html` | Creación de requisiciones |

#### 🏪 Inventario/Stock
| Archivo | Descripción |
|---------|-------------|
| Lógica integrada en `io.html` y `stock.html` | Gestión de movimientos de stock |

**Funciones en io.html:**
- `isProjectInactive(no_project)` - Verificar si proyecto está inactivo
- `promptRackForInactiveProject(no_project, no_part)` - Solicitar rack para proyecto inactivo
- `registerMovement(cantidad)` - Registrar movimiento de inventario

#### 🔧 Utilidades
| Archivo | Descripción |
|---------|-------------|
| `script.js` | Funciones globales y utilidades generales |

---

## Stack Tecnológico

### Backend
- **Runtime:** Node.js (ES Modules)
- **Framework Web:** Express.js
- **Base de Datos:** PostgreSQL
- **ORM/Queries:** node-postgres (pg)
- **Middleware:** CORS, Multer (file uploads)
- **Librerías Adicionales:** XLSX (lectura de Excel)

### Frontend
- **Estándares:** HTML5, CSS3, JavaScript (vanilla)
- **Framework CSS:** Bootstrap 5.3.2
- **Iconografía:** Bootstrap Icons 1.10.5
- **Fuentes:** Google Fonts (Poppins)
- **APIs del Cliente:** Fetch API

### Infraestructura
- **Gestión de Versiones:** Git
- **Directorio de Cargas:** `/uploads/`
- **Servicio Estático:** Express.js static middleware

---

## Base de Datos

### 📊 Tablas Principales

| Tabla | Descripción |
|-------|-------------|
| `user_` | Información de usuarios, autenticación |
| `product` | Catálogo de productos |
| `bom_project` | Bill of Materials por proyecto |
| `project` | Proyectos activos e inactivos |
| `purchase` | Órdenes de compra y compras registradas |
| `stock` | Inventario disponible |
| `movements` | Historial de movimientos |
| `network` | Redes de distribución |
| `vendor` | Proveedores |

### 🔑 Características
- Soporte de transacciones
- Validación de tipos de datos
- Integridad referencial
- Índices para búsquedas optimizadas

---

## 📝 Características de Seguridad Implementadas

### Backend
- Validación y sanitización de inputs (especialmente PID)
- Validación de sesión en movimientos
- Control de acceso basado en roles
- Manejo de errores y logging

### Frontend
- Sistema de autenticación dual (QR y credenciales)
- Control de sesión con inactividad automática
- Validación de roles de usuario
- Protección de información sensible

---

## 🚀 Funcionalidades Principales del Sistema

1. **Gestión de Autenticación:** Login con QR o credenciales
2. **Gestión de Proyectos:** Crear, actualizar, cambiar estado (activo/inactivo)
3. **Bill of Materials (BOM):** Cargar desde Excel, visualizar, actualizar estado
4. **Gestión de Compras:** Crear PO, shopping cart, seguimiento
5. **Gestión de Inventario:** Entrada/Salida con código QR, por proyecto
6. **Stock Intelligence:** Tracking de disponibilidad por proyecto y parte
7. **Reportes:** Compras pendientes, inventario muerto, análisis por proyecto
8. **Gestión de Proveedores:** Catálogo de vendors
9. **Requisiciones:** Crear y gestionar requisiciones

---

## 📌 Notas Adicionales

- Sistema es responsivo (Bootstrap)
- Usa CSS Grid y Flexbox para layouts
- Soporta múltiples roles de usuario
- Integración completa entre frontend-backend vía API REST
- Manejo de archivos Excel para importación de datos
- Soporte para código QR en operaciones de inventario

---

**Documento Generado:** 26/04/2026
**Estado:** Versión 1.0

