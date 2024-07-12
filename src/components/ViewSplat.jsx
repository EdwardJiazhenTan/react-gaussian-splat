import React, { useEffect, useRef } from 'react';
import { Viewer } from '../renderer/index.js';

const ViewSplat = () => {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;

    const viewer = new Viewer({
      cameraUp: [0, 1, 0],
      initialCameraPosition: [0, 0, 0],
      initialCameraLookAt: [0, 0, 0],
      container: mount // Ensure the viewer is attached to the mountRef element
    });

    viewer.addSplatScene('../assets/lego.ply', {
      splatAlphaRemovalThreshold: 5,
      showLoadingUI: true,
      position: [0, 1, 0],
      rotation: [0, 0, 0, 1],
      scale: [1.5, 1.5, 1.5]
    }).then(() => {
      viewer.start();
    }).catch((error) => {
      console.error('Error loading splat scene:', error);
    });

    return () => {
      // Clean up if necessary
      viewer.dispose();
    };
  }, []);

  return <div ref={mountRef} style={{ width: '100%', height: '100vh' }} />;
};

export default ViewSplat;
