// Configurações do canvas
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Dimensões do canvas
const WIDTH = 900;
const HEIGHT = 600;

// Nave 
let ship = {
    x: WIDTH / 2,
    y: HEIGHT / 2,
    angle: 0,
    velocityX: 0,
    velocityY: 0,
    radius: 15,
    acceleration: 0.2,
    friction: 0.99,
    rotationSpeed: 0.1
};

// Arrays para objetos do jogo
let asteroids = [];
let bullets = [];
let particles = [];

// Estado do jogo
let score = 0;
let level = 1;
let lives = 3;
let gameRunning = false;
let animationId = null;
let destroyedCount = 0;

// Cooldown do tiro
let shootCooldown = 0;
const SHOOT_DELAY = 10;

// Configuração de dificuldade
let asteroidCount = 4;
let asteroidSpeed = 1.5;

// Controles
const keys = {
    ArrowLeft: false,
    ArrowRight: false,
    ArrowUp: false,
    Space: false
};

// Sistema de som (usando Web Audio API)
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

// Função para tocar som simples
function playSound(type) {
    if (!gameRunning) return;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    switch(type) {
        case 'shoot':
            oscillator.frequency.value = 880;
            gainNode.gain.value = 0.1;
            oscillator.type = 'sine';
            gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.3);
            break;
        case 'explosion':
            oscillator.frequency.value = 100;
            gainNode.gain.value = 0.2;
            oscillator.type = 'sawtooth';
            oscillator.frequency.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.5);
            break;
        case 'hit':
            oscillator.frequency.value = 440;
            gainNode.gain.value = 0.15;
            oscillator.type = 'triangle';
            gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.2);
            break;
    }
    
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.3);
}

// Classe Asteroide
class Asteroid {
    constructor(x, y, size, velocityX, velocityY) {
        this.x = x || Math.random() * WIDTH;
        this.y = y || Math.random() * HEIGHT;
        this.size = size || Math.random() * 30 + 20; // 20-50
        this.radius = this.size / 2;
        this.velocityX = velocityX || (Math.random() - 0.5) * asteroidSpeed * 2;
        this.velocityY = velocityY || (Math.random() - 0.5) * asteroidSpeed * 2;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.05;
        
        // Vértices para forma irregular
        this.vertices = [];
        const segments = 12;
        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const variation = 0.7 + Math.random() * 0.6;
            const rad = this.radius * variation;
            this.vertices.push({
                x: Math.cos(angle) * rad,
                y: Math.sin(angle) * rad
            });
        }
    }
    
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        ctx.beginPath();
        ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
        for (let i = 1; i < this.vertices.length; i++) {
            ctx.lineTo(this.vertices[i].x, this.vertices[i].y);
        }
        ctx.closePath();
        
        // Glow effect
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ff6600';
        ctx.strokeStyle = '#ff6600';
        ctx.fillStyle = 'rgba(255, 102, 0, 0.2)';
        ctx.fill();
        ctx.stroke();
        
        ctx.shadowBlur = 0;
        ctx.restore();
    }
    
    update() {
        this.x += this.velocityX;
        this.y += this.velocityY;
        this.rotation += this.rotationSpeed;
        
        // Wrapping
        if (this.x < -this.radius) this.x = WIDTH + this.radius;
        if (this.x > WIDTH + this.radius) this.x = -this.radius;
        if (this.y < -this.radius) this.y = HEIGHT + this.radius;
        if (this.y > HEIGHT + this.radius) this.y = -this.radius;
    }
    
    split() {
        if (this.size > 30) {
            // Divide em 2 asteroides menores
            const newSize = this.size / 1.5;
            const angle1 = Math.atan2(this.velocityY, this.velocityX) + Math.PI / 4;
            const angle2 = Math.atan2(this.velocityY, this.velocityX) - Math.PI / 4;
            const speed = Math.hypot(this.velocityX, this.velocityY);
            
            return [
                new Asteroid(this.x, this.y, newSize, 
                    Math.cos(angle1) * speed * 0.8, 
                    Math.sin(angle1) * speed * 0.8),
                new Asteroid(this.x, this.y, newSize,
                    Math.cos(angle2) * speed * 0.8,
                    Math.sin(angle2) * speed * 0.8)
            ];
        }
        return []; // Asteroide pequeno desaparece
    }
}

// Classe Partícula (para explosões)
class Particle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.velocityX = (Math.random() - 0.5) * 5;
        this.velocityY = (Math.random() - 0.5) * 5;
        this.life = 1;
        this.decay = 0.02 + Math.random() * 0.03;
        this.size = Math.random() * 3 + 2;
    }
    
    update() {
        this.x += this.velocityX;
        this.y += this.velocityY;
        this.life -= this.decay;
        return this.life > 0;
    }
    
    draw() {
        ctx.fillStyle = `rgba(255, 100, 0, ${this.life})`;
        ctx.fillRect(this.x, this.y, this.size, this.size);
    }
}

// Inicializa o jogo
function initGame() {
    ship = {
        x: WIDTH / 2,
        y: HEIGHT / 2,
        angle: 0,
        velocityX: 0,
        velocityY: 0,
        radius: 15,
        acceleration: 0.2,
        friction: 0.99,
        rotationSpeed: 0.1
    };
    
    asteroids = [];
    bullets = [];
    particles = [];
    score = 0;
    level = 1;
    lives = 3;
    destroyedCount = 0;
    shootCooldown = 0;
    
    updateUI();
    spawnAsteroids();
}

// Spawn de asteroides
function spawnAsteroids() {
    asteroidCount = Math.min(4 + Math.floor(level / 2), 12);
    asteroidSpeed = 1.5 + (level - 1) * 0.3;
    
    for (let i = 0; i < asteroidCount; i++) {
        let asteroid;
        do {
            asteroid = new Asteroid();
        } while (Math.hypot(asteroid.x - ship.x, asteroid.y - ship.y) < 100);
        asteroids.push(asteroid);
    }
}

// Atira um projétil
function shoot() {
    if (shootCooldown > 0) return;
    
    const angle = ship.angle;
    const speed = 8;
    bullets.push({
        x: ship.x + Math.cos(angle) * ship.radius,
        y: ship.y + Math.sin(angle) * ship.radius,
        velocityX: ship.velocityX + Math.cos(angle) * speed,
        velocityY: ship.velocityY + Math.sin(angle) * speed,
        radius: 3,
        life: 100
    });
    
    shootCooldown = SHOOT_DELAY;
    playSound('shoot');
}

// Cria explosão de partículas
function createExplosion(x, y) {
    for (let i = 0; i < 20; i++) {
        particles.push(new Particle(x, y));
    }
    playSound('explosion');
}

// Atualiza UI
function updateUI() {
    document.getElementById('score').textContent = score;
    document.getElementById('level').textContent = level;
    
    const livesContainer = document.getElementById('lives');
    livesContainer.innerHTML = '';
    for (let i = 0; i < lives; i++) {
        const heart = document.createElement('span');
        heart.className = 'heart';
        heart.textContent = '❤️';
        livesContainer.appendChild(heart);
    }
}

// Verifica colisões da nave com asteroides
function checkShipCollision() {
    for (let i = 0; i < asteroids.length; i++) {
        const asteroid = asteroids[i];
        const dx = ship.x - asteroid.x;
        const dy = ship.y - asteroid.y;
        const distance = Math.hypot(dx, dy);
        
        if (distance < ship.radius + asteroid.radius) {
            // Perde uma vida
            lives--;
            updateUI();
            createExplosion(ship.x, ship.y);
            playSound('hit');
            
            if (lives <= 0) {
                gameOver();
                return false;
            }
            
            // Reseta posição da nave
            ship.x = WIDTH / 2;
            ship.y = HEIGHT / 2;
            ship.velocityX = 0;
            ship.velocityY = 0;
            
            // Remove o asteroide que causou a colisão
            asteroids.splice(i, 1);
            
            // Invulnerabilidade temporária (piscando)
            return false;
        }
    }
    return true;
}

// Verifica colisões dos projéteis com asteroides
function checkBulletCollisions() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        let hit = false;
        
        for (let j = asteroids.length - 1; j >= 0; j--) {
            const asteroid = asteroids[j];
            const dx = bullet.x - asteroid.x;
            const dy = bullet.y - asteroid.y;
            const distance = Math.hypot(dx, dy);
            
            if (distance < asteroid.radius) {
                // Asteroide destruído
                const newAsteroids = asteroid.split();
                asteroids.splice(j, 1, ...newAsteroids);
                
                // Adiciona pontos
                score += 10;
                destroyedCount++;
                updateUI();
                createExplosion(asteroid.x, asteroid.y);
                
                // Verifica se subiu de nível
                const newLevel = Math.floor(score / 100) + 1;
                if (newLevel > level) {
                    level = newLevel;
                    updateUI();
                    // Aumenta dificuldade
                    asteroidSpeed = 1.5 + (level - 1) * 0.3;
                }
                
                hit = true;
                break;
            }
        }
        
        if (hit) {
            bullets.splice(i, 1);
        }
    }
}

// Desenha a nave
function drawShip() {
    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.angle);
    
    // Nave com efeito neon
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00ffff';
    ctx.beginPath();
    ctx.moveTo(15, 0);
    ctx.lineTo(-10, -8);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-10, 8);
    ctx.closePath();
    
    ctx.fillStyle = '#00ffff';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Chama do motor quando acelera
    if (keys.ArrowUp) {
        ctx.beginPath();
        ctx.moveTo(-8, 0);
        ctx.lineTo(-15, -4);
        ctx.lineTo(-15, 4);
        ctx.fillStyle = '#ff6600';
        ctx.fill();
    }
    
    ctx.shadowBlur = 0;
    ctx.restore();
}

// Desenha projéteis
function drawBullets() {
    for (const bullet of bullets) {
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#ffff00';
        ctx.fill();
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#ffff00';
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

// Desenha estrelas de fundo
function drawStars() {
    for (let i = 0; i < 200; i++) {
        if (!window.stars) {
            window.stars = [];
            for (let j = 0; j < 200; j++) {
                window.stars.push({
                    x: Math.random() * WIDTH,
                    y: Math.random() * HEIGHT,
                    size: Math.random() * 2,
                    alpha: Math.random()
                });
            }
        }
        const star = window.stars[i];
        ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
        ctx.fillRect(star.x, star.y, star.size, star.size);
    }
}

// Atualiza e desenha tudo
function update() {
    if (!gameRunning) return;
    
    // Atualiza cooldown do tiro
    if (shootCooldown > 0) shootCooldown--;
    
    // Controles da nave
    if (keys.ArrowLeft) {
        ship.angle -= ship.rotationSpeed;
    }
    if (keys.ArrowRight) {
        ship.angle += ship.rotationSpeed;
    }
    if (keys.ArrowUp) {
        ship.velocityX += Math.cos(ship.angle) * ship.acceleration;
        ship.velocityY += Math.sin(ship.angle) * ship.acceleration;
        
        // Limita velocidade máxima
        const maxSpeed = 8;
        if (Math.abs(ship.velocityX) > maxSpeed) 
            ship.velocityX = Math.sign(ship.velocityX) * maxSpeed;
        if (Math.abs(ship.velocityY) > maxSpeed) 
            ship.velocityY = Math.sign(ship.velocityY) * maxSpeed;
    }
    if (keys.Space) {
        shoot();
    }
    
    // Aplica fricção
    ship.velocityX *= ship.friction;
    ship.velocityY *= ship.friction;
    
    // Atualiza posição da nave
    ship.x += ship.velocityX;
    ship.y += ship.velocityY;
    
    // Wrapping da nave
    if (ship.x < 0) ship.x = WIDTH;
    if (ship.x > WIDTH) ship.x = 0;
    if (ship.y < 0) ship.y = HEIGHT;
    if (ship.y > HEIGHT) ship.y = 0;
    
    // Atualiza asteroides
    for (let i = 0; i < asteroids.length; i++) {
        asteroids[i].update();
    }
    
    // Atualiza projéteis
    for (let i = 0; i < bullets.length; i++) {
        bullets[i].x += bullets[i].velocityX;
        bullets[i].y += bullets[i].velocityY;
        bullets[i].life--;
        
        if (bullets[i].life <= 0 || 
            bullets[i].x < -50 || bullets[i].x > WIDTH + 50 ||
            bullets[i].y < -50 || bullets[i].y > HEIGHT + 50) {
            bullets.splice(i, 1);
            i--;
        }
    }
    
    // Atualiza partículas
    for (let i = 0; i < particles.length; i++) {
        if (!particles[i].update()) {
            particles.splice(i, 1);
            i--;
        }
    }
    
    // Verifica colisões
    checkBulletCollisions();
    if (!checkShipCollision()) {
        if (lives <= 0) return;
    }
    
    // Spawna novos asteroides se necessário
    if (asteroids.length === 0) {
        spawnAsteroids();
    }
    
    // Renderiza
    drawStars();
    
    // Desenha partículas
    for (const particle of particles) {
        particle.draw();
    }
    
    // Desenha asteroides
    for (const asteroid of asteroids) {
        asteroid.draw();
    }
    
    // Desenha projéteis
    drawBullets();
    
    // Desenha nave
    drawShip();
    
    // Mostra invulnerabilidade (piscando)
    // (efeito visual omitido por simplicidade)
}

// Game Over
function gameOver() {
    gameRunning = false;
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    
    document.getElementById('finalScore').textContent = score;
    document.getElementById('finalLevel').textContent = level;
    document.getElementById('finalDestroyed').textContent = destroyedCount;
    document.getElementById('gameOverScreen').style.display = 'flex';
}

// Loop do jogo
function gameLoop() {
    if (!gameRunning) return;
    
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    update();
    animationId = requestAnimationFrame(gameLoop);
}

// Inicia o jogo
function startGame() {
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
    
    initGame();
    gameRunning = true;
    gameLoop();
    
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('gameOverScreen').style.display = 'none';
}

// Reinicia o jogo
function restartGame() {
    startGame();
}

// Event Listeners
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        keys[e.key] = true;
        e.preventDefault();
    }
    if (e.key === ' ') {
        keys.Space = true;
        e.preventDefault();
    }
    if (e.key === 'r' || e.key === 'R') {
        restartGame();
        e.preventDefault();
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        keys[e.key] = false;
    }
    if (e.key === ' ') {
        keys.Space = false;
    }
});

// Botões
document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('playAgainBtn').addEventListener('click', () => {
    document.getElementById('gameOverScreen').style.display = 'none';
    startGame();
});

// Inicializa áudio após interação do usuário
document.body.addEventListener('click', () => {
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
}, { once: true });

// Renderização inicial
drawStars();
