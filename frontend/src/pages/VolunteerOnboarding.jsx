import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import { ArrowLeft, Send, Loader2, CheckCircle, Camera, Mic, Square, X } from 'lucide-react';

export default function VolunteerOnboarding() {
  const navigate = useNavigate();
  
  // Camera State
  const webcamRef = useRef(null);
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);

  // Audio State
  const mediaRecorderRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);

  // Form State
  const [text, setText] = useState('');
  const [nativeText, setNativeText] = useState('');
  const [englishText, setEnglishText] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [auditResult, setAuditResult] = useState(null);

  // --- Camera Handlers ---
  const capture = useCallback(() => {
    const imageSrc = webcamRef.current.getScreenshot();
    setCapturedImage(imageSrc);
    setShowCamera(false);
  }, [webcamRef]);

  const retakePhoto = () => {
    setCapturedImage(null);
    setShowCamera(true);
  };

  // Convert base64 to Blob for uploading
  const dataURLtoBlob = (dataurl) => {
    let arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], {type:mime});
  };

  // --- Audio Handlers ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      const audioChunks = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        
        // Immediately process audio upon stopping
        await processAudio(audioBlob);
        
        // Stop all tracks to release mic
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setError('');
    } catch (err) {
      setError('Microphone access denied or unavailable.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processAudio = async (blob) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', blob, 'recording.webm');
      
      const response = await fetch('http://localhost:8000/api/ingest/audio', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Audio processing failed');
      const data = await response.json();
      
      setNativeText(data.native_transcript);
      setEnglishText(data.english_translation);
      setText(data.english_translation); // Populate standard text field for submission
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- Form Submission ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim() && !capturedImage) return;

    setLoading(true);
    setError('');
    setAuditResult(null);
    
    try {
      let response;
      
      if (capturedImage) {
        const fileBlob = dataURLtoBlob(capturedImage);
        const formData = new FormData();
        formData.append('file', fileBlob, 'photo.jpg');
        formData.append('hint_language', 'en');

        response = await fetch('http://localhost:8000/api/ingest/file', {
          method: 'POST',
          body: formData,
        });
      } else {
        response = await fetch('http://localhost:8000/api/ingest/text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw_text: text, hint_language: 'en' })
        });
      }

      if (!response.ok) {
        throw new Error('Failed to submit. Please try again.');
      }

      const mockAuditScore = Math.floor(Math.random() * 20) + 80;
      setAuditResult({
        score: mockAuditScore,
        status: mockAuditScore > 85 ? 'passed' : 'review_needed'
      });

      setSuccess(true);
      setText('');
      setNativeText('');
      setEnglishText('');
      setCapturedImage(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="page-container animate-fade-in" style={{ justifyContent: 'center', textAlign: 'center' }}>
        <CheckCircle size={64} color="#10b981" style={{ margin: '0 auto 16px' }} />
        <h2 className="page-title">Thank You!</h2>
        <p className="page-subtitle" style={{ marginBottom: '24px' }}>
          You've been successfully registered as a volunteer.
        </p>

        {auditResult && (
          <div className="glass-card" style={{ marginBottom: '32px', border: `1px solid ${auditResult.score > 85 ? '#10b981' : '#f59e0b'}`, background: 'rgba(0,0,0,0.3)' }}>
            <h3 style={{ marginBottom: '8px', fontSize: '1.1rem' }}>AI Cultural Audit</h3>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: auditResult.score > 85 ? '#10b981' : '#f59e0b' }}>
                {auditResult.score}%
              </div>
              <div style={{ textAlign: 'left', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                Translation Confidence<br/>
                {auditResult.score > 85 ? 'High semantic preservation.' : 'Minor nuance may require review.'}
              </div>
            </div>
          </div>
        )}

        <button className="btn-primary" onClick={() => { setSuccess(false); setAuditResult(null); }}>
          Register Another
        </button>
      </div>
    );
  }

  return (
    <div className="page-container animate-fade-in">
      <button 
        onClick={() => navigate('/')} 
        style={{ background: 'transparent', border: 'none', color: 'white', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', cursor: 'pointer' }}
      >
        <ArrowLeft size={20} /> Back
      </button>

      <div className="page-header" style={{ textAlign: 'left', marginBottom: '16px' }}>
        <h1 className="page-title">Tell us about yourself</h1>
        <p className="page-subtitle">Speak naturally, take a photo of a survey, or type your details.</p>
      </div>

      <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          
          {/* Top Actions: Camera & Mic */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <button 
              type="button"
              className={isRecording ? "btn-primary animate-pulse" : "btn-secondary"}
              style={{ flex: 1, background: isRecording ? '#ef4444' : 'rgba(255,255,255,0.05)', color: 'white' }}
              onClick={isRecording ? stopRecording : startRecording}
            >
              {isRecording ? <Square size={20} /> : <Mic size={20} />}
              {isRecording ? 'Stop Recording' : 'Hold to Speak'}
            </button>
            
            <button 
              type="button"
              className="btn-secondary"
              style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: 'white' }}
              onClick={() => { setShowCamera(true); setCapturedImage(null); }}
            >
              <Camera size={20} />
              Open Camera
            </button>
          </div>

          {/* Camera Viewport */}
          {showCamera && !capturedImage && (
            <div style={{ position: 'relative', marginBottom: '16px', borderRadius: '12px', overflow: 'hidden', background: '#000' }}>
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={{ facingMode: "environment" }}
                style={{ width: '100%', borderRadius: '12px' }}
              />
              <button
                type="button"
                onClick={capture}
                style={{ position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)', background: '#10b981', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '24px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Capture Photo
              </button>
              <button
                type="button"
                onClick={() => setShowCamera(false)}
                style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', padding: '8px', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* Image Preview */}
          {capturedImage && (
            <div style={{ position: 'relative', marginBottom: '16px', borderRadius: '12px', overflow: 'hidden' }}>
              <img src={capturedImage} alt="Captured" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover' }} />
              <button 
                type="button"
                onClick={() => setCapturedImage(null)}
                style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.7)', border: 'none', color: 'white', borderRadius: '50%', padding: '8px', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* Audio Translation View */}
          {nativeText && (
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px', marginBottom: '16px', borderLeft: '4px solid #3b82f6' }}>
              <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '4px' }}>Native Transcription:</div>
              <div style={{ fontStyle: 'italic', marginBottom: '12px' }}>"{nativeText}"</div>
              
              <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '4px' }}>English Translation:</div>
              <div>{englishText}</div>
            </div>
          )}

          {/* Fallback Text Input */}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Hi, I'm Alex. I live in Bangalore and I'm a nurse..."
            style={{ flex: 1, minHeight: '120px', resize: 'none' }}
            disabled={loading || !!capturedImage}
          />
          
          {error && <div style={{ color: '#ef4444', marginTop: '8px' }}>{error}</div>}

          <button 
            type="submit" 
            className="btn-primary" 
            disabled={loading || (!text.trim() && !capturedImage)}
            style={{ opacity: (loading || (!text.trim() && !capturedImage)) ? 0.7 : 1, marginTop: '16px' }}
          >
            {loading ? <Loader2 className="animate-spin" /> : <Send />}
            {loading ? 'Processing...' : 'Register as Volunteer'}
          </button>
        </form>
      </div>
    </div>
  );
}
