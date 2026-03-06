import React, { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Icosahedron, Float, Sparkles, Ring } from '@react-three/drei';
import * as THREE from 'three';
import { particlesConfig } from '../config/particlesConfig';

// -----------------------------------------------------------------------------
// 0. 脉冲波纹 (Pulse Rings) - 模拟电波扩散
// -----------------------------------------------------------------------------
const PulseRings = () => {
  const ringRef = useRef();
  
  useFrame((state) => {
    if (ringRef.current) {
       // 让圆环不断放大并透明度降低
       const t = state.clock.getElapsedTime() % 3; // 3秒一个周期
       const scale = 1 + t * 2;
       ringRef.current.scale.set(scale, scale, scale);
       ringRef.current.material.opacity = Math.max(0, 1 - t/3) * 0.3;
       ringRef.current.rotation.x = Math.PI / 2; // 水平放置
       ringRef.current.position.y = -2; // 位于下方
    }
  });

  return (
    <Ring args={[3, 3.05, 64]} ref={ringRef}>
      <meshBasicMaterial color="#00ffff" transparent opacity={0.5} side={THREE.DoubleSide} />
    </Ring>
  );
};

// -----------------------------------------------------------------------------
// 1. 旋转线框几何体 (The "Core" of Nebula)
// -----------------------------------------------------------------------------
const NebulaCore = () => {
  const meshRef = useRef();
  const innerRef = useRef();
  
  useFrame((state) => {
    if (meshRef.current) {
      const t = state.clock.getElapsedTime();
      meshRef.current.rotation.x = Math.sin(t * 0.2) * 0.2;
      meshRef.current.rotation.y = t * 0.15;
      
      // 内层反向旋转
      if(innerRef.current) {
        innerRef.current.rotation.x = Math.cos(t * 0.3) * 0.2;
        innerRef.current.rotation.y = -t * 0.2;
      }
    }
  });

  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
      <group position={[0, 2, 0]}>
        {/* 外层线框 */}
        <Icosahedron args={[2.5, 1]} ref={meshRef}>
          <meshBasicMaterial 
            color="#4f46e5" 
            wireframe 
            transparent 
            opacity={0.15} 
          />
        </Icosahedron>
        
        {/* 内层发光核心 */}
        <Icosahedron args={[1, 0]} ref={innerRef}>
           <meshBasicMaterial color="#8b5cf6" wireframe transparent opacity={0.4} />
        </Icosahedron>
        

         
         {/* 连接线/电波发射效果 (Sparkles) */}
         <Sparkles count={50} scale={4} size={4} speed={0.4} opacity={0.5} color="#00ffff" />
      </group>
    </Float>
  );
};

// -----------------------------------------------------------------------------
// 2. 粒子波浪 (The "Energy Field")
// -----------------------------------------------------------------------------
const WaveShaderMaterial = {
  // ... (Keep existing uniforms)
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(particlesConfig.color) },
    uSize: { value: particlesConfig.size },
    uAmplitude: { value: particlesConfig.amplitude },
    uFrequency: { value: particlesConfig.frequency },
    uSpeed: { value: particlesConfig.speed }
  },
  vertexShader: `
    uniform float uTime;
    uniform float uSize;
    uniform float uAmplitude;
    uniform float uFrequency;
    uniform float uSpeed;
    
    varying float vElevation;

    void main() {
      vec4 modelPosition = modelMatrix * vec4(position, 1.0);
      
      // 波浪算法
      float elevation = sin(modelPosition.x * uFrequency + uTime * uSpeed) * 
                        sin(modelPosition.z * uFrequency * 0.5 + uTime * uSpeed) * 
                        uAmplitude;
                        
      modelPosition.y += elevation;
      vElevation = elevation;

      vec4 viewPosition = viewMatrix * modelPosition;
      vec4 projectedPosition = projectionMatrix * viewPosition;
      
      gl_Position = projectedPosition;
      
      // 粒子大小随距离衰减
      gl_PointSize = uSize * (300.0 / -viewPosition.z);
    }
  `,
  fragmentShader: `
    uniform vec3 uColor;
    varying float vElevation;

    void main() {
      float strength = distance(gl_PointCoord, vec2(0.5));
      strength = 1.0 - strength;
      strength = pow(strength, 10.0);

      vec3 color = uColor;
      color.r += vElevation * 0.5;
      color.b += vElevation * 0.8;

      gl_FragColor = vec4(color, strength);
    }
  `,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending
};

const Particles = () => {
  const ref = useRef();
  
  const isMobile = window.innerWidth < 768;
  const count = isMobile ? particlesConfig.fallback.count : particlesConfig.count;
  const size = isMobile ? particlesConfig.fallback.size : particlesConfig.size;

  const positions = useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // 扩大分布范围，使其成为背景
      positions[i * 3] = (Math.random() - 0.5) * 30;
      positions[i * 3 + 1] = -3 + (Math.random() * 2); // 稍微下沉
      positions[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }
    return positions;
  }, [count]);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(particlesConfig.color) },
    uSize: { value: size },
    uAmplitude: { value: particlesConfig.amplitude },
    uFrequency: { value: particlesConfig.frequency },
    uSpeed: { value: particlesConfig.speed }
  }), [size]);

  useFrame((state) => {
    if (ref.current) {
      ref.current.material.uniforms.uTime.value = state.clock.getElapsedTime();
      // 缓慢旋转粒子场
      ref.current.rotation.y = state.clock.getElapsedTime() * 0.02;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <shaderMaterial attach="material" args={[WaveShaderMaterial]} uniforms={uniforms} />
    </points>
  );
};

// -----------------------------------------------------------------------------
// 3. 主组件
// -----------------------------------------------------------------------------
const WaveParticles = () => {
  const [ready, setReady] = useState(false);

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none">
      <Canvas 
        camera={{ position: [0, 0, 8], fov: 60 }} // 调整相机以适应几何体
        onCreated={() => setReady(true)}
        dpr={[1, 2]} 
        gl={{ antialias: false, alpha: true }} 
        style={{ opacity: ready ? 1 : 0, transition: 'opacity 1.5s ease-in-out' }}
      >
        <fog attach="fog" args={['#000000', 5, 20]} /> {/* 深度雾效 */}
        
        {/* 场景内容 */}
        <NebulaCore />
        <PulseRings />
        <Particles />
        
        {/* 全局漂浮粒子 - 模拟空气中的带电粒子 */}
        <Sparkles count={100} scale={[20, 10, 10]} size={2} speed={0.5} opacity={0.2} color="#ffffff" />
      </Canvas>
      
      {!ready && (
         <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-black z-[-1]" />
      )}
    </div>
  );
};

export default WaveParticles;
