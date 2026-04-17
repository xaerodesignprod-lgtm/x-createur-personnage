// api/generate.js - Agent Character Designer Professionnel
export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  try {
    const { sketch, type, userId, customPrompt } = req.body || {};

    // Vérification des utilisateurs
    const validUsers = { 'admin': 'admin123', 'x_story': 'Prod2026', 'x_charact': 'Chara@Gen01', 'x_layout': 'Studio#X99' };
    if (!validUsers[userId]) return res.status(401).json({ error: 'Accès non autorisé' });

    const token = process.env.REPLICATE_API_TOKEN;
    if (!token || token.length < 10) return res.status(500).json({ error: 'Clé API manquante' });

    // Modèle SD 1.5 optimisé pour l'encrage et la couleur
    const modelVersion = "db21e45d3f7023abc2a46ee38a23973f6dce16bb082a930b0c49861f96d1e5bf";
    
    // 🧠 L'INTELLIGENCE DE L'AGENT
    // 1. Le style de base imposé par l'agent (pour garantir le rendu pro)
    const baseStyle = "professional character design, clean vector lines, cel shaded, vibrant colors, white background, high resolution, masterpiece";
    
    // 2. Le contexte de la pose
    const poseContext = {
      turnaround: "turnaround view, front side back, character sheet",
      poses: "dynamic action pose, full body",
      lipsync: "face closeup, mouth positions",
      expressions: "facial expressions, emotions"
    };

    // 3. Construction du Prompt final
    // L'IA reçoit : (Votre demande) + (Style Pro automatique) + (Contexte de pose)
    let finalPrompt = customPrompt ? customPrompt + ", " : "";
    finalPrompt += baseStyle + ", " + (poseContext[type] || "");

    console.log('🤖 Agent Prompt:', finalPrompt);

    const startRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: { 'Authorization': `Token ${token.trim()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        version: modelVersion,
        input: {
          image: sketch, // Votre croquis
          prompt: finalPrompt,
          // Interdictions strictes pour l'agent
          negative_prompt: "sketch, gray, rough, unfinished, monochrome, blurry, low quality, distorted, ugly",
          
          // ⚙️ RÉGLAGE DE L'AGENT :
          // 0.35 = L'IA est disciplinée. Elle garde votre structure et colorie par-dessus.
          // Si vous trouvez que ça ne colore pas assez, on remontera à 0.40 plus tard.
          image_strength: 0.35, 
          
          num_inference_steps: 30, // Plus de précision
          guidance_scale: 7.5,     // Équilibre prompt/image
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
    
    // Attente de la génération
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
