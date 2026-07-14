import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Settings from './Settings';

const saveMutate = vi.fn();
const mockData = {
  cvQuery: {
    data: {
      content: 'Saved CV',
      ai_visible_content: 'Saved CV',
      ai_visible_character_count: 8,
      updated_at: '2026-01-01T00:00:00.000Z',
      source: 'manual',
      filename: null,
      word_count: 2,
      character_count: 8,
      revision: 3,
      previous: null,
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  },
  cvHistoryQuery: { data: [], isLoading: false, isError: false },
  settingsQuery: {
    data: {
      score_threshold: 70,
      llm_provider: 'gemini',
      llm_model: 'gemini-2.5-flash',
      applicable_domains: ['BACKEND'],
      domain_keywords: { BACKEND: ['api'] },
      telegram_allowed_chat_ids: [],
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  },
  saveCv: { mutate: saveMutate, isPending: false },
  clearCv: { mutate: vi.fn(), isPending: false },
  restoreCv: { mutate: vi.fn(), isPending: false },
  updateSettings: { mutate: vi.fn(), isPending: false },
};

vi.mock('./useSettingsData', () => ({ useSettingsData: () => mockData }));
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

function renderSettings() {
  const router = createMemoryRouter(
    [
      { path: '/settings', element: <Settings /> },
      { path: '/elsewhere', element: <div>Elsewhere</div> },
    ],
    { initialEntries: ['/settings?section=cv'] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe('Settings master CV', () => {
  beforeEach(() => saveMutate.mockReset());

  it('tracks manual edits, live counts, and serializes a save with the current revision', async () => {
    const user = userEvent.setup();
    renderSettings();
    const editor = await screen.findByLabelText('CV text');
    await user.clear(editor);
    await user.type(editor, 'one two three');
    expect(screen.getByText(/3 words/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save CV' }));
    expect(saveMutate).toHaveBeenCalledWith(
      {
        content: 'one two three',
        source: 'manual',
        filename: undefined,
        expected_revision: 3,
      },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );
  });

  it('blocks section navigation while the CV draft is dirty', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderSettings();
    await user.type(await screen.findByLabelText('CV text'), ' changed');
    await user.click(screen.getByRole('button', { name: /^Analysis/ }));
    await waitFor(() => expect(window.confirm).toHaveBeenCalled());
    expect(
      screen.getByRole('heading', { name: 'Master CV' }),
    ).toBeInTheDocument();
  });

  it('loads a valid local file into the unsaved draft and retains its filename', async () => {
    const user = userEvent.setup();
    renderSettings();
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    await user.upload(
      input,
      new File(['File content'], 'resume.TXT', { type: 'text/plain' }),
    );
    expect(await screen.findByDisplayValue('File content')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save CV' }));
    expect(saveMutate).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'file', filename: 'resume.TXT' }),
      expect.any(Object),
    );
  });
});
