// 샘플 장입도 PDF 생성 스크립트
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

async function generateSampleChargeScan() {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // 페이지 1
  const page1 = pdfDoc.addPage([595, 842]); // A4
  const { width, height } = page1.getSize();

  // 제목
  page1.drawText('TAEWOONG', {
    x: 50,
    y: height - 50,
    size: 24,
    font: fontBold,
    color: rgb(0, 0.2, 0.6),
  });

  page1.drawText('가열로 장입도 / Raw Materials Location', {
    x: 50,
    y: height - 80,
    size: 14,
    font: font,
    color: rgb(0, 0, 0),
  });

  // 테이블 헤더
  const headers = ['작업일자', '가열로 호기', '재질/품번', '중량(kg)', '작업 종료 시간', '주간/야간', '작업자 메모'];
  const colWidths = [80, 70, 80, 60, 90, 60, 100];
  let xPos = 50;
  const yPos = height - 120;

  headers.forEach((header, i) => {
    page1.drawText(header, {
      x: xPos,
      y: yPos,
      size: 8,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    xPos += colWidths[i];
  });

  // 샘플 데이터 행들
  const sampleData = [
    ['2026-06-10', '가열1호', 'SS400', '1250', '15:30', '주간', '정상'],
    ['2026-06-10', '가열1호', 'SM490', '980', '06:45', '야간', '정상'],
    ['2026-06-11', '가열1호', 'SS400', '1100', '16:00', '주간', '정상'],
  ];

  sampleData.forEach((row, rowIndex) => {
    let x = 50;
    const y = yPos - 30 - (rowIndex * 25);
    
    row.forEach((cell, colIndex) => {
      page1.drawText(cell, {
        x,
        y,
        size: 8,
        font: font,
        color: rgb(0, 0, 0),
      });
      x += colWidths[colIndex];
    });
  });

  // 페이지 2
  const page2 = pdfDoc.addPage([595, 842]);
  
  page2.drawText('TAEWOONG', {
    x: 50,
    y: height - 50,
    size: 24,
    font: fontBold,
    color: rgb(0, 0.2, 0.6),
  });

  page2.drawText('가열로 장입도 / Raw Materials Location', {
    x: 50,
    y: height - 80,
    size: 14,
    font: font,
    color: rgb(0, 0, 0),
  });

  // 테이블 헤더
  let xPos2 = 50;
  headers.forEach((header, i) => {
    page2.drawText(header, {
      x: xPos2,
      y: yPos,
      size: 8,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    xPos2 += colWidths[i];
  });

  const sampleData2 = [
    ['2026-06-11', '가열5호', 'SS400', '1150', '06:30', '야간', '정상'],
    ['2026-06-12', '가열1호', 'SM490', '1050', '15:45', '주간', '정상'],
  ];

  sampleData2.forEach((row, rowIndex) => {
    let x = 50;
    const y = yPos - 30 - (rowIndex * 25);
    
    row.forEach((cell, colIndex) => {
      page2.drawText(cell, {
        x,
        y,
        size: 8,
        font: font,
        color: rgb(0, 0, 0),
      });
      x += colWidths[colIndex];
    });
  });

  // PDF 저장
  const pdfBytes = await pdfDoc.save();
  const outputPath = path.join(__dirname, 'sample-charge-scan.pdf');
  fs.writeFileSync(outputPath, pdfBytes);
  
  console.log('Generated: sample-charge-scan.pdf');
  console.log('Pages: 2');
}

generateSampleChargeScan().catch(console.error);
