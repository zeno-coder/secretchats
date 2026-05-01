
const MusicController = (() => {
  let audio      = null;
  let started    = false;
  let fadeTimer  = null;
  function _fadeTo(target, speed, onDone) {
    clearInterval(fadeTimer);
    fadeTimer = setInterval(() => {
      if (!audio) return clearInterval(fadeTimer);
      const diff = target - audio.volume;
      if (Math.abs(diff) < speed) {
        audio.volume = Math.max(0, Math.min(1, target));
        clearInterval(fadeTimer);
        if (onDone) onDone();
      } else {
        audio.volume = Math.max(0, Math.min(1, audio.volume + (diff > 0 ? speed : -speed)));
      }
    }, 55);
  }

  function init(el) {
    audio = el;
  }

  function start(targetVol = 0.22) {
    if (!audio || started) return;
    audio.volume = 0;
    audio.play().then(() => {
      started = true;
      _fadeTo(targetVol, 0.015);
    }).catch(() => {});
  }

  function fadeOut(speed = 0.025, onDone) {
    if (!audio) return onDone && onDone();
    _fadeTo(0, speed, () => {
      audio.pause();
      if (onDone) onDone();
    });
  }

  function isStarted() { return started; }

  return { init, start, fadeOut, isStarted };
})();


const ParticleEngine = (() => {
  let canvas, ctx;
  let particles = [];
  let running   = false;
  const isMobile = window.innerWidth <= 480;
  const MAX_AMBIENT = isMobile ? 0 : 18;
  function _make(type, x, y) {
    const base = {
      x: x ?? Math.random() * window.innerWidth,
      y: y ?? Math.random() * window.innerHeight,
      alpha: 0,
      life:  0,
      maxLife: 180 + Math.random() * 120,
      type,
    };

    if (type === 'ambient') {
      return {
        ...base,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -0.15 - Math.random() * 0.25,
        r:  1.5 + Math.random() * 2,
        hue: 200 + Math.random() * 60,    /* blue-violet range */
        maxLife: 240 + Math.random() * 180,
      };
    }

    if (type === 'gold') {
      return {
        ...base,
        vx: (Math.random() - 0.5) * 2.5,
        vy: -1.5 - Math.random() * 2,
        r:  2 + Math.random() * 2.5,
        maxLife: 60 + Math.random() * 40,
        alpha: 1,
      };
    }

    if (type === 'sparkle') {
      return {
        ...base,
        vx: (Math.random() - 0.5) * 4,
        vy: -2 - Math.random() * 3,
        r:  1 + Math.random() * 1.5,
        maxLife: 40 + Math.random() * 30,
        alpha: 1,
      };
    }

    if (type === 'mist') {
      return {
        ...base,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -0.3 - Math.random() * 0.3,
        r:  12 + Math.random() * 16,
        maxLife: 150 + Math.random() * 100,
      };
    }

    return base;
  }

  function _draw(p) {
    const progress = p.life / p.maxLife;

    if (p.type === 'ambient') {
      p.alpha = progress < 0.15
        ? progress / 0.15
        : progress > 0.75
          ? (1 - progress) / 0.25
          : 1;
      ctx.save();
      ctx.globalAlpha = p.alpha * 0.55;
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3);
      grad.addColorStop(0, `hsla(${p.hue}, 80%, 75%, 1)`);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (p.type === 'gold') {
      p.alpha = 1 - progress;
      ctx.save();
      ctx.globalAlpha = p.alpha;
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2.5);
      grad.addColorStop(0,   'rgba(255, 240, 160, 1)');
      grad.addColorStop(0.4, 'rgba(255, 190, 80, 0.8)');
      grad.addColorStop(1,   'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (p.type === 'sparkle') {
      p.alpha = 1 - progress;
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = 'rgba(255,255,220,0.9)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (p.type === 'mist') {
      p.alpha = progress < 0.2
        ? progress / 0.2
        : 1 - progress;
      ctx.save();
      ctx.globalAlpha = p.alpha * 0.25;
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      grad.addColorStop(0, 'rgba(160, 140, 255, 0.7)');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function _tick() {
    if (!running) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!isMobile) {
      const ambients = particles.filter(p => p.type === 'ambient').length;
      if (ambients < MAX_AMBIENT && Math.random() < 0.08) {
        particles.push(_make('ambient'));
      }
      if (Math.random() < 0.015) {
        particles.push(_make('mist'));
      }
    }

    particles = particles.filter(p => {
      p.x   += p.vx;
      p.y   += p.vy;
      p.life++;
      if (p.life >= p.maxLife) return false;
      _draw(p);
      return true;
    });

    requestAnimationFrame(_tick);
  }

  function init() {
    canvas = document.getElementById('particle-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    function resize() {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);
    if (!isMobile) {
      for (let i = 0; i < 10; i++) {
        const p = _make('ambient');
        p.life  = Math.random() * p.maxLife;
        particles.push(p);
      }
    }

    running = true;
    requestAnimationFrame(_tick);
  }
  function burst(x, y, count = 14) {
    if (isMobile) return;
    for (let i = 0; i < count; i++) {
      particles.push(_make('gold', x, y));
    }
    for (let i = 0; i < Math.floor(count * 0.6); i++) {
      particles.push(_make('sparkle', x, y));
    }
    for (let i = 0; i < 4; i++) {
      particles.push(_make('mist', x, y));
    }
  }
  function trail(x, y) {
    if (isMobile) return;
    if (Math.random() < 0.5) particles.push(_make('gold', x, y));
    if (Math.random() < 0.2) particles.push(_make('sparkle', x, y));
  }

  function stop() { running = false; }

  return { init, burst, trail, stop };
})();


const FluteEngine = (() => {
  let flute;
  let x, y, vx = 0, vy = 0;
  let running = false;
  let mouseX  = -999, mouseY = -999;
  const REPEL_RADIUS = 190;
  const REPEL_FORCE  = 0.75;
  const DRIFT        = 0.982;
  const MAX_SPEED    = 6.5;
  const IDLE_DRIFT   = 0.008;  
  let idleAngle = 0;
  function init() {
    flute = document.querySelector('.divine-flute');
    if (!flute || window.innerWidth <= 768) return;
    x = window.innerWidth  * 0.55;
    y = window.innerHeight * 0.42;
    vx = (Math.random() - 0.5) * 1.5;
    vy = (Math.random() - 0.5) * 1.5;
    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      const rect = flute.getBoundingClientRect();
      const cx   = rect.left + rect.width  / 2;
      const cy   = rect.top  + rect.height / 2;
      const dx   = cx - e.clientX;
      const dy   = cy - e.clientY;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < REPEL_RADIUS) {
        const str = (REPEL_RADIUS - dist) / REPEL_RADIUS;
        vx += (dx / dist) * str * REPEL_FORCE;
        vy += (dy / dist) * str * REPEL_FORCE;
        const glow = 14 + str * 20;
        const glowColor = `rgba(240,192,96,${0.5 + str * 0.4})`;
        flute.style.filter = `drop-shadow(0 0 ${glow}px ${glowColor}) drop-shadow(0 0 ${glow * 2}px rgba(180,160,255,${0.25 + str * 0.3}))`;
        ParticleEngine.trail(cx, cy);
      } else {
        flute.style.filter = '';
      }
    });
    running = true;
    _animate();
  }

  function _animate() {
    if (!running) return;
    vx *= DRIFT;
    vy *= DRIFT;
    const speed = Math.hypot(vx, vy);
    if (speed > MAX_SPEED) {
      vx = (vx / speed) * MAX_SPEED;
      vy = (vy / speed) * MAX_SPEED;
    }
    x += vx;
    y += vy;
    const pad = 100;
    if (x < pad || x > window.innerWidth - pad) vx *= -0.75;
    if (y < pad || y > window.innerHeight - pad) vy *= -0.75;
    x = Math.max(pad, Math.min(window.innerWidth  - pad, x));
    y = Math.max(pad, Math.min(window.innerHeight - pad, y));
    idleAngle += IDLE_DRIFT;
    const velRotation  = vx * 2.2;
    const idleRotation = Math.sin(idleAngle) * 5;
    const rotation     = velRotation + idleRotation * (1 - Math.min(1, speed / 3));
    const breathScale  = 1 + Math.sin(idleAngle * 0.4) * 0.025;
    flute.style.left      = x + 'px';
    flute.style.top       = y + 'px';
    flute.style.transform = `translate(-50%, -50%) rotate(${rotation}deg) scale(${breathScale})`;
    requestAnimationFrame(_animate);
  }

  function burst() {
    const rect = flute.getBoundingClientRect();
    const cx   = rect.left + rect.width  / 2;
    const cy   = rect.top  + rect.height / 2;
    ParticleEngine.burst(cx, cy, 20);
  }

  return { init, burst };
})();

const AuthUI = (() => {
  let card;
  function init() {
    card = document.querySelector('.auth-container');
    if (!card) return;
    if (!document.getElementById('page-fade')) {
      const fade = document.createElement('div');
      fade.id = 'page-fade';
      document.body.appendChild(fade);
    }
    if (window.innerWidth > 480) {
      document.addEventListener('mousemove', _tilt);
    }
  }

  function _tilt(e) {
    if (!card) return;
    const rect  = card.getBoundingClientRect();
    const cx    = rect.left + rect.width  / 2;
    const cy    = rect.top  + rect.height / 2;
    const dx    = (e.clientX - cx) / (rect.width  / 2);
    const dy    = (e.clientY - cy) / (rect.height / 2);
    const rotX  = -dy * 5;
    const rotY  =  dx * 5;
    card.style.transform = `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
    card.style.setProperty('--mx', (50 + dx * 30) + '%');
    card.style.setProperty('--my', (50 + dy * 30) + '%');
  }

  function showError(msg) {
    card.querySelectorAll('.auth-error-msg').forEach(el => el.remove());
    card.classList.remove('shake');
    const el = document.createElement('div');
    el.className = 'auth-error-msg show';
    el.innerHTML = `<span>⚠</span> ${msg}`;
    const btn = card.querySelector('button[type="submit"]');
    if (btn) btn.parentNode.insertBefore(el, btn);
    card.querySelectorAll('input').forEach(inp => inp.classList.add('error-input'));
    setTimeout(() => card.querySelectorAll('input').forEach(i => i.classList.remove('error-input')), 1800);
    void card.offsetWidth;
    card.classList.add('shake');
    setTimeout(() => card.classList.remove('shake'), 500);
  }

  function setLoading(btn, state) {
    if (state) {
      btn.classList.add('loading');
      btn._originalText = btn.textContent;
      btn.textContent   = '';
    } else {
      btn.classList.remove('loading');
      btn.textContent = btn._originalText || 'Submit';
    }
  }

  function _transitionOut(url, delay = 0) {
    const fade = document.getElementById('page-fade');
    setTimeout(() => {
      if (fade) fade.classList.add('active');
      FluteEngine.burst && FluteEngine.burst();
      MusicController.fadeOut(0.03, () => {
        setTimeout(() => window.location.href = url, 300);
      });
    }, delay);
  }

  function successTransition(url) {
    card.classList.add('success-flash');
    const rect = card.getBoundingClientRect();
    ParticleEngine.burst(
      rect.left + rect.width  / 2,
      rect.top  + rect.height / 2,
      30
    );
    FluteEngine.burst();
    _transitionOut(url, 400);
  }

  function addRipple(btn, e) {
    const rect = btn.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'btn-ripple';
    const size = Math.max(rect.width, rect.height);
    ripple.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      left: ${e.clientX - rect.left - size / 2}px;
      top:  ${e.clientY - rect.top  - size / 2}px;
    `;
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  }

  return { init, showError, setLoading, successTransition, addRipple };
})();


function bindInputBurst() {
  document.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('focus', () => {
      const rect = inp.getBoundingClientRect();
      ParticleEngine.burst(
        rect.left + rect.width  / 2,
        rect.top,
        8
      );
    });
  });
}


function bootAuthEngine() {
  ParticleEngine.init();
  FluteEngine.init();
  AuthUI.init();
  bindInputBurst();
}
