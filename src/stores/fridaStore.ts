import { defineStore } from "pinia";
import { ref, computed, shallowRef } from "vue";
import type { AndroidDevice, AndroidApp, FridaLogEntry } from "@shared/types";

export type FridaStatus = 'idle' | 'checking' | 'injecting' | 'running' | 'error';

export const useFridaStore = defineStore("frida", () => {
  // State
  const devices = ref<AndroidDevice[]>([]);
  const selectedDeviceId = ref<string | null>(null);
  const apps = ref<AndroidApp[]>([]);
  const selectedPackageName = ref<string | null>(null);
  const isRunning = ref(false);
  const fridaLogs = shallowRef<FridaLogEntry[]>([]);
  const status = ref<FridaStatus>('idle');
  const error = ref<string | null>(null);

  // Buffer for high-frequency log updates
  let logBuffer: FridaLogEntry[] = [];
  let updateTimer: any = null;

  // Getters
  const selectedDevice = computed(() => 
    devices.value.find(d => d.id === selectedDeviceId.value) || null
  );
  
  const selectedApp = computed(() => 
    apps.value.find(a => a.packageName === selectedPackageName.value) || null
  );

  // Actions
  async function fetchDevices() {
    try {
      devices.value = await window.electronAPI.fridaGetDevices();
      if (devices.value.length > 0 && !selectedDeviceId.value) {
        selectedDeviceId.value = devices.value[0].id;
      }
    } catch (err) {
      console.error("Failed to fetch devices:", err);
    }
  }

  async function fetchApps(deviceId: string) {
    status.value = 'checking';
    try {
      apps.value = await window.electronAPI.fridaGetApps(deviceId);
      status.value = 'idle';
    } catch (err) {
      console.error("Failed to fetch apps:", err);
      status.value = 'error';
      error.value = "Failed to fetch apps from device";
    }
  }

  async function checkDependencies() {
    return await window.electronAPI.fridaCheckDeps();
  }

  async function setupServer(deviceId: string) {
    status.value = 'injecting';
    try {
      const success = await window.electronAPI.fridaSetupServer(deviceId);
      if (success) {
        status.value = 'idle';
        return true;
      } else {
        status.value = 'error';
        error.value = "Failed to setup frida-server";
        return false;
      }
    } catch (err) {
      status.value = 'error';
      error.value = String(err);
      return false;
    }
  }

  async function startInjection() {
    if (!selectedDeviceId.value || !selectedPackageName.value) return;

    status.value = 'injecting';
    fridaLogs.value = [];
    isRunning.value = true;
    
    try {
      await window.electronAPI.fridaStart(selectedDeviceId.value, selectedPackageName.value);
      status.value = 'running';
    } catch (err) {
      console.error("Failed to start Frida:", err);
      status.value = 'error';
      error.value = String(err);
      isRunning.value = false;
    }
  }

  async function stopInjection() {
    try {
      await window.electronAPI.fridaStop();
    } finally {
      isRunning.value = false;
      status.value = 'idle';
    }
  }

  function addLog(log: FridaLogEntry) {
    logBuffer.push(log);
    
    if (!updateTimer) {
      updateTimer = setTimeout(() => {
        const newLogs = [...fridaLogs.value, ...logBuffer];
        // Capped at 500 logs for history
        fridaLogs.value = newLogs.slice(-500);
        logBuffer = [];
        updateTimer = null;
      }, 100);
    }
  }

  function clearLogs() {
    fridaLogs.value = [];
  }

  return {
    // State
    devices,
    selectedDeviceId,
    apps,
    selectedPackageName,
    isRunning,
    fridaLogs,
    status,
    error,

    // Getters
    selectedDevice,
    selectedApp,

    // Actions
    fetchDevices,
    fetchApps,
    checkDependencies,
    setupServer,
    startInjection,
    stopInjection,
    addLog,
    clearLogs
  };
});
