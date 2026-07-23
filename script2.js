(function() {
            class GhostCaptchaWidget {
                constructor() {
                    // Inject CSS first so it's ready
                    this.injectStyles();
                    
                    this.overlay = null;
                    this.modal = null;
                    this.canvas = null;
                    this.ctx = null;
                    
                    // Rendering state
                    this.animationId = null;
                    this.currentText = '';
                    this.width = 300;
                    this.height = 120;
                    this.dotSize = 2;
                    this.density = 0.5;
                    this.speed = 1.5;
                    this.noiseOffsetY = 0;
                    
                    // Buffers for Canvas
                    this.textCanvas = document.createElement('canvas');
                    this.textCtx = this.textCanvas.getContext('2d', { willReadFrequently: true });
                    this.noiseBufferCanvas = document.createElement('canvas');
                    this.noiseBufferCtx = this.noiseBufferCanvas.getContext('2d', { willReadFrequently: true });
                    this.staticTextNoiseBuffer = document.createElement('canvas');
                    this.staticTextNoiseCtx = this.staticTextNoiseBuffer.getContext('2d', { willReadFrequently: true });
                    
                    this.textMaskData = null;
                    this.staticTextNoiseData = null;

                    // Active instance data
                    this.activeCallback = null;
                    this.activeTriggerBtn = null;

                    // Build DOM and bind
                    this.initDOM();
                    this.bindTriggers();
                }

                injectStyles() {
                    // Check if styles already exist
                    if (document.getElementById('ghost-captcha-api-styles')) return;

                    const style = document.createElement('style');
                    style.id = 'ghost-captcha-api-styles';
                    style.innerHTML = `
                        /* Base Overlay */
                        .gc-api-overlay {
                            display: none;
                            position: fixed;
                            top: 0; left: 0; width: 100%; height: 100%;
                            background: rgba(0,0,0,0.75);
                            backdrop-filter: blur(4px);
                            z-index: 2147483646; /* High z-index */
                            opacity: 0;
                            transition: opacity 0.3s ease;
                        }
                        .gc-api-overlay.gc-show { display: block; opacity: 1; }

                        /* Modal Container - Uses CSS Variables from data attributes */
                        .gc-api-modal {
                            display: none;
                            position: fixed;
                            top: 50%; left: 50%;
                            transform: translate(-50%, -45%);
                            width: 100%; max-width: 420px;
                            padding: 2rem;
                            box-sizing: border-box;
                            border-radius: 0.75rem;
                            z-index: 2147483647;
                            opacity: 0;
                            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                            
                            /* Dynamic Variables applied via JS */
                            background-color: var(--gc-bg, #ffffff);
                            color: var(--gc-text, #000000);
                            border: 2px solid var(--gc-outline, #000000);
                            font-family: var(--gc-font, sans-serif);
                            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                        }
                        .gc-api-modal.gc-show { display: block; opacity: 1; transform: translate(-50%, -50%); }

                        /* Typography */
                        .gc-api-header { text-align: center; font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem; letter-spacing: 0.05em; }
                        .gc-api-subtitle { text-align: center; font-size: 0.875rem; margin-bottom: 1.5rem; opacity: 0.8; }

                        /* Canvas */
                        .gc-api-canvas-container {
                            position: relative;
                            border-radius: 0.5rem;
                            overflow: hidden;
                            margin-bottom: 1.5rem;
                            background-color: #000; /* ALWAYS black for static */
                            border: 4px solid var(--gc-outline, #000000); 
                            box-shadow: 0 4px 15px rgba(0,0,0,0.3) inset;
                        }
                        .gc-api-canvas-container canvas { display: block; width: 100%; height: auto; cursor: crosshair; }

                        /* Inputs & Buttons */
                        .gc-api-input-group { display: flex; gap: 0.75rem; margin-bottom: 1rem; }
                        .gc-api-input {
                            flex: 1;
                            background-color: transparent;
                            border: 2px solid var(--gc-outline, #000000);
                            color: var(--gc-text, #000000);
                            font-family: monospace; /* Input always monospace for clarity */
                            border-radius: 0.375rem;
                            padding: 0.75rem 1rem;
                            font-size: 1.25rem;
                            text-align: center;
                            letter-spacing: 0.2em;
                            text-transform: uppercase;
                            outline: none;
                            transition: border-color 0.2s;
                        }
                        .gc-api-input:focus { border-color: var(--gc-btn-bg, #000); }
                        .gc-api-input::placeholder { color: var(--gc-text, #000); opacity: 0.4; letter-spacing: normal; font-size: 0.875rem; font-family: var(--gc-font, sans-serif); }

                        .gc-api-refresh-btn {
                            background-color: transparent;
                            color: var(--gc-text, #000000);
                            border: 2px solid var(--gc-outline, #000000);
                            padding: 0.75rem;
                            border-radius: 0.375rem;
                            cursor: pointer;
                            display: flex; align-items: center; justify-content: center;
                            transition: all 0.2s;
                        }
                        .gc-api-refresh-btn:hover { background-color: var(--gc-outline, #000); color: var(--gc-bg, #fff); }

                        .gc-api-btn-verify {
                            width: 100%;
                            background-color: var(--gc-btn-bg, #000000);
                            color: var(--gc-btn-text, #ffffff);
                            border: 1px solid var(--gc-outline, transparent);
                            padding: 1rem 1.5rem;
                            border-radius: 0.375rem;
                            font-weight: 700;
                            font-size: 1.1rem;
                            font-family: var(--gc-font, sans-serif);
                            cursor: pointer;
                            transition: transform 0.1s, opacity 0.2s;
                            text-transform: uppercase;
                            letter-spacing: 0.05em;
                        }
                        .gc-api-btn-verify:hover { opacity: 0.9; }
                        .gc-api-btn-verify:active { transform: scale(0.98); }

                        /* Utils */
                        .gc-api-footer { display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; opacity: 0.6; margin-top: 1.5rem; }
                        .gc-api-close {
                            position: absolute; top: 1rem; right: 1.25rem;
                            background: transparent; border: none;
                            color: var(--gc-text, #000000);
                            font-size: 1.75rem; cursor: pointer;
                            line-height: 1; opacity: 0.5; padding: 0; margin: 0;
                        }
                        .gc-api-close:hover { opacity: 1; }
                        .gc-api-error-msg {
                            color: #ef4444; font-size: 0.875rem; text-align: center;
                            margin-top: 0.5rem; height: 1.25rem; font-weight: 600; font-family: sans-serif;
                        }
                    `;
                    document.head.appendChild(style);
                }

                initDOM() {
                    // Create overlay
                    this.overlay = document.createElement('div');
                    this.overlay.className = 'gc-api-overlay';
                    document.body.appendChild(this.overlay);

                    // Create Modal
                    this.modal = document.createElement('div');
                    this.modal.className = 'gc-api-modal';
                    
                    this.modal.innerHTML = `
                        <button class="gc-api-close" aria-label="Close" title="Close">&times;</button>
                        <div class="gc-api-header">Stuffnest Captcha</div>
                        <div class="gc-api-subtitle">Find the hidden code in the static.</div>
                        
                        <div class="gc-api-canvas-container">
                            <canvas id="gc-api-canvas-element" width="300" height="120"></canvas>
                        </div>
                        
                        <div class="gc-api-input-group">
                            <input type="text" class="gc-api-input" id="gc-api-input-element" placeholder="ENTER CODE" maxlength="6" autocomplete="off">
                            <button class="gc-api-refresh-btn" id="gc-api-refresh-element" title="New Code">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
                            </button>
                        </div>
                        
                        <button class="gc-api-btn-verify" id="gc-api-verify-element">Verify Human</button>
                        <div class="gc-api-error-msg" id="gc-api-error-element"></div>
                        
                        <div class="gc-api-footer">
                            <span>Protected by Stuffnest Captcha API</span>
                        </div>
                    `;
                    document.body.appendChild(this.modal);

                    // Cache elements
                    this.canvas = document.getElementById('gc-api-canvas-element');
                    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
                    this.input = document.getElementById('gc-api-input-element');
                    this.verifyBtn = document.getElementById('gc-api-verify-element');
                    this.refreshBtn = document.getElementById('gc-api-refresh-element');
                    this.closeBtn = this.modal.querySelector('.gc-api-close');
                    this.errorMsg = document.getElementById('gc-api-error-element');

                    // Setup offscreen canvas sizes
                    this.textCanvas.width = this.width;
                    this.textCanvas.height = this.height;
                    this.noiseBufferCanvas.width = this.width;
                    this.noiseBufferCanvas.height = this.height * 3;
                    this.staticTextNoiseBuffer.width = this.width;
                    this.staticTextNoiseBuffer.height = this.height;

                    // Bind internal events
                    this.closeBtn.addEventListener('click', () => this.close());
                    this.overlay.addEventListener('click', () => this.close());
                    this.refreshBtn.addEventListener('click', () => this.generateNewCode());
                    this.verifyBtn.addEventListener('click', () => this.verify());
                    this.input.addEventListener('keypress', (e) => {
                        if (e.key === 'Enter') this.verify();
                    });
                    this.input.addEventListener('input', (e) => {
                        e.target.value = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                        this.errorMsg.textContent = ''; 
                    });
                }

                bindTriggers() {
                    // Find all elements with data-ghost-captcha
                    const triggers = document.querySelectorAll('[data-ghost-captcha="true"]');
                    triggers.forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            e.preventDefault();
                            
                            // Extract configuration from data attributes (with fallbacks)
                            const config = {
                                callback: btn.getAttribute('data-callback'),
                                bg: btn.getAttribute('data-bg') || '#ffffff',
                                text: btn.getAttribute('data-text') || '#000000',
                                btnBg: btn.getAttribute('data-btn-bg') || '#000000',
                                btnText: btn.getAttribute('data-btn-text') || '#ffffff',
                                outline: btn.getAttribute('data-outline') || '#000000',
                                font: btn.getAttribute('data-font') || 'sans-serif'
                            };

                            this.open(config, btn);
                        });
                    });
                }

                open(config, triggerElement) {
                    this.activeCallback = config.callback;
                    this.activeTriggerBtn = triggerElement;

                    // Apply CSS variables to the modal to customize colors instantly
                    this.modal.style.setProperty('--gc-bg', config.bg);
                    this.modal.style.setProperty('--gc-text', config.text);
                    this.modal.style.setProperty('--gc-btn-bg', config.btnBg);
                    this.modal.style.setProperty('--gc-btn-text', config.btnText);
                    this.modal.style.setProperty('--gc-outline', config.outline);
                    this.modal.style.setProperty('--gc-font', config.font);

                    // Reset UI state
                    this.input.value = '';
                    this.errorMsg.textContent = '';
                    
                    // Show UI
                    this.overlay.style.display = 'block';
                    this.modal.style.display = 'block';
                    
                    // Trigger reflow for CSS transition animation
                    void this.modal.offsetWidth;
                    
                    this.overlay.classList.add('gc-show');
                    this.modal.classList.add('gc-show');

                    // Start engine
                    this.generateNewCode();
                    setTimeout(() => this.input.focus(), 100);
                }

                close() {
                    this.overlay.classList.remove('gc-show');
                    this.modal.classList.remove('gc-show');
                    
                    // Stop animation immediately to save CPU
                    if (this.animationId) {
                        cancelAnimationFrame(this.animationId);
                        this.animationId = null;
                    }

                    setTimeout(() => {
                        this.overlay.style.display = 'none';
                        this.modal.style.display = 'none';
                    }, 300); // match CSS transition duration
                }

                generateRandomString(length) {
                    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No ambiguous chars like 1, I, O, 0
                    let result = '';
                    for (let i = 0; i < length; i++) {
                        result += chars.charAt(Math.floor(Math.random() * chars.length));
                    }
                    return result;
                }

                generateStaticNoise(context, w, h) {
                    // STATIC IS ALWAYS BLACK AND WHITE regardless of theme
                    context.fillStyle = 'black';
                    context.fillRect(0, 0, w, h);
                    context.fillStyle = 'white';
                    for (let y = 0; y < h; y += this.dotSize) {
                        for (let x = 0; x < w; x += this.dotSize) {
                            if (Math.random() < this.density) {
                                context.fillRect(x, y, this.dotSize, this.dotSize);
                            }
                        }
                    }
                }

                renderTextMask(text) {
                    this.textCtx.fillStyle = 'black';
                    this.textCtx.fillRect(0, 0, this.width, this.height);
                    
                    this.textCtx.font = 'bold 54px monospace';
                    this.textCtx.textAlign = 'center';
                    this.textCtx.textBaseline = 'middle';
                    this.textCtx.fillStyle = 'white';
                    
                    const letterSpacing = 8;
                    const totalWidth = this.textCtx.measureText(text).width + (text.length - 1) * letterSpacing;
                    let startX = (this.width - totalWidth) / 2;
                    
                    for (let i = 0; i < text.length; i++) {
                        const char = text[i];
                        const charWidth = this.textCtx.measureText(char).width;
                        this.textCtx.fillText(char, startX + charWidth / 2, this.height / 2);
                        startX += charWidth + letterSpacing;
                    }
                    
                    this.textMaskData = this.textCtx.getImageData(0, 0, this.width, this.height).data;
                }

                generateNewCode() {
                    this.currentText = this.generateRandomString(4);
                    this.input.value = '';
                    this.errorMsg.textContent = '';
                    
                    // 1. Render text mask
                    this.renderTextMask(this.currentText);
                    
                    // 2. Render static noise for text
                    this.generateStaticNoise(this.staticTextNoiseCtx, this.width, this.height);
                    this.staticTextNoiseData = this.staticTextNoiseCtx.getImageData(0, 0, this.width, this.height).data;
                    
                    // 3. Render background scrolling noise buffer
                    this.generateStaticNoise(this.noiseBufferCtx, this.width, this.noiseBufferCanvas.height);
                    this.noiseOffsetY = 0;

                    // Start loop if not running
                    if (!this.animationId) {
                        this.renderFrame();
                    }
                }

                renderFrame = () => {
                    // Draw moving background
                    this.ctx.fillStyle = 'black';
                    this.ctx.fillRect(0, 0, this.width, this.height);
                    
                    const y1 = Math.floor(this.noiseOffsetY);
                    this.ctx.drawImage(this.noiseBufferCanvas, 0, y1, this.width, this.height, 0, 0, this.width, this.height);
                    
                    // Apply static noise over the text mask
                    const screenData = this.ctx.getImageData(0, 0, this.width, this.height);
                    const pixels = screenData.data;
                    const staticNoise = this.staticTextNoiseData;
                    const mask = this.textMaskData;

                    for (let i = 0; i < pixels.length; i += 4) {
                        if (mask[i] > 128) {
                            pixels[i] = staticNoise[i];
                            pixels[i+1] = staticNoise[i+1];
                            pixels[i+2] = staticNoise[i+2];
                        }
                    }
                    
                    this.ctx.putImageData(screenData, 0, 0);

                    // Update offset
                    this.noiseOffsetY += this.speed;
                    if (this.noiseOffsetY >= this.noiseBufferCanvas.height - this.height) {
                        this.noiseOffsetY = 0;
                    }

                    this.animationId = requestAnimationFrame(this.renderFrame);
                }

                verify() {
                    const userInput = this.input.value.toUpperCase().trim();
                    if (userInput === this.currentText) {
                        // Success!
                        const origText = this.verifyBtn.textContent;
                        this.verifyBtn.textContent = 'VERIFYING...';
                        
                        setTimeout(() => {
                            this.close();
                            
                            // Trigger JS callback if defined in global window scope
                            if (this.activeCallback && typeof window[this.activeCallback] === 'function') {
                                window[this.activeCallback]();
                            }
                            
                            // Reset button text for next time
                            setTimeout(() => { this.verifyBtn.textContent = origText; }, 300);
                        }, 400); 
                    } else {
                        // Failure - Shake animation
                        this.errorMsg.textContent = 'Incorrect code. Human verification failed.';
                        this.input.value = '';
                        this.input.focus();
                        this.modal.animate([
                            { transform: 'translate(-50%, -50%) translateX(-10px)' },
                            { transform: 'translate(-50%, -50%) translateX(10px)' },
                            { transform: 'translate(-50%, -50%) translateX(-10px)' },
                            { transform: 'translate(-50%, -50%) translateX(10px)' },
                            { transform: 'translate(-50%, -50%) translateX(0)' }
                        ], { duration: 400, easing: 'ease-in-out' });
                        
                        // Generate a new code to prevent guessing
                        this.generateNewCode();
                    }
                }
            }

            // Initialize the widget manager globally on window load
            // This replicates what happens when an external script finishes loading
            window.addEventListener('DOMContentLoaded', () => {
                window.GhostCaptchaAPI = new GhostCaptchaWidget();
            });

        })();
