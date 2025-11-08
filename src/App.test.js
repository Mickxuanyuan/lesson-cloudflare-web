import { render, screen } from '@testing-library/react';
import App from './App';

test('renders chat textarea and disabled send button initially', () => {
  render(<App />);
  const textarea = screen.getByPlaceholderText(/输入你在 DeFi/i);
  expect(textarea).toBeInTheDocument();
  const button = screen.getByRole('button', { name: /发送/ });
  expect(button).toBeDisabled();
});
