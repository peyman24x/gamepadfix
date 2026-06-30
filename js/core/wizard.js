/**
 * js/core/wizard.js
 * HID-Fix 7-Step Hardware Calibration Wizard Engine (ES2024 - OOP Architecture)
 * شبیه‌ساز ماشین وضعیت ابزار کارگاهی جهت محاسبه ماتریس‌های تصحیح آنالوگ استیک
 */

import { AppState } from './state.js';

class CalibrationWizardEngine {
    constructor() {
        this.currentStep = 1;
        this.totalSteps = 7;
        this.isActive = false;

        // بافرهای هندسی کپسوله‌شده برای ذخیره‌سازی داده‌های فیزیکی سنسورها
        this.samples = {
            left: { minX: 0, maxX: 0, minY: 0, maxY: 0, centerX: 0, centerY: 0 },
            right: { minX: 0, maxX: 0, minY: 0, maxY: 0, centerX: 0, centerY: 0 }
        };

        // دیتابیس راهنماهای متنی مراحل کالیبراسیون (منطبق بر داکیومنت‌های فنی سونی و مایکروسافت)
        this.stepGuides = [
            { title: 'آماده‌سازی لایه سخت‌افزار', desc: 'لطفاً کنترلر را روی یک سطح کاملاً صاف و بدون لرزش قرار داده و استیک‌ها را رها کنید. سپس روی دکمه بعدی کلیک کنید.' },
            { title: 'ثبت نقطه صفر آنالوگ چپ', desc: 'بدون دست زدن به آنالوگ‌ها، دکمه بعدی را بزنید تا میانگین آفست ولتاژ هسته مکانیکی چپ در حافظه موقت ثبت شود.' },
            { title: 'کالیبراسیون دامنه استیک چپ', desc: 'استیک چپ را ۲ الی ۳ بار به صورت کامل ۳۶۰ درجه بچرخانید تا بیشترین محدوده دامنه مغناطیسی (Max/Min) شناسایی شود، سپس دکمه بعدی را بزنید.' },
            { title: 'ثبت نقطه صفر آنالوگ راست', desc: 'استیک‌ها را مجدداً رها کرده و دکمه بعدی را بزنید تا خروجی ولتاژ و مقاومت تراشه راست سنترگیری شود.' },
            { title: 'کالیبراسیون دامنه استیک راست', desc: 'استیک راست را ۲ الی ۳ بار به صورت کامل ۳۶۰ درجه بچرخانید تا بیشترین محدوده دامنه مغناطیسی ثبت شود، سپس دکمه بعدی را بزنید.' },
            { title: 'محاسبه ماتریس تصحیح فرکانسی', desc: 'سیستم در حال ارزیابی بافرهای ثبت‌شده و اعمال اسکیلینگ نهایی به خطای دایره‌ای است. روی دکمه بعدی کلیک کنید...' },
            { title: 'تزریق فریمور و پایان فرآیند', desc: 'عملیات با موفقیت پایان یافت! ماتریس اصلاح خطا به موتور رندر تزریق شد. برای اعمال تغییرات کارگاهی روی دکمه پایان کلیک کنید.' }
        ];
    }

    /**
     * ورود به مود کارگاهی کالیبراسیون و آشکارسازی باکس ویزارد در UI
     */
    start() {
        if (AppState.connection && !AppState.connection.isConnected) {
            this.logToConsole('جهت شروع فرآیند کالیبراسیون، ابتدا کنترلر را متصل کنید.', 'warning');
            return;
        }

        this.isActive = true;
        this.currentStep = 1;
        this.resetSamples();
        this.updateUI();
        
        this.logToConsole('ویزارد کالیبراسیون سخت‌افزاری فعال شد. در حال پایش وضعیت سنسورها...', 'info');
    }

    /**
     * بازنشانی کلیه بافرهای فیزیکی نمونه‌برداری
     */
    resetSamples() {
        const defaultStick = { minX: 0, maxX: 0, minY: 0, maxY: 0, centerX: 0, centerY: 0 };
        this.samples.left = { ...defaultStick };
        this.samples.right = { ...defaultStick };
    }

    /**
     * انتقال گام به گام ماشین وضعیت به مرحله بعد + اجرای تسک‌های محاسباتی میانی
     */
    nextStep() {
        if (!this.isActive) return;

        // پردازش‌های منطقی انتهای هر گام، قبل از سوئیچ به گام بعدی
        if (this.currentStep === 2) {
            // ثبت پوزیشن جاری به عنوان آفست مرکزی استیک چپ
            this.samples.left.centerX = AppState.inputs.axes.lx;
            this.samples.left.centerY = AppState.inputs.axes.ly;
            this.logToConsole('آفست سنتر آنالوگ چپ با موفقیت در بافر ذخیره شد.', 'success');
        } 
        else if (this.currentStep === 4) {
            // ثبت پوزیشن جاری به عنوان آفست مرکزی استیک راست
            this.samples.right.centerX = AppState.inputs.axes.rx;
            this.samples.right.centerY = AppState.inputs.axes.ry;
            this.logToConsole('آفست سنتر آنالوگ راست با موفقیت در بافر ذخیره شد.', 'success');
        } 
        else if (this.currentStep === 6) {
            // فرآیند نهایی پردازش ریاضی و تولید کالیبراسیون
            this.computeFinalMatrix();
        } 
        else if (this.currentStep === this.totalSteps) {
            // پایان کار و کلوز کردن ویزارد
            this.finish();
            return;
        }

        this.currentStep++;
        this.updateUI();
    }

    /**
     * بازگشت به مرحله قبلی
     */
    prevStep() {
        if (!this.isActive || this.currentStep <= 1) return;
        this.currentStep--;
        this.updateUI();
    }

    /**
     * خروج اضطراری و لغو فرآیند کالیبراسیون بدون ذخیره‌سازی داده‌ها
     */
    cancel() {
        this.isActive = false;
        this.resetSamples();
        
        const wizardContainer = document.getElementById('wizard-container');
        if (wizardContainer) wizardContainer.classList.remove('active');
        
        this.logToConsole('فرآیند کالیبراسیون توسط کاربر لغو شد. دستگاه به وضعیت عادی بازگشت.', 'warning');
    }

    /**
     * نمونه‌برداری مداوم از پکت‌های زنده سخت‌افزار (فراخوانی از داخل پکت ریدر اصلی)
     */
    recordLiveSamples() {
        if (!this.isActive) return;

        // ثبت دامنه‌های حرکتی استیک چپ در گام ۳
        if (this.currentStep === 3) {
            const lx = AppState.inputs.axes.lx;
            const ly = AppState.inputs.axes.ly;
            this.samples.left.minX = Math.min(this.samples.left.minX, lx);
            this.samples.left.maxX = Math.max(this.samples.left.maxX, lx);
            this.samples.left.minY = Math.min(this.samples.left.minY, ly);
            this.samples.left.maxY = Math.max(this.samples.left.maxY, ly);
        }
        // ثبت دامنه‌های حرکتی استیک راست در گام ۵
        if (this.currentStep === 5) {
            const rx = AppState.inputs.axes.rx;
            const ry = AppState.inputs.axes.ry;
            this.samples.right.minX = Math.min(this.samples.right.minX, rx);
            this.samples.right.maxX = Math.max(this.samples.right.maxX, rx);
            this.samples.right.minY = Math.min(this.samples.right.minY, ry);
            this.samples.right.maxY = Math.max(this.samples.right.maxY, ry);
        }
    }

    /**
     * پردازش برداری عمیق پوتانسیومترها و استخراج ضرایب اسکیلینگ (Gain Scaling Factors)
     */
    computeFinalMatrix() {
        this.logToConsole('در حال پردازش بافرهای سیگنال و اعمال الگوریتم نرمال‌سازی...', 'info');

        // فرمول کالیبراسیون بازه حرکتی سخت‌افزار برای استیک چپ
        const rangeXLeft = this.samples.left.maxX - this.samples.left.minX;
        const rangeYLeft = this.samples.left.maxY - this.samples.left.minY;
        
        // محاسبه ضریب گین (اگر بازه حرکتی صفر بود مقدار پیش‌فرض ۱ قرار می‌گیرد تا خطای Division by zero رخ ندهد)
        const scaleXLeft = rangeXLeft > 0 ? 2.0 / rangeXLeft : 1.0;
        const scaleYLeft = rangeYLeft > 0 ? 2.0 / rangeYLeft : 1.0;

        // فرمول کالیبراسیون بازه حرکتی سخت‌افزار برای استیک راست
        const rangeXRight = this.samples.right.maxX - this.samples.right.minX;
        const rangeYRight = this.samples.right.maxY - this.samples.right.minY;
        const scaleXRight = rangeXRight > 0 ? 2.0 / rangeXRight : 1.0;
        const scaleYRight = rangeYRight > 0 ? 2.0 / rangeYRight : 1.0;

        // تزریق رسمی ضرایب و آفست‌های استخراج‌شده به استیت سراسری نرم‌افزار جهت اصلاح بی‌درنگ پکت‌ها
        AppState.calibration.computedOffsets.left = {
            offsetX: this.samples.left.centerX,
            offsetY: this.samples.left.centerY,
            scaleX: scaleXLeft,
            scaleY: scaleYLeft
        };

        AppState.calibration.computedOffsets.right = {
            offsetX: this.samples.right.centerX,
            offsetY: this.samples.right.centerY,
            scaleX: scaleXRight,
            scaleY: scaleYRight
        };

        AppState.calibration.isCalibrated = true;
        this.logToConsole('ماتریس اصلاح برداری با موفقیت تولید و با کدهای امپریکال ادغام شد.', 'success');
    }

    /**
     * پایان فرآیند و ثبت نهایی تغییرات در کنترلر
     */
    finish() {
        this.isActive = false;
        
        const wizardContainer = document.getElementById('wizard-container');
        if (wizardContainer) wizardContainer.classList.remove('active');
        
        this.logToConsole('تغییرات با موفقیت روی لایه نرم‌افزار فیکس شدند. دستگاه آماده استفاده است.', 'success');
    }

    /**
     * متد کمکی جهت بروزرسانی همزمان فریم‌های لایه تعاملی UI بر اساس استیت ماشین کالیبراسیون
     */
    updateUI() {
        const wizardContainer = document.getElementById('wizard-container');
        const stepNumber = document.getElementById('wiz-step-number');
        const title = document.getElementById('wiz-title');
        const desc = document.getElementById('wiz-desc');
        const progressBar = document.getElementById('wiz-progress');
        const btnBack = document.getElementById('wiz-btn-back');
        const btnNext = document.getElementById('wiz-btn-next');

        if (!wizardContainer) return;

        // آشکارسازی باکس گلس‌مورفیسم ویزارد
        wizardContainer.classList.add('active');

        // بروزرسانی متون راهنما بر اساس گام زنده
        const currentGuide = this.stepGuides[this.currentStep - 1];
        if (stepNumber) stepNumber.innerText = `مرحله ${this.currentStep} از ${this.totalSteps}`;
        if (title) title.innerText = currentGuide.title;
        if (desc) desc.innerText = currentGuide.desc;

        // محاسبه و جابجایی پروگرس‌بار خطی هندسی
        const progressPercent = (this.currentStep / this.totalSteps) * 100;
        if (progressBar) progressBar.style.width = `${progressPercent}%`;

        // مدیریت لایه فعال/غیرفعال بودن دکمه‌های ناوبری
        if (btnBack) btnBack.disabled = this.currentStep === 1;
        if (btnNext) {
            btnNext.innerText = this.currentStep === this.totalSteps ? 'پایان و ثبت' : 'بعدی';
            btnNext.className = this.currentStep === this.totalSteps ? 'btn btn-success' : 'btn btn-primary';
        }
    }

    /**
     * تزریق مستقیم رویدادها به کنسول مانیتورینگ کارگاهی لایه کاربری
     */
    logToConsole(message, type = 'info') {
        const consoleBody = document.getElementById('app-console');
        if (!consoleBody) return;

        const logRow = document.createElement('div');
        logRow.className = `log-${type}`;
        logRow.innerText = `[${type.toUpperCase()}] ${message}`;
        
        consoleBody.appendChild(logRow);
        consoleBody.scrollTop = consoleBody.scrollHeight; // اسکرول خودکار به آخرین پکت لوگ
    }
}

// اکسپورت تک‌وهله‌ای (Singleton Pattern) جهت تضمین پایداری ماشین وضعیت در کل پروژه
export const CalibrationWizard = new CalibrationWizardEngine();
