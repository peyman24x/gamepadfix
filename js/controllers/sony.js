/**
 * js/controllers/sony.js
 * HID-Fix Sony Controller Deep Decoder (DS4 / DualSense) - Bug-Free Version
 * اعمال زنده ماتریس تصحیح ویزارد روی پکت‌های باینری سونی
 */

import { AppState } from '../core/state.js';
import { CalibrationWizard } from '../core/wizard.js';

export const SonyDecoder = {
    decodeInput(reportId, dataView) {
        const pid = AppState.deviceInfo.productId;
        if (pid === '0x0CE6' || pid === 0x0CE6) {
            this.parseDualSense(reportId, dataView);
        } else {
            this.parseDualShock4(reportId, dataView);
        }

        // شلیک پکت به بافر نمونه‌بردار ویزارد در صورت فعال بودن مرحله کالیبراسیون
        if (CalibrationWizard.isActive) {
            CalibrationWizard.recordLiveSamples();
        }
    },

    parseDualSense(reportId, view) {
        const offset = (reportId === 0x31) ? 1 : 0;

        // ۱. استخراج و نرمال‌سازی پوزیشن خام آنالوگ‌ها (بازه -1 تا 1)
        let lx = (view.getUint8(offset + 0) - 128) / 128;
        let ly = (view.getUint8(offset + 1) - 128) / 128;
        let rx = (view.getUint8(offset + 2) - 128) / 128;
        let ry = (view.getUint8(offset + 3) - 128) / 128;

        // ۲. اعمال ماتریس کالیبراسیون و فرمول اصلاح خطای سخت‌افزاری
        const calib = AppState.calibration.computedOffsets;
        
        AppState.inputs.axes.lx = (lx - calib.left.offsetX) * calib.left.scaleX;
        AppState.inputs.axes.ly = (ly - calib.left.offsetY) * calib.left.scaleY;
        AppState.inputs.axes.rx = (rx - calib.right.offsetX) * calib.right.scaleX;
        AppState.inputs.axes.ry = (ry - calib.right.offsetY) * calib.right.scaleY;

        // ۳. دکود کردن دکمه‌ها و تریگرها (طبق پروتکل استاندارد سونی)
        AppState.inputs.triggers.l2 = view.getUint8(offset + 4) / 255;
        AppState.inputs.triggers.r2 = view.getUint8(offset + 5) / 255;

        const buttonsByte = view.getUint8(offset + 7);
        AppState.inputs.buttons['actionBottom'] = !!(buttonsByte & 0x20); // Cross
        AppState.inputs.buttons['actionRight']  = !!(buttonsByte & 0x40); // Circle
        AppState.inputs.buttons['actionLeft']   = !!(buttonsByte & 0x10); // Square
        AppState.inputs.buttons['actionTop']    = !!(buttonsByte & 0x80); // Triangle
    },

    parseDualShock4(reportId, view) {
        const offset = (reportId === 0x11) ? 2 : 0; 

        let lx = (view.getUint8(offset + 0) - 128) / 128;
        let ly = (view.getUint8(offset + 1) - 128) / 128;
        let rx = (view.getUint8(offset + 2) - 128) / 128;
        let ry = (view.getUint8(offset + 3) - 128) / 128;

        const calib = AppState.calibration.computedOffsets;
        AppState.inputs.axes.lx = (lx - calib.left.offsetX) * calib.left.scaleX;
        AppState.inputs.axes.ly = (ly - calib.left.offsetY) * calib.left.scaleY;
        AppState.inputs.axes.rx = (rx - calib.right.offsetX) * calib.right.scaleX;
        AppState.inputs.axes.ry = (ry - calib.right.offsetY) * calib.right.scaleY;
    }
};
