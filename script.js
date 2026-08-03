/* ===== Auth / Landing — version premium =====
   Refonte du ressenti : fonds ambiants, entrée en cascade, logo cerclé avec halo,
   cartes doubles, micro-interactions douces. Ne renomme aucun id/class existant. */

@keyframes rituelDrift {
  0%   { transform: translate(0, 0) scale(1); }
  33%  { transform: translate(10px, -14px) scale(1.04); }
  66%  { transform: translate(-8px, 8px) scale(0.97); }
  100% { transform: translate(0, 0) scale(1); }
}

@keyframes rituelFadeUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes rituelHalo {
  0%, 100% { box-shadow: 0 0 0 0 rgba(201, 90, 63, 0.16), 0 18px 46px rgba(46, 33, 28, 0.10); }
  50%      { box-shadow: 0 0 0 14px rgba(232, 166, 160, 0.10), 0 22px 52px rgba(46, 33, 28, 0.13); }
}

/* Fond ambiant apaisant de l'écran d'entrée */
#auth {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 26px max(40px, env(safe-area-inset-bottom));
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(110% 70% at 12% 6%, rgba(246, 224, 220, 0.55) 0%, transparent 55%),
    radial-gradient(100% 60% at 96% 90%, rgba(209, 178, 131, 0.35) 0%, transparent 52%),
    linear-gradient(180deg, #FBF4EC 0%, #F3E9DD 100%);
}
#auth::before {
  content: '';
  position: absolute;
  inset: -40%;
  background:
    radial-gradient(circle at 24% 30%, rgba(232, 166, 160, 0.16) 0%, transparent 34%),
    radial-gradient(circle at 74% 64%, rgba(201, 90, 63, 0.10) 0%, transparent 30%),
    radial-gradient(circle at 50% 100%, rgba(122, 148, 104, 0.10) 0%, transparent 42%);
  animation: rituelDrift 26s ease-in-out infinite;
  pointer-events: none;
}

.auth-inner {
  width: 100%;
  max-width: 360px;
  position: relative;
  z-index: 1;
  animation: rituelFadeUp 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

/* Brand — logo cerclé + halo respirant */
.auth-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 30px;
}
.auth-mark {
  font-family: var(--serif);
  font-size: 42px;
  font-weight: 500;
  letter-spacing: -0.02em;
  color: var(--ink);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 92px;
  height: 92px;
  border-radius: 50%;
  background: linear-gradient(145deg, var(--surface) 0%, var(--surface-warm) 100%);
  border: 1px solid rgba(201, 90, 63, 0.16);
  margin-bottom: 14px;
  animation: rituelHalo 5s ease-in-out infinite;
}
.auth-tagline {
  font-family: var(--serif);
  font-style: italic;
  font-size: 15px;
  color: var(--ink-soft);
  letter-spacing: 0.01em;
}
.auth-floral {
  margin-top: 12px;
  opacity: 0.85;
}

/* Entrée des blocs en cascade */
#landing > * {
  animation: rituelFadeUp 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
#landing > *:nth-child(2) { animation-delay: 0.08s; }
#landing > *:nth-child(3) { animation-delay: 0.16s; }
#landing > *:nth-child(4) { animation-delay: 0.24s; }
#landing > *:nth-child(5) { animation-delay: 0.32s; }
#landing > *:nth-child(6) { animation-delay: 0.4s; }

/* Cartes de promesse — doubles, icônes en pastille teintée */
.land-card {
  display: flex;
  align-items: center;
  gap: 14px;
  background: rgba(255, 253, 250, 0.82);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(231, 220, 203, 0.7);
  border-radius: var(--r-lg);
  padding: 15px 16px;
  margin-bottom: 10px;
  box-shadow: 0 10px 26px rgba(46, 33, 28, 0.05);
  transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.25s ease, border-color 0.25s ease;
}
.land-card:active {
  transform: scale(0.985);
  box-shadow: 0 6px 16px rgba(46, 33, 28, 0.06);
}
.land-card > span {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--blush-soft), #F3E3D6);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
  box-shadow: inset 0 0 0 1px rgba(201, 90, 63, 0.08);
}
.land-card b {
  display: block;
  font-size: 14.5px;
  color: var(--ink);
  font-weight: 600;
  letter-spacing: -0.01em;
  margin-bottom: 2px;
}
.land-card small {
  font-size: 12px;
  color: var(--muted);
  line-height: 1.45;
  display: block;
}

/* Boutons — profondeur et toucher */
.btn {
  border: none;
  font-family: var(--sans);
  font-weight: 500;
  font-size: 15px;
  padding: 15px 20px;
  width: 100%;
  border-radius: var(--r-md);
  cursor: pointer;
  transition: transform 0.16s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.24s ease, background 0.24s ease;
  -webkit-tap-highlight-color: transparent;
}
.btn:active {
  transform: scale(0.975) translateY(1px);
}
.btn-accent {
  background: linear-gradient(135deg, var(--accent) 0%, var(--accent-deep) 100%);
  color: #fff;
  box-shadow: 0 10px 24px rgba(201, 90, 63, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.14);
}
.btn-accent:active {
  box-shadow: 0 5px 14px rgba(201, 90, 63, 0.28);
}
.btn-soft {
  background: transparent;
  border: none;
  color: var(--ink-soft);
  font-family: var(--sans);
  font-size: 14px;
  padding: 12px 18px;
  border-radius: var(--r-md);
  cursor: pointer;
  transition: color 0.2s ease, background 0.2s ease;
}
.btn-soft:active { color: var(--accent-deep); }

/* Formulaire auth */
.auth-toggle {
  display: flex;
  gap: 6px;
  background: rgba(46, 33, 28, 0.05);
  border-radius: var(--r-pill);
  padding: 4px;
  margin-bottom: 22px;
}
.auth-tab {
  flex: 1;
  border: none;
  background: transparent;
  font-family: var(--sans);
  font-size: 14px;
  font-weight: 500;
  color: var(--muted);
  padding: 10px;
  border-radius: var(--r-pill);
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.auth-tab.active {
  background: var(--surface);
  color: var(--ink);
  box-shadow: 0 2px 8px rgba(46, 33, 28, 0.08);
}

.field {
  margin-bottom: 16px;
}
.field label {
  display: block;
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-soft);
  margin-bottom: 7px;
  padding-left: 2px;
}
.field input {
  width: 100%;
  border: 1.5px solid var(--line);
  background: var(--surface);
  border-radius: var(--r-md);
  padding: 13px 15px;
  font-family: var(--sans);
  font-size: 15px;
  color: var(--ink);
  transition: border-color 0.22s ease, box-shadow 0.22s ease;
}
.field input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 4px rgba(201, 90, 63, 0.10);
}
.field input::placeholder { color: var(--muted); opacity: 0.75; }

.auth-error {
  font-size: 12.5px;
  color: var(--accent);
  min-height: 16px;
  margin: 4px 0 10px;
  text-align: center;
  line-height: 1.4;
}

.auth-forgot {
  font-size: 12.5px;
  color: var(--accent-deep);
  text-align: right;
  margin: -6px 0 12px;
  cursor: pointer;
  font-weight: 500;
}

.gender-pill {
  flex: 1;
  border: 1.5px solid var(--line);
  background: var(--surface);
  border-radius: var(--r-sm);
  padding: 11px 6px;
  font-family: var(--sans);
  font-size: 13px;
  color: var(--ink-soft);
  cursor: pointer;
  transition: all 0.2s ease;
}
.gender-pill.sel {
  border-color: var(--accent);
  background: var(--blush-soft);
  color: var(--accent-deep);
  font-weight: 600;
}

.consent {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.55;
  margin-bottom: 16px;
  padding: 0 2px;
}
.consent input { margin-top: 2px; }
.consent a { color: var(--accent-deep); text-decoration: underline; cursor: pointer; }

/* Décor floral — respiration douce */
.auth-deco,
.auth-deco-2 {
  position: absolute;
  width: 150px;
  height: 150px;
  pointer-events: none;
  z-index: 0;
}
.auth-deco {
  top: -10px;
  right: -30px;
  animation: rituelDrift 18s ease-in-out infinite;
}
.auth-deco-2 {
  bottom: -24px;
  left: -40px;
  animation: rituelDrift 22s ease-in-out infinite reverse;
}

.hidden { display: none !important; }
