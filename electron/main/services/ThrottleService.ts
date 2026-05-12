import type { ThrottleProfile, ThrottlePreset } from '../../../shared/types';
import { THROTTLE_PRESETS } from '../../../shared/types';
import type { TrafficStorage } from './TrafficStorage';

const THROTTLE_SETTING_KEY = 'throttle_profile';

export class ThrottleService {
  private storage: TrafficStorage;
  private profile: ThrottleProfile;

  constructor(storage: TrafficStorage) {
    this.storage = storage;
    this.profile = this.getDefaultProfile();
  }

  /**
   * Initialize - load from storage
   */
  async initialize(): Promise<void> {
    const saved = this.storage.getSetting(THROTTLE_SETTING_KEY);
    if (saved) {
      try {
        this.profile = JSON.parse(saved);
        console.log(`[ThrottleService] Loaded profile: ${this.profile.preset}, enabled: ${this.profile.enabled}`);
      } catch {
        this.profile = this.getDefaultProfile();
      }
    }
  }

  /**
   * Get current throttle profile
   */
  getProfile(): ThrottleProfile {
    return { ...this.profile };
  }

  /**
   * Set throttle profile
   */
  setProfile(profile: ThrottleProfile): void {
    // If using a preset, apply its values
    if (profile.preset !== 'custom' && profile.preset !== 'none') {
      const preset = THROTTLE_PRESETS[profile.preset as Exclude<ThrottlePreset, 'custom' | 'none'>];
      if (preset) {
        profile.downloadSpeed = preset.download;
        profile.uploadSpeed = preset.upload;
        profile.latency = preset.latency;
      }
    }

    this.profile = profile;
    this.saveProfile();
    console.log(`[ThrottleService] Profile set: ${profile.preset}, enabled: ${profile.enabled}`);
  }

  /**
   * Disable throttling
   */
  disable(): void {
    this.profile.enabled = false;
    this.saveProfile();
    console.log('[ThrottleService] Throttling disabled');
  }

  /**
   * Check if throttling is active
   */
  isEnabled(): boolean {
    return this.profile.enabled && this.profile.preset !== 'none';
  }

  /**
   * Check if a URL should be throttled
   */
  shouldThrottle(url: string): boolean {
    if (!this.isEnabled()) return false;
    
    if (this.profile.urlPattern) {
      try {
        const regex = new RegExp(this.profile.urlPattern, 'i');
        return regex.test(url);
      } catch {
        return true; // If regex is invalid, throttle all
      }
    }

    return true; // No URL filter = throttle all
  }

  /**
   * Get delay for a response based on its size
   * Returns milliseconds to delay
   */
  calculateDelay(sizeBytes: number, direction: 'download' | 'upload'): number {
    if (!this.isEnabled()) return 0;

    const speed = direction === 'download' 
      ? this.profile.downloadSpeed 
      : this.profile.uploadSpeed;

    if (speed <= 0) return 0;

    // Calculate transfer time in ms
    const transferTimeMs = (sizeBytes / speed) * 1000;
    
    // Add base latency
    const totalDelay = transferTimeMs + this.profile.latency;

    return Math.round(totalDelay);
  }

  /**
   * Check if packet should be "lost" (simulated packet loss)
   */
  shouldDropPacket(): boolean {
    if (!this.isEnabled() || this.profile.packetLoss <= 0) return false;
    return Math.random() * 100 < this.profile.packetLoss;
  }

  /**
   * Apply throttling to a stream by chunking data and adding delays
   * Returns a function that, given the full buffer, returns delayed chunks
   */
  createThrottledWriter(totalSize: number, direction: 'download' | 'upload'): {
    delay: number;
    chunkSize: number;
    chunks: number;
  } {
    if (!this.isEnabled()) {
      return { delay: 0, chunkSize: totalSize, chunks: 1 };
    }

    const speed = direction === 'download'
      ? this.profile.downloadSpeed
      : this.profile.uploadSpeed;

    if (speed <= 0) {
      return { delay: this.profile.latency, chunkSize: totalSize, chunks: 1 };
    }

    // Chunk every 100ms worth of data
    const chunkInterval = 100; // ms
    const chunkSize = Math.max(1, Math.floor(speed * (chunkInterval / 1000)));
    const chunks = Math.ceil(totalSize / chunkSize);

    return {
      delay: chunkInterval,
      chunkSize,
      chunks,
    };
  }

  private getDefaultProfile(): ThrottleProfile {
    return {
      enabled: false,
      preset: 'none',
      downloadSpeed: 0,
      uploadSpeed: 0,
      latency: 0,
      packetLoss: 0,
    };
  }

  private saveProfile(): void {
    this.storage.setSetting(THROTTLE_SETTING_KEY, JSON.stringify(this.profile));
  }
}
