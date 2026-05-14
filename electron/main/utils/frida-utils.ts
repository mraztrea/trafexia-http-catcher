import * as fs from 'fs';
import * as https from 'https';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const doRequest = (reqUrl: string, redirectCount: number) => {
      if (redirectCount > 5) {
        reject(new Error("Too many redirects"));
        return;
      }

      https.get(reqUrl, (response) => {
        if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          response.destroy();
          doRequest(response.headers.location, redirectCount + 1);
          return;
        }

        if (response.statusCode !== 200) {
          response.destroy();
          reject(new Error(`HTTP ${response.statusCode} downloading ${reqUrl}`));
          return;
        }

        response.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
      }).on("error", (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    };
    doRequest(url, 0);
  });
}

export async function decompressXz(xzPath: string, outputPath: string): Promise<void> {
  try {
    // Try using system xz command
    await execAsync(`xz -dk "${xzPath}" -c > "${outputPath}"`);
  } catch {
    try {
      await execAsync(`unxz -k "${xzPath}" -c > "${outputPath}"`);
    } catch {
      throw new Error(
        "xz decompression tool not found. Please install xz:\n" +
        "  macOS: brew install xz\n" +
        "  Linux: sudo apt install xz-utils\n" +
        "  Windows: install 7-Zip or xz from https://tukaani.org/xz/"
      );
    }
  }
}

export function getFridaServerFilename(arch: string, version: string): string {
  // Map common Android ABIs to Frida architecture identifiers
  const archMap: Record<string, string> = {
    'arm64-v8a': 'android-arm64',
    'armeabi-v7a': 'android-arm',
    'armeabi': 'android-arm',
    'x86_64': 'android-x86_64',
    'x86': 'android-x86',
    'arm64': 'android-arm64',
    'arm': 'android-arm'
  };
  
  const fridaArch = archMap[arch] || arch;
  return `frida-server-${version}-${fridaArch}`;
}

export function getFridaServerUrl(arch: string, version: string): string {
  const filename = getFridaServerFilename(arch, version);
  return `https://github.com/frida/frida/releases/download/${version}/${filename}.xz`;
}
