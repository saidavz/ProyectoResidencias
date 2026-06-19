var bulkItems = null;
var bulkValidated = false;
var bulkSource = null;

var expectedColumns = [
    "rack",
    "part_number",
    "brand",
    "description",
    "quantity",
    "unit",
    "type",
    "available"
];

function normalizeHeader(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_]/g, "");
}

function setSubmitState(isEnabled) {
    var btn = document.getElementById("btnSubmit");
    if (!btn) {
        return;
    }

    btn.disabled = !isEnabled;
    btn.innerHTML = isEnabled
        ? '<i class="bi bi-cloud-check me-2"></i>Submit'
        : '<i class="bi bi-cloud-check me-2"></i>Submit';
}

function resetValidationState() {
    bulkItems = null;
    bulkValidated = false;
    bulkSource = null;
    setSubmitState(false);
}

function clearExclusiveInput(source) {
    var fileInput = document.getElementById("fileInput");
    var dataInput = document.getElementById("dataInput");

    if (source === "text" && fileInput) {
        fileInput.value = "";
    }

    if (source === "excel" && dataInput) {
        dataInput.value = "";
    }
}

function normalizeRowValues(row) {
    return row.map(function (value) {
        return String(value || "").trim();
    });
}

function rowLooksLikeHeader(row) {
    var normalized = normalizeRowValues(row).map(normalizeHeader);
    if (normalized.length < expectedColumns.length) {
        return false;
    }

    for (var i = 0; i < expectedColumns.length; i++) {
        if (normalized[i] !== expectedColumns[i]) {
            return false;
        }
    }

    return true;
}

function buildItemsFromRows(rows, options) {
    var config = options || {};
    var headerRequired = Boolean(config.headerRequired);
    var allowHeaderRow = config.allowHeaderRow !== false;
    var sourceName = config.sourceName || "data";

    if (!Array.isArray(rows) || rows.length === 0) {
        throw new Error("The " + sourceName + " source does not contain any rows.");
    }

    var workingRows = rows.slice();

    if (allowHeaderRow && workingRows.length > 0 && rowLooksLikeHeader(workingRows[0])) {
        workingRows = workingRows.slice(1);
    } else if (headerRequired && !rowLooksLikeHeader(workingRows[0] || [])) {
        throw new Error("Missing required columns: " + expectedColumns.join(", "));
    }

    if (workingRows.length === 0) {
        throw new Error("The " + sourceName + " source does not contain data rows.");
    }

    var items = [];
    var validationErrors = [];

    for (var i = 0; i < workingRows.length; i++) {
        var row = workingRows[i] || [];
        var rowNumber = i + (allowHeaderRow && rowLooksLikeHeader(rows[0] || []) ? 2 : 1);
        var values = normalizeRowValues(row);
        var isEmptyRow = values.every(function (value) {
            return value === "";
        });

        if (isEmptyRow) {
            continue;
        }

        var rack = values[0] || "";
        var partNumber = values[1] || "";
        var brand = values[2] || "";
        var description = values[3] || "";
        var quantity = parseInt(values[4], 10);
        var unit = values[5] || "";
        var typeP = values[6] || "";
        var available = parseInt(values[7], 10);

        var rowErrors = [];

        if (!rack) rowErrors.push("rack is required");
        if (!partNumber) rowErrors.push("part_number is required");
        if (!brand) rowErrors.push("brand is required");
        if (!description) rowErrors.push("description is required");
        if (!Number.isFinite(quantity)) rowErrors.push("quantity must be a number");
        if (!unit) rowErrors.push("unit is required");
        if (!typeP) rowErrors.push("type is required");
        if (!Number.isFinite(available)) rowErrors.push("available must be a number");

        if (rowErrors.length > 0) {
            validationErrors.push("Row " + rowNumber + ": " + rowErrors.join(", "));
            continue;
        }

        items.push({
            rack: rack,
            no_part: partNumber,
            brand: brand,
            description: description,
            quantity: quantity,
            unit: unit,
            type_p: typeP,
            available: available
        });
    }

    if (validationErrors.length > 0) {
        throw new Error(validationErrors[0]);
    }

    if (items.length === 0) {
        throw new Error("No valid data found.");
    }

    return items;
}

function readFileAsArrayBuffer(file) {
    return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function () {
            resolve(reader.result);
        };
        reader.onerror = function () {
            reject(reader.error || new Error("Unable to read the Excel file"));
        };
        reader.readAsArrayBuffer(file);
    });
}

async function parseExcelFile(file) {
    if (typeof XLSX === "undefined") {
        throw new Error("Excel parser is not available.");
    }

    if (!file) {
        throw new Error("Please select an Excel file.");
    }

    var fileName = String(file.name || "").toLowerCase();
    if (!/\.(xlsx|xls)$/i.test(fileName)) {
        throw new Error("Only .xlsx or .xls files are allowed.");
    }

    var buffer = await readFileAsArrayBuffer(file);
    var workbook = XLSX.read(buffer, { type: "array" });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error("The Excel file does not contain any sheet.");
    }

    var sheet = workbook.Sheets[workbook.SheetNames[0]];
    var rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

    if (!rows || rows.length < 2) {
        throw new Error("The Excel file does not contain data rows.");
    }

    return buildItemsFromRows(rows, { headerRequired: true, allowHeaderRow: true, sourceName: "Excel file" });
}

function parseTextData(text) {
    var raw = String(text || "").trim();

    if (!raw) {
        throw new Error("Please paste data or select an Excel file.");
    }

    var rows = raw
        .split(/\r?\n/)
        .map(function (line) {
            return line.split("|").map(function (value) {
                return String(value || "").trim();
            });
        })
        .filter(function (row) {
            return row.some(function (value) {
                return String(value || "").trim() !== "";
            });
        });

    return buildItemsFromRows(rows, { headerRequired: false, allowHeaderRow: true, sourceName: "text data" });
}

function procesarDatos() {
    var dataInput = document.getElementById("dataInput");
    var fileInput = document.getElementById("fileInput");
    var textValue = dataInput ? String(dataInput.value || "").trim() : "";
    var file = fileInput && fileInput.files ? fileInput.files[0] : null;

    if (textValue && file) {
        alert("Use only one input method at a time: either pasted text or an Excel file.");
        resetValidationState();
        return;
    }

    if (!textValue && !file) {
        alert("Please paste data or select an Excel file.");
        resetValidationState();
        return;
    }

    var parsePromise = file ? parseExcelFile(file) : Promise.resolve(parseTextData(textValue));

    parsePromise
        .then(function (items) {
            bulkItems = items;
            bulkValidated = true;
            bulkSource = file ? "excel" : "text";
            mostrarPreview(items);
            setSubmitState(true);
        })
        .catch(function (error) {
            resetValidationState();
            alert(error.message || "Invalid Excel file.");
        });
}

function enviarDatos() {
    var items = bulkItems;
    var proyecto = document.getElementById("projectSelect").value;

    if (!bulkValidated || !items || items.length === 0) {
        alert("Please process the Excel file first.");
        return;
    }

    var btn = document.getElementById("btnSubmit");
    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Processing...';

    fetch("http://localhost:3000/api/stock/bulk-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: items, no_project: proyecto })
    })
        .then(function (r) { return r.json(); })
        .then(function (resultado) {
            mostrarResultados(resultado);
            alert(resultado.failed > 0
                ? "Upload completed with some row errors."
                : "Data uploaded successfully.");
            bulkItems = null;
            bulkValidated = false;
            setSubmitState(false);
        })
        .catch(function (e) {
            alert("Error: " + e.message);
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-cloud-check me-2"></i>Submit';
        });
}

function mostrarResultados(resultado) {
    var div = document.getElementById("resultsDiv");
    div.style.display = "block";
    document.getElementById("successCount").innerHTML = resultado.successful || 0;
    document.getElementById("errorCount").innerHTML = resultado.failed || 0;
    document.getElementById("totalCount").innerHTML = resultado.total || 0;
    var tbody = document.getElementById("resultsTable");
    tbody.innerHTML = "";
    if (resultado.results && resultado.results.length > 0) {
        for (var i = 0; i < resultado.results.length; i++) {
            var r = resultado.results[i];
            var tr = document.createElement("tr");
            tr.className = "table-success";
            var qrId = "qr-" + i;
            tr.innerHTML = "<td class=\"text-center\"><strong>" + (r.row || i + 1) + "</strong></td><td class=\"text-center\"><span class=\"badge bg-success\"><i class=\"bi bi-check-circle me-1\"></i>OK</span></td><td><strong>" + (r.data.rack || "") + "</strong></td><td><code>" + (r.data.no_part || "") + "</code></td><td><code>" + (r.data.qr_code || "") + "</code></td><td class=\"text-center\"><div id=\"" + qrId + "\" style=\"width:70px;height:70px;\"></div></td><td class=\"text-center\">" + (r.data.available || 0) + "</td><td><small class=\"text-success\">Imported</small></td>";
            tbody.appendChild(tr);
            if (r.data.qr_code && typeof QRCode !== "undefined") {
                (function(id, code) {
                    setTimeout(function() {
                        try {
                            new QRCode(document.getElementById(id), { text: code, width: 70, height: 70 });
                        } catch (e) { console.log("QR error"); }
                    }, 100);
                })(qrId, r.data.qr_code);
            }
        }
    }
    if (resultado.errors && resultado.errors.length > 0) {
        for (var i = 0; i < resultado.errors.length; i++) {
            var e = resultado.errors[i];
            var tr = document.createElement("tr");
            tr.className = "table-danger";
            tr.innerHTML = "<td class=\"text-center\"><strong>" + (e.row || i + 1) + "</strong></td><td class=\"text-center\"><span class=\"badge bg-danger\"><i class=\"bi bi-exclamation-circle me-1\"></i>ERR</span></td><td>-</td><td><code>" + (e.part || "") + "</code></td><td>-</td><td class=\"text-center\">-</td><td class=\"text-center\">-</td><td><small class=\"text-danger\">" + (e.message || "Error") + "</small></td>";
            tbody.appendChild(tr);
        }
    }
    div.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function mostrarPreview(items) {
    var div = document.getElementById("resultsDiv");
    div.style.display = "block";
    document.getElementById("successCount").innerHTML = items.length;
    document.getElementById("errorCount").innerHTML = 0;
    document.getElementById("totalCount").innerHTML = items.length;

    var tbody = document.getElementById("resultsTable");
    tbody.innerHTML = "";

    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var tr = document.createElement("tr");
        tr.className = "table-success";
        tr.innerHTML =
            "<td class=\"text-center\"><strong>" + (i + 1) + "</strong></td>" +
            "<td class=\"text-center\"><span class=\"badge bg-success\"><i class=\"bi bi-check-circle me-1\"></i>OK</span></td>" +
            "<td><strong>" + (item.rack || "") + "</strong></td>" +
            "<td><code>" + (item.no_part || "") + "</code></td>" +
            "<td><code>-</code></td>" +
            "<td class=\"text-center\">-</td>" +
            "<td class=\"text-center\">" + (item.available || 0) + "</td>" +
            "<td><small class=\"text-success\">Validated. Ready to submit.</small></td>";
        tbody.appendChild(tr);
    }

    div.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function limpiar() {
    var dataInput = document.getElementById("dataInput");
    if (dataInput) {
        dataInput.value = "";
    }
    var fileInput = document.getElementById("fileInput");
    if (fileInput) {
        fileInput.value = "";
    }
    document.getElementById("resultsDiv").style.display = "none";
    resetValidationState();
}

function imprimirQR() {
    var elementos = document.querySelectorAll("#resultsTable tr.table-success");
    if (!elementos || elementos.length === 0) { alert("No QR codes to print"); return; }
    var html = "<html><head><title>QR Codes</title><style>body{font-family:'Poppins',Arial;margin:8px;background:#f8f9fa}.g{display:grid;grid-template-columns:repeat(4,1fr);gap:3px}.i{border:1px solid #ddd;padding:5px;text-align:center;page-break-inside:avoid;background:white;border-radius:4px}.i img{max-width:130px;margin:2px auto;display:block}.i p{margin:3px 0;font-size:9px;color:#333;word-break:break-all}</style></head><body><div class=\"g\">";

    for (var i = 0; i < elementos.length; i++) {
        var tr = elementos[i];
        var c = tr.querySelectorAll("td");
        var rack = c[2].textContent || "";
        var parte = c[3].textContent || "";
        var qr = c[4].textContent || "";
        var canvas = c[5].querySelector("canvas");
        if (canvas) {
            var img = canvas.toDataURL("image/png");
            html += "<div class=\"i\"><img src=\"" + img + "\"><p><strong>" + qr + "</strong></p><p>" + parte + "</p></div>";
        }
    }
    html += "</div></body></html>";
    var w = window.open();
    w.document.write(html);
    w.document.close();
    setTimeout(function() { w.print(); }, 500);
}

document.addEventListener("DOMContentLoaded", function() {
    var dataInput = document.getElementById("dataInput");
    var fileInput = document.getElementById("fileInput");

    if (dataInput) {
        dataInput.addEventListener("input", function () {
            if (String(dataInput.value || "").trim()) {
                clearExclusiveInput("text");
            }
            resetValidationState();
        });
    }

    if (fileInput) {
        fileInput.addEventListener("change", function () {
            if (fileInput.files && fileInput.files.length > 0) {
                clearExclusiveInput("excel");
            }
            resetValidationState();
        });
    }

    document.getElementById("btnProcess").addEventListener("click", procesarDatos);
    document.getElementById("btnSubmit").addEventListener("click", enviarDatos);
    document.getElementById("btnReset").addEventListener("click", limpiar);
    document.getElementById("btnPrintQR").addEventListener("click", imprimirQR);
    setSubmitState(false);
});
