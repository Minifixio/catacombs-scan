import * as THREE from 'three'

import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import Loader from './Loader';
import InfoPanel from './InfoPanels';
import MarkerManager from './MarkerManager';
import TeleportManager from './TeleportManager';

export default class RendererManager {

    constructor(camera, scene, element, pathfinder, mapPlotter, gui) {
        this.camera = camera
        this.scene = scene
        this.element = element
        this.gui = gui
        this.pathfinder = pathfinder
        this.mapPlotter = mapPlotter

        this.dracoLoader = new DRACOLoader();
        this.dracoLoader.setDecoderPath('/examples/jsm/libs/draco/')

        // Loader de fichiers .glb
        this.gltfLoader = new GLTFLoader()
        this.gltfLoader.setDRACOLoader(this.dracoLoader)

        // Le fichier .glb chargé
        this.loadedGLTF;

        this.mainGLTF = null;

        this.cityGLTF = null;

        this.cityFloorGLTF = null;

        this.loadedMeshes = [];
        this.currentMeshes = [];

        this.floor = null;
        this.showFloor = false;

        this.meshGrid = null;
        this.showMeshGrid = true;
        this.showFog = false;

        this.partPlane = null;

        this.currentPartFile = null
 
        this.currentPartInfoPanel = null;

        this.partMode = false;

        this.mainLight = new THREE.HemisphereLight( 0x8d7c7c, 0x494966 )

        this.renderedCompressedFilePath = './models/telecom_corridors/compressed/scan-etages45_compressed.glb'
        this.renderedFilePath = './models/telecom_corridors/scan-etages45.glb'
        this.renderCompressedFileDefault = false;
        this.renderMeshesSimplyStyleDefault = true;

        // Valable pour certains fichiers fusionnés ou le spectre de points se décale de 90° et donc il faut recaler les points pour le PathFinding
        this.rotatingIssue = true;

        this.loader = new Loader(this.element)

        this.markerManager = new MarkerManager(camera, scene, document, this.pathfinder, this, gui)
        
        // S'instanciera ensuite
        this.teleportManager = null

        this.goBackToMainButton = null;
        this.startFPVButton = null;
        this.viewMapFloorButton = null;
        this.viewMapButton = null;
        this.viewCatacombsButton = null;

        this.availableFiles = [
            {
                name: "Fusion Allégée",
                path: './models/catacombs/main_scans/fusion_allege_10.glb',
                //path: './models/scans_fusion/fusion_full_no_material.glb',
            },
            {
                name: "Fusion Complète sans matériaux",
                path: "./models/catacombs/main_scans/fusion_full_no_material.glb",
            },
            {
                name: "Ville Paris 3D",
                path: './models/catacombs/main_scans/paris_3D.glb',
            },
            {
                name: "Couche Google Maps",
                path: './models/catacombs/main_scans/paris_GoogleMaps_layer.glb',
            }
        ]

        this.initGUI()
        this.registerEvents()
    }

    changeSceneOriginal() {
        this.partMode = false;

        this.scene.background = new THREE.Color( 0xf0f0f0 );
        if (this.showFog) this.scene.fog = new THREE.Fog( 0xa0a0a0, 10, 50 );
        if (this.partPlane) this.partPlane.visible = false;

        this.camera.position.z = -40
        this.camera.position.y = 60
        
        this.mainLight = new THREE.HemisphereLight( 0x8d7c7c, 0x494966 )
        this.scene.add(this.mainLight)
    }

    changeSceneForPart(sizeX, sizeY) {

        this.partMode = true;

        // Création du sol
        const plane = new THREE.Mesh(
            new THREE.PlaneGeometry( sizeX, sizeY ),
            new THREE.MeshPhongMaterial( { color: 0xFFFFFF, transparent: true, opacity: 1} )
        );
        plane.rotation.x = - Math.PI / 2;
        plane.position.y = - 5;
        plane.receiveShadow = true;
        this.partPlane = plane;
        console.log(new THREE.Vector3(sizeX+10, 5, 0))
        this.camera.position.set(sizeX+10, 5, 0)
        //this.camera.lookAt(new THREE.Vector3(0, 0, 0))
        this.scene.add( this.partPlane );
        this.partPlane.visible = true;
        
 
        this.scene.background = new THREE.Color( 0x000000 );
    }

    init() {

        this.changeSceneOriginal()
        
        if (!this.renderCompressedFileDefault) {
            this.renderOriginalObject(this.availableFiles[0].path)
            this.renderCityObject(this.availableFiles[2].path)
            this.renderCityFloorObject(this.availableFiles[3].path)
            this.markerManager.initMarkers()
        } else {
            this.renderSimplifiedObject()
        }
    }

    
    loadGLTF(url, onLoad) {
        //const loadingFunction = (xhr) => { console.log(( xhr.loaded / xhr.total * 100 ) + '% loaded') };

        const loadingFunction = (xhr) => {
            this.loader.update(xhr.loaded / xhr.total * 100)
            console.log(( xhr.loaded / xhr.total * 100 ) + '% loaded')
        }
        const errorFunction = (error) => { console.error(error) };
        this.gltfLoader.load(url, (gltf) => onLoad(gltf), loadingFunction, errorFunction, result => { 
            modeel = this.scene.children[0].traverse(n=>{
                if(n.isMesh){
                    n.castShadow = true;
                    n.receiveShadow = true;
                }
            }) 
        });
    }

    // Afficher / désafficher l'objet chargé
    showLoadedGLTF(value) {
        if (this.loadedMeshes.length == 0 || this.loadedMeshes == undefined) {
            return;
        }
        if (this.loadedGLTF == undefined) {
            return;
        }

        this.loadedMeshes.forEach(mesh => {
            mesh.visible = value;
        })

        this.loadedGLTF.scene.visible = value;
    }

    // Extrait les objets de types mesh d'un fichier GLTF
    getMeshesFromGLTF(gltf) {
        let meshes = [];
        gltf.scene.traverse((object) => {
            if (object.name && object.isMesh) meshes.push(object);
        });

        return meshes;
    }

    changeMeshesStyle(meshes, wireframe=true) {
        meshes.forEach(mesh => {
            mesh.material = new THREE.MeshBasicMaterial({ color: 0x808080, wireframe: wireframe })
        })
    }

    loadMeshes(meshes) {
        console.log("Loading meshes : ", meshes)
        this.currentMeshes = meshes;
        meshes.forEach(mesh => {
            this.scene.add(mesh)
        })
    }

    // Afficher ou masquer les objets en fonction de leur layer
    showObjectByLayer(layer) {
        this.scene.traverse((object) => {
        if (object.isMesh) {
            console.log(object, layer)
            if (object.layers.isEnabled(layer)) {
                object.visible = true;
            } else {
                object.visible = false;
            }
        }
        });
    }

    clear3DObjectsFromScene() {
        console.log(this.scene)
        this.scene.traverse((object) => {
            if (!object.isAmbientLight && !object.isLight && !object.isLine && !object.isScene) {
              console.log("Removing object : ", object, " from scene...")
              object.visible = false;
              //this.scene.remove(object);
              console.log(this.scene)
            }
        });
    }
    
    renderFloor() {

        if (!this.floor){
            const mesh = new THREE.Mesh( new THREE.PlaneGeometry( 1000, 1000 ), new THREE.MeshPhongMaterial( { color: 0xcbcbcb, depthWrite: false } ) );
            mesh.rotation.x = - Math.PI / 2;
            mesh.receiveShadow = true;
            mesh.translateY( - 5  );
            this.scene.add( mesh );
            this.floor = mesh;
        } 
        
        if (!this.meshGrid) {
            this.meshGrid = new THREE.GridHelper( 2000, 20, 0x000000, 0x000000 );
            this.meshGrid.material.opacity = 0.2;
            this.meshGrid.material.transparent = true;
            this.meshGrid.translateY( - 5  );
            console.log(this.meshGrid)
            this.scene.add( this.meshGrid );
        } 

        if (this.showFloor) {
            this.floor.visible = true;
        } else {
            this.floor.visible = false;
        }

        if (this.showMeshGrid) {
            this.meshGrid.visible = true;
        }
        else {
            this.meshGrid.visible = false;
        }
    }

    renderSimplifiedObject() {
        console.log("Rendering simplified object...")
    
        // On prend soin de retirer tous les éléments déjà présents dans la scène
        this.clear3DObjectsFromScene()
        
        var self = this

        this.loadGLTF(
            this.renderedCompressedFilePath,
            function (gltf) {            
                self.initMainGLTF(gltf, true)
                self.loader.finish()
            }
        )
    }
    
    renderOriginalObject(path) {
        console.log("Rendering original object...")
    
        // On prend soin de retirer tous les éléments déjà présents dans la scène
        //this.clear3DObjectsFromScene()
    
        // TO CHANGE
        this.renderFloor()
    
        var self = this

        this.loadGLTF(
            path,
            function (gltf) {
                self.initMainGLTF(gltf, self.renderCompressedFileDefault, false)
                self.loader.finish()
            }
        )
    }

    renderCityObject(path) {
        console.log("Rendering city object...")
    
        // On prend soin de retirer tous les éléments déjà présents dans la scène
        //this.clear3DObjectsFromScene()
    
    
        var self = this

        this.loadGLTF(
            path,
            function (gltf) {
                self.initCityGLTF(gltf)
                self.loader.finish()
            }
        )
    }

    renderCityFloorObject(path) {
        console.log("Rendering city floor object...")
    
        // On prend soin de retirer tous les éléments déjà présents dans la scène
        //this.clear3DObjectsFromScene()
    
    
        var self = this

        this.loadGLTF(
            path,
            function (gltf) {
                self.initCityFloorGLTF(gltf)
                self.loader.finish()
            }
        )
    }
    
    loadFile(file, renderSimplify=false) {
        console.log("Loading file : ", file.name, " located at ", file.path)
    
        //this.clear3DObjectsFromScene()

        this.loadedGLTF = null;
        this.loadedMeshes = [];
        this.currentMeshes = [];

        var self = this


        this.loadGLTF(
            file.path,
            function (gltf) {
                self.initMainGLTF(gltf, renderSimplify)
                self.loader.finish()
            }
        )
    }

    loadPart(file) {
        console.log("Loading part : ", file.name, " located at ", file.path)

        var self = this
        var desc = file.description
        var title = file.name

        this.currentPartFile = file

        this.loadedGLTF.scene.visible = false;
        this.cityGLTF.scene.visible = false;
        this.goBackToMainButton.style.display = "block";
        this.startFPVButton.style.display = "block";
        this.viewCatacombsButton.style.display = "none";
        this.viewMapButton.style.display = "none";
        this.viewMapFloorButton.style.display = "none";

        this.loadGLTF(
            file.path,
            function (gltf) {
                self.initGLTF(gltf, false, true, title, desc)
                self.loader.finish()
            }
        )
    }

    initCityGLTF(gltf) {
        this.cityGLTF = gltf;

        this.cityGLTF.scene.material = new THREE.MeshBasicMaterial({ color: 0x808080, wireframe: true })
        this.cityGLTF.scene.children.forEach(child => {
            child.material = new THREE.MeshBasicMaterial({ color: 0x808080, wireframe: true })
        })

        this.scene.add(this.cityGLTF.scene)

        this.scene.layers.enable(1)
        this.camera.layers.enable(1)
    }

    initCityFloorGLTF(gltf) {
        this.cityFloorGLTF = gltf;
        this.cityFloorGLTF.scene.translateY(62)

        this.scene.add(this.cityFloorGLTF.scene)
        this.cityFloorGLTF.scene.visible = false;

        this.scene.layers.enable(1)
        this.camera.layers.enable(1)
    }

    initGLTF(gltf, renderSimplify=false, part=false, partTitle="Salle", partDescription="Lorem Ipsum") {
    
        this.loadedGLTF = gltf;

        if (part) {
            const boundingBox = new THREE.Box3().setFromObject(gltf.scene)
            this.changeSceneForPart(boundingBox.max.x - boundingBox.min.x, boundingBox.max.z - boundingBox.min.z)
            const infoPanel = new InfoPanel(this.scene)
            infoPanel.makeTextPanel(partTitle, partDescription,  -boundingBox.max.x)
            this.currentPartInfoPanel = infoPanel;
        }
    
        this.loadedMeshes = this.getMeshesFromGLTF(gltf)
        this.currentMeshes = this.loadedMeshes;
    
        // On place l'objet principale en layer 1
        this.loadedGLTF.scene.layers.set(1)

        if (renderSimplify) {
            this.loadedGLTF.scene.material = new THREE.MeshBasicMaterial({ color: 0x808080, wireframe: true })
            this.loadedGLTF.scene.children.forEach(child => {
                child.material = new THREE.MeshDepthMaterial({ color: 0x000000, wireframe: true })
            })
        }

        this.scene.add(this.loadedGLTF.scene)
        
        this.scene.layers.enable(1)
        this.camera.layers.enable(1)
    
        if (renderSimplify) {
            this.changeMeshesStyle(this.loadedMeshes)
        }

        this.pathfinder.updatePathfindingZone(this.loadedMeshes);
        this.pathfinder.updateLoadedGLTF(this.loadedGLTF);

        this.mapPlotter.updateMapPlottingZone(this.loadedMeshes);
        this.mapPlotter.updateLoadedGLTF(this.loadedGLTF);
    }
    
    initMainGLTF(gltf, renderSimplify=false, part=false) {
    
        this.loadedGLTF = gltf;
        this.mainGLTF = gltf;


        if (part) {
            const boundingBox = new THREE.Box3().setFromObject(gltf.scene)
            console.log(boundingBox)
            this.changeSceneForPart(boundingBox.max.x - boundingBox.min.x, boundingBox.max.z - boundingBox.min.z)
        }
    
        this.loadedMeshes = this.getMeshesFromGLTF(gltf)
        this.currentMeshes = this.loadedMeshes;
    
    
        // On place l'objet principale en layer 1
        this.loadedGLTF.scene.layers.set(1)

        if (renderSimplify) {
            this.loadedGLTF.scene.material = new THREE.MeshBasicMaterial({ color: 0x808080, wireframe: true })
            this.loadedGLTF.scene.children.forEach(child => {
                child.material = new THREE.MeshDepthMaterial({ color: 0x000000, wireframe: true })
            })
        }

        
        this.scene.add(this.loadedGLTF.scene)
        
        this.scene.layers.enable(1)
        this.camera.layers.enable(1)
    
        if (renderSimplify) {
            this.changeMeshesStyle(this.loadedMeshes)
        }

        if (this.rotatingIssue) {
            const mesh = this.loadedGLTF.scene.children[0].clone();
            //const mesh = this.loadedGLTF.scene.clone();
            mesh.rotateX(Math.PI / 2)
            const geo = mesh.geometry.clone()
            geo.rotateX(Math.PI / 2)

            const material = new THREE.PointsMaterial( { color: 0x888888 } );
            const points = new THREE.Points( geo, material );
            //this.scene.add(points)
            const rotatedMesh = new THREE.Mesh( geo, new THREE.MeshBasicMaterial({ color: 0x0F0F0F, wireframe: false } ))
            this.loadedMeshes = [rotatedMesh]
        }

        this.pathfinder.updatePathfindingZone(this.loadedMeshes);
        this.pathfinder.updateLoadedGLTF(this.loadedGLTF);

        this.mapPlotter.updateMapPlottingZone(this.loadedMeshes);
        this.mapPlotter.updateLoadedGLTF(this.loadedGLTF);
    }

    renderSimplifyPart(meshes) {
        if (!this.partMode) return
        console.log("Loading meshes : ", meshes)
        this.loadedMeshes.forEach(mesh => {
            this.scene.remove(mesh)
        })
        this.scene.remove(this.loadedGLTF.scene)
        this.loadedMeshes = meshes;
        meshes.forEach(mesh => {
            this.scene.add(mesh)
        })
    }

    returnToMainView() {
        this.scene.remove(this.loadedGLTF.scene)
        this.loadedMeshes.forEach(mesh => {
            this.scene.remove(mesh)
        })
        this.currentPartInfoPanel.remove()

        this.markerManager.addMarkers()


        this.loadedGLTF = this.mainGLTF;
        this.loadedMeshes = this.getMeshesFromGLTF(this.loadedGLTF)
        this.currentMeshes = this.loadedMeshes;

        this.loadedGLTF.scene.visible = true;
        this.cityGLTF.scene.visible = true;

        this.pathfinder.updatePathfindingZone(this.loadedMeshes);
        this.pathfinder.updateLoadedGLTF(this.loadedGLTF);

        this.mapPlotter.updateMapPlottingZone(this.loadedMeshes);
        this.mapPlotter.updateLoadedGLTF(this.loadedGLTF);
        this.goBackToMainButton.style.display = "none";
        this.startFPVButton.style.display = "none";
        this.viewCatacombsButton.style.display = "block";
        this.viewMapButton.style.display = "block";
        this.viewMapFloorButton.style.display = "block";
        this.changeSceneOriginal()
    }

    registerEvents() {
        this.goBackToMainButton = this.element.querySelector("#btn-back")
        this.goBackToMainButton.style.display = "none";
        this.goBackToMainButton.addEventListener('click', () => {
            this.returnToMainView()
        })

        this.startFPVButton = this.element.querySelector("#btn-fpv")
        this.startFPVButton.style.display = "none";
        this.startFPVButton.addEventListener('click', () => {
            this.teleportManager.teleportToCurrentMarker()
        })

        this.viewMapButton = this.element.querySelector("#btn-map")
        this.viewMapButton.style.display = "block";
        this.viewMapButton.addEventListener('click', () => {
            this.cityGLTF.scene.visible = !this.cityGLTF.scene.visible
        })

        this.viewMapFloorButton = this.element.querySelector("#btn-map-floor")
        this.viewMapFloorButton.style.display = "block";
        this.viewMapFloorButton.addEventListener('click', () => {
            this.cityFloorGLTF.scene.visible = !this.cityFloorGLTF.scene.visible
        })
        
        this.viewCatacombsButton = this.element.querySelector("#btn-visibility")
        this.viewCatacombsButton.style.display = "block";
        this.viewCatacombsButton.addEventListener('click', () => {
            this.loadedGLTF.scene.visible = !this.loadedGLTF.scene.visible
        })
    }

    initGUI() {
        //const folder = this.gui.addFolder('Affichage');
        // folder.add({showMainGLTF: true}, 'showMainGLTF').onChange((value) => {value ? this.loadedGLTF.scene.visible = true : this.loadedGLTF.scene.visible = false}).name("Affichage des catacombes");
        // folder.add({showCityGLTF: true}, 'showCityGLTF').onChange((value) => {value ? this.cityGLTF.scene.visible = true : this.cityGLTF.scene.visible = false}).name("Affichage de la ville");
        // folder.add({showCityFloorGLTF: false}, 'showCityFloorGLTF').onChange((value) => {value ? this.cityFloorGLTF.scene.visible = true : this.cityFloorGLTF.scene.visible = false}).name("Affichage du sol de la ville");

        //folder.add({showFloor: this.showFloor}, 'showFloor').onChange((value) => {this.showFloor = value; this.showMeshGrid = value; this.renderFloor()}).name("Affichage du sol");
        //folder.add({showLoadedGLTF: false}, 'showLoadedGLTF').onChange((value) => this.showLoadedGLTF(value)).name("Affichage de l'objet chargé");
        //folder.add({renderOriginalObject: () => this.renderOriginalObject()}, 'renderOriginalObject').name('Afficher l\'objet principal');
        //folder.add({renderSimplifiedObject: () => this.renderSimplifiedObject()}, 'renderSimplifiedObject').name('Afficher l\'objet simplifié');

        // const options = {}
        // for (let i=0; i<this.availableFiles.length; i++) {
        //     options[this.availableFiles[i].name] = () => this.loadFile(this.availableFiles[i])
        // }

        // for (let i=0; i<this.availableFiles.length; i++) {
        //     folder.add(options, this.availableFiles[i].name).name(this.availableFiles[i].name)
        // }
        // folder.close()
    }
}