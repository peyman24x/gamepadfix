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
     * رسم محدوده ددزون‌های استاندارد ۵ درصدی سخت‌افزاری
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
     * ثبت پوزیشن در آرایه بافر و رندر سایه حرکتی (Motion History Trail)
     */
    drawTrail(px, py) {
        const { ctx, theme } = this;
        this.trail.push({ x: px, y: py });
        if (this.trail.length > this.maxTrailPoints) this.trail.shift();

        if (this.trail.length < 2) return;

        ctx.strokeStyle = theme.glow;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(this.trail[0].x, this.trail[0].y);
        for (let i = 1; i < this.trail.length; i++) {
            ctx.lineTo(this.trail[i].x, this.trail[i].y);
        }
        ctx.stroke();
    }

    /**
     * رسم نشانه فیزیکی موقعیت نهایی آنالوگ (Target Crosshair Pointer)
     */
    drawPointer(px, py) {
        const { ctx, theme } = this;
        
        ctx.shadowBlur = 15;
        ctx.shadowColor = theme.accent;
        ctx.fillStyle = theme.accent;
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.fill();
        
        // بازنشانی سایه‌ها برای جلوگیری از افت نرخ فریم
        ctx.shadowBlur = 0;
    }

    /**
     * رندر متنی ماتریس مختصات به صورت هاد (HUD Coordinates Engine)
     */
    renderHudText(rawX, rawY) {
        const { ctx, dimensions, theme } = this;
        ctx.fillStyle = theme.text;
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`X: ${rawX.toFixed(4)}`, 15, dimensions.height - 25);
        ctx.fillText(`Y: ${rawY.toFixed(4)}`, 15, dimensions.height - 12);
    }

    /**
     * محاسبات برداری ریاضی میزان انحراف سنترگیری (Center Displacement)
     */
    calculateVectorMetrics(rawX, rawY) {
        const drift = Math.sqrt(rawX * rawX + rawY * rawY);
        if (this.stickKey === 'left') {
            AppState.analysis.left.centerOffset = drift;
        } else {
            AppState.analysis.right.centerOffset = drift;
        }
    }

    /**
     * نگاشت همزمان به ماتریس جهت‌های جغرافیایی ۳x۳ رابط کاربری
     */
    updateDirectionMatrix(rawX, rawY) {
        const threshold = 0.25;
        let dir = 'C';

        if (rawY < -threshold) {
            if (rawX < -threshold) dir = 'NW';
            else if (rawX > threshold) dir = 'NE';
            else dir = 'N';
        } else if (rawY > threshold) {
            if (rawX < -threshold) dir = 'SW';
            else if (rawX > threshold) dir = 'SE';
            else dir = 'S';
        } else {
            if (rawX < -threshold) dir = 'W';
            else if (rawX > threshold) dir = 'E';
        }

        const matrixContainer = document.getElementById(`matrix-${this.stickKey}`);
        if (matrixContainer) {
            const spans = matrixContainer.querySelectorAll('span');
            spans.forEach(span => {
                if (span.getAttribute('data-dir') === dir) {
                    span.classList.add('active');
                } else {
                    span.classList.remove('active');
                }
            });
        }
    }

    /**
     * ارکستراتور اصلی پردازش فریم رندر در فرکانس بالا
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
        this.renderHudText(rawX, rawY);
        
        this.calculateVectorMetrics(rawX, rawY);
        this.updateDirectionMatrix(rawX, rawY);
    }
}

export const AnalogCanvas = {
    instances: {},

    init(canvasLeftId, canvasRightId) {
        this.instances['left'] = new StickVisualizer(canvasLeftId, 'left');
        this.instances['right'] = new StickVisualizer(canvasRightId, 'right');
    },

    updateAndRender(stickKey, rawX, rawY) {
        const visualizer = this.instances[stickKey];
        if (visualizer) {
            visualizer.updateAndRender(rawX, rawY);
        }
    }
};
