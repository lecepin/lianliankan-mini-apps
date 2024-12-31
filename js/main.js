import './render';
import LianLianKan from './runtime/lianliankan'; // 导入连连看游戏类

// 获取设备像素比
const pixelRatio = wx.getSystemInfoSync().pixelRatio;

// 调整canvas大小以适应设备像素比
const {
    windowWidth,
    windowHeight
} = wx.getSystemInfoSync();
canvas.width = windowWidth * pixelRatio;
canvas.height = windowHeight * pixelRatio;

const ctx = canvas.getContext('2d'); // 获取canvas的2D绘图上下文;

// 设置canvas样式大小
canvas.style = {
    width: windowWidth + 'px',
    height: windowHeight + 'px'
};

// 缩放上下文以匹配设备像素比
ctx.scale(pixelRatio, pixelRatio);

/**
 * 游戏主函数
 */
export default class Main {
    constructor() {
        this.aniId = 0;
        // 保存实际显示尺寸供游戏使用
        this.screenWidth = windowWidth;
        this.screenHeight = windowHeight;
        this.restart();
    }

    restart() {
        this.lianliankan = new LianLianKan(this.screenWidth, this.screenHeight);

        this.bindLoop = this.loop.bind(this);

        // 清除上一局的动画
        if (this.aniId !== 0) {
            cancelAnimationFrame(this.aniId);
        }

        this.aniId = requestAnimationFrame(this.bindLoop);
    }

    loop() {
        // 清屏
        ctx.clearRect(0, 0, this.screenWidth, this.screenHeight);

        // 绘制黑色背景
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, this.screenWidth, this.screenHeight);

        // 绘制游戏
        this.lianliankan.render(ctx);

        // 继续下一帧
        this.aniId = requestAnimationFrame(this.bindLoop);
    }
}