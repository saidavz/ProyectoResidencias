document.addEventListener("DOMContentLoaded", async () => {
  const tabla = document.querySelector("#tablaInventario tbody");
  const inputBuscar = document.querySelector("#buscar");

  try {
    const response = await fetch("http://localhost:3000/api/stock");
    const data = await response.json();

    function safeValue(value) {
      return value !== undefined && value !== null ? value : '';
    }

    function renderTabla(filas) {
      tabla.innerHTML = "";
      filas.forEach(item => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${safeValue(item.id_stock)}</td>
            <td>${safeValue(item.description)}</td>
            <td>${safeValue(item.type_p)}</td>
            <td>${safeValue(item.no_part)}</td>
            <td>${safeValue(item.name_vendor)}</td>
            <td>${safeValue(item.name_project)}</td>
            <td>${safeValue(item.brand)}</td>
            <td>${safeValue(item.network)}</td>
            <td>${safeValue(item.pr)}</td>
            <td>${safeValue(item.shopping)}</td>
            <td>${safeValue(item.po)}</td>
            <td>${safeValue(item.rack)}</td>
            <td>${safeValue(item.product_quantity)}</td>
            <td>${safeValue(item.unit)}</td>
            <td>${safeValue(item.cantidad_salida)}</td>
            <td>${safeValue(item.cantidad_disponible)}</td>
          `;
        tabla.appendChild(tr);
      });
    }

    renderTabla(data);

    function normalizeText(text) {
      return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    inputBuscar.addEventListener("input", e => {
      const texto = normalizeText(e.target.value);
      const filtrado = data.filter(item =>
        (item.no_part && normalizeText(item.no_part).includes(texto)) ||
        (item.name_vendor && normalizeText(item.name_vendor).includes(texto)) ||
        (item.name_project && normalizeText(item.name_project).includes(texto))
      );
      renderTabla(filtrado);
    });

  } catch (error) {
    console.error("Error al cargar datos del inventario:", error);
    tabla.innerHTML = `
          <tr>
              <td colspan="25" class="text-center text-danger py-4">
                  <i class="bi bi-exclamation-triangle fs-1 d-block mb-2"></i>
                  Error al cargar el inventario: ${error.message}
                  <br><small>Verifica la consola para más detalles</small>
              </td>
          </tr>
      `;
  }
  
  function normalizeText(text) {
    return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  
  window.filterTable = function (searchText) {
    const texto = normalizeText(searchText);
    const filas = document.querySelectorAll('#tablaInventario tbody tr');
    let contador = 0;

    filas.forEach(fila => {
      const textoFila = normalizeText(fila.textContent);
      if (textoFila.includes(texto)) {
        fila.style.display = '';
        contador++;
      } else {
        fila.style.display = 'none';
      }
    });

    document.getElementById('totalMaterial').textContent = contador;
  };
}); 
