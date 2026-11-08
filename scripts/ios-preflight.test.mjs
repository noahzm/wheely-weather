import { describe, expect, it, vi } from 'vitest';

import { checkIOSPrerequisites } from './ios-preflight.mjs';

const DEVICE = { udid: 'simulator-1', name: 'Test iPhone', state: 'Booted' };
const APP = { slug: 'wheely-weather', ios: { bundleIdentifier: 'app.wheelyweather' } };

function prerequisites(overrides = {}) {
  const run = vi.fn((command, args) => {
    if (command === 'java')
      return Promise.resolve({ stdout: '', stderr: 'openjdk version "21.0.1"' });
    if (command === 'plutil')
      return Promise.resolve({
        stdout: JSON.stringify({
          CFBundleURLTypes: [{ CFBundleURLSchemes: ['exp+wheely-weather'] }],
        }),
      });
    if (args.includes('devices'))
      return Promise.resolve({ stdout: JSON.stringify({ devices: { ios: [DEVICE] } }) });
    if (args.includes('get_app_container'))
      return Promise.resolve({ stdout: '/mock/app-container\n' });
    return Promise.resolve({ stdout: '', stderr: '' });
  });
  return {
    platform: 'darwin',
    env: {},
    app: APP,
    run,
    locateMaestro: vi.fn(() => Promise.resolve('/test/maestro')),
    fetchImpl: vi.fn(() => Promise.resolve(new Response('packager-status:running'))),
    report: vi.fn(),
    ...overrides,
  };
}

describe('iOS preflight', () => {
  it('checks the installed dev client and Metro without booting or launching anything', async () => {
    const options = prerequisites();
    await expect(checkIOSPrerequisites(options)).resolves.toEqual({
      device: DEVICE,
      maestro: '/test/maestro',
    });
    expect(
      options.run.mock.calls.some(
        ([, args]) => args.includes('boot') || args.includes('openurl') || args.includes('test'),
      ),
    ).toBe(false);
    expect(options.fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:8081/status',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('fails immediately outside macOS', async () => {
    const options = prerequisites({ platform: 'linux' });
    await expect(checkIOSPrerequisites(options)).rejects.toThrow('require macOS');
    expect(options.run).not.toHaveBeenCalled();
  });

  it('rejects unsupported Java before starting simulator checks', async () => {
    const options = prerequisites();
    const base = options.run.getMockImplementation();
    options.run.mockImplementation((command, args) =>
      command === 'java'
        ? Promise.resolve({ stdout: '', stderr: 'java version "1.8.0"' })
        : base(command, args),
    );
    await expect(checkIOSPrerequisites(options)).rejects.toThrow('Java 17+');
    expect(options.locateMaestro).not.toHaveBeenCalled();
  });

  it('reports missing Maestro', async () => {
    const options = prerequisites({
      locateMaestro: () => Promise.reject(new Error('Maestro is missing')),
    });
    await expect(checkIOSPrerequisites(options)).rejects.toThrow('Maestro is missing');
  });

  it.each([{ devices: [] }, { devices: [DEVICE, { ...DEVICE, udid: 'simulator-2' }] }])(
    'rejects ambiguous or absent booted simulators: %j',
    async ({ devices }) => {
      const options = prerequisites();
      const base = options.run.getMockImplementation();
      options.run.mockImplementation((command, args) =>
        args.includes('devices')
          ? Promise.resolve({ stdout: JSON.stringify({ devices: { ios: devices } }) })
          : base(command, args),
      );
      await expect(checkIOSPrerequisites(options)).rejects.toThrow(
        /No matching booted|Multiple simulators/,
      );
    },
  );

  it('uses an explicitly selected booted simulator', async () => {
    const options = prerequisites({ env: { IOS_SIMULATOR_UDID: DEVICE.udid } });
    const base = options.run.getMockImplementation();
    options.run.mockImplementation((command, args) =>
      args.includes('devices')
        ? Promise.resolve({
            stdout: JSON.stringify({
              devices: { ios: [DEVICE, { ...DEVICE, udid: 'simulator-2' }] },
            }),
          })
        : base(command, args),
    );
    const result = await checkIOSPrerequisites(options);
    expect(result.device).toEqual(DEVICE);
  });

  it('rejects an unresponsive simulator before checking the app', async () => {
    const options = prerequisites();
    const base = options.run.getMockImplementation();
    options.run.mockImplementation((command, args) =>
      args.includes('spawn')
        ? Promise.reject(new Error('simctl exceeded 8 seconds'))
        : base(command, args),
    );
    await expect(checkIOSPrerequisites(options)).rejects.toThrow('exceeded 8 seconds');
    expect(options.fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects an installed production app in development mode', async () => {
    const options = prerequisites();
    const base = options.run.getMockImplementation();
    options.run.mockImplementation((command, args) =>
      command === 'plutil' ? Promise.resolve({ stdout: '{}' }) : base(command, args),
    );
    await expect(checkIOSPrerequisites(options)).rejects.toThrow('not the dev client');
    expect(options.fetchImpl).not.toHaveBeenCalled();
  });

  it('skips dev-client and Metro checks for an explicit release build', async () => {
    const options = prerequisites({ env: { MAESTRO_RELEASE_BUILD: 'true' } });
    await checkIOSPrerequisites(options);
    expect(options.fetchImpl).not.toHaveBeenCalled();
    expect(options.run.mock.calls.some(([command]) => command === 'plutil')).toBe(false);
  });

  it.each([
    () => Promise.resolve(new Response('different server')),
    () => Promise.reject(new Error('connection refused')),
  ])('explains Metro failures', async (fetchImpl) => {
    await expect(checkIOSPrerequisites(prerequisites({ fetchImpl }))).rejects.toThrow(
      'Metro is unreachable',
    );
  });
});
