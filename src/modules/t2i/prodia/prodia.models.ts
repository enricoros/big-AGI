interface ProdiaModelDescription {
  id: string;
  label: string;
  timeEstimate?: string;
  priority?: number;
  parameters?: string[];
}

export const PRODIA_HARDCODED_MODELS: ProdiaModelDescription[] = [
  {
    id: 'inference.flux.schnell.txt2img.v2',
    label: 'Flux Schnell',
    timeEstimate: '0.20s',
    priority: 100,
    parameters: ['prompt', 'style_preset', 'flux-steps', 'seed', 'width', 'height'],
  },
  {
    id: 'inference.flux.pro11.txt2img.v1',
    label: 'Flux Pro 1.1',
    timeEstimate: '2.5s',
    priority: 75,
    parameters: ['prompt', 'style_preset', 'flux-steps', 'seed', 'width', 'height'],
  },
  {
    id: 'inference.sdxl.txt2img.v1',
    label: 'Stable Diffusion XL',
    timeEstimate: '1.8s',
    priority: 80,
    parameters: ['prompt', 'negative_prompt', 'sdxl-steps', 'guidance_scale', 'seed', 'width', 'height'],
  },
  {
    id: 'inference.sd15.txt2img.v1',
    label: 'Stable Diffusion 1.5',
    timeEstimate: '1.2s',
    priority: 85,
    parameters: ['prompt', 'negative_prompt', 'sdxl-steps', 'seed', 'width', 'height'],
  },
  {
    id: 'inference.flux.dev.txt2img.v1',
    label: 'Flux Dev',
    timeEstimate: '6.5s',
    priority: 65,
    parameters: ['prompt', 'style_preset', 'flux-steps', 'seed', 'width', 'height'],
  },
  {
    id: 'inference.recraft.txt2img.v1',
    label: 'Recraft',
    timeEstimate: '10s',
    priority: 60,
    parameters: ['prompt', 'negative_prompt', 'seed'],
  },
  {
    id: 'inference.kling.txt2vid.v1',
    label: 'Kling (Video)',
    timeEstimate: '5m',
    priority: 50,
    parameters: ['prompt', 'negative_prompt', 'cfg_scale', 'duration'],
  },
];
