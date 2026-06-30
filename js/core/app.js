/**
 * js/core/app.js
 * HID-Fix App Orchestrator - Premium Matrix Edition
 * ارکستراتور اصلی و متصل‌کننده خط لوله داده فیزیکی به دکودرها و رابط کاربری دوقلوی دیجیتال
 */

import { AppState, resetAppStateInputs } from './state.js';
import { HidEngine } from '../hid/engine.js';
import { SonyDecoder } from '../controllers/sony.js';
import { XboxDecoder } from '../controllers/xbox.js';
import { AnalogCanvas } from '../display/canvas.js';
import { CalibrationWizard } from './wizard.js';

const AppCore = {
    /**
     * راه‌اندازی اولیه ماژول‌ها و تعریف پل‌های ارتباطی (Callbacks)
     */
    init() {
        // ۱. اتصال پل لاگ موتور فیزیکی به مانیتور کنسول رابط کاربری
        HidEngine.onLog = (message, type) => this.logToConsole(message, type);

        // ۲. ایجاد خط لوله باینری: هدایت پکت‌های خام به دکودر اختصاصی متناظر
        HidEngine.onInputReceived = (vendorId, reportId, data) => {
            const dataView = new DataView(data.buffer);
            if (vendorId === 0x054C || vendorId === 1356) {
                SonyDecoder.decodeInput(reportId, dataView);
            } else if (vendorId === 0x045E || vendorId === 1118) {
                XboxDecoder.decodeInput(reportId, dataView);
            }
        };

        this.logToConsole('هسته مرکزی سامانه HID-Fix ماتریکس با موفقیت راه‌اندازی شد.', 'info');
        
        // مقداردهی اولیه موتورهای پایه گرافیکی روی بوم‌ها
        HidEngine.init();
        AnalogCanvas.init('canvas-left', 'canvas-right');

        // اتصال کلیک رویدادها به المان‌های رابط کاربری HTML با الگوهای دفاعی ایمن
        document.getElementById('btn-start-calibration')?.addEventListener('click', () => CalibrationWizard.start());
        document.getElementById('wiz-btn-next')?.addEventListener('click', () => CalibrationWizard.nextStep());
        document.getElementById('wiz-btn-back')?.addEventListener('click', () => CalibrationWizard.prevStep());
        document.getElementById('wiz-btn-cancel')?.addEventListener('click', () => CalibrationWizard.cancel());
        
        // اتصال دکمه کانکت به دکمه فیزیکی موجود در هدر مدرن جدید (btn-connect)
        document.getElementById('btn-connect')?.addEventListener('click', () => HidEngine.connectDevice());

        // آغاز حلقه رندرسازی پرسرعت و همزمان (60FPS / 120FPS)
        this.startUpdateLoop();
    },

    /**
     * حلقه بروزرسانی گرافیکی، مپینگ دکمه‌ها و تلمتری مداوم
     */
    startUpdateLoop() {
        const update = () => {
            // رندر لحظه‌ای پوزیشن استیک‌ها روی بوم نقاشی وکتورها
            const axes = AppState.inputs.axes;
            AnalogCanvas.updateAndRender('left', axes.lx, axes.ly);
            AnalogCanvas.updateAndRender('right', axes.rx, axes.ry);

            // همگام‌سازی زنده دکمه‌ها و تریگرهای دسته واقعی با لایه ساختاری دوقلوی دیجیتال UI
            this.updateVirtualGamepadUI();

            // بروزرسانی پنل اطلاعات متنی و وضعیت اتصال داشبورد
            this.renderTelemetry();
            this.updateConnectionUI();

            requestAnimationFrame(update);
        };
        requestAnimationFrame(update);
    },

    /**
     * مپینگ و همگام‌سازی بلادرنگ دکمه‌ها، ماشه‌ها و پد جهت‌ها (Digital Twin Real-time Sync Engine)
     */
    updateVirtualGamepadUI() {
        if (!AppState.connection.isConnected) return;

        // ۱. پایش و رندر دکمه‌های باینری و جهتی (روشن/خاموش شدن بر اساس کلاس گرافیکی .pressed)
        const buttons = AppState.inputs.buttons;
        for (const [btnKey, isPressed] of Object.entries(buttons)) {
            const btnElement = document.getElementById(`btn-${btnKey}`);
            if (btnElement) {
                if (isPressed) {
                    btnElement.classList.add('pressed');
                } else {
                    btnElement.classList.remove('pressed');
                }
            }
        }

        // ۲. پایش مپینگ و رندر ماتریکسی لایه تریگرهای آنالوگ کششی (L2 و R2)
        const triggers = AppState.inputs.triggers;
        ['l2', 'r2'].forEach(tKey => {
            const rawValue = triggers[tKey] || 0;
            const percentage = Math.round(rawValue * 100);
            
            const barElement = document.getElementById(`bar-${tKey}`);
            const txtElement = document.getElementById(`txt-${tKey}`);
            
            if (barElement) barElement.style.width = `${percentage}%`;
            if (txtElement) txtElement.innerText = `${percentage}%`;
        });
    },

    /**
     * رندر زنده اطلاعات ماتریس خطا و فرکانس پکت‌ها در داشبورد
     */
    renderTelemetry() {
        const calib = AppState.calibration.computedOffsets;
        const analysis = AppState.analysis;

        // نمایش مقادیر عددی سنترگیری دقیق دایره‌ای
        const errLOffset = document.getElementById('err-l-offset');
        if (errLOffset) errLOffset.innerText = calib.left.offsetX.toFixed(4);

        const errROffset = document.getElementById('err-r-offset');
        if (errROffset) errROffset.innerText = calib.right.offsetX.toFixed(4);

        // رندر نرخ خطای دایره‌ای شکل سنسورها (Circular Error)
        const errLCirc = document.getElementById('err-l-circ');
        if (errLCirc) errLCirc.innerText = `${(analysis.left.circularError * 100).toFixed(2)}%`;

        const errRCirc = document.getElementById('err-r-circ');
        if (errRCirc) errRCirc.innerText = `${(analysis.right.circularError * 100).toFixed(2)}%`;

        // نمایش فرکانس پکت‌های زنده سخت‌افزار (Polling Rate) متناظر با هدرهای کارت‌های رادار جدید
        const valLHz = document.getElementById('val-hz-left');
        if (valLHz) valLHz.innerText = `${analysis.left.pollingRate} Hz`;

        const valRHz = document.getElementById('val-hz-right');
        if (valRHz) valRHz.innerText = `${analysis.right.pollingRate} Hz`;

        // وضعیت شارژ و باتری و برچسب کالیبراسیون سخت‌افزار
        const valChargeStatus = document.getElementById('val-charge-status');
        if (valChargeStatus) {
            if (AppState.calibration.isCalibrated) {
                valChargeStatus.innerText = "کالیبره شده سخت‌افزاری";
                valChargeStatus.style.color = "var(--color-xbox)";
            } else if (analysis.battery.level !== null) {
                valChargeStatus.innerText = `باتری: ${analysis.battery.level}% ${analysis.battery.isCharging ? ' ⚡' : ''}`;
                valChargeStatus.style.color = "var(--text-primary)";
            } else {
                valChargeStatus.innerText = "منبع تغذیه تایید شده (تراشه آنلاین)";
                valChargeStatus.style.color = "var(--color-cyan)";
            }
        }
    },

    /**
     * پایش و اعمال کلاس‌های ساختاری بر اساس وضعیت اتصال فیزیکی دستگاه
     */
    updateConnectionUI() {
        const body = document.body;
        const badge = document.getElementById('connection-badge');
        const devName = document.getElementById('device-name');

        if (AppState.connection.isConnected) {
            if (body.classList.contains('disconnected')) {
                body.classList.remove('disconnected');
                body.classList.add('connected');
            }
            
            if (badge) {
                badge.innerText = AppState.connection.type === 'bluetooth' ? 'اتصال بلوتوث // فعال' : 'اتصال کابل سخت‌افزاری // فعال';
                badge.className = 'badge badge-connected';
            }

            if (devName) devName.innerText = AppState.deviceInfo.name || 'سخت‌افزار مپ شده متصل است';

            // تزریق کدهای شناسه سخت‌افزاری چیپست به جدول اطلاعات فریمور
            if (document.getElementById('fw-ver')) document.getElementById('fw-ver').innerText = `0x${AppState.deviceInfo.productId.toString(16).toUpperCase()}`;
            if (document.getElementById('fw-date')) document.getElementById('fw-date').innerText = `0x${AppState.deviceInfo.vendorId.toString(16).toUpperCase()}`;
            if (document.getElementById('hw-mcu')) document.getElementById('hw-mcu').innerText = AppState.connection.type.toUpperCase();

        } else {
            if (!body.classList.contains('disconnected')) {
                body.classList.remove('connected');
                body.classList.add('disconnected');
            }
            
            if (badge) {
                badge.innerText = 'آفلاین // قطع اتصال';
                badge.className = 'badge badge-disconnected';
            }

            if (devName) devName.innerText = 'در انتظار سنترگیری کابل سخت‌افزار...';
            
            // بازنشانی فیلدها در لایه امن دیسکانکت فیزیکی
            ['fw-ver', 'fw-date', 'hw-mcu'].forEach(id => {
                const element = document.getElementById(id);
                if (element) element.innerText = '-';
            });
        }
    },

    /**
     * تزریق متن رویدادها به کنسول کارگاهی رابط کاربری
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
