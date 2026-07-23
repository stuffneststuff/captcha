(function() {
            // 1. Inject CSS for the modal dynamically so no external CSS file is needed
            const styles = `
                .gc-overlay {
                    display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background: rgba(0,0,0,0.6); z-index: 99998; backdrop-filter: blur(2px);
                    opacity: 0; transition: opacity 0.3s ease;
                }
                .gc-overlay.gc-show { display: block; opacity: 1; }
                
                .gc-modal {
                    display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -45%);
                    width: 90%; max-w-sm; z-index: 99999;
                    background-color: var(--gc-bg); color: var(--gc-text); font-family: var(--gc-font);
                    padding: 1.5rem; border-radius: 0.75rem; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                    border: 1px solid var(--gc-outline);
                    opacity: 0; transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }
                .gc-modal.gc-show { display: block; opacity: 1; transform: translate(-50%, -50%); }
                
                .gc-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
                .gc-title { font-size: 1.25rem; font-weight: bold; margin: 0; }
                .gc-close { cursor: pointer; background: none; border: none; font-size: 1.5rem; color: var(--gc-text); opacity: 0.7; }
                .gc-close:hover { opacity: 1; }
                
                .gc-canvas-container { 
                    border: 2px solid var(--gc-outline); border-radius: 0.375rem; overflow: hidden; 
                    margin-bottom: 1rem; background: #000; padding: 2px;
                }
                .gc-canvas { display: block; width: 100%; height: auto; }
                
                .gc-input-group { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
                .gc-input { 
                    flex: 1; padding: 0.75rem; font-size: 1.25rem; text-align: center; letter-spacing: 0.25em; text-transform: uppercase;
                    background: transparent; color: var(--gc-text); border: 2px solid var(--gc-outline); border-radius: 0.375rem;
                    font-family: monospace; font-weight: bold; outline: none; transition: border-color 0.2s;
                }
                .gc-input:focus { border-color: var(--gc-btn-bg); }
                
                .gc-btn-verify {
                    background-color: var(--gc-btn-bg); color: var(--gc-btn-text);
                    border: none; padding: 0.75rem 1.5rem; border-radius: 0.375rem; font-weight: bold; font-family: inherit;
                    cursor: pointer; transition: opacity 0.2s; width: 100%; font-size: 1rem;
                }
                .gc-btn-verify:hover { opacity: 0.9; }
                
                .gc-btn-refresh {
                    background: transparent; color: var(--gc-text); border: 2px solid var(--gc-outline);
                    padding: 0.75rem; border-radius: 0.375rem; cursor: pointer; display: flex; align-items: center; justify-content: center;
                }
                .gc-btn-refresh:hover { background-color: rgba(128,128,128,0.1); }
                
                .gc-error { color: #ef4444; font-size: 0.875rem; margin-bottom: 0.5rem; text-align: center; min-height: 1.25rem; font-weight: bold;}
                .gc-footer { font-size: 0.75rem; text-align: center; opacity: 0.6; margin-top: 1rem; }
            `;
            const styleTag = document.createElement('style');
            styleTag.textContent = styles;
            document.head.appendChild(styleTag);

            class GhostCaptcha {
                constructor() {
                    this.initialized = false;
                    this.width = 320;
                    this.height = 100;
                    this.dotSize = 2;
                    this.density = 0.45;
                    this.animationId = null;
                    
                    // Core Canvas State
                    this.currentText = '';
                    this.noiseOffsetY = 0;
                    this.textMaskData = null;
                    this.staticTextNoiseData = null;

                    // Active instance data
                    this.activeCallback = null;
                    this.activeTriggerBtn = null;

                    // Smart Bot Detection State
                    this.mouseMoveCount = 0;
                    this.startTime = 0;
                    this.attempts = 0;
                    this.difficulty = 4;
                    this.maxDifficulty = 6;
                    this.speed = 1.5;

                    this.initDOM();
                    this.bindTriggers();
                }

                // Create the required HTML structure and append to body
                initDOM() {
                    this.overlay = document.createElement('div');
                    this.overlay.className = 'gc-overlay';
                    
                    this.modal = document.createElement('div');
                    this.modal.className = 'gc-modal';
                    this.modal.style.maxWidth = '400px';

                    this.modal.innerHTML = `
                        <div class="gc-header">
                        <div class="gc-title">Stuffnest Captcha</div>
                        <div class="gc-subtitle">Enter the code in the static.</div>
                            <button class="gc-close" aria-label="Close">&times;</button>
                        </div>
                        <div class="gc-error" id="gc-error-msg"></div>
                        <div class="gc-canvas-container">
                            <canvas id="gc-main-canvas" width="${this.width}" height="${this.height}" class="gc-canvas"></canvas>
                        </div>
                        <div class="gc-input-group">
                            <input type="text" id="gc-input" class="gc-input" placeholder="Enter" autocomplete="off" maxlength="6">
                            <button id="gc-btn-refresh" class="gc-btn-refresh" title="New Code">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
                            </button>
                        </div>
                        <button id="gc-btn-verify" class="gc-btn-verify">Verify</button>
                        <div class="gc-footer">Protected by Stuffnest Captcha API</div>
                    `;

                    document.body.appendChild(this.overlay);
                    document.body.appendChild(this.modal);

                    // DOM Element References
                    this.canvas = document.getElementById('gc-main-canvas');
                    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
                    this.input = document.getElementById('gc-input');
                    this.verifyBtn = document.getElementById('gc-btn-verify');
                    this.refreshBtn = document.getElementById('gc-btn-refresh');
                    this.closeBtn = this.modal.querySelector('.gc-close');
                    this.errorMsg = document.getElementById('gc-error-msg');

                    // Setup offscreen canvases for rendering math
                    this.textCanvas = document.createElement('canvas');
                    this.textCanvas.width = this.width;
                    this.textCanvas.height = this.height;
                    this.textCtx = this.textCanvas.getContext('2d');

                    this.noiseBufferCanvas = document.createElement('canvas');
                    this.noiseBufferCanvas.width = this.width;
                    this.noiseBufferCanvas.height = this.height * 3;
                    this.noiseBufferCtx = this.noiseBufferCanvas.getContext('2d', { willReadFrequently: true });

                    this.textNoiseCanvas = document.createElement('canvas');
                    this.textNoiseCanvas.width = this.width;
                    this.textNoiseCanvas.height = this.height;
                    this.textNoiseCtx = this.textNoiseCanvas.getContext('2d', { willReadFrequently: true });

                    // Bind internal events
                    this.closeBtn.addEventListener('click', () => this.close());
                    this.overlay.addEventListener('click', () => this.close());
                    
                    // Smart detection: track interactions to weed out basic bots
                    this.modal.addEventListener('mousemove', () => this.mouseMoveCount++);
                    this.modal.addEventListener('touchstart', () => this.mouseMoveCount++, {passive: true});

                    this.refreshBtn.addEventListener('click', () => this.generateNewCode());
                    this.verifyBtn.addEventListener('click', () => this.verify());
                    this.input.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.verify(); });
                    this.input.addEventListener('input', function() {
                        this.value = this.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                    });

                    // Pre-generate background noise buffer once
                    this.generateNoise(this.noiseBufferCtx, this.width, this.noiseBufferCanvas.height);

                    // Bind render method to preserve context
                    this.renderFrame = this.renderFrame.bind(this);
                    this.initialized = true;
                }

                // Find all buttons that want to use the captcha and attach events
                bindTriggers() {
                    const triggers = document.querySelectorAll('[data-captcha-trigger]');
                    triggers.forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            e.preventDefault();
                            
                            // Parse configurations from data attributes
                            const config = {
                                callback: btn.getAttribute('data-callback'),
                                bg: btn.getAttribute('data-bg') || '#ffffff',
                                text: btn.getAttribute('data-text') || '#000000',
                                btnBg: btn.getAttribute('data-btn-bg') || '#000000',
                                btnText: btn.getAttribute('data-btn-text') || '#ffffff',
                                outline: btn.getAttribute('data-outline') || '#cccccc',
                                font: btn.getAttribute('data-font') || 'sans-serif',
                                difficulty: parseInt(btn.getAttribute('data-difficulty')) || 4,
                                speed: parseFloat(btn.getAttribute('data-speed')) || 1.5
                            };

                            this.open(config, btn);
                        });
                    });
                }

                open(config, triggerElement) {
                    this.activeCallback = config.callback;
                    this.activeTriggerBtn = triggerElement;

                    // Apply Smart Bot Configs
                    this.difficulty = Math.min(Math.max(config.difficulty, 3), this.maxDifficulty);
                    this.speed = config.speed;
                    
                    // Reset interaction trackers
                    this.mouseMoveCount = 0;
                    this.attempts = 0;
                    
                    // Apply CSS variables to the modal for custom styling
                    this.modal.style.setProperty('--gc-bg', config.bg);
                    this.modal.style.setProperty('--gc-text', config.text);
                    this.modal.style.setProperty('--gc-btn-bg', config.btnBg);
                    this.modal.style.setProperty('--gc-btn-text', config.btnText);
                    this.modal.style.setProperty('--gc-outline', config.outline);
                    this.modal.style.setProperty('--gc-font', config.font);

                    this.overlay.classList.add('gc-show');
                    this.modal.classList.add('gc-show');

                    // Start engine
                    this.generateNewCode();
                    
                    // Record start time
                    this.startTime = Date.now();
                    setTimeout(() => this.input.focus(), 100);
                }

                close() {
                    this.overlay.classList.remove('gc-show');
                    this.modal.classList.remove('gc-show');
                    if (this.animationId) {
                        cancelAnimationFrame(this.animationId);
                        this.animationId = null;
                    }
                    this.input.value = '';
                    this.errorMsg.textContent = '';
                }

                generateRandomString(length) {
                    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No ambiguous chars
                    let result = '';
                    for (let i = 0; i < length; i++) {
                        result += chars.charAt(Math.floor(Math.random() * chars.length));
                    }
                    return result;
                }

                generateNoise(context, w, h) {
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
                    
                    // Space out characters
                    const spacing = 12;
                    let totalW = 0;
                    for(let i=0; i<text.length; i++) totalW += this.textCtx.measureText(text[i]).width + spacing;
                    totalW -= spacing;
                    
                    let startX = (this.width - totalW) / 2;
                    for (let i = 0; i < text.length; i++) {
                        const charW = this.textCtx.measureText(text[i]).width;
                        this.textCtx.fillText(text[i], startX + charW / 2, this.height / 2);
                        startX += charW + spacing;
                    }
                    
                    this.textMaskData = this.textCtx.getImageData(0, 0, this.width, this.height).data;
                }

                generateNewCode() {
                    this.currentText = this.generateRandomString(this.difficulty);
                    this.input.value = '';
                    this.errorMsg.textContent = '';
                    this.startTime = Date.now(); // Reset timer on new code
                    
                    this.renderTextMask(this.currentText);
                    
                    // Generate new static noise specifically for the text area
                    this.generateNoise(this.textNoiseCtx, this.width, this.height);
                    this.staticTextNoiseData = this.textNoiseCtx.getImageData(0, 0, this.width, this.height).data;
                    
                    this.noiseOffsetY = 0;
                    
                    if (!this.animationId) {
                        this.animationId = requestAnimationFrame(this.renderFrame);
                    }
                }

                // The magic visual loop: Moving background vs Static text
                renderFrame() {
                    // 1. Draw moving background noise
                    const y1 = Math.floor(this.noiseOffsetY);
                    this.ctx.drawImage(this.noiseBufferCanvas, 0, y1, this.width, this.height, 0, 0, this.width, this.height);
                    
                    const screenData = this.ctx.getImageData(0, 0, this.width, this.height);
                    const pixels = screenData.data;
                    const staticNoise = this.staticTextNoiseData;
                    const mask = this.textMaskData;

                    // 2. Overwrite text area with static noise
                    for (let i = 0; i < pixels.length; i += 4) {
                        if (mask[i] > 128) { // If pixel is inside the text mask
                            pixels[i] = staticNoise[i];
                            pixels[i+1] = staticNoise[i+1];
                            pixels[i+2] = staticNoise[i+2];
                        }
                    }
                    
                    this.ctx.putImageData(screenData, 0, 0);

                    // Scroll background
                    this.noiseOffsetY += this.speed;
                    if (this.noiseOffsetY >= this.noiseBufferCanvas.height - this.height) {
                        this.noiseOffsetY = 0;
                    }

                    this.animationId = requestAnimationFrame(this.renderFrame);
                }

                verify() {
                    const userInput = this.input.value.toUpperCase().trim();
                    const solveTime = Date.now() - this.startTime;

                    if (userInput === this.currentText) {
                        // --- SMART BOT DETECTION HEURISTICS ---
                        
                        // 1. Completion Time Check (Bots type instantly)
                        // A human realistically takes >800ms to read moving static and type 4-6 chars
                        if (solveTime < 800) {
                            this.handleFailure('Suspicious activity: Solved too quickly.');
                            return;
                        }
                        
                        // 2. Interaction Check (Headless bots often bypass mouse movements)
                        if (this.mouseMoveCount < 1 && solveTime < 3000) {
                            this.handleFailure('Suspicious activity: Missing interaction patterns.');
                            return;
                        }

                        // Success! Validation Passed.
                        const origText = this.verifyBtn.textContent;
                        this.verifyBtn.textContent = 'VERIFIED';
                        this.verifyBtn.style.backgroundColor = '#22c55e'; // Green
                        this.verifyBtn.style.color = 'white';
                        
                        setTimeout(() => {
                            this.close();
                            
                            // Trigger JS callback if defined in global window scope
                            if (this.activeCallback && typeof window[this.activeCallback] === 'function') {
                                window[this.activeCallback]();
                            }
                            
                            // Reset button text for next time
                            setTimeout(() => { 
                                this.verifyBtn.textContent = origText; 
                                this.verifyBtn.style.backgroundColor = '';
                                this.verifyBtn.style.color = '';
                            }, 300);
                        }, 500); 
                    } else {
                        this.attempts++;
                        
                        // PROGRESSIVE DIFFICULTY: Make it harder if they keep failing
                        if (this.attempts >= 2 && this.difficulty < this.maxDifficulty) {
                            this.difficulty++; // Increase length of text
                            this.handleFailure(`Incorrect. Increasing security level (${this.difficulty} chars).`);
                        } else {
                            this.handleFailure('Incorrect code. Verification failed.');
                        }
                    }
                }

                handleFailure(message) {
                    this.errorMsg.textContent = message;
                    this.input.value = '';
                    this.input.focus();
                    
                    // Failure Shake Animation
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

            // Initialize the widget manager globally on window load
            window.addEventListener('DOMContentLoaded', () => {
                window.GhostCaptchaInstance = new GhostCaptcha();
            });

        })();
