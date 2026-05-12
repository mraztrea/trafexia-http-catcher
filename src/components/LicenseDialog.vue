<script setup lang="ts">
import { ref, computed } from 'vue';
import { useLicenseStore } from '@/stores/licenseStore';
import { X, Crown, Zap, Shield, Rocket, Check, Star } from 'lucide-vue-next';
import { useToast } from 'primevue/usetoast';

const licenseStore = useLicenseStore();
const toast = useToast();

const licenseKey = ref('');
const email = ref('');
const isActivating = ref(false);
const activePanel = ref<'info' | 'activate'>('info');

const featureLabels: Record<string, string> = {
  'map-rules': 'Map Local / Map Remote',
  'throttle': 'Network Throttling',
  'diff-compare': 'Request Diff & Compare',
  'advanced-export': 'Advanced Export (HAR, Python, Postman)',
  'session-save': 'Save & Load Sessions',
  'ssl-bypass': 'SSL Pinning Bypass',
  'unlimited-mock': 'Unlimited Mock Rules',
  'unlimited-breakpoints': 'Unlimited Breakpoints',
  'scripting': 'JavaScript Scripting Engine',
  'websocket': 'WebSocket Inspection',
  'graphql': 'GraphQL Viewer',
  'shared-sessions': 'Shared Team Sessions',
};

const requestedFeatureLabel = computed(() => {
  return featureLabels[licenseStore.upgradeFeature] || licenseStore.upgradeFeature;
});

const proFeatures = [
  'Map Local / Map Remote',
  'Network Throttling (3G, 4G, etc.)',
  'Request Diff & Compare',
  'Advanced Export Formats',
  'Save & Load Sessions',
  'SSL Pinning Bypass Tools',
  'Unlimited Mock Rules',
  'Unlimited Breakpoints',
  'WebSocket Inspection',
  'GraphQL Viewer',
  'Priority Support',
];

async function activate() {
  if (!licenseKey.value.trim() || !email.value.trim()) {
    toast.add({ severity: 'warn', summary: 'Missing Info', detail: 'Please enter both license key and email', life: 3000 });
    return;
  }

  isActivating.value = true;
  try {
    await licenseStore.activateLicense(licenseKey.value.trim(), email.value.trim());
    toast.add({ severity: 'success', summary: 'Activated!', detail: `Welcome to Trafexia ${licenseStore.tierLabel}!`, life: 5000 });
    close();
  } catch (err: any) {
    toast.add({ severity: 'error', summary: 'Activation Failed', detail: err.message || 'Invalid license key', life: 5000 });
  } finally {
    isActivating.value = false;
  }
}

function close() {
  licenseStore.showUpgradeDialog = false;
  licenseStore.upgradeFeature = '';
  licenseKey.value = '';
  email.value = '';
  activePanel.value = 'info';
}

function openPurchase() {
  // Open purchase page in browser
  window.open('https://trafexia.dev/pricing', '_blank');
}
</script>

<template>
  <Teleport to="body">
    <div v-if="licenseStore.showUpgradeDialog" class="upgrade-overlay" @click.self="close">
      <div class="upgrade-dialog">
        <!-- Close button -->
        <button class="close-btn" @click="close">
          <X :size="20" />
        </button>

        <!-- Header -->
        <div class="upgrade-header">
          <div class="crown-icon">
            <Crown :size="32" />
          </div>
          <h2>Upgrade to Trafexia Pro</h2>
          <p class="subtitle" v-if="licenseStore.upgradeFeature">
            <Zap :size="14" />
            <strong>{{ requestedFeatureLabel }}</strong> requires Pro
          </p>
          <p class="subtitle" v-else>
            Unlock all premium features
          </p>
        </div>

        <!-- Info Panel -->
        <div v-if="activePanel === 'info'" class="upgrade-body">
          <!-- Pricing Card -->
          <div class="pricing-card">
            <div class="pricing-badge">MOST POPULAR</div>
            <div class="pricing-tier">Pro</div>
            <div class="pricing-price">
              <span class="price-amount">$29</span>
              <span class="price-period">/year</span>
            </div>
            <div class="pricing-monthly">or $4.99/month</div>
            
            <div class="features-list">
              <div v-for="feature in proFeatures" :key="feature" class="feature-item">
                <Check :size="16" class="feature-check" />
                <span>{{ feature }}</span>
              </div>
            </div>

            <button class="btn-purchase" @click="openPurchase">
              <Rocket :size="18" />
              Get Trafexia Pro
            </button>
          </div>

          <!-- Already have key? -->
          <div class="activate-link">
            <span>Already have a license key?</span>
            <button class="btn-link" @click="activePanel = 'activate'">
              Activate here →
            </button>
          </div>

          <!-- Testimonial -->
          <div class="testimonial">
            <div class="stars">
              <Star v-for="i in 5" :key="i" :size="14" fill="#fbbf24" color="#fbbf24" />
            </div>
            <p>"Trafexia replaced both Proxyman and Charles for me. The SSL bypass tools alone are worth it."</p>
            <span class="author">— Developer, 1.1k+ GitHub Stars</span>
          </div>
        </div>

        <!-- Activate Panel -->
        <div v-if="activePanel === 'activate'" class="upgrade-body">
          <div class="activate-form">
            <div class="form-group">
              <label>Email Address</label>
              <input 
                v-model="email"
                type="email" 
                placeholder="your@email.com"
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label>License Key</label>
              <input 
                v-model="licenseKey"
                type="text" 
                placeholder="TRFX-XXXX-XXXX-XXXX-XXXX"
                class="form-input mono"
                maxlength="24"
              />
            </div>
            
            <button 
              class="btn-activate" 
              @click="activate"
              :disabled="isActivating"
            >
              <Shield :size="18" />
              {{ isActivating ? 'Activating...' : 'Activate License' }}
            </button>

            <button class="btn-back" @click="activePanel = 'info'">
              ← Back to pricing
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.upgrade-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.upgrade-dialog {
  background: linear-gradient(135deg, #1a1f2e 0%, #0f1419 100%);
  border: 1px solid rgba(88, 166, 255, 0.2);
  border-radius: 20px;
  width: 480px;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
  box-shadow: 0 25px 80px rgba(0, 0, 0, 0.5), 0 0 60px rgba(88, 166, 255, 0.1);
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: #8b949e;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  z-index: 1;
}

.close-btn:hover {
  background: rgba(248, 81, 73, 0.2);
  color: #f85149;
}

.upgrade-header {
  text-align: center;
  padding: 32px 32px 0;
}

.crown-icon {
  width: 64px;
  height: 64px;
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
  color: #1a1f2e;
  box-shadow: 0 8px 30px rgba(251, 191, 36, 0.3);
}

.upgrade-header h2 {
  font-size: 24px;
  font-weight: 700;
  color: #e6edf3;
  margin: 0 0 8px;
}

.subtitle {
  color: #8b949e;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.subtitle strong {
  color: #58a6ff;
}

.upgrade-body {
  padding: 24px 32px 32px;
}

/* Pricing Card */
.pricing-card {
  background: linear-gradient(135deg, rgba(88, 166, 255, 0.08), rgba(136, 96, 208, 0.08));
  border: 1px solid rgba(88, 166, 255, 0.2);
  border-radius: 16px;
  padding: 24px;
  text-align: center;
  position: relative;
  overflow: hidden;
}

.pricing-badge {
  position: absolute;
  top: 12px;
  right: -28px;
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  color: #1a1f2e;
  font-size: 10px;
  font-weight: 700;
  padding: 4px 32px;
  transform: rotate(35deg);
  letter-spacing: 0.5px;
}

.pricing-tier {
  font-size: 14px;
  font-weight: 600;
  color: #58a6ff;
  text-transform: uppercase;
  letter-spacing: 2px;
  margin-bottom: 8px;
}

.pricing-price {
  margin-bottom: 4px;
}

.price-amount {
  font-size: 48px;
  font-weight: 800;
  color: #e6edf3;
  line-height: 1;
}

.price-period {
  font-size: 18px;
  color: #8b949e;
  font-weight: 400;
}

.pricing-monthly {
  font-size: 13px;
  color: #6e7681;
  margin-bottom: 20px;
}

.features-list {
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 24px;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: #c9d1d9;
}

.feature-check {
  color: #3fb950;
  flex-shrink: 0;
}

.btn-purchase {
  width: 100%;
  padding: 14px 24px;
  background: linear-gradient(135deg, #58a6ff, #8860d0);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.3s;
  box-shadow: 0 8px 25px rgba(88, 166, 255, 0.3);
}

.btn-purchase:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 35px rgba(88, 166, 255, 0.4);
}

/* Activate Link */
.activate-link {
  text-align: center;
  margin-top: 20px;
  font-size: 13px;
  color: #6e7681;
}

.btn-link {
  background: none;
  border: none;
  color: #58a6ff;
  cursor: pointer;
  font-size: 13px;
  padding: 0;
  margin-left: 4px;
}

.btn-link:hover {
  text-decoration: underline;
}

/* Testimonial */
.testimonial {
  margin-top: 24px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  text-align: center;
}

.stars {
  display: flex;
  justify-content: center;
  gap: 2px;
  margin-bottom: 8px;
}

.testimonial p {
  font-size: 13px;
  color: #c9d1d9;
  font-style: italic;
  margin: 0 0 8px;
  line-height: 1.5;
}

.testimonial .author {
  font-size: 12px;
  color: #6e7681;
}

/* Activate Form */
.activate-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 12px;
  font-weight: 600;
  color: #8b949e;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.form-input {
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(48, 54, 61, 0.8);
  border-radius: 10px;
  color: #e6edf3;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.form-input:focus {
  border-color: #58a6ff;
}

.form-input.mono {
  font-family: 'SF Mono', 'Consolas', monospace;
  letter-spacing: 1px;
}

.btn-activate {
  padding: 14px 24px;
  background: linear-gradient(135deg, #3fb950, #2ea043);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.3s;
  margin-top: 8px;
}

.btn-activate:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 25px rgba(63, 185, 80, 0.3);
}

.btn-activate:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-back {
  background: none;
  border: none;
  color: #8b949e;
  font-size: 13px;
  cursor: pointer;
  text-align: center;
  padding: 8px;
}

.btn-back:hover {
  color: #e6edf3;
}
</style>
