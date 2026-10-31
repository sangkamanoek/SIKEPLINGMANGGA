export const exportToExcel = async (..._args: any[]): Promise<{ success: boolean }> => ({ success: true });
export const exportAbsensiToExcel = async (..._args: any[]): Promise<{ success: boolean; method?: string }> => ({ success: true, method: 'download' });
export const shareAbsensiExcel = async (..._args: any[]): Promise<{ success: boolean }> => ({ success: true });

