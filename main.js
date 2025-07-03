// Global variables
let scene, camera, renderer, particles, particleSystem, emitter;
let animationId;
let isAnimating = true;
let controlsVisible = true;

let pingPongDelay; // Declare pingPongDelay globally
// Tone.js instruments and effects
let synth, bassSynth, guitarSynth; // Drum kit will be handled differently
let distortion;
let reverb; // Declare reverb globally
let feedbackDelay; // Declare feedbackDelay globally

let synthWaveNotes = [
    "C4", "E4", "G4", "B4", "C5", // C Major chord and scale notes
    "G3", "B3", "D4", "G4", // G Major chord and scale notes
    "A3", "C4", "E4", "A4", // A minor chord and scale notes (can sound a bit more reflective)
    "F3", "A3", "C4", "F4", // F Major chord and scale notes
    "D4", "F4", "A4", "C5", // D minor chord and scale notes
    "E4", "G4", "B4", "D5", // E minor chord and scale notes
    "C4", "G4", "E5", "C5", // More spaced out notes for ambience
    "G3", "D4", "A4", "E5"  // More spaced out notes for ambience



/*synthWaveProgression2 = 
    "C4", "G4", "A4", "F4", // Classic I-V-vi-IV progression, uplifting and familiar
    "Dm4", "Am4", "Em4", "G4" // Adds a bit more melancholy and movement
// This progression is bright and slightly emotional, good for a driving or cruising feel.


/*synthWaveProgression3 = 
    "A3", "E3", "C4", "G3", // A minor feel with a descending bassline, more introspective
    "F3", "C4", "G4", "D4" // Opens up a bit, hinting at a brighter resolution but staying grounded
// This progression has a more reflective and slightly melancholic feel, suitable for nighttime or atmospheric sections.


 /*synthWaveProgression4 = 
    "D4", "A4", "B4", "G4", // A strong starting point, slightly dramatic
    "Em4", "G4", "C5", "A4" // Builds intensity and then resolves with a wider interval
// This progression is more powerful and energetic, good for building tension or a climactic moment.

/*synthWaveProgression5 = 
   "D3", "B2", "A#2", "B2", "D#3", "B2", "A#2", "B2", spooky vibe
    "D3", "B2", "A#2", "B2", "D#3", "B2", "A#2", "B2",
    "D3", "B2", "A#2", "B2", "D#3", "B2", "A#2", "B2",
    "G2", "E3", "D#3", "E3", "G#3", "E3", "D#3", "E3",
    "G2", "E3", "D#3", "E3", "G#3", "E3", "D#3", "E3",
    "G2", "E3", "D#3", "E3", "G#3", "E3", "D#3", "E3",
    "C3", "B2", "E2", "C3", "B2", "E2", "E2", "E5",
    "C3", "B2", "E2", "C3", "B2", "E2", "F2", "E4", "E4", "E4",
    "E4", "C#4", "C4", "C#4", "F4", "C#4", "C4", "C#4",
    "G3", "F3", "E3", "F3", "G#3", "F3", "E3", "F3",
    "C3", "B2", "E2", "C3", "B2", "E2", "E2", "E5",
    "C3", "B2", "E2", "C3", "B2", "E2", "F2", "D3", "D3", "D3", "B" */
];
let currentNoteIndex = 0;



// Particle system parameters
let particleParams = {
    count: 10000,
    emissionRate: 69,
    gravity: -1,
    initialSpeed:3,
    spreadAngle: 133,
    airResistance: 0.1,
    startColor: new THREE.Color(0x00f3ff),
    endColor: new THREE.Color(0xfff300),
    size: 0.5,
    sizeVariation: 3,
    opacity: 0.3,
    lifespan: 9,
    turbulence: 1.3,
    shape: 'cube',
    blendMode: 'subtractive',
    windX: -1.5,
    windY: 1.5,
    windZ: 1,
    burstSize: 99,
    trailDensity: 33
};
// Particle class
class Particle {
    constructor(position, velocity) {
        this.position = position.clone();
        this.velocity = velocity.clone();
        this.life = particleParams.lifespan;
        this.maxLife = particleParams.lifespan;
        this.size = particleParams.size + (Math.random() - 0.5) * particleParams.sizeVariation;
        this.turbulenceOffset = Math.random() * 1000;
    }

    update(deltaTime) {
        // Apply gravity
        this.velocity.y += particleParams.gravity * deltaTime;

        // Apply air resistance
        this.velocity.multiplyScalar(1 - particleParams.airResistance * deltaTime);

        // Apply wind
        this.velocity.x += particleParams.windX * deltaTime;
        this.velocity.y += particleParams.windY * deltaTime;
        this.velocity.z += particleParams.windZ * deltaTime;

        // Apply turbulence
        const time = Date.now() * 0.001;
        const turbulence = particleParams.turbulence;
        this.velocity.x += Math.sin(time + this.turbulenceOffset) * turbulence * deltaTime;
        this.velocity.z += Math.cos(time + this.turbulenceOffset * 1.1) * turbulence * deltaTime;

        // Update position
        this.position.add(this.velocity.clone().multiplyScalar(deltaTime));

        // Update life
        this.life -= deltaTime;

        return this.life > 0;
    }

    getLifeRatio() {
        return this.life / this.maxLife;
    }
}

// Particle system class
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
                    gl_PointSize = size * (300.0 / -mvPosition.z);
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
        // Emit new particles
        this.emissionTimer += deltaTime;
        const emissionInterval = 1 / particleParams.emissionRate;

        while (this.emissionTimer >= emissionInterval && this.particles.length < particleParams.count) {
            this.emit(1);
            this.emissionTimer -= emissionInterval;
        }

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

                // Interpolate color
                const color = particleParams.startColor.clone().lerp(particleParams.endColor, 1 - lifeRatio);
                colors[i * 3] = color.r;
                colors[i * 3 + 1] = color.g;
                colors[i * 3 + 2] = color.b;

                sizes[i] = particle.size * lifeRatio;
                alphas[i] = particleParams.opacity * lifeRatio;
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
}
// Initialize Three.js scene and setup event listener for start button
async function init() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000011);

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 15);
    camera.lookAt(0, 0, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.getElementById('container').appendChild(renderer.domElement);

    // Particle system
    particleSystem = new ParticleSystem();

    // Controls
    setupControls();

    // Start animation (can start before audio context)
    animate();

    // Mouse interaction (can be set up before audio context, but particle emission will be silent)
    setupMouseInteraction();

    // Add event listener to start button to initialize Tone.js and related audio
    document.getElementById('startButton').addEventListener('click', async () => {
        // Initialize Tone.js instruments and effects
        await Tone.start(); // Start audio context here after user click
        console.log('AudioContext started'); // Optional: log to confirm

        // Create Effects
        reverb = new Tone.Reverb({
            decay: 5, // Longer decay for a larger space
            preDelay: 0.1 // Small pre-delay to separate the direct signal
        }).toDestination(); // Connect the reverb directly to the main output

        feedbackDelay = new Tone.FeedbackDelay({
            delayTime: "4n", // Quarter note delay
            feedback: 0.6,   // Moderate feedback
            wet: 0.4         // Mix
        });

        pingPongDelay = new Tone.PingPongDelay({
            delayTime: "8n", // Eighth note delay
            feedback: 0.5,   // Moderate feedback
            wet: 0.3         // Mix
        });

        // Connect effects in a chain: FeedbackDelay -> PingPongDelay -> Reverb -> Destination
        feedbackDelay.connect(pingPongDelay);
        pingPongDelay.connect(reverb);


        distortion = new Tone.Distortion(0.4); // Distortion effect - can connect this before or after delays

        // Connect synths to the beginning of the effects chain
        synth = new Tone.Synth({
            oscillator: { type: "sine" },
            envelope: { attack: 0.005, decay: 0.1, sustain: 0.05, release: 0.5 }
        }).chain(distortion, feedbackDelay); // Chain synth through distortion and then delays

        bassSynth = new Tone.Synth({
            oscillator: { type: "square" },
            envelope: { attack: 0.001, decay: 0.2, sustain: 0.01, release: 0.3 }
        }).chain(distortion, feedbackDelay); // Chain bass synth through distortion and then delays

        // If you have guitarSynth and want it affected:
        guitarSynth = new Tone.MonoSynth({
            // ... guitarSynth parameters
        }).chain(distortion, feedbackDelay); // Chain guitarSynth through distortion and then delays

        // Hide the start button after it's clicked
        document.getElementById('startButton').style.display = 'none';
    });
}


function setupControls() {
    const controls = document.querySelectorAll('input, select');

    controls.forEach(control => {
        control.addEventListener('input', (e) => {
            updateParameter(e.target.id, e.target.value, e.target.type);
        });

        // Initialize value displays
        if (control.type === 'range') {
            updateValueDisplay(control.id, control.value);
        }
    });

    // Setup collapsible headers
    document.querySelectorAll('.control-group-header').forEach(header => {
        header.addEventListener('click', () => {
            const body = header.nextElementSibling;
            header.classList.toggle('collapsed');
            if (header.classList.contains('collapsed')) {
                body.style.maxHeight = '0';
            } else {
                // Calculate height needed for content
                body.style.maxHeight = body.scrollHeight + 'px';
            }
        });
    });
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
    }
}

function updateValueDisplay(id, value) {
    const display = document.getElementById(id + 'Value');
    if (display) {
        display.textContent = value;
    }
}
function playNextSynthWaveNote() {
    const note = synthWaveNotes[currentNoteIndex];
    const duration = "16n"; // Shorter duration for drag trail notes
    // Check if synths are initialized before playing
    if (synth && bassSynth) {
        synth.triggerAttackRelease(note, duration);
        bassSynth.triggerAttackRelease(note, duration); // Play bass note as well
    }


    currentNoteIndex = (currentNoteIndex + 1) % synthWaveNotes.length;
}

function setupMouseInteraction() {
    let isDragging = false;
    let lastEmissionTime = 0;
    let previousMouseX = 0, previousMouseY = 0;
    let cameraRotationX = 0, cameraRotationY = 0;
    let touchStartTime = 0;
    // Variables for throttling note playback during drag
    let lastNotePlaybackTime = 0;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // Convert screen coordinates to 3D world position
    function getWorldPosition(clientX, clientY) {
        mouse.x = (clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);

        // Create an invisible plane to intersect with
        const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        const intersectPoint = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, intersectPoint);

        return intersectPoint;
    }

    // Emit particles at specific position
    function emitAtPosition(worldPos) {
        const currentTime = Date.now();
        // Throttle emissions to avoid overwhelming the system
        if (currentTime - lastEmissionTime > 50) {
            const burstCount = Math.min(particleParams.trailDensity, particleParams.emissionRate);
            if (particleSystem) {
                particleSystem.emit(burstCount, worldPos);
            }
            lastEmissionTime = currentTime;
        }
    }

    // Mouse events
    document.addEventListener('mousemove', (event) => {
        if (!event.target.closest('#controls') && !event.target.closest('.toggle-controls') && !event.target.closest('#startButton')) {
            if (isDragging) {
                const worldPos = getWorldPosition(event.clientX, event.clientY);
                emitAtPosition(worldPos);

                // Trigger note playback during drag at a set interval
                if (Date.now() - lastNotePlaybackTime > 150) { // Adjust interval (ms) as needed
                     // Check if synths are initialized before playing
                    if (synth && bassSynth) {
                        playNextSynthWaveNote();
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
            touchStartTime = Date.now(); // Use touchStartTime for mouse clicks too
            event.preventDefault(); // Prevent default to avoid dragging issues
        }
    });

    document.addEventListener('mouseup', (event) => { // Added event parameter
        if (isDragging) {
            isDragging = false;
            // Detect click/tap based on duration and movement
            const duration = Date.now() - touchStartTime;
            // Calculate approximate distance moved (simple check)
            const deltaX = event.clientX - previousMouseX;
            const deltaY = event.clientY - previousMouseY;
            const moveDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

            // If it's a short duration and minimal movement, treat as a click/tap
            if (duration < 300 && moveDistance < 5) { // Adjust threshold as needed
                const worldPos = getWorldPosition(previousMouseX, previousMouseY);
                if (particleSystem) {
                    particleSystem.emit(particleParams.burstSize, worldPos);
                }
                // Check if synths are initialized before playing
                if (synth) {
                   playChord(); // Play a chord on click/tap
                }
            }
        }
        // Reset drag specific variables on mouseup/touchend
        lastNotePlaybackTime = 0; // Reset note throttle
    });

    // Touch events for mobile and touchpads
    document.addEventListener('touchstart', (event) => {
        if (!event.target.closest('#controls') && !event.target.closest('.toggle-controls') && !event.target.closest('#startButton')) {
            if (event.touches.length === 1) { // Single touch for drag or tap
                isDragging = true;
                previousMouseX = event.touches[0].clientX;
                previousMouseY = event.touches[0].clientY;
                touchStartTime = Date.now(); // Record touch start time for tap detection
                 event.preventDefault(); // Prevent default behavior for single touch
            } else if (event.touches.length > 1) { // Multi-touch for camera control
                 // Store starting positions of touches for calculating movement
                previousMouseX = event.touches[0].clientX;
                previousMouseY = event.touches[0].clientY;
                 // Prevent default scrolling/zooming
                 event.preventDefault();
            }
        }
    }, { passive: false });

    document.addEventListener('touchmove', (event) => {
        if (!event.target.closest('#controls') && !event.target.closest('.toggle-controls') && !event.target.closest('#startButton')) {
            if (isDragging && event.touches.length === 1) { // Single touch drag for particle trail
                const touch = event.touches[0];
                const worldPos = getWorldPosition(touch.clientX, touch.clientY);
                emitAtPosition(worldPos);

                // Trigger note playback during drag at a set interval
                if (Date.now() - lastNotePlaybackTime > 150) { // Adjust interval (ms) as needed
                    // Check if synths are initialized before playing
                    if (synth && bassSynth) {
                        playNextSynthWaveNote();
                    }
                    lastNotePlaybackTime = Date.now();
                }

                // Update previous touch positions for the next frame
                previousMouseX = touch.clientX;
                previousMouseY = touch.clientY;

                event.preventDefault();
            } else if (event.touches.length > 1) { // Two-finger drag for camera control
                 const touch1 = event.touches[0];
                 // Use the movement of the first touch relative to its previous position
                 const deltaX = touch1.clientX - previousMouseX;
                 const deltaY = touch1.clientY - previousMouseY;

                 cameraRotationY += deltaX * 0.005;
                 cameraRotationX += deltaY * 0.005;

                 // Clamp vertical rotation to prevent flipping
                 cameraRotationX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, cameraRotationX));

                 // Update previous touch positions for the next frame
                 previousMouseX = touch1.clientX;
                 previousMouseY = touch1.clientY;

                 event.preventDefault(); // Prevent default scrolling/zooming
            }
        }
    }, { passive: false });

    document.addEventListener('touchend', (event) => {
        if (!event.target.closest('#controls') && !event.target.closest('.toggle-controls') && !event.target.closest('#startButton')) {
             if (isDragging && event.touches.length === 0) { // Single touch ended
                isDragging = false;
                // Detect tap based on duration and movement
                const duration = Date.now() - touchStartTime;
                // Calculate approximate distance moved (simple check)
                // Need to use the last touch position captured in touchmove
                const touch = event.changedTouches[0];
                const deltaX = touch.clientX - previousMouseX;
                const deltaY = touch.clientY - previousMouseY;
                const moveDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

                // If it's a short duration and minimal movement, treat as a click/tap
                if (duration < 300 && moveDistance < 5) { // Adjust threshold as needed
                     const worldPos = getWorldPosition(previousMouseX, previousMouseY);
                     if (particleSystem) {
                        particleSystem.emit(particleParams.burstSize, worldPos);
                    }
                    // Check if synths are initialized before playing
                    if (synth) {
                        playChord(); // Play a chord on click/tap
                    }
                }
            }
        }
    });

    // Smooth camera movement (This function remains largely the same)
    function updateCamera() {
        const radius = 15; // Maintain a constant distance
        camera.position.x = radius * Math.sin(cameraRotationY) * Math.cos(cameraRotationX);
        camera.position.y = radius * Math.sin(cameraRotationX);
        camera.position.z = radius * Math.cos(cameraRotationY) * Math.cos(cameraRotationX);
        camera.lookAt(0, 0, 0);
    }

    // Add to animation loop (This part should already be there, ensure updateCamera is called)
    const originalAnimate = animate;
    animate = function() {
        updateCamera();
        originalAnimate();
    };

    function playChord() {
        const noteIndex = Math.floor(Math.random() * synthWaveNotes.length);
        const root = synthWaveNotes[noteIndex];
        const chord = Tone.Frequency(root).harmonize([0, 4, 7]); // Simple major triad
        // Check if synth is initialized before playing
        if (synth) {
            synth.triggerAttackRelease(chord, "0.5");
        }
    }
}


// Animation loop
let lastTime = 0;
let frameCount = 0;
let fpsTimer = 0;

function animate() {
    if (!isAnimating) return;

    animationId = requestAnimationFrame(animate);

    const currentTime = performance.now();
    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    // Update particle system
    if (particleSystem) {
        particleSystem.update(deltaTime);
    }

    // Update stats
    frameCount++;
    fpsTimer += deltaTime;

    if (fpsTimer >= 1) {
        document.getElementById('fps').textContent = Math.round(frameCount / fpsTimer);
        document.getElementById('activeParticles').textContent = particleSystem ? particleSystem.particles.length : 0;
        frameCount = 0;
        fpsTimer = 0;
    }

    // Render
    renderer.render(scene, camera);
}

// Utility functions
function toggleControls() {
    const controls = document.getElementById('controls');
    controlsVisible = !controlsVisible;

    if (controlsVisible) {
        controls.classList.remove('hidden');
    } else {
        controls.classList.add('hidden');
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

function resetToDefaults() {
    document.getElementById('particleCount').value = 3399;
    document.getElementById('emissionRate').value = 69;
    document.getElementById('gravity').value = -1;
    document.getElementById('initialSpeed').value = 3;
    document.getElementById('spreadAngle').value = 133;
    document.getElementById('airResistance').value = 0.1;
    document.getElementById('startColor').value = '#00f3ff';
    document.getElementById('endColor').value = '#fff300';
    document.getElementById('particleSize').value = 3.9;
    document.getElementById('sizeVariation').value = 3.5;
    document.getElementById('opacity').value = 0.3;
    document.getElementById('lifespan').value = 9;
    document.getElementById('turbulence').value = 1.3;
    document.getElementById('particleShape').value = 'cube';
    document.getElementById('blendMode').value = 'subtactive';
    document.getElementById('windX').value = -1.5;
    document.getElementById('windY').value = 1.5;
    document.getElementById('windZ').value = 1;
    document.getElementById('burstSize').value = 99;
    document.getElementById('trailDensity').value = 33;

    // Trigger updates
    document.querySelectorAll('input, select').forEach(control => {
        control.dispatchEvent(new Event('input'));
    });
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    // Re-calculate max-height for collapsible sections on resize
    document.querySelectorAll('.control-group-header:not(.collapsed)').forEach(header => {
        const body = header.nextElementSibling;
        if (body) {
            body.style.maxHeight = body.scrollHeight + 'px';
        }
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Initialize the app when the window loads
window.onload = function() {
    init(); // Call the init function to set up the scene, etc.

    const notification = document.getElementById('control-notification');
    if (notification) {
        // Fade out after 5 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
        }, 5000); // 5000 milliseconds = 5 seconds

        // Remove the element after the transition
        notification.addEventListener('transitionend', () => {
            notification.style.display = 'none';
        });
    }
};
