import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import {
  ArrowLeft, Mic, Camera, Square, CheckCircle, Loader2, Send,
  ChevronRight, MapPin, Clock, Globe, Heart, Upload, Phone, User,
  Stethoscope, Truck, UtensilsCrossed, Wrench, BookOpen, Shield,
  Baby, Droplets, RotateCcw, RefreshCw, X, FileText, AlertTriangle,
} from 'lucide-react';
import { ingestText, ingestFile } from '../api';

// ????????? Constants ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

const SKILLS = [
  { id: 'first_aid',  label: 'First Aid',   icon: Stethoscope,     color: '#DC2626' },
  { id: 'driving',    label: 'Driving',      icon: Truck,           color: '#2563EB' },
  { id: 'cooking',    label: 'Cooking',      icon: UtensilsCrossed, color: '#D97706' },
  { id: 'repair',     label: 'Repair Work',  icon: Wrench,          color: '#7C3AED' },
  { id: 'teaching',   label: 'Teaching',     icon: BookOpen,        color: '#059669' },
  { id: 'security',   label: 'Security',     icon: Shield,          color: '#475569' },
  { id: 'childcare',  label: 'Child Care',   icon: Baby,            color: '#EC4899' },
  { id: 'cleaning',   label: 'Cleaning',     icon: Droplets,        color: '#0EA5E9' },
  { id: 'medical',    label: 'Medical',      icon: Heart,           color: '#EF4444' },
  { id: 'counseling', label: 'Counseling',   icon: User,            color: '#8B5CF6' },
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const LANG_OPTIONS = [
  { code: null,  label: 'Auto-detect' },
  { code: 'en',  label: 'English' },
  { code: 'hi',  label: 'Hindi' },
  { code: 'kn',  label: 'Kannada' },
  { code: 'ta',  label: 'Tamil' },
  { code: 'te',  label: 'Telugu' },
  { code: 'bn',  label: 'Bengali' },
  { code: 'ml',  label: 'Malayalam' },
  { code: 'mr',  label: 'Marathi' },
  { code: 'gu',  label: 'Gujarati' },
  { code: 'ur',  label: 'Urdu' },
];

const SPOKEN_LANGUAGES = ['English','Hindi','Kannada','Tamil','Telugu','Malayalam','Marathi','Bengali','Gujarati','Urdu'];

// ????????? Helpers ??????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

function toggle(arr, set, val) {
  set(arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]);
}

function dataURLtoBlob(dataURL) {
  const [header, data] = dataURL.split(',');
  const mime = header.match(/:(.*?);/)[1];
  const binary = atob(data);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

// ????????? Sub-components ?????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

function Chip({ active, onClick, children, color }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '8px',
        padding: '12px 18px', borderRadius: '14px', fontSize: '1rem',
        fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
        background: active ? (color || '#4f46e5') : 'rgba(255,255,255,0.06)',
        color: active ? 'white' : 'var(--text-muted)',
        border: active ? 'none' : '1px solid var(--glass-border)',
        boxShadow: active ? `0 4px 12px ${color || '#4f46e5'}55` : 'none',
      }}
    >
      {children}
    </button>
  );
}

// Badge shown on the input method card when it has contributed data
function ContribBadge({ label }) {
  return (
    <span style={{
      background: '#10b981', color: 'white', fontSize: '0.7rem',
      fontWeight: 700, padding: '2px 8px', borderRadius: '8px',
      position: 'absolute', top: '10px', right: '10px',
    }}>
      {label}
    </span>
  );
}

// ????????? Input Method Cards ?????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

function MethodCard({ id, active, onToggle, icon, title, subtitle, badge, children }) {
  return (
    <div style={{ position: 'relative' }}>
      {badge && <ContribBadge label={badge} />}
      <button
        type="button"
        onClick={() => onToggle(id)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '16px',
          padding: '20px', borderRadius: '16px', cursor: 'pointer',
          background: active ? 'rgba(79,70,229,0.15)' : 'rgba(255,255,255,0.04)',
          border: active ? '2px solid #7c3aed' : '1px solid var(--glass-border)',
          color: 'white', textAlign: 'left', transition: 'all 0.2s',
        }}
      >
        <div style={{
          width: '52px', height: '52px', borderRadius: '14px', flexShrink: 0,
          background: active ? 'var(--primary-gradient)' : 'rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {icon}
        </div>
        <div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{title}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>{subtitle}</div>
        </div>
        <div style={{ marginLeft: 'auto', color: active ? '#7c3aed' : 'var(--text-muted)', fontSize: '1.4rem' }}>
          {active ? '???' : '???'}
        </div>
      </button>
      {active && (
        <div style={{
          marginTop: '2px', padding: '20px', borderRadius: '0 0 16px 16px',
          background: 'rgba(79,70,229,0.08)', border: '1px solid rgba(124,58,237,0.3)',
          borderTop: 'none',
        }}>
          {children}
        </div>
      )}
    </div>
  );
}


// ????????? Main Component ?????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

export default function VolunteerOnboarding() {
  const navigate = useNavigate();

  // Which accordion panels are open (multiple can be open at once)
  const [openPanels, setOpenPanels] = useState({ speak: false, photo: false, upload: false, type: false });

  // ?????? Shared form state (all 4 methods write into this) ??????
  const [name, setName]               = useState('');
  const [phone, setPhone]             = useState('');
  const [location, setLocation]       = useState('');
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [availableDays, setAvailableDays]   = useState([]);
  const [spokenLangs, setSpokenLangs]       = useState([]);
  const [notes, setNotes]             = useState('');
  const [hintLang, setHintLang]       = useState(null);

  // ?????? Contribution tracking (which methods have added data) ??????
  const [contributions, setContributions] = useState({
    speak: false, photo: false, upload: false, type: false,
  });

  // ?????? Audio state ??????
  const mediaRecorderRef = useRef(null);
  const analyserRef      = useRef(null);
  const animFrameRef     = useRef(null);
  const canvasRef        = useRef(null);
  const timerRef         = useRef(null);
  const [isRecording, setIsRecording]     = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl]           = useState(null);
  const [audioBlob, setAudioBlob]         = useState(null);
  const [transcript, setTranscript]       = useState({ native: '', english: '', lang: '', confidence: '' });

  // ?????? Camera state ??????
  const webcamRef    = useRef(null);
  const [facingMode, setFacingMode]       = useState('environment');
  const [showLive, setShowLive]           = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);

  // ?????? File upload state ??????
  const fileInputRef = useRef(null);
  const [uploadedFile, setUploadedFile]   = useState(null);
  const [filePreview, setFilePreview]     = useState(null);

  // ?????? Submission state ??????
  const [step, setStep]       = useState('input'); // 'input' | 'review' | 'success'
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [result, setResult]   = useState(null);

  // ?????? Waveform ??????
  const drawWaveform = useCallback(() => {
    const analyser = analyserRef.current;
    const canvas   = canvasRef.current;
    if (!analyser || !canvas) return;
    const ctx = canvas.getContext('2d');
    const bufLen = analyser.frequencyBinCount;
    const data   = new Uint8Array(bufLen);
    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(data);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barW = canvas.width / 44;
      const step = Math.floor(bufLen / 40);
      for (let i = 0; i < 40; i++) {
        const v = data[i * step] / 255;
        const h = Math.max(4, v * canvas.height * 0.85);
        const x = i * (barW + 2);
        const y = (canvas.height - h) / 2;
        const g = ctx.createLinearGradient(x, y, x, y + h);
        g.addColorStop(0, '#7c3aed');
        g.addColorStop(1, '#4f46e5');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.roundRect(x, y, barW, h, 3);
        ctx.fill();
      }
    };
    draw();
  }, []);

  useEffect(() => () => {
    clearInterval(timerRef.current);
    cancelAnimationFrame(animFrameRef.current);
  }, []);

  const togglePanel = (id) =>
    setOpenPanels(p => ({ ...p, [id]: !p[id] }));

  const markContrib = (id) =>
    setContributions(p => ({ ...p, [id]: true }));

  // ?????? Audio recording ??????
  const startRecording = async () => {
    try {
      const stream   = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source   = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      const chunks = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
        cancelAnimationFrame(animFrameRef.current);
        audioCtx.close();
      };
      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      setAudioUrl(null);
      setError('');
      timerRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000);
      drawWaveform();
    } catch {
      setError('Microphone access denied. Please allow microphone and try again.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const processAudio = async () => {
    if (!audioBlob) return;
    setLoading(true);
    setError('');
    try {
      // Send to backend audio endpoint; falls back gracefully if not available
      const fd = new FormData();
      fd.append('file', audioBlob, 'recording.webm');
      const res = await fetch('/api/ingest/audio', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Audio processing failed ??? try typing your details instead.');
      const data = await res.json();
      setTranscript({ native: data.native_transcript, english: data.english_translation, lang: data.detected_language, confidence: data.confidence });
      // Merge translated text into the shared notes field
      if (data.english_translation) setNotes(prev => prev ? `${prev}\n${data.english_translation}` : data.english_translation);
      markContrib('speak');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const clearAudio = () => {
    setAudioUrl(null);
    setAudioBlob(null);
    setTranscript({ native: '', english: '', lang: '', confidence: '' });
    setContributions(p => ({ ...p, speak: false }));
  };

  // ?????? Camera ??????
  const capture = useCallback(() => {
    const src = webcamRef.current?.getScreenshot();
    if (src) { setCapturedImage(src); setShowLive(false); markContrib('photo'); }
  }, []);

  const clearPhoto = () => {
    setCapturedImage(null);
    setContributions(p => ({ ...p, photo: false }));
  };

  // ?????? File upload ??????
  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploadedFile(f);
    if (f.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => setFilePreview(reader.result);
      reader.readAsDataURL(f);
    } else {
      setFilePreview(null);
    }
    markContrib('upload');
  };

  const clearFile = () => {
    setUploadedFile(null);
    setFilePreview(null);
    setContributions(p => ({ ...p, upload: false }));
  };

  // ?????? Determine if we have enough to proceed ??????
  const hasAnyInput = () =>
    contributions.speak || contributions.photo || contributions.upload ||
    (name.trim() && phone.trim() && location.trim());

  // ?????? Build the submission payload ??????
  const buildTextPayload = () => {
    const parts = [];
    if (name)     parts.push(`Name: ${name}`);
    if (phone)    parts.push(`Phone: ${phone}`);
    if (location) parts.push(`Location: ${location}`);
    if (selectedSkills.length) parts.push(`Skills: ${selectedSkills.map(id => SKILLS.find(s => s.id === id)?.label).join(', ')}`);
    if (availableDays.length)  parts.push(`Available: ${availableDays.join(', ')}`);
    if (spokenLangs.length)    parts.push(`Languages: ${spokenLangs.join(', ')}`);
    if (transcript.english)    parts.push(`Voice note: ${transcript.english}`);
    if (notes)                 parts.push(`Additional info: ${notes}`);
    return parts.join('. ');
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      let data;
      // Priority: photo > uploaded file > text
      if (capturedImage && !uploadedFile) {
        const blob = dataURLtoBlob(capturedImage);
        data = await ingestFile(new File([blob], 'photo.jpg', { type: 'image/jpeg' }), hintLang);
      } else if (uploadedFile) {
        data = await ingestFile(uploadedFile, hintLang);
      } else {
        const raw = buildTextPayload();
        if (!raw.trim()) throw new Error('Please add some information before submitting.');
        data = await ingestText(raw, hintLang);
      }
      setResult(data);
      setStep('success');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };


  // ????????? SUCCESS SCREEN ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
  if (step === 'success') {
    const profile = result?.structured_profile;
    const audit   = result?.audit_metadata;
    return (
      <div className="page-container animate-fade-in" style={{ justifyContent: 'center', textAlign: 'center' }}>
        <CheckCircle size={72} color="#10b981" style={{ margin: '0 auto 20px' }} />
        <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>
          You're registered{profile?.name ? `, ${profile.name}` : ''}!
        </h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '28px' }}>
          We'll contact you when there's a match.
        </p>

        {profile && (
          <div className="glass-card" style={{ textAlign: 'left', marginBottom: '16px' }}>
            <h3 style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px' }}>Your Profile</h3>
            {profile.name         && <Row label="Name"         value={profile.name} />}
            {profile.location     && <Row label="Location"     value={profile.location} />}
            {profile.contact_info && <Row label="Contact"      value={profile.contact_info} />}
            {profile.skills?.length > 0 && <Row label="Skills" value={profile.skills.join(', ')} />}
            {profile.languages?.length > 0 && <Row label="Languages" value={profile.languages.join(', ')} />}
            {profile.availability && <Row label="Available"    value={profile.availability} />}
          </div>
        )}

        {audit && (
          <div className="glass-card" style={{ textAlign: 'left', marginBottom: '24px' }}>
            <h3 style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px' }}>
              AI Audit ??? {audit.audit_status?.toUpperCase()}
            </h3>
            <div style={{ display: 'flex', gap: '12px' }}>
              <ScorePill label="Cultural fit"   value={`${Math.round(audit.cultural_adequacy_score * 100)}%`} color={audit.cultural_adequacy_score >= 0.85 ? '#10b981' : '#f59e0b'} />
              <ScorePill label="Semantic drift" value={`${Math.round(audit.back_translation_delta * 100)}%`}  color={audit.back_translation_delta <= 0.15 ? '#10b981' : '#f59e0b'} />
              <ScorePill label="Language"       value={audit.source_language?.toUpperCase()}                  color="#7c3aed" />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn-primary" onClick={() => { setStep('input'); setResult(null); }}>Register another</button>
          <button className="btn-secondary" onClick={() => navigate('/')}>Home</button>
        </div>
      </div>
    );
  }

  // ????????? REVIEW SCREEN ???????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
  if (step === 'review') {
    return (
      <div className="page-container animate-fade-in">
        <button onClick={() => setStep('input')} style={{ background: 'transparent', border: 'none', color: 'white', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', cursor: 'pointer' }}>
          <ArrowLeft size={20} /> Edit
        </button>
        <h1 className="page-title" style={{ marginBottom: '4px' }}>Review & Submit</h1>
        <p className="page-subtitle" style={{ marginBottom: '24px' }}>Everything looks good? Hit confirm.</p>

        {/* What was collected */}
        <div className="glass-card" style={{ marginBottom: '16px' }}>
          <h3 style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px' }}>Collected Information</h3>
          {name     && <Row label="Name"     value={name} />}
          {phone    && <Row label="Phone"    value={phone} />}
          {location && <Row label="Location" value={location} />}
          {selectedSkills.length > 0 && (
            <Row label="Skills" value={selectedSkills.map(id => SKILLS.find(s => s.id === id)?.label).join(', ')} />
          )}
          {availableDays.length > 0 && <Row label="Available" value={availableDays.join(', ')} />}
          {spokenLangs.length > 0   && <Row label="Languages" value={spokenLangs.join(', ')} />}
          {notes && <Row label="Notes" value={notes} />}
        </div>

        {/* Input methods used */}
        <div className="glass-card" style={{ marginBottom: '16px' }}>
          <h3 style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px' }}>Input Methods Used</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {contributions.speak  && <Badge color="#7c3aed">???? Voice</Badge>}
            {contributions.photo  && <Badge color="#2563EB">???? Photo</Badge>}
            {contributions.upload && <Badge color="#059669">???? File</Badge>}
            {(name || notes)      && <Badge color="#D97706">?????? Typed</Badge>}
          </div>
        </div>

        {/* Photo preview if captured */}
        {capturedImage && (
          <div className="glass-card" style={{ marginBottom: '16px' }}>
            <h3 style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>Photo</h3>
            <img src={capturedImage} alt="Captured" style={{ width: '100%', borderRadius: '12px', maxHeight: '200px', objectFit: 'cover' }} />
          </div>
        )}

        {/* Transcript if recorded */}
        {transcript.english && (
          <div className="glass-card" style={{ marginBottom: '16px' }}>
            <h3 style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>Voice Transcript</h3>
            {transcript.native  && <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '8px' }}>"{transcript.native}"</p>}
            <p style={{ color: 'white', fontSize: '0.95rem' }}>"{transcript.english}"</p>
          </div>
        )}

        {error && (
          <div style={{ color: '#ef4444', padding: '12px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        <button className="btn-secondary" onClick={handleSubmit} disabled={loading} style={{ height: '64px', fontSize: '1.2rem' }}>
          {loading ? <Loader2 className="animate-spin" size={24} /> : <CheckCircle size={24} />}
          {loading ? 'Registering...' : 'Confirm & Register'}
        </button>
      </div>
    );
  }


  // MAIN INPUT SCREEN
  return (
    <div className="page-container animate-fade-in">
      <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', color: 'white', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', cursor: 'pointer' }}>
        <ArrowLeft size={20} /> Back
      </button>

      <div style={{ marginBottom: '28px' }}>
        <h1 className="page-title">How do you want to register?</h1>
        <p className="page-subtitle">Pick the easiest option for you ??? or use all of them together.</p>
      </div>

      {/* ?????? Active contributions summary bar ?????? */}
      {(contributions.speak || contributions.photo || contributions.upload || name || notes) && (
        <div className="glass-card animate-fade-in" style={{ marginBottom: '20px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', flexShrink: 0 }}>Added so far:</span>
          {contributions.speak  && <Badge color="#7c3aed">???? Voice</Badge>}
          {contributions.photo  && <Badge color="#2563EB">???? Photo</Badge>}
          {contributions.upload && <Badge color="#059669">???? {uploadedFile?.name}</Badge>}
          {(name || notes)      && <Badge color="#D97706">?????? Text</Badge>}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>

        {/* ?????? 1. SPEAK ?????? */}
        <MethodCard
          id="speak"
          active={openPanels.speak}
          onToggle={togglePanel}
          icon={<Mic size={26} color="white" />}
          title="SPEAK YOUR DETAILS"
          subtitle="Any language ??? we will translate"
          badge={contributions.speak ? '??? Done' : null}
        >
          {/* Not recording, no audio yet */}
          {!isRecording && !audioUrl && (
            <button className="btn-primary" onClick={startRecording} style={{ height: '64px', fontSize: '1.1rem' }}>
              <Mic size={22} /> Start Recording
            </button>
          )}

          {/* Live recording */}
          {isRecording && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#ef4444', marginBottom: '6px' }}>{formatTime(recordingTime)}</div>
              <p style={{ color: 'var(--text-muted)', marginBottom: '14px' }}>Listening??? speak naturally in any language</p>
              <canvas ref={canvasRef} width={320} height={60} style={{ width: '100%', height: '60px', borderRadius: '10px', background: 'rgba(0,0,0,0.2)', marginBottom: '16px' }} />
              <button className="btn-primary" onClick={stopRecording} style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', height: '60px' }}>
                <Square size={20} /> Stop Recording
              </button>
            </div>
          )}

          {/* Playback + process */}
          {audioUrl && !transcript.english && !loading && (
            <div>
              <audio controls src={audioUrl} style={{ width: '100%', marginBottom: '14px', borderRadius: '10px' }} />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-primary" onClick={processAudio} style={{ flex: 1, height: '52px' }}>
                  <Send size={18} /> Process & Translate
                </button>
                <button onClick={clearAudio} style={{ padding: '0 16px', borderRadius: '10px', background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <RotateCcw size={18} />
                </button>
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && !transcript.english && (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <Loader2 size={36} className="animate-spin" style={{ color: '#7c3aed' }} />
              <p style={{ color: 'var(--text-muted)', marginTop: '10px' }}>Translating???</p>
            </div>
          )}

          {/* Transcript result */}
          {transcript.english && (
            <div>
              {transcript.lang && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '10px' }}>Detected: <strong>{transcript.lang}</strong></p>}
              <div style={{ background: 'rgba(79,70,229,0.15)', padding: '14px', borderRadius: '10px', marginBottom: '8px', borderLeft: '4px solid #7c3aed' }}>
                <span style={{ fontSize: '0.75rem', color: '#a78bfa', fontWeight: 700 }}>ORIGINAL</span>
                <p style={{ marginTop: '4px' }}>"{transcript.native}"</p>
              </div>
              <div style={{ background: 'rgba(16,185,129,0.1)', padding: '14px', borderRadius: '10px', marginBottom: '14px', borderLeft: '4px solid #10b981' }}>
                <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700 }}>ENGLISH</span>
                <p style={{ marginTop: '4px' }}>"{transcript.english}"</p>
              </div>
              <button onClick={clearAudio} style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-muted)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <RotateCcw size={14} /> Record again
              </button>
            </div>
          )}
        </MethodCard>

        {/* ?????? 2. TAKE A PHOTO ?????? */}
        <MethodCard
          id="photo"
          active={openPanels.photo}
          onToggle={togglePanel}
          icon={<Camera size={26} color="white" />}
          title="TAKE A PHOTO"
          subtitle="Snap your ID card, form, or handwritten note"
          badge={contributions.photo ? '??? Done' : null}
        >
          {!showLive && !capturedImage && (
            <button className="btn-primary" onClick={() => setShowLive(true)} style={{ height: '56px' }}>
              <Camera size={20} /> Open Camera
            </button>
          )}

          {showLive && (
            <div style={{ position: 'relative' }}>
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={{ facingMode }}
                style={{ width: '100%', borderRadius: '12px' }}
              />
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '80%', height: '60%', border: '2px dashed rgba(255,255,255,0.4)', borderRadius: '12px', pointerEvents: 'none' }} />
              <p style={{ color: 'rgba(255,255,255,0.6)', textAlign: 'center', fontSize: '0.85rem', margin: '8px 0' }}>Align document inside the frame</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-primary" onClick={capture} style={{ flex: 1, height: '56px' }}>
                  <Camera size={20} /> Snap
                </button>
                <button onClick={() => setFacingMode(f => f === 'environment' ? 'user' : 'environment')} style={{ width: '56px', height: '56px', borderRadius: '10px', background: 'rgba(255,255,255,0.1)', border: '1px solid var(--glass-border)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <RefreshCw size={18} />
                </button>
                <button onClick={() => setShowLive(false)} style={{ width: '56px', height: '56px', borderRadius: '10px', background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={18} />
                </button>
              </div>
            </div>
          )}

          {capturedImage && (
            <div>
              <img src={capturedImage} alt="Captured" style={{ width: '100%', borderRadius: '12px', maxHeight: '200px', objectFit: 'cover', marginBottom: '10px' }} />
              <button onClick={clearPhoto} style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-muted)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <RotateCcw size={14} /> Retake
              </button>
            </div>
          )}
        </MethodCard>

        {/* ?????? 3. UPLOAD A FILE ?????? */}
        <MethodCard
          id="upload"
          active={openPanels.upload}
          onToggle={togglePanel}
          icon={<Upload size={26} color="white" />}
          title="UPLOAD A FILE"
          subtitle="PDF, image, or scanned document"
          badge={contributions.upload ? `??? ${uploadedFile?.name}` : null}
        >
          <input ref={fileInputRef} type="file" accept="image/*,.pdf,.txt" style={{ display: 'none' }} onChange={handleFileChange} />

          {!uploadedFile && (
            <button className="btn-primary" onClick={() => fileInputRef.current?.click()} style={{ height: '56px' }}>
              <Upload size={20} /> Browse Files
            </button>
          )}

          {uploadedFile && (
            <div>
              {filePreview ? (
                <img src={filePreview} alt="Preview" style={{ width: '100%', borderRadius: '12px', maxHeight: '180px', objectFit: 'cover', marginBottom: '10px' }} />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px', marginBottom: '10px' }}>
                  <FileText size={28} color="#10b981" />
                  <div>
                    <p style={{ fontWeight: 600 }}>{uploadedFile.name}</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{(uploadedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
              )}
              <button onClick={clearFile} style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-muted)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <X size={14} /> Remove
              </button>
            </div>
          )}
        </MethodCard>

        {/* ?????? 4. TYPE IT ?????? */}
        <MethodCard
          id="type"
          active={openPanels.type}
          onToggle={togglePanel}
          icon={<Send size={26} color="white" />}
          title="I WILL TYPE IT"
          subtitle="Fill in your details manually"
          badge={(name || notes) ? '??? Filled' : null}
        >
          {/* Language hint */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <Globe size={14} /> Language of your text
          </label>
          <select
            value={hintLang ?? ''}
            onChange={e => setHintLang(e.target.value || null)}
            style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: 'white', fontSize: '0.95rem', fontFamily: 'inherit', marginBottom: '16px' }}
          >
            {LANG_OPTIONS.map(l => (
              <option key={l.code ?? 'auto'} value={l.code ?? ''} style={{ background: '#1e293b' }}>{l.label}</option>
            ))}
          </select>

          <label><User size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />Full Name</label>
          <input value={name} onChange={e => { setName(e.target.value); if (e.target.value) markContrib('type'); }} placeholder="e.g. Priya Sharma" />

          <label><Phone size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />Phone Number</label>
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. 9876543210" />

          <label><MapPin size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />Your Area / Village</label>
          <input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Koramangala, Bangalore" />

          <label>Anything else? (optional)</label>
          <textarea value={notes} onChange={e => { setNotes(e.target.value); if (e.target.value) markContrib('type'); }} placeholder="e.g. I have a truck and can drive at night???" style={{ minHeight: '80px' }} />

          {/* Skills */}
          <label style={{ marginBottom: '10px' }}>Skills (tap to select)</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
            {SKILLS.map(s => {
              const Icon = s.icon;
              return (
                <Chip key={s.id} active={selectedSkills.includes(s.id)} color={s.color} onClick={() => toggle(selectedSkills, setSelectedSkills, s.id)}>
                  <Icon size={16} /> {s.label}
                </Chip>
              );
            })}
          </div>

          {/* Availability */}
          <label style={{ marginBottom: '10px' }}><Clock size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />Available days</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
            {DAYS.map(d => <Chip key={d} active={availableDays.includes(d)} color="#2563EB" onClick={() => toggle(availableDays, setAvailableDays, d)}>{d}</Chip>)}
          </div>

          {/* Languages spoken */}
          <label style={{ marginBottom: '10px' }}><Globe size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />Languages you speak</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {SPOKEN_LANGUAGES.map(l => <Chip key={l} active={spokenLangs.includes(l)} color="#059669" onClick={() => toggle(spokenLangs, setSpokenLangs, l)}>{l}</Chip>)}
          </div>
        </MethodCard>
      </div>

      {/* ?????? Error ?????? */}
      {error && (
        <div style={{ color: '#ef4444', padding: '12px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* ?????? Continue button ?????? */}
      <button
        className="btn-primary"
        onClick={() => setStep('review')}
        disabled={!hasAnyInput()}
        style={{ height: '60px', fontSize: '1.1rem', opacity: hasAnyInput() ? 1 : 0.4 }}
      >
        <ChevronRight size={22} /> Review & Submit
      </button>
    </div>
  );
}

// ????????? Tiny helpers ???????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', gap: '12px', marginBottom: '10px', fontSize: '0.9rem' }}>
      <span style={{ color: 'var(--text-muted)', minWidth: '100px', flexShrink: 0 }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function ScorePill({ label, value, color }) {
  return (
    <div style={{ flex: 1, background: 'rgba(0,0,0,0.2)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
      <div style={{ color, fontWeight: 700, fontSize: '1.1rem' }}>{value}</div>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '2px' }}>{label}</div>
    </div>
  );
}

function Badge({ color, children }) {
  return (
    <span style={{ background: `${color}22`, border: `1px solid ${color}55`, color, padding: '3px 10px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600 }}>
      {children}
    </span>
  );
}
