var bulkItems = null;

function procesarDatos() {
    var txt = document.getElementById("dataInput").value.trim();
    if (!txt) { alert("Please enter data"); return; }
    var lineas = txt.split("\n");
    var items = [];
    for (var i = 0; i < lineas.length; i++) {
        var lin = lineas[i].trim();
        if (!lin) continue;
        var p = lin.split("|");
        if (p.length < 8) continue;
        items.push({
            rack: p[0].trim(),
            no_part: p[1].trim(),
            brand: p[2].trim(),
            description: p[3].trim(),
            quantity: parseInt(p[4]) || 1,
            unit: p[5].trim(),
            type_p: p[6].trim(),
            available: parseInt(p[7]) || 0
        });
    }
    if (items.length === 0) { alert("No valid data found"); return; }
    bulkItems = items;
    if (confirm("Will import " + items.length + " records. Continue?")) { enviarDatos(); }
}

function enviarDatos() {
    var items = bulkItems;
    var proyecto = document.getElementById("projectSelect").value;
    if (!items || items.length === 0) { alert("Please process data first"); return; }
    var btn = document.getElementById("btnSubmit");
    btn.disabled = true;
    btn.innerHTML = "<i class=\"bi bi-hourglass-split me-2\"></i>Processing...";
    fetch("http://localhost:3000/api/stock/bulk-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: items, no_project: proyecto })
    })
    .then(function(r) { return r.json(); })
    .then(function(resultado) {
        mostrarResultados(resultado);
        btn.disabled = false;
        btn.innerHTML = "<i class=\"bi bi-cloud-check me-2\"></i>Submit";
    })
    .catch(function(e) {
        alert("Error: " + e.message);
        btn.disabled = false;
        btn.innerHTML = "<i class=\"bi bi-cloud-check me-2\"></i>Submit";
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

function limpiar() {
    document.getElementById("dataInput").value = "";
    document.getElementById("resultsDiv").style.display = "none";
    bulkItems = null;
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
    document.getElementById("btnProcess").addEventListener("click", procesarDatos);
    document.getElementById("btnSubmit").addEventListener("click", enviarDatos);
    document.getElementById("btnReset").addEventListener("click", limpiar);
    document.getElementById("btnPrintQR").addEventListener("click", imprimirQR);
});
