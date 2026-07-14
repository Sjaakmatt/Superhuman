import { useState, useMemo, useRef, useEffect } from "react";
import {
  Heart, Dumbbell, Activity, Apple, Target, Brain,
  ChevronRight, Sparkles, RotateCcw, Eye,
} from "lucide-react";

/* ---------------- palette ---------------- */
const INK = "#0B0A12";
const CARD = "#17141F";
const CARD2 = "#1F1B2B";
const LINE = "#2A2540";
const TEXT = "#ECE9F6";
const MUTE = "#8B86A6";

const ATTR = {
  vitaliteit: { label: "Vitaliteit", color: "#39E0C4", Icon: Heart },
  kracht:     { label: "Kracht",     color: "#FF8A4C", Icon: Dumbbell },
  soepel:     { label: "Soepelheid", color: "#B58CFF", Icon: Activity },
  voeding:    { label: "Voeding",    color: "#8FE05B", Icon: Apple },
  focus:      { label: "Focus",      color: "#5B9BFF", Icon: Target },
  geest:      { label: "Geest",      color: "#FF6FA8", Icon: Brain },
};
const KEYS = Object.keys(ATTR);

/* ---------------- evolution stages ---------------- */
const STAGES = [
  { name: "Sluimerend",      min: 0,    particles: 0,  rings: 1, hue: "#6A6480", glow: 0.22, line: "Een vonk die nog moet ontwaken. Voed jezelf." },
  { name: "Ontwakend",       min: 120,  particles: 3,  rings: 1, hue: "#7A5CE0", glow: 0.5,  line: "Je begint te leven. Iets komt op gang." },
  { name: "Gedisciplineerd", min: 340,  particles: 6,  rings: 2, hue: "#8B7CFF", glow: 0.78, line: "Ritme wordt tweede natuur." },
  { name: "Onverzettelijk",  min: 680,  particles: 9,  rings: 2, hue: "#39E0C4", glow: 1.0,  line: "Weinig krijgt je nog van je koers." },
  { name: "Superhuman",      min: 1150, particles: 14, rings: 3, hue: "#FF6FA8", glow: 1.3,  line: "Je bent iets geworden." },
];
function stageIndex(xp) {
  let i = 0;
  for (let s = 0; s < STAGES.length; s++) if (xp >= STAGES[s].min) i = s;
  return i;
}

const FEED_XP = 24;
const FEED_MOM = 34;
const DECAY = 17;

/* ---------------- Living Core ---------------- */
function Core({ xp, vitality, stageIdx }) {
  const st = STAGES[stageIdx];
  const size = 190;
  // alive = faster breathing + brighter
  const breath = 5.2 - vitality * 2.6; // seconds
  const parts = st.particles;
  return (
    <div style={{ position: "relative", width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* aura */}
      <div style={{
        position: "absolute", inset: -10, borderRadius: "50%",
        background: `radial-gradient(circle, ${st.hue}${Math.round(40 * (0.4 + vitality)).toString(16).padStart(2, "0")}, transparent 68%)`,
        animation: `coreBreath ${breath}s ease-in-out infinite`,
        opacity: 0.5 + vitality * 0.5,
      }} />
      {/* orbiting particles = evolution */}
      {parts > 0 && (
        <div style={{ position: "absolute", inset: 0, animation: `spin ${18 - vitality * 8}s linear infinite` }}>
          {Array.from({ length: parts }).map((_, i) => {
            const ang = (i / parts) * Math.PI * 2;
            const rad = size / 2 - 6 - (i % st.rings) * 16;
            return (
              <div key={i} style={{
                position: "absolute", left: "50%", top: "50%",
                width: 6, height: 6, borderRadius: "50%", background: st.hue,
                boxShadow: `0 0 8px ${st.hue}`,
                transform: `translate(-50%,-50%) rotate(${ang}rad) translateX(${rad}px)`,
                opacity: 0.4 + vitality * 0.6,
              }} />
            );
          })}
        </div>
      )}
      {/* inner orb */}
      <div style={{
        width: 116, height: 116, borderRadius: "50%",
        background: `radial-gradient(circle at 38% 32%, #EFE7FF, ${st.hue} 46%, #241B3E 100%)`,
        boxShadow: `0 0 ${26 + vitality * 60}px ${st.hue}${Math.round(120 * st.glow).toString(16).padStart(2, "0")}, inset 0 0 26px rgba(255,255,255,.16)`,
        animation: `coreBreath ${breath}s ease-in-out infinite`,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        filter: vitality < 0.25 ? "saturate(.6) brightness(.85)" : "none",
        transition: "filter 1s ease",
      }}>
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, letterSpacing: 2, color: "#EEE6FF", opacity: .85 }}>{xp}</div>
        <div style={{ fontSize: 10, color: "#EEE6FF", opacity: .7, letterSpacing: 1 }}>XP</div>
      </div>
    </div>
  );
}

/* ---------------- Attribute cell ---------------- */
function Cell({ k, xp, mom, selected, onToggle }) {
  const A = ATTR[k];
  const alive = mom / 100;
  const lvl = Math.floor(xp / 100) + 1;
  const wilting = mom < 22;
  return (
    <button onClick={onToggle} style={{
      position: "relative", background: CARD, border: `1px solid ${selected ? A.color : LINE}`,
      borderRadius: 18, padding: "14px 12px 12px", cursor: "pointer", textAlign: "left", overflow: "hidden",
      boxShadow: selected ? `0 0 0 1px ${A.color}, 0 8px 26px ${A.color}33` : "none",
      transition: "all .3s ease", transform: selected ? "translateY(-2px)" : "none",
    }}>
      {/* charge glow bg */}
      <div style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(120% 90% at 20% 0%, ${A.color}${Math.round(38 * alive).toString(16).padStart(2, "0")}, transparent 70%)`,
        opacity: 0.5 + alive * 0.5, transition: "opacity .6s",
      }} />
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
            background: A.color + "22", border: `1px solid ${A.color}55`,
            animation: `cellPulse ${(3.4 - alive * 1.8).toFixed(2)}s ease-in-out infinite`,
            filter: wilting ? "saturate(.5) brightness(.8)" : "none", transition: "filter .6s",
          }}>
            <A.Icon size={17} color={A.color} />
          </div>
          <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: MUTE }}>Lv{lvl}</span>
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, marginTop: 9 }}>{A.label}</div>
        {/* momentum bar */}
        <div style={{ height: 5, borderRadius: 4, background: "#241F35", marginTop: 7, overflow: "hidden" }}>
          <div style={{ width: `${mom}%`, height: "100%", background: A.color, borderRadius: 4, boxShadow: `0 0 8px ${A.color}`, transition: "width .7s cubic-bezier(.3,.8,.3,1)" }} />
        </div>
        <div style={{ fontSize: 10.5, color: wilting ? "#E0748C" : MUTE, marginTop: 5, height: 13 }}>
          {selected ? "vandaag gevoed +" : wilting ? "rust uit — voed het" : `momentum ${Math.round(mom)}%`}
        </div>
      </div>
    </button>
  );
}

/* (rest van het prototype: main component met dag-simulatie, spiegel,
   evolutie-ceremonie en toast — zie de originele briefing-bijlage) */
