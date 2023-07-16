import * as THREE from 'three'
import SpriteTextButton from './SpriteTextButton';

import markers from '../public/models/catacombs/individual_scans/parts-markers.json' assert { type: 'json' };

export default class MarkerManager {
    constructor(camera, scene, element, pathfinder, renderer, gui, debug=false) {
        this.camera = camera
        this.scene = scene
        this.element = element
        this.pathfinder = pathfinder
        this.renderer = renderer
        this.gui = gui
        this.debug = debug

        this.targetMeshes = []

        this.markers = []

        this.markerAddMode = false

        this.selectMarkerActive = false

        this.i = 0

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.mouseDown = new THREE.Vector2();

        this.textBackgroundColor = 'grey'
        this.textBorderColor = 'lightgrey'
        this.textColor = 'red'
        this.textHighlightColor = 'green'
        this.markersJSON = markers.markers

        this.fileDirLocation = `${import.meta.env.VITE_MODELS_PATH}/catacombs/individual_scans/`

        this.renderMarkerByDefault = true;

        this.initGUI()
        this.registerEvents()
        
    }

    initMarkersFromJSON() {
        // Brute force : on récupère tous les fichiers JSON du dossier
        const data = import.meta.glob('../**/*.json')
        for (const path in data) {
            data[path]().then((mod) => { 
                if (path.indexOf('parts-markers') != -1) {
                    this.markersJSON = mod.markers
                    this.markersJSON .forEach((v) => {
                        this.addMarker(new THREE.Vector3(v.marker.x, v.marker.y, v.marker.z), 0xFF0000, v.name, v.file, v.description, v.fpvMarker)
                    })
                }
            })
        }

    }

    initMarkers() {
        if (this.renderMarkerByDefault) {
            this.initMarkersFromJSON()
            this.selectMarkerActive = true
        }
    }

    showMarkers() {
        this.selectMarkerActive = true
        if (this.markers.length == 0) {
            this.initMarkersFromJSON()
        }

        this.markers.forEach((v) => {
            v.marker.visible = true
            v.text.visible = true
        })
    }

    hideMarkers() {
        this.selectMarkerActive = false
        this.markers.forEach((v) => {
            v.marker.visible = false
            v.text.visible = false
        })
    }

    addMarker(position, color, text=null, filePath=null, description="", fpvMarker=null) {
        let marker = new THREE.Mesh(
            new THREE.SphereGeometry(0.1, 32, 32),
            new THREE.MeshBasicMaterial({ color: color })
        )
        marker.position.copy(position)
        this.scene.add(marker)

        if (text) {
            const myText = new SpriteTextButton(text);
            myText.height = 3
            myText.position.x = position.x + 1
            myText.position.y = position.y + 1
            myText.position.z = position.z + 1
            myText.fontSize = 50
            myText.color = this.textColor;
            myText.strokeColor = 'black';
            myText.backgroundColor = this.textBackgroundColor;
            myText.borderColor = this.textBorderColor;
            myText.borderWidth = 0.5;
            myText.borderRadius = 3;
            myText.padding = [6, 2];
            myText.sizeAttenuation = false;
            myText.fontWeight = 'bolder';
            myText.fontFace = "Raleway"
            myText.scale.set(35,5,0)

            // On copie les propriétés du marker sur l'objet de type SpriteTextButton
            myText.name = text
            myText.path = this.fileDirLocation + filePath
            myText.description = description
            myText.fpvMarker = fpvMarker

            this.scene.add(myText);
            this.markers.push({marker: marker, text: myText})
        } else {
            this.markers.push({marker: marker, text: null})
        }

        return marker
    }

    onDocumentPointerUp = (event) => {
        if (this.targetMeshes.length == 0) {
            this.scene.traverse((child) => {  if (child.isMesh) this.targetMeshes.push(child); })
        }
    
        this.mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
        this.mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
        
    
        // Eviter les clicks non désirés lors du mouvement de caméra
        if (Math.abs( this.mouseDown.x - this.mouse.x ) > 0 || Math.abs( this.mouseDown.y - this.mouse.y ) > 0) return;
    
        this.camera.updateMatrixWorld();
        this.raycaster.setFromCamera(this.mouse, this.camera);
    
        // TODO : Voir quel objet l'on intersecte
        //let intersects = this.raycaster.intersectObject(this.targetMeshes , true);
        
        //let intersects = this.raycaster.intersectObject(this.targetMeshes, true);

        const meshesGroup = new THREE.Group();
            
        this.targetMeshes.forEach(mesh => { 
            meshesGroup.add(mesh.clone())
        })

        const intersects = this.raycaster.intersectObject(meshesGroup, true);

        if (!intersects.length) {
            return
        }

        if (this.markerAddMode) {
            this.addMarker(intersects[0].point, 0xFF0000, "partie " + this.i++)
        }

        const intersectsText = this.raycaster.intersectObjects(this.markers.map((v) => v.text), false)

        if (intersectsText.length == 0) return
        this.selectMarker(intersectsText[0].object)
    }

    selectMarker(textObject) {
        if (this.selectMarkerActive == false) return
        this.markers.forEach((v) => {
            if (v.text == textObject) {
                this.removeMarkers()
                this.renderer.loadPart(v.text)
            }
        })
    }

    removeMarkers() {
        this.selectMarkerActive = false
        this.markers.forEach((v) => {
            this.scene.remove(v.marker)
            this.scene.remove(v.text)
        })
    }

    addMarkers() {
        this.selectMarkerActive = true
        this.markers.forEach((v) => {
            this.scene.add(v.marker)
            this.scene.add(v.text)
        })
    }

    highlightMarker(textObject) {
        this.markers.forEach((v) => {
            if (v.text == textObject) {
                textObject.backgroundColor = this.textHighlightColor;
                //textObject.scale.set(5,5,0)
                this.element.getElementsByTagName("body")[0].style.cursor = "pointer";
            } else {
                v.text.backgroundColor = this.textBackgroundColor;
            }
        })
    }

    
    onDocumentMouseMove = (event) => {
        this.mouse.set(
            (event.clientX / window.innerWidth) * 2 - 1,
            -(event.clientY / window.innerHeight) * 2 + 1
        )
        this.raycaster.setFromCamera(this.mouse, this.camera)
        const intersects = this.raycaster.intersectObjects(this.markers.map((v) => v.text), false)
    
        let intersectedObject = null
        if (intersects.length > 0) {
            intersectedObject = intersects[0].object
        } 

        this.highlightMarker(intersectedObject)
    }

    onDocumentPointerDown = (event) => {
        //if (!this.markerAddMode) return;
        this.mouseDown.x = ( event.clientX / window.innerWidth ) * 2 - 1;
        this.mouseDown.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
    }

    registerEvents() {
        this.element.addEventListener('pointerdown', this.onDocumentPointerDown, false);
        this.element.addEventListener('pointerup', this.onDocumentPointerUp, false);
        this.element.addEventListener('mousemove', this.onDocumentMouseMove, false)

    }
    
    initGUI() {
        const folder = this.gui.addFolder('Markers');

        folder.add({markerShow: this.renderMarkerByDefault}, 'markerShow')
            .onChange((value) => {
                if (value) {
                    this.showMarkers()
                } else {
                    this.hideMarkers()
                }
            }).name("Afficher les markers");
        
        if (this.debug) {
            folder.add({markerAddMode: false}, 'markerAddMode')
                .onChange((value) => {
                    this.markerAddMode = value; 
                    if(!value) {this.pathfinder.enablePointPut()}
                    else {this.pathfinder.disablePointPut()}
                }).name("Activer le placement de markers");
        }

        folder.close()
    }
}