import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Loader2, CheckCircle, Camera, Image as ImageIcon, X } from 'lucide-react';

export default function VolunteerOnboarding() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const [auditResult, setAuditResult] = useState(null);

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      setText(''); // Clear text if they choose to upload an image instead
    }
  };

  const clearFile = () => {
    setFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim() && !file) return;

    setLoading(true);
    setError('');
    setAuditResult(null);
    
    try {
      let response;
      
      if (file) {
        // Send file to /api/ingest/file
        const formData = new FormData();
        formData.append('file', file);
        formData.append('hint_language', 'en');

        response = await fetch('http://localhost:8000/api/ingest/file', {
          method: 'POST',
          body: formData, // Do not set Content-Type header; browser sets it with boundaries for FormData
        });
      } else {
        // Send text to /api/ingest/text
        response = await fetch('http://localhost:8000/api/ingest/text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw_text: text, hint_language: 'en' })
        });
      }

      if (!response.ok) {
        throw new Error('Failed to submit. Please try again.');
      }

      // Feature 4: Mocking the Cultural Auditor response from backend
      // In production, the backend returns this data.
      const mockAuditScore = Math.floor(Math.random() * 20) + 80; // Random score between 80-99
      setAuditResult({
        score: mockAuditScore,
        status: mockAuditScore > 85 ? 'passed' : 'review_needed'
      });

      setSuccess(true);
      setText('');
      clearFile();
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

      <div className="page-header" style={{ textAlign: 'left' }}>
        <h1 className="page-title">Tell us about yourself</h1>
        <p className="page-subtitle">Type your details OR take a photo of a handwritten survey.</p>
      </div>

      <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          
          {/* File Upload / Camera Area */}
          {!previewUrl ? (
            <div 
              style={{ 
                border: '2px dashed var(--glass-border)', 
                borderRadius: '12px', 
                padding: '24px', 
                textAlign: 'center',
                marginBottom: '16px',
                cursor: 'pointer',
                background: 'rgba(0,0,0,0.2)'
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera size={32} style={{ margin: '0 auto 8px', color: 'var(--text-muted)' }} />
              <div style={{ color: 'var(--text-light)', fontWeight: 500 }}>Tap to Take Photo</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>or upload an image</div>
            </div>
          ) : (
            <div style={{ position: 'relative', marginBottom: '16px', borderRadius: '12px', overflow: 'hidden' }}>
              <img src={previewUrl} alt="Preview" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover' }} />
              <button 
                type="button"
                onClick={clearFile}
                style={{ 
                  position: 'absolute', top: '8px', right: '8px', 
                  background: 'rgba(0,0,0,0.7)', border: 'none', 
                  color: 'white', borderRadius: '50%', padding: '4px', cursor: 'pointer' 
                }}
              >
                <X size={16} />
              </button>
            </div>
          )}

          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            accept="image/*" 
            capture="environment" 
            style={{ display: 'none' }} 
          />

          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '16px', fontSize: '0.9rem' }}>
            — OR TYPE MANUALLY —
          </div>

          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); clearFile(); }}
            placeholder="Hi, I'm Alex. I live in Bangalore and I'm a nurse..."
            style={{ flex: 1, minHeight: '120px', resize: 'none' }}
            disabled={loading || !!file}
          />
          
          {error && <div style={{ color: '#ef4444', marginBottom: '16px' }}>{error}</div>}

          <button 
            type="submit" 
            className="btn-primary" 
            disabled={loading || (!text.trim() && !file)}
            style={{ opacity: (loading || (!text.trim() && !file)) ? 0.7 : 1, marginTop: '16px' }}
          >
            {loading ? <Loader2 className="animate-spin" /> : <Send />}
            {loading ? 'Processing...' : 'Register as Volunteer'}
          </button>
        </form>
      </div>
    </div>
  );
}
