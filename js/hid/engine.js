/**
 * HID-Fix WebHID Communication Engine (ES2024)
 * مدیریت لایه فیزیکی اتصال، پایش پورت‌ها و رهگیری پکت‌های خام سخت‌افزار
 */

import { AppState, resetAppStateInputs } from '../core/state.js';

const DEVICE_FILTERS = [
    { vendorId: 0x054C }, // Sony Interactive Entertainment (DS4 / DualSense)
    { vendorId: 0x045E }  // Microsoft Corporation (Xbox One / Series Controllers)
];

export const HidEngine = {
    activeDevice: null,
    onInputReceived: null, // هوک ارتباطی با اکستراتور اصلی

    init() {
        if (!navigator.hid) {
            AppState.log('مرورگر شما از WebHID API پشتیبانی نمی‌کند. از مروگرهای مبتنی بر Chromium استفاده کنید.', 'error');
            return;
        }

        navigator.hid.addEventListener('connect', (event) => {
            AppState.log(`دستگاه شناسایی‌شده قبلی متصل شد: ${event.device.productName}`, 'info');
            this.handleDeviceConnection(event.device);
        });

        navigator.hid.addEventListener('disconnect', (event) => {
            if (this.activeDevice && this.activeDevice === event.device) {
                AppState.log(`ارتباط فیزیکی دستگاه قطع شد: ${event.device.productName}`, 'warning');
                this.disconnectDevice();
            }
        });

        this.autoConnectExistingDevices();
    },

    async requestDevicePermission() {
        try {
            AppState.connection.status = 'connecting';
            AppState.log('در انتظار انتخاب دستگاه توسط کاربر در پنجره امنیتی مرورگر...', 'info');
            
            const devices = await navigator.hid.requestDevice({ filters: DEVICE_FILTERS });
            
            if (devices && devices.length > 0) {
                await this.handleDeviceConnection(devices[0]);
                return true;
            } else {
                AppState.connection.status = 'disconnected';
                AppState.connection.isConnected = false;
                AppState.log('فرآیند اتصال توسط کاربر لغو شد.', 'warning');
                return false;
            }
        } catch (error) {
            AppState.connection.status = 'error';
            AppState.connection.isConnected = false;
            AppState.log(`خطا در احراز هویت سخت‌افزار: ${error.message}`, 'error');
            return false;
        }
    },

    async autoConnectExistingDevices() {
        try {
            const devices = await navigator.hid.getDevices();
            const validDevice = devices.find(d => DEVICE_FILTERS.some(f => f.vendorId === d.vendorId));
            
            if (validDevice) {
                AppState.log(`اتصال مجدد خودکار به: ${validDevice.productName}`, 'info');
                await this.handleDeviceConnection(validDevice);
            }
        } catch (error) {
            console.error('Auto-connect failed:', error);
        }
    },

    async handleDeviceConnection(device) {
        try {
            if (!device.opened) {
                await device.open();
            }

            this.activeDevice = device;
            const isBluetooth = device.productName.toLowerCase().includes('wireless') || 
                                device.collections[0]?.inputReports?.some(r => r.reportId === 0x11);
            
            // همگام‌سازی کامل استیت اتصال
            AppState.connection.status = 'connected';
            AppState.connection.isConnected = true;
            AppState.connection.type = isBluetooth ? 'Bluetooth' : 'USB';
            
            AppState.deviceInfo.name = device.productName;
            AppState.deviceInfo.vendorId = `0x${device.vendorId.toString(16).toUpperCase().padStart(4, '0')}`;
            AppState.deviceInfo.productId = `0x${device.productId.toString(16).toUpperCase().padStart(4, '0')}`;
            
            AppState.log(`ارتباط امن برقرار شد. پروتکل: WebHID (${AppState.connection.type})`, 'success');

            device.addEventListener('inputreport', (event) => this.routeInputReport(event));

        } catch (error) {
            AppState.connection.status = 'error';
            AppState.connection.isConnected = false;
            AppState.log(`خطا در باز کردن پورت سخت‌افزار: ${error.message}`, 'error');
            this.disconnectDevice();
        }
    },

    routeInputReport(event) {
        const { reportId, data, device } = event;
        this.calculatePollingRate(device.vendorId);

        // ارسال مستقیم دیتای باینری امن (DataView) به هوک ثبت شده در هسته اصلی
        if (this.onInputReceived) {
            this.onInputReceived(reportId, data);
        }
    },

    lastTimestamp: performance.now(),
    packetCount: 0,
    calculatePollingRate(vendorId) {
        this.packetCount++;
        const now = performance.now();
        if (now - this.lastTimestamp >= 1000) {
            const hz = Math.round((this.packetCount * 1000) / (now - this.lastTimestamp));
            // تنظیم پولینگ ریت واقعی کل سخت‌افزار
            AppState.analysis.left.pollingRate = hz;
            AppState.analysis.right.pollingRate = hz;
            
            this.packetCount = 0;
            this.lastTimestamp = now;
        }
    },

    async disconnectDevice() {
        if (this.activeDevice) {
            try {
                await this.activeDevice.close();
            } catch (e) { /* ignore */ }
                this.activeDevice = null;
        }

        AppState.connection.status = 'disconnected';
        AppState.connection.isConnected = false;
        AppState.connection.type = null;
        resetAppStateInputs();
        AppState.log('دستگاه از سامانه جدا شد. تمام بخش‌ها غیرفعال شدند.', 'warning');
    }
};
