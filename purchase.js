// server.js


//COMENTARIO PRUEBA
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
  database: 'db_purchase_system',//verifica bien al cambiarlo
  password: 'automationdb', //verifica bien al cambiarlo
  port: 5432,
});

function sanitizePid(rawPid) {
  if (rawPid == null) return '';
  return String(rawPid)
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .replace(/[;]+$/g, '');
}

function getPidCandidates(normalizedPid) {
  const candidates = new Set();
  if (normalizedPid) candidates.add(normalizedPid);

  // Algunos escaneres agregan un sufijo alfabetico (ej. "C").
  const withoutTrailingLetters = normalizedPid.replace(/[A-Za-z]+$/g, '');
  if (withoutTrailingLetters) candidates.add(withoutTrailingLetters);

  return Array.from(candidates);
}

async function resolveExistingUserPid(rawPid) {
  const normalizedPid = sanitizePid(rawPid);
  if (!normalizedPid) return null;

  const candidates = getPidCandidates(normalizedPid);
  for (const candidate of candidates) {
    const result = await pool.query(
      `
      SELECT pid
      FROM user_
      WHERE LOWER(REGEXP_REPLACE(BTRIM(CAST(pid AS TEXT)), '[;[:space:]]+$', '')) = LOWER($1)
      LIMIT 1
      `,
      [candidate]
    );

    if (result.rows.length > 0) {
      // Return DB value exactly as stored so FK checks match 1:1.
      return result.rows[0].pid;
    }
  }

  return null;
}

async function requireMovementUserPid(req, res, endpointName) {
  const cleanPid = sanitizePid(req?.body?.pid);
  if (!cleanPid) {
    res.status(401).json({ ok: false, message: 'Sesion invalida: vuelve a iniciar sesion.' });
    return null;
  }

  const userPid = await resolveExistingUserPid(cleanPid);
  if (!userPid) {
    console.warn(`PID not found in user_ for ${endpointName}:`, cleanPid);
    res.status(401).json({ ok: false, message: `Usuario invalido para registrar movimiento (PID: ${cleanPid}).` });
    return null;
  }

  return userPid;
}
// Endpoint para verificar estructura de BD
app.get('/api/db-check', async (req, res) => {
  try {
    // Verificar tablas existentes
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    // Verificar estructura de tabla user_
    let userStructure = null;
    try {
      const userResult = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'user_' AND table_schema = 'public'
        ORDER BY ordinal_position
      `);
      userStructure = userResult.rows;
    } catch (e) {
      userStructure = 'Table does not exist';
    }

    // Obtener todos los usuarios (sin passwords)
    let allUsers = [];
    try {
      const usersResult = await pool.query(`
        SELECT 
          pid, 
          user_name, 
          last_name, 
          rol,
          LENGTH(COALESCE(user_password, '')) as password_length
        FROM user_
        ORDER BY user_name
      `);
      allUsers = usersResult.rows;
    } catch (e) {
      allUsers = 'Error: ' + e.message;
    }
    
    res.json({
      status: 'OK',
      tables: tablesResult.rows.map(r => r.table_name),
      user_table_structure: userStructure,
      all_users: allUsers
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para validar login de usuario con QR (pid)
app.post('/api/auth/validate-qr', async (req, res) => {
  const { pid } = req.body;

  if (!pid) {
    return res.status(400).json({ 
      success: false, 
      error: 'PID es requerido' 
    });
  }

  try {
    const rawPid = String(pid);
    // Some scanners append delimiters/control chars (e.g. ';', CR/LF, TAB).
    // Normalize the scanned input so it matches stored PID values.
    const normalizedPid = rawPid
      .replace(/[\u0000-\u001F\u007F]/g, '')
      .trim()
      .replace(/[;]+$/g, '');

    if (!normalizedPid) {
      return res.status(400).json({
        success: false,
        error: 'PID invalido despues de normalizar el escaneo.'
      });
    }

    // Priorizar columna "rol"; si no existe, usar "role" por compatibilidad.
    const roleColumnResult = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'user_'
        AND column_name IN ('rol', 'role')
      ORDER BY CASE WHEN column_name = 'rol' THEN 0 ELSE 1 END
      LIMIT 1
    `);

    if (roleColumnResult.rows.length === 0) {
      return res.status(500).json({
        success: false,
        error: 'La tabla user_ no tiene columna rol/role para validar permisos.'
      });
    }

    const roleColumn = roleColumnResult.rows[0].column_name;

    // Buscar usuario por PID y verificar que tenga rol permitido.
    // Normalizamos tambien el PID guardado en BD por si se registro con sufijos del escaner.
    const query = `
      SELECT
        pid,
        ${roleColumn} AS rol,
        COALESCE(user_name, '') AS user_name,
        COALESCE(last_name, '') AS last_name
      FROM user_
      WHERE LOWER(REGEXP_REPLACE(BTRIM(CAST(pid AS TEXT)), '[;[:space:]]+$', '')) = LOWER($1)
        AND (
          ${roleColumn} ILIKE 'Administrador'
          OR ${roleColumn} ILIKE 'Compras'
          OR ${roleColumn} ILIKE 'Tecnico'
        )
      LIMIT 1
    `;

    const result = await pool.query(query, [normalizedPid]);

    if (result.rows.length > 0) {
      const user = result.rows[0];
      res.json({
        success: true,
        user: {
          pid: user.pid,
          rol: user.rol,
          role: user.rol,
          user_name: user.user_name,
          last_name: user.last_name
        }
      });
    } else {
      res.status(401).json({
        success: false,
        error: 'Acceso denegado. Usuario no encontrado o sin permisos.'
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Error al validar usuario: ' + error.message 
    });
  }
});

// Endpoint para validar login de usuario con credenciales (user_name y user_password)
app.post('/api/auth/validate-credentials', async (req, res) => {
  const { user_name, user_password } = req.body;

  if (!user_name) {
    return res.status(400).json({ 
      success: false, 
      error: 'User name es requerido' 
    });
  }

  if (!user_password) {
    return res.status(400).json({ 
      success: false, 
      error: 'Password es requerido' 
    });
  }

  try {
    const normalizedUserName = String(user_name).trim();
    const normalizedPassword = String(user_password).trim();

    console.log('Login attempt:', { user_name: normalizedUserName, password_length: normalizedPassword.length });

    // Priorizar columna "rol"; si no existe, usar "role" por compatibilidad.
    const roleColumnResult = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'user_'
        AND column_name IN ('rol', 'role')
      ORDER BY CASE WHEN column_name = 'rol' THEN 0 ELSE 1 END
      LIMIT 1
    `);

    if (roleColumnResult.rows.length === 0) {
      return res.status(500).json({
        success: false,
        error: 'La tabla user_ no tiene columna rol/role para validar permisos.'
      });
    }

    const roleColumn = roleColumnResult.rows[0].column_name;

    // Buscar usuario por user_name (sin BTRIM, solo TRIM)
    const query = `
      SELECT
        pid,
        ${roleColumn} AS rol,
        COALESCE(user_name, '') AS user_name,
        COALESCE(last_name, '') AS last_name,
        COALESCE(user_password, '') AS user_password
      FROM user_
      WHERE TRIM(LOWER(CAST(user_name AS TEXT))) = LOWER($1)
      LIMIT 1
    `;

    const result = await pool.query(query, [normalizedUserName]);

    console.log('User found:', result.rows.length > 0 ? 'YES' : 'NO');

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no encontrado.'
      });
    }

    const user = result.rows[0];
    const dbPassword = String(user.user_password || '').trim();
    
    console.log('Password check:', { 
      provided: normalizedPassword, 
      stored: dbPassword,
      match: dbPassword === normalizedPassword 
    });

    // Validar contraseña (comparar trimmed strings)
    if (dbPassword !== normalizedPassword) {
      return res.status(401).json({
        success: false,
        error: 'Contraseña incorrecta.'
      });
    }

    // Validar que el usuario tenga un rol permitido
    const userRole = String(user.rol || '').toLowerCase().trim();
    const allowedRoles = ['administrador', 'compras', 'tecnico'];
    
    console.log('User role check:', { role: userRole, isAllowed: allowedRoles.includes(userRole) });

    if (!allowedRoles.includes(userRole)) {
      return res.status(401).json({
        success: false,
        error: 'Acceso denegado. Usuario sin permisos suficientes.'
      });
    }

    // Retornar datos del usuario
    console.log('Login successful for:', normalizedUserName);
    
    res.json({
      success: true,
      user: {
        pid: user.pid,
        rol: user.rol,
        role: user.rol,
        user_name: user.user_name,
        last_name: user.last_name
      }
    });

  } catch (error) {
    console.error('Auth error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Error al validar credenciales: ' + error.message 
    });
  }
});

app.post('/api/users', async (req, res) => {
  const {
    pid,
    user_name,
    last_name,
    second_last_name,
    rol,
    user_password
  } = req.body || {};

  const normalizedPid = String(pid || '').trim();
  const normalizedUserName = String(user_name || '').trim();
  const normalizedLastName = String(last_name || '').trim();
  const normalizedSecondLastName = String(second_last_name || '').trim();
  const normalizedRole = String(rol || '').trim();
  const normalizedPassword = String(user_password || '').trim();

  if (!normalizedPid || !normalizedUserName || !normalizedLastName || !normalizedSecondLastName || !normalizedRole || !normalizedPassword) {
    return res.status(400).json({ success: false, error: 'Todos los campos son requeridos.' });
  }

  if (!['Administrador', 'Tecnico'].includes(normalizedRole)) {
    return res.status(400).json({ success: false, error: 'Rol invalido. Solo se permite Administrador o Tecnico.' });
  }

  try {
    const duplicateCheck = await pool.query(
      `
      SELECT pid, user_name
      FROM user_
      WHERE LOWER(BTRIM(CAST(pid AS TEXT))) = LOWER($1)
         OR LOWER(BTRIM(CAST(user_name AS TEXT))) = LOWER($2)
      LIMIT 1
      `,
      [normalizedPid, normalizedUserName]
    );

    if (duplicateCheck.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'Ya existe un usuario con ese PID o user_name.' });
    }

    const result = await pool.query(
      `
      INSERT INTO user_ (pid, user_name, last_name, second_last_name, rol, user_password)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING pid, user_name, last_name, second_last_name, rol
      `,
      [
        normalizedPid,
        normalizedUserName,
        normalizedLastName,
        normalizedSecondLastName,
        normalizedRole,
        normalizedPassword
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Usuario registrado correctamente.',
      user: result.rows[0]
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al registrar usuario: ' + error.message });
  }
});

app.get('/api/users/search', async (req, res) => {
  const term = String(req.query.term || '').trim();

  try {
    const params = [];
    let whereClause = '';

    if (term) {
      params.push(`%${term}%`);
      whereClause = `
        WHERE LOWER(BTRIM(CAST(user_name AS TEXT))) LIKE LOWER($1)
           OR LOWER(BTRIM(CAST(last_name AS TEXT))) LIKE LOWER($1)
           OR LOWER(BTRIM(CAST(second_last_name AS TEXT))) LIKE LOWER($1)
      `;
    }

    const query = `
      SELECT
        BTRIM(CAST(user_name AS TEXT)) AS user_name,
        BTRIM(CAST(last_name AS TEXT)) AS last_name,
        BTRIM(CAST(second_last_name AS TEXT)) AS second_last_name
      FROM user_
      ${whereClause}
      ORDER BY user_name, last_name, second_last_name
      LIMIT 25
    `;

    const result = await pool.query(query, params);
    return res.json({ success: true, users: result.rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al buscar usuarios: ' + error.message });
  }
});

app.post('/api/users/delete', async (req, res) => {
  const {
    user_name,
    last_name,
    second_last_name
  } = req.body || {};

  const normalizedUserName = String(user_name || '').trim();
  const normalizedLastName = String(last_name || '').trim();
  const normalizedSecondLastName = String(second_last_name || '').trim();

  if (!normalizedUserName || !normalizedLastName || !normalizedSecondLastName) {
    return res.status(400).json({ success: false, error: 'user_name, last_name y second_last_name son requeridos.' });
  }

  try {
    const result = await pool.query(
      `
      DELETE FROM user_
      WHERE LOWER(BTRIM(CAST(user_name AS TEXT))) = LOWER($1)
        AND LOWER(BTRIM(CAST(last_name AS TEXT))) = LOWER($2)
        AND LOWER(BTRIM(CAST(second_last_name AS TEXT))) = LOWER($3)
      RETURNING pid, user_name, last_name, second_last_name
      `,
      [normalizedUserName, normalizedLastName, normalizedSecondLastName]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'No se encontro usuario con los datos proporcionados.' });
    }

    return res.json({
      success: true,
      message: 'Usuario eliminado correctamente.',
      user: result.rows[0]
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al eliminar usuario: ' + error.message });
  }
});

app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT no_part, description FROM product ORDER BY no_part');
    res.json(result.rows);
  } catch (error) {
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

    // 2. Buscar productos que coincidan con el tipo de producto Y estén en BOM
    // PERO EXCLUIR productos que ya hayan sido registrados en una compra
    const productResult = await pool.query(
      `SELECT p.no_part, p.brand, p.description, p.quantity, p.unit, p.type_p 
       FROM product p
       WHERE p.type_p = $1 
         AND p.no_part = ANY($2::text[])
         AND NOT EXISTS (
           SELECT 1 FROM purchase_detail pd
           JOIN purchase pu ON pd.id_purchase = pu.id_purchase
           WHERE pd.no_part = p.no_part
             AND pu.no_project = $3
         )`,
      [type_p, bomNoParts, no_project]
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


    res.status(500).send("Error en el servidor");
  }
});

//Obtener productos por tipo
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
         AND status ILIKE 'Active'
       ORDER BY 
         CASE 
           WHEN no_project::text ILIKE $3 THEN 1
           WHEN name_project ILIKE $3 THEN 2
           WHEN no_project::text ILIKE $1 THEN 3
           ELSE 4
         END,
         name_project 
       LIMIT 10`,
      [`%${term}%`, `%${term}%`, `${term}%`]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al buscar proyectos' });
  }
});

// Busqueda de no_project desde BOM
app.get('/api/bom-projects/search', async (req, res) => {
  const term = String(req.query.term || '').trim();

  try {
    const result = await pool.query(
      `SELECT DISTINCT ON (bp.no_project) bp.no_project::text AS no_project, COALESCE(p.name_project::text, '') AS name
       FROM bom_project bp
       LEFT JOIN project p ON bp.no_project = p.no_project
       WHERE bp.no_project IS NOT NULL
         AND BTRIM(bp.no_project::text) <> ''
         AND (bp.no_project::text ILIKE $1 OR p.name_project::text ILIKE $1)
       ORDER BY bp.no_project
       LIMIT 10`,
      [`%${term}%`]
    );

    res.json(result.rows);
  } catch (err) {


    res.status(500).json({ error: 'Error al buscar no_project en BOM' });
  }
});

// Guardar items de requisición en bom_project
app.post('/api/requisitions/save', async (req, res) => {
  const { no_project, no_qis, projectTitle, items } = req.body;

  const normalizedNoProject = String(no_project || '').trim();
  const normalizedNoQis = String(no_qis || '').trim();

  if (!normalizedNoProject || !normalizedNoQis || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Incomplete data to save requisition' });
  }

  const client = await pool.connect();
  
  try {
    const savedItems = [];
    const skippedItems = [];

    await client.query('BEGIN');

    const lengthInfo = await client.query(
      `SELECT table_name, column_name, character_maximum_length
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND (
           (table_name = 'product' AND column_name IN ('no_part', 'brand', 'description', 'unit', 'type_p'))
           OR (table_name = 'bom_project' AND column_name IN ('no_project', 'no_qis', 'no_part', 'status'))
         )`
    );

    const maxLengths = {};
    for (const row of lengthInfo.rows) {
      if (!maxLengths[row.table_name]) {
        maxLengths[row.table_name] = {};
      }
      maxLengths[row.table_name][row.column_name] = row.character_maximum_length;
    }

    const fitText = (tableName, columnName, value) => {
      if (value === null || value === undefined) return '';
      const strValue = String(value).trim();
      const limit = maxLengths[tableName] && maxLengths[tableName][columnName];
      if (!limit || strValue.length <= limit) return strValue;
      return strValue.slice(0, limit);
    };

    // Verify if no_project exists in project table
    const projectCheck = await client.query(
      'SELECT no_project FROM project WHERE no_project = $1',
      [normalizedNoProject]
    );

    let finalNoProject = normalizedNoProject;

    // If project does NOT exist, create it preserving the selected no_project value.
    if (projectCheck.rows.length === 0) {
      await client.query(
        'INSERT INTO project (no_project, name_project, status) VALUES ($1, $2, $3)',
        [normalizedNoProject, projectTitle || 'Untitled', 'Active']
      );
      finalNoProject = normalizedNoProject;
    }

    // Process each item: insert in product if not exists, then in bom_project
    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      const { partNumber, description, quantity, units } = item;

      let normalizedPartNumber = fitText('product', 'no_part', partNumber);
      const normalizedDescription = fitText('product', 'description', description || '');
      const normalizedUnit = fitText('product', 'unit', units || '');
      
      // Validate minimum required fields
      if (!normalizedPartNumber || !quantity) {
        skippedItems.push({
          index,
          partNumber: normalizedPartNumber || 'UNKNOWN',
          reason: 'Missing part number or quantity'
        });
        continue;
      }

      const savepointName = `req_item_${index}`;
      await client.query(`SAVEPOINT ${savepointName}`);

      try {
        // Check if product already exists in product table (get description too)
        const productCheck = await client.query(
          'SELECT no_part, COALESCE(description,\'\') AS description FROM product WHERE no_part = $1',
          [normalizedPartNumber]
        );

        // If product exists but description differs, create a new distinct no_part derived from the description
        if (productCheck.rows.length > 0) {
          const existingDesc = String(productCheck.rows[0].description || '');
          const normalizeDescForCompare = (s) => String(s || '').replace(/[^a-z0-9]+/gi, ' ').trim().toLowerCase();
          const a = normalizeDescForCompare(existingDesc);
          const b = normalizeDescForCompare(normalizedDescription);

          if (a !== b && a && b) {
            // Generate a short slug from the incoming description
            let slug = String(normalizedDescription || '')
              .replace(/[^a-zA-Z0-9]+/g, '_')
              .replace(/^_+|_+$/g, '')
              .replace(/_+/g, '_')
              .toUpperCase();
            if (!slug) slug = 'DESC';
            slug = slug.slice(0, 20);

            // Candidate new part
            let candidate = fitText('product', 'no_part', `${normalizedPartNumber}__${slug}`);

            // Ensure candidate is unique
            let attempt = 0;
            while (true) {
              const exists = await client.query('SELECT 1 FROM product WHERE no_part = $1', [candidate]);
              if (exists.rows.length === 0) break;
              attempt += 1;
              candidate = fitText('product', 'no_part', `${normalizedPartNumber}__${slug}_${attempt}`);
              if (attempt > 10) break;
            }

            // Use the candidate as the new part number and insert product
            normalizedPartNumber = candidate;
            await client.query(
              'INSERT INTO product (no_part, brand, description, quantity, unit, type_p) VALUES ($1, $2, $3, $4, $5, $6)',
              [
                normalizedPartNumber,
                fitText('product', 'brand', 'OTHER'),
                normalizedDescription,
                1,
                normalizedUnit,
                fitText('product', 'type_p', 'OTHER')
              ]
            );
          }
        } else {
          // If product does NOT exist, create it normally
          await client.query(
            'INSERT INTO product (no_part, brand, description, quantity, unit, type_p) VALUES ($1, $2, $3, $4, $5, $6)',
            [
              normalizedPartNumber,
              fitText('product', 'brand', 'OTHER'),
              normalizedDescription,
              1,
              normalizedUnit,
              fitText('product', 'type_p', 'OTHER')
            ]
          );
        }

        // Check if item already exists in bom_project for this no_qis
        const legacyQisPartCheck = await client.query(
          `SELECT no_project
           FROM bom_project
           WHERE no_qis = $1
             AND UPPER(BTRIM(no_part)) = UPPER(BTRIM($2))
           LIMIT 1`,
          [
            fitText('bom_project', 'no_qis', normalizedNoQis),
            fitText('bom_project', 'no_part', normalizedPartNumber)
          ]
        );

        if (legacyQisPartCheck.rows.length > 0) {
          const legacyNoProject = String(legacyQisPartCheck.rows[0].no_project || '').trim();
          const targetNoProject = fitText('bom_project', 'no_project', finalNoProject);

          if (legacyNoProject && legacyNoProject !== targetNoProject) {
            await client.query(
              `UPDATE bom_project
               SET no_project = $1,
                   quantity_project = $2,
                   status = $3
               WHERE no_qis = $4
                 AND UPPER(BTRIM(no_part)) = UPPER(BTRIM($5))`,
              [
                targetNoProject,
                quantity,
                fitText('bom_project', 'status', 'Quoted'),
                fitText('bom_project', 'no_qis', normalizedNoQis),
                fitText('bom_project', 'no_part', normalizedPartNumber)
              ]
            );

            savedItems.push({
              partNumber: normalizedPartNumber,
              description: normalizedDescription,
              quantity,
              units: normalizedUnit
            });

            await client.query(`RELEASE SAVEPOINT ${savepointName}`);
            continue;
          }
        }

        // Check existing BOM entries matching both part identifier and product description
        // This allows items that share the same measurements (no_part) but have different
        // descriptions (e.g. different materials) to be stored separately.
        const bomCheck = await client.query(
          `SELECT bp.no_part
           FROM bom_project bp
           LEFT JOIN product p ON bp.no_part = p.no_part
           WHERE bp.no_project = $1
             AND bp.no_qis = $2
             AND UPPER(BTRIM(bp.no_part)) = UPPER(BTRIM($3))
             AND UPPER(BTRIM(COALESCE(p.description, ''))) = UPPER(BTRIM($4))`,
          [
            fitText('bom_project', 'no_project', finalNoProject),
            fitText('bom_project', 'no_qis', normalizedNoQis),
            fitText('bom_project', 'no_part', normalizedPartNumber),
            fitText('product', 'description', normalizedDescription)
          ]
        );

        // Only insert if it doesn't exist
        if (bomCheck.rows.length === 0) {
          await client.query(
            'INSERT INTO bom_project (no_project, no_qis, no_part, quantity_project, status) VALUES ($1, $2, $3, $4, $5)',
            [
              fitText('bom_project', 'no_project', finalNoProject),
              fitText('bom_project', 'no_qis', normalizedNoQis),
              fitText('bom_project', 'no_part', normalizedPartNumber),
              quantity,
              fitText('bom_project', 'status', 'Quoted')
            ]
          );
          savedItems.push({
            partNumber: normalizedPartNumber,
            description: normalizedDescription,
            quantity,
            units: normalizedUnit
          });
        } else {
          skippedItems.push({
            index,
            partNumber: normalizedPartNumber,
            reason: 'Item already exists in this requisition'
          });
        }

        await client.query(`RELEASE SAVEPOINT ${savepointName}`);
      } catch (itemError) {
        try {
          await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
          await client.query(`RELEASE SAVEPOINT ${savepointName}`);
        } catch (savepointError) {
          // If savepoint rollback fails, keep original error reason.
        }

        skippedItems.push({
          index,
          partNumber: normalizedPartNumber,
          reason: 'Database error: ' + (itemError.message || 'Unknown error')
        });
      }
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Requisition ${no_qis} saved successfully`,
      no_project: finalNoProject,
      items_received: items.length,
      items_saved: savedItems.length,
      items_skipped: skippedItems.length,
      saved_items: savedItems,
      skipped_details: skippedItems.length > 0 ? skippedItems : undefined
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      // Ignore rollback errors
    }
    res.status(500).json({ error: 'Error saving requisition: ' + err.message });
  } finally {
    client.release();
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


    res.status(500).json({ error: 'Error al buscar tipos de producto' });
  }
});

// Obtener tipos de productos que pertenecen a un proyecto específico
app.get('/api/products/types-by-project/:no_project', async (req, res) => {
  const { no_project } = req.params;
  const term = req.query.term || '';
  
  try {
    const result = await pool.query(
      `SELECT DISTINCT p.type_p
       FROM product p
       INNER JOIN bom_project bp ON p.no_part = bp.no_part
       WHERE bp.no_project = $1
         AND p.type_p IS NOT NULL 
         AND p.type_p != ''
         AND p.type_p ILIKE $2
       ORDER BY p.type_p 
       LIMIT 10`,
      [no_project, `%${term}%`]
    );
    res.json(result.rows);
  } catch (err) {


    res.status(500).json({ error: 'Error al buscar tipos de producto del proyecto' });
  }
});

app.get('/api/vendors', async (req, res) => {
  try {
    const result = await pool.query('SELECT id_vendor, name_vendor, email, telephone FROM vendor ORDER BY name_vendor');
    res.json(result.rows);
  } catch (error) {


    res.status(500).json({ error: 'Error al cargar proveedores' });
  }
});

app.get('/api/projects/all', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT no_project, name_project
      FROM project
      WHERE name_project NOT ILIKE '%STOCK_AVAILABLE%'
        AND status = 'Active'
      ORDER BY name_project`
    );
    res.json(result.rows);
  } catch (error) {


    res.status(500).json({ error: 'Error al cargar proyectos' });
  }
});

// Endpoint para obtener todos los proyectos incluyendo inactivos (para AUT-STOCK modal)
app.get('/api/projects/all-including-inactive', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT no_project, name_project, status
      FROM project
      WHERE no_project NOT LIKE '%STOCK%'
      ORDER BY status DESC, name_project`
    );
    res.json(result.rows);
  } catch (error) {


    res.status(500).json({ error: 'Error al cargar proyectos' });
  }
});
// Verificar si un proyecto existe
app.get('/api/projects/check/:no_project', async (req, res) => {
  try {
    const { no_project } = req.params;
    const result = await pool.query(
      'SELECT no_project, name_project, status FROM project WHERE no_project = $1',
      [no_project]
    );
    
    // Verificar si el proyecto existe
    const projectExists = result.rows.length > 0;
    
    // Verificar si el proyecto tiene BOM
    let hasBOM = false;
    if (projectExists) {
      const bomCheck = await pool.query(
        'SELECT COUNT(*) FROM bom_project WHERE no_project = $1',
        [no_project]
      );
      hasBOM = parseInt(bomCheck.rows[0].count) > 0;
    }
    
    res.json({ 
      exists: projectExists, 
      hasBOM: hasBOM,
      project: result.rows[0] || null 
    });
  } catch (error) {


    res.status(500).json({ error: 'Error al verificar proyecto' });
  }
});

// Crear o activar un proyecto
app.post('/api/projects', async (req, res) => {
  const { no_project, name_project } = req.body;
  if (!no_project || !name_project) {
    return res.status(400).json({ error: 'no_project y name_project son requeridos' });
  }
  try {
    // Verificar si existe
    const check = await pool.query('SELECT * FROM project WHERE no_project = $1', [no_project]);
    if (check.rows.length > 0) {
      // Si existe, activarlo
      await pool.query('UPDATE project SET status = $1 WHERE no_project = $2', ['Active', no_project]);
      res.json({ message: 'Proyecto activado exitosamente', project: check.rows[0] });
    } else {
      // Si no existe, crearlo activo
      const result = await pool.query(
        'INSERT INTO project (no_project, name_project, status) VALUES ($1, $2, $3) RETURNING *',
        [no_project, name_project, 'Active']
      );
      res.json({ message: 'Proyecto creado y activado exitosamente', project: result.rows[0] });
    }
  } catch (error) {


    res.status(500).json({ error: 'Error al crear/activar proyecto' });
  }
});

// Activar/desactivar un proyecto
app.put('/api/projects/:no_project/status', async (req, res) => {
  const { no_project } = req.params;
  const { status } = req.body;
  if (typeof status !== 'string' || !['Active', 'Inactive'].includes(status)) {
    return res.status(400).json({ error: "status debe ser 'Active' o 'Inactive'" });
  }
  try {
    const result = await pool.query(
      'UPDATE project SET status = $1 WHERE no_project = $2',
      [status, no_project]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    // Si se desactiva, mover material disponible a AUT-STOCK
    if (status === 'Inactive') {
      // Cambia el no_project en stock a 'AUT-STOCK' solo para material disponible
      const updateStock = await pool.query(
        `UPDATE stock SET no_project = 'AUT-STOCK'
         WHERE no_project = $1 AND available > 0`,
        [no_project]
      );
    }

    res.json({ message: `Proyecto ${status === 'Active' ? 'activado' : 'desactivado'} exitosamente` });
  } catch (error) {


    res.status(500).json({ error: 'Error al actualizar estado del proyecto' });
  }
});

app.get('/api/networks', async (req, res) => {
  try {
    const result = await pool.query('SELECT network, balance, initial_balance, currency FROM network ORDER BY network');
    res.json(result.rows);
  } catch (error) {


    res.status(500).json({ error: 'Error al cargar networks' });
  }
});

app.get('/api/purchases', async (req, res) => {
  try {
    const { projectId } = req.query;

    let query = `
      SELECT
        pr.name_project AS project_name,
        pr.no_project AS no_project,
        pr.status AS project_status,
        bp.no_qis,
        p.no_part,
        p.description,
        pd.vendor_name,
        COALESCE(pd.quantity, bp.quantity_project) AS quantity,
        bp.status,
        pd.time_delivered_product,
        COALESCE(pd.price_unit, 0) AS price_unit,
        COALESCE(pd.total_amount, 0) AS total_amount,
        pd.network,
        pd.id_purchase,
        pd.po,
        pd.shopping
      FROM bom_project bp
      JOIN project pr ON bp.no_project = pr.no_project
      JOIN product p ON bp.no_part = p.no_part
      LEFT JOIN LATERAL (
        SELECT 
          pd.quantity,
          pd.time_delivered_product,
          pd.price_unit,
          (pd.quantity * pd.price_unit) AS total_amount,
          v.name_vendor AS vendor_name,
          pu.network,
          pu.id_purchase,
          pu.po AS po,
          pu.shopping AS shopping
        FROM purchase_detail pd
        JOIN purchase pu ON pu.id_purchase = pd.id_purchase
        LEFT JOIN vendor v ON pu.id_vendor = v.id_vendor
        WHERE pu.no_project = bp.no_project
          AND pd.no_part = bp.no_part
        ORDER BY pu.id_purchase DESC
        LIMIT 1
      ) pd ON TRUE
    `;

    const params = [];
    if (projectId) {
      query += ` WHERE pr.no_project::text = $1`;
      params.push(projectId);
    }

    query += ` ORDER BY pr.no_project, p.no_part`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {


    res.status(500).json({ error: 'Error al cargar las compras' });
  }
});

// Endpoint para actualizar el status de un item en bom_project y campos en purchase
app.put('/api/purchases/status', async (req, res) => {
  const { no_project, no_part, status, po, shopping, id_purchase } = req.body;

  if (!no_project || !no_part || !status || !id_purchase) {
    return res.status(400).json({ message: 'no_project, no_part, status e id_purchase son requeridos' });
  }

  try {
    // Actualizar status en bom_project para todos los ítems relacionados a la compra
    const bomResult = await pool.query(
      `UPDATE bom_project SET status = $1 
       WHERE no_project = $2 
         AND no_part IN (SELECT no_part FROM purchase_detail WHERE id_purchase = $3)
       RETURNING *`,
      [status, no_project, id_purchase]
    );

    // Si no hubo coincidencias, informar pero no romper la operación
    if (bomResult.rows.length === 0) {


    }

    // Actualizar po en purchase (por compra) si se proporciona
    if (po !== undefined) {
      await pool.query(
        `UPDATE purchase SET po = $1 WHERE id_purchase = $2`,
        [po, id_purchase]
      );
    }

    // Actualizar shopping en purchase (por compra) si se proporciona
    if (shopping !== undefined) {
      await pool.query(
        `UPDATE purchase SET shopping = $1 WHERE id_purchase = $2`,
        [shopping, id_purchase]
      );
    }

    res.json({ message: 'Status y campos actualizados exitosamente', item: bomResult.rows[0] });
  } catch (error) {


    res.status(500).json({ message: 'Error al actualizar el status', error: error.message });
  }
});

//  Multiples productos en una compra
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
      const { no_part, quantity, price_unit, time_delivered_product } = producto;

      await client.query(
        `INSERT INTO purchase_detail
     (quantity, price_unit, id_purchase, no_part, time_delivered_product)
     VALUES ($1, $2, $3, $4, $5)`,
        [
          Number.isFinite(parseFloat(quantity)) ? parseFloat(quantity) : 0,
          parseFloat(price_unit),
          id_purchase,
          no_part,
          time_delivered_product
        ]
      );

      await client.query(
        `UPDATE bom_project
     SET status = $1
     WHERE no_project = $2
       AND no_part = $3`,
        [status, no_project, no_part]
      );
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


    res.status(500).json({ success: false, error: 'Error saving purchase: ' + error.message });
  } finally {
    client.release();
  }
});

// Ruta para obtener el balance de una network 
app.get('/api/network/balance/:network', async (req, res) => {
  try {
    const { network } = req.params;
    const result = await pool.query('SELECT network, balance, initial_balance, currency FROM network WHERE network = $1', [network]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Network not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {


    res.status(500).json({ error: 'Error al cargar el balance de la network' });
  }
});

// Endpoint para crear una nueva network
app.post('/api/networks', async (req, res) => {
  try {
    const { network, balance, currency } = req.body;
    
    if (!network) {
      return res.status(400).json({ error: 'Network name is required' });
    }

    const balanceValue = parseFloat(balance) || 0;
    const currencyValue = String(currency || 'USD').trim().toUpperCase();

    if (!['USD', 'MXN'].includes(currencyValue)) {
      return res.status(400).json({ error: 'Currency must be USD or MXN' });
    }

    // Verificar si la network ya existe
    const checkResult = await pool.query('SELECT network FROM network WHERE network = $1', [network]);
    if (checkResult.rows.length > 0) {
      return res.status(409).json({ error: 'Network already exists' });
    }

    // Insertar nueva network
    const result = await pool.query(
      'INSERT INTO network (network, initial_balance, balance, currency) VALUES ($1, $2, $3, $4) RETURNING network, initial_balance, balance, currency',
      [network, balanceValue, balanceValue, currencyValue]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {


    res.status(500).json({ error: 'Error creating network' });
  }
});

// Endpoint para actualizar una network
app.put('/api/networks/:network', async (req, res) => {
  try {
    const { network } = req.params;
    const { newNetwork, balance, currency } = req.body;

    // Verificar que la network existe
    const checkResult = await pool.query('SELECT network FROM network WHERE network = $1', [network]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Network not found' });
    }

    const networkValue = newNetwork || network;
    const balanceValue = parseFloat(balance);
    const currencyValue = String(currency || 'USD').trim().toUpperCase();

    if (isNaN(balanceValue)) {
      return res.status(400).json({ error: 'Invalid balance value' });
    }

    if (!['USD', 'MXN'].includes(currencyValue)) {
      return res.status(400).json({ error: 'Currency must be USD or MXN' });
    }

    // Si se cambió el nombre de la network, verificar que no exista otra con ese nombre
    if (newNetwork && newNetwork !== network) {
      const duplicateCheck = await pool.query('SELECT network FROM network WHERE network = $1', [newNetwork]);
      if (duplicateCheck.rows.length > 0) {
        return res.status(409).json({ error: 'Network name already exists' });
      }
    }

    // Actualizar network
    const result = await pool.query(
      'UPDATE network SET network = $1, balance = $2, currency = $3 WHERE network = $4 RETURNING network, initial_balance, balance, currency',
      [networkValue, balanceValue, currencyValue, network]
    );

    res.json(result.rows[0]);
  } catch (error) {


    res.status(500).json({ error: 'Error updating network' });
  }
});

// Endpoint para eliminar una network
app.delete('/api/networks/:network', async (req, res) => {
  try {
    const { network } = req.params;

    // Verificar que la network existe
    const checkResult = await pool.query('SELECT network FROM network WHERE network = $1', [network]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Network not found' });
    }

    // Evitar eliminar una network ya usada en compras
    const usageResult = await pool.query(
      'SELECT COUNT(*)::int AS total FROM purchase WHERE network = $1',
      [network]
    );
    const totalPurchasesUsingNetwork = usageResult.rows[0]?.total || 0;
    if (totalPurchasesUsingNetwork > 0) {
      return res.status(409).json({
        error: `Cannot delete network "${network}" because it is used in ${totalPurchasesUsingNetwork} purchase(s).`
      });
    }

    // Eliminar network
    await pool.query('DELETE FROM network WHERE network = $1', [network]);

    res.json({ message: 'Network deleted successfully' });
  } catch (error) {
    if (error?.code === '23503') {
      return res.status(409).json({
        error: `Cannot delete network "${req.params.network}" because it is referenced by other records.`
      });
    }

    res.status(500).json({ error: 'Error deleting network' });
  }
});

// Endpoint para obtener cantidad_calculada de paquetes para un proyecto y no_part
app.get('/api/paquetes-calculados', async (req, res) => {
  const { no_project, no_part } = req.query;
  if (!no_project || !no_part) {
    return res.status(400).json({ error: 'Faltan parámetros no_project o no_part' });
  }
  try {
    // Buscar quantity_project en bom_project
    const bomResult = await pool.query(
      'SELECT quantity_project FROM bom_project WHERE no_project = $1 AND no_part = $2',
      [no_project, no_part]
    );
    if (bomResult.rows.length === 0) {
      return res.status(404).json({ error: 'No existe BOM para este proyecto y parte' });
    }
    const quantity_project = bomResult.rows[0].quantity_project;
    // Buscar quantity en product
    const productResult = await pool.query(
      'SELECT quantity FROM product WHERE no_part = $1',
      [no_part]
    );
    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'No existe producto para este no_part' });
    }
    const quantity = productResult.rows[0].quantity;
    // Calcular cantidad_calculada y redondear hacia arriba
    const cantidad_calculada = Math.ceil(quantity_project / quantity);
    res.json({ cantidad_calculada });
  } catch (error) {


    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// ======================================================
// PROJECTS - obtener proyectos con movimientos
// ======================================================
app.get('/api/projects/with-movements', async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT s.no_project
      FROM movements m
      JOIN stock s ON m.id_stock = s.id_stock
      WHERE s.no_project IS NOT NULL
      ORDER BY s.no_project
    `;
    const result = await pool.query(query);
    res.json(result.rows.map(r => r.no_project));
  } catch (error) {


    res.status(500).json({ error: "Error fetching projects" });
  }
});

// ======================================================
// STOCK - por proyecto (desglosado, solo INBOUND)
// ======================================================
app.get('/api/stock/by-project', async (req, res) => {
  try {
    const { no_project } = req.query;
    if (!no_project) return res.status(400).json({ error: 'no_project requerido' });

    const query = `
      SELECT
        s.id_stock,
        s.rack,
        s.available,
        p.no_part,
        p.brand,
        p.description,
        p.quantity AS product_quantity,
        p.unit,
        p.type_p,
        pd_info.price_unit,
        pd_info.pd_quantity,
        (pd_info.price_unit * pd_info.pd_quantity) AS subtotal,
        pd_info.status,
        pd_info.network,
        pd_info.balance,
        pd_info.name_vendor,
        pr.name_project,
        pd_info.currency,
        pd_info.time_delivered,
        pd_info.pr,
        pd_info.shopping,
        pd_info.po,
        pd_info.pd_quantity AS cantidad_entrada,
        (SELECT COUNT(*) FROM movements m 
         WHERE m.id_stock = s.id_stock AND m.type_movement = 'INBOUND') AS cantidad_disponible,
        pd_info.no_qis
      FROM stock s
      JOIN product p ON s.no_part = p.no_part
      LEFT JOIN LATERAL (
        SELECT
          pd.price_unit,
          pd.quantity AS pd_quantity,
          bp.status,
          n.network,
          n.balance,
          v.name_vendor,
          pu.currency,
          pu.time_delivered,
          pu.pr,
          pu.shopping,
          pu.po,
          bp.no_qis
        FROM purchase_detail pd
        JOIN purchase pu ON pd.id_purchase = pu.id_purchase
        LEFT JOIN bom_project bp ON bp.no_project = pu.no_project AND bp.no_part = pd.no_part
        LEFT JOIN vendor v ON pu.id_vendor = v.id_vendor
        LEFT JOIN network n ON pu.network = n.network
        WHERE pd.no_part = s.no_part
          AND pu.no_project = s.no_project
        ORDER BY pu.id_purchase DESC
        LIMIT 1
      ) pd_info ON TRUE
      LEFT JOIN project pr ON s.no_project = pr.no_project
      WHERE s.no_project = $1
        AND EXISTS (
          SELECT 1 FROM movements m 
          WHERE m.id_stock = s.id_stock AND m.type_movement = 'INBOUND'
        )
      ORDER BY s.id_stock DESC
    `;
    const result = await pool.query(query, [no_project]);
    res.json(result.rows);
  } catch (error) {


    res.status(500).json({ error: "Error fetching stock by project" });
  }
});

// ======================================================
// STOCK - distinct filters from stock table (projects, vendors, parts, brands)
// ======================================================
app.get('/api/stock/distinct-filters', async (req, res) => {
  try {
    // projects from stock joined to purchase->project when available
    const projectsQuery = `
      SELECT DISTINCT s.no_project, pr.name_project
      FROM stock s
      LEFT JOIN project pr ON s.no_project = pr.no_project
      WHERE s.no_project IS NOT NULL
        AND pr.status LIKE 'Active'
       AND pr.name_project NOT ILIKE '%STOCK_AVAILABLE%'
      ORDER BY pr.name_project NULLS LAST, s.no_project
    `;
    const vendorsQuery = `
      SELECT DISTINCT v.name_vendor
      FROM purchase pu
      JOIN purchase_detail pd ON pd.id_purchase = pu.id_purchase
      JOIN vendor v ON pu.id_vendor = v.id_vendor
      JOIN stock s ON pd.no_part = s.no_part
      WHERE v.name_vendor IS NOT NULL
      ORDER BY v.name_vendor
    `;
    const partsQuery = `
      SELECT DISTINCT s.no_part
      FROM stock s
      WHERE s.no_part IS NOT NULL
      ORDER BY s.no_part
    `;
    const brandsQuery = `
      SELECT DISTINCT p.brand
      FROM stock s
      JOIN product p ON s.no_part = p.no_part
      WHERE p.brand IS NOT NULL
      ORDER BY p.brand
    `;

    const [projectsRes, vendorsRes, partsRes, brandsRes] = await Promise.all([
      pool.query(projectsQuery),
      pool.query(vendorsQuery),
      pool.query(partsQuery),
      pool.query(brandsQuery)
    ]);

    res.json({
      projects: projectsRes.rows.map(r => ({ no_project: r.no_project, name_project: r.name_project })),
      vendors: vendorsRes.rows.map(r => r.name_vendor),
      parts: partsRes.rows.map(r => r.no_part),
      brands: brandsRes.rows.map(r => r.brand)
    });
  } catch (error) {


    res.status(500).json({ error: 'Error fetching distinct stock filters' });
  }
});

// ======================================================
// STOCK - resumen por no_part (solo con movimientos)
// Cantidad disponible = INBOUND - OUTBOUND global
// ======================================================
app.get('/api/stock/summary', async (req, res) => {
  try {
    const query = `
      SELECT
        p.no_part,
        p.brand,
        p.description,
        p.quantity AS product_quantity,
        p.unit,
        p.type_p,
        COUNT(DISTINCT s.id_stock) AS total_records,
        COALESCE(
          COUNT(CASE WHEN m.type_movement = 'INBOUND' THEN 1 END) -
          COUNT(CASE WHEN m.type_movement = 'OUTBOUND' THEN 1 END),
          0
        )::INTEGER AS cantidad_disponible,
        NULL AS price_unit,
        NULL AS pd_quantity,
        NULL AS subtotal,
        NULL AS status,
        NULL AS network,
        NULL AS balance,
        NULL AS name_vendor,
        NULL AS name_project,
        NULL AS currency,
        NULL AS time_delivered,
        NULL AS pr,
        NULL AS shopping,
        NULL AS po,
        NULL AS cantidad_entrada,
        MIN(s.id_stock) AS id_stock,
        MIN(s.rack) AS rack,
        SUM(DISTINCT s.available) AS available,
        COALESCE(MIN(bp.no_qis), '') AS no_qis
      FROM movements m
      JOIN stock s ON m.id_stock = s.id_stock
      JOIN product p ON s.no_part = p.no_part
      LEFT JOIN bom_project bp ON bp.no_project = s.no_project AND bp.no_part = s.no_part
      
      GROUP BY p.no_part, p.brand, p.description, p.quantity, p.unit, p.type_p
      ORDER BY MAX(m.date_movement) DESC
    `;

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {


    res.status(500).json({ error: "Error fetching stock summary" });
  }
});

app.get("/api/stock", async (req, res) => {
  try {
    const query = `
      SELECT
        MIN(s.id_stock) AS id_stock,
        MIN(s.rack) AS rack,
        SUM(s.available) AS available,
        p.no_part,
        p.brand,
        p.description,
        p.quantity AS product_quantity,
        p.unit,
        p.type_p,
        COUNT(s.id_stock)::INTEGER AS cantidad_disponible,
        NULL AS price_unit,
        NULL AS pd_quantity,
        NULL AS subtotal,
        NULL AS status,
        NULL AS network,
        NULL AS balance,
        NULL AS name_vendor,
        NULL AS name_project,
        NULL AS currency,
        NULL AS time_delivered,
        NULL AS pr,
        NULL AS shopping,
        NULL AS po,
        NULL AS cantidad_entrada,
        COALESCE(MIN(bp.no_qis), '') AS no_qis
      FROM stock s
      JOIN product p ON s.no_part = p.no_part
      LEFT JOIN bom_project bp ON s.no_part = bp.no_part
      GROUP BY p.no_part, p.brand, p.description, p.quantity, p.unit, p.type_p
      ORDER BY MIN(s.id_stock) DESC
    `;

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {


    res.status(500).json({ error: "Error fetching stock data" });
  }
});


app.get("/api/stock/qr-code", async (req, res) => {
  const { no_part, no_project } = req.query;

  if (!no_part || !no_project) {
    return res.status(400).json({
      error: 'Parámetros requeridos: no_part, no_project'
    });
  }

  try {
    const normalizedNoPart = String(no_part).trim();
    const normalizedNoProject = String(no_project).trim();

    if (!normalizedNoPart || !normalizedNoProject) {
      return res.status(400).json({
        error: 'Parámetros requeridos: no_part, no_project'
      });
    }

    // Buscar QR solo por no_part y no_project (sin rack)
    const query = `
      SELECT id_stock, qr_code, no_part, no_project, rack, available
      FROM stock
      WHERE LOWER(BTRIM(no_part)) = LOWER($1)
        AND LOWER(BTRIM(CAST(no_project AS TEXT))) = LOWER($2)
      ORDER BY id_stock ASC
      LIMIT 1
    `;

    const result = await pool.query(query, [normalizedNoPart, normalizedNoProject]);

    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.json({ qr_code: null });
    }
  } catch (error) {


    res.status(500).json({ error: 'Error al obtener el código QR' });
  }
});

// Endpoint para obtener el primer rack usado en un proyecto
app.get("/api/stock/first-rack", async (req, res) => {
  const { no_project } = req.query;

  if (!no_project) {
    return res.status(400).json({
      error: 'Parámetro requerido: no_project'
    });
  }

  try {
    const query = `
      SELECT rack
      FROM stock
      WHERE no_project = $1
      ORDER BY id_stock ASC
      LIMIT 1
    `;

    const result = await pool.query(query, [no_project]);

    if (result.rows.length > 0) {
      res.json({ rack: result.rows[0].rack });
    } else {
      res.json({ rack: null });
    }
  } catch (error) {


    res.status(500).json({ error: 'Error al obtener el rack' });
  }
});

app.post("/api/stock/entry", async (req, res) => {
  const { rack, no_part, no_project } = req.body;

  const normalizedRack = String(rack || '').trim();
  const normalizedNoPart = String(no_part || '').trim();
  const normalizedNoProject = String(no_project || '').trim();

  if (!normalizedRack || !normalizedNoPart || !normalizedNoProject) {
    return res.status(400).json({ 
      success: false, 
      error: 'Faltan datos requeridos (rack, no_part, no_project)' 
    });
  }

  try {
    // Siempre conservar el proyecto recibido y usar formato I####-PROYECTO.
    const projectToStore = normalizedNoProject;
    
    // Buscar por no_part y no_project (SIN rack) para verificar si ya existe
    const checkQuery = `
      SELECT * FROM stock
      WHERE LOWER(BTRIM(no_part)) = LOWER($1)
        AND LOWER(BTRIM(CAST(no_project AS TEXT))) = LOWER($2)
      ORDER BY id_stock ASC
      LIMIT 1
    `;

    const existingResult = await pool.query(checkQuery, [normalizedNoPart, projectToStore]);

    if (existingResult.rows.length > 0) {
      // Si ya existe el registro de stock para este no_part+no_project,
      // no incrementamos disponible al generar el QR. Simplemente devolvemos el registro.

      return res.json({
        success: true,
        message: 'QR ya existente, no se modificó available',
        data: existingResult.rows[0]
      });
    }

    // Generar código QR con formato I000N-PROYECTO.
    const lastQrQuery = `
      SELECT qr_code FROM stock 
      WHERE qr_code LIKE $1
      ORDER BY id_stock DESC 
      LIMIT 1
    `;

    const pattern = `I%-${normalizedNoProject}`;
    const lastQrResult = await pool.query(lastQrQuery, [pattern]);

    let nextNumber = 1; 
    if (lastQrResult.rows.length > 0 && lastQrResult.rows[0].qr_code) {
      const lastCode = lastQrResult.rows[0].qr_code;
      const match = lastCode.match(/^I(\d+)-/);
      if (match && match[1]) {
        const lastNumber = parseInt(match[1]);
        if (!isNaN(lastNumber)) {
          nextNumber = lastNumber + 1;
        }
      }
    }

    const consecutivo = String(nextNumber).padStart(4, '0');
    const qrCode = `I${consecutivo}-${normalizedNoProject}`;

    // Insertar en la tabla stock con el proyecto recibido.
    const query = `
      INSERT INTO stock (rack, no_part, no_project, qr_code, available)
      VALUES ($1, $2, $3, $4, 0)
      RETURNING id_stock, rack, no_part, no_project, qr_code, available
    `;

    const result = await pool.query(query, [normalizedRack, normalizedNoPart, projectToStore, qrCode]);


    res.json({
      success: true,
      message: 'Entrada en stock registrada exitosamente',
      data: result.rows[0]
    });
  } catch (error) {


    res.status(500).json({ 
      success: false, 
      error: 'Error al crear entrada en stock: ' + error.message 
    });
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

// Función para generar número de parte basado en la descripción
function generatePartNumber(description, index) {
  if (!description) return `AUTO-${Date.now()}-${index}`;
  
  // Convertir a string y eliminar vocales y caracteres especiales de la descripción
  const cleanDesc = String(description)
    .toUpperCase()
    .replace(/[AEIOUÁÉÍÓÚ\s]/g, '')
    .replace(/[^A-Z0-9]/g, '')
    .substring(0, 8);
  
  // Crear un identificador único: consonantes de descripción + timestamp reducido + índice
  const timestamp = Date.now().toString().slice(-3);
  const uniqueId = `${cleanDesc || 'AUTO'}${timestamp}${String(index).padStart(2, '0')}`;
  
  return uniqueId;
}

// Ruta para obtener proyectos activos
app.get("/api/projects/active", async (req, res) => {
  try {
    const result = await pool.query("SELECT no_project, name_project FROM Project WHERE status ILIKE 'active'");
    res.json(result.rows);
  } catch (error) {


    res.status(500).json({ error: 'Error al cargar proyectos activos' });
  }
});

// Ruta POST para crear un nuevo proyecto
app.post("/api/projects", async (req, res) => {
  const { no_project, name_project, status } = req.body;

  if (!no_project || !name_project) {
    return res.status(400).json({ message: "no_project y name_project son requeridos" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO project (no_project, name_project, status)
       VALUES ($1, $2, $3)
       RETURNING no_project, name_project, status`,
      [no_project, name_project, status || 'Active']
    );
    res.json({ message: "Proyecto creado exitosamente", project: result.rows[0] });
  } catch (error) {


    res.status(500).json({ message: "Error al crear el proyecto", error: error.message });
  }
});

function normalizeText(value) {
  if (value === null || value === undefined) return null;

  return value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

// Ruta POST para subir BOM (archivo Excel)
app.post('/api/bom', upload.single('file'), async (req, res) => {
  const client = await pool.connect();
  const { no_project, updateMode } = req.body;
  if (!no_project) return res.status(400).json({ message: "Select a project" });
  if (!req.file) return res.status(400).json({ message: "No file was uploaded" });

  try {
    await client.query('BEGIN');

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

    // Recolectar los números de parte del nuevo BOM
    const newPartNumbers = [];
    let addedItemsCount = 0;

    // Si está en updateMode, obtener las partes existentes
    let existingParts = new Set();
    if (updateMode === 'true') {
      const existingResult = await client.query(
        `SELECT no_part FROM bom_project WHERE no_project = $1`,
        [no_project]
      );
      // Normalizar los no_part para comparación correcta y filtrar nulos
      existingParts = new Set(existingResult.rows
        .filter(row => row.no_part !== null && row.no_part !== undefined)
        .map(row => row.no_part.toString().toUpperCase().trim()));
    }

    // Procesar cada fila
    for (let idx = 0; idx < data.length; idx++) {
      const rowObj = data[idx];
      let no_part = normalizeText(pick(rowObj, ["no_parte", "numero_de_parte", "part_number"]));
      const rawDescription = pick(rowObj, ["producto", "description", "descripcion"]);
      const description = normalizeText(rawDescription);
      
      // Si no hay número de parte, intentar encontrar por descripción en updateMode
      if (!no_part) {
        if (updateMode === 'true' && description) {
          // En modo actualización, buscar por descripción exacta o similar
          const descResult = await client.query(
            `SELECT no_part FROM product 
             WHERE UPPER(TRIM(description)) = $1 
             LIMIT 1`,
            [description]
          );
          
          if (descResult.rows.length > 0) {
            // Encontró producto con descripción igual, usar su no_part
            no_part = descResult.rows[0].no_part;
          } else {
            // No encontró, generar uno nuevo
            no_part = generatePartNumber(rawDescription, idx);
          }
        } else {
          // Modo regular o sin descripción: generar número de parte
          no_part = generatePartNumber(rawDescription, idx);
        }
      }

      newPartNumbers.push(no_part);
      let brand = normalizeText(pick(rowObj, ["marca", "brand"]));
      // Si no tiene marca, agregarla como OTRA
      if (!brand || brand.trim() === '') {
        brand = 'OTRA';
      }
      const quantity = toInt(pick(rowObj, ["cantidad_venta", "quantity", "qty"]));
      const unit = normalizeText(pick(rowObj, ["unidad", "unit"]));
      const type_p = normalizeText(pick(rowObj, ["tipo", "type"]));
      const quantity_p = toInt(pick(rowObj, ["cantidad_solicitada", "cantidad_proyecto"]));

      // Insertar producto si no existe
      await client.query(
        `INSERT INTO product (no_part, brand, description, quantity, unit, type_p)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (no_part) DO NOTHING`,
        [no_part, brand, description, quantity, unit, type_p]
      );

      // Verificar si la parte ya existe en el BOM del proyecto
      const partExists = existingParts.has(no_part);

      if (updateMode === 'true') {
        // Modo actualización: solo agregar items nuevos (no repetidos)
        if (!partExists) {
          // Parte nueva: insertarla
          if (quantity_p !== null) {
            await client.query(
              `INSERT INTO bom_project (no_project, quantity_project, no_part, status)
               VALUES ($1, $2, $3, $4)`,
              [no_project, quantity_p, no_part, "Quoted"]
            );
            addedItemsCount++;
            // Agregar a existingParts para evitar duplicados en el mismo archivo
            existingParts.add(no_part);
          }
        } else {
          // Parte ya existe: actualizar cantidad en updateMode
          if (quantity_p !== null) {
            await client.query(
              `UPDATE bom_project 
               SET quantity_project = $1
               WHERE no_project = $2 AND no_part = $3`,
              [quantity_p, no_project, no_part]
            );
          }
        }
      } else {
        // Modo regular: comportamiento anterior (reemplazar todo)
        if (partExists) {
          // Parte ya existe: actualizar solo quantity_project, mantener el status
          await client.query(
            `UPDATE bom_project 
             SET quantity_project = $1
             WHERE no_project = $2 AND no_part = $3`,
            [quantity_p, no_project, no_part]
          );
        } else {
          // Parte nueva: insertarla
          if (quantity_p !== null) {
            await client.query(
              `INSERT INTO bom_project (no_project, quantity_project, no_part, status)
               VALUES ($1, $2, $3, $4)`,
              [no_project, quantity_p, no_part, "Quoted"]
            );
          }
        }
      }
    }

    // Solo eliminar partes si NO está en updateMode
    if (updateMode !== 'true') {
      // Eliminar partes que NO están en el nuevo BOM
      if (newPartNumbers.length > 0) {
        await client.query(
          `DELETE FROM bom_project 
           WHERE no_project = $1 AND no_part != ALL($2::text[])`,
          [no_project, newPartNumbers]
        );
      } else {
        // Si el nuevo BOM está vacío, eliminar todo el BOM anterior
        await client.query(
          `DELETE FROM bom_project WHERE no_project = $1`,
          [no_project]
        );
      }
    }

    await client.query('COMMIT');
    
    // Retornar respuesta diferenciada según el modo
    if (updateMode === 'true') {
      res.json({ 
        message: `File processed successfully for the project ${no_project}`,
        addedItems: addedItemsCount
      });
    } else {
      res.json({ message: `File processed successfully for the project ${no_project}` });
    }
  } catch (err) {
    await client.query('ROLLBACK');


    res.status(500).json({ message: "Error processing file", error: String(err) });
  } finally {
    client.release();
  }
});
// Eliminar BOM de un proyecto
app.delete("/api/bom/:no_project", async (req, res) => {
  const { no_project } = req.params;

  try {
    await pool.query('DELETE FROM bom_project WHERE no_project = $1', [no_project]);
    res.json({ message: `BOM deleted successfully for project ${no_project}` });
  } catch (err) {


    res.status(500).json({ message: "Error deleting BOM", error: String(err) });
  }
});


// Visualización de Materiales por Proyecto)
app.get('/api/bomView', async (req, res) => {
  const noProject = req.query.no_project;
  try {
    let query =
      `SELECT 
              pr.name_project,
              bp.no_qis,
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
      query += ` WHERE pr.no_project::text = $1`;
      queryParams.push(String(noProject));
    }

    query += ` ORDER BY pr.name_project, p.no_part`;

    const result = await pool.query(query, queryParams);
    res.json(result.rows);
  } catch (error) {


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

app.get('/requisition.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'requisition.html'));
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

    const normalizedProjectId = String(projectId || '').trim() || null;

    const sql = `
      WITH filtered_purchases AS (
        SELECT pu.id_purchase, pu.no_project, pu.network
        FROM purchase pu
        WHERE ($1::text IS NULL OR pu.no_project::text = $1)
      ),
      spent_data AS (
        SELECT COALESCE(SUM(pd.quantity * pd.price_unit), 0) AS total_gastado
        FROM purchase_detail pd
        JOIN filtered_purchases fp ON fp.id_purchase = pd.id_purchase
      ),
      network_data AS (
        SELECT
          COALESCE(SUM(n.balance), 0) AS balance_actual,
          COALESCE(SUM(n.initial_balance), 0) AS saldo_inicial_estimado
        FROM (
          SELECT DISTINCT fp.network
          FROM filtered_purchases fp
          WHERE fp.network IS NOT NULL
            AND BTRIM(CAST(fp.network AS TEXT)) <> ''
        ) nw
        JOIN network n ON n.network = nw.network
      ),
      finance_data AS (
        SELECT
          sd.total_gastado,
          nd.balance_actual,
          nd.saldo_inicial_estimado
        FROM spent_data sd
        CROSS JOIN network_data nd
      ),
      status_data AS (
        SELECT
          COUNT(*) FILTER (WHERE bp.status = 'PO') * 100.0 / NULLIF(COUNT(*),0) AS porcentaje_po,
          COUNT(*) FILTER (WHERE bp.status = 'PR') * 100.0 / NULLIF(COUNT(*),0) AS porcentaje_pr,
          COUNT(*) FILTER (WHERE bp.status = 'Shopping cart') * 100.0 / NULLIF(COUNT(*),0) AS porcentaje_shopping,
          COUNT(*) FILTER (WHERE bp.status = 'Delivered to BRK') * 100.0 / NULLIF(COUNT(*),0) AS porcentaje_entregado,
          COUNT(*) FILTER (WHERE bp.status = 'Quoted') * 100.0 / NULLIF(COUNT(*),0) AS porcentaje_cotizado
        FROM filtered_purchases fp
        JOIN purchase_detail pd ON fp.id_purchase = pd.id_purchase
        JOIN bom_project bp
          ON bp.no_project = fp.no_project
         AND bp.no_part = pd.no_part
      )
      SELECT
        sd.porcentaje_po,
        sd.porcentaje_pr,
        sd.porcentaje_shopping,
        sd.porcentaje_entregado,
        sd.porcentaje_cotizado,
        CASE
          WHEN fd.saldo_inicial_estimado > 0
            THEN (fd.total_gastado * 100.0 / fd.saldo_inicial_estimado)
          ELSE 0
        END AS porcentaje_gastado,
        fd.total_gastado,
        fd.balance_actual,
        fd.saldo_inicial_estimado
      FROM status_data sd
      CROSS JOIN finance_data fd
    `;

    const result = await pool.query(sql, [normalizedProjectId]);
    res.json(result.rows[0] || {});
  } catch (error) {


    res.status(500).json({ error: 'Error al cargar porcentajes' });
  }
});
// Obtener solo proyectos que ya tienen compras registradas
app.get('/api/projects-with-purchase', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT
        pr.no_project,
        pr.name_project
      FROM project pr
      WHERE EXISTS (
        SELECT 1
        FROM purchase pu
        INNER JOIN purchase_detail pd ON pd.id_purchase = pu.id_purchase
        WHERE pu.no_project = pr.no_project
          AND pd.no_part IS NOT NULL
      )
      ORDER BY pr.name_project
    `);

    res.json(result.rows);
  } catch (error) {


    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Obtener proyectos que tienen productos en status "PO"
app.get(['/api/projects-po', '/api/projects-shopping-cart'], async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT
        pr.no_project,
        pr.name_project,
        pr.status
      FROM project pr
      INNER JOIN purchase pu ON pu.no_project = pr.no_project
      INNER JOIN purchase_detail pd ON pd.id_purchase = pu.id_purchase
      INNER JOIN bom_project bp ON bp.no_project = pr.no_project AND bp.no_part = pd.no_part
      WHERE (bp.status ILIKE 'PO' OR bp.status ILIKE 'Pending Delivery' OR bp.status ILIKE 'Delivered')
        AND pd.no_part IS NOT NULL
      ORDER BY pr.status DESC, pr.name_project
    `);

    res.json(result.rows);
  } catch (error) {


    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});


app.get('/api/bomView/debug', async (req, res) => {
  const noProject = req.query.no_project;


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
      query += ` WHERE pr.no_project::text = $1`;
      params.push(String(noProject));
    }
    query += ` ORDER BY pr.no_project, p.no_part`;

    const result = await pool.query(query, params);
    res.json({ received: noProject ?? null, count: result.rows.length, sample: result.rows.slice(0, 5) });
  } catch (err) {


    res.status(500).json({ error: String(err) });
  }
});

// Endpoint para obtener inventario muerto (sin movimiento en 3 meses)
app.get('/api/dead-inventory', async (req, res) => {
  try {
    const deadQuery = `
      SELECT 
        p.no_part,
        p.description,
        SUM(s.available) AS available,
        MAX(m.date_movement) AS last_movement_date
      FROM stock s
      JOIN product p ON s.no_part = p.no_part
      LEFT JOIN movements m ON s.id_stock = m.id_stock
      GROUP BY p.no_part, p.description
      HAVING MAX(m.date_movement) IS NULL OR MAX(m.date_movement) < NOW() - INTERVAL '3 months'
      ORDER BY MAX(m.date_movement) ASC
    `;
    
    const totalQuery = `
      SELECT 
        SUM(s.available) AS total_quantity,
        COUNT(DISTINCT p.no_part) AS total_items
      FROM stock s
      JOIN product p ON s.no_part = p.no_part
    `;
    
    const deadResult = await pool.query(deadQuery);
    const totalResult = await pool.query(totalQuery);
    
    const totalItems = totalResult.rows[0]?.total_items || 0;
    const totalQuantity = totalResult.rows[0]?.total_quantity || 0;
    
    res.json({
      deadInventory: deadResult.rows,
      totalItems: totalItems,
      totalQuantity: totalQuantity
    });
  } catch (error) {
    console.error('Error al obtener inventario muerto:', error);
    res.status(500).json({ error: 'Error al cargar inventario muerto' });
  }
});

app.listen(PORT, () => {


});
// ---------------------------
// Vendors table + endpoints
// ---------------------------
// Ensure vendors table exists
;(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vendor (
        id_vendor TEXT PRIMARY KEY,
        name_vendor TEXT,
        email TEXT,
        telephone TEXT
      )
    `);
  } catch (err) {
    console.warn('Could not ensure vendor table exists:', err.message);
  }
})();

// Get all vendors
app.get('/api/vendors', async (req, res) => {
  try {
    const result = await pool.query('SELECT id_vendor, name_vendor, email, telephone FROM vendor ORDER BY name_vendor');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener vendors', detail: String(err) });
  }
});

// Get vendor by id
app.get('/api/vendors/:id', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'id is required' });
    const result = await pool.query('SELECT id_vendor, name_vendor, email, telephone FROM vendor WHERE id_vendor = $1 LIMIT 1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Vendor not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener vendor', detail: String(err) });
  }
});

// Search vendors
app.get('/api/vendors/search', async (req, res) => {
  try {
    const field = String(req.query.field || 'all');
    const q = String(req.query.q || '').trim();

    if (!q) {
      const all = await pool.query('SELECT id_vendor, name_vendor, email, telephone FROM vendor ORDER BY name_vendor');
      return res.json(all.rows);
    }

    const like = `%${q}%`;
    let result;
    if (field === 'all') {
      result = await pool.query(
        `SELECT id_vendor, name_vendor, email, telephone FROM vendor WHERE id_vendor ILIKE $1 OR name_vendor ILIKE $1 OR email ILIKE $1 OR telephone ILIKE $1 ORDER BY name_vendor`,
        [like]
      );
    } else if (['id_vendor','name_vendor','email','telephone'].includes(field)) {
      const sql = `SELECT id_vendor, name_vendor, email, telephone FROM vendor WHERE ${field} ILIKE $1 ORDER BY name_vendor`;
      result = await pool.query(sql, [like]);
    } else {
      return res.status(400).json({ error: 'Invalid field' });
    }

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al buscar vendors', detail: String(err) });
  }
});

// Upsert vendor
app.post('/api/vendors', async (req, res) => {
  try {
    const { id_vendor, name_vendor, email, telephone } = req.body || {};
    const id = String(id_vendor || '').trim();
    const name = String(name_vendor || '').trim();

    if (!id || !name) return res.status(400).json({ error: 'id_vendor and name_vendor are required' });

    const sql = `
      INSERT INTO vendor (id_vendor, name_vendor, email, telephone)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id_vendor) DO UPDATE SET
        name_vendor = EXCLUDED.name_vendor,
        email = EXCLUDED.email,
        telephone = EXCLUDED.telephone
      RETURNING id_vendor, name_vendor, email, telephone
    `;

    const result = await pool.query(sql, [id, name, email || null, telephone || null]);
    res.json({ success: true, vendor: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Error saving vendor', detail: String(err) });
  }
});
// ======================================================
// STOCK - obtener cantidad disponible (INBOUND - OUTBOUND)
// ======================================================
app.get('/api/stock/available/:qr_code', async (req, res) => {
  try {
    const qr = (req.params.qr_code || '').toString().trim().toUpperCase();
    if (!qr) return res.status(400).json({ message: 'qr_code requerido' });

    // Buscar stock por qr_code (case-insensitive) y devolver datos incluyendo available actualizado
    const stockQ = `SELECT id_stock, no_part, no_project, rack, available FROM stock WHERE UPPER(qr_code) = $1 LIMIT 1`;
    const stockR = await pool.query(stockQ, [qr]);
    if (stockR.rows.length === 0) return res.status(404).json({ message: 'QR no encontrado' });
    const stock = stockR.rows[0];

    res.json({ 
      no_part: stock.no_part, 
      no_project: stock.no_project, 
      rack: stock.rack,
      available: stock.available 
    });
  } catch (err) {


    res.status(500).json({ message: 'Error en servidor', error: String(err) });
  }
});

// ======================================================
// GET existing rack for AUT-STOCK item by part number
// ======================================================
app.get('/api/stock/by-part-austocked/:noPart', async (req, res) => {
  try {
    const noPart = (req.params.noPart || '').toString().trim();
    if (!noPart) return res.status(400).json({ message: 'noPart requerido' });

    // Buscar si existe stock en AUT-STOCK con ese no_part
    const stockQ = `SELECT id_stock, no_part, no_project, rack, available FROM stock WHERE UPPER(BTRIM(no_part)) = UPPER(BTRIM($1)) AND no_project = 'AUT-STOCK' LIMIT 1`;
    const stockR = await pool.query(stockQ, [noPart]);
    
    if (stockR.rows.length === 0) {
      return res.status(404).json({ message: 'No AUT-STOCK record found for this part' });
    }
    
    const stock = stockR.rows[0];
    res.json({ 
      no_part: stock.no_part, 
      rack: stock.rack,
      available: stock.available 
    });
  } catch (err) {
    res.status(500).json({ message: 'Error en servidor', error: String(err) });
  }
});

// Buscar el mismo no_part en proyectos inactivos (excluyendo AUT-STOCK)
app.get('/api/stock/by-part-inactive/:noPart', async (req, res) => {
  try {
    const noPart = (req.params.noPart || '').toString().trim();
    if (!noPart) return res.status(400).json({ message: 'noPart requerido' });

    // Buscar si existe stock en proyectos inactivos con ese no_part (excluyendo AUT-STOCK)
    const stockQ = `
      SELECT s.id_stock, s.no_part, s.no_project, s.rack, s.available 
      FROM stock s
      INNER JOIN project p ON s.no_project = p.no_project
      WHERE UPPER(BTRIM(s.no_part)) = UPPER(BTRIM($1)) 
        AND s.no_project != 'AUT-STOCK'
        AND (p.status IS NULL OR UPPER(BTRIM(p.status)) != 'ACTIVE')
      LIMIT 1
    `;
    const stockR = await pool.query(stockQ, [noPart]);
    
    if (stockR.rows.length === 0) {
      return res.status(404).json({ message: 'No inactive project record found for this part' });
    }
    
    const stock = stockR.rows[0];
    res.json({ 
      no_part: stock.no_part, 
      rack: stock.rack,
      available: stock.available 
    });
  } catch (err) {
    res.status(500).json({ message: 'Error en servidor', error: String(err) });
  }
});

// ======================================================
// GET total available for AUT-STOCK items by part number
// Suma todos los disponibles con el mismo no_part en:
// - AUT-STOCK 
// - Proyectos inactivos
// ======================================================
app.get('/api/stock/available-austocked/:noPart', async (req, res) => {
  try {
    const noPart = (req.params.noPart || '').toString().trim();
    if (!noPart) return res.status(400).json({ message: 'noPart requerido' });

    // Sumar disponible de todos los registros AUT-STOCK y de proyectos inactivos con ese no_part
    const stockQ = `
      SELECT 
        no_part,
        COALESCE(SUM(available), 0) as total_available
      FROM stock 
      WHERE UPPER(BTRIM(no_part)) = UPPER(BTRIM($1)) 
        AND (
          no_project = 'AUT-STOCK'
          OR no_project IN (
            SELECT no_project FROM project 
            WHERE status IS NULL OR UPPER(BTRIM(status)) != 'ACTIVE'
          )
        )
      GROUP BY no_part
    `;
    const stockR = await pool.query(stockQ, [noPart]);
    
    if (stockR.rows.length === 0) {
      // Si no hay registros, devolver 0 disponible en lugar de un error
      return res.json({ 
        no_part: noPart,
        total_available: 0 
      });
    }
    
    const stock = stockR.rows[0];
    res.json({ 
      no_part: stock.no_part,
      total_available: stock.total_available
    });
  } catch (err) {
    res.status(500).json({ message: 'Error en servidor', error: String(err) });
  }
});

// ======================================================
// INBOUND - ESCANEO QR
// Busca el QR en stock y registra movimiento INBOUND
// ======================================================
app.post("/api/inbound", async (req, res) => {
  try {
    const { qr_code, cantidad } = req.body;
    const cantidadToAdd = parseInt(cantidad || 1, 10);
    const userPid = await requireMovementUserPid(req, res, '/api/inbound');
    if (!userPid) return;

    if (!Number.isFinite(cantidadToAdd) || cantidadToAdd < 1) {
      return res.status(400).json({
        ok: false,
        message: 'Cantidad invalida para entrada.'
      });
    }

    if (!qr_code || qr_code.trim() === "") {
      return res.status(400).json({
        ok: false,
        message: "QR vacío"
      });
    }

    const qrClean = qr_code.trim().toUpperCase();

    // 1) Buscar QR en stock
    const stockQuery = `
      SELECT id_stock, rack, available, no_part, no_project, qr_code
      FROM stock
      WHERE UPPER(qr_code) = $1
      LIMIT 1
    `;

    const stockResult = await pool.query(stockQuery, [qrClean]);

    if (stockResult.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        message: `QR no encontrado en Stock: ${qrClean}`
      });
    }

    const stockRow = stockResult.rows[0];
    const previousAvailable = stockRow.available || 0;

    // Extraer el no_project original del QR (formato: I000XXX-NO_PROJECT)
    const qrParts = qrClean.split('-');
    const originalProject = qrParts.length > 1 ? qrParts.slice(1).join('-') : stockRow.no_project;

    // 2) Check if project is INACTIVE - if so, ask for rack selection
    const projectCheck = await pool.query(
      'SELECT status FROM project WHERE LOWER(BTRIM(no_project)) = LOWER(BTRIM($1))',
      [originalProject]
    );

    const projectIsActive = projectCheck.rows.length > 0 && 
                           projectCheck.rows[0].status && 
                           projectCheck.rows[0].status.toUpperCase() === 'ACTIVE';

    // If project not found OR it's INACTIVE, need rack selection
    // Only for projects that are NOT already in AUT-STOCK
    const isProjectNotFound = projectCheck.rows.length === 0;
    const needsRack = (isProjectNotFound || !projectIsActive) && stockRow.no_project !== 'AUT-STOCK';

    if (needsRack) {
      return res.status(200).json({
        ok: true,
        needsRackSelection: true,
        message: 'Inactive project - rack selection required',
        stock: stockRow
      });
    }

    // 3) For ACTIVE projects or AUT-STOCK: process INBOUND normally
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // For AUT-STOCK projects, calculate TOTAL available BEFORE increment
      let totalAvailBefore = 0;
      if (stockRow.no_project === 'AUT-STOCK') {
        const totalAvailBeforeQuery = `
          SELECT COALESCE(SUM(available), 0) as total_available
          FROM stock
          WHERE UPPER(BTRIM(no_part)) = UPPER(BTRIM($1))
          AND (no_project = 'AUT-STOCK' OR no_project IN (
            SELECT no_project FROM project WHERE status IS NULL OR status != 'ACTIVE'
          ))
        `;
        const totalAvailBeforeResult = await client.query(totalAvailBeforeQuery, [stockRow.no_part]);
        totalAvailBefore = parseInt(totalAvailBeforeResult.rows[0]?.total_available || 0);
      }
      
      const updateQ = `UPDATE stock SET available = available + $1 WHERE id_stock = $2 RETURNING available`;
      const updR = await client.query(updateQ, [cantidadToAdd, stockRow.id_stock]);
      const newAvailable = updR.rows[0] ? updR.rows[0].available : stockRow.available;
      let overEntry = null;

      const movementQuery = `
        INSERT INTO movements (date_movement, type_movement, id_stock, pid)
        VALUES (NOW(), 'INBOUND', $1, $2)
        RETURNING id_movement, date_movement, type_movement, id_stock, pid
      `;
      const movementResult = await client.query(movementQuery, [stockRow.id_stock, userPid]);

      // Process ACTIVE projects
      if (projectIsActive) {
        const bomProductQuery = `
          SELECT bp.quantity_project, p.quantity
          FROM bom_project bp
          INNER JOIN product p ON bp.no_part = p.no_part
          WHERE LOWER(BTRIM(bp.no_project)) = LOWER(BTRIM($1)) AND UPPER(BTRIM(bp.no_part)) = UPPER(BTRIM($2))
          LIMIT 1
        `;
        const bomProductResult = await client.query(bomProductQuery, [originalProject, stockRow.no_part]);

        if (bomProductResult.rows.length > 0) {
          const quantityProject = bomProductResult.rows[0].quantity_project;
          const quantityPerPackage = bomProductResult.rows[0].quantity || 1;

          const quantity_calculated = quantityProject / quantityPerPackage;
          const packagesRequiredRounded = Math.ceil(quantity_calculated);
          const packagesArrived = newAvailable;

          let newStatus = 'Pending Delivery';
          if (packagesArrived >= packagesRequiredRounded) {
            newStatus = 'Delivered';
          }

          await client.query(
            'UPDATE bom_project SET status = $1 WHERE LOWER(BTRIM(no_project)) = LOWER(BTRIM($2)) AND UPPER(BTRIM(no_part)) = UPPER(BTRIM($3))',
            [newStatus, originalProject, stockRow.no_part]
          );

          // Over-entry: only when previous available + entering quantity exceeds packages required
          if ((previousAvailable + cantidadToAdd) > packagesRequiredRounded) {
            overEntry = {
              quantity_project: quantityProject,
              quantity_calculated: quantity_calculated,
              available: previousAvailable,
              entering: cantidadToAdd,
              packages_required: packagesRequiredRounded
            };
          }
        }
      } else if (stockRow.no_project === 'AUT-STOCK' && originalProject && originalProject !== 'AUT-STOCK') {
        // Para AUT-STOCK, usar directamente el proyecto original del QR para buscar el BOM
        const bomProductQuery = `
          SELECT bp.quantity_project, p.quantity
          FROM bom_project bp
          INNER JOIN product p ON bp.no_part = p.no_part
          WHERE LOWER(BTRIM(bp.no_project)) = LOWER(BTRIM($1)) AND UPPER(BTRIM(bp.no_part)) = UPPER(BTRIM($2))
          LIMIT 1
        `;
        const bomProductResult = await client.query(bomProductQuery, [originalProject, stockRow.no_part]);
        
        if (bomProductResult.rows.length > 0) {
          const quantityProject = bomProductResult.rows[0].quantity_project;
          const quantityPerPackage = bomProductResult.rows[0].quantity || 1;

          const quantity_calculated = quantityProject / quantityPerPackage;
          const packagesRequiredRounded = Math.ceil(quantity_calculated);
          
          // Calculate total AFTER increment for BOM status decision
          const totalAvailAfter = totalAvailBefore + cantidadToAdd;

          let newStatus = 'Pending Delivery';
          if (totalAvailAfter >= packagesRequiredRounded) {
            newStatus = 'Delivered';
          }

          // DEBUG LOG - shows project's available AFTER increment for BOM status
          console.log(`BOM Update - Project: ${originalProject}, Part: ${stockRow.no_part}, Required: ${packagesRequiredRounded}, Arrived: ${totalAvailAfter}, NewStatus: ${newStatus}`);

          await client.query(
            'UPDATE bom_project SET status = $1 WHERE LOWER(BTRIM(no_project)) = LOWER(BTRIM($2)) AND UPPER(BTRIM(no_part)) = UPPER(BTRIM($3))',
            [newStatus, originalProject, stockRow.no_part]
          );

          // Over-entry: only when total available + entering quantity exceeds packages required
          if ((totalAvailBefore + cantidadToAdd) > packagesRequiredRounded) {
            overEntry = {
              quantity_project: quantityProject,
              quantity_calculated: quantity_calculated,
              available: totalAvailBefore,  // Use TOTAL AUT-STOCK available, not just this QR's available
              entering: cantidadToAdd,
              packages_required: packagesRequiredRounded
            };
          }
        }
      }

      await client.query('COMMIT');

      stockRow.available = newAvailable;

      return res.json({
        ok: true,
        message: "Movimiento registrado correctamente",
        stock: stockRow,
        movement: movementResult.rows[0],
        overEntry: overEntry || null
      });
    } catch (errInner) {
      await client.query('ROLLBACK');
      console.error('Error in /api/inbound transaction:', errInner);
      return res.status(500).json({ ok: false, message: 'Error registrando INBOUND', error: String(errInner) });
    } finally {
      client.release();
    }

  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Error en el servidor",
      error: error.message
    });
  }
});

// ======================================================
// INBOUND WITH RACK - Para proyectos inactivos que requieren selección de rack
// ======================================================
app.post("/api/inbound-with-rack", async (req, res) => {
  try {
    const { qr_code, rack, cantidad } = req.body;
    const cantidadToAdd = parseInt(cantidad || 1, 10);
    const userPid = await requireMovementUserPid(req, res, '/api/inbound-with-rack');
    if (!userPid) return;

    if (!Number.isFinite(cantidadToAdd) || cantidadToAdd < 1) {
      return res.status(400).json({
        ok: false,
        message: 'Cantidad invalida para entrada con rack.'
      });
    }

    if (!qr_code || qr_code.trim() === "" || !rack || rack.trim() === "") {
      return res.status(400).json({
        ok: false,
        message: "QR y rack requeridos"
      });
    }

    const qrClean = qr_code.trim().toUpperCase();
    const rackClean = rack.trim();

    // 1) Buscar QR en stock
    const stockQuery = `
      SELECT id_stock, rack, available, no_part, no_project, qr_code
      FROM stock
      WHERE UPPER(qr_code) = $1
      LIMIT 1
    `;

    const stockResult = await pool.query(stockQuery, [qrClean]);

    if (stockResult.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        message: `QR no encontrado en Stock: ${qrClean}`
      });
    }

    const stockRow = stockResult.rows[0];
    const previousAvailable = stockRow.available || 0;
    const noPart = stockRow.no_part;

    // Extraer el no_project original del QR (formato: I000XXX-NO_PROJECT)
    const qrParts = qrClean.split('-');
    const originalProject = qrParts.length > 1 ? qrParts.slice(1).join('-') : stockRow.no_project;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 2) Update rack for ALL matching parts in AUT-STOCK and inactive projects
      await client.query(
        `UPDATE stock 
         SET rack = $1 
         WHERE UPPER(BTRIM(no_part)) = UPPER(BTRIM($2))
         AND (no_project = 'AUT-STOCK' OR no_project IN (
           SELECT no_project FROM project WHERE status != 'ACTIVE'
         ))`,
        [rackClean, noPart]
      );

      // 3) Increment available by cantidad
      const updateQ = `UPDATE stock SET available = available + $1 WHERE id_stock = $2 RETURNING available`;
      const updR = await client.query(updateQ, [cantidadToAdd, stockRow.id_stock]);
      const newAvailable = updR.rows[0] ? updR.rows[0].available : stockRow.available;
      let overEntry = null;

      // 4) Insert INBOUND movement
      const movementQuery = `
        INSERT INTO movements (date_movement, type_movement, id_stock, pid)
        VALUES (NOW(), 'INBOUND', $1, $2)
        RETURNING id_movement, date_movement, type_movement, id_stock, pid
      `;
      const movementResult = await client.query(movementQuery, [stockRow.id_stock, userPid]);

      // 5) Update bom_project status usando el proyecto original extraído del QR
      const bomProductQuery = `
        SELECT bp.quantity_project, p.quantity, bp.no_project
        FROM bom_project bp
        INNER JOIN product p ON bp.no_part = p.no_part
        WHERE LOWER(BTRIM(bp.no_project)) = LOWER(BTRIM($1)) AND UPPER(BTRIM(bp.no_part)) = UPPER(BTRIM($2))
        LIMIT 1
      `;
      const bomProductResult = await client.query(bomProductQuery, [originalProject, noPart]);

      // Get TOTAL available BEFORE increment from ALL inactive stocks with this part (for alert display)
      const totalAvailBeforeQuery = `
        SELECT COALESCE(SUM(available), 0) as total_available
        FROM stock
        WHERE UPPER(BTRIM(no_part)) = UPPER(BTRIM($1))
        AND (no_project = 'AUT-STOCK' OR no_project IN (
          SELECT no_project FROM project WHERE status IS NULL OR status != 'ACTIVE'
        ))
      `;
      const totalAvailBeforeResult = await client.query(totalAvailBeforeQuery, [noPart]);
      const totalAvailBefore = parseInt(totalAvailBeforeResult.rows[0]?.total_available || 0);

      // Get available BEFORE increment from THIS PROJECT with this part (for BOM log comparison)
      // Calculate AFTER increment: projectAvailBefore + 1
      const projectAvailBeforeQuery = `
        SELECT COALESCE(SUM(available), 0) as total_available
        FROM stock
        WHERE UPPER(BTRIM(no_part)) = UPPER(BTRIM($1))
        AND (no_project = 'AUT-STOCK' OR LOWER(BTRIM(no_project)) = LOWER(BTRIM($2)))
      `;
      const projectAvailBeforeResult = await client.query(projectAvailBeforeQuery, [noPart, originalProject]);
      const projectAvailBefore = parseInt(projectAvailBeforeResult.rows[0]?.total_available || 0);
      // Will calculate projectAvailAfter AFTER the UPDATE below

      if (bomProductResult.rows.length > 0) {
        const quantityProject = bomProductResult.rows[0].quantity_project;
        const quantityPerPackage = bomProductResult.rows[0].quantity || 1;

        const quantity_calculated = quantityProject / quantityPerPackage;
        const packagesRequiredRounded = Math.ceil(quantity_calculated);

        let newStatus = 'Pending Delivery';
        
        // Will update bom_project status AFTER we know projectAvailAfter
        // (continue below after UPDATE)

        if ((projectAvailBefore + cantidadToAdd) > packagesRequiredRounded) {
          overEntry = {
            quantity_project: quantityProject,
            quantity_calculated: quantity_calculated,
            available: totalAvailBefore,  // General available (sum of all inactive stocks) shown in table
            entering: cantidadToAdd,
            packages_required: packagesRequiredRounded
          };
        }
      } else {
        // DEBUG LOG - BOM no encontrado
        console.log(`BOM NOT FOUND - Project: ${originalProject}, Part: ${noPart}, StockProject: ${stockRow.no_project}`);
      }

      // Calculate projectAvailAfter AFTER the UPDATE has been done with cantidad
      let projectAvailAfter = projectAvailBefore + cantidadToAdd;

      // Now update BOM status if we have a BOM
      if (bomProductResult.rows.length > 0) {
        const quantityProject = bomProductResult.rows[0].quantity_project;
        const quantityPerPackage = bomProductResult.rows[0].quantity || 1;
        const quantity_calculated = quantityProject / quantityPerPackage;
        const packagesRequiredRounded = Math.ceil(quantity_calculated);

        let newStatus = 'Pending Delivery';
        if (projectAvailAfter >= packagesRequiredRounded) {
          newStatus = 'Delivered';
        }

        // DEBUG LOG - shows project's available AFTER increment for BOM status
        console.log(`BOM Update - Project: ${originalProject}, Part: ${noPart}, Required: ${packagesRequiredRounded}, Arrived: ${projectAvailAfter}, NewStatus: ${newStatus}`);

        await client.query(
          'UPDATE bom_project SET status = $1 WHERE LOWER(BTRIM(no_project)) = LOWER(BTRIM($2)) AND UPPER(BTRIM(no_part)) = UPPER(BTRIM($3))',
          [newStatus, originalProject, noPart]
        );
      }

      // 6) Change no_project to AUT-STOCK in stock
      await client.query(
        'UPDATE stock SET no_project = $1 WHERE id_stock = $2',
        ['AUT-STOCK', stockRow.id_stock]
      );

      // Calculate total available AFTER increment using requested quantity.
      const totalAvailAfter = totalAvailBefore + cantidadToAdd;

      await client.query('COMMIT');

      stockRow.available = newAvailable;
      stockRow.rack = rackClean;
      stockRow.no_project = 'AUT-STOCK';

      return res.json({
        ok: true,
        message: "Inbound completado con rack seleccionado",
        stock: stockRow,
        movement: movementResult.rows[0],
        overEntry: overEntry || null,
        totalAvailAfter: totalAvailAfter  // Total general para la tabla (antes + 1)
      });
    } catch (errInner) {
      await client.query('ROLLBACK');
      console.error('Error in /api/inbound-with-rack transaction:', errInner);
      return res.status(500).json({ ok: false, message: 'Error en inbound-with-rack', error: String(errInner) });
    } finally {
      client.release();
    }

  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Error en el servidor",
      error: error.message
    });
  }
});

// ======================================================
// MOVEMENTS - obtener último movimiento por qr_code  
// ======================================================
app.get('/api/movements/last', async (req, res) => {
  try {
    const qr_code = (req.query.qr_code || '').toString().trim().toUpperCase();
    if (!qr_code) return res.status(400).json({ message: 'qr_code requerido' });

    // Buscar stock (case-insensitive)
    const stockQ = `SELECT id_stock, qr_code, no_part, no_project, rack FROM stock WHERE UPPER(qr_code) = $1 LIMIT 1`;
    const stockR = await pool.query(stockQ, [qr_code]);
    if (stockR.rows.length === 0) return res.status(404).json({ message: 'QR no encontrado' });
    const stock = stockR.rows[0];

    const movQ = `SELECT id_movement, date_movement, type_movement, id_stock, pid FROM movements WHERE id_stock = $1 ORDER BY date_movement DESC LIMIT 1`;
    const movR = await pool.query(movQ, [stock.id_stock]);
    if (movR.rows.length === 0) return res.status(404).json({ message: 'Sin movimientos previos' });

    return res.json({ movement: movR.rows[0], stock });
  } catch (err) {
    res.status(500).json({ message: 'Error', error: String(err) });
  }
});

// ======================================================
// MOVEMENTS - registrar movimiento genérico (INBOUND/OUTBOUND)
// ======================================================
app.post('/api/movements', async (req, res) => {
  try {
    const { qr_code, type, pid, cantidad, original_project } = req.body;

    
    const t = (type || '').toString().trim().toUpperCase();
    const qty = cantidad && !isNaN(cantidad) ? parseInt(cantidad) : 1;
    

    
    if (!qr_code) return res.status(400).json({ ok: false, message: 'qr_code requerido' });
    if (!t || (t !== 'INBOUND' && t !== 'OUTBOUND')) return res.status(400).json({ ok: false, message: 'type debe ser INBOUND u OUTBOUND' });
    if (qty < 1) return res.status(400).json({ ok: false, message: 'cantidad debe ser mayor a 0' });
    
    const userPid = await requireMovementUserPid(req, res, '/api/movements');
    if (!userPid) return;

    const qr = qr_code.trim().toUpperCase();
    const stockQ = `SELECT id_stock, rack, available, no_part, no_project, qr_code FROM stock WHERE UPPER(qr_code) = $1 LIMIT 1`;
    const stockR = await pool.query(stockQ, [qr]);
    if (stockR.rows.length === 0) return res.status(404).json({ ok: false, message: `QR no encontrado en Stock: ${qr}` });
    const stockRow = stockR.rows[0];
    
    // Verificar estado del proyecto al inicio
    const projectCheckInitial = await pool.query(
      'SELECT status FROM project WHERE no_project = $1',
      [stockRow.no_project]
    );
    const projectIsActiveInitial = projectCheckInitial.rows.length > 0 && 
                                   projectCheckInitial.rows[0].status && 
                                   projectCheckInitial.rows[0].status.toUpperCase() === 'ACTIVE';
    const projectInactiveInitial = !projectIsActiveInitial;
    const projectInactiveNoOriginal = projectInactiveInitial ? stockRow.no_project : null;

    // Ajustar available según tipo y cantidad dentro de una transacción
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Si es INBOUND y se proporciona original_project, marcar directamente como 'Delivered'
      if (t === 'INBOUND' && original_project && String(original_project).trim()) {
        const noPart = stockRow.no_part;
        const origProj = String(original_project).trim();
        
        // Actualizar status en bom_project a 'Delivered' para este no_part y proyecto original
        await client.query(
          'UPDATE bom_project SET status = $1 WHERE no_project = $2 AND UPPER(BTRIM(no_part)) = UPPER(BTRIM($3))',
          ['Delivered', origProj, noPart]
        );
      } else if (t === 'INBOUND' && projectInactiveInitial && !original_project) {
        // Proyecto INACTIVO: Cambiar no_project en stock a 'AUT-STOCK'
        await client.query(
          'UPDATE stock SET no_project = $1 WHERE id_stock = $2',
          ['AUT-STOCK', stockRow.id_stock]
        );
      }
      
      let newAvailable = stockRow.available;
      const previousAvailable = stockRow.available || 0;
      const adjustment = t === 'INBOUND' ? qty : -qty;

      const updateQuery = `UPDATE stock SET available = GREATEST(available + $2, 0) WHERE id_stock = $1 RETURNING available`;
      const updateResult = await client.query(updateQuery, [stockRow.id_stock, adjustment]);
      newAvailable = updateResult.rows[0] ? updateResult.rows[0].available : newAvailable;
      let overEntry = null;

      // Si es INBOUND, actualizar status en bom_project con lógica de paquetes
      if (t === 'INBOUND' && !original_project) {
        // Determinar el proyecto sobre el que actualizar (original si era inactivo, actual si era activo)
        const projectForUpdate = projectInactiveNoOriginal || stockRow.no_project;
        
        // Obtener quantity_project y quantity de product
        const bomProductQuery = `
          SELECT bp.quantity_project, p.quantity
          FROM bom_project bp
          INNER JOIN product p ON bp.no_part = p.no_part
          WHERE bp.no_project = $1 AND UPPER(BTRIM(bp.no_part)) = UPPER(BTRIM($2))
          LIMIT 1
        `;
        const bomProductResult = await client.query(bomProductQuery, [projectForUpdate, stockRow.no_part]);

        if (bomProductResult.rows.length > 0) {
          const quantityProject = bomProductResult.rows[0].quantity_project;
          const quantityPerPackage = bomProductResult.rows[0].quantity || 1;

          // Use exact calculation quantity_project / quantity
          const quantity_calculated = quantityProject / quantityPerPackage;
          const packagesRequiredRounded = Math.ceil(quantity_calculated);
          const packagesArrived = newAvailable;

          let newStatus = 'Pending Delivery';
          if (packagesArrived >= packagesRequiredRounded) {
            newStatus = 'Delivered';
          }

          await client.query(
            'UPDATE bom_project SET status = $1 WHERE no_project = $2 AND UPPER(BTRIM(no_part)) = UPPER(BTRIM($3))',
            [newStatus, projectForUpdate, stockRow.no_part]
          );

          // Over-entry only if previousAvailable + entering (qty) exceeds required packages
          if ((previousAvailable + qty) > packagesRequiredRounded) {
            overEntry = {
              quantity_project: quantityProject,
              quantity_calculated: quantity_calculated,
              available: previousAvailable,
              entering: qty,
              packages_required: packagesRequiredRounded
            };
          }
        }
      }

      // Insertar múltiples movimientos si cantidad > 1
      const movements = [];
      for (let i = 0; i < qty; i++) {
        const movementQuery = `INSERT INTO movements (date_movement, type_movement, id_stock, pid) VALUES (NOW(), $1, $2, $3) RETURNING id_movement, date_movement, type_movement, id_stock, pid`;
        const movementResult = await client.query(movementQuery, [t, stockRow.id_stock, userPid]);
        movements.push(movementResult.rows[0]);
      }

      await client.query('COMMIT');

      stockRow.available = newAvailable;
      return res.json({ 
        ok: true, 
        message: `${qty} movimiento(s) ${t.toLowerCase()} registrado(s)`, 
        stock: stockRow, 
        movements: movements,
        cantidad: qty
      });
    } catch (errInner) {
      await client.query('ROLLBACK');


      return res.status(500).json({ ok: false, message: 'Error en el servidor', error: String(errInner) });
    } finally {
      client.release();
    }
  } catch (err) {


    res.status(500).json({ ok: false, message: 'Error en el servidor', error: String(err) });
  }
});

// ======================================================
// OUTBOUND - legacy fallback endpoint
// ======================================================
app.post('/api/outbound', async (req, res) => {
  try {
    const { qr_code, pid } = req.body;
    if (!qr_code) return res.status(400).json({ ok: false, message: 'qr_code requerido' });
    const qr = qr_code.trim().toUpperCase();
    const userPid = await requireMovementUserPid(req, res, '/api/outbound');
    if (!userPid) return;

    const stockQ = `SELECT id_stock, rack, available, no_part, no_project, qr_code FROM stock WHERE UPPER(qr_code) = $1 LIMIT 1`;
    const stockR = await pool.query(stockQ, [qr]);
    if (stockR.rows.length === 0) return res.status(404).json({ ok: false, message: `QR no encontrado en Stock: ${qr}` });
    const stockRow = stockR.rows[0];

    // Decrementar available y registrar salida dentro de transacción
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const dq = `UPDATE stock SET available = GREATEST(available - 1, 0) WHERE id_stock = $1 RETURNING available`;
      const dr = await client.query(dq, [stockRow.id_stock]);
      const newAvailable = dr.rows[0] ? dr.rows[0].available : stockRow.available;

      const movementQuery = `INSERT INTO movements (date_movement, type_movement, id_stock, pid) VALUES (NOW(), 'OUTBOUND', $1, $2) RETURNING id_movement, date_movement, type_movement, id_stock, pid`;
      const movementResult = await client.query(movementQuery, [stockRow.id_stock, userPid]);
      await client.query('COMMIT');

      stockRow.available = newAvailable;
      return res.json({ ok: true, message: 'Salida registrada', stock: stockRow, movement: movementResult.rows[0] });
    } catch (errInner) {
      await client.query('ROLLBACK');


      return res.status(500).json({ ok: false, message: 'Error en servidor', error: String(errInner) });
    } finally {
      client.release();
    }
  } catch (err) {


    res.status(500).json({ ok: false, message: 'Error en servidor', error: String(err) });
  }
});

// Endpoint para obtener historial de movimientos con buscador único
app.get('/api/movements/history', async (req, res) => {
  try {
    const { search } = req.query;
    
    // Query principal: datos exactos de las tablas movements, stock, project y user_
    let query = `
      SELECT 
        m.date_movement,
        m.type_movement,
        m.id_stock,
        s.no_part,
        s.no_project,
        pr.name_project,
        m.pid,
        u.user_name,
        u.last_name
      FROM movements m
      LEFT JOIN stock s ON m.id_stock = s.id_stock
      LEFT JOIN project pr ON s.no_project = pr.no_project
      LEFT JOIN user_ u ON LOWER(BTRIM(m.pid)) = LOWER(BTRIM(u.pid))
      WHERE 1=1
    `;
    
    const params = [];
    
    // Buscador único: busca en name_project, no_project y no_part
    if (search) {
      query += ` AND (pr.name_project ILIKE $1 OR s.no_project ILIKE $1 OR s.no_part ILIKE $1)`;
      params.push(`%${search}%`);
    }
    
    query += ` ORDER BY m.date_movement DESC LIMIT 500`;
    
    const result = await pool.query(query, params);
    
    // Retornar datos exactos como están en la BD
    const movements = result.rows.map(row => ({
      date_movement: row.date_movement,
      type_movement: row.type_movement,
      id_stock: row.id_stock,
      no_part: row.no_part,
      no_project: row.no_project,
      name_project: row.name_project,
      pid: row.pid,
      user_name: row.user_name,
      last_name: row.last_name
    }));
    
    res.json({
      success: true,
      movements: movements,
      total: movements.length
    });
    
  } catch (err) {


    res.status(500).json({ 
      success: false, 
      error: 'Error al obtener historial de movimientos', 
      message: String(err) 
    });
  }
});

// ======================================================
// BOM_PROJECT - Actualizar status (Delivered/Pending Delivery)
// ======================================================
app.patch('/api/bom-project/update-status', async (req, res) => {
  try {
    const { no_project, no_part, status } = req.body;

    if (!no_project || !no_part || !status) {
      return res.status(400).json({ 
        ok: false, 
        message: 'no_project, no_part y status son requeridos' 
      });
    }

    // Validar que el status sea uno de los permitidos
    if (status !== 'Delivered' && status !== 'Pending Delivery' && status !== 'PO') {
      return res.status(400).json({ 
        ok: false, 
        message: 'Status debe ser: Delivered, Pending Delivery o PO' 
      });
    }

    // Actualizar el status en bom_project
    const result = await pool.query(
      `UPDATE bom_project 
       SET status = $1 
       WHERE no_project = $2 AND no_part = $3
       RETURNING *`,
      [status, no_project, no_part]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        ok: false, 
        message: 'No se encontró el item en bom_project para actualizar' 
      });
    }

    res.json({ 
      ok: true, 
      message: `Status actualizado a ${status}`, 
      item: result.rows[0] 
    });
  } catch (error) {


    res.status(500).json({ 
      ok: false, 
      message: 'Error al actualizar el status', 
      error: String(error) 
    });
  }
});

