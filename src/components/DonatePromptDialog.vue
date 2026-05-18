<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useLicenseStore } from '@/stores/licenseStore';
import { X, Coffee, Crown, Heart, ArrowRight, Mail, ExternalLink } from 'lucide-vue-next';

const licenseStore = useLicenseStore();

const showVietnameseDetails = ref(false);
const vietPaymentMethod = ref<'momo' | 'bank'>('momo');

// VIETNAMESE DONATION CONFIG
const DONG_DONATE_CONFIG = {
  momoPhone: '092942026',        // Your MoMo phone number (nhantien.momo.vn)
  bankId: 'MB',                 // Bank ID (e.g. VCB for Vietcombank, TCB, MB, ACB...)
  accountNumber: '992942026',    // Your bank account number
  accountName: 'DANG QUOC HUY',   // Your full name (no accent, uppercase)
  amountVnd: 50000               // Small donation amount for coffee e.g. 50k VND (~$2)
};

const vietQrUrl = computed(() => {
  const addInfo = `TRAFEXIA COFFEE DONATION`;
  return `https://img.vietqr.io/image/${DONG_DONATE_CONFIG.bankId}-${DONG_DONATE_CONFIG.accountNumber}-compact.png?amount=${DONG_DONATE_CONFIG.amountVnd}&addInfo=${encodeURIComponent(addInfo)}&accountName=${encodeURIComponent(DONG_DONATE_CONFIG.accountName)}`;
});

onMounted(() => {
  // Only check if user is on Free tier and hasn't opted out permanently
  if (licenseStore.isFree && localStorage.getItem('trafexia_hide_coffee_prompt') !== 'true') {
    // Prompt the user after 10 minutes (600,000 ms) of app usage
    setTimeout(() => {
      if (licenseStore.isFree && localStorage.getItem('trafexia_hide_coffee_prompt') !== 'true') {
        licenseStore.showCoffeeDialog = true;
      }
    }, 10 * 60 * 1000);
  }
});

function close() {
  licenseStore.showCoffeeDialog = false;
}

function payWithBMC() {
  window.open('https://buymeacoffee.com/huypc9294', '_blank');
  close();
}

function disablePermanently() {
  localStorage.setItem('trafexia_hide_coffee_prompt', 'true');
  close();
}
</script>

<template>
  <Transition name="fade">
    <div v-if="licenseStore.showCoffeeDialog && licenseStore.isFree" class="coffee-overlay">
      <div class="coffee-window">
        <button class="close-btn" @click="close">
          <X :size="16" />
        </button>

        <div class="coffee-header">
          <div class="glowing-cup">
            <Coffee :size="36" class="cup-icon" />
            <Heart :size="16" class="heart-icon" />
          </div>
          <h2>Buy the Creator a Coffee!</h2>
          <p class="description">
            Trafexia is built with ☕ and passion. If this tool is saving you time and speeding up your web debugging
            workflow, consider supporting its creator!
          </p>
        </div>

        <div class="options-container">
          <!-- Main Donation Buttons -->
          <div class="main-buttons">
            <!-- Option 1: Buy Me a Coffee -->
            <button class="donate-btn bmc" @click="payWithBMC">
              <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee"
                class="bmc-img" />
              <span>International Coffee ($5)</span>
            </button>

            <!-- Option 2: Vietnamese Local QR Code Trigger -->
            <button class="donate-btn vietnamese" :class="{ active: showVietnameseDetails }"
              @click="showVietnameseDetails = !showVietnameseDetails">
              <div class="btn-left">
                <span class="viet-flag">🇻🇳</span>
                <span>MoMo & VietQR (Vietnam)</span>
              </div>
              <span class="chevron">{{ showVietnameseDetails ? '▲' : '▼' }}</span>
            </button>
          </div>

          <!-- Collapsible Vietnamese Donation Panel -->
          <Transition name="expand">
            <div v-if="showVietnameseDetails" class="vietnamese-panel">
              <div class="tab-selector">
                <button class="tab-btn" :class="{ active: vietPaymentMethod === 'momo' }"
                  @click="vietPaymentMethod = 'momo'">
                  MOMO QR
                </button>
                <button class="tab-btn" :class="{ active: vietPaymentMethod === 'bank' }"
                  @click="vietPaymentMethod = 'bank'">
                  VIETQR BANKING
                </button>
              </div>

              <div class="qr-display-box">
                <div class="qr-wrapper">
                  <!-- MoMo QR Code -->
                  <img v-if="vietPaymentMethod === 'momo'"
                    :src="`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent('https://nhantien.momo.vn/' + DONG_DONATE_CONFIG.momoPhone)}`"
                    alt="MoMo QR" class="qr-image" />
                  <!-- VietQR Banking Code -->
                  <img v-else-if="vietPaymentMethod === 'bank'" :src="vietQrUrl" alt="VietQR QR" class="qr-image" />
                </div>

                <div class="transfer-details">
                  <div v-if="vietPaymentMethod === 'momo'">
                    <p class="instr">Quét mã MoMo để mời tác giả ly cafe **50.000đ**.</p>
                    <p class="note">Nội dung chuyển khoản (Lời nhắn): <br><strong class="highlight">TRAFEXIA COFFEE
                        DONATION</strong></p>
                  </div>
                  <div v-else>
                    <p class="instr">Quét mã ngân hàng (Vietcombank) để mời tác giả ly cafe **50.000đ**.</p>
                    <p class="note">Nội dung chuyển khoản đã được điền sẵn: <br><strong class="highlight">TRAFEXIA
                        COFFEE DONATION</strong></p>
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </div>

        <div class="coffee-footer">
          <button class="footer-btn secondary" @click="close">Maybe Later</button>
          <button class="footer-btn opt-out" @click="disablePermanently">Don't show this again</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.coffee-overlay {
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 23, 0.85);
  backdrop-filter: blur(16px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 11000;
  padding: 20px;
}

.coffee-window {
  width: 100%;
  max-width: 440px;
  background: #0B1120;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 32px;
  position: relative;
  box-shadow: 0 30px 60px -15px rgba(0, 0, 0, 0.8), 0 0 50px rgba(56, 189, 248, 0.03);
  text-align: center;
  max-height: 90vh;
  overflow-y: auto;
}

.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  background: rgba(255, 255, 255, 0.05);
  border: none;
  color: #64748B;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #F1F5F9;
}

.coffee-header {
  margin-bottom: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.glowing-cup {
  position: relative;
  width: 72px;
  height: 72px;
  background: rgba(56, 189, 248, 0.1);
  border: 1px solid rgba(56, 189, 248, 0.2);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #38BDF8;
  margin-bottom: 16px;
  box-shadow: 0 0 20px rgba(56, 189, 248, 0.15);
  animation: pulse 2s infinite alternate;
}

.cup-icon {
  animation: float 3s infinite ease-in-out;
}

.heart-icon {
  position: absolute;
  bottom: 12px;
  right: 12px;
  color: #EF4444;
  fill: #EF4444;
  animation: heartbeat 1.5s infinite;
}

h2 {
  font-size: 22px;
  font-weight: 800;
  color: #F1F5F9;
  margin: 0 0 8px 0;
  letter-spacing: -0.5px;
}

.description {
  font-size: 13px;
  color: #94A3B8;
  line-height: 1.5;
  margin: 0;
  padding: 0 10px;
}

.options-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
}

.main-buttons {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.donate-btn {
  width: 100%;
  height: 48px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
}

.donate-btn.bmc {
  background: #FFDD00;
  color: #000000;
  gap: 8px;
}

.donate-btn.bmc:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(255, 221, 0, 0.2);
}

.bmc-img {
  height: 24px;
}

.donate-btn.vietnamese {
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(255, 255, 255, 0.06);
  color: #F1F5F9;
  justify-content: space-between;
  padding: 0 16px;
}

.donate-btn.vietnamese:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.1);
}

.donate-btn.vietnamese.active {
  background: rgba(16, 185, 129, 0.08);
  border-color: rgba(16, 185, 129, 0.2);
  color: #10B981;
}

.btn-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.viet-flag {
  font-size: 16px;
}

.chevron {
  font-size: 8px;
  color: #64748B;
  transition: transform 0.2s;
}

.donate-btn.vietnamese.active .chevron {
  color: #10B981;
}

/* Vietnamese Panel */
.vietnamese-panel {
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
}

.tab-selector {
  display: flex;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  padding: 3px;
}

.tab-btn {
  flex: 1;
  height: 28px;
  background: none;
  border: none;
  border-radius: 4px;
  color: #64748B;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn.active {
  background: rgba(16, 185, 129, 0.15);
  color: #10B981;
}

.qr-display-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.qr-wrapper {
  width: 140px;
  height: 140px;
  background: white;
  border-radius: 6px;
  padding: 6px;
}

.qr-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.transfer-details {
  font-size: 12px;
  color: #94A3B8;
  line-height: 1.4;
  text-align: left;
  background: rgba(15, 23, 42, 0.4);
  padding: 10px;
  border-radius: 6px;
  width: 100%;
}

.instr {
  margin: 0 0 6px 0;
}

.note {
  margin: 0;
  font-size: 11px;
  color: #64748B;
}

.highlight {
  color: #10B981;
  font-weight: 700;
  font-family: monospace;
}

/* Footer buttons */
.coffee-footer {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.footer-btn {
  background: none;
  border: none;
  font-size: 12px;
  cursor: pointer;
  padding: 6px;
  border-radius: 4px;
  transition: all 0.2s;
}

.footer-btn.secondary {
  color: #94A3B8;
  font-weight: 600;
}

.footer-btn.secondary:hover {
  color: #F1F5F9;
  background: rgba(255, 255, 255, 0.03);
}

.footer-btn.opt-out {
  color: #64748B;
  font-size: 11px;
}

.footer-btn.opt-out:hover {
  color: #EF4444;
  text-decoration: underline;
}

/* Animations */
@keyframes pulse {
  from {
    box-shadow: 0 0 20px rgba(56, 189, 248, 0.1);
  }

  to {
    box-shadow: 0 0 30px rgba(56, 189, 248, 0.25);
  }
}

@keyframes float {

  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-3px);
  }
}

@keyframes heartbeat {

  0%,
  100% {
    transform: scale(1);
  }

  25% {
    transform: scale(1.15);
  }

  50% {
    transform: scale(1);
  }

  75% {
    transform: scale(1.15);
  }
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease-in-out;
  max-height: 280px;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
  padding-top: 0;
  padding-bottom: 0;
  margin: 0;
}
</style>
