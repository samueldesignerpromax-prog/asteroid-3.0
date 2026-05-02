// ========== CONFIGURAÇÕES ==========
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let gameRunning = false;
let animationId = null;
let score = 0;
let level = 1;
let lives = 3;

let ship = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    angle: 0,
    vx: 0,
    vy: 0,
    radius: 14,
    invincible: 0
};

let asteroids = [];
let bullets = [];
let particles = [];
let shootCooldown = 0;
const SHOOT_DELAY = 10;

let asteroidSpeed = 1.5;
let asteroidCount = 4;

// Controles
let keyLeft = false, keyRight = false, keyUp = false;
let touchLeft = false, touchRight = false, touchAccel = false;

// ========== FUNÇÕES UI ==========
function updateUI() {
    document.getElementById('score').textContent = score;
    document.getElementById('level').textContent = level;
    
    const hearts = document.getElementById('livesDisplay');
    hearts.innerHTML = '';
    for (let i = 0; i < lives; i++) {
        hearts.innerHTML += '<span class="heart">❤️</span>';
    }
}

// ========== ASTEROIDE ==========
class Asteroid {
    constructor(x, y, size, vx, vy) {
        this.x = x || Math.random() * canvas.width;
        this.y = y || Math.random() * canvas.height;
        this.size = size || Math.random() * 35 + 20;
        this.radius = this.size / 2;
        this.vx = vx || (Math.random() - 0.5) * asteroidSpeed * 2;
        this.vy = vy || (Math.random() - 0.5) * asteroidSpeed * 2;
        this.angle = Math.random() * Math.PI * 2;
        this.rotSpeed = (Math.random() - 0.5) * 0.05;
        
        this.vertices = [];
        for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2;
            const r = this.radius * (0.6 + Math.random() * 0.8);
            this.vertices.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
        }
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.beginPath();
        ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
        for (let i = 1; i < this.vertices.length; i++) {
            ctx.lineTo(this.vertices[i].x, this.vertices[i].y);
        }
        ctx.closePath();
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ff6600';
        ctx.strokeStyle = '#ff8800';
        ctx.fillStyle = 'rgba(255, 100, 0, 0.2)';
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.angle += this.rotSpeed;
        
        if (this.x < -this.radius) this.x = canvas.width + this.radius;
        if (this.x > canvas.width + this.radius) this.x = -this.radius;
        if (this.y < -this.radius) this.y = canvas.height + this.radius;
        if (this.y > canvas.height + this.radius) this.y = -this.radius;
    }

    split() {
        if (this.size > 30) {
            const newSize = this.size / 1.5;
            const ang1 = Math.atan2(this.vy, this.vx) + Math.PI / 4;
            const ang2 = Math.atan2(this.vy, this.vx) - Math.PI / 4;
            const spd = Math.hypot(this.vx, this.vy);
            return [
                new Asteroid(this.x, this.y, newSize, Math.cos(ang1) * spd * 0.8, Math.sin(ang1) * spd * 0.8),
                new Asteroid(this.x, this.y, newSize, Math.cos(ang2) * spd * 0.8, Math.sin(ang2) * spd * 0.8)
            ];
        }
        return [];
    }
}

// ========== PARTÍCULA ==========
class Particle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 6;
        this.vy = (Math.random() - 0.5) * 6;
        this.life = 1;
        this.decay = 0.02 + Math.random() * 0.03;
        this.size = Math.random() * 4 + 2;
    }
    
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
        return this.life > 0;
    }
    
    draw() {
        ctx.fillStyle = `rgba(255, 100, 0, ${this.life})`;
        ctx.fillRect(this.x, this.y, this.size, this.size);
    }
}

// ========== INICIALIZAR ==========
function initGame() {
    ship = {
        x: canvas.width / 2,
        y: canvas.height / 2,
        angle: 0,
        vx: 0,
        vy: 0,
        radius: 14,
        invincible: 0
    };
    asteroids = [];
    bullets = [];
    particles = [];
    score = 0;
    level = 1;
    lives = 3;
    shootCooldown = 0;
    asteroidSpeed = 1.5;
    
    updateUI();
    spawnAsteroids();
}

function spawnAsteroids() {
    asteroidCount = Math.min(4 + Math.floor(level / 2), 10);
    asteroidSpeed = 1.5 + (level - 1) * 0.3;
    
    for (let i = 0; i < asteroidCount; i++) {
        let ast;
        let safe = false;
        while (!safe) {
            ast = new Asteroid();
            const dx = ast.x - ship.x;
            const dy = ast.y - ship.y;
            if (Math.hypot(dx, dy) > 100) safe = true;
        }
        asteroids.push(ast);
    }
}

// ========== TIRO ==========
function shoot() {
    if (shootCooldown > 0) return;
    bullets.push({
        x: ship.x + Math.cos(ship.angle) * ship.radius,
        y: ship.y + Math.sin(ship.angle) * ship.radius,
        vx: ship.vx + Math.cos(ship.angle) * 9,
        vy: ship.vy + Math.sin(ship.angle) * 9,
        life: 100
    });
    shootCooldown = SHOOT_DELAY;
}

// ========== COLISÕES ==========
function checkCollisions() {
    // Nave vs Asteroides
    for (let i = 0; i < asteroids.length; i++) {
        const a = asteroids[i];
        const dx = ship.x - a.x;
        const dy = ship.y - a.y;
        if (Math.hypot(dx, dy) < ship.radius + a.radius && ship.invincible <= 0) {
            lives--;
            updateUI();
            
            for (let j = 0; j < 15; j++) particles.push(new Particle(ship.x, ship.y));
            
            if (lives <= 0) {
                gameOver();
                return false;
            }
            
            ship.x = canvas.width / 2;
            ship.y = canvas.height / 2;
            ship.vx = 0;
            ship.vy = 0;
            ship.invincible = 60;
            asteroids.splice(i, 1);
            break;
        }
    }
    
    if (ship.invincible > 0) ship.invincible--;
    
    // Tiros vs Asteroides
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        let hit = false;
        
        for (let j = asteroids.length - 1; j >= 0; j--) {
            const a = asteroids[j];
            if (Math.hypot(b.x - a.x, b.y - a.y) < a.radius) {
                const newAst = a.split();
                asteroids.splice(j, 1, ...newAst);
                score += 10;
                updateUI();
                
                for (let k = 0; k < 10; k++) particles.push(new Particle(a.x, a.y));
                
                const newLevel = Math.floor(score / 50) + 1;
                if (newLevel > level) {
                    level = newLevel;
                    updateUI();
                    asteroidSpeed = 1.5 + (level - 1) * 0.3;
                }
                hit = true;
                break;
            }
        }
        if (hit) bullets.splice(i, 1);
    }
    return true;
}

// ========== DESENHO ==========
let starsData = null;

function drawStars() {
    if (!starsData) {
        starsData = [];
        for (let i = 0; i < 150; i++) {
            starsData.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                size: Math.random() * 2,
                alpha: Math.random() * 0.7
            });
        }
    }
    for (const s of starsData) {
        ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
        ctx.fillRect(s.x, s.y, s.size, s.size);
    }
}

function drawShip() {
    if (ship.invincible > 0 && Math.floor(Date.now() / 50) % 3 === 0) return;
    
    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.angle);
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00ffff';
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-12, -9);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-12, 9);
    ctx.closePath();
    ctx.fillStyle = '#00ffff';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    if (keyUp || touchAccel) {
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(-20, -6);
        ctx.lineTo(-20, 6);
        ctx.fillStyle = '#ff6600';
        ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.restore();
}

function drawBullets() {
    for (const b of bullets) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ffff00';
        ctx.fill();
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#ffff00';
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

// ========== UPDATE ==========
function updateGame() {
    if (!gameRunning) return;
    
    if (shootCooldown > 0) shootCooldown--;
    
    // Teclado
    if (keyLeft) ship.angle -= 0.09;
    if (keyRight) ship.angle += 0.09;
    if (keyUp) {
        ship.vx += Math.cos(ship.angle) * 0.28;
        ship.vy += Math.sin(ship.angle) * 0.28;
        const maxSpeed = 7.5;
        if (Math.abs(ship.vx) > maxSpeed) ship.vx = Math.sign(ship.vx) * maxSpeed;
        if (Math.abs(ship.vy) > maxSpeed) ship.vy = Math.sign(ship.vy) * maxSpeed;
    }
    
    // Touch
    if (touchLeft) ship.angle -= 0.09;
    if (touchRight) ship.angle += 0.09;
    if (touchAccel) {
        ship.vx += Math.cos(ship.angle) * 0.28;
        ship.vy += Math.sin(ship.angle) * 0.28;
        const maxSpeed = 7.5;
        if (Math.abs(ship.vx) > maxSpeed) ship.vx = Math.sign(ship.vx) * maxSpeed;
        if (Math.abs(ship.vy) > maxSpeed) ship.vy = Math.sign(ship.vy) * maxSpeed;
    }
    
    ship.vx *= 0.99;
    ship.vy *= 0.99;
    ship.x += ship.vx;
    ship.y += ship.vy;
    
    if (ship.x < 0) ship.x = canvas.width;
    if (ship.x > canvas.width) ship.x = 0;
    if (ship.y < 0) ship.y = canvas.height;
    if (ship.y > canvas.height) ship.y = 0;
    
    for (let a of asteroids) a.update();
    
    for (let i = 0; i < bullets.length; i++) {
        bullets[i].x += bullets[i].vx;
        bullets[i].y += bullets[i].vy;
        bullets[i].life--;
        if (bullets[i].life <= 0 || bullets[i].x < -50 || bullets[i].x > canvas.width + 50 ||
            bullets[i].y < -50 || bullets[i].y > canvas.height + 50) {
            bullets.splice(i, 1);
            i--;
        }
    }
    
    for (let i = 0; i < particles.length; i++) {
        if (!particles[i].update()) {
            particles.splice(i, 1);
            i--;
        }
    }
    
    checkCollisions();
    
    if (asteroids.length === 0) {
        spawnAsteroids();
    }
    
    // Renderizar
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawStars();
    for (let p of particles) p.draw();
    for (let a of asteroids) a.draw();
    drawBullets();
    drawShip();
}

function gameLoop() {
    if (!gameRunning) return;
    updateGame();
    animationId = requestAnimationFrame(gameLoop);
}

// ========== CONTROLE DO JOGO ==========
function startGame() {
    if (animationId) cancelAnimationFrame(animationId);
    initGame();
    gameRunning = true;
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('gameOverScreen').style.display = 'none';
    gameLoop();
}

function gameOver() {
    gameRunning = false;
    if (animationId) cancelAnimationFrame(animationId);
    document.getElementById('finalScore').textContent = score;
    document.getElementById('finalLevel').textContent = level;
    document.getElementById('gameOverScreen').style.display = 'flex';
}

function restartGame() {
    startGame();
}

// ========== EVENTOS TECLADO ==========
document.addEventListener('keydown', (e) => {
    if (!gameRunning) return;
    if (e.key === 'ArrowLeft') { keyLeft = true; e.preventDefault(); }
    if (e.key === 'ArrowRight') { keyRight = true; e.preventDefault(); }
    if (e.key === 'ArrowUp') { keyUp = true; e.preventDefault(); }
    if (e.key === ' ') { shoot(); e.preventDefault(); }
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft') keyLeft = false;
    if (e.key === 'ArrowRight') keyRight = false;
    if (e.key === 'ArrowUp') keyUp = false;
});

// ========== EVENTOS TOUCH ==========
document.getElementById('rotateLeftBtn').addEventListener('touchstart', (e) => { e.preventDefault(); touchLeft = true; });
document.getElementById('rotateLeftBtn').addEventListener('touchend', () => { touchLeft = false; });
document.getElementById('rotateLeftBtn').addEventListener('mousedown', () => { touchLeft = true; });
document.getElementById('rotateLeftBtn').addEventListener('mouseup', () => { touchLeft = false; });

document.getElementById('rotateRightBtn').addEventListener('touchstart', (e) => { e.preventDefault(); touchRight = true; });
document.getElementById('rotateRightBtn').addEventListener('touchend', () => { touchRight = false; });
document.getElementById('rotateRightBtn').addEventListener('mousedown', () => { touchRight = true; });
document.getElementById('rotateRightBtn').addEventListener('mouseup', () => { touchRight = false; });

document.getElementById('accelerateBtn').addEventListener('touchstart', (e) => { e.preventDefault(); touchAccel = true; });
document.getElementById('accelerateBtn').addEventListener('touchend', () => { touchAccel = false; });
document.getElementById('accelerateBtn').addEventListener('mousedown', () => { touchAccel = true; });
document.getElementById('accelerateBtn').addEventListener('mouseup', () => { touchAccel = false; });

document.getElementById('shootBtn').addEventListener('click', () => shoot());
document.getElementById('shootBtn').addEventListener('touchstart', (e) => { e.preventDefault(); shoot(); });

document.getElementById('restartTouchBtn').addEventListener('click', () => restartGame());

canvas.addEventListener('touchstart', (e) => e.preventDefault());

// Redimensionar canvas
function resizeCanvas() {
    const maxW = Math.min(window.innerWidth - 40, 900);
    canvas.style.width = `${maxW}px`;
    canvas.style.height = 'auto';
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Exportar funções para global
window.startGame = startGame;
window.restartGame = restartGame;
