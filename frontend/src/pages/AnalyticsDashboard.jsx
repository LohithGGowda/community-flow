import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default Leaflet icon paths in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom Pins
const createCustomPin = (color) => {
  return new L.DivIcon({
    className: 'custom-pin',
    html: `<div style="background-color: ${color}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
};

const greenPin = createCustomPin('#10b981'); // Ready to deploy
const redPin = createCustomPin('#ef4444');   // Already deployed

export default function AnalyticsDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  // Center on Bangalore for the prototype
  const center = [12.9716, 77.5946];

  // Mock Data: Crisis Hotspots (Heatmap simulation using glowing circles)
  const hotspots = [
    { id: 1, pos: [12.9716, 77.5946], radius: 1500, intensity: '#ef4444', label: 'Downtown Flooding' },
    { id: 2, pos: [12.9121, 77.6446], radius: 1000, intensity: '#f59e0b', label: 'HSR Layout Power Outage' },
    { id: 3, pos: [12.9911, 77.5546], radius: 800, intensity: '#ef4444', label: 'Rajajinagar Medical Need' },
  ];

  // Mock Data: Volunteers
  const volunteers = [
    { id: 'v1', pos: [12.9750, 77.5900], name: 'Priya S.', status: 'available', skills: 'Nurse, First Aid' },
    { id: 'v2', pos: [12.9680, 77.6000], name: 'Rahul M.', status: 'deployed', skills: 'Driver' },
    { id: 'v3', pos: [12.9150, 77.6400], name: 'Amit K.', status: 'available', skills: 'Heavy Lifting' },
    { id: 'v4', pos: [12.9080, 77.6500], name: 'Sneha R.', status: 'deployed', skills: 'Cook, Volunteer' },
    { id: 'v5', pos: [12.9850, 77.5500], name: 'John D.', status: 'available', skills: 'Doctor' },
  ];

  useEffect(() => {
    // Simulate network load
    setTimeout(() => {
      setLoading(false);
    }, 600);
  }, []);

  return (
    <div className="page-container animate-fade-in" style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '100vh' }}>
      
      {/* Header Area Overlay */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000, padding: '24px', background: 'linear-gradient(to bottom, rgba(15,23,42,0.9) 0%, rgba(15,23,42,0) 100%)' }}>
        <button 
          onClick={() => navigate('/')} 
          style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', cursor: 'pointer', padding: '8px 16px', borderRadius: '24px', backdropFilter: 'blur(10px)' }}
        >
          <ArrowLeft size={20} /> Back
        </button>
        <h1 className="page-title" style={{ fontSize: '1.5rem', marginBottom: '4px' }}>Community Needs Map</h1>
        <p className="page-subtitle" style={{ fontSize: '0.9rem', color: '#e2e8f0' }}>Live crisis hotspots & volunteer deployment.</p>
        
        {/* Legend */}
        <div style={{ display: 'flex', gap: '16px', marginTop: '12px', fontSize: '0.8rem', background: 'rgba(0,0,0,0.6)', padding: '8px 16px', borderRadius: '12px', width: 'fit-content', backdropFilter: 'blur(5px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981' }}></div>
            Ready to Deploy
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }}></div>
            Already Deployed
          </div>
        </div>
      </div>

      {/* Map Area */}
      <div style={{ flex: 1, width: '100%', background: '#0f172a' }}>
        {!loading && (
          <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }} zoomControl={false}>
            {/* Dark theme OpenStreetMap tiles (CartoDB Dark Matter) */}
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />

            {/* Render Crisis Hotspots as glowing circles (Heatmap simulation) */}
            {hotspots.map((spot) => (
              <Circle 
                key={`spot-${spot.id}`}
                center={spot.pos}
                radius={spot.radius}
                pathOptions={{ 
                  color: spot.intensity, 
                  fillColor: spot.intensity, 
                  fillOpacity: 0.2, 
                  weight: 1 
                }}
              >
                <Popup className="dark-popup">
                  <strong>{spot.label}</strong><br/>High volume of requests.
                </Popup>
              </Circle>
            ))}

            {/* Render Volunteers */}
            {volunteers.map((vol) => (
              <Marker 
                key={vol.id} 
                position={vol.pos} 
                icon={vol.status === 'available' ? greenPin : redPin}
              >
                <Popup className="dark-popup">
                  <div style={{ margin: 0 }}>
                    <strong>{vol.name}</strong><br/>
                    <span style={{ color: vol.status === 'available' ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                      {vol.status === 'available' ? 'Ready to Deploy' : 'Already Deployed'}
                    </span><br/>
                    <span style={{ fontSize: '0.85em', color: '#64748b' }}>{vol.skills}</span>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </div>

      {/* Global CSS injected specifically for Map overrides to maintain dark theme */}
      <style>{`
        .leaflet-container {
          background: #0f172a;
          font-family: inherit;
        }
        .leaflet-popup-content-wrapper, .leaflet-popup-tip {
          background: #1e293b;
          color: #f8fafc;
          border: 1px solid rgba(255,255,255,0.1);
        }
        .leaflet-popup-content {
          margin: 12px;
          line-height: 1.4;
        }
        .leaflet-container a.leaflet-popup-close-button {
          color: #94a3b8;
        }
        .leaflet-control-attribution {
          background: rgba(0,0,0,0.5) !important;
          color: #94a3b8 !important;
        }
        .leaflet-control-attribution a {
          color: #cbd5e1 !important;
        }
      `}</style>
    </div>
  );
}
