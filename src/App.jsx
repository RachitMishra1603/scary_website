import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const STAGES = ['NORMAL', 'STRANGE', 'SOMETHING IS WRONG', 'THE WEBSITE KNOWS', 'BREAKDOWN', 'FINAL SEQUENCE', 'JUMPSCARE'];
const LINES = [
  ['You can leave whenever you want.', 'Nothing unusual here.', 'Take your time.'],
  ['That was not there before.', 'Did the page just move?', 'You saw that, right?'],
  ['Why did you click that?', 'Did you hear that?', "Don't keep clicking."],
  ['I can see where you are looking.', 'Stop moving the cursor.', 'You came back.'],
  ['CONNECTION LOST', 'PLEASE REMAIN CALM', 'THIS PAGE IS NOT RESPONDING'],
];
const CAMERAS = ['LOBBY', 'EAST HALL', 'ROOM 03', 'CAMERA 04'];

let mainAudioElement = null;
let scareAudioElement = null;
let shortAudioElement = null;
let audioIsMuted = true;
let shortCuePlayed = false;
let shortCueTimer = null;
const fadeTimers = new Map();
let mainShouldResume = false;
let activeAudio = null;
let stereoContext = null;
let shortCueSource = null;

function AudioEngine({ enabled, stage, started }) {
  const mainRef = useRef(null); const shortRef = useRef(null); const scareRef = useRef(null);
  useEffect(() => {
    mainAudioElement = mainRef.current; shortAudioElement = shortRef.current; scareAudioElement = scareRef.current;
    // Pan the brief knock hard right when Web Audio stereo routing is supported.
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx && shortAudioElement && !shortCueSource) {
        stereoContext = new Ctx(); shortCueSource = stereoContext.createMediaElementSource(shortAudioElement);
        const panner = stereoContext.createStereoPanner(); panner.pan.value = 1;
        shortCueSource.connect(panner); panner.connect(stereoContext.destination);
      }
    } catch { /* The cue still plays centered on browsers without stereo routing. */ }
    return () => { mainAudioElement = null; shortAudioElement = null; scareAudioElement = null; };
  }, []);

  useEffect(() => {
    if (!started || !enabled) return;
    audioIsMuted = false;
    if (stage < 6 && !shortAudioElement?.paused) return;
    if (stage === 3 && !shortCuePlayed) {
      shortCuePlayed = true; mainShouldResume = true;
      fadeOut(mainAudioElement, 500, () => playShortCue());
    } else if (stage >= 6) {
      mainShouldResume = false; activeAudio = null; stopShortCue(true); fadeOut(mainAudioElement, 450);
    } else if (!shortCuePlayed && mainAudioElement?.paused) {
      playMainTrack();
    }
  }, [enabled, stage, started]);

  return <div className="audio-engine" aria-hidden="true">
    <audio ref={mainRef} src="/main.mp3.ogg" loop preload="auto" />
    <audio ref={shortRef} src="/doorknock.mp3.ogg" preload="auto" />
    <audio ref={scareRef} src="/jumpscare.mp3.ogg" preload="auto" />
  </div>;
}

function playMainTrack() {
  if (!mainAudioElement || audioIsMuted) return;
  activeAudio = 'main';
  mainAudioElement.volume = 0.2;
  mainAudioElement.play().catch(() => {});
}

function fadeOut(element, duration = 350, done) {
  clearInterval(fadeTimers.get(element));
  if (!element || element.paused) { done?.(); return; }
  const startVolume = element.volume; const steps = 12; let step = 0;
  const timer = setInterval(() => {
    step += 1; element.volume = Math.max(0, startVolume * (1 - step / steps));
    if (step >= steps) { clearInterval(timer); fadeTimers.delete(element); element.pause(); element.volume = startVolume; done?.(); }
  }, duration / steps);
  fadeTimers.set(element, timer);
}

function playShortCue() {
  if (!shortAudioElement || audioIsMuted) return;
  activeAudio = 'short';
  clearTimeout(shortCueTimer); shortAudioElement.pause(); shortAudioElement.currentTime = 0;
  shortAudioElement.volume = 0.32;
  stereoContext?.resume().catch(() => {});
  shortAudioElement.play().then(() => {
    shortCueTimer = setTimeout(() => {
      shortAudioElement.pause(); shortAudioElement.currentTime = 0;
      if (mainShouldResume && !audioIsMuted) playMainTrack();
      else activeAudio = null;
    }, 5000);
  }).catch(() => { activeAudio = null; if (mainShouldResume) playMainTrack(); });
}

function playJumpscareAudio() {
  clearTimeout(shortCueTimer);
  mainShouldResume = false; activeAudio = 'scare';
  mainAudioElement?.pause(); shortAudioElement?.pause();
  if (audioIsMuted || !scareAudioElement) return;
  scareAudioElement.currentTime = 0; scareAudioElement.volume = 0.28;
  scareAudioElement.play().catch(() => {});
}

function setAudioMuted(muted) {
  audioIsMuted = muted;
  [mainAudioElement, shortAudioElement, scareAudioElement].forEach((element) => {
    if (!element) return;
    if (muted) element.pause();
  });
  if (!muted) {
    const activeElement = activeAudio === 'scare' ? scareAudioElement : activeAudio === 'short' ? shortAudioElement : activeAudio === 'main' ? mainAudioElement : null;
    if (activeElement) activeElement.play().catch(() => {});
  }
}

function stopShortCue(fade = false) {
  clearTimeout(shortCueTimer); mainShouldResume = false;
  if (fade && shortAudioElement && !shortAudioElement.paused) fadeOut(shortAudioElement, 350);
  else if (shortAudioElement) { shortAudioElement.pause(); shortAudioElement.currentTime = 0; }
}

function stopAudio() {
  clearTimeout(shortCueTimer); fadeTimers.forEach(clearInterval); fadeTimers.clear(); audioIsMuted = true; shortCuePlayed = false; mainShouldResume = false; activeAudio = null;
  [mainAudioElement, shortAudioElement, scareAudioElement].forEach((element) => { if (element) { element.pause(); element.currentTime = 0; } });
}

function VolumeControl({ muted, setMuted }) {
  return <button className="volume-control" onClick={(e) => { e.stopPropagation(); const next = !muted; setMuted(next); setAudioMuted(next); }} aria-label={muted ? 'Unmute audio' : 'Mute audio'}>{muted ? '◌' : '◖))'} <span>{muted ? 'SOUND OFF' : 'SOUND ON'}</span></button>;
}

function WarningScreen({ onEnter }) {
  return <motion.main className="warning-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
    <div className="warning-mark">✳</div><p className="eyebrow">AN INTERACTIVE HORROR EXPERIENCE</p>
    <h1>DON'T CLICK<br/><span>ANYTHING.</span></h1>
    <div className="warning-copy"><p className="warning-line">⚠ &nbsp;HEADPHONES RECOMMENDED</p><p>Make sure you're comfortable before continuing.</p><p className="warning-small">DO NOT CLICK ANYTHING.</p></div>
    <button className="enter-button" onClick={onEnter}>ENTER <span>↗</span></button>
    <p className="safety-note">No camera or microphone access. Sound starts after ENTER.</p>
  </motion.main>;
}

function GlitchEffect({ active }) { return <div className={`glitch-overlay ${active ? 'glitch-active' : ''}`} aria-hidden="true"/>; }

function CCTVScene({ camera }) {
  return <div className="cctv-frame"><div className="cctv-top"><span>● REC &nbsp; SIMULATION</span><span>CAM 0{camera + 1} / {CAMERAS[camera]}</span></div><div className={`room room-${camera}`}><div className="room-light"/><div className="room-door"/><div className="room-shadow"/></div><div className="cctv-bottom"><span>LOCAL FEED // NO CAMERA ACCESS</span><span>02:14:0{camera}</span></div></div>;
}

function Jumpscare({ onFinish }) {
  useEffect(() => { playJumpscareAudio(); const id = setTimeout(onFinish, 2600); return () => clearTimeout(id); }, [onFinish]);
  return <motion.div className="jumpscare" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><img className="scare-image" src="/jumpscare-monster.png" alt="A creature lunges from a dark doorway"/><p>YOU SHOULDN'T HAVE KEPT CLICKING.</p></motion.div>;
}

function HorrorExperience({ stage, clicks, pointer, onInteract, finale, camera, onRestart }) {
  const [message, setMessage] = useState('');
  const [glitch, setGlitch] = useState(false);
  const [err, setErr] = useState(false);
  const [scare, setScare] = useState(false);
  const [defied, setDefied] = useState(false);
  const lastMessage = useRef(0);
  useEffect(() => {
    if (stage >= 1 && stage <= 4 && Date.now() - lastMessage.current > 3600) {
      const options = LINES[stage]; setMessage(options[(clicks + stage) % options.length]); lastMessage.current = Date.now();
      const hide = setTimeout(() => setMessage(''), 2200); return () => clearTimeout(hide);
    }
  }, [stage, clicks]);
  useEffect(() => {
    if (stage >= 2) { setGlitch(true); const id = setTimeout(() => setGlitch(false), 500); return () => clearTimeout(id); }
  }, [stage, clicks]);
  useEffect(() => { if (stage === 4) { setErr(true); const id = setTimeout(() => setErr(false), 1900); return () => clearTimeout(id); } }, [stage, clicks]);
  useEffect(() => { if (stage === 6) { const id = setTimeout(() => setScare(true), 1200); return () => clearTimeout(id); } }, [stage]);
  const finishScare = useCallback(() => setScare(false), []);
  return <motion.main className={`experience stage-${stage}`} onClick={onInteract} onMouseMove={onInteract} onWheel={onInteract} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
    <div className="hero-image"/><div className="grain"/><div className="vignette"/><div className="topbar"><span className="brand">D/C/A <i>—</i> SESSION {String(clicks + 1).padStart(2, '0')}</span><span className="stage-label">{STAGES[stage]}</span></div>
    <div className="stage-progress">{STAGES.map((_, i) => <i key={i} className={i <= stage ? 'lit' : ''}/>)}</div>
    {stage < 5 && <><div className="center-content"><p className="micro">YOU ARE SAFE HERE</p><h2>{stage === 0 ? 'Nothing to see.' : stage === 1 ? 'Did something change?' : stage === 2 ? 'Something is here.' : stage === 3 ? 'I found you.' : 'DON’T LOOK AWAY.'}</h2><p className="subline">{message || (stage === 0 ? 'The page is behaving normally.' : 'Keep your eyes on the screen.')}</p><button className={`innocent-button ${defied ? 'button-defied' : ''}`} onClick={(e) => { e.stopPropagation(); setDefied(true); }}>{defied ? 'WHY DID YOU CLICK ME?' : "I'M NOT SCARED"}</button></div>
    <div className="cursor-eye" style={{ transform: `translate(${pointer.x * 0.018}px, ${pointer.y * 0.018}px)` }}>◉</div></>}
    {stage >= 5 && <div className="finale"><p className="micro">{stage === 5 ? 'SIGNAL FOUND' : 'SIGNAL LOST'}</p>{stage === 5 && <><CCTVScene camera={camera}/><p className="finale-caption">There is no camera. This is only a simulation.</p></>}{stage === 6 && !scare && <div className="final-warning">You shouldn't have kept clicking.<span>...</span></div>}</div>}
    <AnimatePresence>{scare && <Jumpscare onFinish={finishScare}/>}</AnimatePresence>
    {!scare && stage === 6 && <div className="survived">😂 &nbsp; YOU SURVIVED <button onClick={(e) => { e.stopPropagation(); onRestart(); }}>PLAY AGAIN</button></div>}
    {err && <div className="fake-error">{`SYSTEM_WARNING_0x${(clicks * 41).toString(16).toUpperCase()}`}<br/>This page is not responding.</div>}
    {stage >= 2 && <div className="shadow-figure"/>}<GlitchEffect active={glitch}/>
    <div className="bottom-hint">{finale ? 'SIGNAL ACTIVE' : 'A LITTLE TOO QUIET, ISN’T IT?'}</div>
  </motion.main>;
}

export default function App() {
  const [started, setStarted] = useState(false); const [stage, setStage] = useState(0); const [clicks, setClicks] = useState(0);
  const [muted, setMuted] = useState(true); const [pointer, setPointer] = useState({ x: 0, y: 0 }); const [lastAction, setLastAction] = useState(Date.now()); const [camera, setCamera] = useState(0);
  const moveCount = useRef(0); const lastStage = useRef(0);
  const interaction = useCallback((event) => {
    if (!started || stage >= 6) return;
    setLastAction(Date.now());
    if (event?.type === 'mousemove') { setPointer({ x: event.clientX - innerWidth / 2, y: event.clientY - innerHeight / 2 }); moveCount.current += 1; if (moveCount.current % 18) return; }
    setClicks((n) => { const next = n + (event?.type === 'mousemove' ? 0 : 1); const target = next < 1 ? 0 : next < 2 ? 1 : next < 3 ? 2 : next < 4 ? 3 : next < 5 ? 4 : 5; setStage((s) => Math.max(s, target)); return next; });
  }, [started, stage]);
  useEffect(() => {
    const idle = setInterval(() => { if (started && Date.now() - lastAction > 5000 && stage < 5) { setStage((s) => Math.min(5, s + 1)); setLastAction(Date.now()); } }, 700);
    return () => clearInterval(idle);
  }, [started, lastAction, stage]);
  useEffect(() => { if (stage === 5) { const timer = setInterval(() => setCamera((n) => (n + 1) % CAMERAS.length), 1100); const final = setTimeout(() => setStage(6), 4000); return () => { clearInterval(timer); clearTimeout(final); }; } }, [stage]);
  useEffect(() => { if (stage !== lastStage.current && stage > 0) { lastStage.current = stage; } }, [stage]);
  const begin = () => { audioIsMuted = false; playMainTrack(); setAudioMuted(false); setStarted(true); setMuted(false); setLastAction(Date.now()); };
  const restart = () => { stopAudio(); setStage(0); setClicks(0); setCamera(0); setStarted(false); setMuted(true); };
  return <><AudioEngine enabled={!muted} stage={stage} started={started}/><VolumeControl muted={muted} setMuted={setMuted}/><AnimatePresence mode="wait">{started ? <HorrorExperience key="experience" stage={stage} clicks={clicks} pointer={pointer} onInteract={interaction} finale={stage >= 5} camera={camera} onRestart={restart}/>: <WarningScreen key="warning" onEnter={begin}/>}</AnimatePresence></>;
}
