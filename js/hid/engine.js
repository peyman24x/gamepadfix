/**
 * js/hid/engine.js
 * HID-Fix WebHID Communication Engine (Standardized Integration Version)
 * مدیریت لایه فیزیکی اتصال، پایش پورت‌ها و رهگیری پکت‌های خام سخت‌افزار
 */

import { AppState } from '../core/state.js';

// فیلتر سخت‌افزاری برای شناسایی اختصاصی کنترلرهای سونی و مایکروسافت
const DEVICE_FILTERS = [
    { vendorId: 0x054C }, // Sony Interactive Entertainment (DS4 / DualSense)
    { vendorId: 0x045E }  // Microsoft Corporation (Xbox One / Series Controllers)
];

export const HidEngine = {
    activeDevice: null,
    onLog: null,           // پل ارتباطی ارسال لاگ به کالبک درون app.js
    onInputReceived: null, // پل ارتباطی ارسال پکت‌های زنده به app.js

    /**
     * متد هوشمند مدیریت و ارسال ایمن لاگ‌ها بدون کرش دادن سیستم
     */
    log(message, type = 'info') {
        if (this.onLog) {
            this.onLog(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    },

    /**
     * مقداردهی اولیه و شنود رویدادهای فیزیکی سیستم‌عامل
     */
    init() {
        if (!navigator.hid) {
            this.log('مرورگر شما از WebHID API پشتیبانی نمی‌کند. از مروگرهای مبتنی بر Chromium استفاده کنید.', 'error');
            return;
        }

        // شنود رویدادهای سیستمی اتصال مجدد خودکار کابل یا بلوتوث
        navigator.hid.addEventListener('connect', (event) => {
            this.log(`دستگاه شناسایی‌شده قبلی متصل شد: ${event.device.productName}`, 'info');
            this.handleDeviceConnection(event.device);
        });

        navigator.hid.addEventListener('disconnect', (event) => {
            if (this.activeDevice && this.activeDevice === event.device) {
                this.log(`ارتباط فیزیکی دستگاه قطع شد: ${event.device.productName}`, 'warning');
                this.disconnectDevice();
            }
        });

        // تلاش برای اتصال خودکار به دستگاه‌هایی که از قبل مجوز دارند
        this.autoConnectExistingDevices();
    },

    /**
     * ⚡ برطرف‌کننده باگ اصلی: متد متصل‌کننده لایه کلیک دکمه در app.js
     */
    async connectDevice() {
        if (AppState.connection.isConnected) {
            await this.disconnectDevice();
        } else {
            await this.requestDevicePermission();
        }
    },

    /**
     * درخواست رسمی از کاربر برای صدور مجوز دسترسی به پورت سخت‌افزار (پاپ‌آپ مرورگر)
     */
    async requestDevicePermission() {
        try {
            this.log('در انتظار انتخاب دستگاه توسط کاربر در پنجره امنیتی مرورگر...', 'info');
            const devices = await navigator.hid.requestDevice({ filters: DEVICE_FILTERS });
            
            if (devices && devices.length > 0) {
                await this.handleDeviceConnection(devices[0]);
                return true;
            } else {
                this.log('فرآیند اتصال توسط کاربر لغو شد.', 'warning');
                return false;
            }
        } catch (error) {
            this.log(`خطا در احراز هویت سخت‌افزار: ${error.message}`, 'error');
            return false;
        }
    },

    /**
     * تلاش برای جفت‌شدن خودکار با کنترلر بدون باز شدن پنجره پاپ‌آپ مجدد
     */
    async autoConnectExistingDevices() {
        try {
            const devices = await navigator.hid.getDevices();
            const validDevice = devices.find(d => DEVICE_FILTERS.some(f => f.vendorId === d.vendorId));
            
            if (validDevice) {
                this.log(`اتصال مجدد خودکار به: ${validDevice.productName}`, 'info');
                await this.handleDeviceConnection(validDevice);
            }
        } catch (error) {
            console.error('Auto-connect failed:', error);
        }
    },

    /**
     * باز کردن پورت داده، تشخیص نوع اتصال و تزریق شنود پکت‌ها
     */
    async handleDeviceConnection(device) {
        try {
            if (!device.opened) {
                await device.open();
            }

            this.activeDevice = device;
            
            // تشخیص نوع اتصال بر اساس پروتکل یا نام دستگاه
            const isBluetooth = device.productName.toLowerCase().includes('wireless') || 
                                device.collections[0]?.inputReports?.some(r => r.reportId === 0x11 || r.reportId === 0x31);
            
            // 🔄 همگام‌سازی دقیق با فیلدهای ساختار State شما جهت باز شدن قفل رندر لوپ
            AppState.connection.isConnected = true;
            AppState.connection.type = isBluetooth ? 'bluetooth' : 'usb';
            AppState.connection.interface = device;
            
            AppState.deviceInfo.name = device.productName;
            AppState.deviceInfo.vendorId = device.vendorId; // ذخیره به صورت عدد خالص جهت بیلد متد .toString(16) در app.js
            AppState.deviceInfo.productId = device.productId; 
            
            this.log(`ارتباط با موفقیت برقرار شد. پروتکل: WebHID (${AppState.connection.type.toUpperCase()})`, 'success');

            // فعال‌سازی شنود لحظه‌ای پکت‌های ورودی سخت‌افزار
            device.addEventListener('inputreport', (event) => this.routeInputReport(event));

        } catch (error) {
            this.log(`خطا در باز کردن پورت سخت‌افزار: ${error.message}`, 'error');
            this.disconnectDevice();
        }
    },

    /**
     * هدایت پکت ورودی خام به دکودر اختصاصی متناظر در هسته اصلی
     */
    routeInputReport(event) {
        const { reportId, data, device } = event;
        
        // محاسبه فرکانس زنده ارسال داده کنترلر
        this.calculatePollingRate(device.vendorId);

        // هدایت مستقیم پکت داده به کالبک شنودر ارکستراتور (app.js)
        if (this.onInputReceived) {
            this.onInputReceived(device.vendorId, reportId, data);
        }
    },

    /**
     * محاسبه زنده نرخ نمونه‌برداری سخت‌افزار (Polling Rate Counter)
     */
    lastTimestamp: performance.now(),
    packetCount: 0,
    calculatePollingRate(vendorId) {
        this.packetCount++;
        const now = performance.now();
        if (now - this.lastTimestamp >= 1000) {
            const hz = Math.round((this.packetCount * 1000) / (now - this.lastTimestamp));
            
            if (vendorId === 0x054C) {
                AppState.analysis.left.pollingRate = hz;
            } else {
                AppState.analysis.right.pollingRate = hz;
            }
            
            this.packetCount = 0;
            this.lastTimestamp = now;
        }
    },

    /**
     * بستن پورت و بازنشانی وضعیت نرم‌افزار به حالت امن دیسکانکت
     */
    async disconnectDevice() {
        if (this.activeDevice) {
            try {
                await this.activeDevice.close();
            } catch (e) { /* ignore */ }
            this.activeDevice = null;
        }

        // بازنشانی فیلدها مطابق ساختار دقیق state.js پروژه شما
        AppState.connection.isConnected = false;
        AppState.connection.type = null;
        AppState.connection.interface = null;
        
        AppState.analysis.left.pollingRate = 0;
        AppState.analysis.right.pollingRate = 0;

        this.log('دستگاه از سامانه جدا شد. تمام بخش‌ها غیرفعال شدند.', 'warning');
    },

    /**
     * ارسال پکت ویژگی (Feature Report) به حافظه داخلی/فریمور دسته
     */
    async sendFeatureReport(reportId, buffer) {
        if (!this.activeDevice) return false;
        try {
            await this.activeDevice.sendFeatureReport(reportId, buffer);
            this.log(`پکت ویژگی رایت شد: ReportID (0x${reportId.toString(16).toUpperCase()})`, 'packet');
            return true;
        } catch (error) {
            this.log(`خطا در ارسال پکت به سخت‌افزار: ${error.message}`, 'error');
            return false;
        }
    }
};
