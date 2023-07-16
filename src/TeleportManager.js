import * as THREE from 'three'

export default class TeleportManager {
    constructor(camera, scene, element, rendererManager, controlManager, gui, debug=false) {
        this.camera = camera
        this.scene = scene
        this.element = element
        this.rendererManager = rendererManager
        this.controlManager = controlManager
        this.gui = gui
        this.debug = debug

        this.rendererManager.teleportManager = this

        this.initGUI()
    }

    teleportToCurrentMarker() {

        const pos = new THREE.Vector3(this.rendererManager.currentPartFile.fpvMarker.x, this.rendererManager.currentPartFile.fpvMarker.y, this.rendererManager.currentPartFile.fpvMarker.z)
        this.camera.position.set(pos.x, pos.y, pos.z)
        setTimeout(() => {
            this.controlManager.startTeleportation()
        }, 100)
    }

    initGUI() {
        if (this.debug) {
            const folder = this.gui.addFolder('Téléportation');
            folder.add({teleportToCurrentMarker: () => this.teleportToCurrentMarker()}, 'teleportToCurrentMarker').name("Téléporter au marqueur courant");
            folder.add({logCamera: () => console.log(this.camera)}, 'logCamera').name("Camera");
        }
    }
}