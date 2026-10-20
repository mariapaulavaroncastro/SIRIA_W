// ============================================================================
// SIRIA-W: Gemelo Digital 3D & VR Cardboard - Renderizado PBR Fotorrealista
// ============================================================================

let scene, camera, renderer, controls;
let cameraHomePosition, cameraHomeTarget;
let eyeSeparation = 0.064;
let isVRMode = false;
let isTourActive = false;
let tourAngle = 0;

// Elementos Dinámicos de Telemetría
let sueloMaterial, aguaTanqueMesh, bombaLedMesh, lcdCanvasCtx, lcdTexture;
let sprinklerParticles, particleGeo, particlePositions;
let volumetricCones = [];
let particleData = [];
let sprinklerActive = false;
let lastFrameTime = performance.now();
let fpsCounter = 0;

// Coordenadas de los seis microaspersores: dos ramales con tres boquillas.
const microaspersores = [
    { x: -3.2, y: 2.05, z: -0.5 }, { x: -2.3, y: 2.05, z: -0.5 }, { x: -1.4, y: 2.05, z: -0.5 },
    { x: -3.2, y: 2.05, z: 0.5 },  { x: -2.3, y: 2.05, z: 0.5 },  { x: -1.4, y: 2.05, z: 0.5 }
];

function initVRSystem() {
    const container = document.getElementById('vr-canvas-container');
    if (!container) return;

    // 1. Escena e Iluminación de Estudio Industrial
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0e14);
    scene.fog = new THREE.FogExp2(0x0a0e14, 0.025);

    // 2. Cámara Principal
    camera = new THREE.PerspectiveCamera(48, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0.5, 4.2, 7.8);

    // 3. Renderizador WebGL Fotorrealista
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // 4. Controles de Órbita Suaves
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.04;
    controls.maxPolarAngle = Math.PI / 2 - 0.01;
    controls.target.set(0, 1.1, 0);
    cameraHomePosition = camera.position.clone();
    cameraHomeTarget = controls.target.clone();

    // 5. Esquema de Luces Realistas (Luz Solar + Relleno Neón + Ambient)
    const ambientLight = new THREE.AmbientLight(0xdbeafe, 0.65);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.4);
    sunLight.position.set(6, 14, 7);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.bias = -0.0001;
    scene.add(sunLight);

    const rimLight = new THREE.PointLight(0x00e5ff, 0.8, 15);
    rimLight.position.set(-5, 4, -3);
    scene.add(rimLight);

    // 6. Construcción Completa de la Maqueta
    crearBaseYPlacaMaqueta();
    crearZonaCultivoYMicroaspersion();
    crearZonaHidraulicaYBomba();
    crearGabineteControlECU();
    crearLaptopYRouterWifi();
    crearRedGoteoSubterraneo();
    crearEfectosAspersionAvanzada();
    crearEtiquetasCAD3D();

    window.addEventListener('resize', onResizeVR);
    setupGyroscope();

    animateVR();
}

// ----------------------------------------------------------------------------
// Textura Procedural para Partículas de Agua Fotorrealistas
// ----------------------------------------------------------------------------
function crearTexturaGotaAgua() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.3, 'rgba(160, 230, 255, 0.8)');
    grad.addColorStop(0.7, 'rgba(60, 180, 255, 0.2)');
    grad.addColorStop(1, 'rgba(0, 120, 255, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(32, 32, 32, 0, Math.PI * 2);
    ctx.fill();

    return new THREE.CanvasTexture(canvas);
}

// ----------------------------------------------------------------------------
// 1. BASE Y PLATAFORMA DE PRESENTACIÓN
// ----------------------------------------------------------------------------
function crearBaseYPlacaMaqueta() {
    const baseGroup = new THREE.Group();

    // Bloque Principal de Estructura Industrial
    const baseGeo = new THREE.BoxGeometry(8.2, 0.42, 3.8);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x3d4146, roughness: 0.5, metalness: 0.3 });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.set(0, -0.21, 0);
    baseMesh.receiveShadow = true;
    baseGroup.add(baseMesh);

    // Placa Metálica Cepillada con Biseles
    const placaCanvas = document.createElement('canvas');
    placaCanvas.width = 1024;
    placaCanvas.height = 128;
    const pCtx = placaCanvas.getContext('2d');
    pCtx.fillStyle = "#e2e8f0";
    pCtx.fillRect(0, 0, 1024, 128);
    pCtx.strokeStyle = "#0f172a";
    pCtx.lineWidth = 10;
    pCtx.strokeRect(8, 8, 1008, 112);
    pCtx.fillStyle = "#0f172a";
    pCtx.font = "Bold 42px 'DM Sans', sans-serif";
    pCtx.textAlign = "center";
    pCtx.fillText("SIRIA-W | GEMELO DIGITAL AGRÍCOLA", 512, 78);

    const placaTex = new THREE.CanvasTexture(placaCanvas);
    const placaMat = new THREE.MeshStandardMaterial({ map: placaTex, metalness: 0.85, roughness: 0.15 });
    const placaMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 0.48), placaMat);
    placaMesh.position.set(-0.3, -0.21, 1.915);
    baseGroup.add(placaMesh);

    scene.add(baseGroup);
}

// ----------------------------------------------------------------------------
// 2. CULTIVO, ESTRUCTURA PVC Y MICROASPERSORES DE BRONCE
// ----------------------------------------------------------------------------
function crearZonaCultivoYMicroaspersion() {
    const cultivoGroup = new THREE.Group();

    // Contenedor de Tierra
    const cajaGeo = new THREE.BoxGeometry(3.2, 0.5, 3.2);
    const cajaMat = new THREE.MeshStandardMaterial({ color: 0x1f242d, roughness: 0.7 });
    const cajaMesh = new THREE.Mesh(cajaGeo, cajaMat);
    cajaMesh.position.set(-2.3, 0.25, 0);
    cajaMesh.receiveShadow = true;
    cultivoGroup.add(cajaMesh);

    // Tierra de Suelo Orgánico
    const sueloGeo = new THREE.BoxGeometry(3.1, 0.1, 3.1);
    sueloMaterial = new THREE.MeshStandardMaterial({ color: 0x3d271d, roughness: 0.95 });
    const sueloMesh = new THREE.Mesh(sueloGeo, sueloMaterial);
    sueloMesh.position.set(-2.3, 0.48, 0);
    sueloMesh.receiveShadow = true;
    cultivoGroup.add(sueloMesh);

    // Hileras de Cultivo Sembrado
    for (let x = -3.6; x <= -1.0; x += 0.45) {
        for (let z = -1.3; z <= 1.3; z += 0.4) {
            const planta = new THREE.Group();
            const stem = new THREE.Mesh(
                new THREE.CylinderGeometry(0.012, 0.02, 0.16, 8),
                new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.4 })
            );
            stem.position.y = 0.08;
            planta.add(stem);

            for (let i = 0; i < 4; i++) {
                const hoja = new THREE.Mesh(
                    new THREE.SphereGeometry(0.065, 8, 8),
                    new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.3 })
                );
                hoja.scale.set(1.7, 0.18, 0.75);
                hoja.position.set(0, 0.13, 0);
                hoja.rotation.y = (Math.PI / 2) * i;
                hoja.rotation.z = 0.28;
                planta.add(hoja);
            }
            planta.position.set(x + (Math.random() * 0.04), 0.53, z + (Math.random() * 0.04));
            cultivoGroup.add(planta);
        }
    }

    // PVC negro mate con un brillo fino en los cantos.
    const pvcMat = new THREE.MeshStandardMaterial({ color: 0x101312, roughness: 0.34, metalness: 0.12 });
    
    // Soportes verticales
    [[-3.8, 1.3, -1.5], [-3.8, 1.3, 1.5], [-0.8, 1.3, -1.5], [-0.8, 1.3, 1.5]].forEach(([x, y, z]) => {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 16), pvcMat);
        col.position.set(x, y, z);
        col.castShadow = true;
        cultivoGroup.add(col);
    });

    // Cuadro superior y flautas
    const tubos = [
        { geo: new THREE.CylinderGeometry(0.04, 0.04, 3.0, 16), pos: [-2.3, 2.1, -1.5], rot: [0, 0, Math.PI / 2] },
        { geo: new THREE.CylinderGeometry(0.04, 0.04, 3.0, 16), pos: [-2.3, 2.1, 1.5], rot: [0, 0, Math.PI / 2] },
        { geo: new THREE.CylinderGeometry(0.04, 0.04, 3.0, 16), pos: [-3.8, 2.1, 0], rot: [Math.PI / 2, 0, 0] },
        { geo: new THREE.CylinderGeometry(0.04, 0.04, 3.0, 16), pos: [-0.8, 2.1, 0], rot: [Math.PI / 2, 0, 0] },
        { geo: new THREE.CylinderGeometry(0.035, 0.035, 3.0, 16), pos: [-2.3, 2.1, -0.5], rot: [0, 0, Math.PI / 2] },
        { geo: new THREE.CylinderGeometry(0.035, 0.035, 3.0, 16), pos: [-2.3, 2.1, 0.5], rot: [0, 0, Math.PI / 2] }
    ];

    tubos.forEach(t => {
        const m = new THREE.Mesh(t.geo, pvcMat);
        m.position.set(...t.pos);
        m.rotation.set(...t.rot);
        m.castShadow = true;
        cultivoGroup.add(m);
    });

    function addPipeBetween(start, end, radius, material) {
        const direction = new THREE.Vector3().subVectors(end, start);
        const pipe = new THREE.Mesh(
            new THREE.CylinderGeometry(radius, radius, direction.length(), 16),
            material
        );
        pipe.position.copy(start).add(end).multiplyScalar(0.5);
        pipe.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
        pipe.castShadow = true;
        cultivoGroup.add(pipe);
    }

    // Alimentación desde la bomba: sube por el soporte y entra al colector superior.
    const feedRoute = [
        new THREE.Vector3(0.62, 0.25, 1.48),
        new THREE.Vector3(-0.8, 0.25, 1.48),
        new THREE.Vector3(-0.8, 2.08, 1.48)
    ];
    addPipeBetween(new THREE.Vector3(0.62, 0.25, 0.42), feedRoute[0], 0.035, pvcMat);
    addPipeBetween(feedRoute[0], feedRoute[1], 0.035, pvcMat);
    addPipeBetween(feedRoute[1], feedRoute[2], 0.035, pvcMat);

    // Seis conjuntos de boquilla, cuello y difusor de bronce.
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xb88a45, metalness: 0.82, roughness: 0.28 });
    const brassHighlightMat = new THREE.MeshStandardMaterial({ color: 0xe2c17c, metalness: 0.78, roughness: 0.24 });
    microaspersores.forEach(asp => {
        const assembly = new THREE.Group();
        assembly.position.set(asp.x, asp.y, asp.z);
        const inlet = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.09, 20), brassMat);
        inlet.position.y = 0.015;
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.032, 0.1, 16), brassHighlightMat);
        stem.position.y = -0.075;
        const diffuser = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.028, 0.075, 24), brassMat);
        diffuser.position.y = -0.16;
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.064, 0.008, 8, 24), brassHighlightMat);
        rim.rotation.x = Math.PI / 2;
        rim.position.y = -0.2;
        assembly.add(inlet, stem, diffuser, rim);
        assembly.traverse(part => { if (part.isMesh) part.castShadow = true; });
        cultivoGroup.add(assembly);
    });

    // Sensor de humedad de suelo YL-69/FC-28 con módulo comparador y horquillas.
    const probeBoardMat = new THREE.MeshStandardMaterial({ color: 0x176b53, roughness: 0.46, metalness: 0.2 });
    const probeBoard = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.2, 0.035), probeBoardMat);
    probeBoard.position.set(-1.05, 0.72, 1.19);
    cultivoGroup.add(probeBoard);
    const probeMetalMat = new THREE.MeshStandardMaterial({ color: 0xaeb9ad, metalness: 0.82, roughness: 0.24 });
    [-0.045, 0.045].forEach(offset => {
        const tine = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.34, 0.018), probeMetalMat);
        tine.position.set(-1.05 + offset, 0.43, 1.2);
        cultivoGroup.add(tine);
    });
    const probeHeaderMat = new THREE.MeshStandardMaterial({ color: 0xd8b564, metalness: 0.78, roughness: 0.24 });
    for (let pin = 0; pin < 3; pin++) {
        const header = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.07, 8), probeHeaderMat);
        header.position.set(-1.1 + pin * 0.05, 0.855, 1.19);
        cultivoGroup.add(header);
    }

    // DHT11: placa azul, cápsula con rejilla y soporte sobre el follaje.
    const sensorBoardMat = new THREE.MeshStandardMaterial({ color: 0x176b86, roughness: 0.48, metalness: 0.18 });
    const dhtBoard = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.34, 0.045), sensorBoardMat);
    dhtBoard.position.set(-3.52, 1.12, 1.32);
    cultivoGroup.add(dhtBoard);
    const dhtHousing = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.22, 0.12),
        new THREE.MeshStandardMaterial({ color: 0xd9e1d6, roughness: 0.68 })
    );
    dhtHousing.position.set(-3.52, 1.15, 1.41);
    cultivoGroup.add(dhtHousing);
    const ventMat = new THREE.MeshStandardMaterial({ color: 0x263a35, roughness: 0.8 });
    for (let row = 0; row < 3; row++) {
        for (let column = 0; column < 3; column++) {
            const vent = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), ventMat);
            vent.position.set(-3.58 + column * 0.06, 1.1 + row * 0.05, 1.474);
            cultivoGroup.add(vent);
        }
    }
    const dhtStand = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.42, 10), pvcMat);
    dhtStand.position.set(-3.52, 0.77, 1.32);
    cultivoGroup.add(dhtStand);

    // BMP280: módulo I2C compacto montado en el frente del controlador.
    const bmpBoard = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.035), sensorBoardMat);
    bmpBoard.position.set(1.24, 1.76, -0.79);
    cultivoGroup.add(bmpBoard);
    const bmpChip = new THREE.Mesh(
        new THREE.BoxGeometry(0.085, 0.075, 0.026),
        new THREE.MeshStandardMaterial({ color: 0x171d1a, metalness: 0.35, roughness: 0.38 })
    );
    bmpChip.position.set(1.24, 1.76, -0.755);
    cultivoGroup.add(bmpChip);
    for (let pin = 0; pin < 4; pin++) {
        const header = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.055, 8), probeHeaderMat);
        header.position.set(1.14 + pin * 0.065, 1.64, -0.79);
        cultivoGroup.add(header);
    }

    scene.add(cultivoGroup);
}

// ----------------------------------------------------------------------------
// 3. MÓDULO HIDRÁULICO: DEPÓSITO DE AGUA 5L CON ESCALA, BOMBA Y VÁLVULAS
// ----------------------------------------------------------------------------
function crearZonaHidraulicaYBomba() {
    const hidraGroup = new THREE.Group();

    // Bandeja de Base Verde
    const bandejaMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.3 });
    const bandeja = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 2.8), bandejaMat);
    bandeja.position.set(0.6, 0.04, 0);
    hidraGroup.add(bandeja);

    // Escala del Depósito de Agua de 5 Litros
    const tankCanvas = document.createElement('canvas');
    tankCanvas.width = 256;
    tankCanvas.height = 512;
    const tCtx = tankCanvas.getContext('2d');
    tCtx.fillStyle = "rgba(255,255,255,0)";
    tCtx.fillRect(0,0,256,512);
    tCtx.fillStyle = "#0f172a";
    tCtx.font = "Bold 28px 'IBM Plex Mono', monospace";
    for(let l = 1; l <= 5; l++) {
        let y = 460 - (l * 80);
        tCtx.fillRect(20, y, 50, 4);
        tCtx.fillText(`${l}L`, 80, y + 10);
    }
    const scaleTex = new THREE.CanvasTexture(tankCanvas);

    // Contenedor Transparente (DEP-AGUA-5L)
    const cuboGeo = new THREE.CylinderGeometry(0.65, 0.55, 1.6, 32);
    const cuboMat = new THREE.MeshPhysicalMaterial({
        color: 0xf0fdfa,
        transparent: true,
        opacity: 0.45,
        roughness: 0.08,
        transmission: 0.9,
        ior: 1.45,
        clearcoat: 0.18,
        clearcoatRoughness: 0.22
    });
    const cuboMesh = new THREE.Mesh(cuboGeo, cuboMat);
    cuboMesh.position.set(0.6, 0.88, -0.6);
    hidraGroup.add(cuboMesh);

    // Escala Impresa sobre el Contenedor
    const scaleMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.652, 0.552, 1.58, 32, 1, true, -Math.PI/4, Math.PI/2),
        new THREE.MeshBasicMaterial({ map: scaleTex, transparent: true, side: THREE.DoubleSide })
    );
    scaleMesh.position.set(0.6, 0.88, -0.6);
    hidraGroup.add(scaleMesh);

    // Agua Interna
    const aguaGeo = new THREE.CylinderGeometry(0.62, 0.53, 1.1, 32);
    const aguaMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, transparent: true, opacity: 0.75, roughness: 0.1 });
    aguaTanqueMesh = new THREE.Mesh(aguaGeo, aguaMat);
    aguaTanqueMesh.position.set(0.6, 0.63, -0.6);
    hidraGroup.add(aguaTanqueMesh);

    // Bomba de Agua 5V
    const bombaMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.2 });
    const bomba = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, 0.5), bombaMat);
    bomba.position.set(0.6, 0.23, 0.4);
    hidraGroup.add(bomba);

    // LED Indicador en Bomba
    bombaLedMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.035, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xef4444 })
    );
    bombaLedMesh.position.set(0.6, 0.4, 0.4);
    hidraGroup.add(bombaLedMesh);

    // Fluómetro YF-S201
    const fluoMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2 });
    const fluometro = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.25, 20), fluoMat);
    fluometro.rotation.z = Math.PI / 2;
    fluometro.position.set(0.1, 0.22, 0.8);
    hidraGroup.add(fluometro);

    // Electroválvula
    const valMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.2 });
    const valvula = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.22), valMat);
    valvula.position.set(0.95, 0.22, 0.8);
    hidraGroup.add(valvula);

    scene.add(hidraGroup);
}

// ----------------------------------------------------------------------------
// 4. CONTROLADOR EDGE IBN (GABINETE, LCD 16X2 Y ESP32)
// ----------------------------------------------------------------------------
function crearGabineteControlECU() {
    const ecuGroup = new THREE.Group();

    // Gabinete Negro Mate
    const cajaGeo = new THREE.BoxGeometry(1.2, 1.8, 0.3);
    const cajaMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.6, metalness: 0.3 });
    const cajaMesh = new THREE.Mesh(cajaGeo, cajaMat);
    cajaMesh.position.set(1.2, 2.5, -1.0);
    cajaMesh.castShadow = true;
    ecuGroup.add(cajaMesh);

    // LCD 16x2 I2C Azul retroiluminada
    const lcdCanvas = document.createElement('canvas');
    lcdCanvas.width = 512;
    lcdCanvas.height = 256;
    lcdCanvasCtx = lcdCanvas.getContext('2d');
    
    lcdTexture = new THREE.CanvasTexture(lcdCanvas);
    const lcdMat = new THREE.MeshBasicMaterial({ map: lcdTexture });
    const lcdMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.36), lcdMat);
    lcdMesh.position.set(1.2, 2.9, -0.84);
    ecuGroup.add(lcdMesh);

    actualizarLCDDisplay("SIRIA-W SYSTEM", "HUM: 45.0% BOM:OFF");

    // ESP32 DevKit V1
    const esp32 = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.48, 0.05),
        new THREE.MeshStandardMaterial({ color: 0x052e16, roughness: 0.4 })
    );
    esp32.position.set(1.2, 2.4, -0.84);
    ecuGroup.add(esp32);

    // Relé 1-Canal
    const rele = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.25, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.3 })
    );
    rele.position.set(1.2, 1.95, -0.84);
    ecuGroup.add(rele);

    scene.add(ecuGroup);
}

function actualizarLCDDisplay(linea1, linea2) {
    if (!lcdCanvasCtx) return;
    lcdCanvasCtx.fillStyle = "#002b80";
    lcdCanvasCtx.fillRect(0, 0, 512, 256);
    lcdCanvasCtx.fillStyle = "#38bdf8";
    lcdCanvasCtx.font = "Bold 40px 'IBM Plex Mono', monospace";
    lcdCanvasCtx.fillText(linea1, 30, 90);
    lcdCanvasCtx.fillText(linea2, 30, 180);
    if (lcdTexture) lcdTexture.needsUpdate = true;
}

// ----------------------------------------------------------------------------
// 5. LAPTOP Y ROUTER WI-FI LOCAL
// ----------------------------------------------------------------------------
function crearLaptopYRouterWifi() {
    const devGroup = new THREE.Group();

    // Laptop
    const lapMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.2 });
    const lapBase = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.8), lapMat);
    lapBase.position.set(2.8, 0.02, 0.4);
    devGroup.add(lapBase);

    const lapScreen = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.03), lapMat);
    lapScreen.position.set(2.8, 0.38, 0.0);
    lapScreen.rotation.x = -0.2;
    devGroup.add(lapScreen);

    // Pantalla ThingsBoard Dashboard
    const screenCanvas = document.createElement('canvas');
    screenCanvas.width = 512;
    screenCanvas.height = 320;
    const sCtx = screenCanvas.getContext('2d');
    sCtx.fillStyle = "#020617";
    sCtx.fillRect(0, 0, 512, 320);
    sCtx.fillStyle = "#38bdf8";
    sCtx.font = "Bold 32px sans-serif";
    sCtx.fillText("THINGSBOARD DASHBOARD", 30, 60);
    sCtx.fillStyle = "#22c55e";
    sCtx.font = "24px sans-serif";
    sCtx.fillText("● SIRIA-W Telemetria Online", 30, 120);
    sCtx.fillText("● Grafica de Humedad & Caudal", 30, 180);

    const screenTex = new THREE.CanvasTexture(screenCanvas);
    const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.62), new THREE.MeshBasicMaterial({ map: screenTex }));
    screenMesh.position.set(2.8, 0.38, 0.02);
    screenMesh.rotation.x = -0.2;
    devGroup.add(screenMesh);

    // Router Wi-Fi
    const router = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.1, 0.4),
        new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.2 })
    );
    router.position.set(3.6, 0.05, -0.6);
    devGroup.add(router);

    // Antenas
    for (let x of [3.45, 3.75]) {
        const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 12), new THREE.MeshStandardMaterial({ color: 0x0f172a }));
        ant.position.set(x, 0.3, -0.78);
        devGroup.add(ant);
    }

    scene.add(devGroup);
}

// ----------------------------------------------------------------------------
// 6. RED DE GOTEO SUBTERRÁNEO
// ----------------------------------------------------------------------------
function crearRedGoteoSubterraneo() {
    const dripGroup = new THREE.Group();
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });

    for (let z = 1.0; z <= 1.6; z += 0.2) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.8, 12), pipeMat);
        p.rotation.z = Math.PI / 2;
        p.position.set(2.7, 0.02, z);
        dripGroup.add(p);
    }

    scene.add(dripGroup);
}

// ----------------------------------------------------------------------------
// 7. FÍSICA FOTORREALISTA DE MICROASPERSIÓN DE AGUA Y NEBLINA
// ----------------------------------------------------------------------------
function crearEfectosAspersionAvanzada() {
    // 1. Conos Volumétricos de Luz y Neblina por Aspersor
    const coneGeo = new THREE.ConeGeometry(0.5, 1.5, 40, 1, true);
    coneGeo.translate(0, -0.75, 0);

    const coneMat = new THREE.MeshBasicMaterial({
        color: 0x168cff,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    microaspersores.forEach(asp => {
        const cone = new THREE.Mesh(coneGeo, coneMat.clone());
        cone.position.set(asp.x, asp.y, asp.z);
        volumetricCones.push(cone);
        scene.add(cone);
    });

    // Gotas ligeras que nacen en cada boquilla y se abren al caer.
    const count = 240;
    particleGeo = new THREE.BufferGeometry();
    particlePositions = new Float32Array(count * 3);
    particleData = [];

    for (let i = 0; i < count; i++) {
        const aspIndex = i % microaspersores.length;
        const asp = microaspersores[aspIndex];

        const angle = Math.random() * Math.PI * 2;
        const radialSpeed = 0.004 + Math.random() * 0.005;

        particlePositions[i * 3] = asp.x;
        particlePositions[i * 3 + 1] = asp.y - 0.2 - Math.random() * 0.18;
        particlePositions[i * 3 + 2] = asp.z;

        particleData.push({
            aspIndex: aspIndex,
            vx: Math.cos(angle) * radialSpeed,
            vy: 0.018 + Math.random() * 0.008,
            vz: Math.sin(angle) * radialSpeed
        });
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

    const pMat = new THREE.PointsMaterial({
        size: 0.04,
        map: crearTexturaGotaAgua(),
        transparent: true,
        opacity: 0.76,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    sprinklerParticles = new THREE.Points(particleGeo, pMat);
    scene.add(sprinklerParticles);
}

// ----------------------------------------------------------------------------
// 8. ETIQUETAS DE IDENTIFICACIÓN CAD 3D (TAL COMO EN LA FOTO DE REFERENCIA)
// ----------------------------------------------------------------------------
function crearEtiquetasCAD3D() {
    const etiquetas = [
        { text: "DHT11 · GPIO 4", pos: [-3.52, 1.53, 1.55] },
        { text: "YL-69 / FC-28 · ADC 34", pos: [-1.05, 1.02, 1.45] },
        { text: "BMP280 · I2C", pos: [1.48, 1.96, 0.12] }
    ];

    etiquetas.forEach(lbl => {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 80;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = "rgba(5, 16, 10, 0.9)";
        ctx.fillRect(0, 0, 512, 80);
        ctx.strokeStyle = "#75e68c";
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, 508, 76);
        ctx.fillStyle = "#ffffff";
        ctx.font = "Bold 27px 'DM Sans', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(lbl.text, 256, 49);

        const tex = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({ map: tex });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.position.set(...lbl.pos);
        sprite.scale.set(1.05, 0.16, 1.0);
        scene.add(sprite);
    });
}

// ----------------------------------------------------------------------------
// BUCLE DE ANIMACIÓN Y RENDERIZADO
// ----------------------------------------------------------------------------
async function toggleVRMode() {
    if (!isVRMode && typeof DeviceOrientationEvent !== "undefined"
        && typeof DeviceOrientationEvent.requestPermission === "function") {
        try {
            const permission = await DeviceOrientationEvent.requestPermission();
            if (permission !== "granted") {
                const gyroStatus = document.getElementById('xr-gyro-status');
                if (gyroStatus) gyroStatus.innerText = "Permiso denegado";
                return;
            }
        } catch (error) {
            const gyroStatus = document.getElementById('xr-gyro-status');
            if (gyroStatus) gyroStatus.innerText = "No disponible";
            return;
        }
    }

    isVRMode = !isVRMode;
    const modeText = document.getElementById('vr-mode-text');
    const container = document.getElementById('vr-canvas-container');

    if (isVRMode) {
        if (modeText) {
            modeText.innerText = "CARDBOARD VR (MODO ESTEREOSCÓPICO)";
            modeText.style.color = "#00e5ff";
        }
        if (container.requestFullscreen) {
            container.requestFullscreen().catch(() => container.classList.add('vr-fallback-fullscreen'));
        } else {
            container.classList.add('vr-fallback-fullscreen');
        }
    } else {
        if (modeText) {
            modeText.innerText = "VISTA 3D ESTÁNDAR";
            modeText.style.color = "#00ff88";
        }
        container.classList.remove('vr-fallback-fullscreen');
        if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen();
    }
    onResizeVR();
}

function toggleVirtualTour() {
    isTourActive = !isTourActive;
    const btn = document.getElementById('btn-tour');
    if (btn) {
        btn.innerText = isTourActive ? "Pausar Recorrido" : "Recorrido 3D";
    }
}

function setupGyroscope() {
    if (window.DeviceOrientationEvent) {
        window.addEventListener('deviceorientation', (event) => {
            if (isVRMode && event.alpha !== null) {
                const gyroStatus = document.getElementById('xr-gyro-status');
                if (gyroStatus) gyroStatus.innerText = "Activo";
                const alpha = THREE.MathUtils.degToRad(event.alpha);
                const beta = THREE.MathUtils.degToRad(event.beta);
                camera.rotation.set(beta, alpha, 0);
            }
        });
    }
}

function animateVR() {
    requestAnimationFrame(animateVR);

    fpsCounter++;
    const now = performance.now();
    if (now - lastFrameTime >= 1000) {
        const fpsElement = document.getElementById('xr-fps-val');
        if (fpsElement) fpsElement.innerText = fpsCounter + " FPS";
        fpsCounter = 0;
        lastFrameTime = now;
    }

    // Animación de gotas y pulsación suave de los seis conos de aspersión.
    if (sprinklerActive) {
        volumetricCones.forEach((cone, index) => {
            cone.material.opacity = 0.13 + Math.sin(now * 0.003 + index) * 0.015;
        });
    }

    if (sprinklerParticles && sprinklerActive) {
        const positions = sprinklerParticles.geometry.attributes.position.array;

        for (let i = 0; i < particleData.length; i++) {
            const p = particleData[i];
            const asp = microaspersores[p.aspIndex];
            const idx = i * 3;

            positions[idx + 1] -= p.vy; // Caída vertical acelerada
            positions[idx] += p.vx;     // Expansión cónica
            positions[idx + 2] += p.vz;

            // Reinicio al tocar el follaje del cultivo
            if (positions[idx + 1] <= 0.53) {
                positions[idx] = asp.x;
                positions[idx + 1] = asp.y - 0.02;
                positions[idx + 2] = asp.z;
            }
        }
        sprinklerParticles.geometry.attributes.position.needsUpdate = true;
    }

    if (isTourActive) {
        tourAngle += 0.005;
        camera.position.x = Math.sin(tourAngle) * 6.8;
        camera.position.z = Math.cos(tourAngle) * 6.8;
        camera.position.y = 3.8 + Math.sin(tourAngle * 2) * 0.4;
        camera.lookAt(0, 1.1, 0);
    } else {
        controls.update();
    }

    if (isVRMode) {
        renderStereoscopicCardboard();
    } else {
        renderer.setViewport(0, 0, renderer.domElement.width, renderer.domElement.height);
        renderer.render(scene, camera);
    }
}

function renderStereoscopicCardboard() {
    const width = renderer.domElement.width;
    const height = renderer.domElement.height;
    const halfWidth = width / 2;

    renderer.setScissorTest(true);

    camera.position.x -= eyeSeparation / 2;
    renderer.setViewport(0, 0, halfWidth, height);
    renderer.setScissor(0, 0, halfWidth, height);
    renderer.render(scene, camera);

    camera.position.x += eyeSeparation;
    renderer.setViewport(halfWidth, 0, halfWidth, height);
    renderer.setScissor(halfWidth, 0, halfWidth, height);
    renderer.render(scene, camera);

    camera.position.x -= eyeSeparation / 2;
    renderer.setScissorTest(false);
}

function onResizeVR() {
    const container = document.getElementById('vr-canvas-container');
    if (!container || !renderer) return;

    const aspect = container.clientWidth / container.clientHeight;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);

    if (!isVRMode && !isTourActive && aspect < 1.35) {
        const zoomOut = Math.min(1.7, 1.5 / aspect);
        const offset = cameraHomePosition.clone().sub(cameraHomeTarget).multiplyScalar(zoomOut);
        camera.position.copy(cameraHomeTarget).add(offset);
        camera.lookAt(cameraHomeTarget);
        controls.update();
    } else if (!isVRMode && !isTourActive) {
        camera.position.copy(cameraHomePosition);
        camera.lookAt(cameraHomeTarget);
        controls.update();
    }
}

// ----------------------------------------------------------------------------
// INTEGRACIÓN CON TELEMETRÍA EN TIEMPO REAL
// ----------------------------------------------------------------------------
window.actualizarTelemetriaVR = function(humedad, temp, bombaEstado, rtt, humedadAmbiente, presionAtmosferica, nivelTanque) {
    const isON = (bombaEstado === "ENCENDIDA" || bombaEstado === "LOW" || bombaEstado === true);
    sprinklerActive = isON;

    const soilValue = Number.isFinite(humedad) ? `${humedad.toFixed(1)}%` : "--%";
    const airValue = Number.isFinite(humedadAmbiente) ? `${humedadAmbiente.toFixed(0)}%` : "--%";
    const pressureValue = Number.isFinite(presionAtmosferica) ? `${presionAtmosferica.toFixed(0)} hPa` : "-- hPa";
    const tankValue = Number.isFinite(nivelTanque) ? `${nivelTanque.toFixed(0)}%` : "No medido";

    actualizarLCDDisplay(`SUELO ${soilValue}`, `T:${temp} HR:${airValue}`);

    const readout = (id, value) => {
        const element = document.getElementById(id);
        if (element) element.innerText = value;
    };
    readout("vr-soil-value", soilValue);
    readout("vr-temp-value", temp || "-- °C");
    readout("vr-humidity-value", airValue);
    readout("vr-pressure-value", pressureValue);
    readout("vr-tank-value", tankValue);

    const irrigationStatus = document.getElementById("vr-irrigation-status");
    const irrigationDot = document.getElementById("vr-irrigation-dot");
    const irrigationLabel = document.getElementById("vr-irrigation-label");
    if (irrigationStatus) irrigationStatus.classList.toggle("active", isON);
    if (irrigationDot) irrigationDot.className = `dot${isON ? " online" : ""}`;
    if (irrigationLabel) irrigationLabel.innerText = `${isON ? "MICROASPERSIÓN ACTIVA" : "RIEGO DETENIDO"} · 6 BOQUILLAS`;

    if (sueloMaterial) {
        if (humedad >= 60) sueloMaterial.color.setHex(0x231710);
        else if (humedad >= 40) sueloMaterial.color.setHex(0x3d271d);
        else sueloMaterial.color.setHex(0x614332);
    }

    if (bombaLedMesh) {
        bombaLedMesh.material.color.setHex(isON ? 0x22c55e : 0xef4444);
    }

    // Activar o detener los conos y gotas según el estado de la bomba.
    volumetricCones.forEach(c => {
        c.material.opacity = isON ? 0.13 : 0.0;
    });

    if (sprinklerParticles) {
        sprinklerParticles.material.opacity = isON ? 0.9 : 0.0;
    }

    const rttElement = document.getElementById('xr-rtt-val');
    if (rttElement && rtt) rttElement.innerText = rtt + " ms";
};

document.addEventListener('DOMContentLoaded', () => {
    initVRSystem();
});