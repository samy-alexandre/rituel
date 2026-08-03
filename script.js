  /* ===== Top bar ===== */
  .topbar {
    padding: calc(env(safe-area-inset-top, 0px) + 24px) 24px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    position: relative;
    z-index: var(--z-sticky);
  }

  /* Filtre au défilement : la topbar se voile de verre sable */
  .topbar.scrolled {
    background: linear-gradient(180deg, var(--surface-glass) 0%, rgba(250,246,240,0.82) 70%, rgba(250,246,240,0) 100%);
    backdrop-filter: blur(12px) saturate(1.05);
    -webkit-backdrop-filter: blur(12px) saturate(1.05);
  }

  .topbar-greet {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .topbar-date {
    font-size: var(--fs-2xs);
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 500;
  }
  .topbar-name {
    font-family: var(--serif);
    font-size: var(--fs-xl);
    font-weight: 300;
    letter-spacing: -0.02em;
    line-height: 1.15;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .topbar-name em {
    font-style: italic;
    color: var(--accent);
    font-variation-settings: "SOFT" 100, "WONK" 1;
  }
  .avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--blush), var(--accent));
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-family: var(--serif);
    font-style: italic;
    font-weight: 500;
    font-size: var(--fs-md);
    cursor: pointer;
    flex-shrink: 0;
    box-shadow: var(--shadow-sm);
    border: 2px solid var(--surface);
    transition: transform var(--dur-2) var(--ease-out),
                box-shadow var(--dur-2) var(--ease-out);
  }
  .avatar:active { transform: scale(0.94); }

  .photo-empty {
    aspect-ratio: 4/5;
    background: linear-gradient(170deg, #F8EBE2 0%, var(--blush-soft) 55%, #EBD3C8 100%);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--sp-8);
    text-align: center;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    transition: box-shadow var(--dur-3) var(--ease-out);
  }
  .photo-empty::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image:
      radial-gradient(circle at 20% 25%, rgba(255,255,255,0.5) 0%, transparent 45%),
      radial-gradient(circle at 82% 72%, rgba(232,166,160,0.3) 0%, transparent 55%);
    pointer-events: none;
  }
  .photo-empty:active { box-shadow: var(--shadow); }
  .photo-icon {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: rgba(255,255,255,0.65);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: var(--sp-5);
    position: relative;
    z-index: 1;
  }
  .photo-icon svg { width: 28px; height: 28px; color: var(--accent-deep); }
  .photo-empty-title {
    font-family: var(--serif);
    font-size: var(--fs-lg);
    font-weight: 300;
    letter-spacing: -0.02em;
    margin-bottom: var(--sp-2);
    position: relative;
    z-index: 1;
    color: var(--ink);
  }
  .photo-empty-title em {
    font-style: italic;
    color: var(--accent-deep);
    font-variation-settings: "SOFT" 100, "WONK" 1;
  }
  .photo-display { position: relative; background: var(--bg-soft); overflow: hidden; }
  .photo-display img { width: 100%; height: auto; display: block; }
  .photo-chip {
    background: rgba(42,30,24,0.62);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    color: #fff;
    padding: var(--sp-2) 14px;
    border-radius: var(--r-pill);
    font-size: var(--fs-xs);
    font-weight: 500;
    box-shadow: var(--shadow-sm);
  }

  .streak {
    display: flex;
    align-items: center;
    gap: var(--sp-4);
    margin: 0 var(--sp-5) 28px;
    padding: var(--sp-5);
    background: var(--surface-warm);
    border-radius: var(--r-lg);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-sm);
    transition: box-shadow var(--dur-3) var(--ease-out);
  }
  .streak-flame {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: linear-gradient(135deg, #F5C892, var(--accent));
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--fs-md);
    flex-shrink: 0;
    box-shadow: var(--shadow-sm);
  }
  .streak-text { flex: 1; min-width: 0; }
  .streak-num {
    font-family: var(--serif);
    font-size: var(--fs-lg);
    font-weight: 400;
    line-height: 1;
  }
  .streak-num em { font-style: italic; color: var(--accent); }
  .streak-label { font-size: var(--fs-xs); color: var(--muted); margin-top: 4px; }
  .streak-mini { display: flex; gap: 3px; }
  .streak-day { width: 6px; height: 18px; border-radius: 3px; background: var(--line); transition: background var(--dur-2) var(--ease-out); }
  .streak-day.active { background: var(--accent); }

  .section { padding: 0 var(--sp-5); margin-bottom: 30px; }
  .section-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: var(--sp-4); }
  .section-title {
    font-family: var(--serif);
    font-size: var(--fs-md);
    font-weight: 400;
    letter-spacing: -0.01em;
    display: flex;
    align-items: center;
    gap: var(--sp-2);
  }
  .section-title em { font-style: italic; color: var(--accent); font-variation-settings: "SOFT" 100, "WONK" 1; }
  .section-title .sprig { width: 18px; opacity: 0.7; }
  .section-more { font-size: var(--fs-sm); color: var(--muted); cursor: pointer; }

  .mood-row {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: var(--sp-2);
  }
  .mood-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 14px var(--sp-1);
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    cursor: pointer;
    transition: transform var(--dur-1) var(--ease-out),
                background-color var(--dur-2) var(--ease-out),
                border-color var(--dur-2) var(--ease-out),
                box-shadow var(--dur-2) var(--ease-out);
    font-family: var(--sans);
  }
  .mood-btn:active { transform: scale(0.95); }
  .mood-btn.selected {
    background: var(--blush-soft);
    border-color: var(--accent);
    box-shadow: var(--shadow-sm);
  }
  .mood-emoji { font-size: var(--fs-lg); }
  .mood-label { font-size: var(--fs-2xs); color: var(--muted); }
  .mood-btn.selected .mood-label { color: var(--accent-deep); font-weight: 500; }

  /* Intensité de l'humeur */
  .intensity {
    margin-top: 14px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    padding: 14px var(--sp-4);
  }
  .intensity-head {
    display: flex;
    justify-content: space-between;
    font-size: var(--fs-xs);
    color: var(--ink-soft);
    margin-bottom: 10px;
    font-weight: 500;
  }
  .intensity-head span:last-child {
    color: var(--accent-deep);
    font-family: var(--serif);
    font-size: var(--fs-base);
  }
  .intensity-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 6px;
    border-radius: 6px;
    background: var(--blush-soft);
    outline: none;
    touch-action: pan-y;
  }
  .intensity-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--accent);
    cursor: pointer;
    box-shadow: var(--shadow);
    border: 3px solid var(--surface);
    transition: transform var(--dur-1) var(--ease-out);
  }
  .intensity-slider::-webkit-slider-thumb:active { transform: scale(1.12); }
  .intensity-slider::-moz-range-thumb {
    width: 22px;
    height: 22px;
    border: 3px solid var(--surface);
    border-radius: 50%;
    background: var(--accent);
    cursor: pointer;
    box-shadow: var(--shadow);
  }

  /* Switch Matin / Soir */
  .period-switch {
    display: flex;
    gap: var(--sp-2);
    background: var(--surface-warm);
    border-radius: var(--r-md);
    padding: var(--sp-1);
    margin-bottom: 14px;
  }
  .moment-chip {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    border: 1.5px solid var(--line);
    background: var(--surface);
    font-size: var(--fs-base);
    cursor: pointer;
    opacity: 0.38;
    transition: opacity var(--dur-2) var(--ease-out),
                border-color var(--dur-2) var(--ease-out),
                background-color var(--dur-2) var(--ease-out),
                transform var(--dur-1) var(--ease-out);
  }
  .moment-chip:active { transform: scale(0.9); }
  .moment-chip.on {
    opacity: 1;
    border-color: var(--accent);
    background: var(--blush-soft);
  }
  .rd-card {
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    padding: var(--sp-2) 10px;
    transition: border-color var(--dur-2) var(--ease-out),
                background-color var(--dur-2) var(--ease-out);
  }
  .rd-card.dragging {
    transition: none;
    opacity: 0.95;
    position: relative;
    z-index: var(--z-sticky);
    box-shadow: var(--shadow-lg);
    border-color: rgba(201,90,63,0.4);
  }
  .rd-handle {
    cursor: grab;
    color: var(--muted);
    font-size: var(--fs-lg);
    padding: var(--sp-1);
    touch-action: none;
    user-select: none;
    line-height: 1;
  }
  .rd-remove {
    background: none;
    border: none;
    color: var(--muted);
    font-size: var(--fs-lg);
    cursor: pointer;
    line-height: 1;
    padding: 0 var(--sp-1);
    transition: color var(--dur-1) var(--ease-out), transform var(--dur-1) var(--ease-out);
  }
  .rd-remove:active { color: var(--accent-deep); transform: scale(1.1); }
  .rd-emoji {
    width: 38px;
    height: 38px;
    border-radius: var(--r-sm);
    background: var(--surface-warm);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--fs-md);
    flex-shrink: 0;
  }
  .period-btn {
    flex: 1;
    padding: 11px;
    border: none;
    background: transparent;
    border-radius: var(--r-sm);
    font-family: var(--sans);
    font-size: 14px;
    font-weight: 500;
    color: var(--muted);
    cursor: pointer;
    transition: background-color var(--dur-2) var(--ease-out),
                color var(--dur-2) var(--ease-out),
                box-shadow var(--dur-2) var(--ease-out);
  }
  .period-btn.active {
    background: var(--surface);
    color: var(--ink);
    box-shadow: var(--shadow-sm);
  }