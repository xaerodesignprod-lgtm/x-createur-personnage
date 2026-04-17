// api/generate.js - Version optimisée (mémoire réduite)
export const config = {
  runtime: 'nodejs',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

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

    // Prompts optimisés
    const basePrompt = "character design sheet, clean lines, 2d cartoon style, white background, simple, clear";
    const prompts = {
      turnaround: basePrompt + ", turnaround, front view, side view, back view",
      poses: basePrompt + ", dynamic pose, full body",
      lipsync: basePrompt + ", face closeup, mouth positions",
      expressions: basePrompt + ", facial expressions, emotions"
    };

    // Appel à Replicate avec paramètres RÉDUITS pour éviter l'erreur mémoire
    const startRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: "7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc",
        input: {
          image: sketch,
          prompt: prompts[type] || prompts.turnaround,
          negative_prompt: "blurry, low quality, distorted, ugly",
          width: 512,          // ✅ Réduit de 768 à 512
          height: 512,         // ✅ Réduit de 768 à 512
          num_inference_steps: 15,  // ✅ Réduit de 25 à 15 (plus rapide)
          guidance_scale: 7.5
        }
      })
    });

    if (!startRes.ok) {
      const errData = await startRes.json().catch(() => ({}));
      return res.status(startRes.status).json({ error: `Replicate: ${errData.detail || errData.title}` });
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
