// bom.js - carga proyectos y sube archivo junto con no_project
document.addEventListener('DOMContentLoaded', () => {
  const projectSelect = document.getElementById('projectSelect');
  const resultEl = document.getElementById('result');

  // URL explícita al backend (cambia si tu backend está en otra URL)
  const BASE = 'http://localhost:3000';

  async function loadProjects() {
    projectSelect.innerHTML = '<option value="">Cargando proyectos...</option>';
    try {
      const res = await fetch(`${BASE}/projects`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const projects = await res.json();
      projectSelect.innerHTML = '<option value="">-- Selecciona un proyecto --</option>';
      projects.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.no_project;
        opt.textContent = `${p.no_project} - ${p.name_project}`;
        projectSelect.appendChild(opt);
      });
      if (projects.length === 0) {
        projectSelect.innerHTML = '<option value="">No hay proyectos</option>';
      }
    } catch (err) {
      console.error('Error cargando proyectos:', err);
      projectSelect.innerHTML = '<option value="">Error al cargar proyectos</option>';
      resultEl.textContent = 'Error al obtener proyectos. Revisa la consola.';
    }
  }

  loadProjects();

  document.getElementById('uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    resultEl.textContent = '';
    const fileInputEl = document.getElementById('fileinput');
    const file = fileInputEl.files[0];
    const no_project = projectSelect.value;

    if (!no_project) {
      resultEl.textContent = 'Selecciona un proyecto.';
      return;
    }
    if (!file) {
      resultEl.textContent = 'Selecciona un archivo .xlsx.';
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('no_project', no_project);

    resultEl.textContent = 'Subiendo...';
    console.log('Subiendo. Proyecto:', no_project, 'Archivo:', file.name);

    try {
      const res = await fetch(`${BASE}/bom`, {
        method: 'POST',
        body: formData,
      });

      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { message: text }; }

      if (!res.ok) {
        console.error('Server responded with error', res.status, data);
        resultEl.textContent = 'Error en servidor: ' + (data.message || res.status);
        return;
      }

      console.log('Respuesta servidor:', data);
      resultEl.textContent = data.message || 'Subida completada correctamente.';
      // limpia el input para evitar reenviar el mismo archivo accidentalmente
      fileInputEl.value = '';
      projectSelect.selectedIndex = 0;
    } catch (err) {
      console.error('Error subiendo archivo:', err);
      resultEl.textContent = 'Error al subir: ' + err.message;
    }
  });
});
