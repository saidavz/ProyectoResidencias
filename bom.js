document.getElementById('uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInputEl = document.getElementById('fileinput');
    const resultEl = document.getElementById('result');
    resultEl.textContent = '';

    try {
        const file = fileInputEl.files[0];
        if (!file) {
            resultEl.textContent = 'Por favor selecciona un archivo .xlsx antes de subir.';
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        // Feedback visual inmediato
        resultEl.textContent = 'Subiendo...';
        console.log('Intentando subir archivo:', file.name, file.size);

        const res = await fetch('http://localhost:3001/bom', {
            method: 'POST',
            body: formData
        });

        // Parsear JSON, pero manejo de respuestas no-JSON
        let text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (_) {
            data = { message: text || (res.ok ? 'OK' : `Server error ${res.status}`) };
        }

        if (!res.ok) {
            console.error('Server responded with error', res.status, data);
            resultEl.textContent = 'Error en el servidor: ' + (data.message || res.status);
            return;
        }

        resultEl.textContent = data.message || 'Subida completada';
        console.log('Respuesta del servidor:', data);
    } catch (err) {
        console.error('Error subiendo archivo:', err);
        document.getElementById('result').textContent = 'Error al subir: ' + (err.message || err);
    }
});