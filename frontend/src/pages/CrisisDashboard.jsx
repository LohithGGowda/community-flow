import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Loader2, User, MapPin, Send, CheckCircle, XCircle } from 'lucide-react';

export default function CrisisDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState([]);
  const [deployStatus, setDeployStatus] = useState({}); // Track deploy state per volunteer

  const [formData, setFormData] = useState({
    description: '',
    required_skills: '',
    location: '',
    volunteers_needed: 5,
    urgency: 'high'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setDeployStatus({});
    
    try {
      const payload = {
        ...formData,
        required_skills: formData.required_skills.split(',').map(s => s.trim())
      };

      const response = await fetch('http://localhost:8000/api/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        setMatches(data.matches || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendAlert = (volunteerId) => {
    // 1. Set to polling state
    setDeployStatus(prev => ({ ...prev, [volunteerId]: 'polling' }));
    
    // 2. Mocking the Twilio SMS loop: Wait 3 seconds, then randomly approve or deny
    setTimeout(() => {
      const isAccepted = Math.random() > 0.3; // 70% chance they say YES
      setDeployStatus(prev => ({ ...prev, [volunteerId]: isAccepted ? 'deployed' : 'declined' }));
    }, 3000);
  };

  return (
    <div className="page-container animate-fade-in">
      <button 
        onClick={() => navigate('/')} 
        style={{ background: 'transparent', border: 'none', color: 'white', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', cursor: 'pointer' }}
      >
        <ArrowLeft size={20} /> Back
      </button>

      <div className="page-header" style={{ textAlign: 'left' }}>
        <h1 className="page-title">Find Volunteers</h1>
        <p className="page-subtitle">Describe the crisis and we'll match you with the best people.</p>
      </div>

      <div className="glass-card" style={{ marginBottom: '24px' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
          <label>Situation Description</label>
          <textarea 
            required
            value={formData.description}
            onChange={e => setFormData({...formData, description: e.target.value})}
            placeholder="E.g. Flooding in downtown..."
            style={{ minHeight: '100px' }}
          />

          <label>Required Skills (comma separated)</label>
          <input 
            required
            value={formData.required_skills}
            onChange={e => setFormData({...formData, required_skills: e.target.value})}
            placeholder="first aid, driving, heavy lifting" 
          />

          <label>Location</label>
          <input 
            required
            value={formData.location}
            onChange={e => setFormData({...formData, location: e.target.value})}
            placeholder="Downtown Area" 
          />

          <button type="submit" className="btn-secondary" disabled={loading} style={{ marginTop: '16px' }}>
            {loading ? <Loader2 className="animate-spin" /> : <Search />}
            {loading ? 'Finding matches...' : 'Find Matches'}
          </button>
        </form>
      </div>

      {matches.length > 0 && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ marginBottom: '8px' }}>Top Matches ({matches.length})</h3>
          {matches.map((match, idx) => {
            const status = deployStatus[match.volunteer_id];
            
            return (
              <div key={idx} className="glass-card" style={{ padding: '16px', position: 'relative', overflow: 'hidden' }}>
                {status === 'deployed' && (
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#10b981' }} />
                )}
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: 'rgba(255,255,255,0.1)', padding: '12px', borderRadius: '50%' }}>
                      <User size={24} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '1.2rem', margin: 0 }}>{match.volunteer_details?.name || 'Unknown Volunteer'}</h4>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        <MapPin size={14} /> {match.volunteer_details?.location}
                      </div>
                    </div>
                  </div>
                  <div style={{ background: 'var(--secondary-gradient)', padding: '4px 12px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                    {Math.round(match.match_score * 100)}% Match
                  </div>
                </div>
                
                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  <strong>Skills:</strong> {match.volunteer_details?.skills?.join(', ')}
                </div>

                {/* Deployment Action Area */}
                {!status ? (
                  <button 
                    className="btn-primary" 
                    style={{ padding: '12px', fontSize: '0.95rem' }}
                    onClick={() => handleSendAlert(match.volunteer_id)}
                  >
                    <Send size={18} /> Send SMS Alert
                  </button>
                ) : status === 'polling' ? (
                  <button 
                    className="btn-primary" 
                    style={{ padding: '12px', fontSize: '0.95rem', background: 'rgba(255,255,255,0.1)', color: '#94a3b8' }}
                    disabled
                  >
                    <Loader2 size={18} className="animate-spin" /> Waiting for reply...
                  </button>
                ) : status === 'deployed' ? (
                  <button 
                    className="btn-primary" 
                    style={{ padding: '12px', fontSize: '0.95rem', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }}
                    disabled
                  >
                    <CheckCircle size={18} /> Volunteer Deployed
                  </button>
                ) : (
                  <button 
                    className="btn-primary" 
                    style={{ padding: '12px', fontSize: '0.95rem', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}
                    disabled
                  >
                    <XCircle size={18} /> Declined Request
                  </button>
                )}
                
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
