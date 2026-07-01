/**
 * js/core/app.js
 * DualShock / DualSense Calibration Tool - Master App Orchestrator
 * ارکستراتور اصلی، هدایت خط لوله داده فیزیکی به دکودرها و مدیریت رندر لوپ متون UI
 */

import { AppState, resetAppStateInputs } from './state.js';
import { HidEngine } from '../hid/engine.js';
import { SonyDecoder } from '../controllers/sony.js';
import { AnalogCanvas } from '../display/canvas.js';
import { CalibrationWizard } from './wizard.js';

const AppCore = {
    /**
     * نقطه ورود اصلی و مقداردهی اولیه سیستم
     */
    init() {
        AppState.log('در حال سینک و راه‌اندازی ارکستراتور مرکزی سامانه...', 'info');
        
        // ۱. راه اندازی موتورهای پایه
        HidEngine.init();
        AnalogCanvas.init('canvas-left', 'canvas-right');

        // ۲. اتصال پل ارتباطی پکت‌های ورودی سخت‌افزار به دکودر زنده
        HidEngine.onInputReceived = (vendorId, reportId, data) => {
            if (!AppState.connection.isConnected) return;

            const dataView = new DataView(data.buffer);

            // دکود کردن پکت بر اساس سازنده (0x054C = Sony)
            if (vendorId === 0x054C || vendorId === 1356) {
                SonyDecoder.decodeInput(reportId, dataView);
            }

            // ⚡ تزریق آنی پوزیشن استیک‌های کالیبره‌شده به موتور رندر Canvas
            AnalogCanvas.updateAndRender('left', AppState.inputs.axes.lx, AppState.inputs.axes.ly);
            AnalogCanvas.updateAndRender('right', AppState.inputs.axes.rx, AppState.inputs.axes.ry);

            // 🔧 در صورت فعال بودن مود کارگاهی کالیبراسیون، پکت‌ها ضبط شوند
            if (CalibrationWizard.isActive) {
                CalibrationWizard.recordLiveSamples();
            }
        };

        // ۳. اتصال رویدادهای کلیک کلیدهای ویزارد کالیبراسیون
        document.getElementById('btn-start-calibration')?.addEventListener('click', () => {
            CalibrationWizard.start();
        });
        document.getElementById('wiz-btn-next')?.addEventListener('click', () => {
            CalibrationWizard.nextStep();
        });
        document.getElementById('wiz-btn-back')?.addEventListener('click', () => {
            CalibrationWizard.prevStep();
        });
        document.getElementById('wiz-btn-cancel')?.addEventListener('click', () => {
            CalibrationWizard.cancel();
        });

        // ۴. اتصال دکمه اصلی جفت‌سازی WebHID
        document.getElementById('btn-connect')?.addEventListener('click', () => {
            if (!AppState.connection.isConnected) {
                HidEngine.requestDeviceConnection();
            } else {
                HidEngine.disconnectDevice();
            }
        });

        // ۵. استارت حلقه رندر گرافیکی متون و تلمتری‌ها (UI Render Loop)
        this.startUiLoop();
    },

    /**
     * اجرای لوپ سبک با فرکانس نمایشگر مانیتور جهت آپدیت فیلدهای متنی داشبورد
     */
    startUiLoop() {
        const update = () => {
            this.syncConnectionStateUI();
            if (AppState.connection.isConnected) {
                this.syncTelemetryDataUI();
            }
            requestAnimationFrame(update);
        };
        requestAnimationFrame(update);
    },

    /**
     * همگام‌سازی استایل کلیدها و پاپ‌آپ‌ها متناسب با قطع یا وصل بودن فیزیکی دسته
     */
    syncConnectionStateUI() {
        const body = document.body;
        const badge = document.getElementById('connection-badge');
        const btnConnect = document.getElementById('btn-connect');
        const devName = document.getElementById('device-name');

        if (AppState.connection.isConnected) {
            body.classList.remove('disconnected');
            body.classList.add('connected');

            if (badge) {
                badge.innerText = AppState.connection.type === 'usb' ? 'USB Mode' : 'Bluetooth';
                badge.className = 'badge badge-connected';
            }
            if (btnConnect) {
                btnConnect.innerHTML = '<span class=\"btn-icon\">❌</span> قطع اتصال کنترلر';
                btnConnect.className = 'btn btn-danger';
            }
            if (devName) {
                devName.innerText = AppState.deviceInfo.name;
            }
        } else {
            body.classList.remove('connected');
            body.classList.add('disconnected');

            if (badge) {
                badge.innerText = 'Disconnected';
                badge.className = 'badge badge-disconnected';
            }
            if (btnConnect) {
                btnConnect.innerHTML = '<span class=\"btn-icon\">⚡</span> اتصال به کنترلر (WebHID)';
                btnConnect.className = 'btn btn-primary';
            }
            if (devName) {
                devName.innerText = 'در انتظار اتصال سخت‌افزار...';
            }
            
            // بازنشانی مقادیر متنی در لایه امن دیسکانکت
            const clearFields = ['val-model', 'val-interface', 'val-poll-left', 'val-poll-right', 'val-battery', 'val-charge-status', 'val-voltage'];
            clearFields.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerText = '-';
            });
        }

        // مدیریت نمایش داینامیک پاپ‌آپ ویزارد کالیبراسیون بر اساس وضعیت ماشین وضعیت
        const wizardModal = document.getElementById('calibration-wizard-modal');
        if (wizardModal) {
            if (CalibrationWizard.isActive) {
                wizardModal.style.display = 'flex';
            } else {
                wizardModal.style.display = 'none';
            }
        }
    },

    /**
     * تزریق بلادرنگ مقادیر عددی نرخ پولینگ، وضعیت باتری و سیستم‌های حفاظتی به داشبورد
     */
    syncTelemetryDataUI() {
        // ۱. مشخصات عمومی فریمور
        const modelEl = document.getElementById('val-model');
        if (modelEl) modelEl.innerText = AppState.deviceInfo.model;

        const interfaceEl = document.getElementById('val-interface');
        if (interfaceEl) interfaceEl.innerText = AppState.connection.type.toUpperCase();

        // ۲. شمارشگر نرخ فرکانس (Polling Rate) بر حسب هرتز
        const pollLeftEl = document.getElementById('val-poll-left');
        if (pollLeftEl) pollLeftEl.innerText = `${AppState.analysis.left.pollingRate} Hz`;

        const pollRightEl = document.getElementById('val-poll-right');
        if (pollRightEl) pollRightEl.innerText = `${AppState.analysis.right.pollingRate} Hz`;

        // ۳. سیستم مدیریت انرژی و باتری سونی
        const battEl = document.getElementById('val-battery');
        if (battEl) {
            battEl.innerText = AppState.analysis.battery.level !== null ? `${AppState.analysis.battery.level}%` : 'نادرست';
        }

        const chargeEl = document.getElementById('val-charge-status');
        if (chargeEl) {
            chargeEl.innerText = AppState.analysis.battery.isCharging ? 'در حال شارژ ⚡' : 'درحال تخلیه (باتری)';
            chargeEl.style.color = AppState.analysis.battery.isCharging ? '#10b981' : '#64748b';
        }
    }
};

// اجرای ایمن ارکستراتور پس از لود کامل لایه‌های درخت DOM
document.addEventListener('DOMContentLoaded', () => AppCore.init());
