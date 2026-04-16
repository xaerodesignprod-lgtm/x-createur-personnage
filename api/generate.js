// api/generate.js - Backend Vercel pour génération IA via Replicate
export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Méthode non autorisée' }), { 
      status: 405, headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { sketch, type, userId } = await req.json();

    // Vérification sécurité basique
    const validUsers = {
      'admin': 'admin123',
      'prod_user_001': 'anim2026',
      'marie_story': 'Prod2026!',
      'lucas_anim': 'Chara@Gen01',
      'sarah_direct': 'Studio#X99'
    };

    if (!validUsers[userId]) {
      return new Response(JSON.stringify({ error: 'Accès non autorisé' }), { 
        status: 401, headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) throw new Error('Clé API manquante');

    // Prompts selon le type demandé
    const prompts = {
      turnaround: 'character sheet, turnaround view, front side back, clean lines, cartoon style, white background',
      poses: 'character dynamic pose, action stance, clean lines, cartoon style, white background',
      lipsync: 'character face closeup, mouth positions animation, clean lines, white background',
      expressions: 'character facial expressions set, emotions, clean lines, cartoon style'
    };

    // Appel API Replicate
    const res = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: '345035d2a3d6c3c09d95f4e36b00d433e3f2a2c3f4d5e6f7', // Modèle SDXL + ControlNet Scribble
        input: {
          image: sketch,
          prompt: prompts[type] || prompts.turnaround,
          controlnet_conditioning_scale: 0.7,
          num_inference_steps: 25
        }
      })
    });

    if (!res.ok) throw new Error('Erreur API Replicate');
    const prediction = await res.json();

    // Attendre la fin de la génération
    let result;
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const status = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { 'Authorization': `Token ${token}` }
      });
      result = await status.json();
      if (result.status === 'succeeded' || result.status === 'failed') break;
    }

    if (result.status !== 'succeeded') throw new Error('Échec génération IA');

    return new Response(JSON.stringify({ 
      success: true, 
      urls: Array.isArray(result.output) ? result.output : [result.output] 
    }), { headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
