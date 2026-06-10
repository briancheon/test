(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  const scoreEl = document.getElementById('score');
  const livesEl = document.getElementById('lives');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayMsg = document.getElementById('overlay-msg');
  const startBtn = document.getElementById('start-btn');

  // ---- config ----
  const PADDLE_W = 120;
  const PADDLE_H = 14;
  const BALL_R = 8;
  const BALL_SPEED = 6.2;
  const BRICK_ROWS = 6;
  const BRICK_COLS = 10;
  const BRICK_GAP = 6;
  const BRICK_TOP = 60;
  const BRICK_H = 24;
  const BRICK_W = (W - BRICK_GAP * (BRICK_COLS + 1)) / BRICK_COLS;

  const ROW_COLORS = [
    ['#ff2965', '#ff5e3a'],
    ['#ff9a00', '#ffc400'],
    ['#aaff00', '#33ff77'],
    ['#00ffd5', '#00c2ff'],
    ['#3a7bff', '#7b2ff7'],
    ['#b537f2', '#ff00e0'],
  ];

  // ---- state ----
  let paddle, ball, bricks, particles, trail;
  let score, lives, combo, level;
  let running = false;
  let paused = false;
  let ballStuck = true;
  let shake = 0;
  let keys = { left: false, right: false };

  function resetBall() {
    ballStuck = true;
    ball = {
      x: paddle.x + PADDLE_W / 2,
      y: paddle.y - BALL_R - 2,
      vx: 0,
      vy: 0,
    };
    trail = [];
  }

  function buildBricks() {
    bricks = [];
    for (let r = 0; r < BRICK_ROWS; r++) {
      for (let c = 0; c < BRICK_COLS; c++) {
        bricks.push({
          x: BRICK_GAP + c * (BRICK_W + BRICK_GAP),
          y: BRICK_TOP + r * (BRICK_H + BRICK_GAP),
          row: r,
          alive: true,
          // top rows are worth more and need two hits on later levels
          hp: level > 1 && r < 2 ? 2 : 1,
          points: (BRICK_ROWS - r) * 10,
        });
      }
    }
  }

  function newGame() {
    score = 0;
    lives = 3;
    level = 1;
    startLevel();
    updateHud();
  }

  function startLevel() {
    paddle = { x: W / 2 - PADDLE_W / 2, y: H - 40 };
    particles = [];
    combo = 0;
    buildBricks();
    resetBall();
  }

  function launchBall() {
    if (!ballStuck) return;
    ballStuck = false;
    const angle = -Math.PI / 2 + (Math.random() * 0.5 - 0.25);
    const speed = BALL_SPEED + (level - 1) * 0.6;
    ball.vx = Math.cos(angle) * speed;
    ball.vy = Math.sin(angle) * speed;
  }

  function updateHud() {
    scoreEl.textContent = score;
    livesEl.textContent = '♥'.repeat(lives) || '—';
  }

  // ---- particles ----
  function burst(x, y, colors, count = 18, power = 5) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * power + 1;
      particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 1,
        life: 1,
        decay: Math.random() * 0.03 + 0.015,
        size: Math.random() * 3 + 1.5,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }

  // ---- update ----
  function update() {
    // paddle
    const pSpeed = 9;
    if (keys.left) paddle.x -= pSpeed;
    if (keys.right) paddle.x += pSpeed;
    paddle.x = Math.max(0, Math.min(W - PADDLE_W, paddle.x));

    if (ballStuck) {
      ball.x = paddle.x + PADDLE_W / 2;
      ball.y = paddle.y - BALL_R - 2;
      return;
    }

    ball.x += ball.vx;
    ball.y += ball.vy;

    trail.push({ x: ball.x, y: ball.y });
    if (trail.length > 14) trail.shift();

    // walls
    if (ball.x < BALL_R) { ball.x = BALL_R; ball.vx *= -1; }
    if (ball.x > W - BALL_R) { ball.x = W - BALL_R; ball.vx *= -1; }
    if (ball.y < BALL_R) { ball.y = BALL_R; ball.vy *= -1; }

    // paddle hit — reflect angle based on where the ball lands
    if (
      ball.vy > 0 &&
      ball.y + BALL_R >= paddle.y &&
      ball.y + BALL_R <= paddle.y + PADDLE_H + Math.abs(ball.vy) &&
      ball.x >= paddle.x - BALL_R &&
      ball.x <= paddle.x + PADDLE_W + BALL_R
    ) {
      const hit = (ball.x - (paddle.x + PADDLE_W / 2)) / (PADDLE_W / 2);
      const angle = hit * (Math.PI / 3) - Math.PI / 2; // max 60° deflection
      const speed = Math.hypot(ball.vx, ball.vy);
      ball.vx = Math.cos(angle) * speed;
      ball.vy = Math.sin(angle) * speed;
      ball.y = paddle.y - BALL_R;
      combo = 0;
      burst(ball.x, paddle.y, ['#00f0ff', '#ffffff'], 8, 3);
    }

    // bottom — lose a life
    if (ball.y > H + BALL_R) {
      lives--;
      updateHud();
      shake = 14;
      if (lives <= 0) {
        gameOver(false);
      } else {
        resetBall();
      }
      return;
    }

    // bricks
    for (const b of bricks) {
      if (!b.alive) continue;
      if (
        ball.x + BALL_R > b.x && ball.x - BALL_R < b.x + BRICK_W &&
        ball.y + BALL_R > b.y && ball.y - BALL_R < b.y + BRICK_H
      ) {
        // pick bounce axis by smallest overlap
        const overlapX = Math.min(ball.x + BALL_R - b.x, b.x + BRICK_W - (ball.x - BALL_R));
        const overlapY = Math.min(ball.y + BALL_R - b.y, b.y + BRICK_H - (ball.y - BALL_R));
        if (overlapX < overlapY) ball.vx *= -1;
        else ball.vy *= -1;

        b.hp--;
        if (b.hp <= 0) {
          b.alive = false;
          combo++;
          score += b.points * combo;
          shake = Math.min(shake + 4, 10);
          burst(b.x + BRICK_W / 2, b.y + BRICK_H / 2, ROW_COLORS[b.row]);
          updateHud();
        } else {
          burst(b.x + BRICK_W / 2, b.y + BRICK_H / 2, ROW_COLORS[b.row], 6, 2.5);
        }
        break;
      }
    }

    if (bricks.every(b => !b.alive)) {
      level++;
      score += 500;
      updateHud();
      startLevel();
      showOverlay(`LEVEL ${level}`, 'Bricks up top take two hits now.<br>Press SPACE or click to launch', 'GO');
      running = false;
    }

    // particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12;
      p.life -= p.decay;
      if (p.life <= 0) particles.splice(i, 1);
    }

    if (shake > 0) shake *= 0.85;
  }

  // ---- draw ----
  function draw() {
    ctx.save();
    if (shake > 0.5) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }
    ctx.clearRect(-20, -20, W + 40, H + 40);

    // bricks
    for (const b of bricks) {
      if (!b.alive) continue;
      const [c1, c2] = ROW_COLORS[b.row];
      const g = ctx.createLinearGradient(b.x, b.y, b.x, b.y + BRICK_H);
      g.addColorStop(0, c1);
      g.addColorStop(1, c2);
      ctx.fillStyle = g;
      ctx.shadowColor = c1;
      ctx.shadowBlur = b.hp > 1 ? 4 : 12;
      ctx.globalAlpha = b.hp > 1 ? 0.55 : 1;
      roundRect(b.x, b.y, BRICK_W, BRICK_H, 5);
      ctx.fill();
      ctx.globalAlpha = 1;
      // glass highlight
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      roundRect(b.x + 2, b.y + 2, BRICK_W - 4, BRICK_H / 2.6, 4);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // ball trail
    for (let i = 0; i < trail.length; i++) {
      const t = trail[i];
      const f = i / trail.length;
      ctx.globalAlpha = f * 0.35;
      ctx.fillStyle = '#00f0ff';
      ctx.beginPath();
      ctx.arc(t.x, t.y, BALL_R * f, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ball
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 18;
    const bg = ctx.createRadialGradient(ball.x - 3, ball.y - 3, 1, ball.x, ball.y, BALL_R);
    bg.addColorStop(0, '#ffffff');
    bg.addColorStop(1, '#00d5ff');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // paddle
    const pg = ctx.createLinearGradient(paddle.x, 0, paddle.x + PADDLE_W, 0);
    pg.addColorStop(0, '#00f0ff');
    pg.addColorStop(0.5, '#7b2ff7');
    pg.addColorStop(1, '#ff00e0');
    ctx.fillStyle = pg;
    ctx.shadowColor = '#7b2ff7';
    ctx.shadowBlur = 16;
    roundRect(paddle.x, paddle.y, PADDLE_W, PADDLE_H, 7);
    ctx.fill();
    ctx.shadowBlur = 0;

    // particles
    for (const p of particles) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // combo indicator
    if (combo > 1) {
      ctx.font = '700 16px Orbitron, sans-serif';
      ctx.fillStyle = '#ffc400';
      ctx.shadowColor = '#ffc400';
      ctx.shadowBlur = 10;
      ctx.textAlign = 'center';
      ctx.fillText(`COMBO x${combo}`, W / 2, H - 12);
      ctx.shadowBlur = 0;
    }

    if (paused) {
      ctx.font = '900 36px Orbitron, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', W / 2, H / 2);
    }

    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---- loop ----
  function loop() {
    if (running && !paused) update();
    draw();
    requestAnimationFrame(loop);
  }

  function showOverlay(title, msg, btn) {
    overlayTitle.textContent = title;
    overlayMsg.innerHTML = msg;
    startBtn.textContent = btn;
    overlay.classList.remove('hidden');
  }

  function gameOver(won) {
    running = false;
    showOverlay(
      won ? 'YOU WIN!' : 'GAME OVER',
      `Final score: <b style="color:#00f0ff">${score}</b>`,
      'PLAY AGAIN'
    );
    overlay.dataset.restart = '1';
  }

  // ---- input ----
  startBtn.addEventListener('click', () => {
    if (overlay.dataset.restart) {
      delete overlay.dataset.restart;
      newGame();
    }
    overlay.classList.add('hidden');
    running = true;
    paused = false;
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (W / rect.width);
    paddle.x = Math.max(0, Math.min(W - PADDLE_W, x - PADDLE_W / 2));
  });

  canvas.addEventListener('click', () => {
    if (running && !paused) launchBall();
  });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowLeft') keys.left = true;
    if (e.code === 'ArrowRight') keys.right = true;
    if (e.code === 'Space') {
      e.preventDefault();
      if (!running && !overlay.classList.contains('hidden')) {
        startBtn.click();
      } else if (running && !paused) {
        launchBall();
      }
    }
    if (e.code === 'KeyP' && running) paused = !paused;
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft') keys.left = false;
    if (e.code === 'ArrowRight') keys.right = false;
  });

  newGame();
  loop();
})();
