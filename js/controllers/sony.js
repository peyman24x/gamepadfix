/**
 * HID-Fix Sony Controller Deep Decoder (DS4 / DualSense)
 * کدهای اصلاح‌شده جهت انطباق با استاندارد کالیبراسیون مرجع
 */

import { AppState } from '../core/state.js';

export const SonyDecoder = {
    decodeInput(reportId, dataView) {
        const pid = AppState.deviceInfo.productId;
        if (pid === '0x0CE6') {
            this.parseDualSense(reportId, dataView);
        } else {
            this.parseDualShock4(reportId, dataView);
        }
    },

    parseDualSense(reportId, view) {
        // در ساختار بومی WebHID پکت بلوتوث 0x31 یک بایت ترابری اضافه دارد
        const offset = (reportId === 0x31) ? 1 : 0;

        // ۱. استخراج دیتای آنالوگ‌ها
        AppState.inputs.axes.lx = (view.getUint8(offset + 0) - 128) / 128;
        AppState.inputs.axes.ly = (view.getUint8(offset + 1) - 128) / 128;
        AppState.inputs.axes.rx = (view.getUint8(offset + 2) - 128) / 128;
        AppState.inputs.axes.ry = (view.getUint8(offset + 3) - 128) / 128;

        // ۲. تریگرها
        AppState.inputs.triggers.l2 = view.getUint8(offset + 4) / 255;
        AppState.inputs.triggers.r2 = view.getUint8(offset + 5) / 255;

        // ۳. دکمه‌های اصلی - بایت ۷
        const byte7 = view.getUint8(offset + 7);
        const dpad = byte7 & 0x0F;
        
        AppState.inputs.buttons['dpad-up']    = (dpad === 0 || dpad === 1 || dpad === 7);
        AppState.inputs.buttons['dpad-right'] = (dpad === 1 || dpad === 2 || dpad === 3);
        AppState.inputs.buttons['dpad-down']  = (dpad === 3 || dpad === 4 || dpad === 5);
        AppState.inputs.buttons['dpad-left']  = (dpad === 5 || dpad === 6 || dpad === 7);

        AppState.inputs.buttons['action-left']   = !!(byte7 & 0x10); // مربع
        AppState.inputs.buttons['action-bottom'] = !!(byte7 & 0x20); // ضربدر
        AppState.inputs.buttons['action-right']  = !!(byte7 & 0x40); // دایره
        AppState.inputs.buttons['action-top']    = !!(byte7 & 0x80); // مثلث

        // ۴. بامپرها و کلیدهای مدیریتی - بایت ۸
        const byte8 = view.getUint8(offset + 8);
        AppState.inputs.buttons['l1'] = !!(byte8 & 0x01);
        AppState.inputs.buttons['r1'] = !!(byte8 & 0x02);
        AppState.inputs.buttons['l2'] = !!(byte8 & 0x04);
        AppState.inputs.buttons['r2'] = !!(byte8 & 0x08);
        AppState.inputs.buttons['create'] = !!(byte8 & 0x10);
        AppState.inputs.buttons['options'] = !!(byte8 & 0x20);
        AppState.inputs.buttons['l3'] = !!(byte8 & 0x40);
        AppState.inputs.buttons['r3'] = !!(byte8 & 0x80);

        // ۵. کلید سخت‌افزاری PS و تاچ‌پد - بایت ۹
        const byte9 = view.getUint8(offset + 9);
        AppState.inputs.buttons['ps'] = !!(byte9 & 0x01);
        AppState.inputs.buttons['touchpad'] = !!(byte9 & 0x02);
        AppState.inputs.buttons['mute'] = !!(byte9 & 0x04);

        // ۶. دکود کردن وضعیت باتری (بایت ۵۲ پکت خالص)
        if (reportId === 0x01) {
            const batteryByte = view.getUint8(52);
            const isCharging = !!(batteryByte & 0x10);
            const level = Math.min((batteryByte & 0x0F) * 10, 100);
            
            AppState.battery.percentage = level;
            AppState.battery.status = isCharging ? 'charging' : (level === 100 ? 'full' : 'discharging');
            AppState.battery.voltage = isCharging ? '5.1V' : '3.7V';
        }
    },

    parseDualShock4(reportId, view) {
        // پکت بلوتوث 0x11 در دیوال‌شاک ۴ دارای ۲ بایت هدر فرکانس است
        const offset = (reportId === 0x11) ? 2 : 0;

        AppState.inputs.axes.lx = (view.getUint8(offset + 0) - 128) / 128;
        AppState.inputs.axes.ly = (view.getUint8(offset + 1) - 128) / 128;
        AppState.inputs.axes.rx = (view.getUint8(offset + 2) - 128) / 128;
        AppState.inputs.axes.ry = (view.getUint8(offset + 3) - 128) / 128;

        const byte4 = view.getUint8(offset + 4);
        const dpad = byte4 & 0x0F;
        AppState.inputs.buttons['dpad-up']    = (dpad === 0 || dpad === 1 || dpad === 7);
        AppState.inputs.buttons['dpad-right'] = (dpad === 1 || dpad === 2 || dpad === 3);
        AppState.inputs.buttons['dpad-down']  = (dpad === 3 || dpad === 4 || dpad === 5);
        AppState.inputs.buttons['dpad-left']  = (dpad === 5 || dpad === 6 || dpad === 7);

        AppState.inputs.buttons['action-left']   = !!(byte4 & 0x10);
        AppState.inputs.buttons['action-bottom'] = !!(byte4 & 0x20);
        AppState.inputs.buttons['action-right']  = !!(byte4 & 0x40);
        AppState.inputs.buttons['action-top']    = !!(byte4 & 0x80);

        const byte5 = view.getUint8(offset + 5);
        AppState.inputs.buttons['l1'] = !!(byte5 & 0x01);
        AppState.inputs.buttons['r1'] = !!(byte5 & 0x02);
        AppState.inputs.buttons['l2'] = !!(byte5 & 0x04);
        AppState.inputs.buttons['r2'] = !!(byte5 & 0x08);
        AppState.inputs.buttons['create'] = !!(byte5 & 0x10);
        AppState.inputs.buttons['options'] = !!(byte5 & 0x20);
        AppState.inputs.buttons['l3'] = !!(byte5 & 0x40);
        AppState.inputs.buttons['r3'] = !!(byte5 & 0x80);

        const byte6 = view.getUint8(offset + 6);
        AppState.inputs.buttons['ps'] = !!(byte6 & 0x01);
        AppState.inputs.buttons['touchpad'] = !!(byte6 & 0x02);

        AppState.inputs.triggers.l2 = view.getUint8(offset + 7) / 255;
        AppState.inputs.triggers.r2 = view.getUint8(offset + 8) / 255;
    },

    async queryDeepFirmware(device) {
        try {
            const pid = AppState.deviceInfo.productId;
            if (pid === '0x0CE6') {
                const featureReport = await device.receiveFeatureReport(0x20);
                const view = new DataView(featureReport.buffer);

                const fwVerMajor = view.getUint8(44);
                const fwVerMinor = view.getUint8(45);
                AppState.deviceInfo.firmware.version = `${fwVerMajor}.${fwVerMinor.toString().padStart(2, '0')}`;

                let buildDateStr = '';
                for (let i = 28; i < 39; i++) {
                    buildDateStr += String.fromCharCode(view.getUint8(i));
                }
                AppState.deviceInfo.firmware.buildDate = buildDateStr;

                const macBytes = [];
                for (let i = 6; i >= 1; i--) {
                    macBytes.push(view.getUint8(i).toString(16).toUpperCase().padStart(2, '0'));
                }
                AppState.deviceInfo.hardware.bluetoothAddress = macBytes.join(':');
                AppState.deviceInfo.firmware.sblVersion = `SBL-04.0${view.getUint8(43)}`;
                AppState.deviceInfo.firmware.touchpadVersion = `TP-0${view.getUint8(11)}`;
                AppState.deviceInfo.hardware.mcuUniqueId = `MCU-${view.getUint32(16).toString(16).toUpperCase()}`;
                AppState.deviceInfo.hardware.serialNumber = `SN-${view.getUint32(24).toString(10)}`;
                AppState.log('اطلاعات عمیق فریمور تراشه DualSense با موفقیت دکود شد.', 'success');
            } else {
                const featureReport = await device.receiveFeatureReport(0x12);
                const view = new DataView(featureReport.buffer);
                const macBytes = [];
                for (let i = 6; i >= 1; i--) {
                    macBytes.push(view.getUint8(i).toString(16).toUpperCase().padStart(2, '0'));
                }
                AppState.deviceInfo.hardware.bluetoothAddress = macBytes.join(':');
                AppState.deviceInfo.firmware.version = `Gen2.FW-${view.getUint16(10).toString(16)}`;
                AppState.log('آدرس فیزیکی بلوتوث DualShock 4 از رجیستر رید شد.', 'success');
            }
        } catch (error) {
            AppState.log(`محدودیت یا خطا در دریافت پکت اطلاعات فریمور: ${error.message}`, 'warning');
        }
    }
};
