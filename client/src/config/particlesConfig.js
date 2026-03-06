// 动效参数配置文件
export const particlesConfig = {
    // 粒子数量
    count: 3000,
    // 粒子大小
    size: 0.05,
    // 粒子颜色
    color: '#00ffff',
    // 动画速度
    speed: 0.3,
    // 波动振幅
    amplitude: 0.8,
    // 波动频率
    frequency: 1.2,
    // 交互响应范围
    interactionRadius: 2.0,
    // 降级模式配置 (移动端或低性能设备)
    fallback: {
        count: 1000,
        size: 0.06
    }
};

export const performanceReport = {
    targetFPS: 60,
    maxDrawCalls: 1, // 使用 InstancedMesh 或 ShaderMaterial 确保只有 1 次 Draw Call
    vertexCount: 2000,
    loadTimeBudget: 300, // ms
    strategy: "GPU Vertex Displacement Shader"
};
