import React from 'react';
import MapView from './MapView';
import Panel from './Panel';
export default function App(){
  return <div style={{display:'grid',gridTemplateColumns:'1fr 360px',height:'100vh'}}>
    <MapView />
    <Panel />
  </div>;
}