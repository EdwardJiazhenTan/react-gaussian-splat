import React, { useState } from 'react';
import { Viewer, PlyLoader, SplatLoader, KSplatLoader  } from '../renderer/index.js';

const LoadSplat = () => {
  const [file, setFile] = useState(null);
  const [alphaRemovalThreshold, setAlphaRemovalThreshold] = useState(1);
  const [antialiased, setAntialiased] = useState(false);
  const [sceneIs2D, setSceneIs2D] = useState(false);
  const [cameraUp, setCameraUp] = useState('0, 1, 0');
  const [cameraPosition, setCameraPosition] = useState('0, 1, 0');
  const [cameraLookAt, setCameraLookAt] = useState('1, 0, 0');
  const [sphericalHarmonicsDegree, setSphericalHarmonicsDegree] = useState(0);
  const [viewError, setViewError] = useState('');
  const [isTableVisible, setIsTableVisible] = useState(true);

  const onFileChange = (event) => {
    setFile(event.target.files[0]);
    document.getElementById('viewFileName').textContent = event.target.files[0]?.name || '(No file chosen)';
  };

  const viewSplat = () => {
    if (!file) {
      setViewError('Please choose a file to view.');
      return;
    }

    const alphaThreshold = parseInt(alphaRemovalThreshold, 10);
    if (isNaN(alphaThreshold) || alphaThreshold < 1 || alphaThreshold > 255) {
      setViewError('Invalid alpha removal threshold.');
      return;
    }

    const shDegree = parseInt(sphericalHarmonicsDegree, 10);
    if (isNaN(shDegree) || shDegree < 0 || shDegree > 2) {
      setViewError('Invalid SH degree.');
      return;
    }

    const cameraUpArray = cameraUp.split(',').map(Number);
    const cameraPositionArray = cameraPosition.split(',').map(Number);
    const cameraLookAtArray = cameraLookAt.split(',').map(Number);

    if (cameraUpArray.some(isNaN) || cameraPositionArray.some(isNaN) || cameraLookAtArray.some(isNaN)) {
      setViewError('Invalid camera parameters.');
      return;
    }

    const fileReader = new FileReader();
    fileReader.onload = function () {
      const extension = getExtension(file.name);
      var splatBufferPromise;
      if(extension === 'ply') {
        splatBufferPromise = PlyLoader.loadFromFileData(fileReader.result, alphaThreshold, 0, shDegree);
      } else if(extension === 'splat') {
        splatBufferPromise = SplatLoader.loadFromFileData(fileReader.result, alphaThreshold, 0, shDegree);
      } else if(extension === 'ksplat') {
        splatBufferPromise = KSplatLoader.loadFromFileData(fileReader.result, alphaThreshold, 0, shDegree);
      } else{
        // pop a message to the user
        console.log('Invalid file format');
      }

      splatBufferPromise.then((splatBuffer) => {
        const viewer = new Viewer({
          cameraUp: cameraUpArray,
          initialCameraPosition: cameraPositionArray,
          initialCameraLookAt: cameraLookAtArray,
          halfPrecisionCovariancesOnGPU: false,
          antialiased: antialiased || false,
          sphericalHarmonicsDegree: shDegree
        });
        viewer.addSplatBuffers([splatBuffer], [{ splatAlphaRemovalThreshold: alphaThreshold }])
          .then(() => {
            viewer.start();
            setIsTableVisible(false);
          });
      });
    };
    fileReader.readAsArrayBuffer(file);
  };

  const reset = () => {
    window.location.reload();
  };

  const getExtension = (filename) => {
    const parts = filename.split('.');
    return parts[parts.length - 1];
  };

  return (
    <div className="header-content-container" style={{ textAlign: 'center' }}>
      {isTableVisible && (
        <div className="content-row">
          <h1>3D Scene Loader</h1>
          <div id="view-panel" className="splat-panel" style={{ height: '400px' }}>
            <br />
            <table style={{ textAlign: 'left', margin: '0 auto' }}>
              <tbody>
                <tr>
                  <td colSpan="2">
                    <label htmlFor="viewFile">
                      <span className="glyphicon glyphicon-folder-open" aria-hidden="true">
                        <span className="button" style={buttonStyle}>Choose file</span>
                      </span>
                      <input type="file" id="viewFile" style={{ display: 'none' }} onChange={onFileChange} />
                    </label>
                    <span id="viewFileName" style={{ paddingLeft: '15px', color: '#333333' }}>(No file chosen)</span>
                  </td>
                </tr>
                <tr>
                  <td colSpan="2" style={{ height: '10px' }}></td>
                </tr>
                <tr>
                  <td>Minimum alpha:&nbsp;</td>
                  <td>
                    <input
                      id="alphaRemovalThresholdView"
                      type="text"
                      className="text-input"
                      style={{ width: '50px' }}
                      value={alphaRemovalThreshold}
                      onChange={(e) => setAlphaRemovalThreshold(e.target.value)}
                    />
                    <span className="valid-value-label">(1 - 255)</span>
                  </td>
                </tr>
                <tr>
                  <td>Anti-aliased</td>
                  <td style={{ textAlign: 'left' }}>
                    <input
                      type="checkbox"
                      id="antialiased"
                      className="checkbox-input"
                      checked={antialiased}
                      onChange={(e) => setAntialiased(e.target.checked)}
                    />
                  </td>
                </tr>
                <tr>
                  <td>2D scene</td>
                  <td style={{ textAlign: 'left' }}>
                    <input
                      type="checkbox"
                      id="2dScene"
                      className="checkbox-input"
                      checked={sceneIs2D}
                      onChange={(e) => setSceneIs2D(e.target.checked)}
                    />
                  </td>
                </tr>
                <tr>
                  <td>Camera up:&nbsp;</td>
                  <td>
                    <input
                      id="cameraUp"
                      type="text"
                      className="text-input"
                      style={{ width: '90px' }}
                      value={cameraUp}
                      onChange={(e) => setCameraUp(e.target.value)}
                    />
                  </td>
                </tr>
                <tr>
                  <td>Camera position:&nbsp;</td>
                  <td>
                    <input
                      id="cameraPosition"
                      type="text"
                      className="text-input"
                      style={{ width: '90px' }}
                      value={cameraPosition}
                      onChange={(e) => setCameraPosition(e.target.value)}
                    />
                  </td>
                </tr>
                <tr>
                  <td>Camera look-at:&nbsp;</td>
                  <td>
                    <input
                      id="cameraLookAt"
                      type="text"
                      className="text-input"
                      style={{ width: '90px' }}
                      value={cameraLookAt}
                      onChange={(e) => setCameraLookAt(e.target.value)}
                    />
                  </td>
                </tr>
                <tr>
                  <td>SH level:</td>
                  <td>
                    <input
                      id="viewSphericalHarmonicsDegree"
                      type="text"
                      className="text-input"
                      style={{ width: '50px' }}
                      value={sphericalHarmonicsDegree}
                      onChange={(e) => setSphericalHarmonicsDegree(e.target.value)}
                    />
                    <span className="valid-value-label">(0, 1, or 2)</span>
                  </td>
                </tr>
              </tbody>
            </table>
            <br />
            <span className="button" onClick={viewSplat} style={buttonStyle}>View</span>
            &nbsp;&nbsp;
            <span className="button" onClick={reset} style={buttonStyle}>Reset</span>
            <br />
            <br />
            <div style={{ display: 'flex', flexDirection: 'row', width: '230px', margin: 'auto' }}>
              <div style={{ width: '50px' }}>
                <div id="view-loading-icon" className="loading-icon" style={{ display: 'none' }}></div>
              </div>
            </div>
            <span id="viewError" style={{ color: '#ff0000' }}>{viewError}</span>
          </div>
        </div>
      )}
    </div>
  );
};

const buttonStyle = {
  color: '#3C5060',
  border: '#AEC5D7 1px solid',
  backgroundColor: '#E5EAEE',
  padding: '5px',
  borderRadius: '3px',
  filter: 'drop-shadow(2px 2px 3px #aaaaaa)',
  cursor: 'pointer',
  textAlign: 'left',
  display: 'inline-block',
  width: '100px',
  textDecoration: 'none',
  marginBottom: '10px',
  ':hover': {
    backgroundColor: '#E4EFF9',
    borderColor: '#4A5A67',
    color: '#1B242B'
  }
};

export default LoadSplat;
