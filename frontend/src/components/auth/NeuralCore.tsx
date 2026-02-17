import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Stars, PerspectiveCamera, Environment, MeshDistortMaterial } from '@react-three/drei';
import * as THREE from 'three';

const Geometries = () => {
    const meshRef = useRef<THREE.Mesh>(null);
    const ringRef = useRef<THREE.Mesh>(null);
    const ringRef2 = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        const time = state.clock.getElapsedTime();
        if (meshRef.current) {
            meshRef.current.rotation.x = time * 0.2;
            meshRef.current.rotation.y = time * 0.3;
        }
        if (ringRef.current) {
            ringRef.current.rotation.x = time * 0.1;
            ringRef.current.rotation.z = time * 0.1;
        }
        if (ringRef2.current) {
            ringRef2.current.rotation.y = time * 0.15;
            ringRef2.current.rotation.x = -time * 0.1;
        }
    });

    return (
        <group scale={1.2}>
            {/* Central Core */}
            <Float speed={2} rotationIntensity={1.5} floatIntensity={1.5}>
                <mesh ref={meshRef}>
                    <icosahedronGeometry args={[1, 0]} />
                    <MeshDistortMaterial
                        color="#6E44FF"
                        emissive="#2892D7"
                        emissiveIntensity={0.5}
                        roughness={0.1}
                        metalness={1}
                        distort={0.4}
                        speed={2}
                        wireframe
                    />
                </mesh>
            </Float>

            {/* Outer Rings */}
            <mesh ref={ringRef}>
                <torusGeometry args={[2.2, 0.02, 16, 100]} />
                <meshStandardMaterial color="#00F0FF" emissive="#00F0FF" emissiveIntensity={2} transparent opacity={0.3} />
            </mesh>

            <mesh ref={ringRef2} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[2.8, 0.02, 16, 100]} />
                <meshStandardMaterial color="#FF2A6D" emissive="#FF2A6D" emissiveIntensity={2} transparent opacity={0.3} />
            </mesh>

            {/* Ambient particles */}
            <Stars radius={50} depth={50} count={2000} factor={4} saturation={0} fade speed={1} />
        </group>
    );
};

const NeuralCore = () => {
    console.log('NeuralCore component rendering...');

    return (
        <div className="w-full h-full absolute inset-0 z-0 bg-nebula">
            <Canvas
                gl={{ antialias: true, alpha: true }}
                dpr={[1, 2]}
                onCreated={() => console.log('Canvas created successfully')}
            >
                <PerspectiveCamera makeDefault position={[0, 0, 6]} />
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} intensity={1.5} color="#6E44FF" />
                <pointLight position={[-10, -10, -10]} intensity={0.5} color="#00F0FF" />

                <Geometries />

                <Environment preset="city" />
                <fog attach="fog" args={['#0A0A0C', 5, 20]} />
            </Canvas>

            {/* Overlay Gradient to blend with UI */}
            <div className="absolute inset-0 bg-gradient-to-t from-void via-transparent to-transparent pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-r from-void via-transparent to-transparent pointer-events-none opacity-50" />
        </div>
    );
};

export default NeuralCore;

