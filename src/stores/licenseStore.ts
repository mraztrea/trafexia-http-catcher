import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { LicenseInfo, LicenseTier } from '@shared/types';
import { FEATURE_GATES } from '@shared/types';

export const useLicenseStore = defineStore('license', () => {
  const license = ref<LicenseInfo>({
    tier: 'free',
    isValid: true,
  });
  const featureGates = ref<Record<string, LicenseTier>>({ ...FEATURE_GATES });
  const isLoading = ref(false);
  const showUpgradeDialog = ref(false);
  const upgradeFeature = ref<string>('');

  // Getters
  const isPro = computed(() => license.value.tier === 'pro' || license.value.tier === 'team');
  const isTeam = computed(() => license.value.tier === 'team');
  const isFree = computed(() => license.value.tier === 'free');
  
  const tierLabel = computed(() => {
    switch (license.value.tier) {
      case 'pro': return 'Pro';
      case 'team': return 'Team';
      default: return 'Free';
    }
  });

  const daysRemaining = computed(() => {
    if (!license.value.expiresAt) return null;
    const days = Math.ceil((license.value.expiresAt - Date.now()) / (24 * 60 * 60 * 1000));
    return Math.max(0, days);
  });

  // Actions
  async function loadLicense() {
    isLoading.value = true;
    try {
      const [licenseData, gatesData] = await Promise.all([
        window.electronAPI.getLicense(),
        window.electronAPI.getFeatureGates()
      ]);
      license.value = licenseData;
      if (gatesData && Object.keys(gatesData).length > 0) {
        featureGates.value = gatesData;
      }
    } catch (error) {
      console.error('Failed to load license or gates:', error);
    } finally {
      isLoading.value = false;
    }
  }

  async function activateLicense(key: string, email: string) {
    isLoading.value = true;
    try {
      license.value = await window.electronAPI.activateLicense(key, email);
      // Refresh gates after activation
      const gatesData = await window.electronAPI.getFeatureGates();
      if (gatesData) featureGates.value = gatesData;
      return true;
    } catch (error) {
      console.error('Failed to activate license:', error);
      throw error;
    } finally {
      isLoading.value = false;
    }
  }

  async function deactivateLicense() {
    isLoading.value = true;
    try {
      await window.electronAPI.deactivateLicense();
      license.value = { tier: 'free', isValid: true };
    } catch (error) {
      console.error('Failed to deactivate license:', error);
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Check if a feature is available
   */
  function hasFeature(featureId: string): boolean {
    const requiredTier = featureGates.value[featureId] || FEATURE_GATES[featureId];
    if (!requiredTier || requiredTier === 'free') return true;

    const tierLevel: Record<LicenseTier, number> = {
      'free': 0,
      'pro': 1,
      'team': 2,
    };

    return tierLevel[license.value.tier] >= tierLevel[requiredTier];
  }

  /**
   * Guard a feature - if not available, show upgrade dialog
   * Returns true if feature is available
   */
  function guardFeature(featureId: string): boolean {
    if (hasFeature(featureId)) return true;
    
    upgradeFeature.value = featureId;
    showUpgradeDialog.value = true;
    return false;
  }

  return {
    // State
    license,
    featureGates,
    isLoading,
    showUpgradeDialog,
    upgradeFeature,

    // Getters
    isPro,
    isTeam,
    isFree,
    tierLabel,
    daysRemaining,

    // Actions
    loadLicense,
    activateLicense,
    deactivateLicense,
    hasFeature,
    guardFeature,
  };
});
