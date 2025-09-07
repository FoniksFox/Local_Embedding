import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);

// Node system
interface Node {
    mesh: THREE.Mesh;
    position: THREE.Vector3;
    id: string;
    isAnchor: boolean;
}

const nodes: Node[] = [];
let currentAnchor: Node | null = null;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Different materials for development and testing
const normalNodeMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
const anchorNodeMaterial = new THREE.MeshBasicMaterial({ color: 0xff4444 });
const hoverNodeMaterial = new THREE.MeshBasicMaterial({ color: 0x66bb6a });

// Create nodes in 3D space
function createNodes() {
    const nodeGeometry = new THREE.SphereGeometry(0.15, 16, 16);
    
    // Create some randomly positioned nodes for testing
    for (let i = 0; i < 15; i++) {
        const position = new THREE.Vector3(
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 10
        );
        
        const mesh = new THREE.Mesh(nodeGeometry, normalNodeMaterial.clone());
        mesh.position.copy(position);
        scene.add(mesh);
        
        const node: Node = {
            mesh,
            position,
            id: `node-${i}`,
            isAnchor: false
        };
        
        nodes.push(node);
    }
}

// Handle mouse clicks
function onMouseClick(event: MouseEvent) {
    // Normalize mouse coordinates
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const nodeMeshes = nodes.map(node => node.mesh);
    const intersects = raycaster.intersectObjects(nodeMeshes);
    
    if (intersects.length > 0) {
        const clickedMesh = intersects[0].object;
        const clickedNode = nodes.find(node => node.mesh === clickedMesh);
        
        if (clickedNode) {
            setAnchor(clickedNode);
        }
    }
}

// Set a node as the anchor
function setAnchor(node: Node) {
    if (currentAnchor) {
        currentAnchor.isAnchor = false;
        currentAnchor.mesh.material = normalNodeMaterial.clone();
    }

    node.isAnchor = true;
    node.mesh.material = anchorNodeMaterial.clone();
    currentAnchor = node;
    
    // Update orbit controls to focus on the anchor
    controls.target.copy(node.position);
    camera.position.set(node.position.x, node.position.y, node.position.z + 5); // Reset camera position, should be adjusted
    controls.update();
    
    console.log(`Node ${node.id} set as anchor at position:`, node.position);
    
    onNodeAnchorSet(node);
}

// Handle mouse movement for hover effects
function onMouseMove(event: MouseEvent) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    
    const nodeMeshes = nodes.map(node => node.mesh);
    const intersects = raycaster.intersectObjects(nodeMeshes);
    
    nodes.forEach(node => {
        if (!node.isAnchor) {
            node.mesh.material = normalNodeMaterial.clone();
        }
    });
    
    // Highlight hovered node
    if (intersects.length > 0) {
        const hoveredMesh = intersects[0].object as THREE.Mesh;
        const hoveredNode = nodes.find(node => node.mesh === hoveredMesh);
        
        if (hoveredNode && !hoveredNode.isAnchor) {
            hoveredNode.mesh.material = hoverNodeMaterial.clone();
        }
        
        document.body.style.cursor = 'pointer';
    } else {
        document.body.style.cursor = 'default';
    }
}

function onNodeAnchorSet(node: Node) {
    // (TODO) Implement additional features for the anchored node

    console.log(`Anchor set! You can now implement additional features for node: ${node.id}`);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

createNodes();

camera.position.set(0, 0, 10);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

window.addEventListener('click', onMouseClick);
window.addEventListener('mousemove', onMouseMove);
window.addEventListener('resize', onWindowResize);

function animate() {
    controls.update();
    renderer.render(scene, camera);
}

// Start the animation loop
renderer.setAnimationLoop(animate);