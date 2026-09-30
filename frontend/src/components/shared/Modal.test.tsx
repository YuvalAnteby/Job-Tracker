import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal';

describe('Modal', () => {
  const dialogPrototype = HTMLDialogElement.prototype;
  const originalShowModal = dialogPrototype.showModal;
  const originalClose = dialogPrototype.close;

  beforeAll(() => {
    dialogPrototype.showModal = function showModal(): void {
      this.setAttribute('open', '');
    };
    dialogPrototype.close = function close(): void {
      this.removeAttribute('open');
    };
  });

  afterAll(() => {
    dialogPrototype.showModal = originalShowModal;
    dialogPrototype.close = originalClose;
  });

  it('exposes an accessible title and closes from the close button or Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const view = render(
      <Modal isOpen onClose={onClose} title="Job listing">
        <p>Listing details</p>
      </Modal>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Job listing' });
    expect(dialog).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(dialog).toHaveAttribute('open');

    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(onClose).toHaveBeenCalledTimes(2);

    view.rerender(
      <Modal isOpen={false} onClose={onClose} title="Job listing">
        <p>Listing details</p>
      </Modal>,
    );
    expect(dialog).not.toHaveAttribute('open');
  });
});
