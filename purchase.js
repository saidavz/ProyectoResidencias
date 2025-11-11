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
  database: 'bd_purchase_system',
  password: 'postgresql',
  port: 5432,
});

// ============================================================================
// 🎯 RUTAS DEL SERVIRDOR 1 (purchase.js) - CON /api/
// ============================================================================

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
       WHERE no_part ILIKE $1 
       ORDER BY no_part 
       LIMIT 10`,
      [`${term}%`]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error searching products:', err);
    res.status(500).json({ error: 'Error al buscar productos' });
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
    const result = await pool.query('SELECT no_project, name_project FROM project ORDER BY name_project');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Error al cargar proyectos' });
  }
});

app.get('/api/networks', async (req, res) => {
  try {
    const result = await pool.query('SELECT network FROM network ORDER BY network');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching networks:', error);
    res.status(500).json({ error: 'Error al cargar networks' });
  }
});

app.get('/api/purchases', async (req, res) => {
  try {
    const query = `
      SELECT 
        pu.id_purchase,
        p.no_part,
        p.description as description,
        pr.name_project as project_name,
        v.name_vendor as vendor_name,
        pd.quantity,
        pd.price_unit,
        (pd.price_unit * pd.quantity) AS subtotal,
        pu.currency,
        pd.status,
        pu.time_delivered,
        n.network,
        pu.po,
        pu.pr,
        pu.shopping
      FROM purchase pu
      INNER JOIN purchase_detail pd ON pu.id_purchase = pd.id_purchase
      INNER JOIN project pr ON pu.no_project = pr.no_project
      INNER JOIN vendor v ON pu.id_vendor = v.id_vendor
      INNER JOIN product p ON pd.no_part = p.no_part
      INNER JOIN network n ON pu.network = n.network 
      ORDER BY pu.id_purchase DESC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching purchases:', error);
    res.status(500).json({ error: 'Error al cargar las compras' });
  }
});

app.post('/api/purchases', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { no_part, quantity, price_unit, currency, id_vendor, no_project, time_delivered, status, network, po, pr, shopping } = req.body;

    const purchaseQuery = `
      INSERT INTO purchase (currency, time_delivered, pr, shopping, po, no_project, id_vendor, network)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id_purchase
    `;
    const purchaseResult = await client.query(purchaseQuery, [currency, time_delivered, pr || null, shopping, po || null, no_project, id_vendor, network]);
    const id_purchase = purchaseResult.rows[0].id_purchase;
    
    const detailQuery = `INSERT INTO purchase_detail (quantity, price_unit, status, id_purchase, no_part) VALUES ($1, $2, $3, $4, $5)`;
    await client.query(detailQuery, [parseInt(quantity), parseFloat(price_unit), status, id_purchase, no_part]);
    
    await client.query('COMMIT');
    res.json({ success: true, message: 'Compra guardada exitosamente', id_purchase: id_purchase });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error saving purchase:', error);
    res.status(500).json({ success: false, error: 'Error al guardar la compra: ' + error.message });
  } finally {
    client.release();
  }
});

app.get("/api/stock", async (req, res) => {
  try {
    const query = `
      SELECT
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
        (pd.quantity - COALESCE((SELECT SUM(o.quantity) FROM Output_inventory o WHERE o.id_stock = s.id_stock), 0)) AS cantidad_disponible
      FROM Stock s
      JOIN Product p ON s.no_part = p.no_part 
      JOIN Purchase_detail pd ON s.no_part = pd.no_part
      JOIN Purchase pu ON pd.id_purchase = pu.id_purchase
      JOIN Vendor v ON pu.id_vendor = v.id_vendor
      JOIN Project pr ON pu.no_project = pr.no_project
      JOIN Network n ON pu.network = n.network
      WHERE s.id_stock IS NOT NULL
      ORDER BY s.date_entry DESC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error("Error en consulta SQL:", error.message);
    res.status(500).json({ error: "Error fetching stock data", details: error.message });
  }
});

// ============================================================================
// 🎯 RUTAS DEL SERVIRDOR 2 (BOM) - CORRECCIONES APLICADAS
// ============================================================================

// Funciones auxiliares para BOM (sin cambios)
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

// Ruta para BOM - obtener proyectos (CORREGIDA)
app.get("/api/projects/active", async (req, res) => {
    try {
      // CORRECCIÓN 1: Usar ILIKE para que el filtro sea insensible a mayúsculas/minúsculas
      const result = await pool.query("SELECT no_project, name_project AS name FROM Project WHERE status ILIKE 'activo'");
      res.json(result.rows);
    } catch (err) {
      console.error("Error obtaining projects:", err);
      res.status(500).json({ message: "Error obtaining projects" });
    }
  });

// Ruta para BOM - subir archivo Excel (sin cambios)
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
// ============================================================================
// 🎯 RUTA PARA BOM VIEW (Verificación del Filtro de Proyectos)
// ============================================================================
app.get('/api/bomView', async (req, res) => {
  const projectName = req.query.project; 
  
  try {
      let query = `
          SELECT 
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
          JOIN project pr ON bp.no_project = pr.no_project
      `;

      const queryParams = [];

      // Se usa ILIKE para que el filtro de proyectos sea más robusto.
      if (projectName) {
          query += ` WHERE pr.name_project ILIKE $1`;
          queryParams.push(projectName);
      }

      query += ` ORDER BY pr.name_project, p.no_part`;

      const result = await pool.query(query, queryParams);
      res.json(result.rows);
  } catch (error) {
      console.error('Error fetching BOM data:', error);
      res.status(500).json({ error: 'Error al cargar los datos del BOM' });
  }
});
// ============================================================================

// ============================================================================
// RUTAS PARA SERVIR ARCHIVOS HTML
// ============================================================================

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

app.get('/bomView.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'bomView.html'));
});

app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});
app.listen(PORT, () => {
  console.log(`🎯 SERVIDOR UNIFICADO ejecutándose en http://localhost:${PORT}`);
  console.log(`✅ Rutas BOM corregidas: /api/projects/active y /api/bomView`);
});