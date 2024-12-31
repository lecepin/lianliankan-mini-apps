const GRID_PADDING = 5; // 格子间距
const COLORS = [
  "#ff0000",
  "#00ff00",
  "#0000ff",
  "#ffff00",
  "#ff00ff",
  "#00ffff",
]; // 方块颜色
const GAME_TIME = 30; // 游戏时间(秒)
const GAME_PADDING = 40; // 游戏区域的内边距

export default class LianLianKan {
  static DEFAULT_SIZE = 5; // 默认大小

  constructor(screenWidth, screenHeight) {
    // 使用传入的实际显示尺寸替代导入的常量
    this.SCREEN_WIDTH = screenWidth;
    this.SCREEN_HEIGHT = screenHeight;

    this.showConfig = true; // 显示配置界面
    this.configSize = LianLianKan.DEFAULT_SIZE; // 配置的大小
    this.startTime = 0; // 记录游戏开始时间
    this.endTime = 0; // 记录游戏结束时间

    // 获取系统信息
    const systemInfo = wx.getSystemInfoSync();
    this.statusBarHeight = systemInfo.statusBarHeight;
    this.menuButtonBoundingClientRect = wx.getMenuButtonBoundingClientRect();

    // 计算导航栏高度
    this.navigationBarHeight =
      (this.menuButtonBoundingClientRect.top - systemInfo.statusBarHeight) * 2 +
      this.menuButtonBoundingClientRect.height;

    // 计算顶部安全区域总高度
    this.topSafeHeight = this.statusBarHeight + this.navigationBarHeight;

    this.init();
    this.bindEvents();
  }

  init() {
    if (this.showConfig) return; // 在配置界面时不初始化游戏

    this.score = 0;
    this.timeLeft = GAME_TIME;
    this.startTime = Date.now(); // 记录开始时间
    this.selected = null;
    this.isGameOver = false;
    this.connectingPath = null;
    this.connectingAnimation = 0;

    // 实际游戏区域大小
    this.gameRows = this.configSize;
    this.gameCols = this.configSize;
    // 加上边界的棋盘大小
    this.rows = this.gameRows + 2;
    this.cols = this.gameCols + 2;

    // 计算可用的游戏区域大小
    const availableWidth = this.SCREEN_WIDTH - GAME_PADDING * 2;
    const availableHeight = this.SCREEN_HEIGHT - GAME_PADDING * 2;
    const minSize = Math.min(availableWidth, availableHeight);

    // 计算单个格子的大小
    this.gridSize =
      Math.floor(
        (minSize - GRID_PADDING * (this.gameCols - 1)) / this.gameCols / 2
      ) * 2;

    // 计算实际的游戏区域大小
    this.boardWidth =
      this.gameCols * this.gridSize + (this.gameCols - 1) * GRID_PADDING;
    this.boardHeight =
      this.gameRows * this.gridSize + (this.gameRows - 1) * GRID_PADDING;

    // 居中显示游戏区域
    this.startX = (this.SCREEN_WIDTH - this.boardWidth) / 2;
    this.startY = Math.max(
      this.topSafeHeight + 80, // 顶部安全区域 + 状态栏高度
      (this.SCREEN_HEIGHT - this.boardHeight) / 2
    );

    // 初始化游戏板
    this.initBoard();

    // 开始计时
    this.startTimer();
  }

  initBoard() {
    this.board = [];
    const pairs = [];

    // 计算实际可用的格子数（确保是偶数）
    const totalCells = this.gameRows * this.gameCols;
    const usableCells = totalCells - (totalCells % 2);

    // 生成配对的颜色
    for (let i = 0; i < usableCells / 2; i++) {
      const colorIndex = i % COLORS.length;
      pairs.push(colorIndex, colorIndex);
    }

    // 随机打乱
    for (let i = pairs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
    }

    // 如果总格子数是奇数，记录最后一个格子的位置
    const hasEmptyCell = totalCells % 2 === 1;
    const emptyCellIndex = hasEmptyCell
      ? Math.floor(Math.random() * totalCells)
      : -1;

    // 填充游戏板
    for (let i = 0; i < this.rows; i++) {
      this.board[i] = [];
      for (let j = 0; j < this.cols; j++) {
        // 边界位置设置为不可见的空格子
        if (i === 0 || i === this.rows - 1 || j === 0 || j === this.cols - 1) {
          this.board[i][j] = {
            color: null,
            visible: false,
          };
        } else {
          // 计算在实际游戏区域中的索引
          const index = (i - 1) * this.gameCols + (j - 1);
          // 如果是奇数总格子数的空格子位置，设置为不可见
          if (hasEmptyCell && index === emptyCellIndex) {
            this.board[i][j] = {
              color: null,
              visible: false,
            };
          } else {
            // 需要调整索引以跳过空格子
            const pairIndex =
              hasEmptyCell && index > emptyCellIndex ? index - 1 : index;
            this.board[i][j] = {
              color: COLORS[pairs[pairIndex]],
              visible: true,
            };
          }
        }
      }
    }
  }

  startTimer() {
    this.timer = setInterval(() => {
      this.timeLeft--;
      if (this.timeLeft <= 0) {
        this.gameOver();
      }
    }, 1000);
  }

  bindEvents() {
    wx.onTouchStart((e) => {
      if (this.showConfig) {
        this.handleConfigClick(e);
      } else {
        this.handleClick(e);
      }
    });
  }

  handleClick(e) {
    if (this.isGameOver) {
      const touch = e.touches[0];
      // 检查是否点击了重新开始按钮
      if (this.isRestartButtonClicked(touch.clientX, touch.clientY)) {
        this.showConfig = true;
        this.init();
        return;
      }
      return;
    }

    const touch = e.touches[0];

    // 检查是否点击返回按钮
    if (this.isBackButtonClicked(touch.clientX, touch.clientY)) {
      this.showConfig = true;
      clearInterval(this.timer);
      return;
    }

    const { row, col } = this.getTouchedGrid(touch.clientX, touch.clientY);

    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return;
    if (!this.board[row][col].visible) return;

    if (!this.selected) {
      this.selected = { row, col };
    } else {
      if (this.selected.row === row && this.selected.col === col) {
        this.selected = null;
        return;
      }

      if (this.canConnect(this.selected, { row, col })) {
        this.eliminate(this.selected, { row, col });
        this.score++;
      }

      this.selected = null;
    }
  }

  getTouchedGrid(x, y) {
    const gridX = Math.floor(
      (x - this.startX) / (this.gridSize + GRID_PADDING)
    );
    const gridY = Math.floor(
      (y - this.startY) / (this.gridSize + GRID_PADDING)
    );
    // 转换为带边界的坐标
    return { row: gridY + 1, col: gridX + 1 };
  }

  canConnect(p1, p2) {
    // 检查是否相同颜色
    if (this.board[p1.row][p1.col].color !== this.board[p2.row][p2.col].color) {
      return false;
    }

    // 检查连接路径
    return this.findPath(p1, p2) || this.canConnectThroughBorder(p1, p2);
  }

  canConnectThroughBorder(p1, p2) {
    // 检查是否在同一边界上
    if (this.isOnSameBorder(p1, p2)) {
      // 检查中间是否有其他方块
      if (p1.row === 0 || p1.row === this.rows - 1) {
        // 同行边界，检查水平方向
        const minCol = Math.min(p1.col, p2.col);
        const maxCol = Math.max(p1.col, p2.col);
        for (let col = minCol + 1; col < maxCol; col++) {
          if (this.board[p1.row][col].visible) {
            return false;
          }
        }
      } else {
        // 同列边界，检查垂直方向
        const minRow = Math.min(p1.row, p2.row);
        const maxRow = Math.max(p1.row, p2.row);
        for (let row = minRow + 1; row < maxRow; row++) {
          if (this.board[row][p1.col].visible) {
            return false;
          }
        }
      }
      return true;
    }

    return false;
  }

  isOnSameBorder(p1, p2) {
    // 检查是否为同一颜色
    if (this.board[p1.row][p1.col].color !== this.board[p2.row][p2.col].color) {
      return false;
    }

    // 在上边界
    if (p1.row === 0 && p2.row === 0) return true;
    // 在下边界
    if (p1.row === this.rows - 1 && p2.row === this.rows - 1) return true;
    // 在左边界
    if (p1.col === 0 && p2.col === 0) return true;
    // 在右边界
    if (p1.col === this.cols - 1 && p2.col === this.cols - 1) return true;

    return false;
  }

  getBorderType(point) {
    if (point.row === 0) return "top";
    if (point.row === this.rows - 1) return "bottom";
    if (point.col === 0) return "left";
    if (point.col === this.cols - 1) return "right";
    return null;
  }

  findPath(start, end) {
    // 初始化访问数组和转弯数数组
    const visited = Array(this.rows)
      .fill()
      .map(() => Array(this.cols).fill(false));
    const turns = Array(this.rows)
      .fill()
      .map(() => Array(this.cols).fill(Infinity));
    // 记录每个点是从哪个点来的，用于重建路径
    const from = Array(this.rows)
      .fill()
      .map(() => Array(this.cols).fill(null));

    // 初始化队列，存储 {row, col, direction, turns}
    // direction: 0=初始, 1=水平, 2=垂直
    const queue = [
      {
        row: start.row,
        col: start.col,
        direction: 0,
        turns: 0,
      },
    ];

    turns[start.row][start.col] = 0;
    visited[start.row][start.col] = true;

    // 方向数组：上、右、下、左
    const directions = [
      [-1, 0],
      [0, 1],
      [1, 0],
      [0, -1],
    ];

    while (queue.length > 0) {
      const current = queue.shift();

      // 如果到达终点，且转弯数不超过2，则找到路径
      if (
        current.row === end.row &&
        current.col === end.col &&
        current.turns <= 2
      ) {
        return this.buildPath(from, start, end);
      }

      // 遍历四个方向
      for (let i = 0; i < 4; i++) {
        const nextRow = current.row + directions[i][0];
        const nextCol = current.col + directions[i][1];

        // 检查是否越界
        if (
          nextRow < 0 ||
          nextRow >= this.rows ||
          nextCol < 0 ||
          nextCol >= this.cols
        ) {
          continue;
        }

        // 计算是否需要转弯
        const nextDirection = (i % 2) + 1; // 1=水平, 2=垂直
        const needTurn =
          current.direction !== 0 && current.direction !== nextDirection;
        const nextTurns = current.turns + (needTurn ? 1 : 0);

        // 如果转弯数超过2，跳过
        if (nextTurns > 2) continue;

        // 如果这个点被占用（非起点和终点），跳过
        if (
          this.board[nextRow][nextCol].visible &&
          !(nextRow === end.row && nextCol === end.col)
        ) {
          continue;
        }

        // 如果这条路径的转弯数更少，则更新
        if (nextTurns < turns[nextRow][nextCol]) {
          turns[nextRow][nextCol] = nextTurns;
          visited[nextRow][nextCol] = true;
          from[nextRow][nextCol] = { row: current.row, col: current.col };

          queue.push({
            row: nextRow,
            col: nextCol,
            direction: nextDirection,
            turns: nextTurns,
          });
        }
      }
    }

    return null; // 没找到有效路径
  }

  buildPath(from, start, end) {
    const path = [];
    let current = { row: end.row, col: end.col };

    // 从终点往回构建路径
    while (current) {
      path.unshift(current);
      if (current.row === start.row && current.col === start.col) break;
      current = from[current.row][current.col];
    }

    return path;
  }

  eliminate(p1, p2) {
    let path;
    if (this.canConnectThroughBorder(p1, p2)) {
      // 如果是通过边界连接，创建包含边界外转折点的路径
      path = this.createBorderPath(p1, p2);
    } else {
      // 否则使用常规路径查找
      path = this.findPath(p1, p2);
    }

    if (!path) return;

    // 保存连接路径
    this.connectingPath = path;
    this.connectingAnimation = 30;

    // 延迟消除
    setTimeout(() => {
      this.board[p1.row][p1.col].visible = false;
      this.board[p2.row][p2.col].visible = false;
      this.connectingPath = null;

      if (this.checkWin()) {
        this.gameWin();
      }
    }, 500);
  }

  createBorderPath(p1, p2) {
    const path = [];
    path.push(p1);

    // 根据边界类型添加转折点
    if (this.isOnSameBorder(p1, p2)) {
      const borderType = this.getBorderType(p1);

      let outerPoint1, outerPoint2;
      switch (borderType) {
        case "top":
          outerPoint1 = { row: p1.row - 1, col: p1.col };
          outerPoint2 = { row: p2.row - 1, col: p2.col };
          break;
        case "bottom":
          outerPoint1 = { row: p1.row + 1, col: p1.col };
          outerPoint2 = { row: p2.row + 1, col: p2.col };
          break;
        case "left":
          outerPoint1 = { row: p1.row, col: p1.col - 1 };
          outerPoint2 = { row: p2.row, col: p2.col - 1 };
          break;
        case "right":
          outerPoint1 = { row: p1.row, col: p1.col + 1 };
          outerPoint2 = { row: p2.row, col: p2.col + 1 };
          break;
      }
      path.push(outerPoint1, outerPoint2);
    }

    path.push(p2);
    return path;
  }

  checkWin() {
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        if (this.board[i][j].visible) {
          return false;
        }
      }
    }
    return true;
  }

  gameOver() {
    this.isGameOver = true;
    this.endTime = Date.now(); // 记录结束时间
    clearInterval(this.timer);
  }

  gameWin() {
    this.isGameOver = true;
    this.endTime = Date.now(); // 记录结束时间
    clearInterval(this.timer);
  }

  render(ctx) {
    if (this.showConfig) {
      this.renderConfig(ctx);
      return;
    }

    // 绘制顶部状态栏背景
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, this.topSafeHeight, this.SCREEN_WIDTH, 60);

    // 绘制返回按钮
    ctx.fillStyle = "#4CAF50";
    ctx.fillRect(10, this.topSafeHeight + 10, 40, 40);
    ctx.fillStyle = "#ffffff";
    ctx.font = "20px Arial";
    ctx.textAlign = "center";
    ctx.fillText("←", 30, this.topSafeHeight + 35);

    // 绘制时间进度条
    const progressWidth = 160; // 减小进度条宽度
    const progressHeight = 20;
    const progressX = this.SCREEN_WIDTH - progressWidth - 60;
    const progressY = this.topSafeHeight + 20;

    // 进度条背景
    ctx.fillStyle = "#333333";
    ctx.fillRect(progressX, progressY, progressWidth, progressHeight);

    // 计算进度和颜色
    const progress = this.timeLeft / GAME_TIME;
    let progressColor;
    if (progress > 0.6) {
      progressColor = "#4CAF50"; // 绿色
    } else if (progress > 0.3) {
      progressColor = "#FFC107"; // 黄色
    } else {
      progressColor = "#F44336"; // 红色
    }

    // 绘制进度条
    ctx.fillStyle = progressColor;
    ctx.fillRect(
      progressX,
      progressY,
      progressWidth * progress,
      progressHeight
    );

    // 绘制时间文本
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText(
      `${this.timeLeft}s`,
      progressX + progressWidth / 2,
      progressY + 15
    );

    // 重置文本对齐方式
    ctx.textAlign = "left";

    // 绘制得分（移到右边）
    ctx.textAlign = "right";
    ctx.fillStyle = "#ffffff";
    ctx.font = "20px Arial";
    ctx.fillText(
      `得分: ${this.score}`,
      progressX - 20,
      this.topSafeHeight + 35
    );

    // 绘制游戏板
    for (let i = 1; i < this.rows - 1; i++) {
      for (let j = 1; j < this.cols - 1; j++) {
        if (this.board[i][j].visible) {
          const x = this.startX + (j - 1) * (this.gridSize + GRID_PADDING);
          const y = this.startY + (i - 1) * (this.gridSize + GRID_PADDING);

          // 绘制方块
          ctx.fillStyle = this.board[i][j].color;
          ctx.fillRect(x, y, this.gridSize, this.gridSize);

          // 绘制选中效果
          if (
            this.selected &&
            this.selected.row === i &&
            this.selected.col === j
          ) {
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, this.gridSize, this.gridSize);
          }
        }
      }
    }

    // 绘制连接线
    if (this.connectingPath && this.connectingAnimation > 0) {
      ctx.beginPath();

      // 绘制路径
      for (let i = 0; i < this.connectingPath.length; i++) {
        const point = this.connectingPath[i];
        const x =
          this.startX +
          (point.col - 1) * (this.gridSize + GRID_PADDING) +
          this.gridSize / 2;
        const y =
          this.startY +
          (point.row - 1) * (this.gridSize + GRID_PADDING) +
          this.gridSize / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.strokeStyle = "#ffff00";
      ctx.lineWidth = 2;
      ctx.stroke();

      this.connectingAnimation--;
    }

    // 游戏结束界面
    if (this.isGameOver) {
      this.renderGameOver(ctx);
    }
  }

  renderGameOver(ctx) {
    // 半透明背景
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, this.SCREEN_WIDTH, this.SCREEN_HEIGHT);

    // 计算用时
    const timeUsed = Math.floor((this.endTime - this.startTime) / 1000);
    const minutes = Math.floor(timeUsed / 60);
    const seconds = timeUsed % 60;
    const timeString = `${minutes}分${seconds}秒`;

    // 游戏结束文本
    ctx.fillStyle = "#ffffff";
    ctx.font = "30px Arial";
    ctx.textAlign = "center";
    ctx.fillText(
      this.checkWin() ? "恭喜通关！" : "游戏结束",
      this.SCREEN_WIDTH / 2,
      this.SCREEN_HEIGHT / 2 - 50
    );
    ctx.fillText(
      `最终得分: ${this.score}`,
      this.SCREEN_WIDTH / 2,
      this.SCREEN_HEIGHT / 2
    );
    ctx.fillText(
      `用时: ${timeString}`,
      this.SCREEN_WIDTH / 2,
      this.SCREEN_HEIGHT / 2 + 40
    );

    // 重新开始按钮
    const btnWidth = 200;
    const btnHeight = 40;
    const btnX = (this.SCREEN_WIDTH - btnWidth) / 2;
    const btnY = this.SCREEN_HEIGHT / 2 + 100; // 调整按钮位置

    ctx.fillStyle = "#4CAF50";
    ctx.fillRect(btnX, btnY, btnWidth, btnHeight);
    ctx.fillStyle = "#ffffff";
    ctx.font = "20px Arial";
    ctx.fillText("重新开始", this.SCREEN_WIDTH / 2, btnY + 28);

    // 保存按钮区域用于点击检测
    this.restartBtn = {
      x: btnX,
      y: btnY,
      width: btnWidth,
      height: btnHeight,
    };
  }

  renderConfig(ctx) {
    // 绘制黑色背景
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, this.SCREEN_WIDTH, this.SCREEN_HEIGHT);

    // 绘制标题
    ctx.fillStyle = "#ffffff";
    ctx.font = "30px Arial";
    ctx.textAlign = "center";
    ctx.fillText(
      "游戏设置",
      this.SCREEN_WIDTH / 2,
      this.SCREEN_HEIGHT / 2 - 100
    );

    // 绘制大小选择
    ctx.font = "24px Arial";
    ctx.fillText(
      "游戏大小:",
      this.SCREEN_WIDTH / 2,
      this.SCREEN_HEIGHT / 2 - 50
    );

    // 绘制减号按钮
    ctx.fillStyle = "#4CAF50";
    ctx.fillRect(
      this.SCREEN_WIDTH / 2 - 90,
      this.SCREEN_HEIGHT / 2 - 20,
      40,
      40
    );
    ctx.fillStyle = "#ffffff";
    ctx.font = "30px Arial";
    ctx.fillText("-", this.SCREEN_WIDTH / 2 - 70, this.SCREEN_HEIGHT / 2 + 10);

    // 绘制当前大小
    ctx.fillStyle = "#ffffff";
    ctx.fillText(
      `${this.configSize}x${this.configSize}`,
      this.SCREEN_WIDTH / 2,
      this.SCREEN_HEIGHT / 2 + 10
    );

    // 绘制加号按钮
    ctx.fillStyle = "#4CAF50";
    ctx.fillRect(
      this.SCREEN_WIDTH / 2 + 50,
      this.SCREEN_HEIGHT / 2 - 20,
      40,
      40
    );
    ctx.fillStyle = "#ffffff";
    ctx.fillText("+", this.SCREEN_WIDTH / 2 + 70, this.SCREEN_HEIGHT / 2 + 10);

    // 绘制开始按钮
    const btnWidth = 200;
    const btnHeight = 40;
    const btnX = (this.SCREEN_WIDTH - btnWidth) / 2;
    const btnY = this.SCREEN_HEIGHT / 2 + 50;

    ctx.fillStyle = "#4CAF50";
    ctx.fillRect(btnX, btnY, btnWidth, btnHeight);
    ctx.fillStyle = "#ffffff";
    ctx.font = "20px Arial";
    ctx.fillText("开始游戏", this.SCREEN_WIDTH / 2, btnY + 28);
  }

  handleConfigClick(e) {
    const touch = e.touches[0];

    // 检查是否点击了加号按钮
    if (this.isPlusButtonClicked(touch.clientX, touch.clientY)) {
      this.configSize = Math.min(12, this.configSize + 2);
      return;
    }

    // 检查是否点击了减号按钮
    if (this.isMinusButtonClicked(touch.clientX, touch.clientY)) {
      this.configSize = Math.max(4, this.configSize - 2);
      return;
    }

    // 检查是否点击了开始按钮
    if (this.isStartButtonClicked(touch.clientX, touch.clientY)) {
      this.showConfig = false;
      this.init();
      return;
    }
  }

  isPlusButtonClicked(x, y) {
    return (
      x >= this.SCREEN_WIDTH / 2 + 50 &&
      x <= this.SCREEN_WIDTH / 2 + 90 &&
      y >= this.SCREEN_HEIGHT / 2 - 20 &&
      y <= this.SCREEN_HEIGHT / 2 + 20
    );
  }

  isMinusButtonClicked(x, y) {
    return (
      x >= this.SCREEN_WIDTH / 2 - 90 &&
      x <= this.SCREEN_WIDTH / 2 - 50 &&
      y >= this.SCREEN_HEIGHT / 2 - 20 &&
      y <= this.SCREEN_HEIGHT / 2 + 20
    );
  }

  isStartButtonClicked(x, y) {
    const btnWidth = 200;
    const btnHeight = 40;
    const btnX = (this.SCREEN_WIDTH - btnWidth) / 2;
    const btnY = this.SCREEN_HEIGHT / 2 + 50;

    return (
      x >= btnX && x <= btnX + btnWidth && y >= btnY && y <= btnY + btnHeight
    );
  }

  isBackButtonClicked(x, y) {
    const adjustedY = y - this.topSafeHeight;
    return x >= 10 && x <= 50 && adjustedY >= 10 && adjustedY <= 50;
  }

  isRestartButtonClicked(x, y) {
    if (!this.restartBtn) return false;
    return (
      x >= this.restartBtn.x &&
      x <= this.restartBtn.x + this.restartBtn.width &&
      y >= this.restartBtn.y &&
      y <= this.restartBtn.y + this.restartBtn.height
    );
  }
}
