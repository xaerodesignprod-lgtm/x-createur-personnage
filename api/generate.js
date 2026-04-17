// api/generate.js - Modèle léger SD 1.5 (pas d'erreur mémoire)
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

    // ✅ MODÈLE LÉGER SD 1.5 - Pas d'erreur mémoire
    const modelVersion = "45c443e3578680a3e3c0533f3381a5f8d1e148f0";
    
    const prompts = {
      turnaround: "character design sheet, full color, turnaround, front side back, vibrant colors, cel shaded, cartoon style, clean lines, white background, professional",
      poses: "character dynamic pose, full color, vibrant colors, cel shaded, cartoon style, clean lines, white background, professional",
      lipsync: "character face closeup, mouth positions, full color, vibrant colors, cel shaded, cartoon style, clean lines",
      expressions: "character facial expressions, emotions, full color, vibrant colors, cel shaded, cartoon style, clean lines"
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
          negative_prompt: "sketch, lineart, black and white, grayscale, blurry, low quality, distorted",
          
          // Paramètres optimisés pour modèle léger
          image_strength: 0.7,      // Transformation suffisante pour couleur
          num_inference_steps: 25,  // Qualité correcte
          guidance_scale: 7.5,
          width: 512,               // Résolution légère
          height: 512,
          scheduler: "DPMSolverMultistep"
        }
      })
    });

    if (!startRes.ok) {
      const err = await startRes.json().catch(() => ({}));
      return res.status(startRes.status).json({ error: `Replicate: ${err.detail || err.title}` });
    }

    const prediction = await startRes.json();

    let result;
    for (let i = 0; i < 40; i++) {
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
