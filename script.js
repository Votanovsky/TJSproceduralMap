import { 
    Scene, PerspectiveCamera, WebGLRenderer,
    Color, ACESFilmicToneMapping,
    sRGBEncoding, Mesh,
    SphereGeometry, MeshStandardMaterial,
    PMREMGenerator,
    FloatType,
    CylinderGeometry,
    BoxGeometry,
    Vector2,
    TextureLoader,
    MeshPhysicalMaterial,
    PCFSoftShadowMap,
    PointLight,
    DoubleSide,
    // setDataType
    
} from 'https://cdn.skypack.dev/three@0.137';

import { RGBELoader } from 'https://cdn.skypack.dev/three-stdlib@2.8.5/loaders/RGBELoader';
import { OrbitControls } from 'https://cdn.skypack.dev/three-stdlib@2.8.5/controls/OrbitControls';
import { mergeBufferGeometries } from 'https://cdn.skypack.dev/three-stdlib@2.8.5/utils/BufferGeometryUtils';
import SimplexNoise from 'https://cdn.skypack.dev/simplex-noise';
import {GLTFLoader} from 'https://cdn.skypack.dev/three-stdlib@2.8.5/loaders/GLTFLoader'

import { gsap } from 'https://cdn.skypack.dev/gsap';
import { ScrollTrigger } from 'https://cdn.skypack.dev/gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);

// console.log(gsap)



const scene = new Scene()
scene.background = new Color("#000")

const camera = new PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 1000)
camera.position.set(-5, 37, 35)
// camera.position.set(0, 0, 50)

const renderer = new WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = ACESFilmicToneMapping;
renderer.outputEncoding = sRGBEncoding;
renderer.physicallyCorrectLights = true;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFSoftShadowMap;
document.body.appendChild(renderer.domElement)

const light = new PointLight( new Color("#FFCB8E").convertSRGBToLinear().convertSRGBToLinear(), 80, 200 );
light.position.set(10, 20, 10);

light.castShadow = true; 
light.shadow.mapSize.width = 512; 
light.shadow.mapSize.height = 512; 
light.shadow.camera.near = 0.5; 
light.shadow.camera.far = 500; 
scene.add( light );

const controls = new OrbitControls(camera, renderer.domElement)
controls.target.set(0,0,0)
controls.dampingFactor = 0.05
controls.enableDamping = true

let envmap

const max_height = 10;
const stone_height = max_height * 0.8;
const dirt_height = max_height * 0.7;
const grass_height = max_height * 0.5;
const sand_height = max_height * 0.3;
const dirt2_height = max_height * 0;


(async function() {
    let pmrem = new PMREMGenerator(renderer)
    let envmapTexture = await new RGBELoader().setDataType(FloatType).loadAsync("envmap.hdr")
    envmap = pmrem.fromEquirectangular(envmapTexture).texture

    let textures = {
        dirt: await new TextureLoader().load("clr.jpg"),
        dirt2: await new TextureLoader().load("pink.jpg"),
        grass: await new TextureLoader().load("mosaic.jpg"),
        sand: await new TextureLoader().load("green.jpg"),
        water: await new TextureLoader().load("water.jpg"),
        stone: await new TextureLoader().load("ttjpg.jpg"),
    }

    const simplex = new SimplexNoise()

    for(let i = -16; i <= 16; i++) {
        for(let j = -16; j <= 16; j++) {
            let position = tileToPosition(i,j)

            if(position.length() > 16) continue 

            let noise = (simplex.noise2D(i * 0.1, j * 0.1) + 1) * 0.5
            noise = Math.pow(noise, 1.5)

            makeHex(noise * max_height, position)
        }
    }

    let stoneMesh = hexMesh(stoneGeo, textures.stone)
    let grassMesh = hexMesh(grassGeo, textures.grass)
    let dirt2Mesh = hexMesh(dirt2Geo, textures.dirt2)
    let dirtMesh = hexMesh(dirtGeo, textures.dirt)
    let sandMesh = hexMesh(sandGeo, textures.sand)
    scene.add(stoneMesh,grassMesh,dirt2Mesh,dirtMesh,sandMesh)

    let seaMesh = new Mesh(
        new CylinderGeometry(17,17, max_height * 0.2, 50),
        new MeshPhysicalMaterial({
            envMap: envmap,
            color: new Color('#39f0fa').convertSRGBToLinear().multiplyScalar(3),
            ior: 1.4,
            transmission: 1,
            transparent: true,
            thickness: 1.5,
            envMapIntensity: 0.2, 
            roughness: 1,
            metalness: 0.025,
            roughnessMap: textures.water,
            metalnessMap: textures.water,
        })
    )
    seaMesh.receiveShadow = true
    seaMesh.position.set(0, max_height * 0.1, 0)
    scene.add(seaMesh)


    let mapContainer = new Mesh(
        new CylinderGeometry(17.1, 17.1, max_height * 0.25, 50, 1, true),
        new MeshPhysicalMaterial({
            envMap: envmap,
            // map: textures.water,
            envMapIntensity: 0.01,
            side: DoubleSide
        })
    )
    mapContainer.receiveShadow = true
    mapContainer.position.set(0, max_height * 0.125, 0)
    scene.add(mapContainer)

    let mapFloor = new Mesh(
        new CylinderGeometry(18.5, 18.5, max_height * 0.1, 50),
        new MeshPhysicalMaterial({
            envMap: envmap,
            map: textures.dirt2,
            envMapIntensity: 0.1,
            side: DoubleSide
        })
    )
    mapFloor.receiveShadow = true
    mapFloor.position.set(0, -max_height * 0.05, 0)
    scene.add(mapFloor)

    // clouds()


    renderer.setAnimationLoop(()=> {
        controls.update()
        renderer.render(scene, camera)
    })
}())

function tileToPosition(tileX, tileY) {
    return new Vector2((tileX + (tileY % 2) * 0.5) * 1.77, tileY * 1.535)
}

let stoneGeo = new BoxGeometry(0,0,0)
let dirtGeo = new BoxGeometry(0,0,0)
let dirt2Geo = new BoxGeometry(0,0,0)
let sandGeo = new BoxGeometry(0,0,0)
let grassGeo = new BoxGeometry(0,0,0)

function hexGeometry(height, position) {
    let geo = new CylinderGeometry(1, 1, height, 6, 1, false)
    geo.translate(position.x, height * 0.5, position.y)

    return geo
}
function makeHex(height, position) {
    let geo = hexGeometry(height, position)
    
    if(height > stone_height) {
        stoneGeo = mergeBufferGeometries([geo, stoneGeo])
        
        if(Math.random() > 0.8) {
            stoneGeo = mergeBufferGeometries([stoneGeo, stone(height, position)]);
        }

    } else if (height > dirt_height) {
        dirtGeo = mergeBufferGeometries([geo, dirtGeo])

        if(Math.random() > 0.8) {
            grassGeo = mergeBufferGeometries([grassGeo, three(height, position)]);
        }

    } else if (height > grass_height) {
        grassGeo = mergeBufferGeometries([geo, grassGeo])
    } else if (height > sand_height) {
        sandGeo = mergeBufferGeometries([geo, sandGeo])

        if(Math.random() > 0.8) {
            stoneGeo = mergeBufferGeometries([stoneGeo, stone(height, position)]);
        }

    } else if (height > dirt2_height) {
        dirt2Geo = mergeBufferGeometries([geo, dirt2Geo])
    }
}

function hexMesh(geo, map) {
    let mat = new MeshPhysicalMaterial({
        envMap: envmap, 
        envMapIntensity: 0.135, 
        flatShading: true,
        map
    })

    let mesh = new Mesh(geo, mat)
    mesh.castShadow = true
    mesh.receiveShadow = true

    return mesh
}

function stone(height, position) {
    const px = Math.random() * 0.4
    const pz = Math.random() * 0.4

    const geo = new SphereGeometry(Math.random() * 0.3 + 0.1, 7, 7)
    geo.translate(position.x + px, height, position.y + pz)

    return geo
}

function three(height, position) {
    const treeHeight = Math.random() * 1 + 1.25;
  
    const geo = new CylinderGeometry(0, 1.5, treeHeight, 3);
    geo.translate(position.x, height + treeHeight * 0 + 1, position.y);
    
    const geo2 = new CylinderGeometry(0, 1.15, treeHeight, 3);
    geo2.translate(position.x, height + treeHeight * 0.6 + 1, position.y);
    
    const geo3 = new CylinderGeometry(0, 0.8, treeHeight, 3);
    geo3.translate(position.x, height + treeHeight * 1.25 + 1, position.y);
  
    return mergeBufferGeometries([geo, geo2, geo3]);
}

function clouds() {
    let geo = new SphereGeometry(0, 0, 0); 
    let count = Math.floor(Math.pow(Math.random(), 0.45) * 4);
  
    for(let i = 0; i < count; i++) {
      const puff1 = new SphereGeometry(1.2, 7, 7);
      const puff2 = new SphereGeometry(1.5, 7, 7);
      const puff3 = new SphereGeometry(0.9, 7, 7);
     
      puff1.translate(-1.85, Math.random() * 0.5, 0);
      puff2.translate(0,     Math.random() * 0.5, 0);
      puff3.translate(1.85,  Math.random() * 0.5, 0);
  
      const cloudGeo = mergeBufferGeometries([puff1, puff2, puff3]);
      cloudGeo.translate( 
        Math.random() * 20 - 10, 
        Math.random() * 7 + 7, 
        Math.random() * 20 - 10
      );
      cloudGeo.rotateY(Math.random() * Math.PI * 2);
  
      geo = mergeBufferGeometries([geo, cloudGeo]);
    }
    
    const mesh = new Mesh(
      geo,
      new MeshStandardMaterial({
        envMap: envmap, 
        envMapIntensity: 0.75, 
        flatShading: true,
        color: 0x000000
        // transparent: true,
        // opacity: 0.85,
      })
    );
  
    scene.add(mesh);
}

let modelOne = ''
let modelTwo = ''
let modelThree = ''
let textureHead = new TextureLoader().load("mosaic.jpg")
const gltfLoader = new GLTFLoader()
gltfLoader.load('myhead4.gltf', (gltf)=> {
    
    modelOne = gltf.scene
    modelOne.scale.set(2, 2, 2)
    modelOne.position.y = 15
    modelOne.position.z = -10
    modelOne.rotation.x = .3
    modelOne.traverse(o=> {
        if(o.isMesh) {
            o.geometry.center()
            o.material = new MeshStandardMaterial({
                color: 0xffffff,
                envMap: envmap, 
                envMapIntensity: 0.75, 
                flatShading: true,
                map: textureHead,
            });
        }
        
    })
    scene.add(modelOne)
})
gltfLoader.load('myhead4.gltf', (gltf)=> {
    
    modelTwo = gltf.scene
    modelTwo.scale.set(2, 2, 2)
    modelTwo.position.y = 13
    modelTwo.position.x = -13
    modelTwo.rotation.y = 1.2
    modelTwo.rotation.z = .3
    modelTwo.traverse(o=> {
        if(o.isMesh) {
            o.geometry.center()
            o.material = new MeshStandardMaterial({
                // color: 0xffffff,
                envMap: envmap,
                // roughness: 1,
                // metalness: .5,
                envMapIntensity: 0.75, 
                flatShading: true,
                map: textureHead,
            });
        }
        
    })
    scene.add(modelTwo)
    
})
gltfLoader.load('myhead4.gltf', (gltf)=> {
    
    modelThree = gltf.scene
    modelThree.scale.set(2, 2, 2)
    modelThree.position.y = 10
    modelThree.position.x = 10
    modelThree.rotation.y = -1.2
    modelThree.rotation.z = .3
    modelThree.traverse(o=> {
        if(o.isMesh) {
            o.geometry.center()
            o.material = new MeshStandardMaterial({
                color: 0xffffff,
                envMap: envmap, 
                envMapIntensity: 0.75, 
                flatShading: true,
                map: textureHead,
            });
        }
        
    })
    scene.add(modelThree)
})

let tl = ''

tl = gsap.timeline({
    scrollTrigger: { 
      // trigger: '.wrap',
      // trigger: 'wrap',
      // trigger: '#wrap',
      // trigger: '.container',
      // markers: true,
      scrub: 0.5,
      start: 'top top',
      end: 'bottom bottom',
      snap: 1/(3-1),
      onUpdate: (self)=>{
        // modelThree.position.z = 2.*3.14*self.progress;
        modelThree.position.y = 10 + self.progress*4;
        modelThree.rotation.y = 2.*3.14*self.progress;
      }
    }
});
tl = gsap.timeline({
    scrollTrigger: { 
      // trigger: '.wrap',
      // trigger: 'wrap',
      // trigger: '#wrap',
      // trigger: '.container',
      // markers: true,
      scrub: 0.5,
      start: 'top top',
      end: 'bottom bottom',
      snap: 1/(4-1),
      onUpdate: (self)=>{
        // modelTwo.rotation.z = 2.*3.14*self.progress;
        // modelTwo.position.z = -2.6*Math.sin(3.14*self.progress);
        modelTwo.position.y = 10 + self.progress*4;
        modelTwo.rotation.y = 2.*3.14*self.progress;
        camera.position.z = 35 + (-20* self.progress);
        camera.position.y = 37 + (-25* self.progress);
        camera.position.x = -5 + (-25* self.progress);
      }
    }
});


// ========= RESIZE ============
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}

window.addEventListener('resize', () =>
{
    // Update sizes
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight

    // Update camera
    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix()

    // Update renderer
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})

