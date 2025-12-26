// PARTICLE PLAYGROUND - ZEN GARDEN FIXED VERSION
// Actually persistent particles with real accumulation

let scene, camera, renderer, particles, particleSystem, emitter;
let animationId;
let isAnimating = true;
let controlsVisible = false;
let pingPongDelay;

// Tone.js instruments and effects
let synth, bassSynth, guitarSynth;
let distortion, reverb, feedbackDelay;
let currentPlayingNote = null;
let releaseTimeout = null;

let synthWaveNotes = [
    "C4", "E4", "G4", "B4", "C5",
    "G3", "B3", "D4", "G4",
    "A3", "C4", "E4", "A4",
    "F3", "A3", "C4", "F4",
    "D4", "F4", "A4", "C5",
    "E4", "G4", "B4", "D5",
    "C4", "G4", "E5", "C5",
    "G3", "D4", "A4", "E5"
];
let currentNoteIndex = 0;
let isAudioEnabled = true;

// ZEN MODE - ACTUALLY PERSISTENT
let particleParams = {
    count: 30000, // TRIPLED - was 10k
    emissionRate: 69,
    gravity: -0.3, // REDUCED gravity so they float longer
    initialSpeed: 2, // SLOWER initial speed
    spreadAngle: 133,
    airResistance: 0.02, // MUCH LESS air resistance (was 0.1)
    startColor: new THREE.Color(0xffffff),
    endColor: new THREE.Color(0x00ffff),
    size: 0.5,
    sizeVariation: 3,
    opacity: 0.7,
    lifespan: 120, // 2 MINUTES base life (was 9s)
    turbulence: 0.5, // LESS chaotic movement
    shape: 'cube',
    blendMode: 'subtractive',
    windX: -0.3, // GENTLER wind
    windY: 0.2,
    windZ: 0.1,
    burstSize: 99,
    trailDensity: 33,
    zenMode: true,
    ghostDuration: 30, // 30 second ghost phase
    clearingMode: false // NEW: For gentle clear tracking
};

class Particle {
    constructor(position, velocity) {
        this.position = position.clone();
        this.velocity = velocity.clone();
        this.life = particleParams.lifespan;
        this.maxLife = particleParams.lifespan;
        this.size = particleParams.size + (Math.random() - 0.5) * particleParams.sizeVariation;
        this.turbulenceOffset = Math.random() * 1000;
        this.clearing = false; // Track if particle is in gentle clear mode
        this.clearStartLife = null; // Life value when clearing started
    }

    update(deltaTime) {
        // GENTLE CLEAR OVERRIDE
        if (particleParams.clearingMode && !this.clearing) {
            this.clearing = true;
            this.clearStartLife = this.life;
            // Force life to max 5 seconds for gentle fade
            this.life = Math.min(this.life, 5);
        }

        // Apply gravity (REDUCED in zen mode)
        this.velocity.y += particleParams.gravity * deltaTime;

        // Apply air resistance (MUCH LESS in zen mode)
        this.velocity.multiplyScalar(1 - particleParams.airResistance * deltaTime);

        // Apply wind (GENTLER)
        this.velocity.x += particleParams.windX * deltaTime;
        this.velocity.y += particleParams.windY * deltaTime;
        this.velocity.z += particleParams.windZ * deltaTime;

        // Apply turbulence (REDUCED)
        const time = Date.now() * 0.001;
        const turbulence = particleParams.turbulence;
        this.velocity.x += Math.sin(time + this.turbulenceOffset) * turbulence * deltaTime;
        this.velocity.z += Math.cos(time + this.turbulenceOffset * 1.1) * turbulence * deltaTime;

        // Update position
        this.position.add(this.velocity.clone().multiplyScalar(deltaTime));

        // Update life
        this.life -= deltaTime;

        // ZEN MODE: Particles persist WAY longer
        if (particleParams.zenMode) {
            // Allow ghost phase that's 25% of original lifespan
            const ghostPhase = particleParams.ghostDuration;
            return this.life > -ghostPhase;
        } else {
            return this.life > 0;
        }
    }

    getLifeRatio() {
        return this.life / this.maxLife;
    }

    getAlpha() {
        const lifeRatio = this.getLifeRatio();
        
        if (!particleParams.zenMode) {
            // Normal mode: linear fade
            return particleParams.opacity * Math.max(0, lifeRatio);
        }
        
        // ZEN MODE with proper ghost phase
        if (lifeRatio > 0.2) {
            // First 80% of life: full brightness
            return particleParams.opacity;
        } else if (lifeRatio > 0) {
            // Last 20% of life: gentle fade
            const fadeRatio = lifeRatio / 0.2;
            return particleParams.opacity * fadeRatio;
        } else {
            // GHOST PHASE: ultra-slow fade
            const ghostRatio = Math.max(0, 1 + (this.life / particleParams.ghostDuration));
            // Much slower curve - cubic root for even gentler fade
            const easedGhost = Math.pow(ghostRatio, 0.33);
            return particleParams.opacity * 0.6 * easedGhost; // 60% opacity in ghost
        }
    }
}

class ParticleSystem {
    constructor() {
        this.particles = [];
        this.geometry = new THREE.BufferGeometry();
        this.positions = new Float32Array(particleParams.count * 3);
        this.colors = new Float32Array(particleParams.count * 3);
        this.sizes = new Float32Array(particleParams.count);
        this.alphas = new Float32Array(particleParams.count);

        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
        this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));
        this.geometry.setAttribute('alpha', new THREE.BufferAttribute(this.alphas, 1));

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                pointTexture: { value: this.createParticleTexture() }
            },
            vertexShader: `
                attribute float size;
                attribute float alpha;
                varying float vAlpha;
                varying vec3 vColor;

                void main() {
                    vAlpha = alpha;
                    vColor = color;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = size * (150.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform sampler2D pointTexture;
                varying float vAlpha;
                varying vec3 vColor;

                void main() {
                    gl_FragColor = vec4(vColor, vAlpha);
                    gl_FragColor = gl_FragColor * texture2D(pointTexture, gl_PointCoord);
                }
            `,
            blending: THREE.AdditiveBlending,
            depthTest: false,
            transparent: true,
            vertexColors: true
        });

        this.points = new THREE.Points(this.geometry, this.material);
        scene.add(this.points);

        this.emissionTimer = 0;
    }

    createParticleTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const context = canvas.getContext('2d');

        const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.5, 'rgba(255,255,255,0.5)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');

        context.fillStyle = gradient;
        context.fillRect(0, 0, 64, 64);

        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }

    emit(count, position = new THREE.Vector3(0, 0, 0)) {
        for (let i = 0; i < count; i++) {
            if (this.particles.length >= particleParams.count) break;

            const angle = (Math.random() - 0.5) * particleParams.spreadAngle * Math.PI / 180;
            const elevation = (Math.random() - 0.5) * particleParams.spreadAngle * Math.PI / 180;

            const velocity = new THREE.Vector3(
                Math.sin(angle) * Math.cos(elevation),
                Math.sin(elevation),
                Math.cos(angle) * Math.cos(elevation)
            ).multiplyScalar(particleParams.initialSpeed * (0.5 + Math.random() * 0.5));

            this.particles.push(new Particle(position, velocity));
        }
    }

    update(deltaTime) {
        // Update existing particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            if (!this.particles[i].update(deltaTime)) {
                this.particles.splice(i, 1);
            }
        }

        // Update geometry
        this.updateGeometry();
    }

    updateGeometry() {
        const positions = this.geometry.attributes.position.array;
        const colors = this.geometry.attributes.color.array;
        const sizes = this.geometry.attributes.size.array;
        const alphas = this.geometry.attributes.alpha.array;

        for (let i = 0; i < particleParams.count; i++) {
            if (i < this.particles.length) {
                const particle = this.particles[i];
                const lifeRatio = particle.getLifeRatio();

                positions[i * 3] = particle.position.x;
                positions[i * 3 + 1] = particle.position.y;
                positions[i * 3 + 2] = particle.position.z;

                // Color interpolation - only start changing color in last 30% of life
                let colorLerp = 0;
                if (lifeRatio < 0.3) {
                    colorLerp = 1 - (lifeRatio / 0.3);
                }
                const color = particleParams.startColor.clone().lerp(particleParams.endColor, colorLerp);
                colors[i * 3] = color.r;
                colors[i * 3 + 1] = color.g;
                colors[i * 3 + 2] = color.b;

                // Size stays consistent until ghost phase
                const sizeMultiplier = Math.max(0.3, Math.abs(lifeRatio) > 0 ? 1 : (1 + lifeRatio / particleParams.ghostDuration));
                sizes[i] = particle.size * sizeMultiplier;
                alphas[i] = particle.getAlpha();
            } else {
                // Hide unused particles
                positions[i * 3] = 0;
                positions[i * 3 + 1] = 0;
                positions[i * 3 + 2] = 0;
                alphas[i] = 0;
                sizes[i] = 0;
            }
        }

        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.color.needsUpdate = true;
        this.geometry.attributes.size.needsUpdate = true;
        this.geometry.attributes.alpha.needsUpdate = true;
    }

    updateBlendMode() {
        const blendModes = {
            'normal': THREE.NormalBlending,
            'additive': THREE.AdditiveBlending,
            'multiply': THREE.MultiplyBlending,
            'subtractive': THREE.SubtractiveBlending
        };
        this.material.blending = blendModes[particleParams.blendMode];
    }

    gentleClear() {
        // Set clearing mode flag
        particleParams.clearingMode = true;
        
        // Reset after 6 seconds (time for all particles to fade)
        setTimeout(() => {
            particleParams.clearingMode = false;
        }, 6000);
    }
}

async function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 15);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.getElementById('container').appendChild(renderer.domElement);

    particleSystem = new ParticleSystem();
    scene.add(createGradientSphere());

    setupControls();
    animate();
    setupMouseInteraction();

    document.getElementById('startButton').addEventListener('click', async () => {
        await Tone.start();
        console.log('AudioContext started');
        
        document.getElementById('disableAudioButton').addEventListener('click', async () => {
            if (isAudioEnabled) {
                if (Tone.context.state !== 'closed') {
                    await Tone.context.dispose();
                    console.log('AudioContext disposed');
                }
                isAudioEnabled = false;
                document.getElementById('disableAudioButton').textContent = 'Enable Audio';
            }
        });

        reverb = new Tone.Reverb({
            decay: 5,
            preDelay: 0.1
        }).toDestination();

        feedbackDelay = new Tone.FeedbackDelay({
            delayTime: "4n",
            feedback: 0.6,
            wet: 0.4
        });

        pingPongDelay = new Tone.PingPongDelay({
            delayTime: "8n",
            feedback: 0.5,
            wet: 0.3
        });

        feedbackDelay.connect(pingPongDelay);
        pingPongDelay.connect(reverb);
        distortion = new Tone.Distortion(0.4);

        synth = new Tone.Synth({
            oscillator: { type: "sine" },
            envelope: { attack: 0.005, decay: 0.1, sustain: 0.05, release: 0.5 }
        }).chain(distortion, feedbackDelay);
        try { synth.volume.value = -3.1; } catch (e) {}

        bassSynth = new Tone.Synth({
            oscillator: { type: "square" },
            envelope: { attack: 0.001, decay: 0.2, sustain: 0.01, release: 0.3 }
        }).chain(distortion, feedbackDelay);
        try { bassSynth.volume.value = -3.1; } catch (e) {}

        guitarSynth = new Tone.MonoSynth({}).chain(distortion, feedbackDelay);

        document.getElementById('startButton').style.display = 'none';
    });
}

function createGradientSphere() {
    const sphereGeometry = new THREE.SphereGeometry(500, 100, 100);
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 128;
    const context = canvas.getContext('2d');

    const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#000000'); 
    gradient.addColorStop(1, '#310342'); 

    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    const gradientTexture = new THREE.CanvasTexture(canvas);
    gradientTexture.needsUpdate = true;

    const sphereMaterial = new THREE.MeshBasicMaterial({
        map: gradientTexture,
        side: THREE.BackSide,
        depthWrite: false
    });

    return new THREE.Mesh(sphereGeometry, sphereMaterial);
}

function setupControls() {
    const controls = document.querySelectorAll('input, select');

    controls.forEach(control => {
        control.addEventListener('input', (e) => {
            updateParameter(e.target.id, e.target.value, e.target.type);
        });

        if (control.type === 'range') {
            updateValueDisplay(control.id, control.value);
        }
    });

    document.querySelectorAll('.control-group-header').forEach(header => {
        header.addEventListener('click', () => {
            const body = header.nextElementSibling;
            header.classList.toggle('collapsed');
            if (header.classList.contains('collapsed')) {
                body.style.maxHeight = '0';
            } else {
                body.style.maxHeight = body.scrollHeight + 'px';
            }
        });
    });

    const toggleBtn = document.querySelector('.toggle-controls');
    if (toggleBtn) {
        let hoverRestoreTimer = null;
        toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            try { toggleControls(); } catch (err) {}
            toggleBtn.classList.add('dimmed');
        });

        toggleBtn.addEventListener('mouseenter', () => {
            if (toggleBtn.classList.contains('dimmed')) {
                hoverRestoreTimer = setTimeout(() => {
                    toggleBtn.classList.remove('dimmed');
                }, 1000);
            }
        });

        toggleBtn.addEventListener('mouseleave', () => {
            if (hoverRestoreTimer) { clearTimeout(hoverRestoreTimer); hoverRestoreTimer = null; }
        });

        toggleBtn.addEventListener('touchstart', (e) => {
            try { toggleControls(); } catch (err) {}
            toggleBtn.classList.add('dimmed');
        }, { passive: true });
        
        toggleBtn.addEventListener('touchend', () => {
            setTimeout(() => toggleBtn.classList.remove('dimmed'), 1000);
        });
    }
}

function updateParameter(id, value, type) {
    const numValue = type === 'color' ? value : parseFloat(value);

    switch(id) {
        case 'particleCount':
            particleParams.count = parseInt(value);
            updateValueDisplay(id, value);
            break;
        case 'emissionRate':
            particleParams.emissionRate = numValue;
            updateValueDisplay(id, value + '/s');
            break;
        case 'gravity':
            particleParams.gravity = numValue;
            updateValueDisplay(id, value);
            break;
        case 'initialSpeed':
            particleParams.initialSpeed = numValue;
            updateValueDisplay(id, value);
            break;
        case 'spreadAngle':
            particleParams.spreadAngle = numValue;
            updateValueDisplay(id, value + '°');
            break;
        case 'airResistance':
            particleParams.airResistance = numValue;
            updateValueDisplay(id, value);
            break;
        case 'startColor':
            particleParams.startColor = new THREE.Color(value);
            break;
        case 'endColor':
            particleParams.endColor = new THREE.Color(value);
            break;
        case 'particleSize':
            particleParams.size = numValue;
            updateValueDisplay(id, value);
            break;
        case 'sizeVariation':
            particleParams.sizeVariation = numValue;
            updateValueDisplay(id, value);
            break;
        case 'opacity':
            particleParams.opacity = numValue;
            updateValueDisplay(id, value);
            break;
        case 'lifespan':
            particleParams.lifespan = numValue;
            updateValueDisplay(id, value + 's');
            break;
        case 'turbulence':
            particleParams.turbulence = numValue;
            updateValueDisplay(id, value);
            break;
        case 'particleShape':
            particleParams.shape = value;
            break;
        case 'blendMode':
            particleParams.blendMode = value;
            particleSystem.updateBlendMode();
            break;
        case 'windX':
            particleParams.windX = numValue;
            updateValueDisplay(id, value);
            break;
        case 'windY':
            particleParams.windY = numValue;
            updateValueDisplay(id, value);
            break;
        case 'windZ':
            particleParams.windZ = numValue;
            updateValueDisplay(id, value);
            break;
        case 'burstSize':
            particleParams.burstSize = parseInt(value);
            updateValueDisplay(id, value);
            break;
        case 'trailDensity':
            particleParams.trailDensity = parseInt(value);
            updateValueDisplay(id, value);
            break;
        case 'zenMode':
            particleParams.zenMode = value === 'true';
            break;
        case 'ghostDuration':
            particleParams.ghostDuration = numValue;
            updateValueDisplay(id, value + 's');
            break;
    }
}

function updateValueDisplay(id, value) {
    const display = document.getElementById(id + 'Value');
    if (display) {
        display.textContent = value;
    }
}

function setupMouseInteraction() {
    let isDragging = false;
    let lastEmissionTime = 0;
    let previousMouseX = 0, previousMouseY = 0;
    let cameraRotationX = 0, cameraRotationY = 0;
    let touchStartTime = 0;
    let lastNotePlaybackTime = 0;

    function getPositionNoteFromClient(clientX, clientY) {
        const normalizedX = Math.max(0, Math.min(1, clientX / window.innerWidth));
        const normalizedY = Math.max(0, Math.min(1, clientY / window.innerHeight));

        const minorScaleNotes = [
            'A2','B2','C3','D3','E3','F3','G3',
            'A3','B3','C4','D4','E4','F4','G4',
            'A4','B4','C5','D5','E5','F5','G5',
            'A5','B5','C6','D6','E6'
        ];

        const baseIndex = Math.floor(normalizedX * 16);
        const yVariation = Math.floor(normalizedY * 4);
        const finalIndex = Math.min(baseIndex + yVariation * 4, minorScaleNotes.length - 1);
        return minorScaleNotes[finalIndex] || 'A3';
    }

    function playNoteStartAt(clientX, clientY) {
        if (!isAudioEnabled || !synth) return;
        const note = getPositionNoteFromClient(clientX, clientY);
        if (currentPlayingNote !== note) {
            if (currentPlayingNote && synth) {
                try { synth.triggerRelease(); } catch (e) {}
            }
            try { synth.triggerAttack(note); } catch (e) {}
            currentPlayingNote = note;
        }
        if (releaseTimeout) { clearTimeout(releaseTimeout); releaseTimeout = null; }
    }

    function stopPlayingSoon() {
        if (releaseTimeout) clearTimeout(releaseTimeout);
        releaseTimeout = setTimeout(() => {
            if (currentPlayingNote && synth) {
                try { synth.triggerRelease(); } catch (e) {}
            }
            currentPlayingNote = null;
        }, 250);
    }

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    function getWorldPosition(clientX, clientY) {
        mouse.x = (clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        const intersectPoint = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, intersectPoint);

        return intersectPoint;
    }

    function emitAtPosition(worldPos) {
        const currentTime = Date.now();
        if (currentTime - lastEmissionTime > 50) {
            const burstCount = Math.min(particleParams.trailDensity, particleParams.emissionRate);
            if (particleSystem) {
                particleSystem.emit(burstCount, worldPos);
            }
            lastEmissionTime = currentTime;
        }
    }

    document.addEventListener('mousemove', (event) => {
        if (!event.target.closest('#controls') && !event.target.closest('.toggle-controls') && !event.target.closest('#startButton')) {
            if (isDragging) {
                const worldPos = getWorldPosition(event.clientX, event.clientY);
                emitAtPosition(worldPos);

                if (Date.now() - lastNotePlaybackTime > 100) {
                    if (synth) {
                        playNoteStartAt(event.clientX, event.clientY);
                    }
                    lastNotePlaybackTime = Date.now();
                }
            }
        }
    });

    document.addEventListener('mousedown', (event) => {
        if (!event.target.closest('#controls') && !event.target.closest('.toggle-controls') && !event.target.closest('#startButton')) {
            isDragging = true;
            previousMouseX = event.clientX;
            previousMouseY = event.clientY;
            touchStartTime = Date.now();
            event.preventDefault();
            playNoteStartAt(previousMouseX, previousMouseY);
        }
    });

    document.addEventListener('mouseup', (event) => {
        if (isDragging) {
            isDragging = false;
            const duration = Date.now() - touchStartTime;
            const deltaX = event.clientX - previousMouseX;
            const deltaY = event.clientY - previousMouseY;
            const moveDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

            if (duration < 300 && moveDistance < 5) {
                const worldPos = getWorldPosition(previousMouseX, previousMouseY);
                if (particleSystem) {
                    particleSystem.emit(particleParams.burstSize, worldPos);
                }
                if (synth) {
                   playChord();
                }
            }

            stopPlayingSoon();
        }
        lastNotePlaybackTime = 0;
    });

    document.addEventListener('touchstart', (event) => {
        if (!event.target.closest('#controls') && !event.target.closest('.toggle-controls') && !event.target.closest('#startButton')) {
            if (event.touches.length === 1) {
                isDragging = true;
                previousMouseX = event.touches[0].clientX;
                previousMouseY = event.touches[0].clientY;
                touchStartTime = Date.now();
                event.preventDefault();
            } else if (event.touches.length > 1) {
                previousMouseX = event.touches[0].clientX;
                previousMouseY = event.touches[0].clientY;
                event.preventDefault();
            }
        }
    }, { passive: false });

    document.addEventListener('touchmove', (event) => {
        if (!event.target.closest('#controls') && !event.target.closest('.toggle-controls') && !event.target.closest('#startButton')) {
            if (isDragging && event.touches.length === 1) {
                const touch = event.touches[0];
                const worldPos = getWorldPosition(touch.clientX, touch.clientY);
                emitAtPosition(worldPos);

                if (Date.now() - lastNotePlaybackTime > 100) {
                    if (synth) {
                        playNoteStartAt(touch.clientX, touch.clientY);
                    }
                    lastNotePlaybackTime = Date.now();
                }

                previousMouseX = touch.clientX;
                previousMouseY = touch.clientY;
                event.preventDefault();
            } else if (event.touches.length > 1) {
                const touch1 = event.touches[0];
                const deltaX = touch1.clientX - previousMouseX;
                const deltaY = touch1.clientY - previousMouseY;

                cameraRotationY += deltaX * 0.005;
                cameraRotationX += deltaY * 0.005;
                cameraRotationX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, cameraRotationX));

                previousMouseX = touch1.clientX;
                previousMouseY = touch1.clientY;
                event.preventDefault();
            }
        }
    }, { passive: false });

    document.addEventListener('touchend', (event) => {
        if (!event.target.closest('#controls') && !event.target.closest('.toggle-controls') && !event.target.closest('#startButton')) {
            if (isDragging && event.touches.length === 0) {
                isDragging = false;
                const duration = Date.now() - touchStartTime;
                const touch = event.changedTouches[0];
                const deltaX = touch.clientX - previousMouseX;
                const deltaY = touch.clientY - previousMouseY;
                const moveDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

                if (duration < 300 && moveDistance < 5) {
                    const worldPos = getWorldPosition(previousMouseX, previousMouseY);
                    if (particleSystem) {
                        particleSystem.emit(particleParams.burstSize, worldPos);
                    }
                    if (synth) {
                        playChord();
                    }
                }
                stopPlayingSoon();
            }
        }
    });

    document.addEventListener('mouseup', () => stopPlayingSoon());
    document.addEventListener('touchend', () => stopPlayingSoon(), { passive: true });

    function updateCamera() {
        const radius = 15;
        camera.position.x = radius * Math.sin(cameraRotationY) * Math.cos(cameraRotationX);
        camera.position.y = radius * Math.sin(cameraRotationX);
        camera.position.z = radius * Math.cos(cameraRotationY) * Math.cos(cameraRotationX);
        camera.lookAt(0, 0, 0);
    }

    const originalAnimate = animate;
    animate = function() {
        updateCamera();
        originalAnimate();
    };

    function playChord() {
        const noteIndex = Math.floor(Math.random() * synthWaveNotes.length);
        const root = synthWaveNotes[noteIndex];
        const chord = Tone.Frequency(root).harmonize([0, 4, 7]);
        if (synth) {
            synth.triggerAttackRelease(chord, "0.5");
        }
    }
}

let lastTime = 0;
let frameCount = 0;
let fpsTimer = 0;

function animate() {
    if (!isAnimating) return;

    animationId = requestAnimationFrame(animate);

    const currentTime = performance.now();
    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    if (particleSystem) {
        particleSystem.update(deltaTime);
    }

    frameCount++;
    fpsTimer += deltaTime;

    if (fpsTimer >= 1) {
        document.getElementById('fps').textContent = Math.round(frameCount / fpsTimer);
        document.getElementById('activeParticles').textContent = particleSystem ? particleSystem.particles.length : 0;
        frameCount = 0;
        fpsTimer = 0;
    }

    renderer.render(scene, camera);
}

function toggleControls() {
    const controls = document.getElementById('controls');
    controlsVisible = !controlsVisible;

    if (controlsVisible) {
        controls.classList.remove('hidden');
    } else {
        controls.classList.add('hidden');
    }
    const toggleBtn = document.querySelector('.toggle-controls');
    if (toggleBtn) {
        try { toggleBtn.setAttribute('aria-expanded', controlsVisible ? 'true' : 'false'); } catch (e) {}
    }
}

function toggleAnimation() {
    isAnimating = !isAnimating;
    const button = document.getElementById('animationButton');

    if (isAnimating) {
        button.textContent = 'Pause';
        lastTime = performance.now();
        animate();
    } else {
        button.textContent = 'Play';
        if (animationId) {
            cancelAnimationFrame(animationId);
        }
    }
}

function gentleClear() {
    if (particleSystem) {
        particleSystem.gentleClear();
    }
}

function resetToDefaults() {
    document.getElementById('particleCount').value = 30000;
    document.getElementById('emissionRate').value = 69;
    document.getElementById('gravity').value = -0.3;
    document.getElementById('initialSpeed').value = 2;
    document.getElementById('spreadAngle').value = 133;
    document.getElementById('airResistance').value = 0.02;
    document.getElementById('startColor').value = '#ffffff';
    document.getElementById('endColor').value = '#ff00cc';
    document.getElementById('particleSize').value = 3.9;
    document.getElementById('sizeVariation').value = 3.5;
    document.getElementById('opacity').value = 0.7;
    document.getElementById('lifespan').value = 120;
    document.getElementById('turbulence').value = 0.5;
    document.getElementById('particleShape').value = 'cube';
    document.getElementById('blendMode').value = 'subtactive';
    document.getElementById('windX').value = -0.3;
    document.getElementById('windY').value = 0.2;
    document.getElementById('windZ').value = 0.1;
    document.getElementById('burstSize').value = 99;
    document.getElementById('trailDensity').value = 33;

    document.querySelectorAll('input, select').forEach(control => {
        control.dispatchEvent(new Event('input'));
    });
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    document.querySelectorAll('.control-group-header:not(.collapsed)').forEach(header => {
        const body = header.nextElementSibling;
        if (body) {
            body.style.maxHeight = body.scrollHeight + 'px';
        }
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
});

window.onload = function() {
    init();

    const notification = document.getElementById('control-notification');
    if (notification) {
        setTimeout(() => {
            notification.style.opacity = '0';
        }, 5000);

        notification.addEventListener('transitionend', () => {
            notification.style.display = 'none';
        });
    }
};