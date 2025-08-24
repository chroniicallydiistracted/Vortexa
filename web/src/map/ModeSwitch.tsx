import React from 'react';

export function ModeSwitch({ mode, setMode, canUse3D }: { mode:'2d'|'3d'; setMode:(m:'2d'|'3d')=>void; canUse3D:boolean }) {
  if(!canUse3D) return null;
  const btnStyle: React.CSSProperties = { marginRight:4, padding:'2px 6px', fontSize:12 };
  return <div style={{position:'absolute', top:8, right:8, zIndex:20, background:'rgba(15,25,35,0.85)', color:'#e6f2fa', padding:'4px 8px', borderRadius:6, fontSize:12, display:'flex', alignItems:'center', gap:6}}>
    <span style={{opacity:0.6}}>Mode</span>
    <button onClick={()=> setMode('2d')} disabled={mode==='2d'} style={btnStyle}>2D</button>
    <button onClick={()=> setMode('3d')} disabled={mode==='3d'} style={btnStyle}>3D</button>
  </div>;
}

