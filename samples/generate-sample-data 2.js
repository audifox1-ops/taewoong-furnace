// 샘플 가스 데이터 생성 스크립트
const XLSX = require('xlsx');

function generateSampleGasData(furnaceNo, startDate, days) {
  const data = [];
  let cumulative = 1000 + Math.random() * 500;
  
  for (let day = 0; day < days; day++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + day);
    
    for (let minute = 0; minute < 1440; minute++) {
      const ts = new Date(date);
      ts.setHours(0, 0, 0, 0);
      ts.setMinutes(minute);
      
      const temp = 800 + Math.sin(minute / 60) * 50 + Math.random() * 10;
      const gas = Math.random() > 0.3 ? Math.random() * 5 : 0;
      cumulative += gas;
      
      data.push({
        '순번': data.length + 1,
        '시간': ts.toISOString().replace('T', ' ').slice(0, 19),
        '온도': temp.toFixed(1),
        '가스': gas.toFixed(2),
        '가스누적지침': cumulative.toFixed(2),
        '전력': Math.random() > 0.5 ? (100 + Math.random() * 50).toFixed(1) : '-',
        '전력누적지침': Math.random() > 0.5 ? (1000 + Math.random() * 500).toFixed(1) : '-',
        '온도2': (temp + Math.random() * 5).toFixed(1),
        '온도3': (temp - Math.random() * 5).toFixed(1),
      });
    }
  }
  
  return data;
}

// 샘플 데이터 생성
const sampleData = generateSampleGasData(1, '2026-06-01', 3);

// XLSX 파일 생성
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(sampleData);

// 열 너비 설정
ws['!cols'] = [
  { wch: 8 },  // 순번
  { wch: 20 }, // 시간
  { wch: 8 },  // 온도
  { wch: 8 },  // 가스
  { wch: 15 }, // 가스누적지침
  { wch: 8 },  // 전력
  { wch: 15 }, // 전력누적지침
  { wch: 8 },  // 온도2
  { wch: 8 },  // 온도3
];

XLSX.utils.book_append_sheet(wb, ws, '이력');

// 파일 저장
const fileName = `가열로1호기_가스_온도(${new Date('2026-06-01').toISOString().slice(0, 10)} ~ ${new Date('2026-06-03').toISOString().slice(0, 10)}).xlsx`;
XLSX.writeFile(wb, `./samples/${fileName}`);

console.log(`Generated: ${fileName}`);
console.log(`Rows: ${sampleData.length}`);
