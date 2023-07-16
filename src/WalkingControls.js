import * as THREE from 'three'
import { Matrix4, Euler, EventDispatcher, Vector3 } from "three";
import { computeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';

THREE.Mesh.prototype.raycast = acceleratedRaycast;
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;


// Merci à : https://github.com/rodones/map/tree/f7bd4f8d54cbbf0b52783465a139cf55059246fa
export default class WalkingControls extends EventDispatcher {
  constructor(camera, element, scene, exitCallback, renderer, debug=false) {
    super();


    if (!camera) throw new Error("The parameter 'camera' is required!");
    if (!element) throw new Error("The parameter 'element' is required!");

    this.camera = camera;
    this.element = element;
    this.scene = scene;
    this.exitCallback = exitCallback;
    this.renderer = renderer;
    this.debug = debug

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
      case "ShiftLeft":
        this.sprint = 1;
        break;
      default:
        flag = false;
    }

    if (flag) this.calculateWorldVelocity();
  };

  onKeyTouchedDown(tag) {
    let flag = false;
    switch (tag) {
      case "Forward":
        flag = this.keys[0] == 0;
        this.keys[0] = 1;
        break;
      case "Left":
        flag = this.keys[1] == 0;
        this.keys[1] = 1;
        break;
      case "Backward":
        flag = this.keys[2] == 0;
        this.keys[2] = 1;
        break;
      case "Right":
        flag = this.keys[3] == 0;
        this.keys[3] = 1;
        break;
      case "ShiftLeft":
        this.sprint = 3.5;
        break;
    }

    if (flag) this.calculateWorldVelocity();
    this.changed();
  }

  onKeyTouchedUp(tag) {
    let flag = false;
    switch (tag) {
      case "Forward":
        flag = this.keys[0] == 1;
        this.keys[0] = 0;
        break;
      case "Left":
        flag = this.keys[1] == 1;
        this.keys[1] = 0;
        break;
      case "Backward":
        flag = this.keys[2] == 1;
        this.keys[2] = 0;
        break;
      case "Right":
        flag = this.keys[3] == 1;
        this.keys[3] = 0;
        break;
      default:
        flag = false;
    }

    if (flag) this.calculateWorldVelocity();
  }

  dispose = () => {
    return this.disconnect();
  };

  lock = () => {
    this.switchFlashlight(true)

    this.element.body.requestPointerLock();
  };

  unlock = () => {
    this.switchFlashlight(false)
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
    this.connectMobileControls()
  };

  connectMobileControls() {
    let check = false;
    (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||window.opera);

    if (check) {
      var keyUp = document.getElementById("arrow-key-up");
      keyUp.addEventListener("touchstart", function() {
        keyUp.classList.add("press-arrow");
        this.onKeyTouchedUp("Forward")
      });
      keyUp.addEventListener("touchend", function() {
        keyUp.classList.remove("press-arrow");
        this.onKeyTouchedDown("Forward")
      });
  
      var keyDown = document.getElementById("arrow-key-down");
      keyDown.addEventListener("touchstart", function() {
        keyDown.classList.add("press-arrow");
        this.onKeyTouchedUp("Backward")
      });
      keyDown.addEventListener("touchend", function() {
        keyDown.classList.remove("press-arrow");
        this.onKeyTouchedDown("Backward")
      });
  
      var keyLeft = document.getElementById("arrow-key-left");
      keyLeft.addEventListener("touchstart", function() {
        keyLeft.classList.add("press-arrow");
        this.onKeyTouchedUp("Left")
      });
      keyLeft.addEventListener("touchend", function() {
        keyLeft.classList.remove("press-arrow");
        this.onKeyTouchedDown("Left")
      });
  
      var keyRight = document.getElementById("arrow-key-right");
      keyRight.addEventListener("touchstart", function() {
        keyRight.classList.add("press-arrow");
        this.onKeyTouchedUp("Right")
      });
      keyRight.addEventListener("touchend", function() {
        keyRight.classList.remove("press-arrow");
        this.onKeyTouchedDown("Right")
      });
    }

  }

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