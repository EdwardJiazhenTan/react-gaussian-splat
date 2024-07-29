/*
Copyright © 2010-2024 three.js authors & Mark Kellogg

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.
*/

import {
    EventDispatcher,
    MOUSE,
    Quaternion,
    Spherical,
    TOUCH,
    Vector2,
    Vector3,
    Plane,
    Ray,
    MathUtils
} from 'three';

// OrbitControls performs orbiting, dollying (zooming), and panning.
// Unlike TrackballControls, it maintains the "up" direction object.up (+Y by default).
//
//    Orbit - left mouse / touch: one-finger move
//    Zoom - middle mouse, or mousewheel / touch: two-finger spread or squish
//    Pan - right mouse, or left mouse + ctrl/meta/shiftKey, or arrow keys / touch: two-finger move

const _changeEvent = { type: 'change' };
const _startEvent = { type: 'start' };
const _endEvent = { type: 'end' };
const _ray = new Ray();
const _plane = new Plane();
const TILT_LIMIT = Math.cos( 70 * MathUtils.DEG2RAD );

class OrbitControls extends EventDispatcher {

    constructor( object, domElement ) {

        super();

        this.object = object;
        this.domElement = domElement;
        this.domElement.style.touchAction = 'none'; // disable touch scroll

        // Set to false to disable this control
        this.enabled = true;

        // "target" sets the location of focus, where the object orbits around
        this.target = new Vector3();

        // How far you can dolly in and out ( PerspectiveCamera only )
        this.minDistance = 0;
        this.maxDistance = Infinity;

        // How far you can zoom in and out ( OrthographicCamera only )
        this.minZoom = 0;
        this.maxZoom = Infinity;

        // How far you can orbit vertically, upper and lower limits.
        // Range is 0 to Math.PI radians.
        this.minPolarAngle = 0; // radians
        this.maxPolarAngle = Math.PI; // radians

        // How far you can orbit horizontally, upper and lower limits.
        // If set, the interval [min, max] must be a sub-interval of [- 2 PI, 2 PI], with ( max - min < 2 PI )
        this.minAzimuthAngle = - Infinity; // radians
        this.maxAzimuthAngle = Infinity; // radians

        // Set to true to enable damping (inertia)
        // If damping is enabled, you must call controls.update() in your animation loop
        this.enableDamping = false;
        this.dampingFactor = 0.05;

        // This option actually enables dollying in and out; left as "zoom" for backwards compatibility.
        // Set to false to disable zooming
        this.enableZoom = true;
        this.zoomSpeed = 1.0;

        // Set to false to disable rotating
        this.enableRotate = true;
        this.rotateSpeed = 1.0;

        // Set to false to disable panning
        this.enablePan = true;
        this.panSpeed = 1.0;
        this.screenSpacePanning = true; // if false, pan orthogonal to world-space direction camera.up
        this.keyPanSpeed = 7.0; // pixels moved per arrow key push
        this.zoomToCursor = false;

        // Set to true to automatically rotate around the target
        // If auto-rotate is enabled, you must call controls.update() in your animation loop
        this.autoRotate = false;
        this.autoRotateSpeed = 2.0; // 30 seconds per orbit when fps is 60

        // The four arrow keys
        this.keys = { LEFT: 'KeyA', UP: 'KeyW', RIGHT: 'KeyD', BOTTOM: 'KeyS' };

        // Mouse buttons
        this.mouseButtons = { LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN };

        // Touch fingers
        this.touches = { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN };

        // for reset
        this.target0 = this.target.clone();
        this.position0 = this.object.position.clone();
        this.zoom0 = this.object.zoom;

        // the target DOM element for key events
        this._domElementKeyEvents = null;

        //
        // public methods
        //

        this.getPolarAngle = () => spherical.phi;

        this.getAzimuthalAngle = () => spherical.theta;

        this.getDistance = () => this.object.position.distanceTo( this.target );

        this.listenToKeyEvents = ( domElement ) => {
            domElement.addEventListener( 'keydown', onKeyDown );
            this._domElementKeyEvents = domElement;
        };

        this.stopListenToKeyEvents = () => {
            this._domElementKeyEvents.removeEventListener( 'keydown', onKeyDown );
            this._domElementKeyEvents = null;
        };

        this.saveState = () => {
            this.target0.copy( this.target );
            this.position0.copy( this.object.position );
            this.zoom0 = this.object.zoom;
        };

        this.reset = () => {
            this.target.copy( this.target0 );
            this.object.position.copy( this.position0 );
            this.object.zoom = this.zoom0;
            this.clearDampedRotation();
            this.clearDampedPan();
            this.object.updateProjectionMatrix();
            this.dispatchEvent( _changeEvent );
            this.update();
            state = STATE.NONE;
        };

        this.clearDampedRotation = () => {
            sphericalDelta.theta = 0.0;
            sphericalDelta.phi = 0.0;
        };

        this.clearDampedPan = () => {
            panOffset.set(0, 0, 0);
        };

        // this method is exposed, but perhaps it would be better if we can make it private...
        this.update = (() => {
            const offset = new Vector3();
            const quat = new Quaternion().setFromUnitVectors( object.up, new Vector3( 0, 1, 0 ) );
            const quatInverse = quat.clone().invert();
            const lastPosition = new Vector3();
            const lastQuaternion = new Quaternion();
            const lastTargetPosition = new Vector3();
            const twoPI = 2 * Math.PI;

            return () => {
                quat.setFromUnitVectors( object.up, new Vector3( 0, 1, 0 ) );
                quatInverse.copy(quat).invert();
                const position = this.object.position;
                offset.copy( position ).sub( this.target );
                offset.applyQuaternion( quat );
                spherical.setFromVector3( offset );

                if ( this.autoRotate && state === STATE.NONE ) {
                    rotateLeft( getAutoRotationAngle() );
                }

                if ( this.enableDamping ) {
                    spherical.theta += sphericalDelta.theta * this.dampingFactor;
                    spherical.phi += sphericalDelta.phi * this.dampingFactor;
                } else {
                    spherical.theta += sphericalDelta.theta;
                    spherical.phi += sphericalDelta.phi;
                }

                let min = this.minAzimuthAngle;
                let max = this.maxAzimuthAngle;

                if ( isFinite( min ) && isFinite( max ) ) {
                    if ( min < - Math.PI ) min += twoPI; else if ( min > Math.PI ) min -= twoPI;
                    if ( max < - Math.PI ) max += twoPI; else if ( max > Math.PI ) max -= twoPI;
                    if ( min <= max ) {
                        spherical.theta = Math.max( min, Math.min( max, spherical.theta ) );
                    } else {
                        spherical.theta = ( spherical.theta > ( min + max ) / 2 ) ?
                            Math.max( min, spherical.theta ) :
                            Math.min( max, spherical.theta );
                    }
                }

                spherical.phi = Math.max( this.minPolarAngle, Math.min( this.maxPolarAngle, spherical.phi ) );
                spherical.makeSafe();

                if ( this.enableDamping === true ) {
                    this.target.addScaledVector( panOffset, this.dampingFactor );
                } else {
                    this.target.add( panOffset );
                }

                if ( (this.zoomToCursor && performCursorZoom) || this.object.isOrthographicCamera ) {
                    spherical.radius = clampDistance( spherical.radius );
                } else {
                    spherical.radius = clampDistance( spherical.radius * scale );
                }

                offset.setFromSpherical( spherical );
                offset.applyQuaternion( quatInverse );
                position.copy( this.target ).add( offset );
                this.object.lookAt( this.target );

                if ( this.enableDamping === true ) {
                    sphericalDelta.theta *= ( 1 - this.dampingFactor );
                    sphericalDelta.phi *= ( 1 - this.dampingFactor );
                    panOffset.multiplyScalar( 1 - this.dampingFactor );
                } else {
                    sphericalDelta.set( 0, 0, 0 );
                    panOffset.set( 0, 0, 0 );
                }

                let zoomChanged = false;
                if ( this.zoomToCursor && performCursorZoom ) {
                    let newRadius = null;
                    if ( this.object.isPerspectiveCamera ) {
                        const prevRadius = offset.length();
                        newRadius = clampDistance( prevRadius * scale );
                        const radiusDelta = prevRadius - newRadius;
                        this.object.position.addScaledVector( dollyDirection, radiusDelta );
                        this.object.updateMatrixWorld();
                    } else if ( this.object.isOrthographicCamera ) {
                        const mouseBefore = new Vector3( mouse.x, mouse.y, 0 );
                        mouseBefore.unproject( this.object );
                        this.object.zoom = Math.max( this.minZoom, Math.min( this.maxZoom, this.object.zoom / scale ) );
                        this.object.updateProjectionMatrix();
                        zoomChanged = true;
                        const mouseAfter = new Vector3( mouse.x, mouse.y, 0 );
                        mouseAfter.unproject( this.object );
                        this.object.position.sub( mouseAfter ).add( mouseBefore );
                        this.object.updateMatrixWorld();
                        newRadius = offset.length();
                    } else {
                        console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled.' );
                        this.zoomToCursor = false;
                    }

                    if ( newRadius !== null ) {
                        if ( this.screenSpacePanning ) {
                            this.target.set( 0, 0, - 1 )
                                .transformDirection( this.object.matrix )
                                .multiplyScalar( newRadius )
                                .add( this.object.position );
                        } else {
                            _ray.origin.copy( this.object.position );
                            _ray.direction.set( 0, 0, - 1 ).transformDirection( this.object.matrix );
                            if ( Math.abs( this.object.up.dot( _ray.direction ) ) < TILT_LIMIT ) {
                                object.lookAt( this.target );
                            } else {
                                _plane.setFromNormalAndCoplanarPoint( this.object.up, this.target );
                                _ray.intersectPlane( _plane, this.target );
                            }
                        }
                    }
                } else if ( this.object.isOrthographicCamera ) {
                    this.object.zoom = Math.max( this.minZoom, Math.min( this.maxZoom, this.object.zoom / scale ) );
                    this.object.updateProjectionMatrix();
                    zoomChanged = true;
                }

                scale = 1;
                performCursorZoom = false;

                if ( zoomChanged ||
                    lastPosition.distanceToSquared( this.object.position ) > EPS ||
                    8 * ( 1 - lastQuaternion.dot( this.object.quaternion ) ) > EPS ||
                    lastTargetPosition.distanceToSquared( this.target ) > 0 ) {
                    this.dispatchEvent( _changeEvent );
                    lastPosition.copy( this.object.position );
                    lastQuaternion.copy( this.object.quaternion );
                    lastTargetPosition.copy( this.target );
                    zoomChanged = false;
                    return true;
                }

                return false;
            };
        })();

        this.dispose = () => {
            this.domElement.removeEventListener( 'contextmenu', onContextMenu );
            this.domElement.removeEventListener( 'pointerdown', onPointerDown );
            this.domElement.removeEventListener( 'pointercancel', onPointerUp );
            this.domElement.removeEventListener( 'wheel', onMouseWheel );
            this.domElement.removeEventListener( 'pointermove', onPointerMove );
            this.domElement.removeEventListener( 'pointerup', onPointerUp );

            if ( this._domElementKeyEvents !== null ) {
                this._domElementKeyEvents.removeEventListener( 'keydown', onKeyDown );
                this._domElementKeyEvents = null;
            }
        };

        //
        // internals
        //

        const STATE = {
            NONE: - 1,
            ROTATE: 0,
            DOLLY: 1,
            PAN: 2,
            TOUCH_ROTATE: 3,
            TOUCH_PAN: 4,
            TOUCH_DOLLY_PAN: 5,
            TOUCH_DOLLY_ROTATE: 6
        };

        let state = STATE.NONE;

        const EPS = 0.000001;

        const spherical = new Spherical();
        const sphericalDelta = new Spherical();

        let scale = 1;
        const panOffset = new Vector3();

        const rotateStart = new Vector2();
        const rotateEnd = new Vector2();
        const rotateDelta = new Vector2();

        const panStart = new Vector2();
        const panEnd = new Vector2();
        const panDelta = new Vector2();

        const dollyStart = new Vector2();
        const dollyEnd = new Vector2();
        const dollyDelta = new Vector2();

        const dollyDirection = new Vector3();
        const mouse = new Vector2();
        let performCursorZoom = false;

        const pointers = [];
        const pointerPositions = {};

        const getAutoRotationAngle = () => 2 * Math.PI / 60 / 60 * this.autoRotateSpeed;

        const getZoomScale = () => Math.pow( 0.95, this.zoomSpeed );

        const rotateLeft = ( angle ) => {
            sphericalDelta.theta -= angle;
        };

        const rotateUp = ( angle ) => {
            sphericalDelta.phi -= angle;
        };

        const panLeft = (() => {
            const v = new Vector3();
            return ( distance, objectMatrix ) => {
                v.setFromMatrixColumn( objectMatrix, 0 ); // get X column of objectMatrix
                v.multiplyScalar( - distance );
                panOffset.add( v );
            };
        })();

        const panUp = (() => {
            const v = new Vector3();
            return ( distance, objectMatrix ) => {
                if ( this.screenSpacePanning === true ) {
                    v.setFromMatrixColumn( objectMatrix, 1 );
                } else {
                    v.setFromMatrixColumn( objectMatrix, 0 );
                    v.crossVectors( this.object.up, v );
                }
                v.multiplyScalar( distance );
                panOffset.add( v );
            };
        })();

        const pan = (() => {
            const offset = new Vector3();
            return ( deltaX, deltaY ) => {
                const element = this.domElement;
                if ( this.object.isPerspectiveCamera ) {
                    const position = this.object.position;
                    offset.copy( position ).sub( this.target );
                    let targetDistance = offset.length();
                    targetDistance *= Math.tan( ( this.object.fov / 2 ) * Math.PI / 180.0 );
                    panLeft( 2 * deltaX * targetDistance / element.clientHeight, this.object.matrix );
                    panUp( 2 * deltaY * targetDistance / element.clientHeight, this.object.matrix );
                } else if ( this.object.isOrthographicCamera ) {
                    panLeft( deltaX * ( this.object.right - this.object.left ) /
                        this.object.zoom / element.clientWidth, this.object.matrix );
                    panUp( deltaY * ( this.object.top - this.object.bottom ) / this.object.zoom /
                        element.clientHeight, this.object.matrix );
                } else {
                    console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - pan disabled.' );
                    this.enablePan = false;
                }
            };
        })();

        const dollyOut = ( dollyScale ) => {
            if ( this.object.isPerspectiveCamera || this.object.isOrthographicCamera ) {
                scale /= dollyScale;
            } else {
                console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.' );
                this.enableZoom = false;
            }
        };

        const dollyIn = ( dollyScale ) => {
            if ( this.object.isPerspectiveCamera || this.object.isOrthographicCamera ) {
                scale *= dollyScale;
            } else {
                console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.' );
                this.enableZoom = false;
            }
        };

        const updateMouseParameters = ( event ) => {
            if ( ! this.zoomToCursor ) {
                return;
            }
            performCursorZoom = true;
            const rect = this.domElement.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            const w = rect.width;
            const h = rect.height;
            mouse.x = ( x / w ) * 2 - 1;
            mouse.y = - ( y / h ) * 2 + 1;
            dollyDirection.set( mouse.x, mouse.y, 1 ).unproject( object ).sub( object.position ).normalize();
        };

        const clampDistance = ( dist ) => Math.max( this.minDistance, Math.min( this.maxDistance, dist ) );

        const handleMouseDownRotate = ( event ) => rotateStart.set( event.clientX, event.clientY );

        const handleMouseDownDolly = ( event ) => {
            updateMouseParameters( event );
            dollyStart.set( event.clientX, event.clientY );
        };

        const handleMouseDownPan = ( event ) => panStart.set( event.clientX, event.clientY );

        const handleMouseMoveRotate = ( event ) => {
            rotateEnd.set( event.clientX, event.clientY );
            rotateDelta.subVectors( rotateEnd, rotateStart ).multiplyScalar( this.rotateSpeed );
            const element = this.domElement;
            rotateLeft( 2 * Math.PI * rotateDelta.x / element.clientHeight ); // yes, height
            rotateUp( 2 * Math.PI * rotateDelta.y / element.clientHeight );
            rotateStart.copy( rotateEnd );
            this.update();
        };

        const handleMouseMoveDolly = ( event ) => {
            dollyEnd.set( event.clientX, event.clientY );
            dollyDelta.subVectors( dollyEnd, dollyStart );
            if ( dollyDelta.y > 0 ) {
                dollyOut( getZoomScale() );
            } else if ( dollyDelta.y < 0 ) {
                dollyIn( getZoomScale() );
            }
            dollyStart.copy( dollyEnd );
            this.update();
        };

        const handleMouseMovePan = ( event ) => {
            panEnd.set( event.clientX, event.clientY );
            panDelta.subVectors( panEnd, panStart ).multiplyScalar( this.panSpeed );
            pan( panDelta.x, panDelta.y );
            panStart.copy( panEnd );
            this.update();
        };

        const handleMouseWheel = ( event ) => {
            updateMouseParameters( event );
            if ( event.deltaY < 0 ) {
                dollyIn( getZoomScale() );
            } else if ( event.deltaY > 0 ) {
                dollyOut( getZoomScale() );
            }
            this.update();
        };

        const handleKeyDown = ( event ) => {
            let needsUpdate = false;
            switch ( event.code ) {
                case this.keys.UP:
                    if ( event.ctrlKey || event.metaKey || event.shiftKey ) {
                        rotateUp( 2 * Math.PI * this.rotateSpeed / this.domElement.clientHeight );
                    } else {
                        pan( 0, this.keyPanSpeed );
                    }
                    needsUpdate = true;
                    break;
                case this.keys.BOTTOM:
                    if ( event.ctrlKey || event.metaKey || event.shiftKey ) {
                        rotateUp( - 2 * Math.PI * this.rotateSpeed / this.domElement.clientHeight );
                    } else {
                        pan( 0, - this.keyPanSpeed );
                    }
                    needsUpdate = true;
                    break;
                case this.keys.LEFT:
                    if ( event.ctrlKey || event.metaKey || event.shiftKey ) {
                        rotateLeft( 2 * Math.PI * this.rotateSpeed / this.domElement.clientHeight );
                    } else {
                        pan( this.keyPanSpeed, 0 );
                    }
                    needsUpdate = true;
                    break;
                case this.keys.RIGHT:
                    if ( event.ctrlKey || event.metaKey || event.shiftKey ) {
                        rotateLeft( - 2 * Math.PI * this.rotateSpeed / this.domElement.clientHeight );
                    } else {
                        pan( - this.keyPanSpeed, 0 );
                    }
                    needsUpdate = true;
                    break;
                default:
                    console.log(`Unhandled key: ${event.code}`);
                    break;
            }
            if ( needsUpdate ) {
                this.update();
            }
        };

        const handleTouchStartRotate = () => {
            if ( pointers.length === 1 ) {
                rotateStart.set( pointers[0].pageX, pointers[0].pageY );
            } else {
                const x = 0.5 * ( pointers[0].pageX + pointers[1].pageX );
                const y = 0.5 * ( pointers[0].pageY + pointers[1].pageY );
                rotateStart.set( x, y );
            }
        };

        const handleTouchStartPan = () => {
            if ( pointers.length === 1 ) {
                panStart.set( pointers[0].pageX, pointers[0].pageY );
            } else {
                const x = 0.5 * ( pointers[0].pageX + pointers[1].pageX );
                const y = 0.5 * ( pointers[0].pageY + pointers[1].pageY );
                panStart.set( x, y );
            }
        };

        const handleTouchStartDolly = () => {
            const dx = pointers[0].pageX - pointers[1].pageX;
            const dy = pointers[0].pageY - pointers[1].pageY;
            const distance = Math.sqrt( dx * dx + dy * dy );
            dollyStart.set( 0, distance );
        };

        const handleTouchStartDollyPan = () => {
            if ( this.enableZoom ) handleTouchStartDolly();
            if ( this.enablePan ) handleTouchStartPan();
        };

        const handleTouchStartDollyRotate = () => {
            if ( this.enableZoom ) handleTouchStartDolly();
            if ( this.enableRotate ) handleTouchStartRotate();
        };

        const handleTouchMoveRotate = ( event ) => {
            if ( pointers.length === 1 ) {
                rotateEnd.set( event.pageX, event.pageY );
            } else {
                const position = getSecondPointerPosition( event );
                const x = 0.5 * ( event.pageX + position.x );
                const y = 0.5 * ( event.pageY + position.y );
                rotateEnd.set( x, y );
            }
            rotateDelta.subVectors( rotateEnd, rotateStart ).multiplyScalar( this.rotateSpeed );
            const element = this.domElement;
            rotateLeft( 2 * Math.PI * rotateDelta.x / element.clientHeight ); // yes, height
            rotateUp( 2 * Math.PI * rotateDelta.y / element.clientHeight );
            rotateStart.copy( rotateEnd );
            this.update();
        };

        const handleTouchMovePan = ( event ) => {
            if ( pointers.length === 1 ) {
                panEnd.set( event.pageX, event.pageY );
            } else {
                const position = getSecondPointerPosition( event );
                const x = 0.5 * ( event.pageX + position.x );
                const y = 0.5 * ( event.pageY + position.y );
                panEnd.set( x, y );
            }
            panDelta.subVectors( panEnd, panStart ).multiplyScalar( this.panSpeed );
            pan( panDelta.x, panDelta.y );
            panStart.copy( panEnd );
            this.update();
        };

        const handleTouchMoveDolly = ( event ) => {
            const position = getSecondPointerPosition( event );
            const dx = event.pageX - position.x;
            const dy = event.pageY - position.y;
            const distance = Math.sqrt( dx * dx + dy * dy );
            dollyEnd.set( 0, distance );
            dollyDelta.set( 0, Math.pow( dollyEnd.y / dollyStart.y, this.zoomSpeed ) );
            dollyOut( dollyDelta.y );
            dollyStart.copy( dollyEnd );
            this.update();
        };

        const handleTouchMoveDollyPan = ( event ) => {
            if ( this.enableZoom ) handleTouchMoveDolly( event );
            if ( this.enablePan ) handleTouchMovePan( event );
        };

        const handleTouchMoveDollyRotate = ( event ) => {
            if ( this.enableZoom ) handleTouchMoveDolly( event );
            if ( this.enableRotate ) handleTouchMoveRotate( event );
        };

        const onPointerDown = ( event ) => {
            if ( this.enabled === false ) return;
            if ( pointers.length === 0 ) {
                this.domElement.setPointerCapture( event.pointerId );
                this.domElement.addEventListener( 'pointermove', onPointerMove );
                this.domElement.addEventListener( 'pointerup', onPointerUp );
            }
            addPointer( event );
            if ( event.pointerType === 'touch' ) {
                onTouchStart( event );
            } else {
                onMouseDown( event );
            }
        };

        const onPointerMove = ( event ) => {
            if ( this.enabled === false ) return;
            if ( event.pointerType === 'touch' ) {
                onTouchMove( event );
            } else {
                onMouseMove( event );
            }
        };

        const onPointerUp = ( event ) => {
            removePointer( event );
            if ( pointers.length === 0 ) {
                this.domElement.releasePointerCapture( event.pointerId );
                this.domElement.removeEventListener( 'pointermove', onPointerMove );
                this.domElement.removeEventListener( 'pointerup', onPointerUp );
            }
            this.dispatchEvent( _endEvent );
            state = STATE.NONE;
        };

        const onMouseDown = ( event ) => {
            let mouseAction;
            switch ( event.button ) {
                case 0:
                    mouseAction = this.mouseButtons.LEFT;
                    break;
                case 1:
                    mouseAction = this.mouseButtons.MIDDLE;
                    break;
                case 2:
                    mouseAction = this.mouseButtons.RIGHT;
                    break;
                default:
                    mouseAction = - 1;
                    break;
            }
            switch ( mouseAction ) {
                case MOUSE.DOLLY:
                    if ( this.enableZoom === false ) return;
                    handleMouseDownDolly( event );
                    state = STATE.DOLLY;
                    break;
                case MOUSE.ROTATE:
                    if ( event.ctrlKey || event.metaKey || event.shiftKey ) {
                        if ( this.enablePan === false ) return;
                        handleMouseDownPan( event );
                        state = STATE.PAN;
                    } else {
                        if ( this.enableRotate === false ) return;
                        handleMouseDownRotate( event );
                        state = STATE.ROTATE;
                    }
                    break;
                case MOUSE.PAN:
                    if ( event.ctrlKey || event.metaKey || event.shiftKey ) {
                        if ( this.enableRotate === false ) return;
                        handleMouseDownRotate( event );
                        state = STATE.ROTATE;
                    } else {
                        if ( this.enablePan === false ) return;
                        handleMouseDownPan( event );
                        state = STATE.PAN;
                    }
                    break;
                default:
                    state = STATE.NONE;
            }
            if ( state !== STATE.NONE ) {
                this.dispatchEvent( _startEvent );
            }
        };

        const onMouseMove = ( event ) => {
            switch ( state ) {
                case STATE.ROTATE:
                    if ( this.enableRotate === false ) return;
                    handleMouseMoveRotate( event );
                    break;
                case STATE.DOLLY:
                    if ( this.enableZoom === false ) return;
                    handleMouseMoveDolly( event );
                    break;
                case STATE.PAN:
                    if ( this.enablePan === false ) return;
                    handleMouseMovePan( event );
                    break;
                default:
                    console.log('state', state);
                    break;
            }
        };

        const onMouseWheel = ( event ) => {
            if ( this.enabled === false || this.enableZoom === false || state !== STATE.NONE ) return;
            event.preventDefault();
            this.dispatchEvent( _startEvent );
            handleMouseWheel( event );
            this.dispatchEvent( _endEvent );
        };

        const onKeyDown = ( event ) => {
            if ( this.enabled === false || this.enablePan === false ) return;
            handleKeyDown( event );
        };

        const onTouchStart = ( event ) => {
            trackPointer( event );
            switch ( pointers.length ) {
                case 1:
                    switch ( this.touches.ONE ) {
                        case TOUCH.ROTATE:
                            if ( this.enableRotate === false ) return;
                            handleTouchStartRotate();
                            state = STATE.TOUCH_ROTATE;
                            break;
                        case TOUCH.PAN:
                            if ( this.enablePan === false ) return;
                            handleTouchStartPan();
                            state = STATE.TOUCH_PAN;
                            break;
                        default:
                            state = STATE.NONE;
                    }
                    break;
                case 2:
                    switch ( this.touches.TWO ) {
                        case TOUCH.DOLLY_PAN:
                            if ( this.enableZoom === false && this.enablePan === false ) return;
                            handleTouchStartDollyPan();
                            state = STATE.TOUCH_DOLLY_PAN;
                            break;
                        case TOUCH.DOLLY_ROTATE:
                            if ( this.enableZoom === false && this.enableRotate === false ) return;
                            handleTouchStartDollyRotate();
                            state = STATE.TOUCH_DOLLY_ROTATE;
                            break;
                        default:
                            state = STATE.NONE;
                    }
                    break;
                default:
                    state = STATE.NONE;
            }
            if ( state !== STATE.NONE ) {
                this.dispatchEvent( _startEvent );
            }
        };

        const onTouchMove = ( event ) => {
            trackPointer( event );
            switch ( state ) {
                case STATE.TOUCH_ROTATE:
                    if ( this.enableRotate === false ) return;
                    handleTouchMoveRotate( event );
                    this.update();
                    break;
                case STATE.TOUCH_PAN:
                    if ( this.enablePan === false ) return;
                    handleTouchMovePan( event );
                    this.update();
                    break;
                case STATE.TOUCH_DOLLY_PAN:
                    if ( this.enableZoom === false && this.enablePan === false ) return;
                    handleTouchMoveDollyPan( event );
                    this.update();
                    break;
                case STATE.TOUCH_DOLLY_ROTATE:
                    if ( this.enableZoom === false && this.enableRotate === false ) return;
                    handleTouchMoveDollyRotate( event );
                    this.update();
                    break;
                default:
                    state = STATE.NONE;
            }
        };

        const onContextMenu = ( event ) => {
            if ( this.enabled === false ) return;
            event.preventDefault();
        };

        const addPointer = ( event ) => {
            pointers.push( event );
        };

        const removePointer = ( event ) => {
            delete pointerPositions[event.pointerId];
            for ( let i = 0; i < pointers.length; i ++ ) {
                if ( pointers[i].pointerId === event.pointerId ) {
                    pointers.splice( i, 1 );
                    return;
                }
            }
        };

        const trackPointer = ( event ) => {
            let position = pointerPositions[event.pointerId];
            if ( position === undefined ) {
                position = new Vector2();
                pointerPositions[event.pointerId] = position;
            }
            position.set( event.pageX, event.pageY );
        };

        const getSecondPointerPosition = ( event ) => {
            const pointer = ( event.pointerId === pointers[0].pointerId ) ? pointers[1] : pointers[0];
            return pointerPositions[pointer.pointerId];
        };

        this.domElement.addEventListener( 'contextmenu', onContextMenu );
        this.domElement.addEventListener( 'pointerdown', onPointerDown );
        this.domElement.addEventListener( 'pointercancel', onPointerUp );
        this.domElement.addEventListener( 'wheel', onMouseWheel, { passive: false } );
        this.update();
    }
}

export { OrbitControls };
