import React, { useState } from 'react';
import { Viewer } from '../renderers/index.js';

const ViewSplat = () => {
  const [isSplatVisible, setIsSplatVisible] = useState(false);
  const [cameraUp, setCameraUp] = useState('0, -1, -0.54');
  const [initialCameraPosition, setInitialCameraPosition] = useState('-3.15634, -0.16946, -0.51552');
  const [initialCameraLookAt, setInitialCameraLookAt] = useState('1.52976, 2.27776, 1.65898');
  const [sphericalHarmonicsDegree, setSphericalHarmonicsDegree] = useState(2);

  const handleInputChange = (setter) => (event) => {
    setter(event.target.value);
  };

  const parseArray = (str) => {
    return str.split(',').map(Number);
  };

  const splat = () => {
    setIsSplatVisible(true); // Hide the button after the scene is rendered
    
    const viewer = new Viewer({
      'cameraUp': parseArray(cameraUp),
      'initialCameraPosition': parseArray(initialCameraPosition),
      'initialCameraLookAt': parseArray(initialCameraLookAt),
      'sphericalHarmonicsDegree': Number(sphericalHarmonicsDegree),
    });

    viewer.addSplatScene('/lego.ply', {
      'progressiveLoad': false
    }).then(() => {
      viewer.start();
    });
  }

  return (
    <div>
      <div>
        <label>
          Camera Up:
          <input 
            type="text" 
            value={cameraUp} 
            onChange={handleInputChange(setCameraUp)} 
            placeholder="0, -1, -0.54"
          />
        </label> <br/>
        <label>
          Initial Camera Position:
          <input 
            type="text" 
            value={initialCameraPosition} 
            onChange={handleInputChange(setInitialCameraPosition)} 
            placeholder="-3.15634, -0.16946, -0.51552"
          />
        </label> <br/>
        <label>
          Initial Camera Look At:
          <input 
            type="text" 
            value={initialCameraLookAt} 
            onChange={handleInputChange(setInitialCameraLookAt)} 
            placeholder="1.52976, 2.27776, 1.65898"
          />
        </label> <br/>
        <label>
          Spherical Harmonics Degree:
          <input 
            type="number" 
            value={sphericalHarmonicsDegree} 
            onChange={handleInputChange(setSphericalHarmonicsDegree)} 
            placeholder="2"
          />
        </label> <br/>
      </div>
      <div>
        {!isSplatVisible && (
          <button onClick={splat}>Show Splat</button>
        )}
      </div>
    </div>
  );
};

export default ViewSplat;
