/**
 * HID-Fix Pro - Core State Management
 * [Standardized Source of Truth - v1.2.0 - Fixed]
 */

export const AppState = {
    // وضعیت اتصال دستگاه به مرورگر
    connection: {
        isConnected: false,
        status: 'disconnected', // 'disconnected' | 'connecting' | 'connected' | 'error'
        type: null,             // 'USB' | 'Bluetooth'
        interface: null
    },

    // داده‌های هویتی و ثبت عمیق فریمور استخراج شده از کنترلر
    deviceInfo: {
        name: 'سخت‌افزار ناشناخته',
        controllerName: 'Unknown Gamepad',
        vendorId: 0,
        productId: 0,
        firmware: {
            version: '-',
            buildDate: '-',
            sblVersion: '-',
            touchpadDriver: '-'
        },
        hardware: {
            mcuId: '-',
            factorySerial: '-',
            macAddress: '-'
        }
    },

    // مقادیر زنده ورودی پکت‌های باینری (کلیدها و آنالوگ‌ها)
    inputs: {
        axes: { lx: 0.0, ly: 0.0, rx: 0.0, ry: 0.0 },
        triggers: { l2: 0.0, r2: 0.0 },
        buttons: {
            dpadUp: false, dpadDown: false, dpadLeft: false, dpadRight: false,
            actionTop: false, actionBottom: false, actionLeft: false, actionRight: false,
            l1: false, r1: false, l3: false, r3: false
        }
    },

    // آنالیز پکت‌ها جهت رفع باگ کرش موتور WebHID
    analysis: {
        left: { pollingRate: 0, centerOffset: 0.0, circularError: 0.0 },
        right: { pollingRate: 0, centerOffset: 0.0, circularError: 0.0 },
        battery: { level: null, isCharging: false, voltage: '-' }
    },

    // ماتریس ضرایب اصلاحی خروجی از ماشین وضعیت کالیبراسیون
    calibration: {
        isCalibrated: false,
        computedOffsets: {
            left: { offsetX: 0.0, offsetY: 0.0, scaleX: 1.0, scaleY: 1.0 },
            right: { offsetX: 0.0, offsetY: 0.0, scaleX: 1.0, scaleY: 1.0 }
        }
    },

    // سیستم مرکزی ثبت لوکال لاگ‌ها جهت جلوگیری از کرش ماژول‌های وابسته
    log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`[%c${type.toUpperCase()}%c] ${timestamp} - ${message}`, 
            `color: ${type === 'success' ? '#4caf50' : type === 'warning' ? '#ff9800' : type === 'error' ? '#f44336' : '#2196f3'}; font-weight: bold;`, 
            'color: inherit;'
        );
        // در صورت وجود المان کنسول در UI، می‌توان لاگ‌ها را اینجا به DOM نیز تزریق کرد.
        const consoleEl = document.getElementById('app-console');
        if (consoleEl) {
            consoleEl.innerHTML += `<div class="log-${type}">[${timestamp}] ${message}</div>`;
            consoleEl.scrollTop = consoleEl.scrollHeight;
        }
    }
};

/**
 * متد کمکی جهت ریست کردن وضعیت ورودی‌ها هنگام قطع اتصال ناگهانی سخت‌افزار
 */
export function resetAppStateInputs() {
    AppState.inputs.axes = { lx: 0.0, ly: 0.0, rx: 0.0, ry: 0.0 };
    AppState.inputs.triggers = { l2: 0.0, r2: 0.0 };
    for (const key in AppState.inputs.buttons) {
        AppState.inputs.buttons[key] = false;
    }
    AppState.analysis.left.pollingRate = 0;
    AppState.analysis.right.pollingRate = 0;
}
