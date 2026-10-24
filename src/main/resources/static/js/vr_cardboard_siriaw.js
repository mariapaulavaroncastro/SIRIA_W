// ============================================================================
// SIRIA-W: Gemelo Digital 3D & VR Cardboard - Renderizado PBR Fotorrealista
// ============================================================================

let scene, camera, renderer, controls;
let cameraHomePosition, cameraHomeTarget;
const eyeSeparation = 0.064;
const cardboardFieldOfView = 52;
const cardboardNearClip = 0.1;
const cardboardModelHalfWidth = 4.1;
const cardboardModelHalfHeight = 2.2;
const cardboardViewingDistance = 2.8;
const cardboardFramingMargin = 1.08;
let isVRMode = false;
let isTourActive = false;
let tourAngle = 0;
let controlsEnabledBeforeVR = true;
let cameraBeforeVRPosition = null;
let cameraBeforeVRQuaternion = null;
let cameraBeforeVRFov = null;
let controlsTargetBeforeVR = null;
let deviceOrientationHandler = null;
let ns3OverlayGroup = null;
let ns3Links = {};
let ns3Packets = [];
let ns3LatencyMs = 0;
let ns3PacketLossPercent = 0;
let lastQoSLatencyMs = null;
let ns3RunId = null;
let lastNS3Sequence = -1;
let lastNS3PacketEventId = 0;
let ns3MetricsError = null;
const ns3NodePositions = {
    yl69: new THREE.Vector3(-1.05, 0.72, 1.19),
    dht11: new THREE.Vector3(-3.52, 1.12, 1.32),
    esp32: new THREE.Vector3(1.2, 2.4, -0.84),
    laptopgateway: new THREE.Vector3(2.8, 0.38, 0.0)
};
const ns3AxisX = new THREE.Vector3(1, 0, 0);
const ns3DeviceEuler = new THREE.Euler();
const ns3DeviceQuaternion = new THREE.Quaternion();
const ns3ScreenQuaternion = new THREE.Quaternion();
const ns3LandscapeQuaternion = new THREE.Quaternion();
const ns3ScreenOrientationAxis = new THREE.Vector3(0, 0, 1);
const gyroReferenceQuaternion = new THREE.Quaternion();
const gyroReferenceInverse = new THREE.Quaternion();
const gyroCameraAlignment = new THREE.Quaternion();
let hasGyroReference = false;
let gyroSignalTimeout = null;

// Elementos Dinámicos de Telemetría
let sueloMaterial, aguaTanqueMesh, bombaLedMesh, lcdCanvasCtx, lcdTexture;
let sprinklerParticles, particleGeo, particlePositions;
let volumetricCones = [];
let particleData = [];
let sprinklerActive = false;
let lastFrameTime = performance.now();
let lastAnimationTime = lastFrameTime;
let fpsCounter = 0;
let modelRootGroup = null;
let vrRaycaster = new THREE.Raycaster();
const vrCenterPoint = new THREE.Vector2(0, 0);
let vrInteractionPanel = null;
let vrInteractiveTargets = [];
let gamepadIndex = null;
let lastGamepadButtons = [];
let lastGamepadFrameTime = performance.now();

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
    scene.background = new THREE.Color(0x9cc9e4);
    scene.fog = new THREE.Fog(0x9cc9e4, 48, 115);

    // 2. Cámara Principal
    camera = new THREE.PerspectiveCamera(48, container.clientWidth / container.clientHeight, cardboardNearClip, 160);
    camera.position.set(0, 4.2, 7.8);

    // 3. Renderizador WebGL Fotorrealista
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.0));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) {
        renderer.outputColorSpace = THREE.SRGBColorSpace;
    } else {
        renderer.outputEncoding = THREE.sRGBEncoding;
    }
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
    const ambientLight = new THREE.AmbientLight(0xdbeafe, 0.72);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff1ce, 1.55);
    sunLight.position.set(6, 14, 7);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.bias = -0.0001;
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0xc5e8ff, 0.48);
    fillLight.position.set(-7, 6, 4);
    scene.add(fillLight);

    const rimLight = new THREE.PointLight(0x00e5ff, 0.8, 20);
    rimLight.position.set(-5, 4, -3);
    scene.add(rimLight);

    // 6. Construcción Completa de la Maqueta
    modelRootGroup = new THREE.Group();
    scene.add(modelRootGroup);
    crearFondoPaisaje();
    crearEntornoExhibicion();
    crearBaseYPlacaMaqueta();
    crearZonaCultivoYMicroaspersion();
    crearZonaHidraulicaYBomba();
    crearGabineteControlECU();
    crearLaptopYRouterWifi();
    crearRedGoteoSubterraneo();
    crearEfectosAspersionAvanzada();
    crearPanelInteraccionVR();
    crearObjetivosInteractivosVR();
    initNS3MeshOverlay();
    window.addEventListener("gamepadconnected", onVRGamepadConnected);
    window.addEventListener("gamepaddisconnected", onVRGamepadDisconnected);

    window.addEventListener('resize', onResizeVR);
    setupOrientationHandling();

    animateVR();
}

function crearFondoPaisaje() {
    const mountainLayers = [
        { z: -21, color: 0x329447, peaks: [[-55, -1], [-45, 2], [-34, 0], [-22, 4], [-12, 1], [0, 5], [11, 1], [25, 4], [39, 0], [55, 3]] },
        { z: -16, color: 0x55b85b, peaks: [[-55, -1], [-43, 1], [-32, 3], [-20, 0], [-8, 4], [6, 1], [20, 3], [34, 0], [45, 2], [55, -1]] }
    ];

    mountainLayers.forEach(layer => {
        const shape = new THREE.Shape();
        shape.moveTo(-55, -5);
        shape.lineTo(layer.peaks[0][0], layer.peaks[0][1]);
        layer.peaks.slice(1).forEach(([x, y]) => shape.lineTo(x, y));
        shape.lineTo(55, -5);
        shape.closePath();

        const mountains = new THREE.Mesh(
            new THREE.ShapeGeometry(shape),
            new THREE.MeshBasicMaterial({ color: layer.color, side: THREE.DoubleSide, fog: true })
        );
        mountains.position.z = layer.z;
        scene.add(mountains);
    });

    const cloudMaterial = new THREE.MeshBasicMaterial({
        color: 0xf3f8fb,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
        fog: true
    });
    [
        [-10, 4.1, -17, 2.2], [-5, 4.5, -18, 1.6], [1, 4.8, -20, 2],
        [10, 3.8, -16, 1.8], [15, 4.3, -18, 1.5], [0, 3.5, -21, 1.4]
    ].forEach(([x, y, z, size]) => {
        const cloud = new THREE.Group();
        for (let puff = 0; puff < 4; puff++) {
            const lobe = new THREE.Mesh(new THREE.SphereGeometry(size * (0.48 + (puff % 2) * 0.12), 16, 12), cloudMaterial);
            lobe.position.set((puff - 1.5) * size * 0.48, Math.sin(puff * 1.7) * size * 0.12, 0);
            cloud.add(lobe);
        }
        cloud.position.set(x, y, z);
        scene.add(cloud);
    });
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

function crearEntornoExhibicion() {
    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(160, 160),
        new THREE.MeshStandardMaterial({ color: 0x0b130e, roughness: 0.98, metalness: 0 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.46;
    floor.receiveShadow = true;
    scene.add(floor);

}

// ----------------------------------------------------------------------------
// 1. BASE Y PLATAFORMA DE PRESENTACIÓN
// ----------------------------------------------------------------------------
function crearBaseYPlacaMaqueta() {
    const baseGroup = new THREE.Group();

    // Bloque Principal de Estructura Industrial
    const baseGeo = new THREE.BoxGeometry(8.2, 0.42, 3.8);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x26342d, roughness: 0.36, metalness: 0.62 });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.set(0, -0.21, 0);
    baseMesh.receiveShadow = true;
    baseMesh.castShadow = true;
    baseGroup.add(baseMesh);

    const deck = new THREE.Mesh(
        new THREE.BoxGeometry(8.05, 0.09, 3.66),
        new THREE.MeshStandardMaterial({ color: 0x34463a, roughness: 0.42, metalness: 0.48 })
    );
    deck.position.set(0, 0.045, 0);
    deck.receiveShadow = true;
    baseGroup.add(deck);

    const trimMaterial = new THREE.MeshStandardMaterial({
        color: 0x51db85,
        emissive: 0x0b4925,
        emissiveIntensity: 0.45,
        metalness: 0.58,
        roughness: 0.3
    });
    [
        { size: [8.05, 0.035, 0.035], position: [0, 0.06, -1.82] },
        { size: [8.05, 0.035, 0.035], position: [0, 0.06, 1.82] },
        { size: [0.035, 0.035, 3.66], position: [-4, 0.06, 0] },
        { size: [0.035, 0.035, 3.66], position: [4, 0.06, 0] }
    ].forEach(edge => {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(...edge.size), trimMaterial);
        strip.position.set(...edge.position);
        baseGroup.add(strip);
    });

    const boltMaterial = new THREE.MeshStandardMaterial({ color: 0xc2c9c0, metalness: 0.88, roughness: 0.22 });
    for (const x of [-3.82, 3.82]) {
        for (const z of [-1.65, 1.65]) {
            const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.025, 16), boltMaterial);
            bolt.position.set(x, 0.105, z);
            baseGroup.add(bolt);
        }
    }

    // Placa metálica frontal de identificación.
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
    const placaMat = new THREE.MeshStandardMaterial({ map: placaTex, metalness: 0.68, roughness: 0.26 });
    const placaMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 0.48), placaMat);
    placaMesh.position.set(-0.3, -0.21, 1.911);
    baseGroup.add(placaMesh);

    modelRootGroup.add(baseGroup);
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

    // Suelo orgánico con variación visual para distinguir el cultivo del escenario.
    const sueloGeo = new THREE.BoxGeometry(3.1, 0.1, 3.1);
    const soilCanvas = document.createElement('canvas');
    soilCanvas.width = 256;
    soilCanvas.height = 256;
    const soilContext = soilCanvas.getContext('2d');
    soilContext.fillStyle = '#493322';
    soilContext.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1100; i++) {
        soilContext.fillStyle = i % 3 === 0 ? '#77563a' : '#2f241c';
        soilContext.globalAlpha = 0.16 + (i % 5) * 0.035;
        soilContext.fillRect((i * 73) % 256, (i * 137) % 256, 1 + (i % 3), 1 + (i % 2));
    }
    soilContext.globalAlpha = 1;
    const soilTexture = new THREE.CanvasTexture(soilCanvas);
    soilTexture.wrapS = THREE.RepeatWrapping;
    soilTexture.wrapT = THREE.RepeatWrapping;
    soilTexture.repeat.set(3, 3);
    sueloMaterial = new THREE.MeshStandardMaterial({ map: soilTexture, color: 0xffffff, roughness: 0.96 });
    const sueloMesh = new THREE.Mesh(sueloGeo, sueloMaterial);
    sueloMesh.position.set(-2.3, 0.48, 0);
    sueloMesh.receiveShadow = true;
    cultivoGroup.add(sueloMesh);

    const ridgeMaterial = new THREE.MeshStandardMaterial({ color: 0x49301e, roughness: 0.98 });
    for (let row = 0; row < 7; row++) {
        const ridge = new THREE.Mesh(new THREE.BoxGeometry(2.94, 0.055, 0.18), ridgeMaterial);
        ridge.position.set(-2.3, 0.55, -1.26 + row * 0.42);
        ridge.receiveShadow = true;
        cultivoGroup.add(ridge);
    }

    const leafShape = new THREE.Shape();
    leafShape.moveTo(0, 0);
    leafShape.quadraticCurveTo(0.08, 0.13, 0.28, 0.11);
    leafShape.quadraticCurveTo(0.23, 0.015, 0, 0);
    const leafGeometry = new THREE.ShapeGeometry(leafShape, 10);
    const stemGeometry = new THREE.CylinderGeometry(0.009, 0.016, 0.22, 7);
    const stemMaterial = new THREE.MeshStandardMaterial({ color: 0x4a9b48, roughness: 0.72 });
    const leafMaterials = [
        new THREE.MeshStandardMaterial({ color: 0x147236, roughness: 0.88, side: THREE.DoubleSide }),
        new THREE.MeshStandardMaterial({ color: 0x289544, roughness: 0.88, side: THREE.DoubleSide }),
        new THREE.MeshStandardMaterial({ color: 0x0f5f30, roughness: 0.9, side: THREE.DoubleSide })
    ];

    // Hileras de plantas con tallos y hojas planas en lugar de hojas esféricas.
    let plantIndex = 0;
    for (let x = -3.6; x <= -1.0; x += 0.45) {
        for (let z = -1.3; z <= 1.3; z += 0.4) {
            const planta = new THREE.Group();
            const stem = new THREE.Mesh(stemGeometry, stemMaterial);
            stem.position.y = 0.11;
            planta.add(stem);

            for (let i = 0; i < 5; i++) {
                const angle = (Math.PI * 2 * i) / 3 + (plantIndex % 4) * 0.16;
                const height = i < 3 ? 0.075 : 0.15;
                const hoja = new THREE.Mesh(leafGeometry, leafMaterials[(plantIndex + i) % leafMaterials.length]);
                hoja.position.set(Math.cos(angle) * 0.015, height, Math.sin(angle) * 0.015);
                hoja.rotation.set(-1.48, -angle, 0.08 * (i % 2 ? 1 : -1));
                hoja.castShadow = true;
                planta.add(hoja);
            }
            planta.position.set(x + ((plantIndex % 3) - 1) * 0.008, 0.57, z + ((plantIndex % 5) - 2) * 0.006);
            cultivoGroup.add(planta);
            plantIndex++;
        }
    }

    // PVC negro mate con un brillo fino en los cantos.
    const pvcMat = new THREE.MeshStandardMaterial({ color: 0x101312, roughness: 0.28, metalness: 0.15 });
    
    // Soportes verticales
    [[-3.8, 1.3, -1.5], [-3.8, 1.3, 1.5], [-0.8, 1.3, -1.5], [-0.8, 1.3, 1.5]].forEach(([x, y, z]) => {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 16), pvcMat);
        col.position.set(x, y, z);
        col.castShadow = true;
        cultivoGroup.add(col);
    });

    // Arcos y cubierta translúcida para dar volumen al invernadero.
    const archMaterial = new THREE.MeshStandardMaterial({ color: 0x91a99a, roughness: 0.32, metalness: 0.62 });
    const archSegments = 28;
    const roofVertices = [];
    const roofIndices = [];
    for (let end = 0; end < 2; end++) {
        const x = end === 0 ? -3.8 : -0.8;
        for (let segment = 0; segment <= archSegments; segment++) {
            const angle = (Math.PI * segment) / archSegments;
            const z = -1.5 + (3 * segment) / archSegments;
            const y = 2.1 + Math.sin(angle) * 0.82;
            roofVertices.push(x, y, z);
        }
    }
    for (let segment = 0; segment < archSegments; segment++) {
        const a = segment;
        const b = segment + archSegments + 1;
        roofIndices.push(a, a + 1, b, a + 1, b + 1, b);
    }
    const roofGeometry = new THREE.BufferGeometry();
    roofGeometry.setAttribute('position', new THREE.Float32BufferAttribute(roofVertices, 3));
    roofGeometry.setIndex(roofIndices);
    roofGeometry.computeVertexNormals();
    const greenhouseCover = new THREE.Mesh(
        roofGeometry,
        new THREE.MeshPhysicalMaterial({
            color: 0xbce8d1,
            transparent: true,
            opacity: 0.17,
            roughness: 0.24,
            metalness: 0.08,
            side: THREE.DoubleSide,
            depthWrite: false
        })
    );
    greenhouseCover.receiveShadow = true;
    cultivoGroup.add(greenhouseCover);

    for (const x of [-3.8, -2.8, -1.8, -0.8]) {
        const archPoints = [];
        for (let segment = 0; segment <= 16; segment++) {
            const angle = (Math.PI * segment) / 16;
            archPoints.push(new THREE.Vector3(x, 2.1 + Math.sin(angle) * 0.82, -1.5 + (3 * segment) / 16));
        }
        const arch = new THREE.Mesh(
            new THREE.TubeGeometry(new THREE.CatmullRomCurve3(archPoints), 32, 0.022, 8, false),
            archMaterial
        );
        arch.castShadow = true;
        cultivoGroup.add(arch);
    }

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
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xb88a45, metalness: 0.9, roughness: 0.24 });
    const brassHighlightMat = new THREE.MeshStandardMaterial({ color: 0xe2c17c, metalness: 0.9, roughness: 0.2 });
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

    modelRootGroup.add(cultivoGroup);
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
        opacity: 0.35,
        roughness: 0.08,
        transmission: 0.95,
        ior: 1.49,
        clearcoat: 0.18,
        clearcoatRoughness: 0.22,
        depthWrite: false
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
    const aguaGeo = new THREE.CylinderGeometry(0.62, 0.53, 1.42, 32);
    const aguaMat = new THREE.MeshBasicMaterial({
        color: 0x007fe8,
        transparent: true,
        opacity: 0.92,
        side: THREE.DoubleSide,
        depthWrite: true
    });
    aguaTanqueMesh = new THREE.Mesh(aguaGeo, aguaMat);
    const initialFillRatio = 0.6;
    aguaTanqueMesh.position.set(0.6, 0.08 + 1.42 * initialFillRatio / 2, -0.6);
    aguaTanqueMesh.scale.y = initialFillRatio;
    aguaTanqueMesh.visible = true;
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
    const fluoMat = new THREE.MeshStandardMaterial({ color: 0xb88a45, metalness: 0.9, roughness: 0.24 });
    const fluometro = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.25, 20), fluoMat);
    fluometro.rotation.z = Math.PI / 2;
    fluometro.position.set(0.1, 0.22, 0.8);
    hidraGroup.add(fluometro);

    // Electroválvula
    const valMat = new THREE.MeshStandardMaterial({ color: 0xb88a45, metalness: 0.9, roughness: 0.2 });
    const valvula = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.22), valMat);
    valvula.position.set(0.95, 0.22, 0.8);
    hidraGroup.add(valvula);

    modelRootGroup.add(hidraGroup);
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

    modelRootGroup.add(ecuGroup);
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

    modelRootGroup.add(devGroup);
}

// ----------------------------------------------------------------------------
// 6. RED DE GOTEO SUBTERRÁNEO
// ----------------------------------------------------------------------------
function crearRedGoteoSubterraneo() {
    const dripGroup = new THREE.Group();
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.28, metalness: 0.15 });

    for (let z = 1.0; z <= 1.6; z += 0.2) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.8, 12), pipeMat);
        p.rotation.z = Math.PI / 2;
        p.position.set(2.7, 0.02, z);
        dripGroup.add(p);
    }

    modelRootGroup.add(dripGroup);
}

// ----------------------------------------------------------------------------
// 7. FÍSICA FOTORREALISTA DE MICROASPERSIÓN DE AGUA Y NEBLINA
// ----------------------------------------------------------------------------
function crearEfectosAspersionAvanzada() {
    // 1. Conos Volumétricos de Luz y Neblina por Aspersor
    const coneGeo = new THREE.ConeGeometry(0.5, 1.5, 40, 1, true);
    coneGeo.translate(0, -0.75, 0);

    const coneMat = new THREE.MeshBasicMaterial({
        color: 0x00aaff,
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
        modelRootGroup.add(cone);
    });

    // Gotas ligeras que nacen en cada boquilla y se abren al caer.
    const count = 360;
    particleGeo = new THREE.BufferGeometry();
    particlePositions = new Float32Array(count * 3);
    particleData = [];

    for (let i = 0; i < count; i++) {
        const aspIndex = i % microaspersores.length;
        const asp = microaspersores[aspIndex];

        const angle = Math.random() * Math.PI * 2;
        const radialSpeed = 0.2 + Math.random() * 0.45;

        particlePositions[i * 3] = asp.x;
        particlePositions[i * 3 + 1] = asp.y - 0.2 - Math.random() * 0.08;
        particlePositions[i * 3 + 2] = asp.z;

        particleData.push({
            aspIndex: aspIndex,
            vx: Math.cos(angle) * radialSpeed,
            vy: 0.7 + Math.random() * 0.65,
            vz: Math.sin(angle) * radialSpeed,
            age: Math.random() * 0.8
        });
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

    const pMat = new THREE.PointsMaterial({
        size: 0.085,
        map: crearTexturaGotaAgua(),
        color: 0x55ddff,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
        toneMapped: false
    });

    sprinklerParticles = new THREE.Points(particleGeo, pMat);
    sprinklerParticles.visible = false;
    sprinklerParticles.renderOrder = 7;
    modelRootGroup.add(sprinklerParticles);
}

function crearPanelInteraccionVR() {
    vrInteractionPanel = document.createElement("div");
    vrInteractionPanel.setAttribute("role", "status");
    Object.assign(vrInteractionPanel.style, {
        position: "absolute",
        left: "50%",
        bottom: "72px",
        transform: "translateX(-50%)",
        zIndex: "5",
        display: "none",
        maxWidth: "min(360px, 85%)",
        padding: "10px 14px",
        border: "1px solid #8bff8a",
        borderRadius: "8px",
        background: "rgba(5, 16, 10, .92)",
        color: "#efffee",
        font: "12px/1.5 'IBM Plex Mono', monospace",
        textAlign: "center",
        pointerEvents: "none"
    });
    const container = document.getElementById("vr-canvas-container");
    if (container) {
        if (getComputedStyle(container).position === "static") container.style.position = "relative";
        container.appendChild(vrInteractionPanel);
    }
}

function crearObjetivosInteractivosVR() {
    const targets = [
        {
            name: "ESP32 DevKit V1",
            description: "Controlador principal del sistema de riego.",
            position: [1.2, 2.4, -0.84],
            radius: 0.3
        },
        {
            name: "Sensor YL-69",
            description: "Mide la humedad del suelo para el control del riego.",
            position: [-1.05, 0.72, 1.19],
            radius: 0.28
        },
        {
            name: "Bomba de agua 5V",
            description: "Botón C/D: alterna la bomba cuando el sistema está en modo manual.",
            position: [0.6, 0.23, 0.4],
            radius: 0.32
        }
    ];

    vrInteractiveTargets = targets.map(target => {
        const proxy = new THREE.Mesh(
            new THREE.SphereGeometry(target.radius, 12, 8),
            new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
        );
        proxy.position.set(...target.position);
        proxy.userData.vrComponent = target;
        proxy.name = `VR target: ${target.name}`;
        modelRootGroup.add(proxy);
        return proxy;
    });
}

// ----------------------------------------------------------------------------
// BUCLE DE ANIMACIÓN Y RENDERIZADO
// ----------------------------------------------------------------------------
async function toggleVRMode() {
    if (isVRMode) {
        salirModoVR();
        return;
    }

    if (!window.isSecureContext) {
        actualizarEstadoGiroscopio(
            "Requiere HTTPS",
            "El navegador bloquea el giroscopio en HTTP. Abre esta página mediante HTTPS en el teléfono."
        );
        return;
    }

    if (!window.DeviceOrientationEvent) {
        actualizarEstadoGiroscopio(
            "No disponible",
            "Este navegador no ofrece eventos de orientación del dispositivo."
        );
        return;
    }

    if (typeof DeviceOrientationEvent !== "undefined"
        && typeof DeviceOrientationEvent.requestPermission === "function") {
        try {
            const permission = await DeviceOrientationEvent.requestPermission();
            if (permission !== "granted") {
                actualizarEstadoGiroscopio(
                    "Permiso denegado",
                    "Permite el acceso a movimiento y orientación en los ajustes del navegador."
                );
                return;
            }
        } catch (error) {
            actualizarEstadoGiroscopio(
                "Error de permiso",
                error instanceof Error ? error.message : "El navegador no pudo solicitar permiso al sensor."
            );
            return;
        }
    }

    await entrarModoVR();
}

function esOrientacionLandscape() {
    if (screen.orientation && typeof screen.orientation.type === "string") {
        return screen.orientation.type.startsWith("landscape");
    }
    return window.innerWidth > window.innerHeight;
}

function setupOrientationHandling() {
    window.addEventListener('orientationchange', gestionarCambioOrientacion);
    window.addEventListener('resize', gestionarCambioOrientacion);
    document.addEventListener('fullscreenchange', () => {
        const container = document.getElementById('vr-canvas-container');
        if (isVRMode && !document.fullscreenElement
            && container && !container.classList.contains('vr-fallback-fullscreen')) {
            salirModoVR();
        }
    });
    if (screen.orientation && screen.orientation.addEventListener) {
        screen.orientation.addEventListener('change', gestionarCambioOrientacion);
    }
}

function gestionarCambioOrientacion() {
    if (isVRMode) {
        actualizarAvisoOrientacion(!esOrientacionLandscape());
        onResizeVR();
    }
}

async function entrarModoVR() {
    const container = document.getElementById('vr-canvas-container');
    if (!container || isVRMode) return;

    isVRMode = true;
    isTourActive = false;
    controlsEnabledBeforeVR = controls ? controls.enabled : true;
    cameraBeforeVRPosition = camera.position.clone();
    cameraBeforeVRQuaternion = camera.quaternion.clone();
    cameraBeforeVRFov = camera.fov;
    controlsTargetBeforeVR = controls ? controls.target.clone() : null;
    camera.fov = cardboardFieldOfView;
    camera.near = cardboardNearClip;
    camera.updateProjectionMatrix();
    if (controls) controls.enabled = false;

    const tourButton = document.getElementById('btn-tour');
    if (tourButton) tourButton.innerText = "Recorrido 3D";
    actualizarAvisoOrientacion(false);
    actualizarEstadoSalidaVR(true);
    container.classList.add('cardboard-mask-active');
    actualizarEstadoBotonVR("Salir de VR");

    const modeText = document.getElementById('vr-mode-text');
    if (modeText) {
        modeText.innerText = "CARDBOARD VR (MODO ESTEREOSCÓPICO)";
        modeText.style.color = "#00e5ff";
    }

    actualizarAvisoOrientacion(!esOrientacionLandscape());
    if (container.requestFullscreen) {
        try {
            await container.requestFullscreen();
        } catch (error) {
            container.classList.add('vr-fallback-fullscreen');
            actualizarEstadoGiroscopio(
                "Pantalla completa bloqueada",
                `El navegador no permitió activar pantalla completa. Se usa la vista inmersiva alternativa. ${
                    error instanceof Error ? error.message : ""
                }`.trim()
            );
        }
    } else {
        container.classList.add('vr-fallback-fullscreen');
        actualizarEstadoGiroscopio(
            "Pantalla completa no disponible",
            "Este navegador no ofrece pantalla completa; se usa la vista inmersiva alternativa."
        );
    }
    if (document.fullscreenElement && screen.orientation && screen.orientation.lock) {
        try {
            await screen.orientation.lock("landscape");
        } catch (error) {
            actualizarEstadoGiroscopio(
                "Gira el celular",
                `El navegador no permitió fijar la orientación horizontal. Gira el celular manualmente. ${
                    error instanceof Error ? error.message : ""
                }`.trim()
            );
        }
    }
    setupGyroscope();
    onResizeVR();
}

function salirModoVR() {
    const container = document.getElementById('vr-canvas-container');
    isVRMode = false;
    if (modelRootGroup) modelRootGroup.scale.setScalar(1);
    actualizarAvisoOrientacion(false);
    if (container) {
        container.classList.remove('cardboard-mask-active', 'vr-fallback-fullscreen');
    }
    if (cameraBeforeVRPosition && cameraBeforeVRQuaternion) {
        camera.position.copy(cameraBeforeVRPosition);
        camera.quaternion.copy(cameraBeforeVRQuaternion);
        if (controls && controlsTargetBeforeVR) controls.target.copy(controlsTargetBeforeVR);
        camera.updateMatrixWorld(true);
    }
    if (cameraBeforeVRFov !== null) {
        camera.fov = cameraBeforeVRFov;
        camera.near = cardboardNearClip;
        camera.updateProjectionMatrix();
        cameraBeforeVRFov = null;
    }
    if (controls) controls.enabled = controlsEnabledBeforeVR;
    if (deviceOrientationHandler) {
        window.removeEventListener('deviceorientation', deviceOrientationHandler);
        deviceOrientationHandler = null;
    }
    if (gyroSignalTimeout !== null) {
        window.clearTimeout(gyroSignalTimeout);
        gyroSignalTimeout = null;
    }
    hasGyroReference = false;

    const modeText = document.getElementById('vr-mode-text');
    if (modeText) {
        modeText.innerText = "VISTA 3D ESTÁNDAR";
        modeText.style.color = "#00ff88";
    }
    actualizarEstadoGiroscopio("Inactivo");
    actualizarEstadoBotonVR("Modo VR Cardboard");
    actualizarEstadoSalidaVR(false);
    if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {
            const gyroStatus = document.getElementById('xr-gyro-status');
            if (gyroStatus) gyroStatus.innerText = "No se pudo cerrar pantalla completa";
        });
    }
    onResizeVR();
}

function actualizarAvisoOrientacion(visible) {
    const prompt = document.getElementById('vr-orientation-prompt');
    if (prompt) prompt.hidden = !visible;
}

function actualizarEstadoBotonVR(texto) {
    const button = document.getElementById('btn-toggle-vr');
    if (button) button.innerText = texto;
}

function actualizarEstadoSalidaVR(visible) {
    const button = document.getElementById('vr-exit-button');
    if (button) button.hidden = !visible;
}

function toggleVirtualTour() {
    isTourActive = !isTourActive;
    const btn = document.getElementById('btn-tour');
    if (btn) {
        btn.innerText = isTourActive ? "Pausar Recorrido" : "Recorrido 3D";
    }
}

function setupGyroscope() {
    actualizarEstadoGiroscopio("Esperando sensor");

    if (deviceOrientationHandler) {
        window.removeEventListener('deviceorientation', deviceOrientationHandler);
    }
    if (gyroSignalTimeout !== null) {
        window.clearTimeout(gyroSignalTimeout);
    }
    hasGyroReference = false;
    gyroSignalTimeout = window.setTimeout(() => {
        if (isVRMode && !hasGyroReference) {
            actualizarEstadoGiroscopio(
                "Sin señal",
                "Comprueba HTTPS, permisos de movimiento y orientación, y que el teléfono tenga sensores disponibles."
            );
        }
    }, 3000);

    deviceOrientationHandler = (event) => {
        if (!isVRMode || !Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;

        ns3DeviceEuler.set(
            THREE.MathUtils.degToRad(event.beta),
            THREE.MathUtils.degToRad(Number.isFinite(event.alpha) ? event.alpha : 0),
            THREE.MathUtils.degToRad(-event.gamma),
            'YXZ'
        );
        ns3DeviceQuaternion.setFromEuler(ns3DeviceEuler);

        const screenAngle = screen.orientation && Number.isFinite(screen.orientation.angle)
            ? screen.orientation.angle
            : (Number.isFinite(window.orientation) ? window.orientation : 0);

        // La corrección de cámara convierte los ejes del dispositivo a los de Three.js;
        // el ángulo de pantalla ya incluye el giro de 90° al pasar a landscape.
        ns3LandscapeQuaternion.setFromAxisAngle(ns3AxisX, -Math.PI / 2);
        ns3ScreenQuaternion.setFromAxisAngle(
            ns3ScreenOrientationAxis,
            THREE.MathUtils.degToRad(-screenAngle)
        );
        ns3DeviceQuaternion
            .multiply(ns3LandscapeQuaternion)
            .multiply(ns3ScreenQuaternion);

        if (!hasGyroReference) {
            camera.updateMatrixWorld(true);
            gyroReferenceQuaternion.copy(ns3DeviceQuaternion);
            gyroReferenceInverse.copy(gyroReferenceQuaternion).invert();
            gyroCameraAlignment.copy(gyroReferenceInverse).multiply(camera.quaternion);
            hasGyroReference = true;
            if (gyroSignalTimeout !== null) {
                window.clearTimeout(gyroSignalTimeout);
                gyroSignalTimeout = null;
            }
        }

        camera.quaternion.copy(ns3DeviceQuaternion).multiply(gyroCameraAlignment);
        camera.updateMatrixWorld(true);
        actualizarEstadoGiroscopio("Activo", "Se están recibiendo eventos del sensor de orientación.");
    };
    window.addEventListener('deviceorientation', deviceOrientationHandler, true);
}

function actualizarEstadoGiroscopio(texto, ayuda = "") {
    const gyroStatus = document.getElementById('xr-gyro-status');
    if (gyroStatus) {
        gyroStatus.innerText = texto;
        gyroStatus.title = ayuda;
    }
}

function initNS3MeshOverlay() {
    if (!scene || ns3OverlayGroup) return;
    ns3OverlayGroup = new THREE.Group();
    ns3OverlayGroup.name = "NS3 mesh topology";

    const connections = [
        { origin: "yl69", destination: "esp32" },
        { origin: "dht11", destination: "esp32" },
        { origin: "esp32", destination: "laptopgateway" }
    ];

    connections.forEach(connection => {
        const origin = ns3NodePositions[connection.origin].clone();
        const destination = ns3NodePositions[connection.destination].clone();
        origin.y += 0.12;
        destination.y += 0.12;
        const points = [origin, destination];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineDashedMaterial({
            color: 0x8aa092,
            dashSize: 0.16,
            gapSize: 0.1,
            transparent: true,
            opacity: 0.9,
            depthTest: false,
            toneMapped: false
        });
        const line = new THREE.Line(geometry, material);
        line.computeLineDistances();
        line.renderOrder = 10;
        line.userData.origin = connection.origin;
        line.userData.destination = connection.destination;
        ns3OverlayGroup.add(line);
        ns3Links[`${connection.origin}:${connection.destination}`] = line;
    });
    modelRootGroup.add(ns3OverlayGroup);
}

function getNS3Link(origenKey, destinoKey) {
    return ns3Links[`${origenKey}:${destinoKey}`]
        || ns3Links[`${destinoKey}:${origenKey}`]
        || null;
}

function aplicarMetricasNS3(latencyMs, packetLossPercent = 0, jitterMs = null) {
    const parsedLatency = Number(latencyMs);
    const parsedLoss = Number(packetLossPercent);
    const parsedJitter = jitterMs === null ? null : Number(jitterMs);
    if (!Number.isFinite(parsedLatency) || parsedLatency < 0) {
        throw new TypeError("La latencia NS-3 debe ser un número no negativo.");
    }
    if (!Number.isFinite(parsedLoss) || parsedLoss < 0 || parsedLoss > 100) {
        throw new TypeError("La pérdida de paquetes NS-3 debe estar entre 0 y 100.");
    }
    if (parsedJitter !== null && (!Number.isFinite(parsedJitter) || parsedJitter < 0)) {
        throw new TypeError("El jitter NS-3 debe ser un número no negativo.");
    }

    ns3LatencyMs = parsedLatency;
    ns3PacketLossPercent = parsedLoss;
    const jitterElement = document.getElementById('xr-jitter-val');
    if (jitterElement && parsedJitter !== null) {
        jitterElement.innerText = `${parsedJitter.toFixed(1)} ms`;
    } else if (jitterElement && lastQoSLatencyMs !== null) {
        jitterElement.innerText = `${Math.abs(parsedLatency - lastQoSLatencyMs).toFixed(1)} ms`;
    }
    lastQoSLatencyMs = parsedLatency;
    const lineColor = ns3LatencyMs > 100 || ns3PacketLossPercent > 5
        ? 0xff3344
        : ns3LatencyMs > 30 || ns3PacketLossPercent > 0
            ? 0xffcc33
            : 0x00ff88;
    Object.values(ns3Links).forEach(line => line.material.color.setHex(lineColor));
    const latencyElement = document.getElementById('xr-rtt-val');
    const lossElement = document.getElementById('xr-packet-loss-val');
    if (latencyElement) latencyElement.innerText = `${ns3LatencyMs.toFixed(1)} ms`;
    if (lossElement) lossElement.innerText = `${ns3PacketLossPercent.toFixed(1)} %`;
}

window.actualizarMetricasNS3 = function(latencyMs, packetLossPercent = 0, jitterMs = null) {
    aplicarMetricasNS3(latencyMs, packetLossPercent, jitterMs);
};

function actualizarEstadoNS3(text, color) {
    const statusElement = document.getElementById('xr-ns3-status');
    if (!statusElement) return;
    statusElement.innerText = text;
    statusElement.style.color = color;
}

async function consultarMetricasNS3() {
    try {
        const response = await fetch('/api/riego/ns3/metrics', { cache: 'no-store' });
        if (response.status === 404) {
            actualizarEstadoNS3('Esperando simulación', '#8aa092');
            return;
        }
        if (!response.ok) {
            throw new Error(`Error HTTP ${response.status} al leer las métricas NS-3.`);
        }

        const metrics = await response.json();
        if (!metrics || metrics.version !== 1 || typeof metrics.runId !== 'string' || !metrics.runId
            || !Number.isSafeInteger(metrics.sequence) || metrics.sequence < 0
            || !Number.isFinite(metrics.simulationTimeSeconds) || metrics.simulationTimeSeconds < 0
            || !Number.isFinite(metrics.rttMs) || metrics.rttMs < 0
            || !Number.isFinite(metrics.jitterMs) || metrics.jitterMs < 0
            || !Number.isFinite(metrics.packetLossPercent)
            || metrics.packetLossPercent < 0 || metrics.packetLossPercent > 100
            || !['activa', 'completada'].includes(metrics.simulationStatus)
            || !Array.isArray(metrics.packetEvents)) {
            throw new TypeError('El archivo de métricas NS-3 tiene un formato inválido.');
        }
        const packetEvents = metrics.packetEvents
            .filter(event => event && Number.isSafeInteger(event.id)
                && typeof event.origin === 'string' && typeof event.destination === 'string'
                && Number.isFinite(event.simulationTimeSeconds))
            .sort((left, right) => left.id - right.id);
        if (packetEvents.length !== metrics.packetEvents.length
            || packetEvents.some(event => !getNS3Link(event.origin, event.destination))) {
            throw new TypeError('El archivo de métricas NS-3 contiene eventos de paquete inválidos.');
        }
        if (metrics.runId !== ns3RunId) {
            ns3RunId = metrics.runId;
            lastNS3Sequence = -1;
            const historicalEventCutoff = metrics.simulationTimeSeconds - 1.5;
            lastNS3PacketEventId = packetEvents.reduce((latestId, event) =>
                event.simulationTimeSeconds < historicalEventCutoff
                    ? Math.max(latestId, event.id)
                    : latestId, 0);
        }
        if (metrics.sequence <= lastNS3Sequence) return;

        const jitter = metrics.jitterMs == null ? null : metrics.jitterMs;
        aplicarMetricasNS3(metrics.rttMs, metrics.packetLossPercent, jitter);

        packetEvents
            .filter(event => event.id > lastNS3PacketEventId)
            .forEach(event => {
                window.animarPaqueteNS3(event.origin, event.destination);
                lastNS3PacketEventId = event.id;
            });
        lastNS3Sequence = metrics.sequence;
        ns3MetricsError = null;
        const isRunning = metrics.simulationStatus === 'activa';
        actualizarEstadoNS3(
            isRunning ? 'Simulación activa' : 'Simulación completada',
            isRunning ? '#00ff88' : '#8aa092'
        );
    } catch (error) {
        if (ns3MetricsError !== error.message) {
            console.error('No se pudieron actualizar las métricas de NS-3:', error);
            ns3MetricsError = error.message;
        }
        actualizarEstadoNS3('Error de métricas', '#ff3344');
    } finally {
        window.setTimeout(consultarMetricasNS3, 1000);
    }
}

window.animarPaqueteNS3 = function(origenKey, destinoKey) {
    const origin = String(origenKey || "").toLowerCase();
    const destination = String(destinoKey || "").toLowerCase();
    const link = getNS3Link(origin, destination);
    if (!link) {
        throw new RangeError(`No existe un enlace NS-3 entre "${origin}" y "${destination}".`);
    }

    const forward = link.userData.origin === origin;
    const start = ns3NodePositions[forward ? origin : destination].clone();
    const end = ns3NodePositions[forward ? destination : origin].clone();
    const packet = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 20, 20),
        new THREE.MeshBasicMaterial({
            color: 0x00e5ff,
            transparent: true,
            opacity: 1,
            blending: THREE.AdditiveBlending,
            depthTest: false,
            toneMapped: false
        })
    );
    packet.position.copy(start);
    packet.renderOrder = 11;
    modelRootGroup.add(packet);
    ns3Packets.push({ mesh: packet, start, end, startedAt: performance.now(), duration: 1300 });
};

function actualizarPaquetesNS3(now) {
    ns3Packets = ns3Packets.filter(packet => {
        const progress = (now - packet.startedAt) / packet.duration;
        if (progress >= 1) {
            modelRootGroup.remove(packet.mesh);
            packet.mesh.geometry.dispose();
            packet.mesh.material.dispose();
            return false;
        }
        packet.mesh.position.lerpVectors(packet.start, packet.end, Math.max(0, progress));
        packet.mesh.material.opacity = 0.7 + Math.sin(progress * Math.PI) * 0.3;
        return true;
    });
}

function onVRGamepadConnected(event) {
    gamepadIndex = event.gamepad.index;
    lastGamepadButtons = [];
    console.info("Control VR conectado:", event.gamepad.id);
}

function onVRGamepadDisconnected(event) {
    if (gamepadIndex === event.gamepad.index) {
        gamepadIndex = null;
        lastGamepadButtons = [];
    }
    console.info("Control VR desconectado.");
}

function procesarEntradasGamepad(now) {
    if (!isVRMode || !navigator.getGamepads) return;
    const gamepads = navigator.getGamepads();
    let gamepad = gamepadIndex === null ? null : gamepads[gamepadIndex];
    if (!gamepad || !gamepad.connected) {
        gamepad = Array.from(gamepads).find(candidate => candidate && candidate.connected) || null;
        gamepadIndex = gamepad ? gamepad.index : null;
        if (!gamepad) {
            lastGamepadButtons = [];
            return;
        }
    }

    const deltaSeconds = Math.min(Math.max((now - lastGamepadFrameTime) / 1000, 0), 0.05);
    lastGamepadFrameTime = now;
    const axisX = applyGamepadDeadzone(gamepad.axes[0] || 0);
    const axisY = applyGamepadDeadzone(gamepad.axes[1] || 0);
    const modelScale = modelRootGroup ? modelRootGroup.scale.x : 1;
    const moveDistance = 1.6 * deltaSeconds * modelScale;

    if (Math.abs(axisX) > 0 || Math.abs(axisY) > 0) {
        const forward = camera.getWorldDirection(new THREE.Vector3());
        forward.y = 0;
        forward.normalize();
        const right = new THREE.Vector3(-forward.z, 0, forward.x);
        camera.position.addScaledVector(forward, -axisY * moveDistance);
        camera.position.addScaledVector(right, axisX * moveDistance);

        const target = cameraHomeTarget.clone().multiplyScalar(modelScale);
        const offset = camera.position.clone().sub(target);
        const minimumDistance = Math.max(0.65, modelScale * 1.1);
        const maximumDistance = Math.max(4.5, modelScale * 6);
        offset.clampLength(minimumDistance, maximumDistance);
        camera.position.copy(target).add(offset);
        camera.updateMatrixWorld(true);
    }

    const pressed = gamepad.buttons.map(button => button.pressed);
    const justPressed = index => pressed[index] && !lastGamepadButtons[index];
    if (justPressed(0)) interactuarConReticulaVR();
    if (justPressed(1)) {
        hasGyroReference = false;
        actualizarEstadoGiroscopio("Vista recalibrada", "Mantén la vista hacia el frente para recentrar el giroscopio.");
    }
    if ((pressed[2] || pressed[3]) && !(lastGamepadButtons[2] || lastGamepadButtons[3])) {
        alternarBombaConGamepad();
    }
    if (justPressed(4)) recentrarCamaraVR();
    lastGamepadButtons = pressed;
}

function applyGamepadDeadzone(value) {
    if (!Number.isFinite(value) || Math.abs(value) < 0.15) return 0;
    return Math.sign(value) * (Math.abs(value) - 0.15) / 0.85;
}

function interactuarConReticulaVR() {
    camera.updateMatrixWorld(true);
    vrRaycaster.setFromCamera(vrCenterPoint, camera);
    const intersections = vrRaycaster.intersectObjects(vrInteractiveTargets, false);
    if (!vrInteractionPanel) return;

    const target = intersections[0]?.object.userData.vrComponent;
    vrInteractionPanel.textContent = target
        ? `${target.name}\n${target.description}`
        : "No hay un componente interactivo en el centro.";
    vrInteractionPanel.style.whiteSpace = "pre-line";
    vrInteractionPanel.style.display = "block";
    if (vrInteractionPanel.hideTimer) window.clearTimeout(vrInteractionPanel.hideTimer);
    vrInteractionPanel.hideTimer = window.setTimeout(() => {
        vrInteractionPanel.style.display = "none";
    }, 3500);
}

function alternarBombaConGamepad() {
    if (typeof window.alternarBombaDesdeVR === "function") {
        window.alternarBombaDesdeVR();
        return;
    }
    console.error("El control VR no puede alternar la bomba: falta la integración con el dashboard.");
}

function recentrarCamaraVR() {
    const modelScale = modelRootGroup ? modelRootGroup.scale.x : 1;
    const target = cameraHomeTarget.clone().multiplyScalar(modelScale);
    const homeDirection = cameraHomePosition.clone().sub(cameraHomeTarget).normalize();
    const cameraDistance = Math.sqrt(cardboardViewingDistance ** 2 - (eyeSeparation / 2) ** 2);
    camera.position.copy(target).addScaledVector(homeDirection, cameraDistance);
    camera.lookAt(target);
    hasGyroReference = false;
    camera.updateMatrixWorld(true);
}

function animateVR() {
    requestAnimationFrame(animateVR);

    fpsCounter++;
    const now = performance.now();
    const deltaSeconds = Math.min((now - lastAnimationTime) / 1000, 0.05);
    lastAnimationTime = now;
    procesarEntradasGamepad(now);
    if (now - lastFrameTime >= 1000) {
        const fpsElement = document.getElementById('xr-fps-val');
        if (fpsElement) fpsElement.innerText = fpsCounter + " FPS";
        fpsCounter = 0;
        lastFrameTime = now;
    }

    // Animación de gotas y pulsación suave de los seis conos de aspersión.
    if (sprinklerActive) {
        volumetricCones.forEach((cone, index) => {
            cone.material.opacity = 0.055 + Math.sin(now * 0.003 + index) * 0.01;
        });
    }

    if (sprinklerParticles && sprinklerActive) {
        const positions = sprinklerParticles.geometry.attributes.position.array;

        for (let i = 0; i < particleData.length; i++) {
            const p = particleData[i];
            const asp = microaspersores[p.aspIndex];
            const idx = i * 3;

            p.age += deltaSeconds;
            p.vy -= 3.2 * deltaSeconds;
            positions[idx + 1] += p.vy * deltaSeconds;
            positions[idx] += p.vx * deltaSeconds;
            positions[idx + 2] += p.vz * deltaSeconds;

            // Reinicio al tocar el follaje del cultivo
            if (positions[idx + 1] <= 0.53) {
                respawnWaterParticle(i, p, asp);
            }
        }
        sprinklerParticles.geometry.attributes.position.needsUpdate = true;
    }

    if (isTourActive && !isVRMode) {
        tourAngle += 0.005;
        camera.position.x = Math.sin(tourAngle) * 6.8;
        camera.position.z = Math.cos(tourAngle) * 6.8;
        camera.position.y = 3.8 + Math.sin(tourAngle * 2) * 0.4;
        camera.lookAt(0, 1.1, 0);
    } else if (controls && controls.enabled) {
        controls.update();
    }
    actualizarPaquetesNS3(now);

    if (isVRMode) {
        renderStereoscopicCardboard();
    } else {
        const size = renderer.getSize(new THREE.Vector2());
        renderer.setViewport(0, 0, size.x, size.y);
        renderer.render(scene, camera);
    }
}

function renderStereoscopicCardboard() {
    const size = renderer.getSize(new THREE.Vector2());
    const width = Math.floor(size.x);
    const height = Math.floor(size.y);
    if (!width || !height) return;
    const halfWidth = Math.floor(width / 2);
    const rightWidth = width - halfWidth;
    const stereoAspect = halfWidth / height;
    const originalAspect = camera.aspect;
    const originalPosition = camera.position.clone();
    const cameraRight = ns3AxisX.clone().applyQuaternion(camera.quaternion).normalize();

    renderer.setScissorTest(true);

    camera.aspect = stereoAspect;
    camera.updateProjectionMatrix();
    camera.position.copy(originalPosition).addScaledVector(cameraRight, -eyeSeparation / 2);
    camera.updateMatrixWorld();
    renderer.setViewport(0, 0, halfWidth, height);
    renderer.setScissor(0, 0, halfWidth, height);
    renderer.render(scene, camera);

    camera.aspect = stereoAspect;
    camera.updateProjectionMatrix();
    camera.position.copy(originalPosition).addScaledVector(cameraRight, eyeSeparation / 2);
    camera.updateMatrixWorld();
    renderer.setViewport(halfWidth, 0, rightWidth, height);
    renderer.setScissor(halfWidth, 0, rightWidth, height);
    renderer.render(scene, camera);

    camera.position.copy(originalPosition);
    camera.updateMatrixWorld();
    camera.aspect = originalAspect;
    camera.updateProjectionMatrix();
    renderer.setScissorTest(false);
}

function onResizeVR() {
    const container = document.getElementById('vr-canvas-container');
    if (!container || !renderer) return;

    const aspect = container.clientWidth / container.clientHeight;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);

    if (isVRMode) {
        ajustarEncuadreVR(container);
    } else if (!isTourActive && aspect < 1.35) {
        const zoomOut = Math.min(1.7, 1.5 / aspect);
        const offset = cameraHomePosition.clone().sub(cameraHomeTarget).multiplyScalar(zoomOut);
        camera.position.copy(cameraHomeTarget).add(offset);
        camera.lookAt(cameraHomeTarget);
        if (controls && controls.enabled) controls.update();
    } else if (!isTourActive) {
        camera.position.copy(cameraHomePosition);
        camera.lookAt(cameraHomeTarget);
        if (controls && controls.enabled) controls.update();
    }
}

function ajustarEncuadreVR(container) {
    if (!cameraHomePosition || !cameraHomeTarget || !container.clientHeight) return;
    const eyeAspect = (container.clientWidth / 2) / container.clientHeight;
    if (!Number.isFinite(eyeAspect) || eyeAspect <= 0) return;

    const verticalFovTangent = Math.tan(THREE.MathUtils.degToRad(cardboardFieldOfView / 2));
    const visibleWidth = 2 * cardboardViewingDistance * verticalFovTangent * eyeAspect;
    const visibleHeight = 2 * cardboardViewingDistance * verticalFovTangent;
    const horizontalScale = visibleWidth / (2 * cardboardModelHalfWidth * cardboardFramingMargin);
    const verticalScale = visibleHeight / (2 * cardboardModelHalfHeight * cardboardFramingMargin);
    const modelScale = Math.min(1, horizontalScale, verticalScale);
    modelRootGroup.scale.setScalar(modelScale);

    const target = cameraHomeTarget.clone().multiplyScalar(modelScale);
    const viewDirection = cameraHomePosition.clone().sub(cameraHomeTarget).normalize();
    const eyeOffset = eyeSeparation / 2;
    const cameraDistance = Math.sqrt(cardboardViewingDistance ** 2 - eyeOffset ** 2);
    camera.position.copy(target).addScaledVector(viewDirection, cameraDistance);
    camera.lookAt(target);
}

// ----------------------------------------------------------------------------
// INTEGRACIÓN CON TELEMETRÍA EN TIEMPO REAL
// ----------------------------------------------------------------------------
function respawnWaterParticle(index, particle, sprinkler) {
    const angle = Math.random() * Math.PI * 2;
    const radialSpeed = 0.2 + Math.random() * 0.45;
    particle.vx = Math.cos(angle) * radialSpeed;
    particle.vy = 0.7 + Math.random() * 0.65;
    particle.vz = Math.sin(angle) * radialSpeed;
    particle.age = 0;
    particlePositions[index * 3] = sprinkler.x;
    particlePositions[index * 3 + 1] = sprinkler.y - 0.2;
    particlePositions[index * 3 + 2] = sprinkler.z;
}

function actualizarEstadoBombaVisual(isON) {
    const wasActive = sprinklerActive;
    sprinklerActive = isON;

    if (bombaLedMesh) {
        bombaLedMesh.material.color.setHex(isON ? 0x22c55e : 0xef4444);
    }
    volumetricCones.forEach(cone => {
        cone.material.opacity = isON ? 0.055 : 0;
    });
    if (sprinklerParticles) {
        sprinklerParticles.visible = isON;
        sprinklerParticles.material.opacity = isON ? 0.9 : 0;
        if (isON && !wasActive) {
            particleData.forEach((particle, index) => {
                respawnWaterParticle(index, particle, microaspersores[particle.aspIndex]);
            });
            sprinklerParticles.geometry.attributes.position.needsUpdate = true;
        }
    }

    const irrigationStatus = document.getElementById("vr-irrigation-status");
    const irrigationDot = document.getElementById("vr-irrigation-dot");
    const irrigationLabel = document.getElementById("vr-irrigation-label");
    if (irrigationStatus) irrigationStatus.classList.toggle("active", isON);
    if (irrigationDot) irrigationDot.className = `dot${isON ? " online" : ""}`;
    if (irrigationLabel) irrigationLabel.innerText = `${isON ? "MICROASPERSIÓN ACTIVA" : "RIEGO DETENIDO"} · 6 BOQUILLAS`;
}

window.actualizarEstadoBombaVR = function(isON) {
    actualizarEstadoBombaVisual(isON === true);
};

window.actualizarTelemetriaVR = function(humedad, temp, bombaEstado, rtt, humedadAmbiente, presionAtmosferica, nivelTanque, packetLossPercent) {
    const isON = (bombaEstado === "ENCENDIDA" || bombaEstado === "LOW" || bombaEstado === true);
    actualizarEstadoBombaVisual(isON);

    const soilValue = Number.isFinite(humedad) ? `${humedad.toFixed(1)}%` : "--%";
    const airValue = Number.isFinite(humedadAmbiente) ? `${humedadAmbiente.toFixed(0)}%` : "--%";
    const pressureValue = Number.isFinite(presionAtmosferica) ? `${presionAtmosferica.toFixed(0)} hPa` : "-- hPa";
    const tankValue = Number.isFinite(nivelTanque) ? `${nivelTanque.toFixed(0)}%` : "No medido";
    if (aguaTanqueMesh && Number.isFinite(nivelTanque)) {
        const fillRatio = THREE.MathUtils.clamp(nivelTanque, 0, 100) / 100;
        aguaTanqueMesh.scale.y = fillRatio;
        aguaTanqueMesh.position.y = 0.08 + 1.42 * fillRatio / 2;
        aguaTanqueMesh.visible = fillRatio > 0;
    }

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

    if (sueloMaterial) {
        if (humedad >= 60) sueloMaterial.color.setHex(0x231710);
        else if (humedad >= 40) sueloMaterial.color.setHex(0x3d271d);
        else sueloMaterial.color.setHex(0x614332);
    }

};

document.addEventListener('DOMContentLoaded', () => {
    initVRSystem();
    consultarMetricasNS3();
});