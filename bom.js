document.getElementById('uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('fileinput').files[0];
    const formData = new FormData();
    formData.append('file', fileInput);

    const res = await fetch('http://localhost:3000/bom', {
        method: 'POST',
        body: formData
    });

    const data = await res.json();
    document.getElementById('result').textContent = data.message;
});