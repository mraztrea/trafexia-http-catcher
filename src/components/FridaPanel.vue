<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from "vue";
import Dropdown from "primevue/dropdown";
import {
  Smartphone,
  Search,
  Zap,
  Play,
  Square,
  Loader2,
  Trash2,
  RefreshCw,
  Cpu,
  ShieldCheck,
  AlertTriangle,
  Info,
  Terminal,
  Activity,
  Package
} from "lucide-vue-next";
import { useFridaStore } from "@/stores/fridaStore";

const store = useFridaStore();
const searchQuery = ref("");
const logContainerRef = ref<HTMLElement | null>(null);
const deps = ref({ adb: false, frida: false, fridaTools: false });
const isCheckingDeps = ref(false);

const filteredApps = computed(() => {
  if (!searchQuery.value) return store.apps;
  const q = searchQuery.value.toLowerCase();
  return store.apps.filter(app => 
    app.packageName.toLowerCase().includes(q) || 
    app.label.toLowerCase().includes(q)
  );
});

let listeners: any[] = [];
let scrollThrottleTimer: any = null;

onMounted(async () => {
  listeners.push(window.electronAPI.onFridaLog((log) => {
    store.addLog(log);
    
    // Throttle auto-scroll
    if (!scrollThrottleTimer) {
      scrollThrottleTimer = setTimeout(() => {
        if (logContainerRef.value) {
          logContainerRef.value.scrollTop = logContainerRef.value.scrollHeight;
        }
        scrollThrottleTimer = null;
      }, 200);
    }
  }));

  await checkDependencies();
  await store.fetchDevices();
});

onUnmounted(() => {
  listeners.forEach(l => l?.());
  if (scrollThrottleTimer) clearTimeout(scrollThrottleTimer);
});

async function checkDependencies() {
  isCheckingDeps.value = true;
  try {
    deps.value = await store.checkDependencies();
  } finally {
    isCheckingDeps.value = false;
  }
}

async function refreshDevices() {
  await store.fetchDevices();
}

async function handleDeviceChange() {
  if (store.selectedDeviceId) {
    await store.fetchApps(store.selectedDeviceId);
  }
}

watch(() => store.selectedDeviceId, handleDeviceChange);

async function setupFridaServer() {
  if (!store.selectedDeviceId) return;
  await store.setupServer(store.selectedDeviceId);
}

async function toggleFrida() {
  if (store.isRunning) {
    await store.stopInjection();
  } else {
    await store.startInjection();
  }
}

function copyLogs() {
  const text = store.fridaLogs.map(l => `[${new Date(l.timestamp).toLocaleTimeString()}] ${l.message}`).join('\n');
  navigator.clipboard.writeText(text);
}
</script>

<template>
  <div class="frida-panel">
    <div class="panel-layout">
      <!-- Left Sidebar: Device & App Selection -->
      <div class="sidebar">
        <!-- Dependency Status -->
        <div class="card dep-card">
          <div class="card-header">
            <div class="title"><ShieldCheck :size="14" /> DEPENDENCIES</div>
            <button class="icon-btn" @click="checkDependencies" :disabled="isCheckingDeps">
              <RefreshCw :size="12" :class="{ 'animate-spin': isCheckingDeps }" />
            </button>
          </div>
          <div class="dep-list">
            <div class="dep-item" :class="{ ok: deps.adb }">
              <span>ADB Engine</span>
              <ShieldCheck v-if="deps.adb" :size="12" />
              <AlertTriangle v-else :size="12" />
            </div>
            <div class="dep-item" :class="{ ok: deps.fridaTools }">
              <span>Frida Tools</span>
              <ShieldCheck v-if="deps.fridaTools" :size="12" />
              <AlertTriangle v-else :size="12" />
            </div>
          </div>
          <div v-if="!deps.adb || !deps.fridaTools" class="dep-warning">
            <Info :size="10" />
            <span>Install ADB and `pip install frida-tools`</span>
          </div>
        </div>

        <!-- Device Selection -->
        <div class="card device-card">
          <div class="card-header">
            <div class="title"><Smartphone :size="14" /> DEVICE</div>
            <button class="icon-btn" @click="refreshDevices">
              <RefreshCw :size="12" />
            </button>
          </div>
          <Dropdown 
            v-model="store.selectedDeviceId" 
            :options="store.devices" 
            optionLabel="model" 
            optionValue="id" 
            placeholder="Select Device..."
            class="dropdown-eg" 
            appendTo="self"
          >
            <template #option="slotProps">
              <div class="device-option">
                <div class="d-top">
                  <span class="d-model">{{ slotProps.option.model }}</span>
                  <span v-if="!slotProps.option.isRooted" class="root-badge no">NO ROOT</span>
                  <span v-else class="root-badge yes">ROOTED</span>
                </div>
                <span class="d-id">{{ slotProps.option.id }}</span>
              </div>
            </template>
          </Dropdown>
          
          <button 
            v-if="store.selectedDeviceId" 
            class="setup-btn" 
            @click="setupFridaServer"
            :disabled="store.status === 'injecting'"
          >
            <Zap :size="14" />
            <span>SETUP FRIDA-SERVER</span>
          </button>
        </div>

        <!-- App Selection -->
        <div class="card apps-card">
          <div class="card-header">
            <div class="title"><Cpu :size="14" /> TARGET APP</div>
          </div>
          <div class="search-wrap">
            <Search :size="14" class="search-icon" />
            <input v-model="searchQuery" placeholder="Search apps..." />
          </div>
          <div class="apps-list">
            <div 
              v-for="app in filteredApps" 
              :key="app.packageName"
              class="app-item"
              :class="{ selected: store.selectedPackageName === app.packageName }"
              @click="store.selectedPackageName = app.packageName"
            >
              <div class="app-icon">
                <Package :size="16" />
              </div>
              <div class="app-info">
                <div class="app-label">{{ app.label }}</div>
                <div class="app-pkg">{{ app.packageName }}</div>
              </div>
            </div>
            <div v-if="store.status === 'checking'" class="skeleton-list">
              <div v-for="i in 6" :key="i" class="skeleton-item">
                <div class="s-icon"></div>
                <div class="s-text">
                  <div class="s-title"></div>
                  <div class="s-sub"></div>
                </div>
              </div>
            </div>
            <div v-else-if="store.apps.length === 0" class="empty-state">
              <span>No apps found. Select a device first.</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Content: Log Console -->
      <div class="main-content">
        <div class="console-box">
          <div class="console-header">
            <div class="status-wrap">
              <div class="status-indicator" :class="store.status"></div>
              <span class="status-text">{{ store.status.toUpperCase() }}</span>
              <span v-if="store.selectedApp" class="target-name">/ {{ store.selectedApp.label }}</span>
            </div>
            <div class="actions">
              <button class="action-btn" @click="copyLogs" title="Copy Logs">
                <Activity :size="14" />
              </button>
              <button class="action-btn" @click="store.clearLogs" title="Clear Console">
                <Trash2 :size="14" />
              </button>
            </div>
          </div>
          <div class="console-body" ref="logContainerRef">
            <div v-for="(log, idx) in store.fridaLogs" :key="idx" class="log-line" :class="log.level">
              <span class="log-ts">[{{ new Date(log.timestamp).toLocaleTimeString() }}]</span>
              <span class="log-msg">{{ log.message }}</span>
            </div>
            <div v-if="store.fridaLogs.length === 0" class="empty-console">
              <Terminal :size="48" class="watermark" />
              <p>FRIDA INTERCEPTION ENGINE READY</p>
              <p class="sub">SELECT A DEVICE AND APP TO BEGIN INJECTION</p>
            </div>
          </div>
          <div class="console-footer">
            <button 
              class="inject-btn" 
              :class="{ running: store.isRunning }"
              @click="toggleFrida"
              :disabled="!store.selectedDeviceId || !store.selectedPackageName"
            >
              <Loader2 v-if="store.status === 'injecting'" class="animate-spin" :size="16" />
              <Play v-else-if="!store.isRunning" :size="16" fill="currentColor" />
              <Square v-else :size="16" fill="currentColor" />
              <span>{{ store.isRunning ? 'STOP INJECTION' : 'START BYPASS INJECTION' }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.frida-panel {
  height: 100%;
  background: #0B1120;
  color: #F1F5F9;
  padding: 16px;
}

.panel-layout {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 16px;
  height: 100%;
}

.sidebar {
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
}

.card {
  background: rgba(15, 23, 42, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 12px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.card-header .title {
  font-size: 11px;
  font-weight: 900;
  color: #64748B;
  letter-spacing: 1px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-btn {
  background: transparent;
  border: none;
  color: #38BDF8;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
}

.icon-btn:hover { background: rgba(56, 189, 248, 0.1); }

.dep-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dep-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: #F85149;
}

.dep-item.ok { color: #10B981; }

.dep-warning {
  margin-top: 12px;
  padding: 8px;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.2);
  border-radius: 4px;
  font-size: 10px;
  color: #F59E0B;
  display: flex;
  align-items: center;
  gap: 6px;
}

.setup-btn {
  width: 100%;
  margin-top: 12px;
  height: 32px;
  background: rgba(56, 189, 248, 0.1);
  border: 1px solid rgba(56, 189, 248, 0.2);
  border-radius: 6px;
  color: #38BDF8;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
}

.setup-btn:hover { background: rgba(56, 189, 248, 0.2); }

.search-wrap {
  position: relative;
  margin-bottom: 12px;
}

.search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: #475569;
}

.search-wrap input {
  width: 100%;
  height: 32px;
  background: rgba(2, 6, 23, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 0 10px 0 32px;
  color: #F1F5F9;
  font-size: 12px;
}

.apps-list {
  height: 300px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.app-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.app-item:hover { background: rgba(255, 255, 255, 0.03); }
.app-item.selected { background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.2); }

.app-icon {
  width: 32px;
  height: 32px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94A3B8;
}

.app-info {
  flex: 1;
  min-width: 0;
}

.app-label {
  font-size: 12px;
  font-weight: 700;
  color: #F1F5F9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.app-pkg {
  font-size: 10px;
  color: #64748B;
  font-family: monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.empty-state {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: 11px;
  color: #475569;
  padding: 20px;
}

.main-content {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.console-box {
  flex: 1;
  background: #020617;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.console-header {
  height: 40px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
}

.status-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #334155;
}

.status-indicator.running { background: #10B981; box-shadow: 0 0 8px #10B981; }
.status-indicator.injecting { background: #8B5CF6; animation: pulse 1s infinite; }
.status-indicator.error { background: #F85149; }

.status-text {
  font-size: 10px;
  font-weight: 900;
  color: #64748B;
  letter-spacing: 1px;
}

.target-name {
  font-size: 10px;
  font-weight: 700;
  color: #38BDF8;
}

.action-btn {
  background: transparent;
  border: none;
  color: #475569;
  cursor: pointer;
  padding: 6px;
  border-radius: 4px;
}

.action-btn:hover { color: #F1F5F9; background: rgba(255, 255, 255, 0.05); }

.console-body {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 12px;
  line-height: 1.6;
}

.log-line {
  margin-bottom: 4px;
  display: flex;
  gap: 12px;
}

.log-line.error { color: #F85149; }
.log-line.warning { color: #F59E0B; }
.log-line.info { color: #94A3B8; }
.log-line.success { color: #10B981; }

.log-ts {
  color: #334155;
  flex-shrink: 0;
}

.empty-console {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #1E293B;
  text-align: center;
}

.watermark { opacity: 0.1; margin-bottom: 24px; }
.empty-console p { font-weight: 900; font-size: 14px; letter-spacing: 2px; }
.empty-console .sub { font-size: 10px; letter-spacing: 1px; margin-top: 8px; }

.console-footer {
  padding: 16px;
  background: rgba(2, 6, 23, 0.8);
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.inject-btn {
  width: 100%;
  height: 48px;
  background: #38BDF8;
  color: #0F172A;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  cursor: pointer;
  transition: all 0.2s;
  letter-spacing: 1px;
}

.inject-btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.1); }
.inject-btn.running { background: rgba(248, 81, 73, 0.1); color: #F85149; border: 1px solid rgba(248, 81, 73, 0.2); }
.inject-btn:disabled { opacity: 0.3; cursor: not-allowed; filter: grayscale(1); }

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}

.animate-spin { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

:deep(.dropdown-eg) {
  width: 100%;
  background: rgba(2, 6, 23, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

:deep(.p-dropdown-label) { color: #F1F5F9; font-size: 12px; padding: 8px 12px; }
:deep(.p-dropdown-panel) { background: #0F172A; border: 1px solid rgba(255, 255, 255, 0.1); }
:deep(.p-dropdown-item) { color: #94A3B8; padding: 8px 12px; font-size: 12px; }
:deep(.p-dropdown-item:hover) { background: rgba(56, 189, 248, 0.1); color: #38BDF8; }

.device-option { display: flex; flex-direction: column; gap: 2px; }
.d-model { font-weight: 700; color: #F1F5F9; }
.d-id { font-size: 10px; color: #64748B; font-family: monospace; }

.d-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }

.root-badge {
  font-size: 8px;
  font-weight: 900;
  padding: 2px 6px;
  border-radius: 4px;
  letter-spacing: 0.5px;
}

.root-badge.no { background: rgba(248, 81, 73, 0.1); color: #F85149; border: 1px solid rgba(248, 81, 73, 0.2); }
.root-badge.yes { background: rgba(16, 185, 129, 0.1); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.2); }

/* Skeleton Loading */
.skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skeleton-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  opacity: 0.5;
}

.s-icon {
  width: 32px;
  height: 32px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  animation: pulse 1.5s infinite;
}

.s-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.s-title {
  width: 60%;
  height: 10px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 2px;
  animation: pulse 1.5s infinite;
}

.s-sub {
  width: 40%;
  height: 8px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 2px;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { opacity: 0.3; }
  50% { opacity: 0.7; }
  100% { opacity: 0.3; }
}
</style>
