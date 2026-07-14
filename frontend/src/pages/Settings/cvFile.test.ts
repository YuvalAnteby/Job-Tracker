import { describe, expect, it } from 'vitest';
import {
  aiVisibleCv,
  countCvWords,
  decodeCvFile,
  MASTER_CV_MAX_BYTES,
} from './cvFile';

describe('decodeCvFile', () => {
  it('accepts case-insensitive text extensions and strips a UTF-8 BOM', async () => {
    const file = new File(
      [new Uint8Array([0xef, 0xbb, 0xbf]), '# CV'],
      'Resume.MD',
    );
    await expect(decodeCvFile(file)).resolves.toEqual({
      content: '# CV',
      filename: 'Resume.MD',
    });
  });

  it.each([
    [new File(['hello'], 'cv.pdf'), 'Choose a .md or .txt file.'],
    [new File([], 'cv.txt'), 'The file is empty.'],
    [new File([' '.repeat(4)], 'cv.txt'), 'The file contains only whitespace.'],
    [
      new File([new Uint8Array([0xc3, 0x28])], 'cv.txt'),
      'The file is not valid UTF-8.',
    ],
    [
      new File([new Uint8Array(MASTER_CV_MAX_BYTES + 1)], 'cv.txt'),
      'The file must be 1 MiB or smaller.',
    ],
  ])('rejects invalid input', async (file, message) => {
    await expect(decodeCvFile(file)).rejects.toThrow(message);
  });

  it('counts words consistently for empty and multiline content', () => {
    expect(countCvWords('')).toBe(0);
    expect(countCvWords(' one\n two   three ')).toBe(3);
  });
});

describe('aiVisibleCv', () => {
  it('removes exact exclusion blocks and rejects malformed markers', () => {
    expect(
      aiVisibleCv(
        'Public\n<!-- AI-EXCLUDE-START -->secret<!-- AI-EXCLUDE-END -->\nSkills',
      ),
    ).toBe('Public\n\nSkills');
    expect(() => aiVisibleCv('<!-- AI-EXCLUDE-START -->secret')).toThrow(
      'not closed',
    );
  });
});
