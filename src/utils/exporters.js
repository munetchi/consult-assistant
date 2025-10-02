import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export function downloadCSV(rows, filename='questions.csv'){
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename);
}

export function downloadJSON(rows, filename='questions.json'){
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type:'application/json' });
  triggerDownload(blob, filename);
}

export function downloadXLSX(byTabMap, filename='questions.xlsx'){
  const wb = XLSX.utils.book_new();
  for(const [tab, items] of byTabMap.entries()){
    const ws = XLSX.utils.json_to_sheet(items);
    XLSX.utils.book_append_sheet(wb, ws, tab.slice(0, 31) || 'General');
  }
  const wbout = XLSX.write(wb, { bookType:'xlsx', type:'array' });
  const blob = new Blob([wbout], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  triggerDownload(blob, filename);
}

function triggerDownload(blob, filename){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 0);
}
