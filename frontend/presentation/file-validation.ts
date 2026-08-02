export const MAX_PDF_SIZE = 50 * 1024 * 1024;

export function validatePdfFile(file: File): string | null {
  if (file.size === 0) {
    return "空のファイルは読み込めません";
  }
  if (file.size > MAX_PDF_SIZE) {
    return "PDFは50MB以下にしてください";
  }

  const hasPdfExtension = file.name.toLowerCase().endsWith(".pdf");
  const hasPdfMime = file.type === "application/pdf";
  if (!hasPdfExtension || (file.type && !hasPdfMime)) {
    return "PDFファイルを選択してください";
  }
  return null;
}
