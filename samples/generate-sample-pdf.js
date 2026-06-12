const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

async function generateSampleChargeScan() {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  for (let pageNum = 0; pageNum < 3; pageNum++) {
    const page = pdfDoc.addPage([595, 842]);
    const { height } = page.getSize();

    page.drawText('TAEWOONG', { x: 50, y: height - 50, size: 24, font: fontBold, color: rgb(0, 0.2, 0.6) });
    page.drawText('Charge Sheet / Raw Materials Location', { x: 50, y: height - 80, size: 14, font, color: rgb(0, 0, 0) });

    const headers = ['Date', 'Furnace', 'Material', 'Weight(kg)', 'End Time', 'Shift', 'Note'];
    const colWidths = [80, 70, 80, 60, 90, 60, 100];
    let xPos = 50;
    const yPos = height - 120;

    headers.forEach((header, i) => {
      page.drawText(header, { x: xPos, y: yPos, size: 8, font: fontBold, color: rgb(0, 0, 0) });
      xPos += colWidths[i];
    });

    const dataRows = [
      [`2026-06-${10 + pageNum}`, 'Furnace 1', 'SS400', '1250', '15:30', 'Day', 'Normal'],
      [`2026-06-${10 + pageNum}`, 'Furnace 1', 'SM490', '980', '06:45', 'Night', 'Normal'],
      [`2026-06-${10 + pageNum}`, 'Furnace 5', 'SS400', '1150', '16:00', 'Day', 'Normal'],
    ];

    dataRows.forEach((row, rowIndex) => {
      let x = 50;
      const y = yPos - 30 - (rowIndex * 25);
      row.forEach((cell, colIndex) => {
        page.drawText(cell, { x, y, size: 8, font, color: rgb(0, 0, 0) });
        x += colWidths[colIndex];
      });
    });
  }

  const pdfBytes = await pdfDoc.save();
  const outputPath = path.join(__dirname, 'sample-charge-scan.pdf');
  fs.writeFileSync(outputPath, pdfBytes);
  console.log('Generated: sample-charge-scan.pdf (3 pages)');
}

generateSampleChargeScan().catch(console.error);
