// Datos telemétricos originales registrados por SIRIA-W
const ledgerOriginal = [
  { id: 1, timestamp: "2026-10-19 10:00:00", humedad: 42.0, litros: 15.0, nodoId: "ESP32_NODE_01" },
  { id: 2, timestamp: "2026-10-19 12:00:00", humedad: 38.5, litros: 12.5, nodoId: "ESP32_NODE_01" },
  { id: 3, timestamp: "2026-10-19 14:00:00", humedad: 45.2, litros: 10.0, nodoId: "ESP32_NODE_02" }
];

let ledgerActual = JSON.parse(JSON.stringify(ledgerOriginal));

// Función para calcular Hash SHA-256 con Web Crypto API
async function generarSHA256(cadena) {
  const encoder = new TextEncoder();
  const data = encoder.encode(cadena);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Renderizado y Validación de la Cadena
async function renderizarBlockchain() {
  const container = document.getElementById('blockchain-container');
  container.innerHTML = '';

  let previousHash = "0000000000000000000000000000000000000000000000000000000000000000"; // Bloque Génesis
  let cadenaCorrompida = false;

  for (let i = 0; i < ledgerActual.length; i++) {
    const bloque = ledgerActual[i];
    // Contenido del Bloque que se firma
    const payload = `${bloque.id}|${bloque.timestamp}|${bloque.humedad}|${bloque.litros}|${bloque.nodoId}|${previousHash}`;
    const currentHash = await generarSHA256(payload);

    // Si un bloque previo fue corrompido o los datos cambiaron, la cadena rompe
    let esValido = true;
    if (i === 1 && bloque.litros !== ledgerOriginal[1].litros) {
      cadenaCorrompida = true;
    }
    if (cadenaCorrompida && i >= 1) {
      esValido = false;
    }

    // HTML del Bloque individual
    const blockHTML = `
      <div class="col-md-4">
        <div class="card bg-dark border-secondary block-card ${esValido ? '' : 'corrupted'} h-100 p-3">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="fw-bold ${esValido ? 'text-success' : 'text-danger'}">BLOQUE #${bloque.id}</span>
            <span class="badge ${esValido ? 'bg-success' : 'bg-danger'}">${esValido ? 'VÁLIDO (OK)' : 'CORROMPIDO'}</span>
          </div>
          <hr class="border-secondary my-2">
          <div class="small text-muted mb-1"><strong>Timestamp:</strong> ${bloque.timestamp}</div>
          <div class="small text-muted mb-1"><strong>Nodo SSI:</strong> ${bloque.nodoId}</div>
          <div class="small text-white mb-1"><strong>Humedad:</strong> ${bloque.humedad}%</div>
          <div class="small text-white mb-2"><strong>Volumen Riego:</strong> ${bloque.litros} L</div>
          <div class="mt-auto">
            <div class="text-muted extra-small">Previous Hash:</div>
            <div class="hash-text text-secondary mb-2">${previousHash.substring(0, 20)}...</div>
            <div class="text-muted extra-small">SHA-256 Hash:</div>
            <div class="hash-text ${esValido ? 'text-success' : 'text-danger'}">${currentHash.substring(0, 20)}...</div>
          </div>
        </div>
      </div>
    `;

    container.innerHTML += blockHTML;
    previousHash = currentHash; // Pasa el hash resultante como 'Previous Hash' al siguiente bloque
  }
}

// Función para simular alteración maliciosa en el Bloque 2
function simularAtaque() {
  const nuevoValor = parseFloat(document.getElementById('tamper-litros').value);
  ledgerActual[1].litros = nuevoValor;
  renderizarBlockchain();
}

// Función para restaurar la integridad
function restaurarCadena() {
  ledgerActual = JSON.parse(JSON.stringify(ledgerOriginal));
  document.getElementById('tamper-litros').value = 12.5;
  renderizarBlockchain();
}

// Inicializar la cadena al cargar la página
document.addEventListener('DOMContentLoaded', () => {
  renderizarBlockchain();
});