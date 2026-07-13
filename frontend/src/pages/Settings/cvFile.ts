export const MASTER_CV_MAX_BYTES = 1024 * 1024;

export interface DecodedCvFile {
  content: string;
  filename: string;
}

export async function decodeCvFile(file: File): Promise<DecodedCvFile> {
  if (!/\.(md|txt)$/i.test(file.name)) throw new Error('Choose a .md or .txt file.');
  if (file.size > MASTER_CV_MAX_BYTES) throw new Error('The file must be 1 MiB or smaller.');
  if (file.size === 0) throw new Error('The file is empty.');

  let content: string;
  try {
    content = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
  } catch {
    throw new Error('The file is not valid UTF-8.');
  }
  if (content.charCodeAt(0) === 0xfeff) content = content.slice(1);
  if (!content.trim()) throw new Error('The file contains only whitespace.');
  return { content, filename: file.name };
}

export function countCvWords(content: string) {
  return content.trim() ? content.trim().split(/\s+/).length : 0;
}
