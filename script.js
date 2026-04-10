document.addEventListener("DOMContentLoaded", async () => {
  const tabla = document.querySelector("#tablaInventario tbody");
  const projectSearch = document.querySelector("#projectSearchStock");
  const projectSuggestions = document.querySelector("#projectSuggestionsStock");

  let allData = [];
  let allProjects = [];
  let allVendors = [];
  let allParts = [];
  let allBrands = [];
  let currentMode = 'general'; // 'general' o 'project'
  let searchActive = false;
  let currentProjectData = []; // Guardar datos del proyecto actual para filtros adicionales
  let currentProjectId = null;

  // cargar valores �nicos desde stock (projects, vendors, parts, brands)
  async function loadDistinctStockFilters() {
    try {
      const res = await fetch('http://localhost:3000/api/stock/distinct-filters');
      const data = await res.json();
      allProjects = data.projects || [];
      // Agregar manualmente la opci�n 'Material disponible' (AUT-STOCK) si no existe
      const autStockExists = allProjects.some(p => p.no_project === 'AUT-STOCK');
      if (!autStockExists) {
        allProjects.unshift({
          no_project: 'AUT-STOCK',
          name_project: 'Material disponible'
        });
      }
      allVendors = (data.vendors || []).map(v => ({ name_vendor: v }));
      allParts = data.parts || [];
      allBrands = data.brands || [];
    } catch (err) {


    }
  }

  async function loadGeneralData() {
    try {
      const response = await fetch("http://localhost:3000/api/stock/summary");
      allData = await response.json();
      currentMode = 'general';
      currentProjectId = null;
      hideAdditionalFilters();
      renderTabla(allData);

      const partsSet = new Set();
      const brandsSet = new Set();

      allData.forEach(item => {
        if (item.no_part) partsSet.add(item.no_part);
        if (item.brand) brandsSet.add(item.brand);
      });

      allParts = Array.from(partsSet);
      allBrands = Array.from(brandsSet);

    } catch (err) {


    }
  }

  async function loadProjectData(noProject) {
    try {
      const response = await fetch(
        `http://localhost:3000/api/stock/by-project?no_project=${encodeURIComponent(noProject)}`
      );
      allData = await response.json();
      currentProjectData = [...allData]; // Guardar copia de los datos del proyecto
      currentMode = 'project';
      currentProjectId = noProject;
      renderTabla(allData);
      
      // Mostrar filtros adicionales
      showAdditionalFilters();
    } catch (err) {


    }
  }

  function safeValue(value, dashForEmpty = true) {
    const isEmpty = value === undefined || value === null || String(value).trim() === '';
    if (isEmpty) return dashForEmpty ? '-' : '';
    return value;
  }

  function renderTabla(filas) {
    tabla.innerHTML = "";
    const isAutStockProject = currentMode === 'project' && currentProjectId === 'AUT-STOCK';

    let rowsToRender = filas;

    if (currentMode === 'general' && !searchActive) {
      rowsToRender = filas.filter(item => {
        const isEmpty = v => v === undefined || v === null || String(v).trim() === '';
        const allEmpty =
          isEmpty(item.description) &&
          isEmpty(item.no_part) &&
          isEmpty(item.brand) &&
          isEmpty(item.product_quantity) &&
          (item.cantidad_disponible === null ||
            item.cantidad_disponible === undefined ||
            String(item.cantidad_disponible).trim() === '');

        return !allEmpty;
      });
    }

    const hiddenColumnIndices = getHiddenColumnIndices();
    updateTableHeaders(hiddenColumnIndices);

    rowsToRender.forEach(item => {
      const tr = document.createElement("tr");

      // Obtener el valor disponible correcto seg�n el modo
      const valorDisponible = item.available !== undefined && item.available !== null 
        ? item.available 
        : (item.cantidad_disponible !== undefined && item.cantidad_disponible !== null 
            ? item.cantidad_disponible 
            : 0);
      
      const cantidad = Number(valorDisponible);
      const highlight =
        !isNaN(cantidad) && cantidad <= 10
          ? ' style="background:rgba(255,0,0,0.18);color:#b30000;font-weight:bold;position:relative;"'
          : '';

      const alertIcon =
        !isNaN(cantidad) && cantidad <= 10
          ? '<i class="bi bi-exclamation-triangle-fill text-danger" aria-label="Low stock" style="position:absolute; right:10px; top:50%; transform:translateY(-50%); font-size:1.1em; pointer-events:none;"></i>'
          : '';

      tr.innerHTML = `
        <td>${safeValue(item.description)}</td>
        <td>${safeValue(item.type_p)}</td>
        <td>${safeValue(item.no_part)}</td>
        <td>${safeValue(item.no_qis)}</td>
        <td>${safeValue(item.name_vendor)}</td>
        <td>${safeValue(item.brand)}</td>
        <td>${safeValue(item.pr)}</td>
        <td>${safeValue(item.shopping)}</td>
        <td>${safeValue(item.po)}</td>
        <td>${safeValue(item.rack)}</td>
        <td>${safeValue(item.product_quantity)}</td>
        <td>${safeValue(item.unit)}</td>
        <td${highlight}>
          <span style="position:relative; display:block; min-width:60px;">
            ${valorDisponible}
            ${alertIcon}
          </span>
        </td>
      `;

      hiddenColumnIndices.forEach(i => {
        if (tr.children[i]) tr.children[i].style.display = 'none';
      });

      tabla.appendChild(tr);
    });

    const totalEl = document.getElementById('totalMaterial');
    if (totalEl) {
      const total = rowsToRender.reduce((sum, item) => {
        // En modo general el campo es 'available', en proyecto puede ser 'cantidad_disponible'
        const valorDisponible = item.available !== undefined && item.available !== null 
          ? item.available 
          : (item.cantidad_disponible !== undefined && item.cantidad_disponible !== null 
              ? item.cantidad_disponible 
              : 0);
        const valor = Number(valorDisponible) || 0;
        return sum + valor;
      }, 0);
      totalEl.textContent = total;
    }

    // Mostrar/ocultar y actualizar rack card
    const rackCard = document.getElementById('rackCard');
    const rackNumber = document.getElementById('rackNumber');
    
    if (currentMode === 'project' && rowsToRender.length > 0) {
      // Obtener el rack del primer registro (todos deben tener el mismo rack en un proyecto)
      const rack = rowsToRender[0].rack || '-';
      if (rackNumber) rackNumber.textContent = rack;
      if (rackCard) rackCard.style.display = 'flex';
    } else {
      if (rackCard) rackCard.style.display = 'none';
    }
  }

  function normalizeText(text) {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function getHiddenColumnIndices() {
    // Column indices:
    // 0 Descripcion, 1 Tipo, 2 Numero de Parte, 3 QIS, 4 Proveedor,
    // 5 Marca, 6 PR, 7 Shopping, 8 PO, 9 Rack, 10 Cantidad Producto,
    // 11 Unidad, 12 Cantidad Disponible
    if (currentMode === 'general') {
      // Show only: Descripcion, Tipo, Numero de Parte, Cantidad Producto, Unidad, Cantidad Disponible
      return [3, 4, 5, 6, 7, 8, 9]; // QIS, Proveedor, Marca, PR, Shopping, PO, Rack
    }

    if (currentMode === 'project') {
      if (currentProjectId === 'AUT-STOCK') {
        // Material disponible: hide Proveedor, PR, Shopping, PO, and keep Rack hidden as in project mode.
        return [4, 6, 7, 8, 9];
      }
      return [9]; // Rack
    }

    return [];
  }

  function updateTableHeaders(hiddenIndices) {
    const ths = document.querySelectorAll('#tablaInventario thead th');
    if (!ths || ths.length === 0) return;

    ths.forEach((th, index) => {
      th.style.display = hiddenIndices.includes(index) ? 'none' : '';
    });
  }

  // Mostrar filtros adicionales
  function showAdditionalFilters() {
    const additionalFilters = document.getElementById('additionalFilters');
    if (additionalFilters) {
      additionalFilters.style.display = 'flex';
    }
  }

  // Ocultar filtros adicionales
  function hideAdditionalFilters() {
    const additionalFilters = document.getElementById('additionalFilters');
    if (additionalFilters) {
      additionalFilters.style.display = 'none';
    }
    // Resetear el input de filtro
    const filterProjectData = document.getElementById('filterProjectData');
    if (filterProjectData) filterProjectData.value = '';
  }

  // Aplicar filtros adicionales en tiempo real
  function applyAdditionalFilters() {
    const filterProjectData = document.getElementById('filterProjectData');

    if (!filterProjectData || currentMode !== 'project') {
      return;
    }

    const searchTerm = normalizeText(filterProjectData.value.trim());
    let filteredData = [...currentProjectData];

    if (searchTerm) {
      filteredData = filteredData.filter(item => {
        const noPart = normalizeText(item.no_part || '');
        const typeP = normalizeText(item.type_p || '');
        return noPart.includes(searchTerm) || typeP.includes(searchTerm);
      });
    }

    renderTabla(filteredData);
  }

  projectSearch.addEventListener('input', async (e) => {
    delete projectSearch.dataset.noProject;

    const termRaw = projectSearch.value.trim();
    const term = normalizeText(termRaw);

    searchActive = termRaw.length > 0;

    if (!term) {
      projectSuggestions.style.display = 'none';
      hideAdditionalFilters();
      await loadGeneralData();
      // Ocultar rack card en modo general
      const rackCard = document.getElementById('rackCard');
      if (rackCard) rackCard.style.display = 'none';
      return;
    }

    const exactProject = allProjects.find(
      p => normalizeText(String(p.no_project)) === term
    );

    if (exactProject) {
      projectSuggestions.style.display = 'none';
      searchActive = true;
      await loadProjectData(exactProject.no_project);
      return;
    }

        const suggestions = [];

        // Agregar opci�n especial para material disponible
        allProjects.forEach(p => {
          const pname = normalizeText(p.name_project || '');
          const pid = normalizeText((p.no_project || '').toString());

          if (p.no_project === 'AUT-STOCK') {
            suggestions.push({
              type: 'project',
              label: p.name_project,
              value: p.no_project
            });
          } else if (pname.includes(term) || pid.includes(term)) {
            suggestions.push({
              type: 'project',
              label: `${p.no_project} - ${p.name_project || ''}`,
              value: p.no_project
            });
          }
        });

    suggestions.sort((a, b) => {
      const order = { project: 0, part: 1, vendor: 2, brand: 3 };
      return order[a.type] - order[b.type];
    });

    projectSuggestions.innerHTML = '';

    suggestions.forEach(s => {
      const div = document.createElement('div');
      div.textContent = s.label;
      div.style.padding = '8px';
      div.style.cursor = 'pointer';
      div.style.borderBottom = '1px solid #eee';

      div.addEventListener('click', async () => {
        projectSearch.value = s.label;
        projectSuggestions.style.display = 'none';
        searchActive = true;

        // Solo tipo proyecto ahora
            // Si selecciona Material disponible, buscar AUT-STOCK
            if (s.value === 'AUT-STOCK') {
              await loadProjectData('AUT-STOCK');
            } else {
              await loadProjectData(s.value);
            }
      });

      div.addEventListener('mouseover', () => {
        div.style.backgroundColor = '#dcecff';
        div.style.color = '#102a43';
      });

      div.addEventListener('mouseout', () => {
        div.style.backgroundColor = 'transparent';
        div.style.color = '';
      });

      projectSuggestions.appendChild(div);
    });

    projectSuggestions.style.display = suggestions.length ? 'block' : 'none';
  });

  document.addEventListener('click', (e) => {
    if (e.target !== projectSearch && !projectSuggestions.contains(e.target)) {
      projectSuggestions.style.display = 'none';
    }
  });

  // Event listener para filtro adicional
  const filterProjectData = document.getElementById('filterProjectData');

  if (filterProjectData) {
    filterProjectData.addEventListener('input', applyAdditionalFilters);
  }

  window.filterTable = function (searchText) {
    const texto = normalizeText(searchText);
    const filas = document.querySelectorAll('#tablaInventario tbody tr');
    let totalFiltrado = 0;

    filas.forEach(fila => {
      const textoFila = normalizeText(fila.textContent);

      if (textoFila.includes(texto)) {
        fila.style.display = '';
        // Obtener el valor de la columna de cantidad (columna 11)
        const cantidadCell = fila.cells[11];
        if (cantidadCell) {
          const valor = Number(cantidadCell.textContent.trim()) || 0;
          totalFiltrado += valor;
        }
      } else {
        fila.style.display = 'none';
      }
    });

    document.getElementById('totalMaterial').textContent = totalFiltrado;
  };

  await loadDistinctStockFilters();
  await loadGeneralData();
});
