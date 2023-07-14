import * as THREE from 'three'
import { Matrix4, Euler, EventDispatcher, Vector3 } from "three";
import { computeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';

THREE.Mesh.prototype.raycast = acceleratedRaycast;
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;


// Merci à : https://github.com/rodones/map/tree/f7bd4f8d54cbbf0b52783465a139cf55059246fa
export default class WalkingControls extends EventDispatcher {
  constructor(camera, element, scene, exitCallback, renderer) {
    super();


    if (!camera) throw new Error("The parameter 'camera' is required!");
    if (!element) throw new Error("The parameter 'element' is required!");

    this.camera = camera;
    //camera.rotateOnWorldAxis(new Vector3(1.0, 0.0, 0.0), 0)
    this.element = element;
    this.scene = scene;
    this.exitCallback = exitCallback;
    this.renderer = renderer;

    this.isLocked = false; 
    this.hasMouse = true; 

    this.minPolarAngle = 0;
    this.maxPolarAngle = Math.PI;
    this.delta = 0.1;
    this.distance = 0.5;
    this.jumpOffset = 2;

    this.canJump = false; 
    this.sprint = 1;
    this.keys = [0, 0, 0, 0]; 

    this.finalVelocity = new Vector3(0, -1, 0);
    this.velocity = new Vector3(0, -1, 0);
    this.relativeVelocity = new Vector3(0, 0, 0);
    this.jumpValue = 0;

    this.direction = new Vector3(0, 0, -1); 
    this.up = this.camera.up; 
    this.right = new Vector3(); 
    this.euler = new Euler(0, 0, 0, "YXZ"); 
    this.belowDistance = this.distance; 

    this.raycaster = new THREE.Raycaster(
      this.camera.position,
      this.direction,
      0,
      this.distance,
    );
    this.raycaster.firstHitOnly = true;

    this.connect();
    this.initFlashlight();
  }

  initFlashlight() {
    this.flashlight = new THREE.SpotLight(0xffa95c,1.0, 10, Math.PI * 0.5, 0, 1);
    this.flashlight.castShadow = true;
    this.flashlight.shadow.bias = -0.0001;
    this.flashlight.shadow.mapSize.width = 1024*4;
    this.flashlight.intensity = 0 ;
    this.flashlight.target.position.z = - 3;
    this.camera.add(this.flashlight);
    this.camera.add(this.flashlight.target);
  }

  switchFlashlight(state) {
    if (state) {
      this.scene.traverse((child) => {
        if (child.isAmbientLight || child.isSpotLight) {
          child.visible = false;
        }
      })
      this.flashlight.visible = true;
      this.flashlight.intensity = 1;
    } else {
      this.flashlight.intensity = 0;
      this.scene.traverse((child) => {
        if (child.isAmbientLight || child.isSpotLight) {
          child.visible = true;
        }
      })
      this.flashlight.visible = true;
      this.flashlight.intensity = 0;
    }
  }

  animate() {
    const intersections = this.#raycast();

    if (intersections.length) {
      this.finalVelocity = this.calculateIntersectedVelocity(intersections);
    }
    this.move(this.finalVelocity);

    this.finalVelocity = this.velocity;
  }

  #raycast() {
    this.raycaster.ray.origin = this.camera.position;
    this.raycaster.ray.direction = this.finalVelocity;

    let inter = this.raycaster.intersectObjects(this.renderer.currentMeshes.concat(this.renderer.partPlane), false);

    this.raycaster.ray.direction = new Vector3(0, -1, 0);
    let belowInter = this.raycaster.intersectObjects(this.renderer.currentMeshes.concat(this.renderer.partPlane), false);

    return this.unifyIntersections(inter, belowInter);
  }

  move = (v) => {
    this.camera.position.x += v.x * this.delta * this.sprint;
    this.camera.position.y += this.calculateY(v);
    this.camera.position.z += v.z * this.delta * this.sprint;
  };

  calculateY = (v) => {
    if (!this.canJump && this.jumpValue != 0) {
      this.jumpValue -= 0.5;
      return this.delta;
    }

    if (this.belowDistance == -1) {
      this.canJump = false;
      return v.y * this.delta;
    }

    this.canJump = true;
    return this.belowDistance <= this.distance
      ? this.distance - this.belowDistance - 0.1
      : 0;
  };

  unifyIntersections(inter, belowInter) {
    inter.push(...belowInter);

    this.belowDistance = belowInter.length ? belowInter[0].distance : -1;

    const isadded = {};
    const unifiedIntersections = [];

    inter.forEach((int) => {
      if (int.face) {
        let face_id = `${int.face.normal.x},${int.face.normal.y},${int.face.normal.z}`;

        if (!isadded[face_id]) {
          isadded[face_id] = true;
          unifiedIntersections.push(int);
        }
      }

    });
    return unifiedIntersections;
  }

  calculateIntersectedVelocity(intersections) {
    let blockedVelocity = new Vector3(0, 0, 0);

    intersections.forEach((inter) => {
      blockedVelocity.add(inter.face.normal);
    });

    let yComp =
      blockedVelocity.y > 0.2 ? 0 : this.velocity.y - blockedVelocity.y;

    return new Vector3(
      this.blockVelocity(this.velocity.x, blockedVelocity.x),
      yComp,
      this.blockVelocity(this.velocity.z, blockedVelocity.z),
    );
  }

  blockVelocity(value, blockValue) {
    return Math.abs(blockValue) > Math.abs(value) ? 0 : value + blockValue;
  }

  calculateWorldVelocity() {
    this.calculateRelativeVelocity();
    this.calculateRightVector();

    let dirVector = this.direction.clone();
    let rightVector = this.right.clone();

    dirVector
      .multiplyScalar(-this.relativeVelocity.z)
      .add(rightVector.multiplyScalar(this.relativeVelocity.x));

    this.velocity.x = dirVector.x;
    this.velocity.z = dirVector.z;
  }

  calculateRelativeVelocity() {
    this.relativeVelocity.x = this.keys[3] - this.keys[1]; // a - d
    this.relativeVelocity.z = this.keys[2] - this.keys[0]; // w - s
  }

  calculateWorldDirecton() {
    this.calculateUpVector();
    this.camera.getWorldDirection(this.direction);
  }

  calculateUpVector() {
    var rotationMatrix = new Matrix4().extractRotation(this.camera.matrixWorld);
    this.camera.up = new Vector3(0, 1, 0)
      .applyMatrix4(rotationMatrix)
      .normalize();
    this.up = this.camera.up;
  }

  calculateRightVector() {
    this.right.crossVectors(this.direction, this.up);
  }

  onMouseMove = (event) => {
    if (this.isLocked === false) return;
    if (!this.hasMouse && !event.relatedTarget?.tagName?.startsWith?.("RODO"))
      return;

    const movementX =
      event.movementX || event.mozMovementX || event.webkitMovementX || 0;
    const movementY =
      event.movementY || event.mozMovementY || event.webkitMovementY || 0;

    this.euler.setFromQuaternion(this.camera.quaternion);

    this.euler.y -= movementX * 0.002;
    this.euler.x -= movementY * 0.002;

    this.euler.x = Math.max(
      Math.PI / 2 - this.maxPolarAngle,
      Math.min(Math.PI / 2 - this.minPolarAngle, this.euler.x),
    );

    this.camera.quaternion.setFromEuler(this.euler);

    this.calculateWorldDirecton();
    this.calculateWorldVelocity();
    this.changed();
  };

  onKeyDown = (event) => {
    event.preventDefault();

    let flag = false;
    switch (event.code) {
      case "KeyW":
        flag = this.keys[0] == 0;
        this.keys[0] = 1;
        break;
      case "KeyA":
        flag = this.keys[1] == 0;
        this.keys[1] = 1;
        break;
      case "KeyS":
        flag = this.keys[2] == 0;
        this.keys[2] = 1;
        break;
      case "KeyD":
        flag = this.keys[3] == 0;
        this.keys[3] = 1;
        break;
      case "ShiftLeft":
        this.sprint = 3.5;
        break;
      case "Space":
        if (this.canJump) {
          this.jumpValue = this.jumpOffset;
          this.canJump = false;
          flag = true;
        }
        break;
    }

    if (flag) this.calculateWorldVelocity();
    this.changed();
  };

  onKeyUp = (event) => {
    event.preventDefault();

    let flag = false;
    switch (event.code) {
      case "KeyW":
        flag = this.keys[0] == 1;
        this.keys[0] = 0;
        break;
      case "KeyA":
        flag = this.keys[1] == 1;
        this.keys[1] = 0;
        break;
      case "KeyS":
        flag = this.keys[2] == 1;
        this.keys[2] = 0;
        break;
      case "KeyD":
        flag = this.keys[3] == 1;
        this.keys[3] = 0;
        break;
      // case "KeyM":
      //   this.unlock();
      //   break;
      case "ShiftLeft":
        this.sprint = 1;
        break;
      default:
        flag = false;
    }

    if (flag) this.calculateWorldVelocity();
  };

  dispose = () => {
    return this.disconnect();
  };

  lock = () => {
    this.switchFlashlight(true)

    this.element.body.requestPointerLock();
  };

  unlock = () => {
    this.switchFlashlight(false)

    //this.element.body.exitPointerLock();
    this.exitCallback();
  };

  disconnect = () => {
    this.element.removeEventListener(
      "mousemove",
      this.onMouseMove,
    );
    this.element.removeEventListener(
      "pointerlockchange",
      this.onPointerlockChange,
    );
    this.element.removeEventListener(
      "pointerlockerror",
      this.onPointerlockError,
    );
  };

  connect = () => {
    this.element.addEventListener("keydown", this.onKeyDown);
    this.element.addEventListener("keyup", this.onKeyUp);
    this.element.addEventListener("mousemove", this.onMouseMove);
    this.element.addEventListener(
      "pointerlockchange",
      this.onPointerlockChange,
    );
    this.element.addEventListener(
      "pointerlockerror",
      this.onPointerlockError,
    );
  };

  onPointerlockError = () => {
    console.error("Unable to use Pointer Lock API");
  };

  onPointerlockChange = (_event) => {
    if (this.element.pointerLockElement) {
      this.locked();
    } else {
      this.unlocked();
    }
  };

  getObject = () => {
    return this.camera;
  };

  changed = () => {
    this.dispatchEvent({ type: "change" });
  };

  locked = () => {
    this.isLocked = true;

    this.dispatchEvent({ type: "lock" });
  };

  unlocked = () => {
    this.isLocked = false;
    this.unlock();
    this.dispatchEvent({ type: "unlock" });
  };

  start() {
    this.renderer.loadedMeshes.forEach((mesh) => {
      mesh.geometry.computeBoundsTree();
    });
    this.switchFlashlight(true)
    var x = document.getElementById("toast")
    x.className = "show";
    setTimeout(function(){ x.className = x.className.replace("show", ""); }, 10000);
  }
}