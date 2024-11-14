;(async () => {
  const GRID_SIZE = 32
  const UPDATE_INTERVAL = 200
  let step = 0

  const canvas = document.querySelector<HTMLCanvasElement>('canvas')!

  if (!navigator.gpu) {
    throw new Error('このブラウザではWebGPUはサポートされていません。')
  }

  const adapter = await navigator.gpu.requestAdapter()
  console.log(adapter)
  if (!adapter) {
    throw new Error('GPUAdapterがみつかりません。')
  }

  const device = await adapter.requestDevice()
  console.log(device)

  const context = canvas.getContext('webgpu')
  if (!context) {
    throw new Error('contextがみつかりません。')
  }
  console.log(context)

  const canvasFormat = navigator.gpu.getPreferredCanvasFormat()
  console.log('canvasFormat', canvasFormat)
  context.configure({
    device: device,
    format: canvasFormat,
  })

  // prettier-ignore
  const vertices = new Float32Array([
    //   X,    Y,
    -0.8, -0.8, // Triangle 1 (Blue)
    0.8, -0.8,
    0.8,  0.8,

    -0.8, -0.8, // Triangle 2 (Red)
    0.8,  0.8,
    -0.8,  0.8,
  ])

  const vertexBuffer = device.createBuffer({
    label: 'Cell vertices',
    size: vertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  })
  console.log(vertexBuffer)
  device.queue.writeBuffer(vertexBuffer, 0, vertices)

  const vertexBufferLayout = {
    arrayStride: 8,
    attributes: [
      {
        format: 'float32x2',
        offset: 0,
        shaderLocation: 0, // Position, see vertex shader
      },
    ],
  }

  const cellShaderModule = device.createShaderModule({
    label: 'Cell shader',
    code: `
      struct VertexInput {
        @location(0) pos: vec2f,
        @builtin(instance_index) instance: u32,
      };
      
      struct VertexOutput {
        @builtin(position) pos: vec4f,
        @location(0) cell: vec2f,
      };
      
      struct FragInput {
        @location(0) cell: vec2f,
      };
      
      @group(0) @binding(0) var<uniform> grid: vec2f;
      @group(0) @binding(1) var<storage> cellState: array<u32>;
      
      @vertex
      fn vertexMain(input: VertexInput) -> VertexOutput {
        let i = f32(input.instance);
        let cell = vec2f(i % grid.x, floor(i / grid.x));
        let state = f32(cellState[input.instance]);
        
        let cellOffset = cell / grid * 2;
        // let gridPos = (input.pos + 1) / grid - 1 + cellOffset;
        let gridPos = (input.pos*state+1) / grid - 1 + cellOffset;
        
        var output: VertexOutput;
        output.pos = vec4f(gridPos, 0, 1);
        output.cell = cell;
        return output;
      }
      
      @fragment
      fn fragmentMain(input: FragInput) -> @location(0) vec4f {
        let c = input.cell / grid;
        return vec4f(c, 1-c.x, 1);
      }
    `,
  })

  const cellPipeline = device.createRenderPipeline({
    label: 'Cell pipeline',
    layout: 'auto',
    vertex: {
      module: cellShaderModule,
      entryPoint: 'vertexMain',
      buffers: [vertexBufferLayout],
    },
    fragment: {
      module: cellShaderModule,
      entryPoint: 'fragmentMain',
      targets: [
        {
          format: canvasFormat,
        },
      ],
    },
  })

  // グリッドのユニフォームバッファ作成
  const uniformArray = new Float32Array([GRID_SIZE, GRID_SIZE])
  const uniformBuffer = device.createBuffer({
    label: 'Grid Uniforms',
    size: uniformArray.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })
  device.queue.writeBuffer(uniformBuffer, 0, uniformArray)

  // セルの状態を保持するストレージバッファ作成
  const cellStateArray = new Uint32Array(GRID_SIZE * GRID_SIZE)
  const cellStateStorage = [
    device.createBuffer({
      label: 'Cell State A',
      size: cellStateArray.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    }),
    device.createBuffer({
      label: 'Cell State B',
      size: cellStateArray.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    }),
  ]

  for (let i = 0; i < cellStateArray.length; i += 3) {
    cellStateArray[i] = 1
  }
  device.queue.writeBuffer(cellStateStorage[0], 0, cellStateArray)

  for (let i = 0; i < cellStateArray.length; i++) {
    cellStateArray[i] = i % 2
  }
  device.queue.writeBuffer(cellStateStorage[1], 0, cellStateArray)

  // バインドグループ作成
  const bindGroups = [
    device.createBindGroup({
      label: 'Cell renderer bind group A',
      layout: cellPipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: { buffer: uniformBuffer },
        },
        {
          binding: 1,
          resource: { buffer: cellStateStorage[0] },
        },
      ],
    }),
    device.createBindGroup({
      label: 'Cell renderer bind group B',
      layout: cellPipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: { buffer: uniformBuffer },
        },
        {
          binding: 1,
          resource: { buffer: cellStateStorage[1] },
        },
      ],
    }),
  ]

  function updateGrid() {
    step += 1

    const encoder = device.createCommandEncoder()
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          loadOp: 'clear',
          clearValue: { r: 0, g: 0, b: 0.4, a: 1.0 },
          storeOp: 'store',
        },
      ],
    })

    pass.setPipeline(cellPipeline)
    pass.setBindGroup(0, bindGroups[step % 2]) // Updated!
    pass.setVertexBuffer(0, vertexBuffer)
    pass.draw(vertices.length / 2, GRID_SIZE * GRID_SIZE)

    pass.end()
    device.queue.submit([encoder.finish()])
  }

  setInterval(updateGrid, UPDATE_INTERVAL)
})()
