import express from "express";
import multer from "multer";
import xlsx from "xlsx";
import pkg from "pg";
import cors from "cors";
const { Pool } = pkg;

const app = express();
const upload = multer({ dest: "uploads/" });
app.use(cors());

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "bd_purchase_system",
  password: "automationdb",
  port: 5432,
});

function normalizeHeader(h) {
  if (h === null || h === undefined) return "";
  try {
    // eliminar BOM y espacios invisibles
    let cleaned = String(h).replace(/[\uFEFF\u00A0]/g, "");
    return cleaned.trim().toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, ""); // sólo letras, números y guiones bajos
  } catch (e) {
    console.error("Error normalizando header:", h, e);
    return "";
  }
}

// Conversión segura a entero
function toInt(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = parseInt(String(v).replace(/[, ]+/g, ""), 10);
  return Number.isNaN(n) ? null : n;
}

// Conversión segura a decimal
function toFloat(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = parseFloat(String(v).replace(/[, ]+/g, ""));
  return Number.isNaN(n) ? null : n;
}

// Devuelve el primer valor no nulo de una lista de posibles nombres de columna
function pick(rowObj, names) {
  // 1) Intento directo por normalización exacta
  for (const n of names) {
    const key = normalizeHeader(n);
    if (key in rowObj && rowObj[key] !== null && rowObj[key] !== "") return rowObj[key];
  }

  // 2) Fallback: buscar claves parecidas ignorando vocales y guiones/underscores
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

app.post("/bom", upload.single("file"), async (req, res) => {
  const client = await pool.connect();
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const workbook = xlsx.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    // Leemos como matriz para controlar cabeceras exactamente
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null });

    if (!rows || rows.length < 2) {
      return res.status(400).json({ message: "El Excel no contiene datos o no tiene cabecera" });
    }

    // Primera fila = cabeceras
    const rawHeaders = rows[0];
    const headers = rawHeaders.map(normalizeHeader);

    // Debug: imprime las cabeceras detectadas
    console.log("Cabeceras detectadas (raw):", rawHeaders);
    console.log("Cabeceras normalizadas:", headers);

    // Construimos filas como objetos { header: value }
    const data = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      // si fila vacía -> skip
      if (!row || row.every(cell => cell === null || cell === "")) continue;
      const obj = {};
      for (let c = 0; c < headers.length; c++) {
        const key = headers[c] || `col_${c}`;
        obj[key] = row[c] === undefined ? null : row[c];
      }
      data.push(obj);
    }

    // Muestra las primeras filas para ver qué se parseó
    console.log("Primeras filas parseadas (hasta 5):", data.slice(0,5));

    if (data.length === 0) {
      return res.status(400).json({ message: "No se detectaron filas con datos" });
    }

    // Helper local: ejecutar query añadiendo comentario único para evitar caching de tipos en prepared statements
    const runQueryNoCache = async (sql, values) => {
      const suffix = ' /*' + Date.now() + Math.floor(Math.random()*100000) + '*/';
      return client.query(sql + suffix, values);
    };

     // Procesamos cada fila (resolviendo/creando vendor por fila)
    for (const rowObj of data) {
      // 3) obtener campos del producto y detalle
      const no_part = pick(rowObj, ["no_parte", "numero_de_parte", "numero_departe", "part_number", "partno"]);
      if (!no_part) {
        console.log("Fila omitida (no_part vacío):", rowObj);
        continue;
      }
      const no_part_str = String(no_part);

      const brand = pick(rowObj, ["marca", "brand", "vendor_brand"]);
      const description = pick(rowObj, ["producto", "description", "desc", "descripcion"]);
      const quantity = toInt(pick(rowObj, ["cantidad_venta", "quantity", "qty"]));
      const unit = pick(rowObj, ["unidad", "unit"]);
      const type_p = pick(rowObj, ["tipo", "type"]);
      const quantity_p = pick(rowObj, ["cantidad_solicitada"]);

      // 4) insertar/asegurar producto
      try {
        console.log("Comprobando producto no_part=", no_part_str);
        const prodRes = await runQueryNoCache("SELECT no_part FROM product WHERE no_part = $1::varchar", [no_part_str]);
        if (prodRes.rows.length === 0) {
          const insertSql = `
            INSERT INTO product (no_part, brand, description, quantity, unit, type_p)
            SELECT $1::varchar, $2::varchar, $3::varchar, $4::integer, $5::varchar, $6::varchar
            WHERE NOT EXISTS (SELECT 1 FROM product WHERE no_part = $1::varchar)
          `;
          const insertValues = [
            no_part_str,
            brand == null ? null : String(brand),
            description == null ? null : String(description),
            quantity,
            unit == null ? null : String(unit),
            type_p == null ? null : String(type_p)
          ];
          const insertRes = await runQueryNoCache(insertSql, insertValues);
          console.log("Intento de inserción de producto realizado para:", no_part_str, "filas afectadas:", insertRes.rowCount);
        } else {
          console.log("Producto ya existe en la tabla product:", no_part_str);
        }
      } catch (prodErr) {
        console.error("Error al insertar/comprobar producto", no_part_str, prodErr);
        continue;
      }

      // 5) insertar purchase_detail (si hay cantidad o precio)
      if (quantity_p === null) {
        console.log("Omitiendo bom");
        continue;
      }
      try {
        await runQueryNoCache(
          `INSERT INTO Bom_project (quantity_project, no_part)
           VALUES ($1::integer, $2::varchar)`,
          [quantity_p, no_part_str]
        );
        console.log("Insertado BOM:", quantity_p, no_part_str);
      } catch (detailErr) {
        console.error("Error al insertar BOM", no_part_str, detailErr);
        continue;
      }
    } // end for each row

    res.json({ message: "Procesado completado. Revisa logs del servidor para detalles." });
  } catch (err) {
    console.error("ERROR:", err);
    res.status(500).json({ message: "Error al procesar el Excel", error: String(err) });
  } finally {
    client.release();
  }
});

app.listen(3001, () => console.log("Servidor en http://localhost:3001"));