/**
 * js/controllers/xbox.js
 * HID-Fix Xbox Controller Decoder (Standard / GIP Layout) - Bug-Free Version
 * دکودر پکت‌های ۱۶ بیتی مایکروسافت مجهز به تزریق‌کننده ضرایب تصحیح
 */

import { AppState } from '../core/state.js';
import { CalibrationWizard } from '../core/wizard.js';

export const XboxDecoder = {
    decodeInput(reportId, dataView) {
        try {
            if (dataView.byteLength < 14) return; // ✅ بررسی طول بافر

            // ۱. تبدیل داده‌های ۱۶ بیتی آنالوگ استیک‌ها به محدوده شناور (از -1 تا +1)
            const rawLX = dataView.getUint16(0, true);
            const rawLY = dataView.getUint16(2, true);
            const rawRX = dataView.getUint16(4, true);
            const rawRY = dataView.getUint16(6, true);

            let lx = (rawLX - 32768) / 32768;
            let ly = (rawLY - 32768) / 32768;
            let rx = (rawRX - 32768) / 32768;
            let ry = (rawRY - 32768) / 32768;

            // ۲. اعمال ماتریس تصحیح خطای ویزارد کالیبراسیون با نام‌گذاری‌های استاندارد شده
            const calib = AppState.calibration.computedOffsets;
            AppState.inputs.axes.lx = this.clamp((lx - calib.left.offsetX) * calib.left.scaleX, -1.0, 1.0);
            AppState.inputs.axes.ly = this.clamp((ly - calib.left.offsetY) * calib.left.scaleY, -1.0, 1.0);
            AppState.inputs.axes.rx = this.clamp((rx - calib.right.offsetX) * calib.right.scaleX, -1.0, 1.0);
            AppState.inputs.axes.ry = this.clamp((ry - calib.right.offsetY) * calib.right.scaleY, -1.0, 1.0);

            // ✅ محاسبه drift و circular error
            const driftLeft = Math.sqrt(AppState.inputs.axes.lx ** 2 + AppState.inputs.axes.ly ** 2);
            const driftRight = Math.sqrt(AppState.inputs.axes.rx ** 2 + AppState.inputs.axes.ry ** 2);
            AppState.analysis.left.centerOffset = driftLeft;
            AppState.analysis.right.centerOffset = driftRight;

            // شلیک داده به ماشین وضعیت کالیبراسیون زنده
            if (CalibrationWizard.isActive) {
                CalibrationWizard.recordLiveSamples();
            }

            // ۳. مپینگ ماشینی کلیدهای دیجیتال ایکس‌باکس
            AppState.inputs.triggers.l2 = dataView.getUint16(8, true) / 1023;
            AppState.inputs.triggers.r2 = dataView.getUint16(10, true) / 1023;

            const buttonsByte1 = dataView.getUint8(12);
            AppState.inputs.buttons['actionBottom'] = !!(buttonsByte1 & 0x01); // A
            AppState.inputs.buttons['actionRight']  = !!(buttonsByte1 & 0x02); // B
            AppState.inputs.buttons['actionLeft']   = !!(buttonsByte1 & 0x04); // X
            AppState.inputs.buttons['actionTop']    = !!(buttonsByte1 & 0x08); // Y

            // ✅ دکمه‌های اضافی
            const buttonsByte2 = dataView.getUint8(13);
            AppState.inputs.buttons['l1'] = !!(buttonsByte2 & 0x01); // LB
            AppState.inputs.buttons['r1'] = !!(buttonsByte2 & 0x02); // RB
            AppState.inputs.buttons['share'] = !!(buttonsByte2 & 0x04); // Back
            AppState.inputs.buttons['options'] = !!(buttonsByte2 & 0x08); // Start
            AppState.inputs.buttons['l3'] = !!(buttonsByte2 & 0x40); // Left Stick Click
            AppState.inputs.buttons['r3'] = !!(buttonsByte2 & 0x80); // Right Stick Click

        } catch (error) {
            console.error("خطای پردازش پکت فریمور ایکس باکس:", error);
        }
    },

    // ✅ متد کمکی
    clamp(val, min, max) {
        return Math.max(min, Math.min(max, val));
    }
};
