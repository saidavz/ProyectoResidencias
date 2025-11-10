document.addEventListener('DOMContentLoaded', () => {
  const projectSelect = document.getElementById('projectSelect');
  const resultEl = document.getElementById('result');

  // URL explícita al backend
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
        opt.textContent = `${p.no_project} - ${p.name_project}`;
        projectSelect.appendChild(opt);
      });
      if (projects.length === 0) {
        projectSelect.innerHTML = '<option value="">There are no projects</option>';
      }
    } catch (err) {
      projectSelect.innerHTML = '<option value="">Error loading projects</option>';
    }
  }

  loadProjects();
//Verificación de la subida de datos
  document.getElementById('uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    resultEl.textContent = '';
    const fileInputEl = document.getElementById('fileinput');
    const file = fileInputEl.files[0];
    const no_project = projectSelect.value;

    if (!no_project) {
      resultEl.textContent = 'Select project.';
      return;
    }
    if (!file) {
      resultEl.textContent = 'Select file .xlsx.';
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('no_project', no_project);

    resultEl.textContent = 'Loading...';

    try {
      const res = await fetch(`${BASE}/bom`, {
        method: 'POST',
        body: formData,
      });

      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { message: text }; }

      if (!res.ok) {
        resultEl.textContent = 'Server responded with error: ' + (data.message || res.status);
        return;
      }
      resultEl.textContent = data.message || 'Subida completada correctamente.';
      //Limpia el imput para que no se mande el archivo multiples veces
      fileInputEl.value = '';
      projectSelect.selectedIndex = 0;
    } catch (err) {
      resultEl.textContent = 'Error loading file: ' + err.message;
    }
  });
});
