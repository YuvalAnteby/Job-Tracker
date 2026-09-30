import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { MainLayout } from './MainLayout';

vi.mock('../dashboard/AddJobModal', () => ({
  AddJobModal: (): null => null,
}));

describe('MainLayout', () => {
  it('keeps the mobile menu controllable and the Add Job action labeled', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <MainLayout>
          <p>Page content</p>
        </MainLayout>
      </MemoryRouter>,
    );

    const menuButton = screen.getByRole('button', { name: 'Open main menu' });
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    expect(menuButton).toHaveAttribute('aria-controls', 'main-navigation');
    expect(screen.getByRole('button', { name: 'Add Job' })).toBeInTheDocument();

    await user.click(menuButton);
    expect(
      screen.getByRole('button', { name: 'Close main menu' }),
    ).toHaveAttribute('aria-expanded', 'true');
    const mobileMenu = document.getElementById('main-navigation');
    expect(mobileMenu).not.toBeNull();
    expect(
      within(mobileMenu as HTMLElement).getByRole('link', { name: 'Pipeline' }),
    ).toBeInTheDocument();
  });
});
