import { useRef, useEffect } from 'react';
import * as THREE from 'three';

const EARTH_TEXTURE = '/earth.jpg';
const UNIVERSE_TEXTURE = '/universe.jpg';

const SpaceBackground = () => {
  // Explicitly set the type of the ref to HTMLDivElement for type safety
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Cast the ref current as HTMLDivElement for type safety
    const currentMount = mountRef.current as HTMLDivElement | null;
    if (!currentMount) return;

    // Declare objects with 'let' only if they MUST be defined asynchronously later.
    // 'earth' is defined synchronously, but its material is updated asynchronously.
    let universe: THREE.Mesh | undefined;

    const width = window.innerWidth;
    const height = window.innerHeight;

    // --- Scene Setup ---
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

    renderer.setSize(width, height);
    currentMount.appendChild(renderer.domElement);
    renderer.domElement.style.position = 'fixed';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.zIndex = '-10';

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(0x404040, 5); // soft white light
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0xffffff, 100);
    pointLight.position.set(5, 5, 5);
    scene.add(pointLight);

    // Create a single texture loader instance
    const loader = new THREE.TextureLoader();

    // --- 1. Rotating Earth (Synchronously Defined, Asynchronously Textured) ---
    const earthGeometry = new THREE.SphereGeometry(2, 64, 64);

    // Start with a generic material while the texture loads
    const earthMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff, // White base color
      specular: 0x333333, // Base specular reflection
      shininess: 7,
    });

    // FIX 2: Use 'const' for the earth mesh since it is immediately assigned
    const earth = new THREE.Mesh(earthGeometry, earthMaterial);
    scene.add(earth);

    loader.load(
      EARTH_TEXTURE,
      (texture) => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        // Apply the texture to the mesh's material after loading
        earthMaterial.map = texture;
        earthMaterial.needsUpdate = true;
      },
      (err) => {
        console.error('Error loading Earth texture:', err);
      }
    );

    // Position Earth near the top of the screen
    camera.position.z = 5;
    earth.position.set(0, 1.5, 0);

    // --- 2. 3D Universe Background (Asynchronously Loaded) ---
    const universeGeometry = new THREE.SphereGeometry(300, 32, 32);

    loader.load(
      UNIVERSE_TEXTURE,
      (texture) => {
        const universeMaterial = new THREE.MeshBasicMaterial({
          map: texture,
          side: THREE.BackSide,
        });
        // Define the universe mesh inside the callback
        universe = new THREE.Mesh(universeGeometry, universeMaterial);
        scene.add(universe);
      },
      (err) => {
        console.error('Error loading Universe texture:', err);
      }
    );

    // --- Animation Loop ---
    const animate = () => {
      requestAnimationFrame(animate);

      // Earth rotation (Safely check if earth is defined before manipulating)
      if (earth) {
        earth.rotation.y += 0.005;
        earth.rotation.x += 0.001;
      }

      // Subtle camera movement (space drift)
      camera.rotation.y += 0.0001;

      renderer.render(scene, camera);
    };

    // --- Handle Window Resize ---
    const onWindowResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', onWindowResize);
    animate();

    // --- Cleanup ---
    return () => {
      // Cleanup now uses the type-safe currentMount
      if (currentMount.contains(renderer.domElement)) {
        currentMount.removeChild(renderer.domElement);
      }
      window.removeEventListener('resize', onWindowResize);
      // Dispose of resources to prevent memory leaks
      if (earth) {
        // Check before disposing
        earth.geometry.dispose();
        if (Array.isArray(earth.material)) {
          earth.material.forEach((material) => material.dispose());
        } else {
          earth.material.dispose();
        }
      }
      if (universe) {
        // Check before disposing
        universe.geometry.dispose();
        if (Array.isArray(universe.material)) {
          universe.material.forEach((material) => material.dispose());
        } else {
          universe.material.dispose();
        }
      }
      if (renderer) {
        renderer.dispose();
      }
    };
  }, []); // Run once on mount

  return <div ref={mountRef} className='fixed inset-0 w-full h-full'></div>;
};

export default SpaceBackground;
