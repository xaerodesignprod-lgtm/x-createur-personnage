// api/generate.js - Version "Respect du Croquis" + Prompt Utilisateur
export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  try {
    const { sketch, type, userId, customPrompt } = req.body || {};

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

    // Modèle SD 1.5 Img2Img (Stable et respecte bien la structure)
    const modelVersion = "db21e45d3f7023abc2a46ee38a23973f6dce16bb082a930b0c49861f96d1e5bf";
    
    // Instructions de base
    const baseStyles = {
      turnaround: "character design sheet, clean lines, white background",
      poses: "dynamic pose, full body",
      lipsync: "face closeup, mouth positions",
      expressions: "facial expressions set"
    };

    // Construction du prompt final : Style de base + Ce que l'utilisateur a écrit
    let promptText = baseStyles[type] || baseStyles.turnaround;
    if (customPrompt) {
      promptText += ", " + customPrompt;
    }

    console.log('🚀 Prompt envoyé à l\'IA:', promptText);

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
          prompt: promptText,
          negative_prompt: "sketch, lineart, black and white, unfinished, blurry, ugly, distorted",
          
          // 🗝️ CLÉ DU SUCCÈS :
          // 0.3 à 0.5 = L'IA garde la pose, elle colore juste.
          // 0.7 à 0.9 = L'IA change la pose et invente.
          image_strength: 0.45, 
          
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
