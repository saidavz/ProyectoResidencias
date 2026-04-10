window.printQRCodes = function () {
    const qrContainer = document.getElementById('qrCodesContainer');

    if (!qrContainer || qrContainer.children.length === 0) {
        alert('No QR codes to print');
        return;
    }

    const printWindow = window.open('', '', 'width=800,height=600');
    const doc = printWindow.document;

    doc.open();
    doc.write('<!DOCTYPE html><html><head><title></title></head><body></body></html>');
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
    `;
    doc.head.appendChild(style);

    const grid = doc.createElement('div');
    grid.className = 'qr-grid';

    qrContainer.querySelectorAll('.card').forEach(card => {
        const canvas = card.querySelector('canvas');

        if (canvas) {
            const img = doc.createElement('img');
            img.src = canvas.toDataURL('image/png');

            const item = doc.createElement('div');
            item.className = 'qr-item';
            item.appendChild(img);

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
