import React, { useEffect } from 'react';

type SetTime = (value: number | ((prev: number)=> number)) => void;
interface TimelineProps {
  playing: boolean;
  onToggle: () => void;
  currentTime: number; // ms since epoch
  setCurrentTime: SetTime;
  baseStart: number; // ms
  hoursSpan: number; // total hours span represented by slider
  isUserScrubbing: boolean;
  setIsUserScrubbing: (v: boolean)=> void;
}

export default function Timeline({ playing, onToggle, currentTime, setCurrentTime, baseStart, hoursSpan, isUserScrubbing, setIsUserScrubbing }: TimelineProps){
  // Map time to slider value (0..hoursSpan)
  const hourMs = 3600_000;
  const sliderMax = hoursSpan;
  const value = Math.max(0, Math.min(sliderMax, Math.round((currentTime - baseStart)/hourMs)));

  // Playback loop: increments 1 hour per second when playing
  useEffect(()=>{
    if(!playing) return;
    const id = setInterval(()=>{
      setCurrentTime((t: number) => {
        const next = t + hourMs; // advance one hour
        const cap = baseStart + hoursSpan * hourMs;
        return next > cap ? baseStart : next; // loop
      });
    }, 1000); // 1 hour per real second
    return ()=> clearInterval(id);
  },[playing, baseStart, hoursSpan, setCurrentTime]);

  const onChange = (n: number)=> {
    setCurrentTime(baseStart + n * hourMs);
  };
  const label = new Date(currentTime).toISOString().replace('T',' ').substring(0,16) + 'Z';
  return (
    <div style={containerStyle}>
      <button style={btnStyle} onClick={onToggle}>{playing? 'Pause':'Play'}</button>
      <input
        type="range"
        min={0}
        max={sliderMax}
        value={value}
        onChange={e=> onChange(Number(e.target.value))}
        onMouseDown={()=> setIsUserScrubbing(true)}
        onMouseUp={()=> setIsUserScrubbing(false)}
        style={{flex:1}}
      />
      <div style={labelStyle}>{label}</div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  position:'absolute',
  left: '50%',
  bottom: 12,
  transform: 'translateX(-50%)',
  display:'flex',
  alignItems:'center',
  gap:8,
  background:'rgba(10,20,30,0.75)',
  padding:'6px 12px',
  borderRadius:8,
  boxShadow:'0 2px 6px rgba(0,0,0,0.4)',
  backdropFilter:'blur(4px)',
  width:'min(720px, 90%)'
};
const btnStyle: React.CSSProperties = {
  background:'#1e425e',
  border:'1px solid #2f5c7d',
  color:'#e3eef6',
  padding:'6px 14px',
  fontSize:14,
  borderRadius:6,
  cursor:'pointer'
};
const labelStyle: React.CSSProperties = {
  minWidth: 150,
  textAlign:'right',
  fontSize:12,
  fontFamily:'monospace',
  color:'#d0e2f2'
};
