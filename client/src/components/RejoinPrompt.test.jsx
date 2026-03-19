import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RejoinPrompt from './RejoinPrompt';

const t = (key) => {
  const map = {
    rejoin_prompt_title: '返回会议',
    rejoin_prompt_text: '检测到您刚离开会议，是否立即返回？',
    cancel_btn: '取消',
    return_meeting_btn: '返回会议',
  };
  return map[key] || key;
};

describe('RejoinPrompt', () => {
  it('shows prompt and supports ESC/backdrop as cancel', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<RejoinPrompt t={t} onConfirm={onConfirm} onCancel={onCancel} />);

    expect(screen.getByText('检测到您刚离开会议，是否立即返回？')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);

    const dialog = screen.getByRole('dialog');
    fireEvent.click(dialog);
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});

