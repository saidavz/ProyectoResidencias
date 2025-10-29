const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json()); 
app.use(express.static(__dirname));

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "bd_purchase_system",
  password: "postgresql",
  port: 5432,
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
     
     SUM(pd.quantity) AS cantidad_entrada,
     COALESCE(SUM(o.quantity), 0) AS cantidad_salida,
     SUM(pd.quantity) - COALESCE(SUM(o.quantity), 0) AS cantidad_disponible

     FROM Stock s
     JOIN Product p ON s.no_part = p.no_part 
     JOIN Purchase_detail pd ON s.id_detail = pd.id_detail 
     JOIN Vendor v ON pd.id_vendor = v.id_vendor 
     JOIN Project pr ON pd.no_project = pr.no_project 
     JOIN Network n ON pd.network = n.network
     JOIN Purchase pu ON pd.id_purchase = pu.id_purchase

     LEFT JOIN Output_inventory o
     ON s.id_stock = o.id_stock
     AND s.no_part = o.no_part
     AND s.id_detail = o.id_detail
     AND s.id_purchase = o.id_purchase

     GROUP BY
     s.id_stock, s.rack, s.date_entry,
     p.no_part, p.brand, p.description, p.quantity, p.unit, p.type_p,  
     pd.price_unit, pd.quantity, pd.status,  
     n.network, n.balance,
     v.name_vendor,
     pr.name_project,
     pu.currency, pu.time_delivered, pu.pr, pu.shopping, pu.po;
    `;
    
    const result = await pool.query(query);
    console.log(`✅ Datos obtenidos: ${result.rows.length} registros`);
    res.json(result.rows);
    
  } catch (error) {
    console.error("❌ Error en consulta SQL:", error.message);
    res.status(500).json({ 
      error: "Error fetching stock data",
      details: error.message 
    });
  }
});

// ========== RUTAS API DE COMPRAS ==========
app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT no_part, description FROM product ORDER BY no_part');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Error al cargar productos' });
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
        p.id_purchase,
        pd.no_part,
        prd.description as product_description,
        prj.name_project as project_name,
        v.name_vendor as vendor_name,
        pd.quantity,
        pd.price_unit,
        p.currency,
        pd.status,
        p.time_delivered,
        p.network
      FROM purchase p
      INNER JOIN purchase_detail pd ON p.id_purchase = pd.id_purchase
      INNER JOIN project prj ON p.no_project = prj.no_project
      INNER JOIN vendor v ON p.id_vendor = v.id_vendor
      INNER JOIN product prd ON pd.no_part = prd.no_part
      ORDER BY p.id_purchase DESC
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
      pr
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
      'shopping',
      po || null,
      no_project,
      id_vendor,
      network
    ]);
    
    const id_purchase = purchaseResult.rows[0].id_purchase;

    const detailQuery = `
      INSERT INTO purchase_detail (quantity, price_unit, status, id_purchase, no_project, id_vendor, network, no_part)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id_detail
    `;
    
    const detailResult = await client.query(detailQuery, [
      parseInt(quantity),
      parseFloat(price_unit),
      status,
      id_purchase,
      no_project,
      id_vendor,
      network,
      no_part
    ]);

    await client.query('COMMIT');
    
    console.log('Compra guardada exitosamente. ID:', id_purchase);
    
    res.json({ 
      success: true, 
      message: 'Compra guardada exitosamente',
      id_purchase: id_purchase,
      id_detail: detailResult.rows[0].id_detail
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

app.listen(3000, () => {
  console.log("Servidor ÚNICO ejecutándose en http://localhost:3000");
  console.log("Inventario: http://localhost:3000/stock.html");
  console.log("Compras: http://localhost:3000/recordPurchase.html");
  console.log("Tracking: http://localhost:3000/purchaseTracking.html");
});