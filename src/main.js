import * as THREE from 'three'

import Stats from 'three/examples/jsm/libs/stats.module'
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

import RendererManager from './RendererManager';
import SimplifyManager from './SimplifyManager';
import PathFindingManager from './PathFindingManager';
import ControlsManager from './ControlsManager';
import MapPlotter from './MapPlotter';
import MarkerManager from './MarkerManager';
import InfoPanel from './InfoPanels';
import TeleportManager from './TeleportManager';

// Afficher les axes par défaut ou non
const showAxisDefault = false

// Création de la scène
const scene = new THREE.Scene()

// Création de la caméra
let camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000)


// Renderer WebGL
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ReinhardToneMapping;
renderer.toneMappingExposure = 2.3;
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.render(scene, camera)
}
window.addEventListener('resize', onWindowResize, false)


// Ajout des stats (FPS en haut à gauche)
const stats = new Stats()
document.body.appendChild(stats.dom)



function initGlobalScene() {

    if(showAxisDefault) {
        const axis = new THREE.AxesHelper(6);
        scene.add(axis);
    }


    // Lumière ambiante
    // const ambientLight = new THREE.AmbientLight( 0xf0f0f0 )
    // const light = new THREE.SpotLight( 0xffffff, 1.5 );
    // light.position.set( 0, 1500, 200 );
    // light.angle = Math.PI * 0.2;
    // light.castShadow = true;
    // light.shadow.camera.near = 200;
    // light.shadow.camera.far = 2000;
    // light.shadow.bias = - 0.000222;
    // light.shadow.mapSize.width = 1024;
    // light.shadow.mapSize.height = 1024;
    // scene.add(light);
    // scene.add(ambientLight);
    //scene.add( new THREE.HemisphereLight( 0x8d7c7c, 0x494966 ) );
}



const gui = new GUI();
const pathFindingManager = new PathFindingManager(camera, scene, document, gui)
const mapPlotter = new MapPlotter(camera, scene, document, pathFindingManager, gui)

const rendererManager = new RendererManager(camera, scene, document, pathFindingManager, mapPlotter, gui)
const simplifyManager = new SimplifyManager(camera, scene, document, pathFindingManager, rendererManager, gui)
const controlsManager = new ControlsManager(camera, scene, renderer, pathFindingManager, document, rendererManager, gui)
const teleportManager = new TeleportManager(camera, scene, document, rendererManager, controlsManager, gui)

function animate() {
    requestAnimationFrame(animate)
    controlsManager.update()
    InfoPanel.update()
    //rendererManager.update()
    stats.update()
    renderer.render(scene, camera)
}

initGlobalScene()
animate()

rendererManager.init()