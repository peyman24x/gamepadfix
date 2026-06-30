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
            AppState.inputs.axes.lx = (lx - calib.left.offsetX) * calib.left.scaleX;
            AppState.inputs.axes.ly = (ly - calib.left.offsetY) * calib.left.scaleY;
            AppState.inputs.axes.rx = (rx - calib.right.offsetX) * calib.right.scaleX;
            AppState.inputs.axes.ry = (ry - calib.right.offsetY) * calib.right.scaleY;

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

        } catch (error) {
            console.error("خطای پردازش پکت فریمور ایکس باکس:", error);
        }
    }
};
