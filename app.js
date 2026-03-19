// ============================================
// USA State SVG Icons — Application Logic
// Uses raw SVG markup from states-bundle.json
// ============================================

let STATE_DATA = [];
let currentState = null;
let selectedSize = 'lg';
let selectedFormat = 'svg';
let sortMode = 'asc';
let gridSize = 'lg';
let isInitialLoad = true;
const PINNED_SLUGS = ['usa', 'usa-v2', 'usa-full'];
const EXPORT_DIM = 800;
const EXPORT_PADDING = 80;
const PREVIEW_SIZES = { sm: 64, md: 128, lg: 200 };

// ---- Settings Getters ----

function getFillEnabled() {
  return document.getElementById('fillToggle').checked;
}
function getFillColor() {
  return document.getElementById('fillColor').value;
}
function getStrokeEnabled() {
  return document.getElementById('strokeToggle').checked;
}
function getStrokeColor() {
  return document.getElementById('strokeColor').value;
}
function getStrokeSize() {
  return parseFloat(document.getElementById('strokeSize').value);
}
function getBgEnabled() {
  return document.getElementById('bgToggle').checked;
}
function getBgColor() {
  return document.getElementById('bgColor').value;
}

// ---- SVG Manipulation ----

function parseSVG(svgString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  return doc.documentElement;
}

function expandViewBoxForStroke(svgEl) {
  const vb = svgEl.getAttribute('viewBox');
  if (!vb) return;

  if (!svgEl.dataset.originalViewBox) {
    svgEl.dataset.originalViewBox = vb;
  }

  const orig = svgEl.dataset.originalViewBox.split(/[\s,]+/).map(Number);
  if (orig.length !== 4) return;

  if (getStrokeEnabled()) {
    const svgWidth = parseFloat(svgEl.getAttribute('width') || orig[2]);
    const svgHeight = parseFloat(svgEl.getAttribute('height') || orig[3]);
    const scaleRatio = Math.max(orig[2] / svgWidth, orig[3] / svgHeight) || 1;
    const pad = getStrokeSize() * scaleRatio;
    svgEl.setAttribute('viewBox', `${orig[0] - pad} ${orig[1] - pad} ${orig[2] + pad * 2} ${orig[3] + pad * 2}`);
  } else {
    svgEl.setAttribute('viewBox', svgEl.dataset.originalViewBox);
  }
}

function applyColors(svgEl) {
  const paths = svgEl.querySelectorAll('path');
  paths.forEach(p => {
    const d = p.getAttribute('d') || '';
    if (!/[Zz]\s*$/.test(d.trim())) {
      p.setAttribute('d', d.trim() + 'Z');
    }

    if (getFillEnabled()) {
      p.setAttribute('fill', getFillColor());
    } else {
      p.setAttribute('fill', 'none');
    }

    if (getStrokeEnabled()) {
      p.setAttribute('stroke', getStrokeColor());
      p.setAttribute('stroke-width', getStrokeSize() * 2);
      p.setAttribute('stroke-linejoin', 'round');
      p.setAttribute('stroke-linecap', 'round');
      p.setAttribute('paint-order', 'stroke fill');
    } else {
      p.removeAttribute('stroke');
      p.removeAttribute('stroke-width');
      p.removeAttribute('stroke-linejoin');
      p.removeAttribute('stroke-linecap');
      p.removeAttribute('paint-order');
    }
  });

  expandViewBoxForStroke(svgEl);
  return svgEl;
}

function buildStyledSVG(state, size) {
  const raw = state[size] || state.md;
  const svgEl = parseSVG(raw);
  applyColors(svgEl);
  svgEl.removeAttribute('width');
  svgEl.removeAttribute('height');
  return svgEl;
}

function buildSVGString(state, size) {
  const raw = state[size] || state.md;
  const svgEl = parseSVG(raw);
  applyColors(svgEl);

  if (getBgEnabled()) {
    const vb = svgEl.getAttribute('viewBox');
    if (vb) {
      const parts = vb.split(/[\s,]+/).map(Number);
      const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bgRect.setAttribute('x', parts[0]);
      bgRect.setAttribute('y', parts[1]);
      bgRect.setAttribute('width', parts[2]);
      bgRect.setAttribute('height', parts[3]);
      bgRect.setAttribute('fill', getBgColor());
      svgEl.insertBefore(bgRect, svgEl.firstChild);
    }
  }

  const serializer = new XMLSerializer();
  return serializer.serializeToString(svgEl);
}

// ---- Toast ----

function showToast(message) {
  const toastEl = document.getElementById('copyToast');
  const toastMsg = document.getElementById('toastMessage');
  toastMsg.textContent = message;
  const toast = new bootstrap.Toast(toastEl, { delay: 2500 });
  toast.show();
}

// ---- Card-level copy ----

function copySVG(slug) {
  const state = STATE_DATA.find(s => s.slug === slug);
  if (!state) return;
  const svgStr = buildSVGString(state, gridSize);
  navigator.clipboard.writeText(svgStr).then(() => {
    showToast(`Copied "${state.name}".`);
  });
}

// ---- Modal ----

function openModal(slug) {
  currentState = STATE_DATA.find(s => s.slug === slug);
  if (!currentState) return;

  const isSingleSize = currentState.singleSize === true;

  selectedSize = isSingleSize ? 'lg' : gridSize;
  selectedFormat = 'svg';

  document.getElementById('modalTitle').textContent = currentState.name;

  // Show/hide size buttons based on singleSize
  const sizeButtonsWrap = document.querySelector('.size-buttons');
  const sizeSectionLabel = sizeButtonsWrap.previousElementSibling;
  if (isSingleSize) {
    sizeButtonsWrap.style.display = 'none';
    if (sizeSectionLabel && sizeSectionLabel.classList.contains('modal-section-label')) {
      sizeSectionLabel.style.display = 'none';
    }
  } else {
    sizeButtonsWrap.style.display = '';
    if (sizeSectionLabel && sizeSectionLabel.classList.contains('modal-section-label')) {
      sizeSectionLabel.style.display = '';
    }
  }

  updateModalPreview();

  document.querySelectorAll('.size-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.size === selectedSize);
  });
  document.querySelectorAll('.format-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.format === 'svg');
  });
  updateCopyButtonVisibility();

  const modal = new bootstrap.Modal(document.getElementById('downloadModal'));
  modal.show();
}

function updateModalPreview() {
  if (!currentState) return;
  const previewEl = document.getElementById('modalPreview');
  previewEl.innerHTML = '';

  const svgEl = buildStyledSVG(currentState, selectedSize);

  // Use larger preview for single-size entries
  let previewPx;
  if (currentState.singleSize) {
    previewPx = 350;
  } else {
    previewPx = PREVIEW_SIZES[selectedSize] || 200;
  }

  svgEl.style.width = previewPx + 'px';
  svgEl.style.height = previewPx + 'px';
  svgEl.style.maxWidth = previewPx + 'px';
  svgEl.style.maxHeight = previewPx + 'px';

  previewEl.appendChild(svgEl);
  previewEl.style.background = getBgEnabled() ? getBgColor() : '';
}

function updateCopyButtonVisibility() {
  const copyBtn = document.getElementById('btnCopy');
  copyBtn.style.display = selectedFormat === 'svg' ? '' : 'none';
}

// ---- Download ----

function handleDownload() {
  if (!currentState) return;
  const baseName = currentState.slug;

  if (selectedFormat === 'svg') {
    const svgStr = buildSVGString(currentState, selectedSize);
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    triggerDownload(blob, `${baseName}-${selectedSize}.svg`);
  } else {
    downloadAsImage(baseName, selectedFormat);
  }
}

function downloadAsImage(baseName, format) {
  const svgStr = buildSVGString(currentState, selectedSize);
  const canvas = document.getElementById('exportCanvas');
  canvas.width = EXPORT_DIM;
  canvas.height = EXPORT_DIM;
  const ctx = canvas.getContext('2d');

  if (format === 'jpg') {
    ctx.fillStyle = getBgEnabled() ? getBgColor() : '#ffffff';
    ctx.fillRect(0, 0, EXPORT_DIM, EXPORT_DIM);
  } else {
    ctx.clearRect(0, 0, EXPORT_DIM, EXPORT_DIM);
    if (getBgEnabled()) {
      ctx.fillStyle = getBgColor();
      ctx.fillRect(0, 0, EXPORT_DIM, EXPORT_DIM);
    }
  }

  const img = new Image();
  const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  img.onload = function () {
    const maxW = EXPORT_DIM - EXPORT_PADDING * 2;
    const maxH = EXPORT_DIM - EXPORT_PADDING * 2;
    const aspect = img.naturalWidth / img.naturalHeight;
    let drawW, drawH;
    if (aspect > 1) {
      drawW = maxW;
      drawH = maxW / aspect;
    } else {
      drawH = maxH;
      drawW = maxH * aspect;
    }
    const drawX = (EXPORT_DIM - drawW) / 2;
    const drawY = (EXPORT_DIM - drawH) / 2;

    ctx.drawImage(img, drawX, drawY, drawW, drawH);
    URL.revokeObjectURL(url);

    const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
    const quality = format === 'jpg' ? 0.95 : undefined;

    canvas.toBlob(function (blob) {
      triggerDownload(blob, `${baseName}-${selectedSize}.${format}`);
    }, mimeType, quality);
  };

  img.src = url;
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---- Copy from modal ----

function handleCopy() {
  if (!currentState) return;
  const svgStr = buildSVGString(currentState, selectedSize);
  navigator.clipboard.writeText(svgStr).then(() => {
    showToast(`Copied "${currentState.name}" (${selectedSize}).`);
  });
}

// ---- Render cards ----

function getDisplayOrder() {
  let sorted;
  if (sortMode === 'desc') {
    sorted = [...STATE_DATA].sort((a, b) => b.name.localeCompare(a.name));
  } else {
    sorted = [...STATE_DATA].sort((a, b) => a.name.localeCompare(b.name));
  }

  // On initial load, pin USA icons to the front
  if (isInitialLoad) {
    const pinned = [];
    const rest = [];
    // Collect pinned items in defined order
    for (const slug of PINNED_SLUGS) {
      const found = sorted.find(s => s.slug === slug);
      if (found) pinned.push(found);
    }
    // Collect everything else
    for (const s of sorted) {
      if (!PINNED_SLUGS.includes(s.slug)) rest.push(s);
    }
    return [...pinned, ...rest];
  }

  return sorted;
}

function renderCards() {
  const grid = document.getElementById('stateGrid');
  grid.innerHTML = '';
  const states = getDisplayOrder();

  states.forEach((state, i) => {
    const col = document.createElement('div');
    col.className = 'col-6 col-sm-4 col-md-3 col-lg-2';

    const card = document.createElement('div');
    card.className = 'state-card';
    card.style.cssText = `--i:${i}`;
    card.dataset.name = state.name;
    card.dataset.slug = state.slug;

    const preview = document.createElement('div');
    preview.className = 'card-preview';
    preview.addEventListener('click', () => openModal(state.slug));

    const svgEl = buildStyledSVG(state, gridSize);
    preview.appendChild(svgEl);

    if (getBgEnabled()) {
      preview.style.background = getBgColor();
    }

    const info = document.createElement('div');
    info.className = 'card-info';
    info.innerHTML = `
      <span class="state-name">${state.name}</span>
      <div class="card-actions">
        <button class="card-btn" title="Copy SVG">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="11" height="11" rx="2"/><path d="M6 14H5a2 2 0 01-2-2V5a2 2 0 012-2h7a2 2 0 012 2v1"/></svg>
        </button>
        <button class="card-btn" title="Download">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 3v10m0 0l-4-4m4 4l4-4M3 17h14"/></svg>
        </button>
      </div>`;

    const btns = info.querySelectorAll('.card-btn');
    btns[0].addEventListener('click', (e) => { e.stopPropagation(); copySVG(state.slug); });
    btns[1].addEventListener('click', (e) => { e.stopPropagation(); openModal(state.slug); });

    card.appendChild(preview);
    card.appendChild(info);
    col.appendChild(card);
    grid.appendChild(col);
  });
}

// ---- Update all card previews ----

function updateAllPreviews() {
  const cards = document.querySelectorAll('.state-card');
  const bgEnabled = getBgEnabled();
  const bgColor = getBgColor();

  cards.forEach(card => {
    const slug = card.dataset.slug;
    const state = STATE_DATA.find(s => s.slug === slug);
    if (!state) return;

    const preview = card.querySelector('.card-preview');
    preview.innerHTML = '';
    const svgEl = buildStyledSVG(state, gridSize);
    preview.appendChild(svgEl);
    preview.style.background = bgEnabled ? bgColor : '';
  });

  updateModalPreview();
}

// ---- Search ----

function initSearch() {
  const searchInput = document.getElementById('searchInput');
  const noResults = document.getElementById('noResults');
  const grid = document.getElementById('stateGrid');

  searchInput.addEventListener('input', function () {
    const query = this.value.toLowerCase().trim();
    const cols = grid.querySelectorAll('.col-6');
    let visibleCount = 0;

    cols.forEach(col => {
      const card = col.querySelector('.state-card');
      const name = card.dataset.name.toLowerCase();
      if (!query || name.includes(query)) {
        col.style.display = '';
        visibleCount++;
      } else {
        col.style.display = 'none';
      }
    });

    noResults.style.display = visibleCount === 0 ? '' : 'none';
  });
}

// ---- Sort ----

function initSort() {
  const sortBtn = document.getElementById('sortToggle');
  const sortLabel = sortBtn.querySelector('.sort-label');

  sortBtn.addEventListener('click', () => {
    isInitialLoad = false;
    sortMode = sortMode === 'asc' ? 'desc' : 'asc';
    sortLabel.textContent = sortMode === 'asc' ? 'A–Z' : 'Z–A';
    renderCards();
  });
}

// ---- Grid Size Toggle ----

function initGridSize() {
  document.querySelectorAll('.grid-size-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      gridSize = btn.dataset.gridSize;
      document.querySelectorAll('.grid-size-btn').forEach(b => b.classList.toggle('active', b === btn));
      updateAllPreviews();
    });
  });
}

// ---- Theme Toggle ----

function initTheme() {
  const toggle = document.getElementById('themeToggle');
  const html = document.documentElement;

  // Check saved preference, default to dark
  const saved = localStorage.getItem('theme');
  if (saved) {
    html.setAttribute('data-theme', saved);
  }
  // Default is already dark in HTML, no need for prefers-color-scheme fallback

  toggle.addEventListener('click', () => {
    const current = html.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  });
}

// ---- Hex input sync ----

function syncHexAndSwatch(hexInput, swatchInput) {
  hexInput.addEventListener('input', () => {
    let val = hexInput.value.trim();
    if (!val.startsWith('#')) val = '#' + val;
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      swatchInput.value = val;
      hexInput.value = val.toLowerCase();
      updateAllPreviews();
    }
  });
  hexInput.addEventListener('blur', () => {
    let val = hexInput.value.trim();
    if (!val.startsWith('#')) val = '#' + val;
    if (!/^#[0-9a-fA-F]{6}$/.test(val)) {
      hexInput.value = swatchInput.value;
    }
  });
  swatchInput.addEventListener('input', () => {
    hexInput.value = swatchInput.value.toLowerCase();
    updateAllPreviews();
  });
}

// ---- Controls ----

function initControls() {
  // Fill
  const fillToggle = document.getElementById('fillToggle');
  const fillHex = document.getElementById('fillHex');
  const fillColor = document.getElementById('fillColor');
  const fillWrap = document.getElementById('fillWrap');
  fillToggle.addEventListener('change', () => {
    const on = fillToggle.checked;
    fillHex.disabled = !on;
    fillColor.disabled = !on;
    fillWrap.classList.toggle('disabled', !on);
    updateAllPreviews();
  });
  syncHexAndSwatch(fillHex, fillColor);

  // Stroke
  const strokeToggle = document.getElementById('strokeToggle');
  const strokeHex = document.getElementById('strokeHex');
  const strokeColor = document.getElementById('strokeColor');
  const strokeWrap = document.getElementById('strokeWrap');
  const strokeSizeGroup = document.getElementById('strokeSizeGroup');
  strokeToggle.addEventListener('change', () => {
    const on = strokeToggle.checked;
    strokeHex.disabled = !on;
    strokeColor.disabled = !on;
    strokeWrap.classList.toggle('disabled', !on);
    strokeSizeGroup.style.opacity = on ? '1' : '0.4';
    strokeSizeGroup.style.pointerEvents = on ? 'auto' : 'none';
    updateAllPreviews();
  });
  syncHexAndSwatch(strokeHex, strokeColor);

  // Stroke size
  const strokeSize = document.getElementById('strokeSize');
  const strokeSizeVal = document.getElementById('strokeSizeVal');
  strokeSize.addEventListener('input', () => {
    strokeSizeVal.textContent = strokeSize.value;
    updateAllPreviews();
  });

  // Background
  const bgToggle = document.getElementById('bgToggle');
  const bgHex = document.getElementById('bgHex');
  const bgColor = document.getElementById('bgColor');
  const bgWrap = document.getElementById('bgWrap');
  bgToggle.addEventListener('change', () => {
    const on = bgToggle.checked;
    bgHex.disabled = !on;
    bgColor.disabled = !on;
    bgWrap.classList.toggle('disabled', !on);
    updateAllPreviews();
  });
  syncHexAndSwatch(bgHex, bgColor);

  // Modal size buttons
  document.querySelectorAll('.size-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedSize = btn.dataset.size;
      document.querySelectorAll('.size-btn').forEach(b => b.classList.toggle('active', b === btn));
      updateModalPreview();
    });
  });

  // Modal format buttons
  document.querySelectorAll('.format-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedFormat = btn.dataset.format;
      document.querySelectorAll('.format-btn').forEach(b => b.classList.toggle('active', b === btn));
      updateCopyButtonVisibility();
    });
  });

  // Modal actions
  document.getElementById('btnDownload').addEventListener('click', handleDownload);
  document.getElementById('btnCopy').addEventListener('click', handleCopy);
}

// ---- Notification Box ----

function initNotification() {
  const box = document.getElementById('notificationBox');
  const closeBtn = document.getElementById('notificationClose');
  if (!box || !closeBtn) return;

  let shown = false;

  // Show after user scrolls
  window.addEventListener('scroll', () => {
    if (shown) return;
    if (window.scrollY > 100) {
      shown = true;
      box.classList.remove('notification-hidden');
      box.classList.add('notification-visible');
    }
  }, { passive: true });

  // Close
  closeBtn.addEventListener('click', () => {
    box.classList.remove('notification-visible');
    box.classList.add('notification-closing');
    setTimeout(() => box.remove(), 300);
  });
}

// ---- Boot ----

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initNotification();

  try {
    const resp = await fetch('states-bundle.json');
    STATE_DATA = await resp.json();
  } catch (e) {
    console.error('Failed to load states bundle:', e);
    STATE_DATA = [];
  }

  renderCards();
  initSearch();
  initSort();
  initGridSize();
  initControls();
});
