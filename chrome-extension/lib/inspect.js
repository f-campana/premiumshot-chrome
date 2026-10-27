import {Zoom} from './zoom.js';

export class Inspector {
  constructor(dialog, opener) {
    this.dialog = dialog;
    this.opener = opener;
    this.stage = dialog.querySelector('#inspect-stage');
    this.canvas = dialog.querySelector('#inspect-preview');
    this.zoom = new Zoom();
    this.pointer = null;
    this.fitButton = dialog.querySelector('#inspect-fit');
    this.actualButton = dialog.querySelector('#inspect-actual');
    this.outButton = dialog.querySelector('#inspect-out');
    this.inButton = dialog.querySelector('#inspect-in');

    this.fitButton.addEventListener('click', () => this.fit());
    this.actualButton.addEventListener('click', () => this.actual());
    this.outButton.addEventListener('click', () => this.zoomBy(1 / 1.25));
    this.inButton.addEventListener('click', () => this.zoomBy(1.25));
    dialog.querySelector('#inspect-done').addEventListener('click', () => this.close());
    dialog.addEventListener('close', () => {
      this.pointer = null;
      this.stage.classList.remove('panning');
      this.canvas.width = this.canvas.height = 1;
      if (this.opener.isConnected && !this.opener.disabled) this.opener.focus();
    });
    dialog.addEventListener('keydown', event => this.keydown(event));
    this.stage.addEventListener('wheel', event => this.wheel(event), {passive: false});
    this.stage.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      event.preventDefault();
      this.stage.focus();
      this.pointer = {id: event.pointerId, x: event.clientX, y: event.clientY};
      this.stage.setPointerCapture(event.pointerId);
      this.stage.classList.add('panning');
    });
    this.stage.addEventListener('pointermove', event => {
      if (this.pointer?.id !== event.pointerId) return;
      this.zoom.pan(event.clientX - this.pointer.x, event.clientY - this.pointer.y);
      this.pointer.x = event.clientX;
      this.pointer.y = event.clientY;
      this.paint();
    });
    this.stage.addEventListener('lostpointercapture', () => {
      this.pointer = null;
      this.stage.classList.remove('panning');
    });
    this.resizeObserver = new ResizeObserver(() => {
      if (!dialog.open) return;
      this.configure(this.atFit);
      this.paint();
    });
    this.resizeObserver.observe(this.stage);
  }

  get atFit() { return Math.abs(this.zoom.scale - this.zoom.fitScale) < .001; }

  open(source, transparent = false) {
    if (this.dialog.open) return;
    this.canvas.width = source.width;
    this.canvas.height = source.height;
    this.canvas.getContext('2d', {colorSpace: 'srgb'}).drawImage(source, 0, 0);
    this.stage.classList.toggle('transparent', transparent);
    this.dialog.querySelector('#inspect-dimensions').textContent = `${source.width.toLocaleString()} × ${source.height.toLocaleString()} px`;
    this.dialog.showModal();
    this.fit();
    this.stage.focus();
  }

  close() { if (this.dialog.open) this.dialog.close(); }

  configure(fit) {
    this.zoom.configure({
      width: this.canvas.width,
      height: this.canvas.height,
      viewportWidth: this.stage.clientWidth - 32,
      viewportHeight: this.stage.clientHeight - 32,
      backingScale: devicePixelRatio,
      fit,
    });
  }

  fit() {
    this.configure(true);
    this.paint();
  }

  actual() {
    this.configure(false);
    this.zoom.zoomTo(1);
    this.paint();
  }

  zoomBy(factor, anchorX = 0, anchorY = 0) {
    this.zoom.zoomTo(this.zoom.scale * factor, anchorX, anchorY);
    this.paint();
  }

  paint() {
    const {imageWidth, imageHeight, scale, x, y} = this.zoom;
    const width = imageWidth * scale, height = imageHeight * scale;
    let left = (this.stage.clientWidth - width) / 2 + x;
    let top = (this.stage.clientHeight - height) / 2 + y;
    if (Math.abs(scale - 1) < .001) {
      left = Math.round(left * devicePixelRatio) / devicePixelRatio;
      top = Math.round(top * devicePixelRatio) / devicePixelRatio;
    }
    Object.assign(this.canvas.style, {
      width: `${width}px`, height: `${height}px`,
      transform: `translate(${left}px, ${top}px)`,
      imageRendering: scale >= 1 ? 'pixelated' : 'auto',
    });
    this.fitButton.setAttribute('aria-pressed', String(this.atFit));
    this.actualButton.setAttribute('aria-pressed', String(Math.abs(scale - 1) < .001));
    this.outButton.disabled = scale <= this.zoom.floor + .0001;
    this.inButton.disabled = scale >= 4 - .0001;
    this.dialog.querySelector('#inspect-percent').textContent = `${Math.round(scale * 100)}%`;
    this.stage.classList.toggle('can-pan', width > this.zoom.viewportWidth || height > this.zoom.viewportHeight);
  }

  wheel(event) {
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? this.stage.clientHeight : 1;
    if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      this.zoom.pan(-event.deltaX * unit || -event.deltaY * unit, 0);
      this.paint();
    } else {
      const bounds = this.stage.getBoundingClientRect();
      const delta = Math.max(-200, Math.min(200, event.deltaY * unit));
      this.zoomBy(Math.exp(-delta * .002), event.clientX - bounds.left - this.stage.clientWidth / 2, event.clientY - bounds.top - this.stage.clientHeight / 2);
    }
  }

  keydown(event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === 'f' || key === '0') this.fit();
    else if (key === 'z' || key === '1') this.actual();
    else if (key === '+' || key === '=') this.zoomBy(1.25);
    else if (key === '-') this.zoomBy(1 / 1.25);
    else if (key.startsWith('arrow')) {
      const step = event.shiftKey ? 120 : 40;
      if (key === 'arrowleft') this.zoom.pan(step, 0);
      if (key === 'arrowright') this.zoom.pan(-step, 0);
      if (key === 'arrowup') this.zoom.pan(0, step);
      if (key === 'arrowdown') this.zoom.pan(0, -step);
      this.paint();
    } else return;
    event.preventDefault();
  }
}
