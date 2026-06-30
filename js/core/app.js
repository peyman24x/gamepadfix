/**
 * js/core/app.js
 * HID-Fix App Orchestrator - Elite DualShock Framework
 * اتصال لایه ارتباطی WebHID به لایه مپینگ و دوایر فرکانسی رابط کاربری
 */

import { AppState } from './state.js';
import { HidEngine } from '../hid/engine.js';
import { SonyDecoder } from '../controllers/sony.js';
import { XboxDecoder } from '../controllers/xbox.js';
import { AnalogCanvas } from '../display/canvas.js';
import { CalibrationWizard } from './wizard.js';

const AppCore = {
    /**
     * راه‌اندازی اولیه رویدادها و اتصال موتور رندرسازی زنده
     */
    init() {
        // اتصال کنسول متنی موتور فیزیکی به لایه کاربری UI
        HidEngine.onLog = (message, type) => this.logToConsole(message, type);

        // مسیریابی پکت‌های ورودی به دکودرها متناسب با کد شناسه کمپانی سازنده
        HidEngine.onInputReceived = (vendorId, reportId, data) => {
            const dataView = new DataView(data.buffer);
            if (vendorId === 0x054C || vendorId === 1356) {
                SonyDecoder.decodeInput(reportId, dataView);
            } else if (vendorId === 0x045E || vendorId === 1118) {
                XboxDecoder.decodeInput(reportId, dataView);
            }
        };

        this.logToConsole('هسته مانیتورینگ DualShock/Xbox با موفقیت راه اندازی شد.', 'info');
        
        HidEngine.init();
        AnalogCanvas.init('canvas-left', 'canvas-right');

        // الحاق رویداد دکمه‌ها و فرم‌های کالیبراسیون سخت‌افزار
        document.getElementById('btn-start-calibration')?.addEventListener('click', () => CalibrationWizard.start());
        document.getElementById('btn-connect')?.addEventListener('click', () => HidEngine.connectDevice());

        // کلیدهای کمکی ماشین وضعیت ویزارد کالیبراسیون در صورت وجود در دام
        document.getElementById('wiz-btn-next')?.addEventListener('click', () => CalibrationWizard.nextStep());
        document.getElementById('wiz-btn-back')?.addEventListener('click', () => CalibrationWizard.prevStep());
        document.getElementById('wiz-btn-cancel')?.addEventListener('click', () => CalibrationWizard.cancel());

        // آغاز لوپ پردازش بلادرنگ فریم‌ها (Real-Time Render Loop)
        this.startUpdateLoop();
    },

    /**
     * حلقه رندر گرافیک برداری آنالوگ‌ها و نگاشت دکمه‌ها
     */
    startUpdateLoop() {
        const frame = () => {
            const axes = AppState.inputs.axes;
            
            // رندر نقشه برداری پوتانسیومترها روی کانوس
            AnalogCanvas.updateAndRender('left', axes.lx, axes.ly);
            AnalogCanvas.updateAndRender('right', axes.rx, axes.ry);

            // فراخوانی رندر مپینگ دکمه‌ها و نوارهای ماشه آنالوگ
            this.syncGamepadInterfaceNodes();

            // تزریق دادهای تلمتری انحراف و ولتاژ آی‌سی
            this.renderTelemetryMatrix();
            this.updateSystemStatusBadge();

            requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
    },

    /**
     * نگاشت و رندر همزمان دکمه‌ها، ماشه‌ها و پد جهت‌ها (Digital Twin Mapping Engine)
     */
    syncGamepadInterfaceNodes() {
        // بروزرسانی وضعیت کلیدهای دوقطبی (Pressed / Unpressed)
        const buttons = AppState.inputs.buttons;
        for (const [btnKey, isPressed] of Object.entries(buttons)) {
            const btnNode = document.getElementById(`btn-${btnKey}`);
            if (btnNode) {
                if (isPressed) {
                    btnNode.classList.add('pressed');
                } else {
                    btnNode.classList.remove('pressed');
                }
            }
        }

        // بروزرسانی پهنای باند و درصد فشار ماشه‌های پایینی (L2 / R2)
        const triggers = AppState.inputs.triggers;
        ['l2', 'r2'].forEach(tKey => {
            const rawVal = triggers[tKey] || 0;
            const pct = Math.round(rawVal * 100);
            
            const barNode = document.getElementById(`bar-${tKey}`);
            const txtNode = document.getElementById(`txt-${tKey}`);
            
            if (barNode) barNode.style.width = `${pct}%`;
            if (txtNode) txtNode.innerText = `${pct}%`;
        });
    },

    /**
     * رندر زنده ماتریس محاسبات خطا، فرکانس و باتری تراشه
     */
    renderTelemetryMatrix() {
        const calib = AppState.calibration.computedOffsets;
        const analysis = AppState.analysis;

        // رندر مقادیر عددی سنترگیری دقیق دایره‌ای
        const errLOffset = document.getElementById('err-l-offset');
        if (errLOffset) errLOffset.innerText = (calib.left.offsetX || 0).toFixed(4);

        const errROffset = document.getElementById('err-r-offset');
        if (errROffset) errROffset.innerText = (calib.right.offsetX || 0).toFixed(4);

        // رندر نرخ خطای دایره‌ای لبه پوتانسیومترها
        const errLCirc = document.getElementById('err-l-circ');
        if (errLCirc) errLCirc.innerText = `${((analysis.left.circularError || 0) * 100).toFixed(2)}%`;

        const errRCirc = document.getElementById('err-r-circ');
        if (errRCirc) errRCirc.innerText = `${((analysis.right.circularError || 0) * 100).toFixed(2)}%`;

        // نمایش فرکانس پکت‌های زنده سخت‌افزار (Polling Rate Counter)
        const valLHz = document.getElementById('val-hz-left');
        if (valLHz) valLHz.innerText = `${analysis.left.pollingRate || 0} Hz`;

        const valRHz = document.getElementById('val-hz-right');
        if (valRHz) valRHz.innerText = `${analysis.right.pollingRate || 0} Hz`;

        // مدیریت نمایش وضعیت مدار منبع تغذیه کنترلر
        const valChargeStatus = document.getElementById('val-charge-status');
        if (valChargeStatus) {
            if (AppState.calibration.isCalibrated) {
                valChargeStatus.innerText = "کالیبره سخت‌افزاری تایید شد";
                valChargeStatus.style.color = "var(--color-xbox)";
            } else if (analysis.battery.level !== null) {
                valChargeStatus.innerText = `باتری: ${analysis.battery.level}% ${analysis.battery.isCharging ? '⚡' : ''}`;
                valChargeStatus.style.color = "var(--text-primary)";
            } else {
                valChargeStatus.innerText = "پک انرژی متصل (ثبات جریان)";
                valChargeStatus.style.color = "var(--color-cyan)";
            }
        }
    },

    /**
     * پایش و اعمال کلاس‌های ساختاری بر اساس وضعیت اتصال فیزیکی سخت‌افزار
     */
    updateSystemStatusBadge() {
        const body = document.body;
        const badge = document.getElementById('connection-badge');
        const devName = document.getElementById('device-name');

        // دسترسی به اطلاعات وضعیت از استیت کنترلر
        const isConnected = AppState.connection.isConnected || (AppState.connection.status === 'connected');

        if (isConnected) {
            if (body.classList.contains('disconnected')) {
                body.classList.remove('disconnected');
                body.classList.add('connected');
            }
            
            if (badge) {
                badge.innerText = AppState.connection.type === 'bluetooth' ? 'بلوتوث // متصل' : 'کابل فیزیکی // متصل';
                badge.className = 'badge badge-connected';
            }

            if (devName) devName.innerText = AppState.deviceInfo.name || 'سخت‌افزار مپ شده آنلاین است';

            // تزریق شناسه‌های فنی رجیسترهای چیپست به تلمتری فریمور
            if (document.getElementById('fw-ver')) document.getElementById('fw-ver').innerText = `0x${(AppState.deviceInfo.productId || 0).toString(16).toUpperCase()}`;
            if (document.getElementById('fw-date')) document.getElementById('fw-date').innerText = `0x${(AppState.deviceInfo.vendorId || 0).toString(16).toUpperCase()}`;
            if (document.getElementById('hw-mcu')) document.getElementById('hw-mcu').innerText = (AppState.connection.type || 'USB').toUpperCase();

        } else {
            if (!body.classList.contains('disconnected')) {
                body.classList.remove('connected');
                body.classList.add('disconnected');
            }
            
            if (badge) {
                badge.innerText = 'آفلاین // قطع اتصال فیزیکی';
                badge.className = 'badge badge-disconnected';
            }

            if (devName) devName.innerText = 'در انتظار شناسایی آی‌سی سخت‌افزار...';
            
            ['fw-ver', 'fw-date', 'hw-mcu'].forEach(id => {
                const element = document.getElementById(id);
                if (element) element.innerText = '-';
            });
        }
    },

    /**
     * ثبت گزارشات خط لوله پکت‌ها در پنجره لاگ رابط کاربری
     */
    logToConsole(message, type = 'info') {
        const consoleBody = document.getElementById('app-console');
        if (!consoleBody) return;

        const logRow = document.createElement('div');
        logRow.className = `log-${type}`;
        logRow.innerText = `[${type.toUpperCase()}] ${message}`;
        
        consoleBody.appendChild(logRow);
        consoleBody.scrollTop = consoleBody.scrollHeight;
    }
};

document.addEventListener('DOMContentLoaded', () => AppCore.init());

export { AppCore };
