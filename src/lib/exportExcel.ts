import * as XLSX from 'xlsx';

interface ExportColumn {
  header: string;
  key: string;
  width?: number;
  format?: (value: any, row?: any) => string | number;
  // If true, the value will be kept as number for Excel calculations
  isNumeric?: boolean;
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
      
      // If column is marked as numeric, keep as number for Excel calculations
      if (col.isNumeric && typeof value === 'number') {
        return value;
      }
      
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
 * Format currency value for Excel - returns NUMBER for calculations
 */
export function formatCurrencyForExcel(value: number): number {
  return value || 0;
}

/**
 * Format currency value as display string (with thousand separators)
 * Use this only when you want the display format, not for calculations
 */
export function formatCurrencyDisplayForExcel(value: number): string {
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
