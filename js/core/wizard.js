/**
 * HID-Fix 7-Step Hardware Calibration Wizard Engine (ES2024)
 * مدیریت ماشین وضعیت کالیبراسیون، ثبت بافرهای فیزیکی استیک و محاسبات ماتریس سنترگیری
 */

import { AppState } from './state.js';

export const CalibrationWizard = {
    currentStep: 1,
    totalSteps: 7,
    isActive: false,

    samples: {
        left: { minX: 1.0, maxX: -1.0, minY: 1.0, maxY: -1.0, centerX: 0, centerY: 0 },
        right: { minX: 1.0, maxX: -1.0, minY: 1.0, maxY: -1.0, centerX: 0, centerY: 0 }
    },

    start() {
        if (!AppState.connection.isConnected) {
            AppState.log('جهت شروع کالیبراسیون، ابتدا باید کنترلر را متصل کنید.', 'warning');
            return;
        }
        this.isActive = true;
        this.currentStep = 1;
        this.resetSamples();
        this.updateUI();
        AppState.log('ویزارد ۷ مرحله‌ای کالیبراسیون سخت‌افزاری فعال شد.', 'info');
    },

    nextStep() {
        if (!this.isActive) return;

        this.processStepData(this.currentStep);

        if (this.currentStep < this.totalSteps) {
            this.currentStep++;
            this.updateUI();
            AppState.log(`ورود به مرحله ${this.currentStep} کالیبراسیون.`, 'info');
        } else {
            this.completeCalibration();
        }
    },

    prevStep() {
        if (!this.isActive || this.currentStep <= 1) return;
        this.currentStep--;
        this.updateUI();
    },

    resetSamples() {
        this.samples = {
            left: { minX: 1.0, maxX: -1.0, minY: 1.0, maxY: -1.0, centerX: 0, centerY: 0 },
            right: { minX: 1.0, maxX: -1.0, minY: 1.0, maxY: -1.0, centerX: 0, centerY: 0 }
        };
    },

    processStepData(step) {
        const lx = AppState.inputs.axes.lx;
        const ly = AppState.inputs.axes.ly;
        const rx = AppState.inputs.axes.rx;
        const ry = AppState.inputs.axes.ry;

        switch (step) {
            case 2: // ثبت نقطه استراحت فیزیکی (Physical Center) آنالوگ چپ
                this.samples.left.centerX = lx;
                this.samples.left.centerY = ly;
                AppState.log(`نقطه صفر آنالوگ چپ ثبت شد: X=${lx.toFixed(4)}, Y=${ly.toFixed(4)}`, 'success');
                break;

            case 3: // انحراف لبه‌ها (Outer Range) آنالوگ چپ
                AppState.log(`محدوده حرکتی نهایی استیک چپ قفل شد: [${this.samples.left.minX.toFixed(2)}, ${this.samples.left.maxX.toFixed(2)}]`, 'success');
                break;

            case 4: // ثبت نقطه استراحت فیزیکی آنالوگ راست
                this.samples.right.centerX = rx;
                this.samples.right.centerY = ry;
                AppState.log(`نقطه صفر آنالوگ راست ثبت شد: X=${rx.toFixed(4)}, Y=${ry.toFixed(4)}`, 'success');
                break;

            case 5: // انحراف لبه‌ها آنالوگ راست
                AppState.log(`محدوده حرکتی نهایی استیک راست قفل شد: [${this.samples.right.minX.toFixed(2)}, ${this.samples.right.maxX.toFixed(2)}]`, 'success');
                break;

            case 6: // ساخت نهایی ماتریس کالیبراسیون و اعمال نرم‌افزاری
                this.applyCalibrationMatrix();
                break;
        }
    },

    captureLiveBounds() {
        if (!this.isActive) return;

        if (this.currentStep === 3) { // مانیتورینگ زنده استیک چپ در حین چرخش کاربر
            const lx = AppState.inputs.axes.lx;
            const ly = AppState.inputs.axes.ly;
            this.samples.left.minX = Math.min(this.samples.left.minX, lx);
            this.samples.left.maxX = Math.max(this.samples.left.maxX, lx);
            this.samples.left.minY = Math.min(this.samples.left.minY, ly);
            this.samples.left.maxY = Math.max(this.samples.left.maxY, ly);
        } else if (this.currentStep === 5) { // مانیتورینگ زنده استیک راست در حین چرخش کاربر
            const rx = AppState.inputs.axes.rx;
            const ry = AppState.inputs.axes.ry;
            this.samples.right.minX = Math.min(this.samples.right.minX, rx);
            this.samples.right.maxX = Math.max(this.samples.right.maxX, rx);
            this.samples.right.minY = Math.min(this.samples.right.minY, ry);
            this.samples.right.maxY = Math.max(this.samples.right.maxY, ry);
        }
    },

    applyCalibrationMatrix() {
        // حل باگ ساختاری مسیر آبجکت استیت مادری
        AppState.calibration.computedOffsets.left.offsetX = this.samples.left.centerX;
        AppState.calibration.computedOffsets.left.offsetY = this.samples.left.centerY;
        AppState.calibration.computedOffsets.right.offsetX = this.samples.right.centerX;
        AppState.calibration.computedOffsets.right.offsetY = this.samples.right.centerY;

        // محاسبه اسکیلینگ بر اساس دامنه‌های حرکتی ثبت شده برای از بین بردن دریفت لبه‌ها
        const rangeLX = this.samples.left.maxX - this.samples.left.minX;
        if (rangeLX > 0) AppState.calibration.computedOffsets.left.scaleX = 2.0 / rangeLX;
        
        const rangeLY = this.samples.left.maxY - this.samples.left.minY;
        if (rangeLY > 0) AppState.calibration.computedOffsets.left.scaleY = 2.0 / rangeLY;

        AppState.calibration.isCalibrated = true;
        AppState.log('ماتریس آلاینمنت برای جبران فیزیکی دریفت (Zero-Drift Alignment Matrix) با موفقیت تولید شد.', 'success');
    },

    completeCalibration() {
        this.isActive = false;
        this.currentStep = 1;
        this.updateUI();
        const wizardBox = document.getElementById('wizard-container');
        if (wizardBox) wizardBox.classList.remove('active');
        AppState.log('عملیات کالیبراسیون سخت‌افزاری با موفقیت به پایان رسید و در پروفایل ابزار ذخیره شد.', 'success');
    },

    cancel() {
        this.isActive = false;
        this.currentStep = 1;
        this.resetSamples();
        this.updateUI();
        const wizardBox = document.getElementById('wizard-container');
        if (wizardBox) wizardBox.classList.remove('active');
        AppState.log('عملیات کالیبراسیون توسط تکنسین لغو شد.', 'warning');
    },

    updateUI() {
        const wizardBox = document.getElementById('wizard-container');
        if (!wizardBox) return;

        if (this.isActive) {
            wizardBox.classList.add('active');
        } else {
            wizardBox.classList.remove('active');
            return;
        }

        const btnBack = document.getElementById('wiz-btn-back');
        if (btnBack) btnBack.disabled = (this.currentStep === 1);
        
        const btnNext = document.getElementById('wiz-btn-next');
        if (btnNext) btnNext.innerText = (this.currentStep === this.totalSteps) ? 'ذخیره و پایان' : 'مرحله بعدی';

        const progressPercent = ((this.currentStep / this.totalSteps) * 100).toFixed(0);
        const elProgress = document.getElementById('wiz-progress');
        if (elProgress) elProgress.style.width = `${progressPercent}%`;
        
        const elStepNum = document.getElementById('wiz-step-number');
        if (elStepNum) elStepNum.innerText = `مرحله ${this.currentStep} از ${this.totalSteps}`;

        const stepGuides = [
            { title: 'شروع کالیبراسیون', desc: 'لطفاً کنترلر را روی سطح کاملاً صاف قرار داده و استیک‌ها را رها کنید. سپس روی مرحله بعد کلیک کنید.' },
            { title: 'ثبت مرکز آنالوگ چپ', desc: 'بدون دست زدن به آنالوگ‌ها، دکمه ثبت مرحله بعد را بزنید تا خروجی ولتاژ و مقاومت تراشه چپ صفر شود.' },
            { title: 'کالیبراسیون دامنه استیک چپ', desc: 'استیک چپ را ۲ الی ۳ بار به صورت کامل ۳۶۰ درجه بچرخانید تا بیشترین محدوده مغناطیسی ثبت شود. سپس دکمه بعد را بزنید.' },
            { title: 'ثبت مرکز آنالوگ راست', desc: 'استیک‌ها را رها کرده و دکمه ثبت مرحله بعد را بزنید تا خروجی ولتاژ و مقاومت تراشه راست صفر شود.' },
            { title: 'کالیبراسیون دامنه استیک راست', desc: 'استیک راست را ۲ الی ۳ بار به صورت کامل ۳۶۰ درجه بچرخانید تا بیشترین محدوده مغناطیسی ثبت شود. سپس دکمه بعد را بزنید.' },
            { title: 'تولید ماتریس تصحیح خطا', desc: 'سیستم در حال ارزیابی بافرهای ذخیره‌شده و اعمال اسکیلینگ نهایی به خطای دایره‌ای است. روی دکمه بعد کلیک کنید.' },
            { title: 'اعمال فریمور نهایی', desc: 'فرآیند با موفقیت انجام شد. برای ذخیره‌سازی دائمی مقادیر جدید روی دکمه پایان کلیک کنید.' }
        ];

        const currentGuide = stepGuides[this.currentStep - 1];
        const elTitle = document.getElementById('wiz-title');
        const elDesc = document.getElementById('wiz-desc');
        if (elTitle) elTitle.innerText = currentGuide.title;
        if (elDesc) elDesc.innerText = currentGuide.desc;
    }
};
