import React from 'react';
import { Viewer } from '../renderer/index.js';

const ViewSplat = () => {

  const splat = () => {
    const viewer = new Viewer({
      'cameraUp': [0, -1, -0.54],
      'initialCameraPosition': [-3.15634, -0.16946, -0.51552],
      'initialCameraLookAt': [1.52976, 2.27776, 1.65898],
      'sphericalHarmonicsDegree': 2,
    });

    viewer.addSplatScene('/lego.ply', {
      'progressiveLoad' : false
    }).then(() => {
      viewer.start();
    });
  }

  return (
    <div>
      <div ref={splat}/>
    </div>
);
};

export default ViewSplat;