import * as THREE from 'three';

declare global {
  interface Window {
    THREE: typeof THREE;
  }
}
