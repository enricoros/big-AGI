export const prodiaDefaultModelId: string = 'v1-5-pruned-emaonly.ckpt [81761151]'; // for lack of an API

interface ProdiaModelDescription {
  id: string;
  label: string;
  priority?: number;
}

export const HARDCODED_MODELS: { models: ProdiaModelDescription[] } = {
  models: [
    { id: 'sdv1_4.ckpt [7460a6fa]', label: 'Stable Diffusion 1.4', priority: 8 },
    { id: 'v1-5-pruned-emaonly.ckpt [81761151]', label: 'Stable Diffusion 1.5', priority: 9 },
    { id: 'anythingv3_0-pruned.ckpt [2700c435]', label: 'Anything V3.0' },
    { id: 'anything-v4.5-pruned.ckpt [65745d25]', label: 'Anything V4.5' },
    { id: 'analog-diffusion-1.0.ckpt [9ca13f02]', label: 'Analog Diffusion' },
    { id: 'theallys-mix-ii-churned.safetensors [5d9225a4]', label: `TheAlly's Mix II` },
    { id: 'elldreths-vivid-mix.safetensors [342d9d26]', label: `Elldreth's Vivid Mix` },
    { id: 'deliberate_v2.safetensors [10ec4b29]', label: 'Deliberate V2', priority: 5 },
    { id: 'openjourney_V4.ckpt [ca2f377f]', label: 'Openjourney v4' },
    { id: 'dreamlike-diffusion-1.0.safetensors [5c9fd6e0]', label: 'Dreamlike Diffusion' },
    { id: 'dreamlike-diffusion-2.0.safetensors [fdcf65e7]', label: 'Dreamlike Diffusion 2' },
    { id: 'timeless-1.0.ckpt [7c4971d4]', label: 'Timeless' },
    { id: 'dreamshaper_5BakedVae.safetensors [a3fbf318]', label: 'Dreamshaper 5' },
    { id: 'revAnimated_v122.safetensors [3f4fefd9]', label: 'ReV Animated V1.2.2' },
    { id: 'meinamix_meinaV9.safetensors [2ec66ab0]', label: 'MeinaMix Meina V9' },
    { id: 'lyriel_v15.safetensors [65d547c5]', label: 'Lyriel' },
    { id: 'anythingV5_PrtRE.safetensors [893e49b9]', label: 'Anything v5.0' },
    { id: 'dreamshaper_6BakedVae.safetensors [114c8abb]', label: 'Dreamshaper 6' },
    { id: 'AOM3A3_orangemixs.safetensors [9600da17]', label: 'Abyss Orange v3' },
    { id: 'shoninsBeautiful_v10.safetensors [25d8c546]', label: 'Shonin Beautiful People' },
    // New models added below
    { id: 'dreamshaper_7.safetensors [5cf5ae06]', label: 'Dreamshaper 7' },
    { id: 'EimisAnimeDiffusion_V1.ckpt [4f828a15]', label: 'Eimis Anime Diffusion' },
    { id: 'lyriel_v16.safetensors [68fceea2]', label: 'Lyriel v16' },
    { id: 'meinamix_meinaV11.safetensors [b56ce717]', label: 'meinamix meinaV11' },
    { id: 'portraitplus_V1.0.safetensors [1400e684]', label: 'portraitplus V1.0' },
    { id: 'Realistic_Vision_V1.4-pruned-fp16.safetensors [8d21810b]', label: 'Realistic Vision v1.4' },
    { id: 'Realistic_Vision_V4.0.safetensors [29a7afaa]', label: 'Realistic Vision V4.0' },
    { id: 'Realistic_Vision_V2.0.safetensors [79587710]', label: 'Realistic Vision V2.0' },
    { id: 'redshift_diffusion-V10.safetensors [1400e684]', label: 'redshift diffusion V10' },
  ]
    // sort by priority
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0)),
};
