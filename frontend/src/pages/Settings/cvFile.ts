export const MASTER_CV_MAX_BYTES = 1024 * 1024;
export const AI_EXCLUDE_START = '<!-- AI-EXCLUDE-START -->';
export const AI_EXCLUDE_END = '<!-- AI-EXCLUDE-END -->';

export function aiVisibleCv(content: string): string {
  let visible = '';
  let cursor = 0;
  while (cursor < content.length) {
    const start = content.indexOf(AI_EXCLUDE_START, cursor);
    const strayEnd = content.indexOf(AI_EXCLUDE_END, cursor);
    if (strayEnd !== -1 && (start === -1 || strayEnd < start))
      throw new Error('Exclusion end marker has no start marker.');
    if (start === -1) return visible + content.slice(cursor);
    visible += content.slice(cursor, start);
    const end = content.indexOf(
      AI_EXCLUDE_END,
      start + AI_EXCLUDE_START.length,
    );
    if (end === -1) throw new Error('AI exclusion block is not closed.');
    const nested = content.indexOf(
      AI_EXCLUDE_START,
      start + AI_EXCLUDE_START.length,
    );
    if (nested !== -1 && nested < end)
      throw new Error('AI exclusion blocks cannot be nested.');
    cursor = end + AI_EXCLUDE_END.length;
  }
  return visible;
}

export interface DecodedCvFile {
  content: string;
  filename: string;
}

export async function decodeCvFile(file: File): Promise<DecodedCvFile> {
  if (!/\.(md|txt)$/i.test(file.name))
    throw new Error('Choose a .md or .txt file.');
  if (file.size > MASTER_CV_MAX_BYTES)
    throw new Error('The file must be 1 MiB or smaller.');
  if (file.size === 0) throw new Error('The file is empty.');

  let content: string;
  try {
    content = new TextDecoder('utf-8', { fatal: true }).decode(
      await file.arrayBuffer(),
    );
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
