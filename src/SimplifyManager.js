import * as THREE from 'three'
import { SimplifyModifier } from 'three/addons/modifiers/SimplifyModifier.js';

export default class SimplifyManager {
    constructor(camera, scene, element, pathfinder, renderer, gui, debug) {
        this.camera = camera
        this.scene = scene
        this.element = element
        this.pathfinder = pathfinder
        this.renderer = renderer
        this.gui = gui
        this.debug = debug
        
        this.simplifyLevel;
        this.maxSimplifyLevel = 10

        // Chaque tableau (au nombre de maxSimplifyLevel) contient les meshes simplifiés à un niveau donné
        this.meshesSimplifiedArray = Array.from({ length: this.maxSimplifyLevel }, () => []);

        this.initGUI()
    }

    simplifyMeshes(meshes) {
    
        let simplifiedMeshes = [];
        this.renderer.loader.update(10);
    
        if (this.meshesSimplifiedArray[this.simplifyLevel-1].length > 0) {

            console.log("Already simplified for level " + this.simplifyLevel);
            this.meshesSimplifiedArray[this.simplifyLevel-1].forEach(mesh => {
                this.scene.add(mesh)
                simplifiedMeshes.push(mesh);
            })

        } else {
            console.log("Not yet simplified for level " + this.simplifyLevel);
    
            meshes.forEach((mesh, i) => {
                let simplifiedMeshTemp = this.simplifyMesh(mesh, this.simplifyLevel);
                this.renderer.loader.update(100*(i+1)/meshes.length);
        
                let simplifiedMesh = new THREE.Mesh(
                    simplifiedMeshTemp.geometry,
                    new THREE.MeshBasicMaterial({ color: 0xFF1E1E, wireframe: true }),
                )
        
                simplifiedMesh.name = simplifiedMeshTemp.name + "_simp_" + this.simplifyLevel;
        
                //simplifiedMesh.layers.set(this.simplifyLevel);
        
                simplifiedMeshes.push(simplifiedMesh);
            });
            this.meshesSimplifiedArray[this.simplifyLevel-1] = simplifiedMeshes;
        }
    
    
        this.pathfinder.updatePathfindingZone(simplifiedMeshes);
        this.renderer.loader.finish();
    
        // this.scene.layers.set(this.simplifyLevel);
        // this.camera.layers.set(this.simplifyLevel);

        return simplifiedMeshes
    }

    simplifyMesh(mesh, level) {
    
        const modifier = new SimplifyModifier();
        const simplified = mesh.clone();
    
        simplified.material = simplified.material.clone();
        simplified.material.flatShading = true;
        
        // Le coefficient numérique à la fin indique le pourcentage de triangles à conserver
        const count = Math.floor( simplified.geometry.attributes.position.count * 0.1 * 2**level);
        simplified.geometry = modifier.modify( simplified.geometry, count );

        return simplified;
    }
    
    initGUI() {
        const folder = this.gui.addFolder('Simplification');
        let self = this
        folder.add({sliderSimplifyValue: 1,}, 'sliderSimplifyValue', 1, 10, 1).onChange((value) => this.simplifyLevel = value).name("Degrès de simplification");
        folder.add({simplify: () => self.renderer.renderSimplifyPart(self.simplifyMeshes(self.renderer.currentMeshes))}, 'simplify').name('Simplifier');
        folder.close()
    }
}