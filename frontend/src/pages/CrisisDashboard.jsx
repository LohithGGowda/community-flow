import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Loader2, User, MapPin, Send, CheckCircle, XCircle } from 'lucide-react';

export default function CrisisDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState([]);
  const [deployStatus, setDeployStatus] = useState({}); 

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
    setDeployStatus(prev => ({ ...prev, [volunteerId]: 'polling' }));
    setTimeout(() => {
      const isAccepted = Math.random() > 0.3;
      setDeployStatus(prev => ({ ...prev, [volunteerId]: isAccepted ? 'deployed' : 'declined' }));
    }, 3000);
  };

  return (
    <div className="page-container animate-fade-in">
      <button className="btn-outline" onClick={() => navigate('/')} style={{ width: 'auto', alignSelf: 'flex-start', padding: '12px 20px', marginBottom: '24px' }}>
        <ArrowLeft size={24} /> Back
      </button>

      <div className="page-header" style={{ textAlign: 'left' }}>
        <h1 className="page-title">Find Help Fast</h1>
        <p className="page-subtitle" style={{ fontSize: '1.2rem' }}>Tell us what is happening and we will find people.</p>
      </div>

      <div className="accessible-card">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
          
          <label>1. What happened?</label>
          <textarea 
            required
            value={formData.description}
            onChange={e => setFormData({...formData, description: e.target.value})}
            placeholder="e.g. A flood damaged 5 houses..."
            style={{ minHeight: '120px' }}
          />

          <label>2. Where is it?</label>
          <input 
            required
            value={formData.location}
            onChange={e => setFormData({...formData, location: e.target.value})}
            placeholder="e.g. Village Square" 
          />

          <label>3. What skills are needed?</label>
          <input 
            required
            value={formData.required_skills}
            onChange={e => setFormData({...formData, required_skills: e.target.value})}
            placeholder="e.g. Medical, Driving" 
          />

          <button type="submit" className="btn-primary" disabled={loading} style={{ height: '80px', marginTop: '16px' }}>
            {loading ? <Loader2 className="animate-spin" size={32} /> : <Search size={32} />}
            {loading ? 'SEARCHING...' : 'FIND PEOPLE'}
          </button>
        </form>
      </div>

      {matches.length > 0 && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '24px' }}>
          <h2>Found {matches.length} Volunteers</h2>
          {matches.map((match, idx) => {
            const status = deployStatus[match.volunteer_id];
            
            return (
              <div key={idx} className="accessible-card" style={{ padding: '24px', border: status === 'deployed' ? '4px solid var(--success)' : '' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ background: '#E2E8F0', padding: '16px', borderRadius: '50%', color: 'var(--primary)' }}>
                      <User size={32} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.5rem' }}>{match.volunteer_details?.name || 'Volunteer'}</h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '1.1rem', marginTop: '4px' }}>
                        <MapPin size={18} /> {match.volunteer_details?.location}
                      </div>
                    </div>
                  </div>
                  <div style={{ background: '#DBEAFE', color: '#1E40AF', padding: '8px 16px', borderRadius: '16px', fontSize: '1rem', fontWeight: 'bold' }}>
                    {Math.round(match.match_score * 100)}% Match
                  </div>
                </div>
                
                <div style={{ fontSize: '1.2rem', color: 'var(--text-main)', marginBottom: '24px', background: '#F8FAFC', padding: '12px', borderRadius: '12px' }}>
                  <strong>Can do:</strong> {match.volunteer_details?.skills?.join(', ')}
                </div>

                {/* Deployment Action Area */}
                {!status ? (
                  <button 
                    className="btn-primary" 
                    style={{ height: '70px' }}
                    onClick={() => handleSendAlert(match.volunteer_id)}
                  >
                    <Send size={24} /> MESSAGE THEM
                  </button>
                ) : status === 'polling' ? (
                  <button 
                    className="btn-outline" 
                    style={{ height: '70px' }}
                    disabled
                  >
                    <Loader2 size={24} className="animate-spin" /> WAITING FOR REPLY...
                  </button>
                ) : status === 'deployed' ? (
                  <button 
                    className="btn-success" 
                    style={{ height: '70px' }}
                    disabled
                  >
                    <CheckCircle size={24} /> THEY ARE COMING
                  </button>
                ) : (
                  <button 
                    className="btn-danger" 
                    style={{ height: '70px' }}
                    disabled
                  >
                    <XCircle size={24} /> THEY CANNOT COME
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
