window.printQRCodes = function () {
    const qrContainer = document.getElementById('qrCodesContainer');

    if (!qrContainer || qrContainer.children.length === 0) {
        alert('No hay códigos QR para imprimir');
        return;
    }

    const printWindow = window.open('', '', 'width=800,height=600');
    const doc = printWindow.document;

    doc.open();
    doc.write('<!DOCTYPE html><html><head><title>Print QR Codes</title></head><body></body></html>');
    doc.close();

    const style = doc.createElement('style');
    style.textContent = `
        @page { margin: 10mm; }
        body { font-family: Arial, sans-serif; }
        .qr-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, 3cm);
            gap: 10mm;
        }
        .qr-item {
            width: 3cm;
            text-align: center;
            page-break-inside: avoid;
        }
        .qr-item img {
            width: 3cm;
            height: 3cm;
        }
        .qr-text {
            font-size: 10px;
            margin-top: 2mm;
        }
    `;
    doc.head.appendChild(style);

    const grid = doc.createElement('div');
    grid.className = 'qr-grid';

    qrContainer.querySelectorAll('.card').forEach(card => {
        const canvas = card.querySelector('canvas');
        const code = card.querySelector('h6')?.innerText || '';

        if (canvas) {
            const img = doc.createElement('img');
            img.src = canvas.toDataURL('image/png');

            const text = doc.createElement('div');
            text.className = 'qr-text';
            text.textContent = code;

            const item = doc.createElement('div');
            item.className = 'qr-item';
            item.appendChild(img);
            item.appendChild(text);

            grid.appendChild(item);
        }
    });

    doc.body.appendChild(grid);

    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 500);
};
