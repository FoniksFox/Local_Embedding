declare module 'three/examples/jsm/controls/OrbitControls' {
	import { Camera, Renderer, EventDispatcher } from 'three';
	export class OrbitControls extends EventDispatcher {
		constructor(object: Camera, domElement: Renderer['domElement']);
		[key: string]: any;
	}
}
