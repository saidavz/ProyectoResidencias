import express from 'express';
import pg from 'pg';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

const pool = new pg.Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'bd_purchase_system',
  password: 'postgresql',
  port: 5432,
});

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

app.get('/api/projects', async (req, res) => {
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

    const {
      no_part,
      quantity,
      price_unit,
      currency,
      id_vendor,
      no_project,
      time_delivered,
      status,
      network,
      po,
      pr,
      shopping
    } = req.body;

    console.log('Datos recibidos:', req.body);

      const purchaseQuery = `
      INSERT INTO purchase (currency, time_delivered, pr, shopping, po, no_project, id_vendor, network)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id_purchase
    `;

    const purchaseResult = await client.query(purchaseQuery, [
      currency,
      time_delivered,
      pr || null,
      shopping,
      po || null,
      no_project,
      id_vendor,
      network
    ]);

    const id_purchase = purchaseResult.rows[0].id_purchase;
    const detailQuery = `
      INSERT INTO purchase_detail (quantity, price_unit, status, id_purchase, no_part)
      VALUES ($1, $2, $3, $4, $5)
    `;

    await client.query(detailQuery, [
      parseInt(quantity),
      parseFloat(price_unit),
      status,
      id_purchase,
      no_part
    ]);

    await client.query('COMMIT');

    console.log('Compra guardada exitosamente. ID:', id_purchase);

    res.json({
      success: true,
      message: 'Compra guardada exitosamente',
      id_purchase: id_purchase
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error saving purchase:', error);
    res.status(500).json({
      success: false,
      error: 'Error al guardar la compra: ' + error.message
    });
  } finally {
    client.release();
  }
});

app.get("/api/stock", async (req, res) => {
  try {
    console.log("🔍 Ejecutando consulta SQL...");

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
        COALESCE((
          SELECT SUM(o.quantity) 
          FROM Output_inventory o 
          WHERE o.id_stock = s.id_stock
        ), 0) AS cantidad_salida,
        (pd.quantity - COALESCE((
          SELECT SUM(o.quantity) 
          FROM Output_inventory o 
          WHERE o.id_stock = s.id_stock
        ), 0)) AS cantidad_disponible
      FROM Stock s
      JOIN Product p ON s.no_part = p.no_part 
      JOIN Purchase_detail pd ON s.no_part = pd.no_part  -- ← CORREGIDO: unir por no_part
      JOIN Purchase pu ON pd.id_purchase = pu.id_purchase
      JOIN Vendor v ON pu.id_vendor = v.id_vendor       -- ← CORREGIDO: desde Purchase
      JOIN Project pr ON pu.no_project = pr.no_project  -- ← CORREGIDO: desde Purchase  
      JOIN Network n ON pu.network = n.network          -- ← CORREGIDO: desde Purchase
      WHERE s.id_stock IS NOT NULL
      ORDER BY s.date_entry DESC
    `;

    const result = await pool.query(query);
    console.log(`Datos obtenidos: ${result.rows.length} registros`);
    res.json(result.rows);

  } catch (error) {
    console.error("Error en consulta SQL:", error.message);
    res.status(500).json({
      error: "Error fetching stock data",
      details: error.message
    });
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

app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor ÚNICO ejecutándose en http://localhost:${PORT}`);
});