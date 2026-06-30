/**
 * js/display/canvas.js
 * HID-Fix Geometric Vector Canvas Engine (ES2024 - OOP Architecture)
 * مدیریت فوق پیشرفته و کاملاً شیء‌گرا رندر برداری استیک‌ها، پایش تریل‌ها و ددزون‌ها
 */

import { AppState } from '../core/state.js';

class StickVisualizer {
    /**
     * @param {string} canvasId - شناسه المان بوم در DOM
     * @param {string} stickKey - کلید شناسه آنالوگ ('left' | 'right')
     */
    constructor(canvasId, stickKey) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error(`Canvas element with ID ${canvasId} not found.`);
            return;
        }
        this.ctx = this.canvas.getContext('2d');
        this.stickKey = stickKey;
        this.trail = [];
        this.maxTrailPoints = 140; // تعداد فریم‌های بافر نگهداری مسیر حرکت پوتانسیومتر
        
        // تم‌های رنگی داینامیک تفکیک شده بر اساس سمت استیک
        this.theme = {
            accent: stickKey === 'left' ? '#00f2fe' : '#10b981',
            glow: stickKey === 'left' ? 'rgba(0, 242, 254, 0.4)' : 'rgba(16, 185, 129, 0.4)',
            grid: '#131929',
            deadzone: 'rgba(239, 68, 68, 0.15)',
            text: '#64748b'
        };

        this.dimensions = {
            width: this.canvas.width,
            height: this.canvas.height,
            centerX: this.canvas.width / 2,
            centerY: this.canvas.height / 2,
            radius: (this.canvas.width / 2) - 15
        };
    }

    /**
     * پاکسازی فریم قبلی بوم
     */
    clear() {
        this.ctx.clearRect(0, 0, this.dimensions.width, this.dimensions.height);
    }

    /**
     * رسم گرید دکارتي و دوایر فرکانسی رادار داخلی
     */
    drawGrid() {
        const { ctx, dimensions, theme } = this;
        const { centerX, centerY, radius } = dimensions;

        // پس‌زمینه عمیق رادار داخلی
        ctx.fillStyle = '#03060f';
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();

        // دوایر رادار کمکی سنجش برداری میزان دامنه ولتاژ (Amplitude Scale)
        ctx.strokeStyle = theme.grid;
        ctx.lineWidth = 1;
        [0.25, 0.5, 0.75, 1.0].forEach(scale => {
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius * scale, 0, Math.PI * 2);
            ctx.stroke();
        });

        // رسم محورهای خطی X و Y مرکز مختصات
        ctx.beginPath();
        ctx.moveTo(centerX - radius, centerY);
        ctx.lineTo(centerX + radius, centerY);
        ctx.moveTo(centerX, centerY - radius);
        ctx.lineTo(centerX, centerY + radius);
        ctx.stroke();
    }

    /**
     * رسم محدوده ددزون‌های استاندارد ۵ درصدی سخت‌افزاری (برای تشخیص سریع دریفت ناشی از نویز پوتانسیومتر)
     */
    drawDeadzones() {
        const { ctx, dimensions, theme } = this;
        const { centerX, centerY, radius } = dimensions;
        
        const deadzoneRadius = radius * 0.05; // ۵ درصد محدوده لرزش ولتاژ
        ctx.fillStyle = theme.deadzone;
        ctx.beginPath();
        ctx.arc(centerX, centerY, deadzoneRadius, 0, Math.PI * 2);
        ctx.fill();
    }

    /**
     * ثبت پوزیشن در آرایه بافر و رندر سایه حرکتی (History Trail) با گرادیان آلفا
     */
    drawTrail(pointerX, pointerY) {
        const { ctx, theme } = this;
        
        this.trail.push({ x: pointerX, y: pointerY });
        if (this.trail.length > this.maxTrailPoints) {
            this.trail.shift();
        }

        if (this.trail.length < 2) return;

        ctx.strokeStyle = theme.accent;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.beginPath();
        ctx.moveTo(this.trail[0].x, this.trail[0].y);
        for (let i = 1; i < this.trail.length; i++) {
            // اعمال شفافیت متغیر متناسب با فریم زمانی ثبت وکتور
            ctx.globalAlpha = i / this.trail.length;
            ctx.lineTo(this.trail[i].x, this.trail[i].y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1.0; // بازنشانی آلفای رندر پلتفرم
    }

    /**
     * رسم نشانگر فیزیکی کورسر استیک به همراه افکت سایه نوری (Glow Effect)
     */
    drawPointer(pointerX, pointerY) {
        const { ctx, theme } = this;
        
        ctx.shadowBlur = 10;
        ctx.shadowColor = theme.accent;
        ctx.fillStyle = theme.accent;
        
        ctx.beginPath();
        ctx.arc(pointerX, pointerY, 6, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.shadowBlur = 0; // حذف گپ پردازشی سایه پس از اتمام رندر کورسر

        // رسم حلقه سفید بیرونی کورسر تفکیک‌کننده دید کابر
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(pointerX, pointerY, 8, 0, Math.PI * 2);
        ctx.stroke();
    }

    /**
     * محاسبه زنده میزان فاصله اقلیدسی نقطه جاری از مبدا (Live Center Offset)
     */
    calculateVectorMetrics(x, y) {
        const offset = Math.sqrt(x * x + y * y);
        if (this.stickKey === 'left') {
            AppState.analysis.left.centerOffset = offset;
        } else {
            AppState.analysis.right.centerOffset = offset;
        }
    }

    /**
     * مپینگ زنده فریم به خانه منطقی فعال در ماتریس جهت‌های ۳x۳ رابط کاربری
     */
    updateDirectionMatrix(x, y) {
        const threshold = 0.35; // حد آستانه انحراف فرکانسی مگنت یا زغال
        let currentDir = 'C';

        if (y < -threshold) {
            if (x < -threshold) currentDir = 'NW';
            else if (x > threshold) currentDir = 'NE';
            else currentDir = 'N';
        } else if (y > threshold) {
            if (x < -threshold) currentDir = 'SW';
            else if (x > threshold) currentDir = 'SE';
            else currentDir = 'S';
        } else {
            if (x < -threshold) currentDir = 'W';
            else if (x > threshold) currentDir = 'E';
        }

        const matrixContainer = document.getElementById(`matrix-${this.stickKey}`);
        if (matrixContainer) {
            const spans = matrixContainer.querySelectorAll('span');
            spans.forEach(span => {
                if (span.dataset.dir === currentDir) {
                    span.classList.add('active');
                } else {
                    span.classList.remove('active');
                }
            });
        }
    }

    /**
     * ارکستراتور اصلی پردازش فریم رندر در فرکانس بالا (۶۰FPS / ۱۲۰FPS)
     * @param {number} rawX - مقدار دکود شده محور افقی از فریمور کنترلر (-1 تا +1)
     * @param {number} rawY - مقدار دکود شده محور عمودی از فریمور کنترلر (-1 تا +1)
     */
    updateAndRender(rawX, rawY) {
        this.clear();
        this.drawGrid();
        this.drawDeadzones();

        // تبدیل مقادیر سنسور به مختصات پیکسلی بوم گرافیکی کانوس
        const pointerX = this.dimensions.centerX + (rawX * this.dimensions.radius);
        const pointerY = this.dimensions.centerY + (rawY * this.dimensions.radius);

        this.drawTrail(pointerX, pointerY);
        this.drawPointer(pointerX, pointerY);
        
        this.calculateVectorMetrics(rawX, rawY);
        this.updateDirectionMatrix(rawX, rawY);
    }
}

// ساختار خروجی و متمرکز مدیریت بوم‌ها جهت تعامل با هسته نرم‌افزار (app.js)
export const AnalogCanvas = {
    instances: {},

    /**
     * مقداردهی اولیه و وهله‌سازی شیء‌گرا برای هر دو استیک
     */
    init(canvasLeftId, canvasRightId) {
        this.instances['left'] = new StickVisualizer(canvasLeftId, 'left');
        this.instances['right'] = new StickVisualizer(canvasRightId, 'right');
    },

    /**
     * متد فرآیند ارجاع پکت دریافتی به کلاس کپسوله شده شیء هدف
     */
    updateAndRender(stickKey, x, y) {
        const instance = this.instances[stickKey];
        if (instance) {
            instance.updateAndRender(x, y);
        }
    }
};
