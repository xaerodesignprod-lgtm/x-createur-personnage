// api/generate.js - Backend Vercel complet pour Replicate
export const config = {
  runtime: 'nodejs',
};

export default async function handler(req, res) {
  // Gestion CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  try {
    // Récupération des données
    const { sketch, type, userId } = req.body || {};

    // Vérification utilisateur (doit correspondre au frontend)
    const validUsers = {
      'admin': 'admin123',
      'x_story': 'Prod2026',
      'x_charact': 'Chara@Gen01',
      'x_layout': 'Studio#X99'
    };

    if (!validUsers[userId]) {
      return res.status(401).json({ error: 'Accès non autorisé' });
    }

    // Récupération et vérification de la clé API
    const token = process.env.REPLICATE_API_TOKEN;
    console.log('🔍 [SERVEUR] Token présent ?', !!token);
    console.log('🔍 [SERVEUR] Longueur token ?', token ? token.length : 0);

    if (!token || token.length < 10 || token.includes('YOUR_API_KEY')) {
      console.error('❌ [SERVEUR] Token manquant ou invalide dans Vercel');
      return res.status(500).json({ error: 'Erreur serveur : Clé API Replicate non configurée.' });
    }

    // Prompts optimisés pour un rendu cartoon/net
    const basePrompt = "character design sheet, clean vector lines, 2d cartoon animation style, cel shaded, white background, high quality, sharp focus, professional illustration";
    const prompts = {
      turnaround: basePrompt + ", turnaround view, front view, side view, back view, character model sheet",
      poses: basePrompt + ", dynamic action pose, full body, energetic stance",
      lipsync: basePrompt + ", close up face, mouth positions for animation, phoneme expressions",
      expressions: basePrompt + ", facial expressions set, happy sad angry surprised, character portrait"
    };
    const prompt = prompts[type] || prompts.turnaround;

    // 1. Lancer la prédiction sur Replicate
    console.log('🚀 [SERVEUR] Envoi à Replicate...');
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
          prompt: prompt,
          negative_prompt: "blurry, low quality, distorted, ugly, extra limbs, watermark, text, realistic photo",
          width: 768,
          height: 768,
          num_inference_steps: 25,
          guidance_scale: 7.5
        }
      })
    });

    if (!startRes.ok) {
      const errData = await startRes.json().catch(() => ({}));
      console.error('❌ [SERVEUR] Erreur Replicate start:', startRes.status, errData);
      return res.status(startRes.status).json({ error: `Replicate: ${errData.detail || errData.title || 'Erreur API'}` });
    }

    const prediction = await startRes.json();
    console.log('🎫 [SERVEUR] Prediction ID:', prediction.id);

    // 2. Attendre la fin de la génération (polling)
    let result;
    let attempts = 0;
    const maxAttempts = 40; // Max ~80 secondes

    while (attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 2000));
      attempts++;

      const statusRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { 'Authorization': `Token ${token.trim()}` }
      });

      if (!statusRes.ok) throw new Error(`Erreur status Replicate: ${statusRes.status}`);
      
      result = await statusRes.json();
      if (result.status === 'succeeded' || result.status === 'failed' || result.status === 'canceled') break;
    }

    if (result.status !== 'succeeded') {
      console.error('❌ [SERVEUR] Génération échouée:', result.error || result.status);
      return res.status(500).json({ error: `Échec: ${result.error || result.status}` });
    }

    console.log('✅ [SERVEUR] Succès ! URLs:', result.output);
    const urls = Array.isArray(result.output) ? result.output : [result.output];

    // 3. Retourner les résultats au frontend
    return res.status(200).json({ success: true, urls });

  } catch (error) {
    console.error('💥 [SERVEUR] Erreur critique:', error);
    return res.status(500).json({ error: error.message || 'Erreur interne' });
  }
}
