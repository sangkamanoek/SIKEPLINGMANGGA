export const downloadImage = async (url: string, filename: string): Promise<boolean> => {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  return true;
};

export const downloadProjectPhotosAsZip = async (_items: any[], _filename: string) => {};
export const getHighResImageUrl = (url: string) => url;
