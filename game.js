/* ==========================================================================
 * 贪吃蛇 · 代码骨架
 *
 * 当前阶段：第 5 步「碰撞与游戏结束」—— 到这里已经能完整玩一局了
 *   已完成：400×400 棋盘、标题、分数面板、开始 / 重新开始按钮
 *           3 格长的蛇、点击开始后按固定速度移动、主循环、暂停
 *           方向键与 WASD 转向（排队生效、禁止反向掉头）
 *           随机食物（不生成在蛇身上）、吃到加长一格并加 10 分
 *           撞墙 / 咬到自己 → 停止移动并显示「游戏结束」与最终分数
 *   待实现：最高分记录（最高分面板目前恒为 0）、触屏操作、音效
 *
 * 实现顺序建议（自下而上，每步都能跑起来看到效果）：
 *   1. resetGame()  —— 初始化蛇身、方向、分数          ✅ 已完成
 *   2. update()     —— 每帧让蛇前进一格                 ✅ 已完成
 *   3. draw()       —— 把蛇画到画布上                   ✅ 已完成
 *   4. loop()       —— 用固定节奏串起 update + draw      ✅ 已完成
 *   5. 转向         —— 方向键 / WASD，禁止掉头           ✅ 已完成
 *   6. spawnFood()  —— 随机生成食物，避开蛇身           ✅ 已完成
 *   7. 吃到食物     —— 加长蛇身、加分、重生成食物        ✅ 已完成
 *   8. 碰撞检测     —— 撞墙 / 撞自己 → 游戏结束          ✅ 本次完成
 * ========================================================================== */

'use strict';

/* --------------------------------------------------------------------------
 * 1. 配置：所有"可调参数"集中放这里，改数值不用翻代码
 * ------------------------------------------------------------------------ */
const CONFIG = {
  cols: 20,          // 横向格数
  rows: 20,          // 纵向格数
  cellSize: 20,      // 每格边长（像素）
  speed: 8,          // 每秒移动几格
  scorePerFood: 10,  // 吃一个食物加多少分

  colors: {
    background: '#1e2128',
    grid: '#262a31',
    snakeHead: '#4ade80',
    snakeBody: '#22c55e',
    food: '#f87171'
  }
};

/* --------------------------------------------------------------------------
 * 2. DOM 引用：页面元素在 <head> 里就查不到，所以脚本放在 </body> 之前
 * ------------------------------------------------------------------------ */
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const overlayEl = document.getElementById('overlay');
const overlayTitleEl = document.getElementById('overlay-title');
const overlayTextEl = document.getElementById('overlay-text');
const restartBtn = document.getElementById('btn-restart');
const startBtn = document.getElementById('btn-start');
const statusEl = document.getElementById('status');

/* --------------------------------------------------------------------------
 * 3. 状态容器：游戏的"当前情况"全放在这一个对象里
 * ------------------------------------------------------------------------ */
const state = {
  snake: [],                          // 蛇身坐标数组，[0] 是蛇头，形如 [{x, y}, ...]
  direction: { x: 1, y: 0 },          // 当前前进方向（只在 update() 里改变）
  pendingDirection: null,             // 玩家按下的方向，排队等下一次移动时才生效
  food: null,                          // 食物坐标 {x, y}
  score: 0,
  best: 0,
  status: 'idle',                      // idle | running | paused | over
  lastTime: 0,                         // 上一帧时间戳，用于控制移动节奏
  accumulator: 0                       // 时间累加器，凑够一格就移动一次
};

/* --------------------------------------------------------------------------
 * 4. 初始化：画布尺寸、空棋盘
 * ------------------------------------------------------------------------ */

/** 依据配置设定画布的真实像素尺寸 */
function initCanvas() {
  canvas.width = CONFIG.cols * CONFIG.cellSize;
  canvas.height = CONFIG.rows * CONFIG.cellSize;
}

/** 把"第几格"换算成"画布上的像素坐标"，绘图函数统一走这里 */
function toPixel(value) {
  return value * CONFIG.cellSize;
}

/** 画出背景、网格线和食物前的空地 —— 看到棋盘就说明结构对了 */
function drawBoard() {
  const width = canvas.width;
  const height = canvas.height;

  ctx.fillStyle = CONFIG.colors.background;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = CONFIG.colors.grid;
  ctx.lineWidth = 1;

  for (let col = 1; col < CONFIG.cols; col++) {
    const x = toPixel(col) + 0.5;      // +0.5 让 1px 线条落在像素中心，避免发虚
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let row = 1; row < CONFIG.rows; row++) {
    const y = toPixel(row) + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

/* --------------------------------------------------------------------------
 * 5. 游戏逻辑：初始化、食物、移动、绘制
 * ------------------------------------------------------------------------ */

/** 重置到"准备开始"状态：蛇回到中间，长度 3，方向向右，分数归零 */
function resetGame() {
  const midRow = Math.floor(CONFIG.rows / 2);    // 纵向居中那一行
  const headCol = Math.floor(CONFIG.cols / 2);   // 蛇头所在的列

  // 数组的第 0 项是蛇头，后面依次是身体 —— 三个方块连成一条横线
  state.snake = [
    { x: headCol,     y: midRow },   // 蛇头（最右）
    { x: headCol - 1, y: midRow },   // 第 2 节
    { x: headCol - 2, y: midRow }    // 第 3 节（尾巴）
  ];

  state.direction = { x: 1, y: 0 };   // 向右
  state.pendingDirection = null;      // 清掉上一次遗留的按键
  state.score = 0;
  state.status = 'idle';
  state.lastTime = 0;
  state.accumulator = 0;

  spawnFood();                        // 先摆一个食物，开局就能看到

  hideOverlay();                      // 收起上一局的"游戏结束"提示层
  draw();
  setStatus('已重置 —— 点击「开始游戏」，蛇会向右移动');
}

/**
 * 在空格子里随机放一个食物，绝对不会压在蛇身上。
 *
 * 做法：先把"被蛇占住的格子"列成一张表，再把所有空着的格子收集起来，
 * 最后从空格子数组里随机挑一个。
 * 为什么不直接"随便随机一个坐标，撞到蛇就重来"：蛇很长的时候，
 * 随机命中空格的概率很低，可能要试几十次；更糟的是棋盘几乎被填满时，
 * 那种写法可能永远试不中（死循环）。先列空格就没有这个问题。
 *
 * 返回新食物的坐标；如果棋盘被蛇填满（没有空格了）则返回 null。
 */
function spawnFood() {
  const occupied = new Set(state.snake.map(function (seg) {
    return seg.x + ',' + seg.y;
  }));

  const freeCells = [];
  for (let y = 0; y < CONFIG.rows; y++) {
    for (let x = 0; x < CONFIG.cols; x++) {
      if (!occupied.has(x + ',' + y)) freeCells.push({ x: x, y: y });
    }
  }

  if (freeCells.length === 0) {
    state.food = null;                // 蛇填满了整个棋盘，理论上到不了这里
    return null;
  }

  state.food = freeCells[Math.floor(Math.random() * freeCells.length)];
  return state.food;
}

/** 每移动一格调用一次：算出蛇的下一步 */
function update() {
  if (state.snake.length === 0) return;

  // 0) 先把玩家排队的方向用上 —— 方向只在"移动的那一刻"才真正改变
  if (state.pendingDirection) {
    const turned =
      state.pendingDirection.x !== state.direction.x ||
      state.pendingDirection.y !== state.direction.y;

    state.direction = state.pendingDirection;
    state.pendingDirection = null;

    if (turned && state.status === 'running') {
      setStatus('运行中 —— 正在' + directionName(state.direction) + '移动（方向键 / WASD 转向，空格暂停）');
    }
  }

  const head = state.snake[0];

  // 1) 按当前方向算出新蛇头的位置
  const nextHead = {
    x: head.x + state.direction.x,
    y: head.y + state.direction.y
  };

  // 2) 新蛇头这一格上是不是正好有食物？
  const ate =
    state.food !== null &&
    nextHead.x === state.food.x &&
    nextHead.y === state.food.y;

  // 3) 撞墙：新蛇头跑出了棋盘边界
  const hitWall =
    nextHead.x < 0 || nextHead.x >= CONFIG.cols ||
    nextHead.y < 0 || nextHead.y >= CONFIG.rows;

  // 4) 撞自己：新蛇头落在身体的某一节上
  //    尾巴那一格要特殊处理 —— 这一步如果没吃到食物，尾巴会同时让开，
  //    所以"头压到尾巴的位置"其实不会相撞，判断时要把尾巴排除掉。
  //    不排除的话，蛇贴着尾巴转弯会被误判成死亡。
  const body = ate ? state.snake : state.snake.slice(0, -1);
  const hitSelf = body.some(function (seg) {
    return seg.x === nextHead.x && seg.y === nextHead.y;
  });

  // 撞了就结束，这一步不再移动（保持"最后一刻"的样子）
  if (hitWall || hitSelf) {
    gameOver(hitWall ? '撞到墙了' : '咬到自己了');
    return;
  }

  // 5) 头进：把新蛇头插到数组最前面
  state.snake.unshift(nextHead);

  // 6) 尾出：没吃到就删掉最后一节，长度不变（"蛇在爬"就是这么来的）；
  //    吃到了就不删 —— 少删一节等于蛇长了一格
  if (ate) {
    state.score += CONFIG.scorePerFood;
    spawnFood();   // 立刻补一个新食物（新蛇头已经在蛇身数组里了，不会被选中）

    if (state.status === 'running') {
      setStatus('吃到食物 +' + CONFIG.scorePerFood + ' 分，当前 ' + state.score + ' 分 —— 蛇长了一格');
    }
  } else {
    state.snake.pop();
  }
}

/** 把一条格子坐标画成一个方块（留 1px 内边距，三节之间就会看出分界） */
function drawCell(cell, color) {
  const inset = 1;
  const size = CONFIG.cellSize - inset * 2;

  ctx.fillStyle = color;
  ctx.fillRect(toPixel(cell.x) + inset, toPixel(cell.y) + inset, size, size);
}

/** 画蛇：蛇头一个颜色，身体另一个颜色 */
function drawSnake() {
  state.snake.forEach(function (segment, index) {
    const color = index === 0 ? CONFIG.colors.snakeHead : CONFIG.colors.snakeBody;
    drawCell(segment, color);
  });
}

/** 画食物：画成圆形，和方形的蛇一眼就能分开 */
function drawFood() {
  if (state.food === null) return;

  const radius = CONFIG.cellSize / 2 - 3;
  const centerX = toPixel(state.food.x) + CONFIG.cellSize / 2;
  const centerY = toPixel(state.food.y) + CONFIG.cellSize / 2;

  ctx.fillStyle = CONFIG.colors.food;   // 先定颜色再画，避免"用上一次的颜色画这一笔"
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();
}

/** 把当前状态画到画布上 */
function draw() {
  drawBoard();

  drawFood();
  drawSnake();

  // 说明：游戏结束的提示不画在画布上，而是用 HTML 的提示层（overlay）盖在棋盘上方 ——
  // 文字更清晰，还能整块点击重开。

  // 让分数面板跟着状态走
  scoreEl.textContent = String(state.score);
  bestEl.textContent = String(state.best);
}

/** 主循环：把 update 和 draw 按固定节奏串起来 */
function loop(timestamp) {
  // 暂停 / 结束时就停下来，不再申请下一帧
  if (state.status !== 'running') return;

  if (!state.lastTime) state.lastTime = timestamp;

  // 距离上一帧过去了多少毫秒
  const delta = timestamp - state.lastTime;
  state.lastTime = timestamp;

  // 走一格需要多少毫秒：速度 8 格/秒 → 每格 125 毫秒
  const interval = 1000 / CONFIG.speed;
  state.accumulator += delta;

  // 攒够一格的时间就移动一次（用 while 是为了防止掉帧时漏掉步数）
  while (state.accumulator >= interval && state.status === 'running') {
    state.accumulator -= interval;
    update();
  }

  draw();

  requestAnimationFrame(loop);
}

/* --------------------------------------------------------------------------
 * 6. 状态切换：开始 / 暂停 / 结束
 * ------------------------------------------------------------------------ */

function startGame() {
  // 正在跑就不用重复启动（否则会出现两个循环赛跑，蛇会越来越快）
  if (state.status === 'running') return;

  // 已经结束的话，先复位再开始
  if (state.status === 'over') resetGame();

  state.status = 'running';
  state.lastTime = 0;      // 从 0 开始计时，避免把"暂停期间"的时间也算进去
  state.accumulator = 0;

  hideOverlay();
  setStatus('运行中 —— 正在' + directionName(state.direction) + '移动（方向键 / WASD 转向，空格暂停）');

  requestAnimationFrame(loop);
}

/** 空格键：运行中 → 暂停；暂停中 → 继续 */
function togglePause() {
  if (state.status === 'running') {
    state.status = 'paused';
    setStatus('已暂停 —— 再按空格继续');
    return;
  }

  if (state.status === 'paused') {
    state.status = 'running';
    state.lastTime = 0;
    state.accumulator = 0;
    setStatus('运行中 —— 正在' + directionName(state.direction) + '移动（方向键 / WASD 转向，空格暂停）');
    requestAnimationFrame(loop);
  }
}

/**
 * 游戏结束：冻结状态、把结果显示出来。
 * 只要把 status 改成 'over'，主循环下一次被调用时就会直接退出，蛇自然停住。
 */
function gameOver(reason) {
  if (state.status === 'over') return;   // 同一局只处理一次，避免重复弹提示

  state.status = 'over';
  state.pendingDirection = null;         // 丢掉还没生效的按键，免得下次开局方向怪怪的

  draw();                                // 先把"最后一刻"的画面画好，再盖上提示层

  showOverlay('游戏结束', '最终分数 ' + state.score + ' 分\n点击任意位置再来一局');
  setStatus('游戏结束 —— ' + reason + '。最终分数 ' + state.score + ' 分，点击「重新开始」再来一局');
}

/** 在棋盘下方显示一行状态文字，给用户即时反馈 */
function setStatus(text) {
  statusEl.textContent = text;
}

/** 显示中间的提示层：一行大字标题 + 一行小字说明 */
function showOverlay(title, text) {
  overlayTitleEl.textContent = title;
  overlayTextEl.textContent = text;
  overlayEl.hidden = false;
}

function hideOverlay() {
  overlayEl.hidden = true;
}

/* --------------------------------------------------------------------------
 * 7. 事件绑定
 * ------------------------------------------------------------------------ */

/** 按键 → 方向 的对照表：方向键和 WASD 走同一张表，行为自然一致 */
const KEY_DIRECTIONS = {
  arrowup:    { x: 0, y: -1 },
  w:          { x: 0, y: -1 },
  arrowdown:  { x: 0, y: 1 },
  s:          { x: 0, y: 1 },
  arrowleft:  { x: -1, y: 0 },
  a:          { x: -1, y: 0 },
  arrowright: { x: 1, y: 0 },
  d:          { x: 1, y: 0 }
};

/** 把方向翻译成中文，用于状态提示 */
function directionName(dir) {
  if (dir.y === -1) return '向上';
  if (dir.y === 1) return '向下';
  if (dir.x === -1) return '向左';
  if (dir.x === 1) return '向右';
  return '';
}

/**
 * 记录玩家想转的方向（不是立刻转），并挡掉"原地掉头"。
 * 为什么要排队而不是直接改 state.direction：
 *   蛇每 125 毫秒才走一格，而这期间可能按下好几个键。
 *   如果按键就直接改方向，会出现这种情况：
 *   向右移动时先按「上」再按「左」——两次都与"当时的"方向不冲突，
 *   于是方向变成向左，蛇一步之内直接掉头撞上自己。
 *   改成"以蛇真正在走的方向为基准判断反向、方向到了下一格才生效"就不会了。
 */
function queueDirection(next) {
  if (state.status === 'over') return;   // 已经结束了，方向键不再响应

  if (next.x === -state.direction.x && next.y === -state.direction.y) {
    if (state.status === 'running' || state.status === 'paused') {
      setStatus('不能直接掉头 —— 正在' + directionName(state.direction) + '移动，只能转 90 度');
    }
    return;
  }

  state.pendingDirection = next;

  // 还没开始跑的时候按键，顺手告诉玩家方向已经记住了
  if (state.status === 'idle') {
    setStatus('方向已设为' + directionName(next) + ' —— 点击「开始游戏」出发');
  }
}

/** 键盘总入口：空格 = 开始 / 暂停，方向键与 WASD = 转向 */
function handleKey(event) {
  const key = event.key.toLowerCase();

  if (key === ' ' || key === 'spacebar') {
    event.preventDefault();
    state.status === 'running' ? togglePause() : startGame();
    return;
  }

  const next = KEY_DIRECTIONS[key];
  if (!next) return;               // 其它按键一律不理会

  event.preventDefault();          // 否则方向键会把整个网页上下左右滚动
  queueDirection(next);
}

/** 按钮点完就取消焦点：否则鼠标点过按钮后，按空格会"再点一次"那个按钮 */
function bindClick(el, handler) {
  el.addEventListener('click', function () {
    el.blur();
    handler();
  });
}

function bindEvents() {
  document.addEventListener('keydown', handleKey);
  bindClick(startBtn, startGame);
  bindClick(overlayEl, startGame);
  bindClick(restartBtn, resetGame);
}

/* --------------------------------------------------------------------------
 * 8. 启动
 * ------------------------------------------------------------------------ */
function init() {
  initCanvas();
  bindEvents();
  resetGame();          // 摆好 3 格长的蛇，并把棋盘和蛇画出来
  hideOverlay();
  setStatus('界面已就绪，点击「开始游戏」');
}

init();
