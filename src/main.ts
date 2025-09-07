import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

// TODO: Handle disappearing and reappearing of nodes during warping

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x080217, 1); // Dark blue-black space color
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);

// Create starfield background
function createStarfield() {
    const starsGeometry = new THREE.BufferGeometry();
    const starsMaterial = new THREE.PointsMaterial({ 
        color: 0xffffff,
        size: 1,
        sizeAttenuation: false
    });
    
    const starsVertices = [];
    for (let i = 0; i < 2000; i++) {
        const x = (Math.random() - 0.5) * 2000;
        const y = (Math.random() - 0.5) * 2000;
        const z = (Math.random() - 0.5) * 2000;
        starsVertices.push(x, y, z);
    }
    
    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
    const starField = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(starField);
}

// Node system
interface Node_representation {
    mesh: THREE.Mesh;
    position: THREE.Vector3;
    targetPosition: THREE.Vector3; // New target position for warping
    originalPosition: THREE.Vector3; // Store original position
    id: string;
    isAnchor: boolean;
    isWarping: boolean; // Track if node is currently warping
}

const nodes: Node_representation[] = [];
let currentAnchor: Node_representation | null = null;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const space = 50; // Define the cubic space size

// Warping animation parameters
const PULLBACK_DURATION = 1000; // Pullback phase
const RELEASE_DURATION = 500; // Quick release/snap
const EASE_OUT_DURATION = 4000; // Long ease out to appreciate the result
const TOTAL_WARP_DURATION = PULLBACK_DURATION + RELEASE_DURATION + EASE_OUT_DURATION;

let warpStartTime: number = 0;
let isSpaceWarping: boolean = false;
let controlsStartTarget: THREE.Vector3 = new THREE.Vector3();
let controlsTargetTarget: THREE.Vector3 = new THREE.Vector3();

// Different materials for development and testing
const normalNodeMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
const anchorNodeMaterial = new THREE.MeshBasicMaterial({ color: 0xff4444 });
const hoverNodeMaterial = new THREE.MeshBasicMaterial({ color: 0x66bb6a });

// Create nodes in 3D space
function createNodes() {
    const nodeGeometry = new THREE.SphereGeometry(0.15, 16, 16);
    
    // Create some randomly positioned nodes for testing
    for (let i = 0; i < 500; i++) {
        const position = new THREE.Vector3(
            (Math.random() - 0.5) * space,
            (Math.random() - 0.5) * space,
            (Math.random() - 0.5) * space
        );
        
        const mesh = new THREE.Mesh(nodeGeometry, normalNodeMaterial.clone());
        mesh.position.copy(position);
        scene.add(mesh);
        
        const node: Node_representation = {
            mesh,
            position,
            targetPosition: position.clone(), // Initially same as current position
            originalPosition: position.clone(), // Store original for reset
            id: `node-${i}`,
            isAnchor: false,
            isWarping: false
        };
        
        nodes.push(node);
    }
}



function easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutQuart(t: number): number {
    return 1 - Math.pow(1 - t, 4);
}

// Get the appropriate easing and progress for current animation phase
function getAnimationPhase(elapsed: number): { phase: string, progress: number, easedProgress: number } {
    if (elapsed < PULLBACK_DURATION) {
        // Phase 1: Pullback - smooth buildup
        const progress = elapsed / PULLBACK_DURATION;
        return {
            phase: 'pullback',
            progress,
            easedProgress: easeInOutCubic(progress)
        };
    } else if (elapsed < PULLBACK_DURATION + RELEASE_DURATION) {
        // Phase 2: Release (arrow fired) - linear for smooth transition
        const progress = (elapsed - PULLBACK_DURATION) / RELEASE_DURATION;
        controlsStartTarget.copy(controls.target);
        return {
            phase: 'release',
            progress,
            easedProgress: progress
        };
    } else {
        // Phase 3: Ease out - appreciate the result
        const progress = Math.min((elapsed - PULLBACK_DURATION - RELEASE_DURATION) / EASE_OUT_DURATION, 1);
        return {
            phase: 'easeout',
            progress,
            easedProgress: easeOutQuart(progress)
        };
    }
}

// Placeholder with random positions
function generateNewEmbeddingPositions(anchorNode: Node_representation): void {
    nodes.forEach(node => {
        if (node === anchorNode) {
            node.targetPosition.set(0, 0, 0);
        } else {
            const distance = Math.random() * (space - 2) + 2; // Ensure a minimum distance from anchor
            const theta = Math.random() * Math.PI * 2;
            const phi = (Math.random() - 0.5) * Math.PI;
            
            node.targetPosition.set(
                distance * Math.cos(phi) * Math.cos(theta),
                distance * Math.sin(phi),
                distance * Math.cos(phi) * Math.sin(theta)
            );
        }
        node.isWarping = true;
    });
}

function startSpaceWarp(anchorNode: Node_representation): void {
    generateNewEmbeddingPositions(anchorNode);
    
    // Store controls target positions for smooth interpolation
    controlsStartTarget.copy(controls.target);
    controlsTargetTarget.copy(anchorNode.position);
    
    warpStartTime = performance.now();
    isSpaceWarping = true;
    console.log('Space warping started...');
}

function updateWarpingAnimation(): void {
    if (!isSpaceWarping || !currentAnchor) return;
    
    const currentTime = performance.now();
    const elapsed = currentTime - warpStartTime;
    const { phase, progress, easedProgress } = getAnimationPhase(elapsed);
    controlsTargetTarget.copy(currentAnchor.position);
    
    // Calculate continuous progress values across all phases
    let nodeProgress = 0;
    let controlsProgress = 0;
    
    if (phase === 'pullback') {
        // During pullback, controls target pulls back from anchor (bow tension)
        controlsProgress = -easedProgress * 5; // Pull back 500% from target
    } else if (phase === 'release') {
        nodeProgress = easedProgress * 0.7;
        // During release, controls target snaps toward anchor
        controlsProgress = easedProgress * 0.8; // Move to 80% toward target
    } else if (phase === 'easeout') {
        nodeProgress = 0.7 + (easedProgress * 0.3);
        // During ease-out, controls target completes the transition
        controlsProgress = 0.8 + (easedProgress * 0.2); // Complete to 100%
    }
    
    // Handle different phases - no camera movement, user controls camera
    if (phase === 'pullback') {
        console.log(`Pullback phase: ${(progress * 100).toFixed(1)}%`);
    } else if (phase === 'release') {
        console.log(`Release phase: ${(progress * 100).toFixed(1)}%`);
    } else if (phase === 'easeout') {
        console.log(`Ease out phase: ${(progress * 100).toFixed(1)}%`);
    }
    
    // Apply the continuous node progress to all warping nodes
    nodes.forEach(node => {
        if (node.isWarping) {
            node.position.lerpVectors(node.originalPosition, node.targetPosition, nodeProgress);
            node.mesh.position.copy(node.position);
            
            if (phase === 'easeout' && progress >= 1) {
                node.isWarping = false;
                node.originalPosition.copy(node.position);
            }
        }
    });
    
    // Smoothly interpolate the controls target for bow and arrow effect
    const newTarget = new THREE.Vector3();
    newTarget.lerpVectors(controlsStartTarget, controlsTargetTarget, controlsProgress);
    const diff = newTarget.clone().sub(controls.target);
    camera.position.add(diff); // Move camera along with target
    controls.target.copy(newTarget);
    controls.update();
    
    // Check if animation is complete
    if (elapsed >= TOTAL_WARP_DURATION) {
        isSpaceWarping = false;
        console.log('Space warp complete!');

        // Ensure all nodes are in their final positions
        nodes.forEach(node => {
            if (node.isWarping) {
                node.position.copy(node.targetPosition);
                node.mesh.position.copy(node.position);
                node.isWarping = false;
                node.originalPosition.copy(node.position);
            }
        });
    }
}

// Handle mouse clicks
function onMouseClick(event: MouseEvent) {
    if (isSpaceWarping) return; // Ignore clicks during warping animation
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
function setAnchor(node: Node_representation) {
    if (currentAnchor) {
        currentAnchor.isAnchor = false;
        currentAnchor.mesh.material = normalNodeMaterial.clone();
    }

    node.isAnchor = true;
    node.mesh.material = anchorNodeMaterial.clone();
    currentAnchor = node;
    
    console.log(`Node ${node.id} set as anchor at position:`, node.position);
    
    // Start the bow and arrow space warping animation
    startSpaceWarp(node);
    
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

function onNodeAnchorSet(node: Node_representation) {
    // (TODO) Implement additional features for the anchored node

    console.log(`Anchor set! You can now implement additional features for node: ${node.id}`);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

createNodes();
createStarfield();

camera.position.set(0, 0, 10);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

window.addEventListener('click', onMouseClick);
window.addEventListener('mousemove', onMouseMove);
window.addEventListener('resize', onWindowResize);

function animate() {
    controls.update();
    updateWarpingAnimation();
    renderer.render(scene, camera);
}

// Start the animation loop
renderer.setAnimationLoop(animate);