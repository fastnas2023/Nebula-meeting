import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import { getRoomIdFromSearch, removeRoomIdFromHref } from './roomIdUrl';
import RejoinPrompt from '../components/RejoinPrompt';

const t = (key) => {
  const map = {
    rejoin_prompt_title: '返回会议',
    rejoin_prompt_text: '检测到您刚离开会议，是否立即返回？',
    cancel_btn: '取消',
    return_meeting_btn: '返回会议',
  };
  return map[key] || key;
};

function Harness() {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    const id = getRoomIdFromSearch(window.location.search);
    if (id) setOpen(true);
  }, []);
  const cancel = () => {
    const nextHref = removeRoomIdFromHref(window.location.href);
    window.history.replaceState({}, '', nextHref);
    setOpen(false);
  };
  const confirm = () => setOpen(false);
  return open ? <RejoinPrompt t={t} onCancel={cancel} onConfirm={confirm} /> : null;
}

describe('rejoin flow', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('shows dialog when entering with roomId', () => {
    window.history.replaceState({}, '', '/?roomId=room-123');
    render(<Harness />);
    expect(screen.getByText('检测到您刚离开会议，是否立即返回？')).toBeInTheDocument();
  });

  it('cancel removes roomId via replaceState and closes dialog', () => {
    const spy = vi.spyOn(window.history, 'replaceState');
    window.history.replaceState({}, '', '/?roomId=room-123');
    render(<Harness />);
    fireEvent.click(screen.getByText('取消'));
    expect(spy).toHaveBeenCalled();
    expect(window.location.search.includes('roomId=')).toBe(false);
  });

  it('shows dialog again after refresh (remount) with roomId', () => {
    window.history.replaceState({}, '', '/?roomId=room-123');
    const { unmount } = render(<Harness />);
    expect(screen.getByText('检测到您刚离开会议，是否立即返回？')).toBeInTheDocument();
    unmount();
    render(<Harness />);
    expect(screen.getByText('检测到您刚离开会议，是否立即返回？')).toBeInTheDocument();
  });

  it('no dialog when entering without roomId', () => {
    window.history.replaceState({}, '', '/');
    render(<Harness />);
    expect(screen.queryByText('检测到您刚离开会议，是否立即返回？')).toBeNull();
  });
});
