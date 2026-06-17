# CASOS DE USO Y DIAGRAMAS - Sistema de Gestión de Compras

**Documento de Procesos de Negocio**
**Proyecto:** Sistema de Gestión de Compras y Inventario
**Fecha:** 26 de Abril de 2026

---

## 📋 TABLA DE CONTENIDOS

1. [Actores del Sistema](#actores-del-sistema)
2. [Casos de Uso Principales](#casos-de-uso-principales)
3. [Diagramas de Flujo](#diagramas-de-flujo)
4. [Procesos por Rol](#procesos-por-rol)

---

## 👥 Actores del Sistema

### Tipos de Usuarios

| Actor | Descripción | Roles Típicos | Permisos |
|-------|-------------|-----------------|-----------|
| **Admin** | Administrador del sistema | Administrator | Acceso total, crear usuarios, gestionar BD |
| **Manager** | Manager del departamento | Manager | Ver reportes y status |
| **Technician** | Técnicos del departamento | Technician | Registrar movimientos, escanear QR, sesión limitada |
| **Viewer** | Usuario de solo lectura | Viewer | Consultar inventario y reportes, sin edición |

---

## 🎯 Casos de Uso Principales

### 1. Caso de Uso: AUTENTICACIÓN EN EL SISTEMA

**ID:** UC-001  
**Actores:** Cualquier usuario  
**Precondiciones:** Usuario registrado en BD

```
Flujo Principal:
  1. Usuario accede al login (index.html)
  2. Sistema presenta dos opciones: QR o Credenciales
  3. Usuario selecciona opción:
     a) QR: Escanea su código QR
     b) Credenciales: Ingresa usuario y contraseña
  4. Sistema valida contra BD
  5. Si válido: Establece sesión, redirige a dashboard
  6. Si inválido: Muestra error, pide reintentar
  7. Sistema inicia monitor de inactividad

Postcondiciónes:
  - Usuario autenticado y en dashboard
  - Sesión activa en sessionStorage
  - Timer de inactividad iniciado

Excepciones:
  - Usuario no existe → Error 401
  - Contraseña incorrecta → Error 401
  - QR inválido → Error 401
  - Sesión expirada → Redirige a login
```

---

### 2. Caso de Uso: REGISTRAR ENTRADA DE MERCANCÍA (INBOUND)

**ID:** UC-002  
**Actor:** Technician, Manager  
**Precondiciones:** Usuario autenticado, producto existe en BD

```
Flujo Principal:
  1. Technician abre io.html (Entrada/Salida)
  2. Escanea código QR del producto
  3. Sistema obtiene datos del producto:
     - Número de parte (no_part)
     - Descripción
     - Proyecto asociado
     - Stock actual
  4. Sistema verifica: ¿Proyecto está inactivo?
     NO → Continúa al paso 6
     SÍ → Ve al flujo alternativo (paso 5A)
  5. Technician escanea/ingresa cantidad
  6. Technician confirma entrada
  7. Sistema registra movimiento:
     - Actualiza stock disponible
     - Crea entrada en tabla movements
     - Actualiza BOM status
  8. Sistema muestra confirmación con timestamp

Flujo Alternativo 5A (Proyecto Inactivo):
  5A.1. Sistema muestra modal: "Seleccione estante (Rack)"
  5A.2. Technician selecciona rack de lista
  5A.3. Sistema memoriza selección para futuras entradas
  5A.4. Continúa con registro pero:
        - Cambia project a 'AUT-STOCK'
        - Marca BOM como 'Delivered'

Postcondiciones:
  - Stock actualizado
  - Movimiento registrado en historial
  - BOM actualizado si aplica

Excepciones:
  - Código QR no encontrado → Error, pedir reescanear
  - Stock insuficiente (para outbound) → Error
  - Proyecto no válido → Error
```

---

### 3. Caso de Uso: CREAR ORDEN DE COMPRA

**ID:** UC-003  
**Actor:** Manager  
**Precondiciones:** Usuario autenticado, existe proyecto, existe BOM

```
Flujo Principal:
  1. Manager abre recordPurchase.html
  2. Selecciona PROYECTO del dropdown
  3. Sistema carga tipos y marcas del BOM del proyecto
  4. Manager busca y selecciona TYPE o BRAND:
     - Campo autocompletado dual
     - Muestra TIPOS en sección 1
     - Muestra MARCAS en sección 2
  5. Sistema obtiene productos que coinciden (BOM calculation)
  6. Manager selecciona VENDOR (proveedor):
     - Input autocompleted de tabla vendor
     - Sistema guarda id_vendor en hidden field
  7. Manager selecciona NETWORK (red)
  8. Manager completa tabla:
     - Puede agregar múltiples líneas
     - Cada línea: cantidad, precio, fecha
     - Sistema calcula subtotales dinámicamente
  9. (Opcional) Manager puede:
     - Eliminar ítems individuales
     - Seleccionar todos ("Select All")
     - Eliminar múltiples ("Delete Selected")
  10. Manager presiona SUBMIT
  11. Sistema envía POST /api/purchases con todas las líneas
  12. Backend crea registros y actualiza BOM
  13. Sistema muestra confirmación

Postcondiciones:
  - Compra registrada con status 'pending'
  - BOM actualizado con referencia a compra
  - Totales en red actualizados
  - Formulario limpiado para nueva entrada

Excepciones:
  - Proyecto no tiene BOM → Mensaje error
  - Vendor no existe → Error autocomplete
  - Cantidad negativa → Validación
  - Red sin saldo → Advertencia
```

---

### 4. Caso de Uso: CONSULTAR INVENTARIO

**ID:** UC-004  
**Actor:** Cualquier usuario  
**Precondiciones:** Usuario autenticado

```
Flujo Principal:
  1. Usuario abre stock.html
  2. Sistema carga inventario completo
  3. Usuario puede filtrar por:
     - Almacén (warehouse)
     - Estante (rack)
     - Proyecto (no_project)
     - Parte (no_part)
  4. Sistema muestra tabla con:
     - Código QR
     - Número de parte
     - Descripción
     - Warehouse
     - Rack
     - Cantidad disponible
     - Proyecto asignado
  5. Usuario puede:
     - Buscar por término
     - Ordenar por columna
     - Ver detalles (clic en fila)
  6. Para cada item, muestra:
     - Disponibilidad por project
     - Historial de movimientos
     - Últimas transacciones

Postcondiciones:
  - Usuario tiene visibilidad de inventario
  - Puede identificar disponibilidad

Excepciones:
  - Búsqueda sin resultados → Mensaje vacío
  - Error al cargar datos → Mensaje error
```

---

### 5. Caso de Uso: GENERAR REPORTE DE COMPRAS PENDIENTES

**ID:** UC-005  
**Actor:** Manager, Admin  
**Precondiciones:** Existen compras registradas

```
Flujo Principal:
  1. Usuario abre reports.html
  2. Selecciona tipo de reporte: "Pending Purchases"
  3. Sistema obtiene todas las compras con status 'pending'
  4. Sistema calcula KPIs:
     - Total de compras
     - Compras pendientes vs citadas
     - % de pendientes
     - Proyectos con compras pendientes
  5. Sistema genera gráficos:
     - Gráfico de pastel: Distribución de estados
     - Gráfico de barras: Por proyecto
  6. Muestra tabla detallada:
     - Proyecto
     - Parte
     - Cantidad
     - Vendor
     - Fecha de compra
     - Status
  7. Usuario puede:
     - Filtrar por proyecto, parte, vendor
     - Buscar por descripción, QIS
     - Filtrar por cantidad
     - Exportar/Imprimir
  8. Aplica tema seleccionado (claro/oscuro)

Postcondiciones:
  - Reporte generado y visible
  - Usuarios pueden tomar decisiones basadas en datos

Excepciones:
  - No hay compras pendientes → Mensaje vacío
  - Error en gráficos → Muestra tabla sin gráficos
```

---

### 6. Caso de Uso: CARGAR BILL OF MATERIALS (BOM)

**ID:** UC-006  
**Actor:** Admin, Manager  
**Precondiciones:** Archivo Excel con estructura correcta

```
Flujo Principal:
  1. Usuario abre bom.html
  2. Sistema carga lista de proyectos existentes
  3. Usuario escribe o selecciona NO_PROJECT
  4. Sistema autocompeta nombre del proyecto
  5. Usuario selecciona archivo Excel
  6. Sistema valida estructura del archivo:
     - Columnas requeridas presentes
     - Datos válidos
  7. Usuario confirma upload
  8. Sistema procesa archivo:
     - Lee cada fila
     - Crea registros en bom_project
     - Genera códigos QR
     - Crea stock inicial
  9. Sistema muestra resultado:
     - Registros importados
     - Errores (si los hay)
     - Avisos

Postcondiciones:
  - BOM cargado en BD
  - Stock inicializado
  - Códigos QR generados

Excepciones:
  - Archivo inválido → Error
  - Proyecto no existe → Error o crear nuevo
  - Datos incompletos → Error con línea específica
  - Proyecto ya tiene BOM → Advertencia (¿sobrescribir?)
```

---

## 🔄 Diagramas de Flujo

### Flujo 1: INBOUND (Entrada de Mercancía) - Versión Completa

```
┌─────────────────────────────────────────────────────────────────┐
│                  INICIO: Technician en io.html                  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                ┌────────▼────────┐
                │  Escanea QR     │
                │  del producto   │
                └────────┬────────┘
                         │
                ┌────────▼──────────────────────────────┐
                │ GET /api/stock/available/:qr_code    │
                └────────┬──────────────────────────────┘
                         │
              ┌──────────▼──────────────┐
              │ ¿Producto existe?       │
              └──┬─────────────────┬────┘
              NO│                 │SÍ
    ┌──────────▼──┐         ┌────▼──────────────┐
    │  Error:     │         │ Carga datos del  │
    │ Reescanear  │         │ producto en UI   │
    └─────────────┘         └────┬─────────────┘
                                 │
                    ┌────────────▼──────────────┐
                    │ GET /api/projects/check  │
                    │ ¿Proyecto inactivo?      │
                    └──┬─────────────────┬─────┘
                    NO│                 │SÍ
            ┌─────────▼─┐    ┌──────────▼───────────┐
            │ Continúa  │    │ Muestra MODAL        │
            │ registro  │    │ "Select Rack"        │
            └─────────┬─┘    │                      │
                      │      │ User selecciona rack │
                      │      │ Guardar en map       │
                      │      └──────────┬───────────┘
                      │                 │
            ┌─────────▼─────────────────▼─────┐
            │ User ingresa/escanea cantidad   │
            └─────────┬─────────────────────────┘
                      │
            ┌─────────▼──────────────┐
            │ User confirma entrada  │
            └─────────┬──────────────┘
                      │
            ┌─────────▼──────────────────────────┐
            │ POST /api/inbound O                │
            │ /api/inbound-with-rack             │
            └─────────┬──────────────────────────┘
                      │
        ┌─────────────▼─────────────────┐
        │ BACKEND PROCESA:              │
        │ 1. Valida producto            │
        │ 2. Actualiza stock            │
        │ 3. Registra movimiento        │
        │ 4. Si inactivo:               │
        │    - Cambia project='AUT'     │
        │    - BOM status='Delivered'   │
        └─────────┬─────────────────────┘
                  │
        ┌─────────▼────────────────┐
        │ Retorna confirmación     │
        └─────────┬────────────────┘
                  │
        ┌─────────▼──────────────────┐
        │ UI muestra confirmación:   │
        │ ✓ Item registrado         │
        │ ✓ Timestamp               │
        │ ✓ Nuevo stock             │
        └─────────┬──────────────────┘
                  │
        ┌─────────▼──────────┐
        │  FIN: Exitoso      │
        └────────────────────┘
```

---

### Flujo 2: CREAR COMPRA (Purchase) - Versión Simplificada

```
┌──────────────────────────────────────┐
│ START: recordPurchase.html           │
└────────────┬─────────────────────────┘
             │
   ┌─────────▼──────────┐
   │ Selecciona PROYECTO│
   └─────────┬──────────┘
             │
   ┌─────────▼──────────────────────────┐
   │ GET /api/products/types-by-project │
   │ Carga Tipos y Marcas (autocompletado
   │ dual)
   └─────────┬──────────────────────────┘
             │
   ┌─────────▼──────────────────────────┐
   │ User busca y selecciona:            │
   │ TYPE O BRAND (en autocompletado)   │
   └─────────┬──────────────────────────┘
             │
   ┌─────────▼──────────────────────────┐
   │ GET /api/products/bom-calculation  │
   │ Retorna productos que coinciden    │
   └─────────┬──────────────────────────┘
             │
   ┌─────────▼──────────────────────────┐
   │ Selecciona VENDOR (autocomplete)   │
   └─────────┬──────────────────────────┘
             │
   ┌─────────▼──────────────────────────┐
   │ Selecciona NETWORK                 │
   └─────────┬──────────────────────────┘
             │
   ┌─────────▼──────────────────────────┐
   │ Completa tabla:                    │
   │ - Cantidad                         │
   │ - Precio unitario                  │
   │ - Fecha                            │
   │ (Puede agregar múltiples líneas)   │
   └─────────┬──────────────────────────┘
             │
   ┌─────────▼──────────────────────────┐
   │ (Opcional) Agregar/Eliminar items  │
   │ - Checkboxes para seleccionar      │
   │ - "Delete Selected Items"          │
   └─────────┬──────────────────────────┘
             │
   ┌─────────▼──────────────────────────┐
   │ Presiona SUBMIT                    │
   └─────────┬──────────────────────────┘
             │
   ┌─────────▼──────────────────────────┐
   │ POST /api/purchases                │
   │ (Envía todas las líneas)           │
   └─────────┬──────────────────────────┘
             │
   ┌─────────▼──────────────────────────┐
   │ Backend:                           │
   │ - Valida cada línea                │
   │ - Crea registros en BD             │
   │ - Actualiza BOM                    │
   │ - Calcula totales                  │
   └─────────┬──────────────────────────┘
             │
   ┌─────────▼──────────────────────────┐
   │ Retorna confirmación               │
   └─────────┬──────────────────────────┘
             │
   ┌─────────▼──────────────────────────┐
   │ UI muestra:                        │
   │ ✓ Compra registrada                │
   │ ✓ ID de compra                     │
   │ ✓ Limpiar formulario               │
   └─────────┬──────────────────────────┘
             │
   ┌─────────▼──────────┐
   │ END: Exitoso       │
   └────────────────────┘
```

---

## 📊 Procesos por Rol

### ROL: TECHNICIAN (Técnico de Almacén)

**Permisos:**
- ✓ Registrar INBOUND
- ✓ Registrar OUTBOUND
- ✓ Consultar stock
- ✓ Ver movimientos propios
- ✗ Crear compras
- ✗ Modificar BOM
- ✗ Administrar usuarios

**Procesos principales:**
```
1. Inicio de turno
   └─ Login con QR
   └─ Sistema inicia sesión con expiración

2. Registrar entradas (io.html)
   └─ Escanea QR
   └─ Ingresa cantidad
   └─ Confirma rack (si aplica)
   └─ Sistema registra automáticamente

3. Registrar salidas
   └─ Misma interfaz que entradas
   └─ Sistema valida disponibilidad
   └─ Registra movimiento

4. Ver inventario (stock.html)
   └─ Consulta por almacén/estante
   └─ Busca productos
   └─ Ve disponibilidad actual

5. Fin de turno
   └─ Logout manual O automático (30 min inactividad)
```

---

### ROL: MANAGER (Gerente de Compras)

**Permisos:**
- ✓ Crear compras
- ✓ Ver BOM
- ✓ Consultar inventario
- ✓ Ver reportes
- ✓ Cambiar estado de compras
- ✗ Administrar usuarios
- ✗ Acceso a BD

**Procesos principales:**
```
1. Análisis de inventario
   └─ Abre stock.html
   └─ Revisa disponibilidad por proyecto
   └─ Identifica necesidades

2. Revisión de BOM
   └─ Abre bomView.html
   └─ Revisa partes requeridas
   └─ Verifica estado de compras

3. Crear órdenes de compra
   └─ Abre recordPurchase.html
   └─ Selecciona proyecto
   └─ Completa detalles
   └─ Registra compra

4. Seguimiento de compras
   └─ Abre purchaseTracking.html
   └─ Busca por estado
   └─ Actualiza estados si recibe confirmación

5. Reportes
   └─ Abre reports.html
   └─ Revisa compras pendientes
   └─ Revisa inventario muerto
   └─ Toma decisiones basadas en datos
```

---

### ROL: ADMIN (Administrador)

**Permisos:**
- ✓ Acceso completo
- ✓ Crear/eliminar usuarios
- ✓ Cargar BOM
- ✓ Modificar configuración
- ✓ Ver logs de sistema
- ✓ Gestionar BD

**Procesos principales:**
```
1. Gestión de usuarios
   └─ Crear nuevos usuarios (QR + credenciales)
   └─ Asignar roles
   └─ Modificar permisos
   └─ Desactivar usuarios

2. Carga inicial de datos
   └─ Cargar BOM desde Excel (bom.html)
   └─ Crear proyectos
   └─ Configurar redes/proveedores
   └─ Inicializar stock

3. Mantenimiento
   └─ Verificar integridad BD (/api/db-check)
   └─ Limpiar datos obsoletos
   └─ Hacer backups

4. Monitoreo
   └─ Ver movimientos del sistema
   └─ Auditar cambios críticos
   └─ Resolver errores
```

---

### ROL: VIEWER (Usuario de Lectura)

**Permisos:**
- ✓ Consultar inventario
- ✓ Ver reportes
- ✗ Crear compras
- ✗ Registrar movimientos
- ✗ Modificar datos
- ✗ Acceso administrativo

**Procesos principales:**
```
1. Consulta de inventario
   └─ stock.html (view only)
   └─ Búsqueda y filtrado
   └─ Ver disponibilidad

2. Consulta de compras
   └─ purchaseTracking.html
   └─ Ver estado de órdenes
   └─ Ver historial

3. Reportes
   └─ reports.html (view only)
   └─ Ver análisis
   └─ Exportar (si permitido)
```

---

## 🔐 Matriz de Permisos por Endpoint

```
Endpoint                    Technician  Manager  Admin  Viewer
─────────────────────────────────────────────────────────────
/api/auth/*                    ✓        ✓       ✓      ✓
/api/users/*                   ✗        ✗       ✓      ✗
/api/products/*                ✓        ✓       ✓      ✓
/api/stock/*                   ✓        ✓       ✓      ✓
/api/inbound*                  ✓        ✗       ✓      ✗
/api/outbound                  ✓        ✗       ✓      ✗
/api/movements/*               ✓        ✓       ✓      ✓
/api/purchases                 ✗        ✓       ✓      ✓
/api/purchases/status          ✗        ✓       ✓      ✗
/api/projects/*                ✗        ✓       ✓      ✓
/api/bom/*                     ✗        ✓       ✓      ✓
/api/requisitions/*            ✗        ✓       ✓      ✗
/api/vendors/*                 ✗        ✓       ✓      ✓
/api/networks/*                ✗        ✓       ✓      ✗
/api/reports/*                 ✗        ✓       ✓      ✓
/api/dead-inventory            ✗        ✓       ✓      ✓
```

---

## 🎯 Secuencias Críticas

### Secuencia 1: Proyecto Inactivo Detection & Handling

```
User (Technician)
    │
    ├─ Escanea QR de producto
    │
    ├─ GET /api/stock/available/:qr
    │  └─ Obtiene: product data + project
    │
    ├─ GET /api/projects/check/:no_project
    │  └─ Respuesta: { is_inactive: true }
    │
    ├─ [BRANCH] Proyecto está inactivo
    │
    ├─ UI muestra MODAL: "Select Rack for inactive project"
    │  └─ Dropdown con racks disponibles
    │
    ├─ User selecciona rack
    │  └─ Guardar en: inactiveProjectRackMap[`${project}:${part}`]
    │
    ├─ User confirma cantidad
    │
    ├─ POST /api/inbound-with-rack
    │  ├─ Body: { qr, quantity, rack, project, part, pid }
    │
    └─ BACKEND SPECIAL HANDLING:
       ├─ UPDATE stock SET no_project = 'AUT-STOCK'
       ├─ INSERT movements (type='INBOUND', ...)
       ├─ UPDATE bom_project SET status = 'Delivered'
       └─ COMMIT TRANSACTION

Result:
    - Stock ahora bajo 'AUT-STOCK'
    - BOM marcado como entregado
    - Movimiento registrado
    - Futuras entradas del mismo proyecto:part
      ├─ No vuelve a preguntar por rack
      └─ Usa valor en mapa
```

---

## 📌 Cambios de Estado (State Transitions)

### Proyecto

```
         ┌─────────────┐
         │   CREATED   │
         └──────┬──────┘
                │
       ┌────────▼────────┐
       │    ACTIVE       │
       └────────┬────────┘
                │
       ┌────────▼────────┐
       │   INACTIVE      │
       └────────┬────────┘
                │
       ┌────────▼────────┐
       │   COMPLETED     │
       └─────────────────┘
```

---

### Compra (Purchase)

```
    ┌──────────────┐
    │   PENDING    │◄─── Inicial
    └──────┬───────┘
           │
    ┌──────▼──────┐
    │   QUOTED    │◄─── Proveedor envía cotización
    └──────┬──────┘
           │
    ┌──────▼─────────┐
    │   APPROVED     │◄─── Manager aprueba
    └──────┬─────────┘
           │
    ┌──────▼──────┐
    │  RECEIVED   │◄─── Mercancía recibida
    └──────┬──────┘
           │
    ┌──────▼─────────┐
    │   CANCELLED    │◄─── (Alternativa en cualquier estado)
    └────────────────┘
```

---

### BOM Project

```
    ┌─────────────┐
    │   PENDING   │◄─── Inicial (creado desde Excel)
    └──────┬──────┘
           │
    ┌──────▼─────────┐
    │   DELIVERED    │◄─── INBOUND registrado
    └────────────────┘
           
    ┌─────────────┐
    │  CANCELLED  │◄─── (Alternativa)
    └─────────────┘
```

---

## 📊 Vista de Datos Relacionados

### Por Proyecto

```
PROJECT
  │
  ├─ COMPRAS (purchases)
  │  ├─ Fecha
  │  ├─ Vendor
  │  ├─ Status (pending, quoted, received, etc.)
  │  └─ Líneas (parts, quantities, prices)
  │
  ├─ BOM (bom_project)
  │  ├─ Partes (no_part)
  │  ├─ Cantidades requeridas
  │  ├─ Status (pending, delivered)
  │  └─ QR codes
  │
  ├─ STOCK (stock)
  │  ├─ Almacén/Rack
  │  ├─ Cantidad disponible
  │  ├─ Partes (no_part)
  │  └─ Última actualización
  │
  └─ MOVIMIENTOS (movements)
     ├─ INBOUND (entradas)
     ├─ OUTBOUND (salidas)
     ├─ Historial completo
     └─ Auditoría
```

---

## 🔄 Casos Especiales

### Caso: Reingreso de Parte Inactiva con Rack Distinto

```
Escenario:
  - Primera entrada: Proyecto XYZ (inactivo), Part ABC → Rack A12
  - Sistema mapea: "XYZ:ABC" → "A12"
  - Segunda entrada: Mismo proyecto y parte
  
Comportamiento:
  1. Sistema detecta entrada previa en mapa
  2. No muestra modal
  3. Usa rack A12 automáticamente
  4. Registra movimiento sin interrupciones
```

### Caso: Cantidad Grande (74 unidades)

```
Escenario:
  - User ingresa cantidad: 74
  
Problema anterior (v1):
  - Sistema llamaba registerMovement(1) 74 veces
  - Resultaba en 74 requests a /api/inbound
  - BOM update usaba estado incorrecto

Solución actual (v2):
  - Frontend pasa cantidad total: 74
  - POST /api/inbound { quantity: 74 }
  - Backend incrementa stock de una vez
  - BOM update usa cantidad correcta
```

---

**Documento Completado: 26/04/2026**  
**Versión: 1.0**

