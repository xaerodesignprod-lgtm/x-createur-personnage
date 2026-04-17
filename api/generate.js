// api/generate.js - Assistant de Finition (Sketch Refiner)
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

    // Modèle SDXL optimisé pour la finition de croquis (refinement)
    const modelVersion = "39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea5355255b1aa35c5565e08b";
    
    // 🎨 CONSTRUCTION DU PROMPT "FINITION PRO"
    // On ne décrit PAS la pose (elle vient du croquis)
    // On décrit le STYLE, les MATIÈRES et la QUALITÉ du rendu
    const styleTags = "professional character design, clean sharp lineart, cel shaded, flat colors, animation style, white background, high resolution, masterpiece";
    
    let finalPrompt = styleTags;
    if (customPrompt && customPrompt.trim()) {
      // L'utilisateur ajoute juste les matières/couleurs (ex: "tissu rouge, bottes en cuir, cape bleue")
      finalPrompt += ", " + customPrompt;
    }

    const startRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: { 'Authorization': `Token ${token.trim()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        version: modelVersion,
        input: {
          image: sketch,
          prompt: finalPrompt,
          
          // 🚫 INTERDICTIONS STRICTES (Empêche l'IA de réinventer)
          negative_prompt: "sketch, rough, unfinished, monochrome, blurry, low quality, distorted, extra limbs, text, watermark, signature, realistic, photo, 3d render, change pose, change expression, different anatomy, messy lines",
          
          // ⚙️ RÉGLAGES CLÉS POUR LA FINITION (Le "Sweet Spot")
          
          // 1. Strength 0.45 : L'IA a assez de liberté pour nettoyer les traits et poser les couleurs,
          //    mais pas assez pour modifier la pose ou l'expression.
          image_strength: 0.45,
          
          // 2. Guidance 6.0 : Équilibre parfait. L'IA écoute le prompt pour le style/couleurs,
          //    mais respecte l'image source pour la structure.
          guidance_scale: 6.0,
          
          // 3. Steps 30 : Suffisant pour un rendu propre sans surcharge mémoire
          num_inference_steps: 30,
          
          width: 768,
          height: 768,
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
