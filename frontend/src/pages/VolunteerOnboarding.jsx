import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import { ArrowLeft, Mic, Camera, Square, CheckCircle, Loader2, Send, ChevronRight, MapPin, Clock, Globe, Heart, Upload, Phone, User, Stethoscope, Truck, UtensilsCrossed, Wrench, BookOpen, Shield, Baby, Droplets, Play, RotateCcw, RefreshCw } from 'lucide-react';

const SKILLS = [
  { id: 'first_aid', label: 'First Aid', icon: Stethoscope, color: '#DC2626' },
  { id: 'driving', label: 'Driving', icon: Truck, color: '#2563EB' },
  { id: 'cooking', label: 'Cooking', icon: UtensilsCrossed, color: '#D97706' },
  { id: 'repair', label: 'Repair Work', icon: Wrench, color: '#7C3AED' },
  { id: 'teaching', label: 'Teaching', icon: BookOpen, color: '#059669' },
  { id: 'security', label: 'Security', icon: Shield, color: '#475569' },
  { id: 'childcare', label: 'Child Care', icon: Baby, color: '#EC4899' },
  { id: 'cleaning', label: 'Cleaning', icon: Droplets, color: '#0EA5E9' },
  { id: 'medical', label: 'Medical', icon: Heart, color: '#EF4444' },
  { id: 'counseling', label: 'Counseling', icon: User, color: '#8B5CF6' },
];
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const LANGUAGES = ['English','Hindi','Kannada','Tamil','Telugu','Malayalam','Marathi','Bengali','Gujarati','Urdu'];

export default function VolunteerOnboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  // Camera
  const webcamRef = useRef(null);
  const fileInputRef = useRef(null);
  const [showCamera, setShowCamera] = useState(false);
  const [facingMode, setFacingMode] = useState('environment');
  const [capturedImage, setCapturedImage] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);

  // Audio + Waveform
  const mediaRecorderRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const canvasRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioBlobState, setAudioBlobState] = useState(null);
  const [nativeText, setNativeText] = useState('');
  const [englishText, setEnglishText] = useState('');
  const [detectedLang, setDetectedLang] = useState('');
  const [confidence, setConfidence] = useState('');

  // Form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [availableDays, setAvailableDays] = useState([]);
  const [languages, setLanguages] = useState([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Waveform drawing
  const drawWaveform = useCallback(() => {
    const analyser = analyserRef.current;
    const canvas = canvasRef.current;
    if (!analyser || !canvas) return;
    const ctx = canvas.getContext('2d');
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);
      ctx.fillStyle = '#F1F5F9';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const barW = (canvas.width / 40);
      const step = Math.floor(bufferLength / 40);
      for (let i = 0; i < 40; i++) {
        const v = dataArray[i * step] / 255;
        const h = Math.max(4, v * canvas.height * 0.85);
        const x = i * (barW + 3);
        const y = (canvas.height - h) / 2;
        const gradient = ctx.createLinearGradient(x, y, x, y + h);
        gradient.addColorStop(0, '#3B82F6');
        gradient.addColorStop(1, '#8B5CF6');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, barW, h, 3);
        ctx.fill();
      }
    };
    draw();
  }, []);

  const formatTime = (s) => {
    const m = Math.floor(s / 60); const sec = s % 60;
    return `${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
  };

  // Audio recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const chunks = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlobState(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
        cancelAnimationFrame(animFrameRef.current);
        audioCtx.close();
      };
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      setAudioUrl(null);
      setError('');
      timerRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000);
      drawWaveform();
    } catch (err) { setError('Microphone access denied.'); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  useEffect(() => () => { clearInterval(timerRef.current); cancelAnimationFrame(animFrameRef.current); }, []);

  const processAudio = async () => {
    if (!audioBlobState) return;
    setLoading(true);
    try {
      const fd = new FormData(); fd.append('file', audioBlobState, 'recording.webm');
      const res = await fetch('http://localhost:8000/api/ingest/audio', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Audio processing failed.');
      const data = await res.json();
      setNativeText(data.native_transcript);
      setEnglishText(data.english_translation);
      setDetectedLang(data.detected_language);
      setConfidence(data.confidence);
      setNotes(data.english_translation);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  // Camera
  const capture = useCallback(() => {
    const src = webcamRef.current.getScreenshot();
    setCapturedImage(src);
    setShowCamera(false);
  }, []);

  const dataURLtoBlob = (d) => {
    let a=d.split(','),m=a[0].match(/:(.*?);/)[1],b=atob(a[1]),n=b.length,u=new Uint8Array(n);
    while(n--) u[n]=b.charCodeAt(n);
    return new Blob([u],{type:m});
  };

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (f) { setUploadedFile(f); const r=new FileReader(); r.onloadend=()=>setCapturedImage(r.result); r.readAsDataURL(f); }
  };

  // Toggles
  const toggle = (arr, set, val) => set(arr.includes(val) ? arr.filter(v=>v!==val) : [...arr, val]);

  // Submit
  const handleSubmit = async () => {
    setLoading(true); setError('');
    try {
      let res;
      if (capturedImage) {
        const blob = uploadedFile || dataURLtoBlob(capturedImage);
        const fd = new FormData(); fd.append('file', blob, uploadedFile?.name || 'photo.jpg');
        res = await fetch('http://localhost:8000/api/ingest/file', { method:'POST', body:fd });
      } else {
        const raw = `Name: ${name}. Phone: ${phone}. Location: ${location}. Skills: ${selectedSkills.join(', ')}. Available: ${availableDays.join(', ')}. Languages: ${languages.join(', ')}. Notes: ${notes}`;
        res = await fetch('http://localhost:8000/api/ingest/text', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({raw_text:raw,hint_language:'en'}) });
      }
      if (!res.ok) throw new Error('Network error.');
      setSuccess(true);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const progress = ((step+1)/5)*100;
  const canNext = () => { if(step===1) return name.trim()&&phone.trim()&&location.trim(); if(step===2) return selectedSkills.length>0; if(step===3) return availableDays.length>0&&languages.length>0; return true; };

  const Chip = ({active,onClick,children,color}) => (
    <button type="button" onClick={onClick} style={{display:'inline-flex',alignItems:'center',gap:'8px',padding:'14px 20px',borderRadius:'16px',fontSize:'1.1rem',fontWeight:700,background:active?(color||'var(--primary)'):'#F1F5F9',color:active?'white':'var(--text-main)',border:active?'none':'2px solid var(--border-color)',boxShadow:active?`0 4px 0 ${color||'var(--primary)'}90`:'0 3px 0 var(--border-color)',width:'auto'}}>{children}</button>
  );

  if (success) {
    return (
      <div className="page-container animate-fade-in" style={{justifyContent:'center',textAlign:'center'}}>
        <CheckCircle size={80} color="var(--success)" style={{margin:'0 auto 24px'}} />
        <h1 style={{fontSize:'2.5rem',marginBottom:'16px'}}>Thank You{name?`, ${name}`:''}!</h1>
        <div className="accessible-card" style={{textAlign:'left',margin:'24px 0'}}>
          {selectedSkills.length>0 && <p style={{marginBottom:'8px'}}><strong>Skills:</strong> {selectedSkills.map(s=>SKILLS.find(sk=>sk.id===s)?.label).join(', ')}</p>}
          {availableDays.length>0 && <p style={{marginBottom:'8px'}}><strong>Available:</strong> {availableDays.join(', ')}</p>}
          {languages.length>0 && <p><strong>Languages:</strong> {languages.join(', ')}</p>}
        </div>
        {confidence && (
          <div className="accessible-card" style={{border:`3px solid ${confidence==='high'?'var(--success)':'#D97706'}`,marginBottom:'24px'}}>
            <h3 style={{fontSize:'1rem',color:'var(--text-muted)',marginBottom:'8px'}}>AI Transcription Confidence</h3>
            <div style={{fontSize:'2.5rem',fontWeight:900,color:confidence==='high'?'var(--success)':'#D97706'}}>{confidence==='high'?'98%':confidence==='medium'?'82%':'65%'}</div>
            <p style={{fontSize:'0.95rem',color:'var(--text-muted)',marginTop:'4px'}}>{confidence==='high'?'Excellent semantic preservation':'May need manual review'}</p>
          </div>
        )}
        <button className="btn-primary" onClick={()=>navigate('/')} style={{height:'70px',fontSize:'1.4rem'}}>Go Home</button>
      </div>
    );
  }

  return (
    <div className="page-container animate-fade-in">
      <button className="btn-outline" onClick={()=>step>0?setStep(step-1):navigate('/')} style={{width:'auto',alignSelf:'flex-start',padding:'12px 20px',marginBottom:'16px'}}><ArrowLeft size={24} /> {step>0?'Previous':'Back'}</button>
      <div style={{width:'100%',height:'10px',background:'#E2E8F0',borderRadius:'8px',marginBottom:'24px',overflow:'hidden'}}><div style={{width:`${progress}%`,height:'100%',background:'linear-gradient(90deg,#3B82F6,#8B5CF6)',borderRadius:'8px',transition:'width 0.4s ease'}} /></div>

      {/* STEP 0: Input Method */}
      {step===0 && (
        <div className="animate-fade-in">
          <div style={{textAlign:'center',marginBottom:'32px'}}><h2 style={{fontSize:'1.8rem'}}>How do you want to register?</h2><p className="page-subtitle">Pick the easiest option for you.</p></div>

          {!showCamera && !capturedImage && !nativeText && !isRecording && !audioUrl && (
            <div style={{display:'flex',flexDirection:'column',gap:'20px'}}>
              <button type="button" className="btn-primary" style={{height:'140px',flexDirection:'column',gap:'12px'}} onClick={startRecording}><Mic size={48} /><span style={{fontSize:'1.5rem'}}>SPEAK YOUR DETAILS</span><span style={{fontSize:'0.9rem',fontWeight:'normal'}}>Any language — we will translate</span></button>
              <button type="button" className="btn-success" style={{height:'120px',flexDirection:'column',gap:'10px'}} onClick={()=>setShowCamera(true)}><Camera size={40} /><span style={{fontSize:'1.3rem'}}>TAKE A PHOTO</span></button>
              <button type="button" className="btn-outline" style={{height:'80px'}} onClick={()=>fileInputRef.current.click()}><Upload size={24} /> UPLOAD A FILE</button>
              <input ref={fileInputRef} type="file" accept="image/*,.pdf" style={{display:'none'}} onChange={handleFileChange} />
              <button type="button" className="btn-outline" style={{height:'80px'}} onClick={()=>setStep(1)}><Send size={24} /> I WILL TYPE IT</button>
            </div>
          )}

          {/* Live Waveform Recording */}
          {isRecording && (
            <div className="accessible-card animate-fade-in" style={{textAlign:'center'}}>
              <div style={{fontSize:'3rem',fontWeight:900,color:'var(--danger)',marginBottom:'8px'}}>{formatTime(recordingTime)}</div>
              <p style={{fontSize:'1.2rem',color:'var(--text-muted)',marginBottom:'16px'}}>Listening... speak naturally</p>
              <canvas ref={canvasRef} width={320} height={80} style={{width:'100%',height:'80px',borderRadius:'12px',marginBottom:'24px'}} />
              <button type="button" className="btn-danger animate-pulse-record" style={{height:'100px',flexDirection:'column',gap:'8px'}} onClick={stopRecording}><Square size={48} /><span style={{fontSize:'1.4rem'}}>TAP TO STOP</span></button>
            </div>
          )}

          {/* Audio Playback + Process */}
          {audioUrl && !nativeText && !loading && (
            <div className="accessible-card animate-fade-in" style={{textAlign:'center'}}>
              <h3 style={{marginBottom:'16px'}}>Review Your Recording</h3>
              <audio controls src={audioUrl} style={{width:'100%',marginBottom:'24px',borderRadius:'12px'}} />
              <button className="btn-primary" onClick={processAudio} style={{height:'80px',fontSize:'1.4rem'}}><Send size={28} /> PROCESS & TRANSLATE</button>
              <button className="btn-outline" onClick={()=>{setAudioUrl(null);setAudioBlobState(null);}} style={{marginTop:'8px'}}><RotateCcw size={20} /> Record Again</button>
            </div>
          )}

          {/* Transcript Result */}
          {nativeText && (
            <div className="accessible-card animate-fade-in">
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
                <h3>Transcription Result</h3>
                {confidence && <span style={{background:confidence==='high'?'#DCFCE7':'#FEF3C7',color:confidence==='high'?'#166534':'#92400E',padding:'6px 14px',borderRadius:'12px',fontWeight:700,fontSize:'0.9rem'}}>{confidence.toUpperCase()}</span>}
              </div>
              {detectedLang && <p style={{fontSize:'0.95rem',color:'var(--text-muted)',marginBottom:'12px'}}>Detected language: <strong>{detectedLang}</strong></p>}
              <div style={{background:'#EFF6FF',padding:'20px',borderRadius:'16px',fontSize:'1.2rem',marginBottom:'16px',borderLeft:'5px solid #3B82F6'}}>
                <span style={{fontSize:'0.85rem',color:'#3B82F6',fontWeight:700}}>NATIVE</span><br/>"{nativeText}"
              </div>
              <div style={{background:'#F0FDF4',padding:'20px',borderRadius:'16px',fontSize:'1.2rem',marginBottom:'24px',borderLeft:'5px solid #16A34A'}}>
                <span style={{fontSize:'0.85rem',color:'#16A34A',fontWeight:700}}>ENGLISH</span><br/>"{englishText}"
              </div>
              <button className="btn-primary" onClick={()=>setStep(1)} style={{height:'70px',fontSize:'1.3rem'}}>CONTINUE TO DETAILS <ChevronRight size={24} /></button>
              <button className="btn-outline" onClick={()=>{setNativeText('');setEnglishText('');setAudioUrl(null);setAudioBlobState(null);}}>Try Again</button>
            </div>
          )}

          {/* Camera */}
          {showCamera && !capturedImage && (
            <div className="accessible-card" style={{padding:'8px',background:'#000',position:'relative'}}>
              <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" videoConstraints={{facingMode}} style={{width:'100%',borderRadius:'16px'}} />
              {/* Scan guide overlay */}
              <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:'80%',height:'60%',border:'3px dashed rgba(255,255,255,0.5)',borderRadius:'16px',pointerEvents:'none'}} />
              <p style={{color:'rgba(255,255,255,0.7)',textAlign:'center',fontSize:'0.95rem',margin:'8px 0'}}>Align document inside the frame</p>
              <div style={{display:'flex',gap:'8px'}}>
                <button type="button" onClick={capture} className="btn-success" style={{flex:1,height:'70px',fontSize:'1.3rem'}}>SNAP</button>
                <button type="button" onClick={()=>setFacingMode(f=>f==='environment'?'user':'environment')} className="btn-outline" style={{width:'70px',height:'70px'}}><RefreshCw size={24} /></button>
              </div>
              <button type="button" onClick={()=>setShowCamera(false)} className="btn-outline" style={{marginTop:'8px'}}>Cancel</button>
            </div>
          )}

          {/* Image Preview */}
          {capturedImage && (
            <div className="accessible-card animate-fade-in">
              <h3 style={{marginBottom:'12px',textAlign:'center'}}>Does this look clear?</h3>
              <img src={capturedImage} alt="Captured" style={{width:'100%',borderRadius:'16px',marginBottom:'16px',maxHeight:'250px',objectFit:'cover'}} />
              <button className="btn-primary" onClick={handleSubmit} disabled={loading} style={{height:'70px',fontSize:'1.4rem'}}>{loading?<Loader2 className="animate-spin" size={28} />:'YES, SUBMIT'}</button>
              <button className="btn-outline" onClick={()=>{setCapturedImage(null);setUploadedFile(null);}}>Retake</button>
            </div>
          )}

          {loading && !audioUrl && <div style={{textAlign:'center',marginTop:'32px'}}><Loader2 size={48} className="animate-spin" style={{color:'var(--primary)'}} /><p style={{marginTop:'16px',fontSize:'1.2rem'}}>Processing...</p></div>}
          {error && <div style={{color:'var(--danger)',fontSize:'1.1rem',fontWeight:'bold',textAlign:'center',padding:'16px'}}>{error}</div>}
        </div>
      )}

      {/* STEP 1: Personal Details */}
      {step===1 && (
        <div className="animate-fade-in">
          <h2 style={{marginBottom:'8px'}}>Your Details</h2>
          <p className="page-subtitle" style={{marginBottom:'24px'}}>We need a few things to reach you.</p>
          <div className="accessible-card">
            <label><User size={18} style={{marginRight:'8px',verticalAlign:'middle'}} />Full Name</label>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Priya Sharma" />
            <label><Phone size={18} style={{marginRight:'8px',verticalAlign:'middle'}} />Phone Number</label>
            <input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="e.g. 9876543210" />
            <label><MapPin size={18} style={{marginRight:'8px',verticalAlign:'middle'}} />Your Area / Village</label>
            <input value={location} onChange={e=>setLocation(e.target.value)} placeholder="e.g. Koramangala, Bangalore" />
          </div>
          <button className="btn-primary" disabled={!canNext()} onClick={()=>setStep(2)} style={{height:'70px',fontSize:'1.3rem'}}>NEXT: Select Your Skills <ChevronRight size={24} /></button>
        </div>
      )}

      {/* STEP 2: Skills */}
      {step===2 && (
        <div className="animate-fade-in">
          <h2 style={{marginBottom:'8px'}}>What can you do?</h2>
          <p className="page-subtitle" style={{marginBottom:'24px'}}>Tap all the skills you have.</p>
          <div style={{display:'flex',flexWrap:'wrap',gap:'12px',marginBottom:'32px'}}>
            {SKILLS.map(s=>{const I=s.icon; return <Chip key={s.id} active={selectedSkills.includes(s.id)} color={s.color} onClick={()=>toggle(selectedSkills,setSelectedSkills,s.id)}><I size={20} /> {s.label}</Chip>;})}
          </div>
          <button className="btn-primary" disabled={!canNext()} onClick={()=>setStep(3)} style={{height:'70px',fontSize:'1.3rem'}}>NEXT: Availability <ChevronRight size={24} /></button>
        </div>
      )}

      {/* STEP 3: Availability & Languages */}
      {step===3 && (
        <div className="animate-fade-in">
          <h2 style={{marginBottom:'8px'}}><Clock size={28} style={{verticalAlign:'middle',marginRight:'8px'}} />When are you free?</h2>
          <p className="page-subtitle" style={{marginBottom:'20px'}}>Tap the days you can volunteer.</p>
          <div style={{display:'flex',flexWrap:'wrap',gap:'10px',marginBottom:'32px'}}>{DAYS.map(d=><Chip key={d} active={availableDays.includes(d)} color="#2563EB" onClick={()=>toggle(availableDays,setAvailableDays,d)}>{d}</Chip>)}</div>
          <h2 style={{marginBottom:'8px'}}><Globe size={28} style={{verticalAlign:'middle',marginRight:'8px'}} />Languages you speak</h2>
          <p className="page-subtitle" style={{marginBottom:'20px'}}>Select all that apply.</p>
          <div style={{display:'flex',flexWrap:'wrap',gap:'10px',marginBottom:'32px'}}>{LANGUAGES.map(l=><Chip key={l} active={languages.includes(l)} color="#059669" onClick={()=>toggle(languages,setLanguages,l)}>{l}</Chip>)}</div>
          <label>Anything else? (optional)</label>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="e.g. I have a truck..." style={{minHeight:'100px'}} />
          <button className="btn-primary" disabled={!canNext()} onClick={()=>setStep(4)} style={{height:'70px',fontSize:'1.3rem'}}>REVIEW YOUR INFO <ChevronRight size={24} /></button>
        </div>
      )}

      {/* STEP 4: Review */}
      {step===4 && (
        <div className="animate-fade-in">
          <h2 style={{marginBottom:'20px'}}>Review & Submit</h2>
          <div className="accessible-card" style={{marginBottom:'16px'}}>
            <h3 style={{color:'var(--text-muted)',fontSize:'1rem',marginBottom:'4px'}}>NAME</h3>
            <p style={{fontSize:'1.4rem',fontWeight:700,marginBottom:'16px'}}>{name}</p>
            <h3 style={{color:'var(--text-muted)',fontSize:'1rem',marginBottom:'4px'}}>PHONE</h3>
            <p style={{fontSize:'1.4rem',fontWeight:700,marginBottom:'16px'}}>{phone}</p>
            <h3 style={{color:'var(--text-muted)',fontSize:'1rem',marginBottom:'4px'}}>LOCATION</h3>
            <p style={{fontSize:'1.4rem',fontWeight:700}}>{location}</p>
          </div>
          <div className="accessible-card" style={{marginBottom:'16px'}}>
            <h3 style={{color:'var(--text-muted)',fontSize:'1rem',marginBottom:'12px'}}>SKILLS</h3>
            <div style={{display:'flex',flexWrap:'wrap',gap:'8px'}}>{selectedSkills.map(id=>{const s=SKILLS.find(x=>x.id===id);const I=s.icon;return <span key={id} style={{display:'inline-flex',alignItems:'center',gap:'6px',background:s.color,color:'white',padding:'8px 14px',borderRadius:'12px',fontWeight:700,fontSize:'1rem'}}><I size={16}/>{s.label}</span>;})}</div>
          </div>
          <div className="accessible-card" style={{marginBottom:'24px'}}>
            <h3 style={{color:'var(--text-muted)',fontSize:'1rem',marginBottom:'8px'}}>AVAILABLE</h3>
            <p style={{fontSize:'1.2rem',fontWeight:600,marginBottom:'12px'}}>{availableDays.join(', ')}</p>
            <h3 style={{color:'var(--text-muted)',fontSize:'1rem',marginBottom:'8px'}}>LANGUAGES</h3>
            <p style={{fontSize:'1.2rem',fontWeight:600}}>{languages.join(', ')}</p>
            {notes && <><h3 style={{color:'var(--text-muted)',fontSize:'1rem',marginBottom:'8px',marginTop:'12px'}}>NOTES</h3><p style={{fontSize:'1.1rem'}}>{notes}</p></>}
          </div>
          <button className="btn-success" onClick={handleSubmit} disabled={loading} style={{height:'80px',fontSize:'1.5rem'}}>{loading?<Loader2 className="animate-spin" size={32}/>:<CheckCircle size={32}/>}{loading?'REGISTERING...':'CONFIRM & REGISTER'}</button>
          {error && <div style={{color:'var(--danger)',fontSize:'1.1rem',fontWeight:'bold',textAlign:'center',padding:'16px'}}>{error}</div>}
        </div>
      )}
    </div>
  );
}
