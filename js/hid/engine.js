/**
 * js/hid/engine.js
 * DualShock / DualSense Calibration Tool - WebHID Communication Engine
 * مدیریت لایه اتصال سخت‌افزاری و دریافت پکت‌های خام ورودی کنترلرهای سونی
 */

import { AppState, resetAppStateInputs } from '../core/state.js';

export const HidEngine = {
    // شناسه انحصاری کارخانه سونی (Sony Interactive Entertainment)
    SONY_VENDOR_ID: 0x054C,
    
    // پل ارتباطی برای ارسال باینری پکت‌ها به دکودر (توسط app.js مقداردهی می‌شود)
    onInputReceived: null,

    // متغیرهای داخلی محاسبات فرکانس سخت‌افزار (Polling Rate Counter)
    packetCount: 0,
    lastTimestamp: performance.now(),

    /**
     * مقداردهی اولیه و شنود رویدادهای فیزیکی سیستم‌عامل (وصل یا قطع شدن کابل)
     */
    init() {
        if (!navigator.hid) {
            AppState.log('مرورگر شما از WebHID API پشتیبانی نمی‌کند. لطفاً از مرورگرهای بر پایه Chromium (گوگل کروم، اج، اپرا) استفاده کنید.', 'error');
            return;
        }

        // شنود رویداد اتصال مجدد خودکار کنترلرهایی که قبلاً اجازه دسترسی گرفته‌اند
        navigator.hid.addEventListener('connect', (event) => {
            if (event.device.vendorId === this.SONY_VENDOR_ID) {
                AppState.log(`کنترلر سونی متصل به سیستم شناسایی شد: ${event.device.productName}`, 'info');
                this.handleDeviceConnection(event.device);
            }
        });

        // شنود رویداد قطع ناگهانی ارتباط سخت‌افزاری
        navigator.hid.addEventListener('disconnect', (event) => {
            if (AppState.connection.device === event.device) {
                AppState.log(`ارتباط فیزیکی کنترلر قطع شد: ${event.device.productName}`, 'warning');
                this.disconnectDevice();
            }
        });
    },

    /**
     * فراخوانی پنجره ایمن مرورگر جهت انتخاب کنترلر توسط کاربر
     */
    async connectDevice() {
        if (!navigator.hid) return;

        try {
            // فیلتر دقیق پورت فقط برای نمایش دستگاه‌های ساخت شرکت سونی
            const devices = await navigator.hid.requestDevice({
                filters: [{ vendorId: this.SONY_VENDOR_ID }]
            });

            if (devices && devices.length > 0) {
                await this.handleDeviceConnection(devices[0]);
            } else {
                AppState.log('فرآیند اتصال توسط کاربر لغو شد.', 'warning');
            }
        } catch (error) {
            AppState.log(`خطا در دسترسی به لایه WebHID: ${error.message}`, 'error');
        }
    },

    /**
     * باز کردن پورت داده، ارزیابی شناسه محصول و آغاز رهگیری پکت‌ها
     */
    async handleDeviceConnection(device) {
        if (!device) return;

        try {
            // اگر ارتباط از قبل باز نیست، پورت را باز کن
            if (!device.opened) {
                await device.open();
            }

            // ذخیره رفرنس سخت‌افزار و تغییر وضعیت در استیت متمرکز
            AppState.connection.device = device;
            AppState.connection.isConnected = true;
            AppState.connection.status = 'connected';
            
            AppState.deviceInfo.name = device.productName || 'Sony Controller';
            AppState.deviceInfo.vendorId = device.vendorId;
            AppState.deviceInfo.productId = device.productId;
            
            // تشخیص هوشمند مدل کنترلر بر اساس Product ID
            this.detectControllerModel(device.productId);

            // تشخیص نوع پروتکل اتصال (بلوتوث یا کابل USB) از روی امضای سخت‌افزاری نام دستگاه
            AppState.connection.type = device.productName.toLowerCase().includes('wireless') ? 'bluetooth' : 'usb';

            // فعال‌سازی مکانیزم شنود بلادرنگ پکت‌های ورودی (Input Reports)
            device.oninputreport = (event) => this.handleInputReport(event);

            AppState.log(`اتصال پایدار با تراشه ${AppState.deviceInfo.model} برقرار شد. پروتکل: ${AppState.connection.type.toUpperCase()}`, 'success');

        } catch (error) {
            AppState.log(`خطا در باز کردن پورت داده کنترلر: ${error.message}`, 'error');
            this.disconnectDevice();
        }
    },

    /**
     * تحلیل شناسه محصول (PID) کارخانه سونی جهت تفکیک مدل‌ها
     */
    detectControllerModel(pid) {
        if (pid === 0x0CE6) {
            AppState.deviceInfo.model = 'DualSense';
        } else if (pid === 0x0DF2) {
            AppState.deviceInfo.model = 'DualSense Edge';
        } else if (pid === 0x05C4 || pid === 0x09CC) {
            AppState.deviceInfo.model = 'DualShock 4';
        } else {
            AppState.deviceInfo.model = 'Sony Controller (Generic)';
        }
    },

    /**
     * دریافت پکت باینری زنده و محاسبه فرکانس پکت سخت‌افزار (Real Hz Counter)
     */
    handleInputReport(event) {
        const { reportId, data, device } = event;
        
        // ارسال فوری داده‌ها به دکودر اصلی
        if (typeof this.onInputReceived === 'function') {
            this.onInputReceived(device.vendorId, reportId, data);
        }

        // محاسبه دقیق تعداد پکت‌ها در ثانیه (Hz) برای مانیتور تلمتری
        this.packetCount++;
        const now = performance.now();
        if (now - this.lastTimestamp >= 1000) {
            const hz = Math.round((this.packetCount * 1000) / (now - this.lastTimestamp));
            AppState.analysis.left.pollingRate = hz;
            AppState.analysis.right.pollingRate = hz; // تفکیک فرکانس در لایه استیت
            
            this.packetCount = 0;
            this.lastTimestamp = now;
        }
    },

    /**
     * بستن امن پورت اتصال و بازنشانی کامل متغیرهای سیستم جهت جلوگیری از نشت حافظه
     */
    async disconnectDevice() {
        if (AppState.connection.device) {
            try {
                AppState.connection.device.oninputreport = null;
                await AppState.connection.device.close();
            } catch (e) { /* نادیده گرفتن خطاهای خروج */ }
        }

        // بازنشانی رفرنس‌ها به حالت اولیه
        AppState.connection.device = null;
        AppState.connection.isConnected = false;
        AppState.connection.status = 'disconnected';
        AppState.connection.type = '-';
        AppState.deviceInfo.name = 'در انتظار اتصال کنترلر...';
        AppState.deviceInfo.model = '-';
        AppState.deviceInfo.vendorId = 0;
        AppState.deviceInfo.productId = 0;

        // ریست کردن مقادیر ورودی و باتری برای پایداری UI
        resetAppStateInputs();
        
        AppState.log('کنترلر از سامانه جدا شد. تمام بافرهای ورودی بازنشانی شدند.', 'warning');
    }
};
