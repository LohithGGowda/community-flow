import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Loader2, CheckCircle } from 'lucide-react';

export default function VolunteerOnboarding() {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;

    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('http://localhost:8000/api/ingest/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_text: text, hint_language: 'en' })
      });

      if (!response.ok) {
        throw new Error('Failed to submit. Please try again.');
      }

      setSuccess(true);
      setText('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="page-container animate-fade-in" style={{ justifyContent: 'center', textAlign: 'center' }}>
        <CheckCircle size={64} color="#10b981" style={{ margin: '0 auto 24px' }} />
        <h2 className="page-title">Thank You!</h2>
        <p className="page-subtitle" style={{ marginBottom: '32px' }}>
          You've been successfully registered as a volunteer. We will contact you when there's a match!
        </p>
        <button className="btn-primary" onClick={() => navigate('/')}>
          Return Home
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
        <p className="page-subtitle">Just write naturally. What skills do you have? Where are you located?</p>
      </div>

      <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Hi, I'm Alex. I live in Bangalore and I'm a nurse. I can help on weekends..."
            style={{ flex: 1, minHeight: '200px', resize: 'none' }}
            disabled={loading}
          />
          
          {error && <div style={{ color: '#ef4444', marginBottom: '16px' }}>{error}</div>}

          <button 
            type="submit" 
            className="btn-primary" 
            disabled={loading || !text.trim()}
            style={{ opacity: (loading || !text.trim()) ? 0.7 : 1 }}
          >
            {loading ? <Loader2 className="animate-spin" /> : <Send />}
            {loading ? 'Processing...' : 'Register as Volunteer'}
          </button>
        </form>
      </div>
    </div>
  );
}
