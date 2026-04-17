// api/generate.js - Modèle img2img pour transformation croquis → couleur
export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  try {
    const { sketch, type, userId } = req.body || {};

    const validUsers = {
      'admin': 'admin123',
      'x_story': 'Prod2026',
      'x_charact': 'Chara@Gen01',
      'x_layout': 'Studio#X99'
    };

    if (!validUsers[userId]) {
      return res.status(401).json({ error: 'Accès non autorisé' });
    }

    const token = process.env.REPLICATE_API_TOKEN;
    if (!token || token.length < 10) {
      return res.status(500).json({ error: 'Clé API manquante' });
    }

    // ✅ MODÈLE SDXL IMG2IMG - Parfait pour transformer croquis en couleur
    const modelVersion = "39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b";
    
    // Prompts TRÈS insistants sur la couleur et le fini
    const prompts = {
      turnaround: "FULL COLOR character design sheet, turnaround view, front side back, vibrant colors, cel shaded, professional animation style, clean finished illustration, colored, not a sketch, white background",
      poses: "FULL COLOR character, dynamic pose, vibrant colors, cel shaded, professional animation style, clean finished illustration, colored, not a sketch, white background",
      lipsync: "FULL COLOR character face, mouth positions, vibrant colors, cel shaded, professional animation style, clean finished illustration, colored, not a sketch",
      expressions: "FULL COLOR character faces, emotions set, vibrant colors, cel shaded, professional animation style, clean finished illustration, colored, not a sketch"
    };

    const startRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: modelVersion,
        input: {
          image: sketch,
          prompt: prompts[type] || prompts.turnaround,
          negative_prompt: "sketch, lineart, black and white, grayscale, unfinished, rough, draft, blurry, low quality",
          
          // 🎨 PARAMÈTRES CLÉS POUR LA COULEUR :
          image_strength: 0.65,  // Force de transformation (0.5-0.75 idéal)
          num_inference_steps: 30,
          guidance_scale: 7.5,
          width: 768,
          height: 768,
          scheduler: "DPMSolverMultistep",
          seed: null  // Aléatoire pour plus de variété
        }
      })
    });

    if (!startRes.ok) {
      const err = await startRes.json().catch(() => ({}));
      return res.status(startRes.status).json({ error: `Replicate: ${err.detail || err.title}` });
    }

    const prediction = await startRes.json();

    let result;
    for (let i = 0; i < 50; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const statusRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { 'Authorization': `Token ${token.trim()}` }
      });
      result = await statusRes.json();
      if (['succeeded', 'failed', 'canceled'].includes(result.status)) break;
    }

    if (result.status !== 'succeeded') {
      return res.status(500).json({ error: `Échec: ${result.error || result.status}` });
    }

    const urls = Array.isArray(result.output) ? result.output : [result.output];
    return res.status(200).json({ success: true, urls });

  } catch (error) {
    console.error('Erreur:', error);
    return res.status(500).json({ error: error.message });
  }
}
