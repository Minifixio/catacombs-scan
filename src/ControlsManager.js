import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { FlyControls } from 'three/addons/controls/FlyControls.js';

import FPVControls from "./FPVControls";
import WalkingControls from "./WalkingControls";

export default class ControlsManager {

    controlsStates = {
        isOrbitMode: false,
        isFPVMode: false,
        isDroneMode: false,
        isWalkingMode: false,
    }

    constructor(camera, scene, renderer, pathfinder, element, rendererManager, gui, debug=false) {
        this.camera = camera
        this.scene = scene
        this.renderer = renderer
        this.element = element
        this.pathfinder = pathfinder
        this.rendererManager = rendererManager
        this.gui = gui
        this.debug = debug

        this.clock = new THREE.Clock();

        this.orbitTarget =  new THREE.Vector3(0, 0, 0)
        this.orbitPosition = new THREE.Vector3(0, 0, 0)

        this.initControls()
        this.initGUI()
        this.registerEvents()
    }

    initControls() {
        this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement) // Orbit control : le classiqque déplacement type vue 3D
        this.orbitControls.enableDamping = true
        this.orbitControls.enablePan = true; 
    
        // avant : document.body
        this.fpvControls = new FPVControls(this.camera, this.scene, this.element.body) // Déplacement 1ère personne avec les keys
    
        this.droneControls = new FlyControls(this.camera, this.renderer.domElement); // Déplacement de type drone avec la souris
        this.droneControls.movementSpeed = 20;
        this.droneControls.domElement = this.renderer.domElement;
        this.droneControls.rollSpeed = 0.5
        this.droneControls.autoForward = false;
        this.droneControls.dragToLook = false;

        this.walkingControls = new WalkingControls(this.camera, this.element, this.scene, () => this.exitWalkingMode(this), this.rendererManager); // Déplacement de type marche avec les keys
    
        this.controlsStates.isOrbitMode = true // Par défaut en OrbitMode
    }

    changeMode(mode) {
        if (mode == "orbit") {
            this.controlsStates.isOrbitMode = true
            this.controlsStates.isFPVMode = false
            this.controlsStates.isDroneMode = false
            this.controlsStates.isWalkingMode = false
        }
        if (mode == "fpv") {
            this.controlsStates.isOrbitMode = false
            this.controlsStates.isFPVMode = true
            this.controlsStates.isDroneMode = false
            this.controlsStates.isWalkingMode = false
        }
        if (mode == "drone") {
            this.controlsStates.isOrbitMode = false
            this.controlsStates.isFPVMode = false
            this.controlsStates.isDroneMode = true
            this.controlsStates.isWalkingMode = false
        }
        if (mode == "walking") {
            this.controlsStates.isOrbitMode = false
            this.controlsStates.isFPVMode = false
            this.controlsStates.isDroneMode = false
            this.controlsStates.isWalkingMode = true
            this.loadWalkingMode()
        }
    }

    
    loadWalkingMode() {
        console.log("Loading walking mode...")
        this.orbitTarget.copy(this.orbitControls.target.clone());
        this.orbitPosition.copy(this.camera.position.clone());
        this.orbitControls.saveState()


        this.scene.add(this.walkingControls.getObject());
        this.walkingControls.start()

        this.pathfinder.startWalkingMode()
    }

    exitWalkingMode(self) {
        console.log("Exiting walking mode...")

        self.camera.position.copy(self.orbitPosition);
        self.orbitControls.reset();
        self.orbitControls = new OrbitControls(self.camera, self.renderer.domElement)
        self.orbitControls.target.copy(self.orbitTarget);

        self.controlsStates.isWalkingMode = false;

        self.pathfinder.endWalkingMode()
    }

    startTeleportation() {
        this.orbitControls.saveState()
        this.changeMode("walking")
    }

    registerEvents() {
        this.element.addEventListener('click', (e) => {
            if (this.pathfinder.pathTraveling || this.controlsStates.isFPVMode) {
                this.fpvControls.lock();
            }
            if (this.controlsStates.isWalkingMode) {
                this.walkingControls.lock();
            }
        }, false);
    }

    initGUI() {
        const folder = this.gui.addFolder('Contrôles');
        //folder.add({isFPVMode: () => this.changeMode('fpv')}, 'isFPVMode').name("Mode vue à la première personne");
        folder.add({isOrbitMode: () => this.changeMode('orbit')}, 'isOrbitMode').name("Mode vue orbitale");
        folder.add({isDroneMode: () => this.changeMode('drone')}, 'isDroneMode').name("Mode vue drone");
        //folder.add({isWalkingMode: () => this.changeMode('walking')}, 'isWalkingMode').name("Mode vue marche");
        folder.add({isWalking: false}, 'isWalking').onChange((value) => this.changeMode('walking')).name("Mode vue marche");
        folder.close()
    }

    update() {
        if (this.pathfinder.pathTraveling) {
            this.pathfinder.travelPath()
            this.droneControls.enabled = false
            this.fpvControls.enabled = true
            this.orbitControls.enabled = false

        } else if (this.controlsStates.isFPVMode) {
            this.fpvControls.update()
            this.droneControls.enabled = false
            this.fpvControls.enabled = true
            this.orbitControls.enabled = false

        } else if (this.controlsStates.isDroneMode) {
            this.fpvControls.enabled = false
            this.orbitControls.enabled = false
            this.droneControls.enabled = true

            const delta = this.clock.getDelta();
            this.droneControls.update(delta)
        } else if (this.controlsStates.isWalkingMode) {
            this.fpvControls.enabled = false
            this.orbitControls.enabled = false
            this.droneControls.enabled = false
            this.walkingControls.animate()
            
        } else { // Sinon mode orbit par défaut
            this.droneControls.enabled = false
            this.fpvControls.enabled = false
            this.orbitControls.enabled = true
            this.orbitControls.update()
        }
    }
}