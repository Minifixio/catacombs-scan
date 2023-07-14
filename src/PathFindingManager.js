import * as THREE from 'three'
import { Pathfinding } from 'three-pathfinding';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { MeshLine, MeshLineMaterial } from 'three.meshline';

export default class PathFindingManager {
    
    constructor(camera, scene, element, gui) {

        this.camera = camera
        this.scene = scene
        this.element = element
        this.gui = gui

        // Les données générées lors de la création / édition d'un chemin
        this.computedPathPoints = [];
        this.computedPathSpheres = [];
        this.computedPathLine = null;
        this.computedPathSpline = null;
        this.pathLineMode = false;

        this.pathTraveling = false // Booléen pour savoir si on est en train de faire un travelling le long du chemin
        this.travelingPercentage = 0 // Pourcentage de travelling effectué (entre 0 et 100)
        this.pathTravelingForward = false // True si on est en train d'avancer avec la molette et bloque donc la caméra dans la direction du chemin

        this.startPoint = new THREE.Vector3();
        this.endPoint = new THREE.Vector3();
        this.startPointSphere = null;
        this.endPointSphere = null;

        // Représente les meshes sur lesquels on peut se déplacer
        this.targetMeshes;

        // Le fichier .glb courant
        this.loadedGLTF;

        // Voir la doc PathFinding pour la signification de ces variables
        this.pathfinder = new Pathfinding();
        this.ZONE = 'pathfinding';

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.mouseDown = new THREE.Vector2();

        // True : l'utilisateur peut placer des points en cliquant / False : non
        this.pointPutOn = false;
        this.previousPointPutOn = false;

        this.registerEvents()
        this.initGUI()
    }

    sphereFromVector3(vec, radius, color) {
        var geometry = new THREE.SphereGeometry(radius, 32, 32);
        var material = new THREE.MeshBasicMaterial({ color: color });
        var sphere = new THREE.Mesh(geometry, material);
        sphere.position.copy(vec);
        return sphere;
    }

    enablePointPut() {
        console.log("Enabling Pathfinding")
        this.pointPutOn = true;
    }

    disablePointPut() {
        console.log("Disabling Pathfinding")
        this.pointPutOn = false;
    }

    updatePathfindingZone(meshes) {
        this.targetMeshes = meshes;
        const geometryArray = meshes.map((mesh) => mesh.geometry);
        const concatenatedGeometryArray = BufferGeometryUtils.mergeBufferGeometries(geometryArray)
    
        const zone = Pathfinding.createZone(concatenatedGeometryArray);
        this.pathfinder.setZoneData( this.ZONE, zone );
    }

    updatePathfindingZoneNavmesh(navmesh) {    
        const zone = Pathfinding.createZone(navmesh.geometry);
        this.pathfinder.setZoneData( this.ZONE, zone );
    }

    updateLoadedGLTF(loadedGLTF) {
        this.loadedGLTF = loadedGLTF;
    }

    findPath() {
        const groupID = this.pathfinder.getGroup(this.ZONE, this.endPoint, true);

        this.computedPathPoints = this.pathfinder.findPath(this.startPoint, this.endPoint, this.ZONE, groupID);
    
        let pathSpheres = [];
        
        // On affiche le chemi, en bleu, avec des sphères
        for (let i = 0; i < this.computedPathPoints.length; i++) {
            const pointSphere = this.sphereFromVector3(this.computedPathPoints[i], 0.5, 0x0000ff);
            pointSphere.layers.enableAll();
            this.scene.add(pointSphere);
            pathSpheres.push(pointSphere);
        }
    
        this.computedPathSpline = new THREE.CatmullRomCurve3(this.computedPathPoints);
        this.computedPathSpheres = pathSpheres;
    }

    resetPath() {
        this.computedPathSpheres.forEach(sphere => {
            this.scene.remove(sphere);
        });
    
        // On enlève les sphères de départ et d'arrivée et on créer de nouveaux Vector3 vides
        this.scene.remove(this.startPointSphere)
        this.scene.remove(this.endPointSphere)
        this.scene.remove(this.computedPathLine)
        this.startPoint = new THREE.Vector3();
        this.endPoint = new THREE.Vector3();
    }

    // Afficher le chemin ssous forme de ligne
    showPathLine(show) {

        this.pathLineMode = show;

        // Si le chemin n'est pas calculé, on ne fait rien
        if (this.computedPathPoints.length == 0 || this.computedPathPoints == undefined || this.computedPathSpheres.length == 0 || this.computedPathSpheres == undefined) {
            return;
        }

        if (show) {
            // On désaffiche les sphères
            this.computedPathSpheres.forEach(sphere => {
                sphere.visible = !show;
            })

            // On crée la géométrie de la ligne
            const geometry = new THREE.BufferGeometry().setFromPoints([this.startPoint].concat(this.computedPathPoints));

            const line = new MeshLine();
            line.setGeometry(geometry);

            const material = new MeshLineMaterial({		
                useMap: false,
                color: new THREE.Color(0xed6a5a),
                opacity: 1,
                lineWidth: 1,
            });

            this.computedPathLine = new THREE.Mesh(line, material);

            this.scene.add(this.computedPathLine);
        } else {
            this.scene.remove(this.computedPathLine);
            this.computedPathSpheres.forEach(sphere => {
                sphere.visible = !show;
            })
        }
    }

    // Fonction pour lancer le travelling de la caméra
    startCameraPathTraveling() {
        this.travelingPercentage = 0;
        this.pathTraveling = true;
    }

    travelPath() {
        const camPos = this.computedPathSpline.getPoint(this.travelingPercentage/100);
    
        this.camera.position.x = camPos.x;
        this.camera.position.y = camPos.y;
        this.camera.position.z = camPos.z;
    
        const nextPoint = this.computedPathSpline.getPoint((this.travelingPercentage+1) /100)

        if ((this.travelingPercentage+1)/100 > 1) {
            console.log('Path traveling finished...')
            this.pathTraveling = false;
            this.travelingPercentage = 0;
        } else {
            if (this.pathTravelingForward) {
                gsap.to(this.camera.position, {x: nextPoint.x, y: nextPoint.y, z: nextPoint.z, duration: 0.5})
                this.pathTravelingForward = false;
            }
        }
    }

    startWalkingMode() {
        this.previousPointPutOn = this.pointPutOn;

        if (this.pointPutOn) {
            this.pointPutOn = false;
        }
    }

    endWalkingMode() {
        this.pointPutOn = this.previousPointPutOn;
    }
    
    onDocumentPointerUp = (event) => {
        if (this.pointPutOn) {
  
            this.mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
            this.mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
            
        
            // Eviter les clicks non désirés lors du mouvement de caméra
            if (Math.abs( this.mouseDown.x - this.mouse.x ) > 0 || Math.abs( this.mouseDown.y - this.mouse.y ) > 0) return;
        
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
                    return
                }
            }

                
            if (this.startPoint === null || (this.startPoint.x === 0 && this.startPoint.y === 0 && this.startPoint.z === 0) ) {
                console.log("Adding start point")
    
                this.startPoint.copy(intersects[0].point);
                this.startPointSphere = this.sphereFromVector3(this.startPoint, 0.5, 0xFF0000)
                this.startPointSphere.layers.enableAll()
                this.scene.add(this.startPointSphere)
            } else if(this.endPoint === null || (this.endPoint.x === 0 && this.endPoint.y === 0 && this.endPoint.z === 0)) {
                console.log("Adding end point")
    
                this.endPoint.copy(intersects[0].point);
                this.endPointSphere = this.sphereFromVector3(this.endPoint, 0.5, 0x0000FF)
                this.endPointSphere.layers.enableAll()
                this.scene.add(this.endPointSphere)
            }
        }
    }

    onDocumentPointerDown = (event) => {
        if (!this.pointPutOn) return;
        this.mouseDown.x = ( event.clientX / window.innerWidth ) * 2 - 1;
        this.mouseDown.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
    }
    
    registerEvents() {
        this.element.addEventListener('pointerdown', this.onDocumentPointerDown, false);
        this.element.addEventListener('pointerup', this.onDocumentPointerUp, false);
        this.element.addEventListener('wheel', (e) => {
            if (this.pathTraveling) {
                this.pathTravelingForward = true;
                this.travelingPercentage += -Math.sign(e.deltaY) * 0.2;
                if (this.travelingPercentage < 0) {
                    this.travelingPercentage = 0;
                }
            }
        });
    }

    initGUI() {
        const folder = this.gui.addFolder('Tracé de chemins');
        folder.add({findPath: () => this.findPath()}, 'findPath').name("Trouver le chemin");
        folder.add({resetPath: () => this.resetPath()}, 'resetPath').name('Réinitialiser le chemin');
        folder.add({startCameraPathTraveling: () => this.startCameraPathTraveling()}, 'startCameraPathTraveling').name('Travelling caméra');
        folder.add({pathLineMode: false}, 'pathLineMode').onChange((value) => this.showPathLine(value)).name("Affichage de la ligne de chemin");
        folder.add({pointPut: false}, 'pointPut').onChange((value) => this.pointPutOn = value).name("Activer le tracé de chemin");
        folder.close()
    }
}