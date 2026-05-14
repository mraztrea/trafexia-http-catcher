import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { app } from 'electron';
import type { AndroidDevice, AndroidApp, FridaLogEntry } from '../../../shared/types';
import { downloadFile, decompressXz, getFridaServerUrl, getFridaServerFilename } from '../utils/frida-utils';

const execAsync = promisify(exec);
const DEFAULT_FRIDA_VERSION = "17.9.1";

export class FridaManager {
  private adbPath: string = 'adb';
  private fridaPath: string = 'frida';
  private fridaProcess: ChildProcess | null = null;
  private logCallback: ((log: FridaLogEntry) => void) | null = null;
  private fridaTmpPath: string = '/data/local/tmp';

  constructor() {
    this.detectAdb();
  }

  private detectAdb() {
    const home = os.homedir();
    const commonPaths = [
      path.join(home, 'Library/Android/sdk/platform-tools/adb'),
      path.join(home, 'Android/Sdk/platform-tools/adb'),
      '/usr/local/bin/adb',
      '/opt/homebrew/bin/adb'
    ];

    for (const p of commonPaths) {
      if (fs.existsSync(p)) {
        this.adbPath = p;
        return;
      }
    }
  }

  setLogCallback(callback: (log: FridaLogEntry) => void) {
    this.logCallback = callback;
  }

  private log(message: string, level: FridaLogEntry['level'] = 'info') {
    if (this.logCallback) {
      this.logCallback({
        timestamp: Date.now(),
        message,
        level
      });
    }
    console.log(`[FridaManager] [${level}] ${message}`);
  }

  async checkDependencies() {
    let adb = false;
    let frida = false;
    let fridaTools = false;

    // Check ADB
    try {
      await execAsync(`${this.adbPath} version`);
      adb = true;
    } catch (e) {}

    // Check Frida CLI
    const fridaPaths = [
      'frida',
      '/usr/local/bin/frida',
      '/opt/homebrew/bin/frida',
      path.join(os.homedir(), '.local/bin/frida'),
      path.join(os.homedir(), 'Library/Python/3.9/bin/frida'), // Common on macOS
    ];

    for (const p of fridaPaths) {
      try {
        await execAsync(`${p} --version`);
        this.fridaPath = p;
        frida = true;
        fridaTools = true;
        break;
      } catch (e) {}
    }

    return { adb, frida, fridaTools };
  }

  async getDevices(): Promise<AndroidDevice[]> {
    try {
      const { stdout } = await execAsync(`${this.adbPath} devices -l`);
      const lines = stdout.trim().split('\n');
      const devices: AndroidDevice[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(/\s+/);
        if (parts.length < 2) continue;

        const id = parts[0];
        const status = parts[1];
        const modelMatch = line.match(/model:([^\s]+)/);
        const model = modelMatch ? modelMatch[1].replace(/_/g, ' ') : id;
        const type = id.startsWith('emulator-') ? 'emulator' : 'physical';

        let isRooted = false;
        try {
          const { stdout: suCheck } = await execAsync(`${this.adbPath} -s ${id} shell "which su"`);
          isRooted = suCheck.includes('su');
        } catch (e) {}

        devices.push({
          id,
          model,
          type,
          status,
          isRooted
        });
      }
      return devices;
    } catch (error) {
      this.log(`Failed to list devices: ${error}`, 'error');
      return [];
    }
  }

  async getApps(deviceId: string): Promise<AndroidApp[]> {
    try {
      this.log(`Fetching apps for device: ${deviceId}`);
      // Get all installed 3rd party packages
      const { stdout } = await execAsync(`${this.adbPath} -s ${deviceId} shell pm list packages -3`);
      const lines = stdout.trim().split('\n');
      const apps: AndroidApp[] = [];

      for (const line of lines) {
        if (!line.startsWith('package:')) continue;
        
        const packageName = line.substring(8).trim();
        if (!packageName) continue;
        
        // Try to get app label - we'll do this in parallel for speed (limited batch)
        apps.push({
          packageName,
          label: packageName.split('.').pop() || packageName, // Fallback to last part of package name
          isSystem: false
        });
      }

      // Try to get real labels for the first 50 apps (performance balance)
      // In a real app, we might do this on demand or via a faster method
      
      return apps.sort((a, b) => a.packageName.localeCompare(b.packageName));
    } catch (error) {
      this.log(`Failed to list apps: ${error}`, 'error');
      return [];
    }
  }

  async setupFridaServer(deviceId: string): Promise<boolean> {
    try {
      this.log(`Setting up frida-server on device: ${deviceId}`);
      
      // 1. Check arch
      const { stdout: archRaw } = await execAsync(`${this.adbPath} -s ${deviceId} shell getprop ro.product.cpu.abi`);
      const arch = archRaw.trim();
      this.log(`Device architecture: ${arch}`);

      // 2. Check if trafexia-daemon is already running
      try {
        const { stdout: psStdout } = await execAsync(`${this.adbPath} -s ${deviceId} shell "ps -A | grep trafexia-daemon"`);
        if (psStdout.includes('trafexia-daemon')) {
          this.log('trafexia-daemon is already running');
          return true;
        }
      } catch (e) {}

      // 3. Check if trafexia-daemon exists in /data/local/tmp/
      const serverPath = `${this.fridaTmpPath}/trafexia-daemon`;
      let exists = false;
      try {
        await execAsync(`${this.adbPath} -s ${deviceId} shell "su 0 ls ${serverPath}"`);
        exists = true;
        this.log('frida-server found in /data/local/tmp/');
      } catch (e) {
        this.log('frida-server not found or inaccessible on device. Attempting fresh setup...');
      }

      // Always try to cleanup and re-push if we're here and not running
      try {
        this.log('Preparing clean setup...');
        await execAsync(`${this.adbPath} -s ${deviceId} shell "su 0 rm -f ${serverPath}"`);
        exists = false; // Force re-push after cleanup
      } catch (e) {}

      if (!exists) {
        // Auto-download and push
        const version = DEFAULT_FRIDA_VERSION;
        const cacheDir = path.join(app.getPath('userData'), 'frida-cache');
        if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

        const filename = getFridaServerFilename(arch, version);
        const localXzPath = path.join(cacheDir, `${filename}.xz`);
        const localPath = path.join(cacheDir, filename);

        if (!fs.existsSync(localPath)) {
          this.log(`Downloading frida-server ${version} for ${arch}...`);
          const url = getFridaServerUrl(arch, version);
          await downloadFile(url, localXzPath);
          this.log('Decompressing...');
          await decompressXz(localXzPath, localPath);
          if (fs.existsSync(localXzPath)) fs.unlinkSync(localXzPath);
        }

        this.log(`Pushing frida-server to device...`);
        await execAsync(`${this.adbPath} -s ${deviceId} push "${localPath}" ${serverPath}`);
      }

      this.log('Setting executable permissions via root...');
      await execAsync(`${this.adbPath} -s ${deviceId} shell "su 0 chmod 755 ${serverPath}"`);
      await execAsync(`${this.adbPath} -s ${deviceId} shell "su 0 chown shell:shell ${serverPath}"`);
      this.log('Starting trafexia-daemon...');
      
      // 4. Start frida-server
      // Try multiple ways to start it
      const startCommands = [
        `su 0 "${serverPath} -D -l 0.0.0.0"`,
        `su 0 sh -c "${serverPath} -D -l 0.0.0.0"`,
        `su -c "${serverPath} -D -l 0.0.0.0"`,
        `"${serverPath} -D -l 0.0.0.0"`,
        `su 0 sh -c "nohup ${serverPath} -l 0.0.0.0 > /dev/null 2>&1 &"`,
        `su -c "nohup ${serverPath} -l 0.0.0.0 > /dev/null 2>&1 &"`,
        `nohup ${serverPath} -l 0.0.0.0 > /dev/null 2>&1 &`
      ];

      // Optional: try to disable SELinux enforcement (common on rooted emulators)
      try {
        await execAsync(`${this.adbPath} -s ${deviceId} shell "su 0 setenforce 0"`);
      } catch (e) {}

      let started = false;
      for (const cmd of startCommands) {
        try {
          await execAsync(`${this.adbPath} -s ${deviceId} shell "${cmd}"`);
          this.log(`Started with command: ${cmd}`);
          started = true;
          break;
        } catch (e) {
          this.log(`Command failed: ${cmd}`, 'warning');
        }
      }
      
      if (!started) {
        this.log("Frida-server started without root. Spawning apps might fail. Consider using APK Patching (Gadget) for non-rooted devices.", 'warning');
      }
      
      // Wait a bit and verify
      await new Promise(resolve => setTimeout(resolve, 2000));
      this.log('frida-server setup complete', 'success');
      
      return true;
    } catch (error) {
      this.log(`Failed to setup frida-server: ${error}`, 'error');
      return false;
    }
  }

  async startFrida(deviceId: string, packageName: string, proxyHost: string, proxyPort: number, caCert: string): Promise<void> {
    if (this.fridaProcess) {
      this.stopFrida();
    }

    this.log(`Starting Frida injection for ${packageName} on device ${deviceId}`);

    // Generate config.js
    const configPath = path.join(app.getPath('userData'), 'frida-config.js');
    const configContent = `
// Auto-generated by Trafexia
const PROXY_HOST = '${proxyHost}';
const PROXY_PORT = ${proxyPort};
const CA_CERT = \`${caCert}\`;
const CERT_PEM = CA_CERT;
const DEBUG_MODE = true;

// Export for other scripts if needed
if (typeof module !== 'undefined') {
  module.exports = { PROXY_HOST, PROXY_PORT, CA_CERT, CERT_PEM, DEBUG_MODE };
}
`;
    fs.writeFileSync(configPath, configContent);
    this.log(`Generated Frida config at ${configPath}`);

    // Path to unpinning scripts
    const scriptDir = path.join(process.cwd(), 'electron', 'scripts');
    const unpinningScriptPath = path.join(scriptDir, 'android-certificate-unpinning.js');
    const fallbackScriptPath = path.join(scriptDir, 'android-certificate-unpinning-fallback.js');
    const nativeTlsScriptPath = path.join(scriptDir, 'native-tls-hook-v4.js');
    
    if (!fs.existsSync(unpinningScriptPath)) {
      this.log(`Unpinning script not found at ${unpinningScriptPath}`, 'error');
      throw new Error(`Unpinning script not found at ${unpinningScriptPath}`);
    }

    if (!fs.existsSync(nativeTlsScriptPath)) {
      this.log(`Native TLS script not found at ${nativeTlsScriptPath}`, 'error');
      throw new Error(`Native TLS script not found at ${nativeTlsScriptPath}`);
    }

    // Load order matters! config.js defines CERT_PEM → unpinning.js uses it → fallback uses unpinning fns → native hooks
    const scriptArgs: string[] = [];
    scriptArgs.push('-l', configPath);
    scriptArgs.push('-l', unpinningScriptPath);
    if (fs.existsSync(fallbackScriptPath)) {
      scriptArgs.push('-l', fallbackScriptPath);
    }
    scriptArgs.push('-l', nativeTlsScriptPath);

    const args = [
      '-D', deviceId,
      '-f', packageName,
      ...scriptArgs
    ];

    this.log(`Running: ${this.fridaPath} ${args.join(' ')}`);

    this.fridaProcess = spawn(this.fridaPath, args);

    this.fridaProcess.stdout?.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg) this.log(msg, 'info');
    });

    this.fridaProcess.stderr?.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg) {
        if (msg.includes('Error') || msg.includes('Failed')) {
          this.log(msg, 'error');
        } else {
          this.log(msg, 'warning');
        }
      }
    });

    this.fridaProcess.on('close', (code) => {
      this.log(`Frida process exited with code ${code}`, code === 0 ? 'info' : 'error');
      this.fridaProcess = null;
    });

    this.fridaProcess.on('error', (err) => {
      this.log(`Frida process error: ${err.message}`, 'error');
      this.fridaProcess = null;
    });
  }

  stopFrida() {
    if (this.fridaProcess) {
      this.log('Stopping Frida process...');
      this.fridaProcess.kill();
      this.fridaProcess = null;
    }
  }
}
