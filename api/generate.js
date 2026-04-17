// api/generate.js - Version stable Node.js pour Vercel
export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    const { sketch, type, userId } = req.body || await req.json();
    const token = process.env.REPLICATE_API_TOKEN;

    // 🔍 LOG SERVEUR (visible dans Vercel -> Fonctions -> Logs)
    console.log('🔑 [SERVEUR] Token présent ?', !!token);
    console.log('🔑 [SERVEUR] Longueur du token ?', token ? token.length : 0);

    if (!token || token.length < 10) {
      return res.status(500).json({ error: 'Clé API manquante ou invalide dans Vercel.' });
    }

    // 1. Lancer une prédiction test simple
    const testRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: '7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc',
        input: { prompt: 'test sketch', width: 256, height: 256, num_inference_steps: 1 }
      // Prompts optimisés pour un rendu "Cartoon/Animation" net et propre
    const prompts = {
      turnaround: "character design sheet, turnaround, front view, side view, back view, clean vector lines, cel shaded, 2d animation style, white background, high quality, sharp focus, simple background --v 2",
      
      poses: "character dynamic pose, full body, action stance, clean lineart, 2d cartoon style, vibrant colors, white background, sharp details --v 2",
      
      lipsync: "character face close-up, front view, mouth open, speaking expression, 2d animation style, clean lines, cel shaded, white background --v 2",
      
      expressions: "character facial expressions, happy, sad, angry, surprised, character sheet, 2d cartoon style, clean vector lines, white background --v 2"
    };;

    if (!testRes.ok) {
      const errData = await testRes.json();
      console.error('❌ [SERVEUR] Erreur Replicate:', errData);
      return res.status(testRes.status).json({ error: `Replicate: ${errData.detail || errData.title}` });
    }

    const prediction = await testRes.json();
    console.log('🎫 [SERVEUR] Prediction ID:', prediction.id);

    // 2. Attendre la fin (polling)
    let result;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const statusRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { 'Authorization': `Bearer ${token.trim()}` }
      });
      result = await statusRes.json();
      if (['succeeded', 'failed', 'canceled'].includes(result.status)) break;
    }

    if (result.status !== 'succeeded') {
      return res.status(500).json({ error: `Génération échouée: ${result.error || result.status}` });
    }

    // 3. Retourner les URLs
    res.status(200).json({ 
      success: true, 
      urls: Array.isArray(result.output) ? result.output : [result.output] 
    });

  } catch (err) {
    console.error('💥 [SERVEUR] Crash:', err);
    res.status(500).json({ error: err.message });
  }
}
