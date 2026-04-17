// api/generate.js - Mode "Coloriste Discipliné"
export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  try {
    const { sketch, type, userId, customPrompt } = req.body || {};

    const validUsers = { 'admin': 'admin123', 'x_story': 'Prod2026', 'x_charact': 'Chara@Gen01', 'x_layout': 'Studio#X99' };
    if (!validUsers[userId]) return res.status(401).json({ error: 'Accès non autorisé' });

    const token = process.env.REPLICATE_API_TOKEN;
    if (!token || token.length < 10) return res.status(500).json({ error: 'Clé API manquante' });

    // Modèle SD 1.5 Img2Img
    const modelVersion = "db21e45d3f7023abc2a46ee38a23973f6dce16bb082a930b0c49861f96d1e5bf";
    
    // 🎨 PROMPTS STRICTS : On demande juste de colorier, pas de réinventer
    const baseStyles = {
      turnaround: "clean color fill, cel shaded, animation style",
      poses: "clean color fill, cel shaded, animation style",
      lipsync: "clean color fill, cel shaded, animation style",
      expressions: "clean color fill, cel shaded, animation style"
    };

    // Construction du prompt : minimaliste pour éviter les hallucinations
    let promptText = baseStyles[type] || baseStyles.turnaround;
    if (customPrompt && customPrompt.trim()) {
      promptText += ", " + customPrompt;
    }

    const startRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: { 'Authorization': `Token ${token.trim()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        version: modelVersion,
        input: {
          image: sketch,
          prompt: promptText,
          
          // 🚫 INTERDICTIONS STRICTES
          negative_prompt: "sketch, lineart, black and white, monochrome, unfinished, rough, draft, blurry, low quality, distorted, extra limbs, text, watermark, signature, realistic, 3d render, photo, different pose, different expression, change anatomy",
          
          // ⚙️ RÉGLAGE CRITIQUE :
          // 0.25 = L'IA ne touche presque pas à la structure, elle colore juste
          // C'est le secret pour respecter votre croquis à 100%
          image_strength: 0.25,
          
          // Plus de steps pour une meilleure qualité de colorisation
          num_inference_steps: 35,
          guidance_scale: 5.0, // Réduit pour moins "forcer" le prompt et plus respecter l'image
          width: 512,
          height: 512
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
      const statusRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, { headers: { 'Authorization': `Token ${token.trim()}` } });
      result = await statusRes.json();
      if (['succeeded', 'failed', 'canceled'].includes(result.status)) break;
    }

    if (result.status !== 'succeeded') return res.status(500).json({ error: `Échec: ${result.error || result.status}` });

    const urls = Array.isArray(result.output) ? result.output : [result.output];
    return res.status(200).json({ success: true, urls });

  } catch (error) {
    console.error('Erreur:', error);
    return res.status(500).json({ error: error.message });
  }
}
