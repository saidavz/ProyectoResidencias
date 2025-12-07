// server.js
import express from 'express';
import pg from 'pg';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import xlsx from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
app.use(cors());
app.use(express.json());
app.use(express.static('.'));
const upload = multer({ dest: "uploads/" });

const pool = new pg.Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'bd_purchase_system',//verifica bien al cambiarlo
  password: 'postgresql',
  port: 5432,
});
//probando que si funciona conla otra cuneta
// RUTAS DEL SERVIRDOR 1 (purchase.js) 

app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT no_part, description FROM product ORDER BY no_part');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Error al cargar productos' });
  }
});

app.get('/api/products/search', async (req, res) => {
  const term = req.query.term || '';
  try {
    const result = await pool.query(
      `SELECT no_part, description 
       FROM product 
       WHERE no_part ILIKE $1 OR description ILIKE $2
       ORDER BY no_part 
       LIMIT 10`,
      [`%${term}%`, `%${term}%`]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error searching products:', err);
    res.status(500).json({ error: 'Error al buscar productos' });
  }
});

//OBTENER PRODUCTOS CON CÁLCULO BOM
app.get("/api/products/bom-calculation", async (req, res) => {
  try {
    const { no_project, type_p } = req.query;

    if (!no_project || !type_p) {
      return res.status(400).json({ 
        message: "Debe proporcionar no_project y type_p" 
      });
    }

    // 1. Buscar en BOM por proyecto
    const bomResult = await pool.query(
      `SELECT no_part, quantity_project 
       FROM bom_project 
       WHERE no_project = $1`,
      [no_project]
    );

    if (bomResult.rows.length === 0) {
      return res.json([]); // No hay datos en BOM para este proyecto
    }

    const bomItems = bomResult.rows;
    const bomNoParts = bomItems.map(item => item.no_part);

    // 2. Buscar productos que coincidan con type_p Y estén en BOM
    const productResult = await pool.query(
      `SELECT no_part, brand, description, quantity, unit, type_p 
       FROM product 
       WHERE type_p = $1 
         AND no_part = ANY($2::text[])`,
      [type_p, bomNoParts]
    );

    // 3. Calcular Quantity = quantity_project / quantity
    const productosCalculados = productResult.rows.map(product => {
      const bomItem = bomItems.find(b => b.no_part === product.no_part);
      if (!bomItem) return null;

      return {
        ...product,
        quantity_project: bomItem.quantity_project,
        quantity_calculated: bomItem.quantity_project / product.quantity
      };
    }).filter(item => item !== null);

    res.json(productosCalculados);

  } catch (error) {
    console.error("Error en cálculo BOM:", error);
    res.status(500).send("Error en el servidor");
  }
});

//OBTENER PRODUCTOS POR TYPE_P (MANTENGO POR COMPATIBILIDAD)
app.get("/api/products/byType", async (req, res) => {
  try {
    const { type_p } = req.query;

    if (!type_p) {
      return res.status(400).json({ message: "Debe proporcionar type_p" });
    }

    const result = await pool.query(
      `SELECT no_part, brand, description, quantity, unit, type_p 
       FROM product 
       WHERE type_p = $1
       ORDER BY no_part`,
      [type_p]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener productos por type_p:", error);
    res.status(500).send("Error en el servidor");
  }
});


// Búsqueda de proyectos 
app.get('/api/projects/search', async (req, res) => {
  const term = req.query.term || '';
  try {
    const result = await pool.query(
      `SELECT no_project, name_project 
       FROM project 
       WHERE (no_project::text ILIKE $1 OR name_project ILIKE $2)
         AND name_project NOT ILIKE '%Sin asignar%'
       ORDER BY name_project 
       LIMIT 10`,
      [`%${term}%`, `%${term}%`]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error searching projects:', err);
    res.status(500).json({ error: 'Error al buscar proyectos' });
  }
});

// Búsqueda de tipos de productos 
app.get('/api/products/types', async (req, res) => {
  const term = req.query.term || '';
  try {
    const result = await pool.query(
      `SELECT DISTINCT type_p 
       FROM product 
       WHERE type_p IS NOT NULL 
         AND type_p != ''
         AND type_p ILIKE $1
       ORDER BY type_p 
       LIMIT 10`,
      [`%${term}%`]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error searching product types:', err);
    res.status(500).json({ error: 'Error al buscar tipos de producto' });
  }
});

app.get('/api/vendors', async (req, res) => {
  try {
    const result = await pool.query('SELECT id_vendor, name_vendor FROM vendor ORDER BY name_vendor');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching vendors:', error);
    res.status(500).json({ error: 'Error al cargar proveedores' });
  }
});

app.get('/api/projects/all', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT no_project, name_project
      FROM project
      WHERE name_project NOT ILIKE '%Sin asignar%'
      ORDER BY name_project`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Error al cargar proyectos' });
  }
});

app.get('/api/networks', async (req, res) => {
  try {
    const result = await pool.query('SELECT network, balance FROM network ORDER BY network');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching networks:', error);
    res.status(500).json({ error: 'Error al cargar networks' });
  }
});

app.get('/api/purchases', async (req, res) => {
  try {
    const { projectId } = req.query;

    let query = 
      `SELECT 
        pr.name_project as project_name,
        p.no_part,
        p.description as description,
        v.name_vendor as vendor_name,
        pd.quantity,
        pd.price_unit,
        (pd.quantity * pd.price_unit) as total_amount,
        pd.status,
        pu.time_delivered
      FROM purchase pu
      INNER JOIN purchase_detail pd ON pu.id_purchase = pd.id_purchase
      INNER JOIN project pr ON pu.no_project = pr.no_project
      INNER JOIN vendor v ON pu.id_vendor = v.id_vendor
      INNER JOIN product p ON pd.no_part = p.no_part`;

    const params = [];

    // Si hay projectId, agregar filtro
    if (projectId) {
      query +=  ` WHERE pr.no_project::text = $1`;
      params.push(String(projectId));
    }

    query +=  ` ORDER BY pu.id_purchase DESC`;

    console.log('Purchases query:', query, 'Params:', params);
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching purchases:', error);
    res.status(500).json({ error: 'Error al cargar las compras' });
  }
});

// RUTA MODIFICADA PARA MÚLTIPLES PRODUCTOS Y ACTUALIZAR BALANCE
app.post('/api/purchases', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Extraer datos de la compra (AGREGAR type_p)
    const { currency, id_vendor, no_project, time_delivered, status, network, po, pr, shopping, type_p, productos } = req.body;

    // Validar que hay productos
    if (!productos || !Array.isArray(productos) || productos.length === 0) {
      return res.status(400).json({ success: false, error: 'No products provided' });
    }

    // Calcular el total de la compra
    let totalCompra = 0;
    productos.forEach(producto => {
      totalCompra += producto.quantity * producto.price_unit;
    });

    // Verificar si hay suficiente balance en la network
    const balanceQuery = `SELECT balance FROM network WHERE network = $1`;
    const balanceResult = await client.query(balanceQuery, [network]);

    if (balanceResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'Network not found' });
    }

    const balanceActual = parseFloat(balanceResult.rows[0].balance);

    if (balanceActual < totalCompra) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: `Saldo insuficiente. Disponible: $${balanceActual.toFixed(2)}, Requerido: $${totalCompra.toFixed(2)}`
      });
    }

    // Insertar en la tabla purchase 
    const purchaseQuery = 
      `INSERT INTO purchase (currency, time_delivered, pr, shopping, po, no_project, id_vendor, network)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id_purchase`;
    const purchaseResult = await client.query(purchaseQuery, [
      currency, time_delivered, pr || null, shopping, po || null, no_project, id_vendor, network
    ]);
    const id_purchase = purchaseResult.rows[0].id_purchase;

    // Insertar cada producto en purchase_detail
    for (const producto of productos) {
      const { no_part, quantity, price_unit } = producto;

      const detailQuery = 
        `INSERT INTO purchase_detail (quantity, price_unit, status, id_purchase, no_part) 
        VALUES ($1, $2, $3, $4, $5)`;
      await client.query(detailQuery, [
        Number.isFinite(parseFloat(quantity)) ? parseFloat(quantity) : 0,
        parseFloat(price_unit),
        status,
        id_purchase,
        no_part
      ]);
    }

    // Actualizar el balance de la network
    const nuevoBalance = balanceActual - totalCompra;
    const updateBalanceQuery = 
      `UPDATE network SET balance = $1 WHERE network = $2`;
    await client.query(updateBalanceQuery, [nuevoBalance, network]);

    await client.query('COMMIT');
    res.json({
      success: true,
      message: `Purchase saved successfully with ${productos.length} products. Total: $${totalCompra.toFixed(2)}`,
      id_purchase: id_purchase,
      total_amount: totalCompra,
      new_balance: nuevoBalance
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error saving purchase:', error);
    res.status(500).json({ success: false, error: 'Error saving purchase: ' + error.message });
  } finally {
    client.release();
  }
});

// Ruta para obtener el balance de una network específica
app.get('/api/network/balance/:network', async (req, res) => {
  try {
    const { network } = req.params;
    const result = await pool.query('SELECT network, balance FROM network WHERE network = $1', [network]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Network not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching network balance:', error);
    res.status(500).json({ error: 'Error al cargar el balance de la network' });
  }
});

app.get("/api/stock", async (req, res) => {
  try {
    const query = 
      `SELECT
        s.id_stock,
        s.rack,
        s.date_entry,
        p.no_part,
        p.brand,
        p.description AS description,
        p.quantity AS product_quantity,
        p.unit,
        p.type_p,
        pd.price_unit,
        pd.quantity AS pd_quantity,
        (pd.price_unit * pd.quantity) AS subtotal,
        pd.status,
        n.network,
        n.balance,
        v.name_vendor,
        pr.name_project,
        pu.currency,
        pu.time_delivered,
        pu.pr,
        pu.shopping,
        pu.po,
        pd.quantity AS cantidad_entrada,
        COALESCE((SELECT SUM(o.quantity) FROM Output_inventory o WHERE o.id_stock = s.id_stock), 0) AS cantidad_salida,
        (p.quantity - COALESCE((SELECT SUM(o.quantity) FROM Output_inventory o WHERE o.id_stock = s.id_stock), 0)) AS cantidad_disponible
      FROM Stock s
      JOIN Product p ON s.no_part = p.no_part 
      JOIN Purchase_detail pd ON s.no_part = pd.no_part
      JOIN Purchase pu ON pd.id_purchase = pu.id_purchase
      JOIN Vendor v ON pu.id_vendor = v.id_vendor
      JOIN Project pr ON pu.no_project = pr.no_project
      JOIN Network n ON pu.network = n.network
      WHERE s.id_stock IS NOT NULL
      ORDER BY s.date_entry DESC`;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error("Error en consulta SQL:", error.message);
    res.status(500).json({ error: "Error fetching stock data", details: error.message });
  }
});

// RUTAS DEL SERVIRDOR 2 

// Funciones auxiliares para BOM
function normalizeHeader(h) {
  if (h === null || h === undefined) return "";
  try {
    let cleaned = String(h).replace(/[\uFEFF\u00A0]/g, "");
    return cleaned.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
  } catch (e) {
    console.error("Error normalizing headers:", h, e);
    return "";
  }
}

function toInt(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = parseInt(String(v).replace(/[, ]+/g, ""), 10);
  return Number.isNaN(n) ? null : n;
}

function pick(rowObj, names) {
  for (const n of names) {
    const key = normalizeHeader(n);
    if (key in rowObj && rowObj[key] !== null && rowObj[key] !== "") return rowObj[key];
  }
  function stripVowels(s) {
    return String(s).replace(/[aeiou]/g, "");
  }
  const normalizedTerms = names.map(n => stripVowels(normalizeHeader(n).replace(/_/g, "")));
  for (const k of Object.keys(rowObj)) {
    const kk = stripVowels(k.replace(/_/g, ""));
    for (const term of normalizedTerms) {
      if (!term) continue;
      if (kk.includes(term) || term.includes(kk)) {
        if (rowObj[k] !== null && rowObj[k] !== "") return rowObj[k];
      }
    }
  }
  return null;
}

// Ruta para BOM - obtener proyectos 
app.get("/api/projects/active", async (req, res) => {
  try {
    const result = await pool.query("SELECT no_project, name_project FROM Project WHERE status ILIKE 'active'");
    res.json(result.rows);
  } catch (err) {
    console.error("Error obtaining projects:", err);
    res.status(500).json({ message: "Error obtaining projects" });
  }
});
app.post('/api/projects', async (req, res) => {
  try {
    const { no_project, name_project, status } = req.body;

    const result = await pool.query(
      `INSERT INTO project (no_project, name_project, status)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [no_project, name_project, status || "active"]
    );

    res.json({
      success: true,
      project: result.rows[0]
    });

  } catch (error) {
    console.error("Error inserting project:", error);
    res.status(500).json({ error: "Error inserting project" });
  }
});


// Ruta para BOM - subir archivo Excel
app.post("/api/bom", upload.single("file"), async (req, res) => {
  const client = await pool.connect();
  try {
    const { no_project } = req.body;
    if (!no_project) return res.status(400).json({ message: "Select a project" });
    if (!req.file) return res.status(400).json({ message: "No file was uploaded" });

    const workbook = xlsx.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null });

    if (!rows || rows.length < 2) return res.status(400).json({ message: "The file contains no data or no header" });

    const rawHeaders = rows[0];
    const headers = rawHeaders.map(normalizeHeader);
    const data = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.every(cell => cell === null || cell === "")) continue;
      const obj = {};
      for (let c = 0; c < headers.length; c++) {
        const key = headers[c] || `col_${c}`;
        obj[key] = row[c] ?? null;
      }
      data.push(obj);
    }

    // Procesar cada fila
    for (const rowObj of data) {
      const no_part = pick(rowObj, ["no_parte", "numero_de_parte", "part_number"]);
      if (!no_part) continue;

      const brand = pick(rowObj, ["marca", "brand"]);
      const description = pick(rowObj, ["producto", "description", "descripcion"]);
      const quantity = toInt(pick(rowObj, ["cantidad_venta", "quantity", "qty"]));
      const unit = pick(rowObj, ["unidad", "unit"]);
      const type_p = pick(rowObj, ["tipo", "type"]);
      const quantity_p = toInt(pick(rowObj, ["cantidad_solicitada", "cantidad_proyecto"]));

      // Insertar producto si no existe
      await client.query(
        `INSERT INTO product (no_part, brand, description, quantity, unit, type_p)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (no_part) DO NOTHING`,
        [no_part, brand, description, quantity, unit, type_p]
      );

      // Insertar en bom_project
      if (quantity_p !== null) {
        await client.query(
          `INSERT INTO bom_project (no_project, quantity_project, no_part)
           VALUES ($1, $2, $3)`,
          [no_project, quantity_p, no_part]
        );
      }
    }

    res.json({ message: `File processed successfully for the project ${no_project}` });
  } catch (err) {
    console.error("ERROR:", err);
    res.status(500).json({ message: "Error processing file", error: String(err) });
  } finally {
    client.release();
  }
});

// Visualización de Materiales por Proyecto)
app.get('/api/bomView', async (req, res) => {
  const noProject = req.query.no_project;
  console.log('/api/bomView called with no_project=', noProject);

  try {
    let query = 
          `SELECT 
              pr.name_project,
              bp.quantity_project AS quantity_requested,
              p.type_p,
              p.no_part,
              p.description,
              p.brand,
              p.quantity ,
              p.unit 
          FROM bom_project bp
          JOIN product p ON bp.no_part = p.no_part
          JOIN project pr ON bp.no_project = pr.no_project`;

    const queryParams = [];

    if (noProject) {
      query +=  ` WHERE pr.no_project::text = $1`;
      queryParams.push(String(noProject));
    }

    query +=  ` ORDER BY pr.name_project, p.no_part`;

    const result = await pool.query(query, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching BOM data:', error);
    res.status(500).json({ error: 'Error al cargar los datos del BOM' });
  }
});

app.get('/stock.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'stock.html'));
});

app.get('/recordPurchase.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'recordPurchase.html'));
});

app.get('/purchaseTracking.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'purchaseTracking.html'));
});

app.get('/bom.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'bom.html'));
});

app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

//RUTA PARA PARA PURCHASE TRACKING

app.get('/api/trackingCards', async (req, res) => {
  try {
    const { projectId } = req.query;

    let sql;
    let params = [];

    if (projectId) {
      sql = 
        `WITH finance_data AS (
          SELECT 
            COALESCE(SUM(pd.quantity * pd.price_unit), 0) AS total_gastado,
            COALESCE((
              SELECT SUM(n.balance) FROM network n
              WHERE n.network IN (
                SELECT DISTINCT pu.network FROM purchase pu WHERE pu.no_project = $1
              )
            ), 0) AS balance_actual
          FROM purchase_detail pd
          INNER JOIN purchase pu ON pd.id_purchase = pu.id_purchase
          WHERE pu.no_project = $1
        )
        SELECT 
          COUNT(*) FILTER (WHERE pd.status = 'PO') * 100.0 / NULLIF(COUNT(*), 0) AS porcentaje_po,
          COUNT(*) FILTER (WHERE pd.status = 'PR') * 100.0 / NULLIF(COUNT(*), 0) AS porcentaje_pr,
          COUNT(*) FILTER (WHERE pd.status = 'Shopping cart') * 100.0 / NULLIF(COUNT(*), 0) AS porcentaje_shopping,
          COUNT(*) FILTER (WHERE pd.status = 'Delivered to BRK') * 100.0 / NULLIF(COUNT(*), 0) AS porcentaje_entregado,
          COUNT(*) FILTER (WHERE pd.status = 'Quoted') * 100.0 / NULLIF(COUNT(*), 0) AS porcentaje_cotizado,
          (fd.total_gastado * 100.0 / NULLIF((fd.total_gastado + fd.balance_actual), 0)) AS porcentaje_gastado,
          fd.total_gastado AS total_gastado,
          fd.balance_actual AS balance_actual
        FROM purchase pu
        INNER JOIN purchase_detail pd ON pu.id_purchase = pd.id_purchase
        CROSS JOIN finance_data fd
        WHERE pu.no_project = $1
        GROUP BY fd.total_gastado, fd.balance_actual;`;
      params = [projectId];
    } else {
      sql = 
        `WITH finance_data AS (
          SELECT 
            COALESCE(SUM(pd.quantity * pd.price_unit), 0) AS total_gastado,
            COALESCE((SELECT SUM(balance) FROM network), 0) AS balance_actual
          FROM purchase_detail pd
          INNER JOIN purchase pu ON pd.id_purchase = pu.id_purchase
        )
        SELECT 
          COUNT(*) FILTER (WHERE pd.status = 'PO') * 100.0 / NULLIF(COUNT(*), 0) AS porcentaje_po,
          COUNT(*) FILTER (WHERE pd.status = 'PR') * 100.0 / NULLIF(COUNT(*), 0) AS porcentaje_pr,
          COUNT(*) FILTER (WHERE pd.status = 'Shopping cart') * 100.0 / NULLIF(COUNT(*), 0) AS porcentaje_shopping,
          COUNT(*) FILTER (WHERE pd.status = 'Delivered to BRK') * 100.0 / NULLIF(COUNT(*), 0) AS porcentaje_entregado,
          COUNT(*) FILTER (WHERE pd.status = 'Quoted') * 100.0 / NULLIF(COUNT(*), 0) AS porcentaje_cotizado,
          (fd.total_gastado * 100.0 / NULLIF((fd.total_gastado + fd.balance_actual), 0)) AS porcentaje_gastado,
          fd.total_gastado AS total_gastado,
          fd.balance_actual AS balance_actual
        FROM purchase pu
        INNER JOIN purchase_detail pd ON pu.id_purchase = pd.id_purchase
        CROSS JOIN finance_data fd
        GROUP BY fd.total_gastado, fd.balance_actual;`;
      params = [];
    }

    const result = await pool.query(sql, params);
    const row = result.rows[0] || {};
    
    if (row.total_gastado !== undefined) row.total_gastado = Number(row.total_gastado);
    if (row.balance_actual !== undefined) row.balance_actual = Number(row.balance_actual);
    if (row.porcentaje_gastado !== undefined) row.porcentaje_gastado = Number(row.porcentaje_gastado);
    
    res.json(row);

  } catch (error) {
    console.error('Error fetching percentages:', error);
    res.status(500).json({ error: 'Error al cargar porcentajes' });
  }
});

// Endpoint de diagnóstico para comprobar qué recibe el servidor y cuántas filas devuelve
app.get('/api/bomView/debug', async (req, res) => {
  const noProject = req.query.no_project;
  console.log('/api/bomView/debug called with no_project=', noProject);
  try {
    let query = 
      `SELECT 
        pr.no_project,
        pr.name_project,
        p.no_part,
        p.description
      FROM bom_project bp
      JOIN product p ON bp.no_part = p.no_part
      JOIN project pr ON bp.no_project = pr.no_project`;
    const params = [];
    if (noProject) {
      query +=  ` WHERE pr.no_project::text = $1`;
      params.push(String(noProject));
    }
    query +=  ` ORDER BY pr.no_project, p.no_part`;

    const result = await pool.query(query, params);
    res.json({ received: noProject ?? null, count: result.rows.length, sample: result.rows.slice(0, 5) });
  } catch (err) {
    console.error('/api/bomView/debug error:', err);
    res.status(500).json({ error: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`SERVIDOR  ejecutándose en http://localhost:${PORT}`);
  console.log(`Todas las rutas funcionando:`);
  console.log(`   - /api/projects/all (Register Purchase)`);
  console.log(`   - /api/projects/search (NUEVO - Búsqueda proyectos)`);
  console.log(`   - /api/projects/active (BOM)`);
  console.log(`   - /api/products/types (NUEVO - Búsqueda tipos)`);
  console.log(`   - /api/products/byType (NUEVO - Obtener productos por tipo)`);
  console.log(`   - /api/products/bom-calculation (NUEVO - Cálculo BOM + Product)`);
  console.log(`   - /api/bom (Subir archivos BOM)`);
  console.log(`   - /api/stock (Inventory)`);
  console.log(`   - /api/purchases (MULTIPLE PRODUCTS SUPPORT + BALANCE UPDATE)`);
  console.log(`   - /api/network/balance/:network (GET NETWORK BALANCE)`);
});