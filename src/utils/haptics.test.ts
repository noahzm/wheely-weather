import { beforeEach, describe, expect, it, vi } from 'vitest';

const haptics = vi.hoisted(() => ({
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
  selectionAsync: vi.fn<() => Promise<void>>(),
  notificationAsync: vi.fn<(type: string) => Promise<void>>(),
}));

vi.mock('expo-haptics', () => haptics);

const { selectionFeedback, verdictFeedback } = await import('./haptics');

beforeEach(() => {
  vi.resetAllMocks();
  haptics.selectionAsync.mockResolvedValue();
  haptics.notificationAsync.mockResolvedValue();
});

describe('haptics', () => {
  it('triggers selection and verdict haptics and swallows unsupported-platform rejections', () => {
    selectionFeedback();
    expect(haptics.selectionAsync).toHaveBeenCalledTimes(1);

    verdictFeedback('yes');
    verdictFeedback('maybe');
    verdictFeedback('no');
    expect(haptics.notificationAsync).toHaveBeenNthCalledWith(1, 'success');
    expect(haptics.notificationAsync).toHaveBeenNthCalledWith(2, 'warning');
    expect(haptics.notificationAsync).toHaveBeenNthCalledWith(3, 'error');

    haptics.selectionAsync.mockRejectedValueOnce(new Error('not supported'));
    haptics.notificationAsync.mockRejectedValueOnce(new Error('not supported'));
    expect(() => {
      selectionFeedback();
    }).not.toThrow();
    expect(() => {
      verdictFeedback('yes');
    }).not.toThrow();
  });
});
