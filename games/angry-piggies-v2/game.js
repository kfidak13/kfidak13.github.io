(function () {
  'use strict';

  const { Engine, Render, Runner, Bodies, Body, Composite, Constraint, Mouse, MouseConstraint, Events, Vector } = Matter;

  const WIDTH = window.innerWidth;
  const HEIGHT = window.innerHeight;
  const GROUND_Y = HEIGHT - 40;
  const SLING_X = 180;
  const SLING_Y = GROUND_Y - 140;
  const SLING_POINT = { x: SLING_X, y: SLING_Y };
  const TOTAL_PIGS = 3;

  const STEP_MS = 1000 / 60;

  // --- Tuning ---
  const PULL_LIMIT = 160;             // max drag distance from the sling point
  const MIN_PULL = 15;                // shorter drags just snap back
  const ELASTIC_STIFFNESS = 0.10;
  const ELASTIC_DAMPING = 0.02;
  const DRAG_STIFFNESS = 0.01;        // softened while dragging so the mouse reaches the pull limit
  const ELASTIC_DETACH_MS = 500;      // safety release if the crossing check is missed
  const LAUNCH_SPEED_PER_PULL = 0.26; // measured launch speed (px/step) per px of pull
  const AIM_PREVIEW_MS = 700;         // only the first part of the flight is previewed
  const BLOCK_BREAK_IMPACT = 120;
  const BIRD_KO_IMPACT = 5;
  const SETTLE_GRACE_MS = 1000;
  const PIG_REST_SPEED = 0.3;
  const PIG_REST_MS = 1000;
  const SHOT_TIMEOUT_MS = 7000;
  const OFFSCREEN_MARGIN = 100;
  const PIG_CATEGORY = 0x0008;

  const PIG_RADIUS = 22;
  const BIRD_RADIUS = 16;

  const engine = Engine.create();
  const world = engine.world;

  const render = Render.create({
    element: document.body,
    engine: engine,
    options: {
      width: WIDTH,
      height: HEIGHT,
      wireframes: false,
      background: 'transparent'
    }
  });
  Render.run(render);
  Runner.run(Runner.create(), engine);

  // --- Static scenery ---
  const ground = Bodies.rectangle(WIDTH / 2, GROUND_Y + 40, WIDTH * 2, 80, {
    isStatic: true,
    label: 'ground',
    render: { visible: false }
  });

  const slingPole = Bodies.rectangle(SLING_X, SLING_Y + 70, 14, 140, {
    isStatic: true,
    isSensor: true,
    render: { visible: false }
  });

  Composite.add(world, [ground, slingPole]);

  // Fork prongs at the top of the pole, purely visual anchor points for the bands
  const PRONG_LEFT = { x: SLING_X - 22, y: SLING_Y - 14 };
  const PRONG_RIGHT = { x: SLING_X + 22, y: SLING_Y - 18 };

  // --- Pig (projectile) ---
  let pig = null;
  let sling = null;
  let pigsLeft = TOTAL_PIGS;
  let launched = false;
  let slingAttached = false;
  let shotSettled = false;
  let releaseDir = null;
  let releaseAt = 0;
  let shotStartAt = 0;
  let restSince = null;
  let pigSpin = 0;

  function createPig() {
    pig = Bodies.circle(SLING_X, SLING_Y, PIG_RADIUS, {
      label: 'pig',
      density: 0.006,
      restitution: 0.4,
      friction: 0.6,
      collisionFilter: { category: PIG_CATEGORY },
      render: { visible: false }
    });
    sling = Constraint.create({
      pointA: { x: SLING_X, y: SLING_Y },
      bodyB: pig,
      stiffness: ELASTIC_STIFFNESS,
      damping: ELASTIC_DAMPING,
      length: 1,
      render: { visible: false }
    });
    launched = false;
    slingAttached = true;
    shotSettled = false;
    restSince = null;
    releaseDir = null;
    pigSpin = 0;
    Composite.add(world, [pig, sling]);
  }

  function detachSling() {
    slingAttached = false;
    if (sling) {
      Composite.remove(world, sling);
      sling = null;
    }
  }

  // --- Structure with breaking physics ---
  const blocks = [];
  function addBlock(x, y, w, h, material) {
    const block = Bodies.rectangle(x, y, w, h, {
      label: 'block',
      density: 0.005,
      friction: 0.8,
      restitution: 0.1,
      render: { visible: false }
    });
    block.hitPoints = 2;
    block.material = material;
    block.w = w;
    block.h = h;
    block.cracks = null;
    blocks.push(block);
    Composite.add(world, block);
    return block;
  }

  // --- Birds (targets) ---
  const birds = [];
  const BIRD_SKINS = [
    { body: '#e03a2f', dark: '#8f1c14', belly: '#f6d7b8', brow: '#5a0f0a' },
    { body: '#f7c23b', dark: '#a8700e', belly: '#fff2c2', brow: '#6b4506' },
    { body: '#4f9ce0', dark: '#1f4f8a', belly: '#dff0ff', brow: '#163a66' }
  ];
  function addBird(x, y, colorIndex) {
    const bird = Bodies.circle(x, y, BIRD_RADIUS, {
      label: 'bird',
      density: 0.001,
      restitution: 0.3,
      friction: 0.5,
      render: { visible: false }
    });
    bird.alive = true;
    bird.skin = colorIndex % BIRD_SKINS.length;
    birds.push(bird);
    Composite.add(world, bird);
    return bird;
  }

  function buildLevel() {
    const bx = WIDTH - 320;

    // Two towers with a bridge
    addBlock(bx - 80, GROUND_Y - 60, 20, 120, 'wood');   // left pillar
    addBlock(bx + 80, GROUND_Y - 60, 20, 120, 'wood');   // right pillar
    addBlock(bx, GROUND_Y - 130, 220, 20, 'stone');      // bridge

    addBlock(bx - 50, GROUND_Y - 190, 20, 100, 'wood');  // upper left pillar
    addBlock(bx + 50, GROUND_Y - 190, 20, 100, 'wood');  // upper right pillar
    addBlock(bx, GROUND_Y - 250, 160, 20, 'stone');      // roof

    addBird(bx - 40, GROUND_Y - 16, 0);          // ground birds (between the pillars)
    addBird(bx + 40, GROUND_Y - 16, 0);
    addBird(bx, GROUND_Y - 156, 1);              // bridge bird
    addBird(bx, GROUND_Y - 276, 2);              // roof bird
  }

  buildLevel();
  const levelBuiltAt = engine.timing.timestamp;
  createPig();

  // --- Mouse / slingshot control ---
  const mouse = Mouse.create(render.canvas);
  const mouseConstraint = MouseConstraint.create(engine, {
    mouse: mouse,
    constraint: { stiffness: 0.1, render: { visible: false } }
  });
  mouseConstraint.collisionFilter.mask = PIG_CATEGORY;
  render.mouse = mouse;
  Composite.add(world, mouseConstraint);

  Events.on(mouseConstraint, 'startdrag', (e) => {
    if (e.body !== pig || launched) {
      mouseConstraint.constraint.bodyB = null;
      mouseConstraint.body = null;
      return;
    }
    sling.stiffness = DRAG_STIFFNESS;
  });

  Events.on(mouseConstraint, 'enddrag', (e) => {
    if (e.body === pig && !launched) {
      sling.stiffness = ELASTIC_STIFFNESS;
      const pullVec = Vector.sub(pig.position, SLING_POINT);
      if (Vector.magnitude(pullVec) > MIN_PULL) {
        launched = true;
        pigsLeft--;
        releaseDir = Vector.normalise(pullVec);
        releaseAt = engine.timing.timestamp;
        shotStartAt = engine.timing.timestamp;
      }
    }
  });

  function clampPull() {
    if (pig && !launched && mouseConstraint.body === pig) {
      const offset = Vector.sub(pig.position, SLING_POINT);
      const dist = Vector.magnitude(offset);
      if (dist > PULL_LIMIT) {
        const clamped = Vector.add(SLING_POINT, Vector.mult(offset, PULL_LIMIT / dist));
        Body.setPosition(pig, clamped);
        Body.setVelocity(pig, { x: 0, y: 0 });
      }
    }
  }

  Events.on(engine, 'beforeUpdate', () => {
    const now = engine.timing.timestamp;

    // The mouse may only ever hold the loaded, un-launched pig
    if (mouseConstraint.body && (mouseConstraint.body !== pig || launched)) {
      mouseConstraint.constraint.bodyB = null;
      mouseConstraint.body = null;
    }

    clampPull();

    // Release the elastic the frame the pig crosses back through the rest point
    if (pig && launched && slingAttached) {
      const travel = Vector.sub(pig.position, SLING_POINT);
      if (Vector.dot(travel, releaseDir) <= 0 || now - releaseAt > ELASTIC_DETACH_MS) {
        detachSling();
      }
    }

    // Shot bookkeeping: next pig once this one rests, leaves the screen, or times out
    if (pig && launched && !slingAttached && !shotSettled && !gameOver) {
      const offScreen = pig.position.x > WIDTH + OFFSCREEN_MARGIN
        || pig.position.x < -OFFSCREEN_MARGIN
        || pig.position.y > HEIGHT + OFFSCREEN_MARGIN;
      if (Vector.magnitude(pig.velocity) < PIG_REST_SPEED) {
        if (restSince === null) restSince = now;
      } else {
        restSince = null;
      }
      if (offScreen || (restSince !== null && now - restSince > PIG_REST_MS) || now - shotStartAt > SHOT_TIMEOUT_MS) {
        shotSettled = true;
        Composite.remove(world, pig);
        pig = null;
        if (pigsLeft > 0) {
          createPig();
        } else {
          checkLose();
        }
      }
    }
  });

  // The mouse constraint re-pulls during the update, so clamp again afterwards
  Events.on(engine, 'afterUpdate', clampPull);

  // --- Collisions: break blocks, knock out birds ---
  Events.on(engine, 'collisionStart', (event) => {
    if (engine.timing.timestamp - levelBuiltAt < SETTLE_GRACE_MS) return;
    for (const pair of event.pairs) {
      if (pair.isSensor) continue;
      const { bodyA, bodyB } = pair;

      for (const [body, other] of [[bodyA, bodyB], [bodyB, bodyA]]) {
        const relSpeed = Vector.magnitude(Vector.sub(body.velocity, other.velocity));
        const m = other.isStatic ? body.mass : other.mass;
        const impact = relSpeed * m;

        if (body.label === 'block') {
          if (impact > BLOCK_BREAK_IMPACT) {
            body.hitPoints--;
            if (body.hitPoints === 1) {
              body.cracks = makeCracks(body);
              spawnBlockDust(body, false);
            }
            if (body.hitPoints <= 0) {
              spawnBlockDust(body, true);
              Composite.remove(world, body);
            }
          }
        } else if (body.label === 'bird' && body.alive) {
          if (impact > BIRD_KO_IMPACT) knockOutBird(body);
        }
      }
    }
  });

  function knockOutBird(bird) {
    bird.alive = false;
    spawnBirdPoof(bird);
    setTimeout(() => Composite.remove(world, bird), 1200);
    checkWin();
  }

  // --- Win / lose ---
  let gameOver = false;
  const messageEl = document.getElementById('message');
  const hudEl = document.getElementById('hud');

  function showEndCard(title, subtitle, cls) {
    messageEl.innerHTML = `<div class="card ${cls}"><h1>${title}</h1><p>${subtitle}</p></div>`;
    messageEl.style.display = 'flex';
  }

  function checkWin() {
    if (birds.every((b) => !b.alive)) {
      gameOver = true;
      const spare = pigsLeft === 1 ? '1 pig to spare' : `${pigsLeft} pigs to spare`;
      showEndCard('YOU WIN!', pigsLeft > 0 ? `All ${birds.length} birds knocked out with ${spare}.` : `All ${birds.length} birds knocked out.`, 'win');
    }
  }

  function checkLose() {
    if (!gameOver && pigsLeft <= 0) {
      setTimeout(() => {
        if (!gameOver) {
          gameOver = true;
          const left = birds.filter((b) => b.alive).length;
          showEndCard('GAME OVER', `${left} ${left === 1 ? 'bird is' : 'birds are'} still standing. Refresh to try again.`, 'lose');
        }
      }, 2000);
    }
  }

  // --- Aim preview ---
  function predictedPath() {
    const pullVec = Vector.sub(pig.position, SLING_POINT);
    const vel = Vector.mult(pullVec, -LAUNCH_SPEED_PER_PULL);
    const pos = { x: SLING_POINT.x, y: SLING_POINT.y };
    const gravityStep = engine.gravity.y * engine.gravity.scale * STEP_MS * STEP_MS;
    const drag = 1 - pig.frictionAir;
    const pts = [];
    const steps = Math.round(AIM_PREVIEW_MS / STEP_MS);
    for (let i = 0; i < steps; i++) {
      vel.x *= drag;
      vel.y = vel.y * drag + gravityStep;
      pos.x += vel.x;
      pos.y += vel.y;
      if (i % 3 === 2) pts.push({ x: pos.x, y: pos.y });
    }
    return pts;
  }

  // =====================================================================
  //  Visuals
  // =====================================================================

  function seededRandom(seed) {
    let t = seed >>> 0;
    return function () {
      t = (t + 0x6D2B79F5) >>> 0;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  }

  // --- Background scenery (generated once) ---
  const scenery = (() => {
    const rand = seededRandom(1337);
    const clouds = [];
    for (let i = 0; i < 9; i++) {
      const far = i % 2 === 0;
      clouds.push({
        x: rand() * (WIDTH + 400) - 200,
        y: 40 + rand() * 200,
        scale: far ? 0.55 + rand() * 0.3 : 0.9 + rand() * 0.45,
        speed: far ? 5 + rand() * 4 : 10 + rand() * 7,
        alpha: far ? 0.7 : 0.95,
        parallax: far ? 30 : 60,
        far
      });
    }
    const hills = (count, rMin, rMax, lift) => {
      const bumps = [];
      let x = -300;
      while (x < WIDTH + 300) {
        const r = rMin + rand() * (rMax - rMin);
        bumps.push({ x, r, lift });
        x += r * (0.9 + rand() * 0.5);
      }
      return bumps;
    };
    const tufts = [];
    for (let x = -100; x < WIDTH + 100; x += 34 + rand() * 30) tufts.push({ x, h: 7 + rand() * 6, lean: rand() * 4 - 2 });
    const pebbles = [];
    for (let i = 0; i < 24; i++) pebbles.push({ x: rand() * WIDTH, y: GROUND_Y + 16 + rand() * 20, r: 2 + rand() * 3 });
    return {
      clouds,
      farHills: hills(0, 110, 190, 0.78),
      nearHills: hills(0, 60, 120, 0.72),
      tufts,
      pebbles,
      sun: { x: WIDTH * 0.72, y: 105, r: 46 }
    };
  })();

  let camShift = 0;

  function drawSky(ctx) {
    const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    sky.addColorStop(0, '#3f9fe0');
    sky.addColorStop(0.55, '#8fd0f3');
    sky.addColorStop(1, '#d9f1fb');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const { sun } = scenery;
    const sx = sun.x - camShift * 12;
    const glow = ctx.createRadialGradient(sx, sun.y, sun.r * 0.6, sx, sun.y, sun.r * 3.2);
    glow.addColorStop(0, 'rgba(255, 244, 180, 0.55)');
    glow.addColorStop(1, 'rgba(255, 244, 180, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sx - sun.r * 3.2, sun.y - sun.r * 3.2, sun.r * 6.4, sun.r * 6.4);
    ctx.fillStyle = '#fff1a8';
    ctx.beginPath();
    ctx.arc(sx, sun.y, sun.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff8d6';
    ctx.beginPath();
    ctx.arc(sx - 10, sun.y - 10, sun.r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCloud(ctx, cx, cy, s, alpha) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.globalAlpha = alpha;
    const puffs = [[0, 0, 26], [-28, 8, 18], [28, 8, 20], [-6, -14, 18], [14, -8, 16]];
    ctx.fillStyle = '#cfe6f6';
    ctx.beginPath();
    for (const [x, y, r] of puffs) { ctx.moveTo(x + r, y + 5); ctx.arc(x, y + 5, r, 0, Math.PI * 2); }
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    for (const [x, y, r] of puffs) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2); }
    ctx.fill();
    ctx.restore();
  }

  function drawClouds(ctx, dt, far) {
    for (const c of scenery.clouds) {
      if (c.far !== far) continue;
      c.x += c.speed * dt;
      if (c.x > WIDTH + 220) c.x = -220;
      drawCloud(ctx, c.x - camShift * c.parallax, c.y, c.scale, c.alpha);
    }
  }

  function drawHills(ctx, bumps, color, shade, parallax) {
    const shift = -camShift * parallax;
    ctx.fillStyle = color;
    ctx.beginPath();
    for (const b of bumps) {
      const cx = b.x + shift;
      const cy = GROUND_Y + b.r * (1 - b.lift);
      ctx.moveTo(cx + b.r, cy);
      ctx.arc(cx, cy, b.r, 0, Math.PI * 2);
    }
    ctx.rect(-50, GROUND_Y - 2, WIDTH + 100, 10);
    ctx.fill();
    ctx.fillStyle = shade;
    ctx.beginPath();
    for (const b of bumps) {
      const cx = b.x + shift;
      const cy = GROUND_Y + b.r * (1 - b.lift);
      ctx.moveTo(cx + b.r * 0.55, cy - b.r * 0.35);
      ctx.arc(cx + b.r * 0.1, cy - b.r * 0.35, b.r * 0.45, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  function drawGround(ctx) {
    const dirt = ctx.createLinearGradient(0, GROUND_Y, 0, HEIGHT);
    dirt.addColorStop(0, '#9a6433');
    dirt.addColorStop(1, '#6a4320');
    ctx.fillStyle = dirt;
    ctx.fillRect(0, GROUND_Y, WIDTH, HEIGHT - GROUND_Y);

    ctx.fillStyle = '#6a4320';
    for (const p of scenery.pebbles) {
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.r * 1.4, p.r, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#5fae2e';
    ctx.fillRect(0, GROUND_Y, WIDTH, 14);
    ctx.fillStyle = '#4b9224';
    ctx.fillRect(0, GROUND_Y + 11, WIDTH, 4);
    ctx.fillStyle = '#7bc943';
    ctx.fillRect(0, GROUND_Y, WIDTH, 3);

    ctx.fillStyle = '#5fae2e';
    for (const t of scenery.tufts) {
      ctx.beginPath();
      ctx.moveTo(t.x - 6, GROUND_Y + 1);
      ctx.lineTo(t.x - 3 + t.lean, GROUND_Y - t.h);
      ctx.lineTo(t.x - 1, GROUND_Y + 1);
      ctx.lineTo(t.x + 1 + t.lean, GROUND_Y - t.h * 1.3);
      ctx.lineTo(t.x + 3, GROUND_Y + 1);
      ctx.lineTo(t.x + 5 + t.lean, GROUND_Y - t.h * 0.8);
      ctx.lineTo(t.x + 7, GROUND_Y + 1);
      ctx.closePath();
      ctx.fill();
    }
  }

  // --- Slingshot ---
  function drawSlingshotWood(ctx) {
    const base = SLING_Y + 18;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#4a2d14';
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.moveTo(SLING_X, GROUND_Y + 4);
    ctx.lineTo(SLING_X, base);
    ctx.stroke();
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.moveTo(SLING_X, base);
    ctx.lineTo(PRONG_LEFT.x, PRONG_LEFT.y);
    ctx.moveTo(SLING_X, base);
    ctx.lineTo(PRONG_RIGHT.x, PRONG_RIGHT.y);
    ctx.stroke();

    ctx.strokeStyle = '#8a5a2b';
    ctx.lineWidth = 13;
    ctx.beginPath();
    ctx.moveTo(SLING_X, GROUND_Y + 4);
    ctx.lineTo(SLING_X, base);
    ctx.stroke();
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(SLING_X, base);
    ctx.lineTo(PRONG_LEFT.x, PRONG_LEFT.y);
    ctx.moveTo(SLING_X, base);
    ctx.lineTo(PRONG_RIGHT.x, PRONG_RIGHT.y);
    ctx.stroke();

    ctx.strokeStyle = '#a8743a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(SLING_X - 3, GROUND_Y);
    ctx.lineTo(SLING_X - 3, base + 10);
    ctx.stroke();
  }

  function bandAnchor(prong) {
    const dir = Vector.normalise(Vector.sub(prong, pig.position));
    return Vector.add(pig.position, Vector.mult(dir, PIG_RADIUS - 6));
  }

  function drawBand(ctx, prong) {
    const end = bandAnchor(prong);
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#3a2213';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(prong.x, prong.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.strokeStyle = '#6b4a2e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(prong.x, prong.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  }

  function drawPouch(ctx) {
    const pull = Vector.sub(pig.position, SLING_POINT);
    if (Vector.magnitude(pull) < MIN_PULL) return;
    const a = Math.atan2(pull.y, pull.x);
    ctx.strokeStyle = '#3a2213';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(pig.position.x, pig.position.y, PIG_RADIUS + 1, a - 0.95, a + 0.95);
    ctx.stroke();
  }

  // --- Blocks ---
  const MATERIALS = {
    wood: { fill: '#c98f3b', fillHurt: '#a9742d', light: '#e2ad5c', dark: '#7a4d1a', line: '#9a6a28', crack: '#3a2410', dust: '#b98a55', chip: '#b27a33' },
    stone: { fill: '#a9adb3', fillHurt: '#8b9096', light: '#c9cdd2', dark: '#565b62', line: '#8e939a', crack: '#2f3338', dust: '#b9bcc0', chip: '#7f848b' }
  };

  function makeCracks(block) {
    const rand = seededRandom(block.id * 7919 + 17);
    const hw = block.w / 2, hh = block.h / 2;
    const cracks = [];
    for (let c = 0; c < 2; c++) {
      const pts = [];
      const horizontal = block.w >= block.h;
      let x = horizontal ? (rand() * 1.6 - 0.8) * hw : (rand() < 0.5 ? -hw : hw);
      let y = horizontal ? (rand() < 0.5 ? -hh : hh) : (rand() * 1.6 - 0.8) * hh;
      pts.push({ x, y });
      const segs = 4 + Math.floor(rand() * 3);
      const dirX = horizontal ? (rand() - 0.5) * 0.6 : (x < 0 ? 1 : -1);
      const dirY = horizontal ? (y < 0 ? 1 : -1) : (rand() - 0.5) * 0.6;
      const len = horizontal ? (block.h * 0.9) / segs : (block.w * 0.9) / segs;
      for (let i = 0; i < segs; i++) {
        x += dirX * len + (rand() - 0.5) * len * 1.4;
        y += dirY * len + (rand() - 0.5) * len * 1.4;
        x = Math.max(-hw + 1, Math.min(hw - 1, x));
        y = Math.max(-hh + 1, Math.min(hh - 1, y));
        pts.push({ x, y });
      }
      cracks.push(pts);
    }
    return cracks;
  }

  function drawBlock(ctx, block) {
    const m = MATERIALS[block.material];
    const w = block.w, h = block.h;
    const hurt = block.hitPoints < 2;
    ctx.save();
    ctx.translate(block.position.x, block.position.y);
    ctx.rotate(block.angle);

    roundRectPath(ctx, -w / 2, -h / 2, w, h, 4);
    const grad = w >= h
      ? ctx.createLinearGradient(0, -h / 2, 0, h / 2)
      : ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    grad.addColorStop(0, m.light);
    grad.addColorStop(0.35, hurt ? m.fillHurt : m.fill);
    grad.addColorStop(1, hurt ? m.fillHurt : m.fill);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.save();
    ctx.clip();
    if (block.material === 'wood') {
      ctx.strokeStyle = m.line;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.7;
      const grainCount = w >= h ? 3 : 2;
      for (let i = 0; i < grainCount; i++) {
        const t = (i + 1) / (grainCount + 1);
        ctx.beginPath();
        if (w >= h) {
          const y = -h / 2 + h * t;
          ctx.moveTo(-w / 2, y);
          ctx.bezierCurveTo(-w / 6, y - 3, w / 6, y + 3, w / 2, y - 1);
        } else {
          const x = -w / 2 + w * t;
          ctx.moveTo(x, -h / 2);
          ctx.bezierCurveTo(x - 3, -h / 6, x + 3, h / 6, x - 1, h / 2);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = m.dark;
      const inset = 6;
      for (const [nx, ny] of w >= h ? [[-w / 2 + inset, 0], [w / 2 - inset, 0]] : [[0, -h / 2 + inset], [0, h / 2 - inset]]) {
        ctx.beginPath();
        ctx.arc(nx, ny, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = m.dark;
      ctx.globalAlpha = 0.35;
      const rand = seededRandom(block.id * 31 + 5);
      for (let i = 0; i < 7; i++) {
        ctx.beginPath();
        ctx.ellipse(-w / 2 + rand() * w, -h / 2 + rand() * h, 2.5, 1.5, rand() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      const seamCount = Math.max(1, Math.floor(Math.max(w, h) / 55));
      ctx.strokeStyle = m.dark;
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = 0.45;
      for (let i = 1; i <= seamCount; i++) {
        const t = i / (seamCount + 1);
        ctx.beginPath();
        if (w >= h) { const x = -w / 2 + w * t; ctx.moveTo(x, -h / 2); ctx.lineTo(x, h / 2); }
        else { const y = -h / 2 + h * t; ctx.moveTo(-w / 2, y); ctx.lineTo(w / 2, y); }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    if (block.cracks) {
      ctx.strokeStyle = m.crack;
      ctx.lineWidth = 1.6;
      ctx.lineJoin = 'round';
      for (const crack of block.cracks) {
        ctx.beginPath();
        ctx.moveTo(crack[0].x, crack[0].y);
        for (let i = 1; i < crack.length; i++) ctx.lineTo(crack[i].x, crack[i].y);
        ctx.stroke();
      }
    }
    ctx.restore();

    roundRectPath(ctx, -w / 2, -h / 2, w, h, 4);
    ctx.strokeStyle = m.dark;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  }

  // --- Pig ---
  function drawPig(ctx) {
    const { x, y } = pig.position;
    const dragging = !launched && mouseConstraint.body === pig;
    const pull = Vector.sub(pig.position, SLING_POINT);
    const pullLen = Vector.magnitude(pull);

    ctx.save();
    ctx.translate(x, y);
    if (dragging && pullLen > MIN_PULL) {
      const s = 1 - 0.18 * Math.min(1, pullLen / PULL_LIMIT);
      const a = Math.atan2(pull.y, pull.x);
      ctx.rotate(a);
      ctx.scale(s, 1 / s);
      ctx.rotate(-a);
    }
    ctx.rotate(pigSpin);
    const r = PIG_RADIUS;

    // Ears
    ctx.fillStyle = '#6db43f';
    ctx.strokeStyle = '#3f7a22';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * 9, -r + 6);
      ctx.lineTo(side * 18, -r - 6);
      ctx.lineTo(side * 20, -r + 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#e7a0b4';
      ctx.beginPath();
      ctx.moveTo(side * 12, -r + 7);
      ctx.lineTo(side * 16.5, -r - 1);
      ctx.lineTo(side * 17.5, -r + 8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#6db43f';
    }

    // Body
    const body = ctx.createRadialGradient(-7, -8, 4, 0, 0, r + 4);
    body.addColorStop(0, '#a3e06f');
    body.addColorStop(0.6, '#7fc84f');
    body.addColorStop(1, '#5fa236');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3f7a22';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Snout
    ctx.fillStyle = '#9ad46a';
    ctx.strokeStyle = '#3f7a22';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 5, 11, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#35682a';
    ctx.beginPath();
    ctx.ellipse(-4, 5, 2.2, 3, 0, 0, Math.PI * 2);
    ctx.ellipse(4, 5, 2.2, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-9, -7, 5.5, 0, Math.PI * 2);
    ctx.arc(9, -7, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1c1c1c';
    ctx.beginPath();
    ctx.arc(-7.5, -6.5, 2.6, 0, Math.PI * 2);
    ctx.arc(10.5, -6.5, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-6.5, -7.5, 0.9, 0, Math.PI * 2);
    ctx.arc(11.5, -7.5, 0.9, 0, Math.PI * 2);
    ctx.fill();

    // Angry brows
    ctx.strokeStyle = '#2f5a1a';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-15, -19);
    ctx.lineTo(-4, -15);
    ctx.moveTo(15, -19);
    ctx.lineTo(4, -15);
    ctx.stroke();

    ctx.restore();
  }

  // --- Birds ---
  function drawBird(ctx, bird) {
    const skin = BIRD_SKINS[bird.skin];
    const alive = bird.alive;
    const r = BIRD_RADIUS;
    const bodyColor = alive ? skin.body : '#9c9c9c';
    const dark = alive ? skin.dark : '#5e5e5e';

    ctx.save();
    ctx.translate(bird.position.x, bird.position.y);
    ctx.rotate(bird.angle);

    // Tail feathers (behind, pointing right since the bird faces the slingshot)
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(r - 4, 2);
    ctx.lineTo(r + 9, -4);
    ctx.lineTo(r + 7, 4);
    ctx.lineTo(r + 10, 9);
    ctx.lineTo(r - 4, 7);
    ctx.closePath();
    ctx.fill();

    // Crest
    ctx.fillStyle = bodyColor;
    ctx.strokeStyle = dark;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    if (bird.skin === 1) {
      ctx.moveTo(-4, -r + 4);
      ctx.lineTo(2, -r - 12);
      ctx.lineTo(6, -r + 3);
    } else if (bird.skin === 2) {
      ctx.moveTo(-8, -r + 4);
      ctx.lineTo(-10, -r - 6);
      ctx.lineTo(-3, -r + 2);
      ctx.lineTo(-1, -r - 9);
      ctx.lineTo(3, -r + 2);
      ctx.lineTo(7, -r - 5);
      ctx.lineTo(8, -r + 4);
    } else {
      ctx.moveTo(-6, -r + 4);
      ctx.lineTo(-12, -r - 8);
      ctx.lineTo(-2, -r + 1);
      ctx.lineTo(-1, -r - 10);
      ctx.lineTo(5, -r + 3);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Body
    const grad = ctx.createRadialGradient(-5, -6, 2, 0, 0, r + 2);
    grad.addColorStop(0, alive ? '#ffffff' : '#c8c8c8');
    grad.addColorStop(0.15, bodyColor);
    grad.addColorStop(1, bodyColor);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = dark;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Belly
    ctx.fillStyle = alive ? skin.belly : '#d6d6d6';
    ctx.beginPath();
    ctx.ellipse(-1, 7, 9, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Beak (points left, toward the slingshot)
    ctx.fillStyle = '#f5a623';
    ctx.strokeStyle = '#b8720c';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-r + 6, -1);
    ctx.lineTo(-r - 7, 2);
    ctx.lineTo(-r + 6, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r + 6, 4);
    ctx.lineTo(-r - 4, 4);
    ctx.lineTo(-r + 6, 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-6, -4, 4.2, 0, Math.PI * 2);
    ctx.arc(2, -4, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = dark;
    ctx.lineWidth = 1;
    ctx.stroke();
    if (alive) {
      ctx.fillStyle = '#1c1c1c';
      ctx.beginPath();
      ctx.arc(-7.5, -4, 2, 0, Math.PI * 2);
      ctx.arc(0.5, -4, 2, 0, Math.PI * 2);
      ctx.fill();
      // Worried brows
      ctx.strokeStyle = skin.brow;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-10, -10);
      ctx.lineTo(-3, -9);
      ctx.moveTo(-1, -10);
      ctx.lineTo(6, -9.5);
      ctx.stroke();
    } else {
      ctx.strokeStyle = '#1c1c1c';
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      for (const ex of [-6, 2]) {
        ctx.beginPath();
        ctx.moveTo(ex - 2.5, -6.5); ctx.lineTo(ex + 2.5, -1.5);
        ctx.moveTo(ex + 2.5, -6.5); ctx.lineTo(ex - 2.5, -1.5);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  // --- Particles ---
  const particles = [];

  function spawnBlockDust(block, broken) {
    const m = MATERIALS[block.material];
    const { x, y } = block.position;
    const puffs = broken ? 14 : 7;
    const chips = broken ? 9 : 3;
    for (let i = 0; i < puffs; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 20 + Math.random() * 60;
      particles.push({
        type: 'puff', x: x + (Math.random() - 0.5) * block.w * 0.8, y: y + (Math.random() - 0.5) * block.h * 0.8,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20, life: 0, maxLife: 0.5 + Math.random() * 0.4,
        size: 4 + Math.random() * 6, color: m.dust
      });
    }
    for (let i = 0; i < chips; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      const sp = 120 + Math.random() * 160;
      particles.push({
        type: 'chip', x: x + (Math.random() - 0.5) * block.w * 0.6, y: y + (Math.random() - 0.5) * block.h * 0.6,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, maxLife: 0.8 + Math.random() * 0.5,
        size: 3 + Math.random() * 4, color: m.chip, rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 14
      });
    }
  }

  function spawnBirdPoof(bird) {
    const skin = BIRD_SKINS[bird.skin];
    const { x, y } = bird.position;
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.55;
      particles.push({
        type: 'star', x, y: y - 6, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70 - 30,
        life: 0, maxLife: 0.7, size: 5 + Math.random() * 3, color: '#ffe766', rot: Math.random() * Math.PI, vr: 5
      });
    }
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 80;
      particles.push({
        type: 'feather', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
        life: 0, maxLife: 1.1 + Math.random() * 0.6, size: 4 + Math.random() * 3, color: skin.body,
        rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 6, sway: Math.random() * Math.PI * 2
      });
    }
  }

  function drawStar(ctx, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? r : r * 0.45;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    ctx.closePath();
  }

  function updateAndDrawParticles(ctx, dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) { particles.splice(i, 1); continue; }
      const t = p.life / p.maxLife;
      if (p.type === 'chip') p.vy += 900 * dt;
      else if (p.type === 'feather') { p.vy += 90 * dt; p.vx *= 0.97; p.sway += dt * 6; p.x += Math.sin(p.sway) * 30 * dt; }
      else if (p.type === 'puff') { p.vx *= 0.94; p.vy *= 0.94; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.rot !== undefined) p.rot += p.vr * dt;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = p.color;
      if (p.type === 'puff') {
        ctx.beginPath();
        ctx.arc(0, 0, p.size * (1 + t * 1.5), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'chip') {
        ctx.rotate(p.rot);
        ctx.fillRect(-p.size, -p.size * 0.4, p.size * 2, p.size * 0.8);
      } else if (p.type === 'star') {
        ctx.rotate(p.rot);
        drawStar(ctx, p.size * (1 + t * 0.6));
        ctx.fill();
        ctx.strokeStyle = '#d19a00';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        ctx.rotate(p.rot);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // --- HUD ---
  const PIG_ICON = '<svg viewBox="0 0 24 24" class="icon"><circle cx="12" cy="12" r="10" fill="#7fc84f" stroke="#3f7a22" stroke-width="2"/><ellipse cx="12" cy="14" rx="5" ry="3.6" fill="#9ad46a" stroke="#3f7a22" stroke-width="1.2"/><circle cx="10" cy="14" r="1" fill="#35682a"/><circle cx="14" cy="14" r="1" fill="#35682a"/><circle cx="8" cy="9" r="2.2" fill="#fff"/><circle cx="16" cy="9" r="2.2" fill="#fff"/><circle cx="8.5" cy="9" r="1" fill="#000"/><circle cx="16.5" cy="9" r="1" fill="#000"/></svg>';
  function birdIcon(skinIdx, alive) {
    const s = BIRD_SKINS[skinIdx];
    const fill = alive ? s.body : '#9c9c9c';
    const dark = alive ? s.dark : '#5e5e5e';
    return `<svg viewBox="0 0 24 24" class="icon${alive ? '' : ' out'}"><circle cx="12" cy="12" r="10" fill="${fill}" stroke="${dark}" stroke-width="2"/><ellipse cx="12" cy="16" rx="5" ry="3" fill="${alive ? s.belly : '#d6d6d6'}"/><path d="M4 11 L-1 13 L4 15 Z" fill="#f5a623"/><circle cx="8" cy="9" r="2.2" fill="#fff"/><circle cx="14" cy="9" r="2.2" fill="#fff"/>${alive ? '<circle cx="7.5" cy="9" r="1" fill="#000"/><circle cx="13.5" cy="9" r="1" fill="#000"/>' : '<path d="M6.5 7.5 L9.5 10.5 M9.5 7.5 L6.5 10.5 M12.5 7.5 L15.5 10.5 M15.5 7.5 L12.5 10.5" stroke="#000" stroke-width="1.2"/>'}</svg>`;
  }

  let lastHudKey = '';
  function updateHud() {
    const key = `${pigsLeft}|${birds.map((b) => (b.alive ? 1 : 0)).join('')}`;
    if (key === lastHudKey) return;
    lastHudKey = key;
    const pigIcons = Array.from({ length: TOTAL_PIGS }, (_, i) => `<span class="slot${i < pigsLeft ? '' : ' used'}">${PIG_ICON}</span>`).join('');
    const birdIcons = birds.map((b) => `<span class="slot">${birdIcon(b.skin, b.alive)}</span>`).join('');
    hudEl.innerHTML = `<div class="row"><span class="label">Pigs</span>${pigIcons}</div><div class="row"><span class="label">Birds</span>${birdIcons}</div>`;
  }

  // --- Frame ---
  const trail = [];
  let lastFrame = performance.now();

  Events.on(render, 'afterRender', () => {
    const ctx = render.context;
    const nowMs = performance.now();
    const dt = Math.min(0.05, (nowMs - lastFrame) / 1000);
    lastFrame = nowMs;

    updateHud();

    // Camera parallax follows the flying pig
    const camTarget = pig && launched ? Math.max(0, Math.min(1, (pig.position.x - SLING_X) / WIDTH)) : 0;
    camShift += (camTarget - camShift) * 0.06;

    // Pig spin while flying / rolling
    if (pig && launched) pigSpin += pig.velocity.x / PIG_RADIUS;

    drawSky(ctx);
    drawClouds(ctx, dt, true);
    drawHills(ctx, scenery.farHills, '#9ccf86', '#b4dc9f', 18);
    drawHills(ctx, scenery.nearHills, '#6fbb4a', '#86cb5f', 40);
    drawClouds(ctx, dt, false);
    drawGround(ctx);

    drawSlingshotWood(ctx);
    if (pig && slingAttached) drawBand(ctx, PRONG_RIGHT);

    const bodies = Composite.allBodies(world);
    for (const b of bodies) if (b.label === 'block') drawBlock(ctx, b);
    for (const b of bodies) if (b.label === 'bird') drawBird(ctx, b);

    if (pig) {
      if (slingAttached) drawPouch(ctx);
      drawPig(ctx);
    }
    if (pig && slingAttached) drawBand(ctx, PRONG_LEFT);

    updateAndDrawParticles(ctx, dt);

    // Short dotted aim preview while dragging
    if (pig && !launched && mouseConstraint.body === pig
        && Vector.magnitude(Vector.sub(pig.position, SLING_POINT)) > MIN_PULL) {
      const pts = predictedPath();
      pts.forEach((p, i) => {
        const size = 4.5 - (i / pts.length) * 2;
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.strokeStyle = 'rgba(40,70,20,0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    }

    // Trajectory trail
    if (pig && launched) {
      trail.push({ x: pig.position.x, y: pig.position.y });
      if (trail.length > 40) trail.shift();
    } else {
      trail.length = 0;
    }
    for (let i = 0; i < trail.length; i += 3) {
      ctx.fillStyle = `rgba(255,255,255,${0.15 + (i / trail.length) * 0.5})`;
      ctx.beginPath();
      ctx.arc(trail[i].x, trail[i].y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });
})();
