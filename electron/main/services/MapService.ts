import * as fs from 'fs';
import type { TrafficStorage } from './TrafficStorage';
import type { MapRule } from '../../../shared/types';

const MAP_RULES_SETTING_KEY = 'map_rules';

export class MapService {
  private storage: TrafficStorage;
  private rules: MapRule[] = [];

  constructor(storage: TrafficStorage) {
    this.storage = storage;
  }

  /**
   * Load rules from storage
   */
  async loadRules(): Promise<void> {
    const saved = this.storage.getSetting(MAP_RULES_SETTING_KEY);
    if (saved) {
      try {
        this.rules = JSON.parse(saved);
        console.log(`[MapService] Loaded ${this.rules.length} map rules`);
      } catch {
        this.rules = [];
      }
    }
  }

  /**
   * Get all rules
   */
  getRules(): MapRule[] {
    return [...this.rules];
  }

  /**
   * Add a new rule
   */
  addRule(rule: Omit<MapRule, 'id'>): MapRule {
    const newRule: MapRule = {
      ...rule,
      id: this.generateId(),
      created_at: Date.now(),
    };
    this.rules.push(newRule);
    this.saveRules();
    return newRule;
  }

  /**
   * Update a rule
   */
  updateRule(id: string, updates: Partial<MapRule>): void {
    const index = this.rules.findIndex(r => r.id === id);
    if (index !== -1) {
      this.rules[index] = { ...this.rules[index], ...updates };
      this.saveRules();
    }
  }

  /**
   * Delete a rule
   */
  deleteRule(id: string): void {
    this.rules = this.rules.filter(r => r.id !== id);
    this.saveRules();
  }

  /**
   * Toggle a rule
   */
  toggleRule(id: string, enabled: boolean): void {
    const rule = this.rules.find(r => r.id === id);
    if (rule) {
      rule.enabled = enabled;
      this.saveRules();
    }
  }

  /**
   * Find matching rule for a request
   */
  findMatchingRule(method: string, url: string): MapRule | null {
    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      // Check method filter
      if (rule.sourceMethod && rule.sourceMethod !== method) continue;

      // Check URL pattern
      try {
        const regex = new RegExp(rule.sourceUrlPattern, 'i');
        if (regex.test(url)) {
          return rule;
        }
      } catch {
        // Invalid regex, skip
        console.warn(`[MapService] Invalid regex: ${rule.sourceUrlPattern}`);
      }
    }
    return null;
  }

  /**
   * Apply a Map Remote rule - transform the target URL
   */
  applyRemoteMapping(rule: MapRule, originalUrl: string): string {
    if (rule.type !== 'remote' || !rule.destinationUrl) return originalUrl;

    try {
      const regex = new RegExp(rule.sourceUrlPattern, 'i');
      return originalUrl.replace(regex, rule.destinationUrl);
    } catch {
      return rule.destinationUrl;
    }
  }

  /**
   * Apply a Map Local rule - read content from a local file
   */
  applyLocalMapping(rule: MapRule): { status: number; headers: Record<string, string>; body: string } | null {
    if (rule.type !== 'local' || !rule.localFilePath) return null;

    try {
      if (!fs.existsSync(rule.localFilePath)) {
        console.warn(`[MapService] Local file not found: ${rule.localFilePath}`);
        return null;
      }

      const body = fs.readFileSync(rule.localFilePath, 'utf-8');
      const ext = rule.localFilePath.split('.').pop()?.toLowerCase();
      
      // Auto-detect content type from extension
      const contentTypeMap: Record<string, string> = {
        'json': 'application/json',
        'html': 'text/html',
        'xml': 'application/xml',
        'js': 'application/javascript',
        'css': 'text/css',
        'txt': 'text/plain',
        'svg': 'image/svg+xml',
      };

      const autoContentType = contentTypeMap[ext || ''] || 'text/plain';
      const headers: Record<string, string> = {
        'content-type': autoContentType,
        'x-trafexia-mapped': 'local',
        ...(rule.localResponseHeaders || {}),
      };

      return {
        status: rule.localResponseStatus || 200,
        headers,
        body,
      };
    } catch (err) {
      console.error('[MapService] Error reading local file:', err);
      return null;
    }
  }

  private generateId(): string {
    return `map_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  private saveRules(): void {
    this.storage.setSetting(MAP_RULES_SETTING_KEY, JSON.stringify(this.rules));
  }
}
