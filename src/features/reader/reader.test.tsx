import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import { Reader } from './Reader';

it('automatically annotates editable text and removes output when cleared', () => {
  render(<Reader />);
  const input = screen.getByRole('textbox', { name: 'Cantonese text' });
  expect(input).toHaveValue('');
  fireEvent.change(input, { target: { value: '銀行\nCoffee $28' } });
  const output = screen.getByRole('region', { name: 'Jyutping' });
  expect(within(output).getByText('ngan4')).toBeVisible();
  expect(within(output).getByText('hong4')).toBeVisible();
  expect(within(output).getByText('Coffee $28')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Clear text' }));
  expect(input).toHaveValue('');
  expect(screen.queryByText('hong4')).not.toBeInTheDocument();
});

it('opens alternative readings without changing the selected pronunciation', async () => {
  const { default: userEvent } = await import('@testing-library/user-event');
  const user = userEvent.setup();
  render(<Reader />);
  await user.type(screen.getByRole('textbox', { name: 'Cantonese text' }), '銀行');
  await user.click(screen.getByRole('button', { name: '行, hong4. View other readings' }));
  const dialog = screen.getByRole('dialog', { name: 'Readings for 行' });
  expect(within(dialog).getByText('haang4')).toBeVisible();
  expect(within(dialog).getByText('hong4')).toBeVisible();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '行, hong4. View other readings' })).toHaveFocus();
});


it('explains a missing character and discards an obsolete selection after an edit', () => {
  render(<Reader />);
  const input = screen.getByRole('textbox', { name: 'Cantonese text' });
  fireEvent.change(input, { target: { value: '𠀀' } });
  fireEvent.click(screen.getByRole('button', { name: '𠀀. No pronunciation found' }));
  expect(within(screen.getByRole('dialog')).getByText('No pronunciation found.')).toBeVisible();
  fireEvent.change(input, { target: { value: '咖啡' } });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByText('gaa3')).toBeVisible();
});

it('keeps whitespace-only input in the empty reading state', () => {
  render(<Reader />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Cantonese text' }), { target: { value: ' \n\t ' } });
  expect(screen.getByText('Paste Cantonese text to see its Jyutping.')).toBeVisible();
  expect(screen.queryByText('?')).not.toBeInTheDocument();
});

