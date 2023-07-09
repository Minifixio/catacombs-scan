import * as ThreeMeshUI from "three-mesh-ui";
import FontJSON from '../assets/Roboto-msdf.json';
import FontImage from '../assets/Roboto-msdf.png';
import * as THREE from 'three'

export default class InfoPanel {
    constructor(scene) {
        this.scene = scene
        this.panel = null
    }

    makeTextPanel(text, description, xOffset) {

        const container = new ThreeMeshUI.Block( {
            width: 40,
            height: 20,
            padding: 0.05,
            justifyContent: 'center',
            textAlign: 'left',
            fontFamily: FontJSON,
		    fontTexture: FontImage,
            // interLine: 0,
        } );
    
        container.position.set( xOffset-10, 1, 0 );
        
        container.rotation.y = Math.PI / 2;
        //container.rotateOnAxis(new THREE.Vector3(1, 1, 0), Math.PI / 4)
        this.scene.add( container );
        
        container.add(
            new ThreeMeshUI.Text( {
                // content: 'This library supports line-break-friendly-characters,',
                content: text,
                fontSize: 5
            } ),

            
            new ThreeMeshUI.Text( {
                content: '\n' + description,
                fontSize: 2
            } )
        );

        this.panel = container
    }

    remove() {
        this.scene.remove(this.panel)
    }

    static update() {
        ThreeMeshUI.update();
    }
}