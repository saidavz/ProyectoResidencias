document.addEventListener('DOMContentLoaded', () => {
  const uploadMessage = document.getElementById('uploadMessage');
  const resultEl = document.getElementById('result');

  // URL del backend
  const BASE = 'http://localhost:3000/api';

  // ========= SUBIR BOM Y REGISTRAR PROYECTO ==========
  document.getElementById('uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    uploadMessage.innerHTML = '';

    const no_project = document.getElementById('no_project').value.trim();
    const name_project = document.getElementById('name_project').value.trim();
    const status = 'Active'; // Status automático
    const fileInputEl = document.getElementById('fileinput');
    const file = fileInputEl.files[0];

    // Validar campos obligatorios
    if (!no_project || !name_project) {
      uploadMessage.innerHTML = `
        <div class="alert alert-warning py-1">Todos los campos son obligatorios.</div>`;
      return;
    }

    if (!file) {
      uploadMessage.innerHTML = `
        <div class="alert alert-warning py-1">Por favor selecciona un archivo</div>`;
      return;
    }
    try {
      // 1. Verificar si el proyecto ya existe
      const checkRes = await fetch(`${BASE}/projects/check/${encodeURIComponent(no_project)}`);
      const checkData = await checkRes.json();

      if (checkData.exists) {
        const confirmReplace = confirm(
          `Desea reemplazar el BOM?\n\n!Se eliminaran todos los datos del BOM anterior.!`
        );

        if (!confirmReplace) {
          uploadMessage.innerHTML = `
            <div class="alert alert-info py-1">Carga cancelada</div>`;
          return;
        }

        // Eliminar BOM anterior antes de subir el nuevo
        await fetch(`${BASE}/bom/${encodeURIComponent(no_project)}`, {
          method: 'DELETE'
        });
      } else {
        // 2. Si no existe, registrar el proyecto primero
        const projectRes = await fetch(`${BASE}/projects`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ no_project, name_project, status })
        });

        const projectData = await projectRes.json();

        if (!projectRes.ok) {
          uploadMessage.innerHTML = `
            <div class="alert alert-danger py-1">Error al registrar el proyecto: ${projectData.message}</div>`;
          return;
        }
      }

      // 3. Subir el archivo BOM
      const formData = new FormData();
      formData.append('file', file);
      formData.append('no_project', no_project);

      const bomRes = await fetch(`${BASE}/bom`, {
        method: 'POST',
        body: formData,
      });

      const bomText = await bomRes.text();
      let bomData;
      try { bomData = JSON.parse(bomText); } catch { bomData = { message: bomText }; }

      if (!bomRes.ok) {
        uploadMessage.innerHTML = `
          <div class="alert alert-danger py-1">Error al cargar el BOM: ${bomData.message}</div>`;
        return;
      }

      // 4. Mostrar alerta de éxito
      alert('Se guardo exitosamente.');

      uploadMessage.innerHTML = `
        <div class="alert alert-success py-1">¡Los datos se han cargado correctamente!</div>`;

      // 5. Limpiar formulario
      setTimeout(() => {
        document.getElementById('no_project').value = '';
        document.getElementById('name_project').value = '';
        fileInputEl.value = '';

        // Resetear el overlay del archivo
        const overlay = document.querySelector('.upload-design-overlay');
        if (overlay) {
          overlay.classList.remove('file-selected');
          overlay.innerHTML = `
            <i class="bi bi-cloud-arrow-up-fill upload-icon mb-3"></i>
            <p class="drag-text">Drag and Drop here</p>
            <p class="or-text">or</p>
            <a href="#" class="browse-link" onclick="event.preventDefault(); document.getElementById('fileinput').click();">Browse files</a>
          `;
        }

        uploadMessage.innerHTML = '';
      }, 3000);

    } catch (err) {
      uploadMessage.innerHTML = `
        <div class="alert alert-danger py-1">Connection error: ${err.message}</div>`;
    }
  });
});
