/**
 * Utility to format dates consistently for PKK documents
 */

export const monthsIndonesian = [
  'JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI',
  'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'
];

/**
 * Formats a date string into "DD MONTH YYYY" (Indonesian)
 * Handles YYYY-MM-DD, DD-MM-YYYY, YYYYMMDD, and DDMMYYYY
 */
export const formatDateToIndonesianFull = (dateStr: string): string => {
  if (!dateStr) return '';
  
  let day = '', monthIdx = -1, year = '';
  const parts = dateStr.split(/[-/]/);
  
  if (parts.length === 3) {
    if (parts[0].length === 4) { // YYYY-MM-DD
      day = parts[2].padStart(2, '0');
      monthIdx = parseInt(parts[1], 10) - 1;
      year = parts[0];
    } else { // DD-MM-YYYY
      day = parts[0].padStart(2, '0');
      monthIdx = parseInt(parts[1], 10) - 1;
      year = parts[2];
    }
  } else {
    const clean = dateStr.replace(/[^0-9]/g, '');
    if (clean.length === 8) {
      if (parseInt(clean.slice(0, 4), 10) > 1900) { // YYYYMMDD
        day = clean.slice(6, 8);
        monthIdx = parseInt(clean.slice(4, 6), 10) - 1;
        year = clean.slice(0, 4);
      } else { // DDMMYYYY
        day = clean.slice(0, 2);
        monthIdx = parseInt(clean.slice(2, 4), 10) - 1;
        year = clean.slice(4, 8);
      }
    }
  }

  if (monthIdx >= 0 && monthIdx < 12) {
    return `${day} ${monthsIndonesian[monthIdx]} ${year}`;
  }
  
  // Final fallback: try native Date parsing
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return `${String(d.getDate()).padStart(2, '0')} ${monthsIndonesian[d.getMonth()]} ${d.getFullYear()}`;
    }
  } catch (e) {
    // ignore
  }

  return dateStr.toUpperCase();
};
