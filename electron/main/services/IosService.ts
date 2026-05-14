import { exec } from 'child_process';
import { promisify } from 'util';
import type { IosDevice } from '../../../shared/types';

const execAsync = promisify(exec);

export class IosService {
  /**
   * List all available iOS simulators
   */
  async listDevices(): Promise<IosDevice[]> {
    try {
      if (process.platform !== 'darwin') {
        return [];
      }

      const { stdout } = await execAsync('xcrun simctl list devices --json');
      const data = JSON.parse(stdout);
      const devices: IosDevice[] = [];

      // xcrun simctl returns devices grouped by runtime (e.g. iOS 15.0)
      for (const [runtime, runtimeDevices] of Object.entries(data.devices)) {
        // Only include iOS runtimes
        if (!runtime.includes('iOS')) continue;

        const runtimeName = runtime.split('.').pop() || runtime;

        for (const device of (runtimeDevices as any[])) {
          // Filter out unavailable devices if needed
          if (device.isAvailable === false) continue;

          devices.push({
            udid: device.udid,
            name: device.name,
            state: device.state,
            isAvailable: device.isAvailable,
            runtime: runtimeName
          });
        }
      }

      return devices;
    } catch (error) {
      console.error('[IosService] Failed to list devices:', error);
      return [];
    }
  }

  /**
   * Launch a specific iOS simulator
   */
  async launchDevice(udid: string): Promise<boolean> {
    try {
      console.log(`[IosService] Launching device: ${udid}`);
      // Open Simulator app first
      await execAsync('open -a Simulator');
      // Boot the specific UDID
      await execAsync(`xcrun simctl boot ${udid}`);
      return true;
    } catch (error) {
      // If already booted, xcrun will throw but we can ignore it
      if (error instanceof Error && error.message.includes('Unable to boot device in current state: Booted')) {
          return true;
      }
      console.error(`[IosService] Failed to launch device ${udid}:`, error);
      return false;
    }
  }
}
