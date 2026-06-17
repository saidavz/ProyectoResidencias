# 📚 MANUAL TÉCNICO - ÍNDICE PRINCIPAL

**Sistema de Gestión de Compras y Inventario**  
**Manual Técnico Completo**  
**Versión 1.0 - Abril 26, 2026**

---

## 🎯 DESCRIPCIÓN GENERAL DEL SISTEMA

Sistema web completo de gestión de compras, inventario y Bill of Materials (BOM) para empresas. Permite el control de:

- **Compras:** Creación de órdenes de compra, seguimiento, proveedores
- **Inventario:** Entrada/salida de mercancía con código QR, stock por proyecto
- **BOM:** Carga desde Excel, visualización, asociación con proyectos
- **Reportes:** Análisis de compras, inventario muerto, KPIs
- **Autenticación:** Sistema de login dual (QR + credenciales), control por roles

---

## 📄 DOCUMENTOS DEL MANUAL

### 1. **COMPONENTES_ARQUITECTURA.md** ⭐ COMIENZA AQUÍ
**Propósito:** Overview completo de todos los componentes  
**Contenido:**
- Listado de todos los endpoints API (70+)
- Estructura de archivos (Backend/Frontend)
- Dependencias y herramientas
- Stack tecnológico
- Tablas de base de datos
- Características de seguridad

**Cuándo usarlo:**
- Para entender la arquitectura general
- Para una visión macro del sistema
- Para documentación formal del manual técnico
- Para identificar qué componente hace cada cosa

---

### 2. **COMPONENTES_TECNICO_DETALLADO.md** 🔧 NIVEL TÉCNICO
**Propósito:** Especificación técnica profunda de cada componente  
**Contenido:**
- Detalles de cada módulo backend
- Parámetros de cada endpoint (entrada/salida)
- Funciones y métodos con descripción
- Estructuras de datos principales
- Flujos de datos completos
- Integraciones

**Cuándo usarlo:**
- Para desarrolladores implementando nuevas features
- Para entender cómo funciona internamente cada parte
- Para debugging y troubleshooting
- Para especificaciones de API

**Secciones principales:**
- Módulo de Autenticación
- Módulo de Productos & BOM
- Módulo de Stock e Inventario
- Módulo de Compras y Requisiciones
- Módulo de Movimientos
- Archivos JavaScript frontend

---

### 3. **CASOS_DE_USO_Y_FLUJOS.md** 👥 PROCESOS DE NEGOCIO
**Propósito:** Cómo usan el sistema los usuarios finales  
**Contenido:**
- Actores del sistema y roles
- 6 casos de uso principales con flujos
- Diagramas ASCII de flujos detallados
- Procesos por rol (Technician, Manager, Admin, Viewer)
- Matriz de permisos
- Secuencias críticas (Proyecto Inactivo)
- State transitions (estado de compras, proyectos)
- Casos especiales y excepciones

**Cuándo usarlo:**
- Para capacitación de usuarios
- Para entender procesos de negocio
- Para diseño de features nuevas
- Para testing de funcionalidades
- Para documentación de procesos

**Casos de Uso Incluidos:**
1. Autenticación en el Sistema
2. Registrar Entrada de Mercancía (INBOUND)
3. Crear Orden de Compra
4. Consultar Inventario
5. Generar Reporte de Compras Pendientes
6. Cargar Bill of Materials

---

### 4. **RESUMEN_EJECUTIVO.md** 📊 REFERENCIA RÁPIDA
**Propósito:** Visión rápida y diagramas del sistema  
**Contenido:**
- Diagrama de arquitectura (4 capas)
- Mapeo visual de archivos
- Flujos principales (3 diagramas principales)
- Estadísticas del sistema (endpoints, archivos, tablas)
- Endpoints críticos por módulo
- Matriz de componentes
- Puntos clave de arquitectura
- Referencias para diferentes roles

**Cuándo usarlo:**
- Para una visión rápida del sistema
- Para nuevos miembros del equipo
- Para presentaciones ejecutivas
- Para entender la arquitectura visualmente
- Como "cheat sheet" de referencia

---

## 🗺️ CÓMO NAVEGAR EL MANUAL

### Para Arquitectos / Diseñadores
1. **Comienza:** RESUMEN_EJECUTIVO.md (diagrama arquitectura)
2. **Profundiza:** COMPONENTES_ARQUITECTURA.md (tablas)
3. **Estudia:** COMPONENTES_TECNICO_DETALLADO.md (detalles)

### Para Desarrolladores Frontend
1. **Comienza:** COMPONENTES_TECNICO_DETALLADO.md (sección Frontend)
2. **Entiende:** CASOS_DE_USO_Y_FLUJOS.md (flujos UI)
3. **Referencia:** RESUMEN_EJECUTIVO.md (endpoints que llaman)

### Para Desarrolladores Backend
1. **Comienza:** COMPONENTES_TECNICO_DETALLADO.md (sección Backend)
2. **Referencia:** COMPONENTES_ARQUITECTURA.md (endpoints lista)
3. **Entiende:** CASOS_DE_USO_Y_FLUJOS.md (casos de uso)

### Para Project Managers / Product Owners
1. **Comienza:** CASOS_DE_USO_Y_FLUJOS.md (procesos de negocio)
2. **Referencia:** RESUMEN_EJECUTIVO.md (diagramas)
3. **Detalle:** COMPONENTES_ARQUITECTURA.md (si necesita)

### Para Personal de Testing/QA
1. **Comienza:** CASOS_DE_USO_Y_FLUJOS.md (qué probar)
2. **Referencia:** COMPONENTES_ARQUITECTURA.md (endpoints)
3. **Detalle:** COMPONENTES_TECNICO_DETALLADO.md (parámetros)

### Para Capacitación de Usuarios
1. **Comienza:** CASOS_DE_USO_Y_FLUJOS.md (procesos por rol)
2. **Referencia:** RESUMEN_EJECUTIVO.md (diagramas)

---

## 🚀 ESTRUCTURA DEL SISTEMA

### Backend Stack
- **Runtime:** Node.js (ES Modules)
- **Framework:** Express.js
- **Base de Datos:** PostgreSQL (localhost:5432)
- **Puerto:** 3000
- **Dependencias:** cors, multer, pg, xlsx

### Frontend Stack
- **Estándares:** HTML5, CSS3, JavaScript Vanilla
- **Framework CSS:** Bootstrap 5.3.2
- **Arquitectura:** SPA (Single Page Application)
- **Comunicación:** Fetch API + REST

### Total de Componentes
- **70+ Endpoints API**
- **10 Archivos HTML**
- **7+ Archivos JavaScript**
- **9+ Tablas Base de Datos**
- **4 Niveles de Rol**

---

## 📊 ENDPOINTS POR CATEGORÍA

### Autenticación (3)
```
POST   /api/auth/validate-qr
POST   /api/auth/validate-credentials
GET    /api/db-check
```

### Usuarios (3)
```
POST   /api/users
GET    /api/users/search
POST   /api/users/delete
```

### Productos (5)
```
GET    /api/products
GET    /api/products/search
GET    /api/products/bom-calculation
GET    /api/products/byType
GET    /api/products/types
GET    /api/products/types-by-project/:no_project
```

### Proyectos (7)
```
GET    /api/projects/search
GET    /api/projects/all
GET    /api/projects/active
GET    /api/projects/check/:no_project
GET    /api/projects/with-movements
GET    /api/projects-with-purchase
POST   /api/projects
PUT    /api/projects/:no_project/status
```

### Stock (8)
```
GET    /api/stock
GET    /api/stock/summary
GET    /api/stock/by-project
GET    /api/stock/available/:qr_code
GET    /api/stock/by-part-austocked/:noPart
GET    /api/stock/by-part-inactive/:noPart
GET    /api/stock/qr-code
POST   /api/stock/entry
GET    /api/stock/available-austocked/:noPart
GET    /api/stock/first-rack
GET    /api/stock/distinct-filters
```

### Movimientos (5)
```
POST   /api/inbound
POST   /api/inbound-with-rack
POST   /api/outbound
POST   /api/movements
GET    /api/movements/history
GET    /api/movements/last
```

### BOM (5)
```
POST   /api/bom
DELETE /api/bom/:no_project
GET    /api/bomView
PATCH  /api/bom-project/update-status
GET    /api/bom-projects/search
```

### Compras (4)
```
POST   /api/purchases
GET    /api/purchases
PUT    /api/purchases/status
POST   /api/requisitions/save
```

### Redes (4)
```
GET    /api/networks
GET    /api/network/balance/:network
POST   /api/networks
PUT    /api/networks/:network
DELETE /api/networks/:network
```

### Proveedores (4)
```
GET    /api/vendors
GET    /api/vendors/:id
GET    /api/vendors/search
POST   /api/vendors
```

### Reportes (3)
```
GET    /api/trackingCards
GET    /api/dead-inventory
GET    /api/bomView/debug
```

---

## 🎯 PUNTOS CLAVE DEL SISTEMA

### Características Principales
✅ Gestión completa de compras  
✅ Control de inventario con QR  
✅ Carga de BOM desde Excel  
✅ Autenticación dual (QR + Credenciales)  
✅ Reportes y análisis  
✅ Manejo especial de proyectos inactivos  
✅ Autocompletado dual (Tipo/Marca)  
✅ Control de sesión por inactividad  

### Características Técnicas
🔒 Sistema de roles y permisos  
🔒 Validación en frontend y backend  
🔒 Transaccionalidad en operaciones críticas  
🔒 Sanitización de inputs (especialmente PID)  
📊 Paginación en listados  
📊 Índices optimizados en BD  
📊 Caché de datos en frontend  

---

## 📋 MATRIZ DE DOCUMENTOS

| Documento | Audiencia | Nivel | Técnico | Negocio | Visual |
|-----------|-----------|-------|---------|---------|--------|
| COMPONENTES_ARQUITECTURA.md | Todos | Alto | ✓✓✓ | ✓ | ✓✓ |
| COMPONENTES_TECNICO_DETALLADO.md | Dev | Muy Alto | ✓✓✓✓ | - | ✓ |
| CASOS_DE_USO_Y_FLUJOS.md | PM/Usuarios | Medio | ✓✓ | ✓✓✓ | ✓✓✓ |
| RESUMEN_EJECUTIVO.md | Ejecutivos | Bajo | ✓✓ | ✓✓ | ✓✓✓✓ |

---

## 🔄 FLUJOS PRINCIPALES DEL SISTEMA

### Flujo 1: ENTRADA DE MERCANCÍA
1. Technician escanea QR
2. Sistema detecta si proyecto está inactivo
3. Si inactivo: solicita rack específico
4. User confirma cantidad
5. Backend registra movimiento
6. Stock actualizado, BOM marcado Delivered

**Documentación:** CASOS_DE_USO_Y_FLUJOS.md → UC-002

---

### Flujo 2: CREAR COMPRA
1. Manager selecciona proyecto
2. Sistema carga tipos y marcas disponibles
3. Manager selecciona Type o Brand
4. Sistema calcula productos del BOM
5. Manager completa tabla con vendedor, cantidad, precio
6. Submit registra todas las líneas

**Documentación:** CASOS_DE_USO_Y_FLUJOS.md → UC-003

---

### Flujo 3: AUTENTICACIÓN
1. User elige QR o credenciales
2. Sistema valida contra BD
3. Si válido: establece sesión
4. Inicia monitor de inactividad

**Documentación:** CASOS_DE_USO_Y_FLUJOS.md → UC-001

---

## 🛠️ CONFIGURACIÓN Y CREDENCIALES

### Base de Datos PostgreSQL
```
Host: localhost
Puerto: 5432
Base de datos: bd_purchase_system
Usuario: postgres
Contraseña: 150403kim
```

### Servidor Express
```
Puerto: 3000
URL API Base: http://localhost:3000/api
Archivos estáticos: /
CORS: Habilitado
```

---

## 📌 CAMBIOS RECIENTES DOCUMENTADOS

### Versión del 16 de Marzo 2026
- ✨ Manejo especial de proyectos inactivos
- ✨ Modal para selección de rack
- ✨ Actualización de BOM status a 'Delivered'

### Versión del 22 de Marzo 2026
- 🐛 Fix: Cantidad grande en movimientos
- 🐛 Fix: Una llamada con cantidad total, no loop

### Versión del 24 de Abril 2026 (recordPurchase v2)
- ✨ Eliminación múltiple de items
- ✨ Autocompletado dual Type/Brand
- ✨ Vendor autocomplete mejorado

---

## 🔐 MATRIZ DE ROLES Y PERMISOS

### ADMIN
- Acceso completo
- Crear usuarios
- Cargar BOM
- Administrar sistema

### MANAGER
- Crear compras
- Ver BOM
- Cambiar estado
- Ver reportes

### TECHNICIAN
- Registrar movimientos
- Escanear QR
- Ver stock
- Sesión limitada (30 min)

### VIEWER
- Consultar inventario
- Ver reportes
- Solo lectura

---

## 📚 REFERENCIAS RÁPIDAS

### Para Ejecutar
```bash
# Servidor
node purchase.js

# Base de datos
psql -U postgres -h localhost -d bd_purchase_system
```

### URLs Principales
```
Login:              http://localhost:3000/index.html
Dashboard:          http://localhost:3000/
API:                http://localhost:3000/api/*
Stock:              http://localhost:3000/stock.html
Compras:            http://localhost:3000/recordPurchase.html
Reportes:           http://localhost:3000/reports.html
```

### Endpoints de Debug
```
Verificar BD:       /api/db-check
Debug BOM:          /api/bomView/debug
Ver tablas:         /api/db-check (retorna lista)
```

---

## 💡 TIPS PARA USAR EL MANUAL

1. **Lectura rápida:** Comienza con RESUMEN_EJECUTIVO.md
2. **Entendimiento técnico:** Lee COMPONENTES_ARQUITECTURA.md
3. **Implementación:** Consulta COMPONENTES_TECNICO_DETALLADO.md
4. **Testing:** Usa CASOS_DE_USO_Y_FLUJOS.md
5. **Capacitación:** Comparte CASOS_DE_USO_Y_FLUJOS.md

---

## 📞 SOPORTE Y REFERENCIAS

### Documentos Disponibles
```
📄 COMPONENTES_ARQUITECTURA.md
📄 COMPONENTES_TECNICO_DETALLADO.md
📄 CASOS_DE_USO_Y_FLUJOS.md
📄 RESUMEN_EJECUTIVO.md
📄 INDICE_MANUAL_TECNICO.md (este archivo)
```

### Todos en
```
📁 C:\Users\admin\Documents\K\ProyectoResidencias\
```

---

## ✅ CHECKLIST DE DOCUMENTACIÓN

- [x] Diagrama de arquitectura
- [x] Listado de todos los endpoints (70+)
- [x] Documentación de funciones backend
- [x] Documentación de archivos frontend
- [x] Casos de uso con flujos
- [x] Diagramas de flujo ASCII
- [x] Procesos por rol
- [x] Matriz de permisos
- [x] Estructuras de datos
- [x] Stack tecnológico
- [x] Configuración de BD
- [x] Cambios recientes

---

## 🎓 PRÓXIMOS PASOS

1. **Lectura completa:** Revisa todos los documentos en orden
2. **Familiarización:** Prueba los endpoints usando Postman
3. **Desarrollo:** Usa documentación técnica para nuevas features
4. **Testing:** Crea casos de test basados en UC
5. **Capacitación:** Usa CASOS_DE_USO para entrenar usuarios

---

## 📊 ESTADÍSTICAS DEL MANUAL

- **Total de documentos:** 5
- **Total de páginas (estimado):** 40+
- **Endpoints documentados:** 70+
- **Casos de uso detallados:** 6
- **Diagramas incluidos:** 10+
- **Tablas de referencia:** 25+

---

**Manual Técnico Versión: 1.0**  
**Fecha de creación:** 26 de Abril de 2026  
**Estado:** Completo y Actualizado  

---

### Última Nota

Este manual técnico es **completo y listo para documentación formal**. Incluye:

✅ Todos los componentes del sistema  
✅ Especificación técnica de API  
✅ Casos de uso con flujos  
✅ Diagramas de arquitectura  
✅ Guía para diferentes roles  
✅ Referencias rápidas  

**Puedes usarlo como documentación oficial para:**
- Presentaciones ejecutivas
- Documentación de proyectos
- Capacitación de nuevos desarrolladores
- Consultoría técnica
- Bases de requisitos para nuevas features

---

