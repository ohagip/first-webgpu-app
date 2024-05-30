;(async () => {
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
  console.log(canvasFormat)
  context.configure({
    device: device,
    format: canvasFormat,
  })

  const encoder = device.createCommandEncoder()
  const pass = encoder.beginRenderPass({
    colorAttachments: [
      {
        view: context.getCurrentTexture().createView(),
        loadOp: 'clear',
        clearValue: { r: 0, g: 0, b: 0.4, a: 1 },
        storeOp: 'store',
      },
    ],
  })
  pass.end()

  // const commandBuffer = encoder.finish()
  // device.queue.submit([commandBuffer])
  device.queue.submit([encoder.finish()])
})()
