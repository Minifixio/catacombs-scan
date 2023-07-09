import { Pathfinding } from 'three-pathfinding';
import * as THREE from 'three'
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

export default class MapPlotter {
    constructor(camera, scene, element, pathfinder, gui) {
        this.camera = camera
        this.scene = scene
        this.element = element
        this.gui = gui
        this.pathfinder = pathfinder

        // Les différentes extrémités de la map qui seront les arrivés du pathfinding
        this.leafs = []
        this.leafsSpheres = []

        // Le départ des pathfinding
        this.startPoint = new THREE.Vector3();
        this.startPointSphere = null

        // Les points de la map
        this.mapPoints = []

        // Les sphères des points
        this.mapSpheres = []
        
        // Représente les meshes sur lesquels on peut se déplacer
        this.targetMeshes;

        // Le fichier .glb courant
        this.loadedGLTF;

        this.pathfinding = new Pathfinding();
        this.ZONE = 'mapplotter';

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.mouseDown = new THREE.Vector2();

        // Si on est en mode MapPlotter ou pas
        this.enabled = false

        this.registerEvents()
        this.intiGUI()
    }

    initPathFindingZone(meshes) {
        this.targetMeshes = meshes;
        const geometryArray = meshes.map((mesh) => mesh.geometry);
        const concatenatedGeometryArray = BufferGeometryUtils.mergeBufferGeometries(geometryArray)
    
        const zone = Pathfinding.createZone(concatenatedGeometryArray);
        this.pathfinding.setZoneData( this.ZONE, zone );
    }

    enable(self) {
        self.enabled = true
        self.pathfinder.disablePointPut()
    }

    disable(self) {
        self.enabled = false
        self.pathfinder.enablePointPut()
    }

    sphereFromVector3(vec, radius, color) {
        var geometry = new THREE.SphereGeometry(radius, 32, 32);
        var material = new THREE.MeshBasicMaterial({ color: color });
        var sphere = new THREE.Mesh(geometry, material);
        sphere.position.copy(vec);
        return sphere;
    }

    updateMapPlottingZone(meshes) {
        this.targetMeshes = meshes;
        const geometryArray = meshes.map((mesh) => mesh.geometry);
        const concatenatedGeometryArray = BufferGeometryUtils.mergeBufferGeometries(geometryArray)
    
        const zone = Pathfinding.createZone(concatenatedGeometryArray);
        this.pathfinding.setZoneData( this.ZONE, zone );
    }

    updateLoadedGLTF(gltf) {
        this.loadedGLTF = gltf;
    }

    withdrawLastLeaf() {
        if (this.leafs.length > 0) {
            const lastLeaf = this.leafs.pop()
            this.scene.remove(this.leafsSpheres.pop())
            console.log("Removing last leaf : ", lastLeaf)
        }
    }
    
    plotMap() {
        const groupID = this.pathfinding.getGroup(this.ZONE, this.startPoint, true);

        this.leafs.forEach(leaf => {
            const leafComputedPath = this.pathfinding.findPath(this.startPoint, leaf, this.ZONE, groupID);
            console.log(leafComputedPath)
            this.mapPoints.push(leafComputedPath)
        })

        this.mapPoints.forEach(path => {
            path.forEach(point => {
                const pointSphere = this.sphereFromVector3(point, 0.5, 0x0000ff)
                pointSphere.layers.enableAll()
                this.scene.add(pointSphere)
                this.mapSpheres.push(pointSphere)
            })
        })
    }

    resetMap() {
        this.mapSpheres.forEach(sphere => {
            this.scene.remove(sphere)
        })

        this.mapPoints = []
        this.mapSpheres = []
        this.scene.remove(this.startPointSphere)
        this.leafsSpheres.forEach(sphere => {
            this.scene.remove(sphere)
        })
        this.startPoint = new THREE.Vector3();
        this.leafs = []
    }

    onDocumentPointerUp = (event) => {

        if (this.enabled) {

            this.mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
            this.mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;

            // Eviter les clicks non désirés lors du mouvement de caméra
            //if (Math.abs( this.mouseDown.x - this.mouse.x ) > 0 || Math.abs( this.mouseDown.y - this.mouse.y ) > 0) return;
        
            this.camera.updateMatrixWorld();
            this.raycaster.setFromCamera(this.mouse, this.camera);
        
            // TODO : Voir quel objet l'on intersecte
            //let intersects = this.raycaster.intersectObject(this.targetMeshes , true);
            
            let intersects = this.raycaster.intersectObject(this.loadedGLTF.scene, true);
            // Pas d'intersection
            if (!intersects.length) {
    
                const meshesGroup = new THREE.Group();
                
                this.targetMeshes.forEach(mesh => { 
                    meshesGroup.add(mesh.clone())
                })
    
                intersects = this.raycaster.intersectObject(meshesGroup, true);
    
                if (!intersects.length) {
                    console.log("No intersection found for MapPlotter")
                    return
                }
            }


            // Si click gauche
            if (event.button == 0) {
                console.log("Adding a leaf", intersects[0].point)

                this.leafs.push(intersects[0].point)

                const pointSphere = this.sphereFromVector3(intersects[0].point, 0.5, 0xFF0000)
                pointSphere.layers.enableAll()
                this.leafsSpheres.push(pointSphere)
                this.scene.add(pointSphere)

            // Si click droit
            } else if (event.button == 2) {
                console.log("Adding starting point", intersects[0].point)

                this.startPoint.copy(intersects[0].point);
                this.startPointSphere = this.sphereFromVector3(this.startPoint, 0.5, 0x00FF00)
                this.startPointSphere.layers.enableAll()
                this.scene.add(this.startPointSphere)
            }
        }
    }

    onDocumentPointerDown = (event) => {
        if (!this.enabled) return;
        this.mouseDown.x = ( event.clientX / window.innerWidth ) * 2 - 1;
        this.mouseDown.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
    }

    registerEvents() {
        this.element.addEventListener('pointerdown', this.onDocumentPointerDown, false);
        this.element.addEventListener('pointerup', this.onDocumentPointerUp, false);
    }

    intiGUI() {
        var self = this
        const folder = this.gui.addFolder('Tracé de carte');
        folder.add({enable: false}, 'enable').onChange((value) => value ? this.enable(self) : this.disable(self)).name('Activer le tracé de carte');
        folder.add({withdrawLastLeaf: () => this.withdrawLastLeaf()}, 'withdrawLastLeaf').name('Retirer la dernière feuille');
        folder.add({plotMap: () => this.plotMap()}, 'plotMap').name('Tracer la carte');
        folder.add({resetMap: () => this.resetMap()}, 'resetMap').name('Réinitialiser la carte');
        folder.close()
    }

}