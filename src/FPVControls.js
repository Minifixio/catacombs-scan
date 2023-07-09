import * as THREE from 'three'
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

export default class FPVControls extends PointerLockControls {
    constructor(camera, scene, domElement) {
        super(camera, domElement);

        if (!camera) throw new Error("The parameter 'camera' is required!");
        if (!domElement) throw new Error("The parameter 'domElement' is required!");
    
        this.camera = camera;
		this.domElement = domElement;
        this.scene = scene;
        this.raycaster = new THREE.Raycaster();

        // Les propriétés de gestion de la vue FPV
        this.moveBackward = false;
        this.moveForward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.canJump = false;
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.vertex = new THREE.Vector3();
        this.color = new THREE.Color();
        this.prevTime = performance.now();

        this.connect();
    }

    update() {
        const time = performance.now();
    
        this.raycaster.ray.origin.copy( this.getObject().position );
        this.raycaster.ray.origin.y -= 10;
    
        const intersections = this.raycaster.intersectObject(this.scene, true);
    
        const onObject = intersections.length > 0;
    
        const delta = ( time - this.prevTime ) / 1000;
    
        this.velocity.x -= this.velocity.x * 10.0 * delta;
        this.velocity.z -= this.velocity.z * 10.0 * delta;
    
        this.velocity.y -= 9.8 * 100.0 * delta; // 100.0 = mass
    
        this.direction.z = Number( this.moveForward ) - Number( this.moveBackward );
        this.direction.x = Number( this.moveRight ) - Number( this.moveLeft );
        this.direction.normalize(); // this ensures consistent movements in all directions
    
        if ( this.moveForward || this.moveBackward ) this.velocity.z -= this.direction.z * 400.0 * delta;
        if ( this.moveLeft ||this.moveRight ) this.velocity.x -= this.direction.x * 400.0 * delta;
    
        if ( onObject === true ) {
            this.velocity.y = Math.max( 0, velocity.y );
            this.canJump = true;
        }
    
        this.moveRight( - this.velocity.x * delta );
        this.moveForward( - this.velocity.z * delta );
        this.getObject().position.y += ( this.velocity.y * delta ); // new behavior
    
        if ( this.getObject().position.y < 10 ) {
            this.velocity.y = 0;
            this.getObject().position.y = 10;
            this.canJump = true;
        }
    
        this.prevTime = time;
    }

    onKeyDown(event) {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                this.moveForward = true;
                break;

            case 'ArrowLeft':
            case 'KeyA':
                this.moveLeft = true;
                break;

            case 'ArrowDown':
            case 'KeyS':
                this.moveBackward = true;
                break;

            case 'ArrowRight':
            case 'KeyD':
                this.moveRight = true;
                break;

            case 'Space':
                if ( this.canJump === true ) this.velocity.y += 350;
                this.canJump = false;
                break;
        }
    };

    onKeyUp(event) {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                this.moveForward = false;
                break;

            case 'ArrowLeft':
            case 'KeyA':
                this.moveLeft = false;
                break;

            case 'ArrowDown':
            case 'KeyS':
                this.moveBackward = false;
                break;

            case 'ArrowRight':
            case 'KeyD':
                this.moveRight = false;
                break;
        }
    };

    connect() {
        this.domElement.ownerDocument.addEventListener( 'keydown', this.onKeyDown );
        this.domElement.ownerDocument.addEventListener( 'keyup', this.onKeyUp );
    }

}