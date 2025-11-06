import express from "express";
import multer from "multer";
import xlsx from "xlsx";
import pkg from "pg";
import cors from "cors";
const { Pool } = pkg;

const app = express();
const upload = multer({ dest: "uploads/" });
app.use(cors());
app.use(express.json());

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "bd_purchase_system",
  password: "150403kim",
  port: 5432,
});

// ✅ Endpoint para obtener proyectos
app.get("/projects", async (req, res) => {
  try {
    const result = await pool.query("SELECT no_project, name_project FROM Project");
    res.json(result.rows);
  } catch (err) {
    console.error("Error al obtener proyectos:", err);
    res.status(500).json({ message: "Error al obtener proyectos" });
  }
});

// Funciones auxiliares
function normalizeHeader(h) {
  if (h === null || h === undefined) return "";
  try {
    let cleaned = String(h).replace(/[\uFEFF\u00A0]/g, "");
    return cleaned.trim().toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");
  } catch (e) {
    console.error("Error normalizando header:", h, e);
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

// ✅ Endpoint para subir archivo Excel
app.post("/bom", upload.single("file"), async (req, res) => {
  const client = await pool.connect();
  try {
    const { no_project } = req.body;
    if (!no_project) return res.status(400).json({ message: "Falta seleccionar un proyecto" });

    if (!req.file) return res.status(400).json({ message: "No se subió archivo" });

    const workbook = xlsx.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null });

    if (!rows || rows.length < 2)
      return res.status(400).json({ message: "El Excel no contiene datos o no tiene cabecera" });

    const rawHeaders = rows[0];
    const headers = rawHeaders.map(normalizeHeader);
    console.log("Cabeceras detectadas:", rawHeaders);

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

    console.log("Primeras filas parseadas:", data.slice(0, 5));

    for (const rowObj of data) {
      const no_part = pick(rowObj, ["no_parte", "numero_de_parte", "part_number"]);
      if (!no_part) continue;

      const brand = pick(rowObj, ["marca", "brand"]);
      const description = pick(rowObj, ["producto", "description", "descripcion"]);
      const quantity = toInt(pick(rowObj, ["cantidad_venta", "quantity", "qty"]));
      const unit = pick(rowObj, ["unidad", "unit"]);
      const type_p = pick(rowObj, ["tipo", "type"]);
      const quantity_p = toInt(pick(rowObj, ["cantidad_solicitada", "cantidad_proyecto"]));

      // 🟩 Insertar producto si no existe
      await client.query(
        `INSERT INTO product (no_part, brand, description, quantity, unit, type_p)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (no_part) DO NOTHING`,
        [no_part, brand, description, quantity, unit, type_p]
      );

      // 🟦 Insertar directamente en bom_project
      if (quantity_p !== null) {
        await client.query(
          `INSERT INTO bom_project (no_project, quantity_project, no_part)
           VALUES ($1, $2, $3)`,
          [no_project, quantity_p, no_part]
        );
        console.log(`→ Insertado: Proyecto ${no_project}, Parte ${no_part}, Cantidad ${quantity_p}`);
      }
    }

    res.json({ message: `Archivo procesado correctamente para el proyecto ${no_project}` });
  } catch (err) {
    console.error("ERROR:", err);
    res.status(500).json({ message: "Error al procesar el Excel", error: String(err) });
  } finally {
    client.release();
  }
});

app.listen(3000, () => console.log("Servidor en http://localhost:3000"));
