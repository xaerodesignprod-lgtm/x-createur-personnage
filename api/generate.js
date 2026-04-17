// api/generate.js - Version "ControlNet Scribble" pour respecter le croquis
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

    // 🌟 MODÈLE SPÉCIAL "SKETCH TO FINISHED IMAGE"
    // Ce modèle est conçu pour respecter la forme du croquis
    const modelVersion = "7368803268620124404542032748645266415110665456786316255440421465";
    
    // Prompts orientés "Finition" et non "Création"
    const prompts = {
      turnaround: "professional character design sheet, turnaround, clean lineart, flat color, cel shaded, white background, 2d animation style, simple, high quality",
      poses: "character dynamic pose, full body, clean lineart, flat color, cel shaded, 2d animation style, white background",
      lipsync: "character face closeup, mouth positions, clean lineart, flat color, 2d animation style, white background",
      expressions: "character facial expressions, emotions set, clean lineart, flat color, 2d animation style, white background"
    };

    // Appel à Replicate avec paramètres ControlNet
    const startRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: modelVersion,
        input: {
          image: sketch, // Votre croquis
          prompt: prompts[type] || prompts.turnaround,
          negative_prompt: "blurry, low quality, distorted, ugly, realistic, 3d, photo, shading",
          
          // 🗝️ LE SECRET : Scale élevé = L'IA OBEIT AU CROQUIS
          controlnet_conditioning_scale: 1.5, 
          
          // Qualité suffisante sans surcharger la mémoire
          num_inference_steps: 25,
          guidance_scale: 7.5,
          width: 512,
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

    // Attendre la fin
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
