// api/generate.js - ControlNet Scribble (Respect TOTAL du croquis)
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

    // ✅ MODÈLE CONTROLNET SCRIBBLE - SPÉCIALISÉ POUR RESPECTER LES CROQUIS
    const modelVersion = "854e8727697a057c525cdb45ab037f64ecca770a1769cc52287c2e56472a247b";
    
    // Prompts simples pour la colorisation
    const colorStyles = {
      turnaround: "clean color fill, cel shaded, character design, white background",
      poses: "clean color fill, cel shaded, character design, white background",
      lipsync: "clean color fill, cel shaded, character design",
      expressions: "clean color fill, cel shaded, character design"
    };

    let promptText = colorStyles[type] || colorStyles.turnaround;
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
          negative_prompt: "sketch, lineart, black and white, monochrome, unfinished",
          
          // 🎯 CONTRÔLE TOTAL :
          // ControlNet va extraire les traits du croquis et les imposer à l'IA
          controlnet_conditioning_scale: 1.0, // Force maximale de respect du croquis
          
          num_inference_steps: 25,
          guidance_scale: 7.5,
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
