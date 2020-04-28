//Registering Components
AFRAME.registerComponent('gesture-detector', {
  schema: {
    element: { default: '' },
  },
  init: function() {
    
      
    this.targetElement = this.data.element && document.querySelector(this.data.element)
    if (!this.targetElement) {
      this.targetElement = this.el
    }

    this.internalState = {
      previousState: null,
    }

    this.emitGestureEvent = this.emitGestureEvent.bind(this)

    this.targetElement.addEventListener('touchstart', this.emitGestureEvent)
    this.targetElement.addEventListener('touchend', this.emitGestureEvent)
    this.targetElement.addEventListener('touchmove', this.emitGestureEvent)
  },
  remove: function() {
    this.targetElement.removeEventListener('touchstart', this.emitGestureEvent)
    this.targetElement.removeEventListener('touchend', this.emitGestureEvent)
    this.targetElement.removeEventListener('touchmove', this.emitGestureEvent)
  },
  emitGestureEvent(event) {
    const currentState = this.getTouchState(event)
    const previousState = this.internalState.previousState

    const gestureContinues = previousState &&
                             currentState  &&
                             currentState.touchCount == previousState.touchCount

    const gestureEnded = previousState && !gestureContinues
    const gestureStarted = currentState && !gestureContinues

    if (gestureEnded) {
      const eventName = this.getEventPrefix(previousState.touchCount) + 'fingerend'
      this.el.emit(eventName, previousState)
      this.internalState.previousState = null
    }

    if (gestureStarted) {
      currentState.startTime = performance.now()
      currentState.startPosition = currentState.position
      currentState.startSpread = currentState.spread
      const eventName = this.getEventPrefix(currentState.touchCount) + 'fingerstart'
      this.el.emit(eventName, currentState)
      this.internalState.previousState = currentState
    }

    if (gestureContinues) {
      const eventDetail = {
        positionChange: {
          x: currentState.position.x - previousState.position.x,
          y: currentState.position.y - previousState.position.y
        },
      }

      if (currentState.spread) {
        eventDetail.spreadChange = currentState.spread - previousState.spread
      }

      // Update state with new data
      Object.assign(previousState, currentState)

      // Add state data to event detail
      Object.assign(eventDetail, previousState)

      const eventName = this.getEventPrefix(currentState.touchCount) + 'fingermove'
      this.el.emit(eventName, eventDetail)
    }
  },
  getTouchState: function(event) {
    if (event.touches.length === 0) {
      return null
    }

    // Convert event.touches to an array so we can use reduce
    const touchList = []
    for (let i = 0; i < event.touches.length; i++) {
      touchList.push(event.touches[i])
    }

    const touchState = {
      touchCount: touchList.length,
    }

    // Calculate center of all current touches
    const centerPositionRawX = touchList.reduce((sum, touch) => sum + touch.clientX, 0) / touchList.length
    const centerPositionRawY = touchList.reduce((sum, touch) => sum + touch.clientY, 0) / touchList.length

    touchState.positionRaw = {x: centerPositionRawX, y: centerPositionRawY}

    // Scale touch position and spread by average of window dimensions
    const screenScale =  2 / (window.innerWidth + window.innerHeight)

    touchState.position = {x: centerPositionRawX * screenScale, y: centerPositionRawY * screenScale}

    // Calculate average spread of touches from the center point
    if (touchList.length >= 2 ) {
      const spread = touchList.reduce((sum, touch) => {
        return sum +
          Math.sqrt(
            Math.pow(centerPositionRawX - touch.clientX, 2) +
            Math.pow(centerPositionRawY - touch.clientY, 2))
      }, 0) / touchList.length

      touchState.spread = spread * screenScale
    }

    return touchState
  },
  getEventPrefix(touchCount) {
    const numberNames = ['one', 'two', 'three', 'many']
    return numberNames[Math.min(touchCount, 4) - 1]
  }
})

AFRAME.registerComponent('hold-drag', {
  schema: {
    cameraId: {default: 'camera'},
    groundId: {default: 'ground'},
    dragDelay: {default: 300 },

  },
  init: function() {
    
    this.camera = document.getElementById(this.data.cameraId)
    this.threeCamera = this.camera.getObject3D('camera')
    this.ground = document.getElementById(this.data.groundId)

    this.internalState = {
      fingerDown: false,
      dragging: false,
      distance: 0,
      startDragTimeout: null,
      raycaster: new THREE.Raycaster(),
    }

    const tapRingInner = document.createElement('a-ring')
    tapRingInner.setAttribute('color', '#0dd')
    tapRingInner.setAttribute('ring-inner', '0.5')
    tapRingInner.setAttribute('ring-outer', '0.75')
    tapRingInner.setAttribute('rotation', '-90 0 0')
    tapRingInner.setAttribute('position', '0 0.1 0')

    this.tapRing = document.createElement('a-entity')
    this.tapRing.id = 'tapRing'
    this.tapRing.setAttribute('visible', 'false')
    this.tapRing.appendChild(tapRingInner)
    this.el.sceneEl.appendChild(this.tapRing)

    this.fingerDown = this.fingerDown.bind(this)
    this.startDrag = this.startDrag.bind(this)
    this.fingerMove = this.fingerMove.bind(this)
    this.fingerUp = this.fingerUp.bind(this)

    this.el.addEventListener('mousedown', this.fingerDown)
    this.el.sceneEl.addEventListener('onefingermove', this.fingerMove)
    this.el.sceneEl.addEventListener('onefingerend', this.fingerUp)
  },
  tick: function() {
    //an if statement that makes the drag not work until test equals the correct state
    if(test === 3){
    if (this.internalState.dragging) {
      let desiredPosition = null
      if (this.internalState.positionRaw) {

        const screenPositionX = this.internalState.positionRaw.x / document.body.clientWidth * 2 - 1
        const screenPositionY = this.internalState.positionRaw.y / document.body.clientHeight * 2 - 1
        const screenPosition = new THREE.Vector2(screenPositionX, -screenPositionY)

        this.threeCamera = this.threeCamera || this.camera.getObject3D('camera')

        this.internalState.raycaster.setFromCamera(screenPosition, this.threeCamera)
        const intersects = this.internalState.raycaster.intersectObject(this.ground.object3D, true)

        if (intersects.length > 0) {
          const intersect = intersects[0]
          this.internalState.distance = intersect.distance
          desiredPosition = intersect.point
        }
      }

      if (!desiredPosition) {
        desiredPosition = this.camera.object3D.localToWorld(new THREE.Vector3(0, 0, -this.internalState.distance))
      }

      desiredPosition.y = 2
      this.el.object3D.position.lerp(desiredPosition, 0.2)

      this.tapRing.object3D.position.x = this.el.object3D.position.x
      this.tapRing.object3D.position.z = this.el.object3D.position.z
    }
  }},
  remove: function() {
    this.el.removeEventListener('mousedown', fingerDown)
    this.el.scene.removeEventListener('onefingermove', fingerMove)
    this.el.scene.removeEventListener('onefingerend', fingerUp)
    this.tapRing.parentNode.removeChild(this.tapRing)
  },
  fingerDown: function(event) {
    this.internalState.fingerDown = true
    this.internalState.startDragTimeout = setTimeout(this.startDrag, this.data.dragDelay)
    this.internalState.positionRaw = event.detail.positionRaw
  },
  startDrag: function(event) {
      if (!this.internalState.fingerDown ) {
        return
      }
      this.internalState.dragging = true
      this.internalState.distance = this.el.object3D.position.distanceTo(this.camera.object3D.position)
      this.tapRing.setAttribute('visible', 'true')
      this.tapRing.object3D.scale.copy({x: 0.001, y: 0.001, z: 0.001})
      this.tapRing.removeAttribute('animation__scale')
      this.tapRing.setAttribute('animation__scale', {
        property: 'scale',
        dur: 300,
        from: '0.001 0.001 0.001',
        to: '1 1 1',
        easing: 'easeOutQuad',
      })
    },
  fingerMove: function(event) {
    this.internalState.positionRaw = event.detail.positionRaw
  },
  fingerUp: function(event) {
    this.internalState.fingerDown = false
    clearTimeout(this.internalState.startDragTimeout)

    this.internalState.positionRaw = null

    if (this.internalState.dragging) {
      const endPosition = this.el.object3D.position.clone()
      this.el.setAttribute('animation__drop', {
        property: 'position',
        to: `${endPosition.x} 0 ${endPosition.z}`,
        dur: 300,
        easing: 'easeOutQuad',
      })

      this.tapRing.removeAttribute('animation__scale')
      this.tapRing.setAttribute('animation__scale', {
          property: 'scale',
          dur: 300,
          to: '0.001 0.001 0.001',
          easing: 'easeInQuad',
      })
      setTimeout(() => this.tapRing.setAttribute('visible', 'false'), 300)
    }
    this.internalState.dragging = false
  }
})

AFRAME.registerComponent('initial-tap', {
  init: function() {
    const ground = document.getElementById('ground')
    ground.addEventListener('click', event => {
      if(test === 2){
        // Create new entity for the new object
        var element = document.getElementById('model')
  
        // The raycaster gives a location of the touch in the scene
        const touchPoint = event.detail.intersection.point
        element.setAttribute('position', touchPoint)
  
        element.setAttribute('visible', 'true')
  
        //his.el.sceneEl.appendChild(newElement)
        test = 3;
      }
    })
  }
})

AFRAME.registerComponent('startup-overlay', {
  init: function() {
    this.el.addEventListener('realityready', event => {
      document.getElementById("overlay").style.visibility = "visible";
    })
  }
})

AFRAME.registerComponent('pinch-scale', {
  schema: {
    min: {default: 0.3},
    max: {default: 8}
  },
  init: function() {
    this.initialScale = this.el.object3D.scale.clone()
    this.scaleFactor = 1
    this.handleEvent = this.handleEvent.bind(this)
    this.el.sceneEl.addEventListener('twofingermove', this.handleEvent)
  },
  remove: function() {
    this.el.sceneEl.removeEventListener('twofingermove', this.handleEvent)
  },
  handleEvent: function(event) {
    if(test === 3){
    this.scaleFactor *= 1 + event.detail.spreadChange / event.detail.startSpread
    this.scaleFactor = Math.min(Math.max(this.scaleFactor, this.data.min), this.data.max)

    this.el.object3D.scale.x = this.scaleFactor * this.initialScale.x
    this.el.object3D.scale.y = this.scaleFactor * this.initialScale.y
    this.el.object3D.scale.z = this.scaleFactor * this.initialScale.z
  }}
})

AFRAME.registerComponent('two-finger-spin', {
  schema: {
    factor: {default: 5}
  },
  init: function() {
    this.handleEvent = this.handleEvent.bind(this)
    this.el.sceneEl.addEventListener('twofingermove', this.handleEvent)
  },
  remove: function() {
    this.el.sceneEl.removeEventListener('twofingermove', this.handleEvent)
  },
  handleEvent: function(event) {
    if(test === 3){
    this.el.object3D.rotation.y += event.detail.positionChange.x * this.data.factor
  }}
})

/**
 * @param  {Array<THREE.Material>|THREE.Material} material
 * @return {Array<THREE.Material>}
 */
const ensureMaterialArray = (material) => {
  if (!material) {
    return []
  } 
  
  if (Array.isArray(material)) {
    return material
  } 
  
  if (material.materials) {
    return material.materials
  } 
  
  return [material]
}

/**
 * @param  {THREE.Object3D} mesh
 * @param  {Array<string>} materialNames
 * @param  {THREE.Texture} envMap
 * @param  {number} reflectivity  [description]
 */
const applyEnvMap = (mesh, materialNames, envMap, reflectivity) => {
  if (!mesh) return

  materialNames = materialNames || []

  mesh.traverse((node) => {
    if (!node.isMesh) {
      return
    }
    const meshMaterials = ensureMaterialArray(node.material)

    meshMaterials.forEach((material) => {
      if (material && !('envMap' in material)) return
      if (materialNames.length && materialNames.indexOf(material.name) === -1) return
      
      material.envMap = envMap
      material.reflectivity = reflectivity
      material.needsUpdate = true
    })
  })
}

const toUrl = (urlOrId) => {
  const img = document.querySelector(urlOrId)
  return img ? img.src : urlOrId
}

const cubeEnvMapComponent = {
  multiple: true,
  schema: {
    posx: { default: '#posx' },
    posy: { default: '#posy' },
    posz: { default: '#posz' },
    negx: { default: '#negx' },
    negy: { default: '#negy' },
    negz: { default: '#negz' },
    extension: { default: 'png', oneOf: ['jpg', 'png'] },
    format: { default: 'RGBFormat', oneOf: ['RGBFormat', 'RGBAFormat'] },
    enableBackground: { default: false },
    reflectivity: { default: 1, min: 0, max: 1 },
    materials: { default: [] }
  },
  init: function () {
    const data = this.data
   
    this.texture = new THREE.CubeTextureLoader().load([
      toUrl(data.posx), toUrl(data.negx),
      toUrl(data.posy), toUrl(data.negy),
      toUrl(data.posz), toUrl(data.negz)
    ])
    this.texture.format = THREE[data.format]

    this.object3dsetHandler = () => {
      const mesh = this.el.getObject3D('mesh')
      const data = this.data
      applyEnvMap(mesh, data.materials, this.texture, data.reflectivity)
    }
    this.el.addEventListener('object3dset', this.object3dsetHandler)
  },
  update: function (oldData) {
    const data = this.data
    const mesh = this.el.getObject3D('mesh')

    let addedMaterialNames = []
    let removedMaterialNames = []

    if (data.materials.length) {
      if (oldData.materials) {
        addedMaterialNames = data.materials.filter((name) => !oldData.materials.includes(name))
        removedMaterialNames = oldData.materials.filter((name) => !data.materials.includes(name))
      } else {
        addedMaterialNames = data.materials
      }
    }
    if (addedMaterialNames.length) {
      applyEnvMap(mesh, addedMaterialNames, this.texture, data.reflectivity)
    }
    if (removedMaterialNames.length) {
      applyEnvMap(mesh, removedMaterialNames, null, 1)
    }

    if (oldData.materials && data.reflectivity !== oldData.reflectivity) {
      const maintainedMaterialNames = 
        data.materials.filter((name) => oldData.materials.includes(name))
      if (maintainedMaterialNames.length) {
        applyEnvMap(mesh, maintainedMaterialNames, this.texture, data.reflectivity)
      }
    }

    if (this.data.enableBackground && !oldData.enableBackground) {
      this.setBackground(this.texture)
    } else if (!this.data.enableBackground && oldData.enableBackground) {
      this.setBackground(null)
    }
  },

  remove: function () {
    this.el.removeEventListener('object3dset', this.object3dsetHandler)
    const mesh = this.el.getObject3D('mesh')
    const data = this.data
    applyEnvMap(mesh, data.materials, null, 1)
    if (data.enableBackground) {
      this.setBackground(null)
    }
  },

  setBackground: function (texture) {
    this.el.sceneEl.object3D.background = texture
  }
}

AFRAME.registerComponent('cube-env-map', cubeEnvMapComponent)

