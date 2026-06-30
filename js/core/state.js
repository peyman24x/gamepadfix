/**
 * HID-Fix Pro - Core State Management
 * [Standardized Source of Truth - v1.2.0]
 */

export const AppState = {
    // وضعیت اتصال دستگاه به مرورگر
    connection: {
        isConnected: false,
        type: null,        // 'usb' | 'bluetooth'
        interface: null    // مرجع شیء دستگاه WebHID
    },

    // داده‌های هویتی و ثبت عمیق فریمور استخراج شده از کنترلر
    deviceInfo: {
        name: 'سخت‌افزار ناشناخته',
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
        axes: {
            lx: 0.0,
            ly: 0.0,
            rx: 0.0,
            ry: 0.0
        },
        triggers: {
            l2: 0.0,
            r2: 0.0
        },
        buttons: {
            dpadUp: false,
            dpadDown: false,
            dpadLeft: false,
            dpadRight: false,
            actionTop: false,    // Triangle / Y
            actionBottom: false, // Cross / A
            actionLeft: false,   // Square / X
            actionRight: false,  // Circle / B
            l1: false,
            r1: false,
            l3: false,
            r3: false
        }
    },

    // اصلاح ساختار آنالیز پکت‌ها جهت رفع باگ کرش موتور WebHID (Engine Crash Fix)
    analysis: {
        left: {
            pollingRate: 0,
            centerOffset: 0.0,
            circularError: 0.0
        },
        right: {
            pollingRate: 0,
            centerOffset: 0.0,
            circularError: 0.0
        },
        battery: {
            level: null,
            isCharging: false,
            voltage: '-'
        }
    },

    // ماتریس ضرایب اصلاحی خروجی از ماشین وضعیت ویزارد کالیبراسیون
    calibration: {
        isCalibrated: false,
        computedOffsets: {
            left: { offsetX: 0.0, offsetY: 0.0, scaleX: 1.0, scaleY: 1.0 },
            right: { offsetX: 0.0, offsetY: 0.0, scaleX: 1.0, scaleY: 1.0 }
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
