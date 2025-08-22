import React, { useState } from 'react';
import MapView from './MapView';
import Panel from './Panel';
export default function App(){
  const tileEnv = (import.meta as any).env?.VITE_TILE_BASE;
  const [hideBanner, setHideBanner] = useState(false);
  const showBanner = !tileEnv && !hideBanner;
  return <div style={{display:'grid',gridTemplateRows: showBanner? '40px 1fr':'1fr', height:'100vh'}}>
    {showBanner && <div style={{background:'#ffecb3',padding:'6px 12px',display:'flex',alignItems:'center',gap:12,fontSize:14}}>
      <div style={{flex:1}}>Tile proxy base (VITE_TILE_BASE) is not configured; using http://localhost:4000/tiles</div>
      <button onClick={()=> setHideBanner(true)}>Dismiss</button>
    </div>}
    <div style={{display:'grid',gridTemplateColumns:'1fr 360px',height:'100%'}}>
      <MapView />
      <Panel />
    </div>
  </div>;
}