import * as XLSX from 'xlsx';

interface ExportColumn {
  header: string;
  key: string;
  width?: number;
  format?: (value: any, row?: any) => string;
}

interface ExportOptions {
  filename: string;
  sheetName?: string;
  columns: ExportColumn[];
  data: any[];
}

/**
 * Export data to Excel file with proper formatting
 */
export function exportToExcel({ filename, sheetName = 'Data', columns, data }: ExportOptions) {
  // Create headers
  const headers = columns.map(col => col.header);
  
  // Create rows
  const rows = data.map(row => 
    columns.map(col => {
      const value = row[col.key];
      if (col.format) {
        return col.format(value, row);
      }
      return value ?? '';
    })
  );

  // Combine headers and rows
  const wsData = [headers, ...rows];
  
  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  
  // Set column widths
  ws['!cols'] = columns.map(col => ({ wch: col.width || 15 }));
  
  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  
  // Download file
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/**
 * Format currency value for Excel
 */
export function formatCurrencyForExcel(value: number): string {
  return value?.toLocaleString('vi-VN') || '0';
}

/**
 * Format date value for Excel
 */
export function formatDateForExcel(value: string | Date, format: string = 'dd/MM/yyyy'): string {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  
  if (format === 'dd/MM/yyyy HH:mm') {
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }
  return `${day}/${month}/${year}`;
}
