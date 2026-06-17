 document.addEventListener('DOMContentLoaded', function() {
    loadBOMData();
  });

  async function loadBOMData() {
    try {
      const response = await fetch('http://localhost:3000/api/bomView'); 
      const data = await response.json();
      displayBOMData(data);
    } catch (error) {
      document.getElementById('bomTableBody').innerHTML = 
        '<tr><td colspan="10" class="text-center text-danger">Error loading data</td></tr>';
    }
  }

  function displayBOMData(data) {
    const tbody = document.getElementById('bomTableBody');
    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan=7" class="text-center">No BOM found</td></tr>';
      return;
    }
  // URL del backend
  const BASE = 'http://localhost:3000/api';

  //Funcion para cargar proyectos en el select
  async function loadProjects() {
    projectSelect.innerHTML = '<option value="">Loading projects...</option>';
    try {
      
      const res = await fetch(`${BASE}/projects/active`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const projects = await res.json();
      projectSelect.innerHTML = '<option value="">-- Select project --</option>';
            projects.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.no_project;
                opt.textContent = `${p.no_project} - ${p.name}`; 
                projectSelect.appendChild(opt);
              });
      if (projects.length === 0) {
        projectSelect.innerHTML = '<option value="">There are no projects</option>';
      }
    } catch (err) {
      projectSelect.innerHTML = '<option value="">Error loading projects</option>';
    }
  }
    tbody.innerHTML = '';
    data.forEach(item => {
      const row = `
        <tr>
          <td>${item.name_project}</td>
          <td>${item.type_p}</td>
          <td>${item.no_part}</td>
          <td>${item.description}</td>
          <td>${item.brand}</td>
          <td ${item.quantity}</td>
          <td>${item.unit}</td>
          <td>${item.quantity_requested}</td>
        </tr>
      `;
      tbody.innerHTML += row;
    });
  }
