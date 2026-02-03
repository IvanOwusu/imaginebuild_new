import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { ArchitecturalDesign, DesignPreferences } from "../types";

// Helper to extract base64 from Gemini response parts
const extractImage = (response: any) => {
  const candidates = response.candidates || [];
  if (!candidates[0]?.content?.parts) return null;
  const part = candidates[0].content.parts.find((p: any) => p.inlineData);
  return part?.inlineData ? `data:image/png;base64,${part.inlineData.data}` : null;
};

// Helper to safely parse base64 data and mime type
const parseBase64 = (base64String: string) => {
  const cleanString = base64String.replace(/\s/g, '');
  const matches = cleanString.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
  if (matches && matches.length === 3) {
    return { mimeType: matches[1], data: matches[2] };
  }
  
  let mimeType = 'image/jpeg';
  let data = cleanString;
  if (cleanString.includes(',')) {
    const parts = cleanString.split(',');
    const headerMatch = parts[0].match(/data:([^;]+)/);
    if (headerMatch) mimeType = headerMatch[headerMatch.length - 1];
    data = parts.slice(1).join(',');
  }
  return { mimeType, data };
};

// 1. Contextual Site & Context Discovery - Optimized for Speed
export const analyzeSite = async (base64Image: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const { mimeType, data } = parseBase64(base64Image);
  if (!data) throw new Error("Invalid image data");

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      {
        parts: [
          { inlineData: { data: data, mimeType: mimeType } },
          { text: "Analyze this photo of a building/land. 1. Identify terrain/geographic markers. 2. Suggest local architectural styles. 3. List design principles. Be technical but extremely concise." }
        ]
      }
    ],
    config: { 
      systemInstruction: "You are an expert architectural site analyst. Provide technical, grounded analysis based on visual evidence. Use Google Search only if specific local regulations are needed.",
      tools: [{ googleSearch: {} }],
      thinkingConfig: { thinkingBudget: 0 }
    }
  });
  
  const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
    title: chunk.web?.title || "Architectural Source",
    uri: chunk.web?.uri
  })).filter((s: any) => s.uri) || [];

  return {
    analysis: response.text || "Site analysis finalized.",
    references: sources
  };
};

// 2. Expert Consultation Chat - Optimized for Latency and Clean Presentation
export const askArchitect = async (message: string, history: any[]) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.content }] })),
      { role: 'user', parts: [{ text: message }] }
    ],
    config: { 
      systemInstruction: `You are Imaginebuild Lead Architect. Provide expert architectural advice.
      STRICT RULES:
      - NEVER use markdown bolding (double asterisks **).
      - NEVER use markdown headers (#).
      - Keep responses extremely short (max 2-3 sentences).
      - Use plain text only.
      - If listing, use simple dashes (-) on new lines.
      - Be punchy, professional, and elegant.
      
      Developer Info (only if asked):
      - Developer: Ivan Owusu
      - Email: ivanowusu3@gmail.com
      - Phone: +233548403607
      - Socials: LinkedIn (ivan-owusu), X (Ivantheson95)`,
      tools: [{ googleSearch: {} }],
      thinkingConfig: { thinkingBudget: 0 }
    }
  });

  const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => chunk.web?.uri).filter(Boolean) || [];
  return { text: response.text, sources };
};

// 3. AI-Driven Visual Simulations based on Real-world data
export const promptEditImage = async (base64Image: string, prompt: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const { mimeType, data } = parseBase64(base64Image);

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { inlineData: { data: data, mimeType: mimeType } },
        { text: `Modify this actual site photo to simulate a ${prompt}. Ensure structural integrity is maintained while replacing buildings with realistic architectural designs.` }
      ]
    }
  });
  return extractImage(response) || base64Image;
};

// 4. Real-world Inspired Concept Synthesis
export const generateDesignConcept = async (
  base64Image: string, 
  preferences: DesignPreferences,
  siteDiscovery: { analysis: string, references: any[] }
): Promise<ArchitecturalDesign> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const { mimeType, data } = parseBase64(base64Image);
  
  const prompt = `Based on the Site Discovery Analysis: ${siteDiscovery.analysis}. 
  Synthesize a ${preferences.style} ${preferences.type} design. 
  CRITICAL: You MUST incorporate logic from these references: ${siteDiscovery.references.map(r => r.uri).join(', ')}.
  Return valid JSON matching the specified schema.`;

  const conceptResponse: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      systemInstruction: "You are an expert architectural concept synthesiser. Always produce valid JSON that adheres strictly to the defined schema and site analysis.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          description: { type: Type.STRING },
          floorPlanJson: {
            type: Type.OBJECT,
            properties: {
              rooms: { 
                type: Type.ARRAY, 
                items: { 
                  type: Type.OBJECT, 
                  properties: { 
                    name: { type: Type.STRING }, 
                    size: { type: Type.STRING }, 
                    description: { type: Type.STRING } 
                  } 
                } 
              },
              totalArea: { type: Type.STRING }
            }
          },
          costs: {
            type: Type.OBJECT,
            properties: {
              estimatedTotal: { type: Type.NUMBER },
              breakdown: { 
                type: Type.ARRAY, 
                items: { 
                  type: Type.OBJECT, 
                  properties: { item: { type: Type.STRING }, cost: { type: Type.NUMBER } } 
                } 
              }
            }
          }
        },
        required: ["name", "description", "floorPlanJson", "costs"]
      },
      thinkingConfig: { thinkingBudget: 0 }
    }
  });

  let designData;
  try {
    designData = JSON.parse(conceptResponse.text || "{}");
  } catch (e) {
    designData = {};
  }
  
  const finalizedDesignData = {
    name: designData.name || "Real-World Synthesis Design",
    description: designData.description || "Synthesized simulation based on real-world architectural data.",
    floorPlanJson: designData.floorPlanJson || { rooms: [], totalArea: "N/A", analysis: "" },
    costs: designData.costs || { estimatedTotal: 0, breakdown: [] },
  };

  const materialsString = preferences.materials.join(", ");
  const [extRes, planRes] = await Promise.all([
    ai.models.generateContent({ 
      model: 'gemini-2.5-flash-image', 
      contents: { 
        parts: [
          { inlineData: { data: data, mimeType: mimeType } },
          { text: `A realistic architectural simulation of ${finalizedDesignData.name}. Style: ${preferences.style}. Materials: ${materialsString}. Maintain horizon line and terrain.` }
        ] 
      }, 
      config: { imageConfig: { aspectRatio: "16:9" } } 
    }),
    ai.models.generateContent({ 
      model: 'gemini-2.5-flash-image', 
      contents: { 
        parts: [
          { inlineData: { data: data, mimeType: mimeType } },
          { text: `2D architectural site plan for ${finalizedDesignData.name} integrated into the terrain.` }
        ] 
      }, 
      config: { imageConfig: { aspectRatio: "4:3" } } 
    })
  ]).catch(() => [null, null]);

  return {
    ...finalizedDesignData,
    id: Math.random().toString(36).substring(2, 11),
    siteAnalysis: siteDiscovery.analysis,
    preferences,
    createdAt: new Date().toISOString(),
    versions: [],
    visualizations: {
      exterior: extractImage(extRes) || "https://images.unsplash.com/photo-1600585154340-be6161a56a0c",
      interior: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0",
      plan: extractImage(planRes) || "https://images.unsplash.com/photo-1503387762-592deb58ef4e"
    }
  };
};

export const generate3DModelFile = async (design: ArchitecturalDesign): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Generate raw .obj file for: ${design.name}. v, vt, vn, f lines only.`
  });
  return response.text || "";
};

export const generateGLTFModelFile = async (design: ArchitecturalDesign): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Generate GLTF 2.0 JSON for: ${design.name}. Raw JSON only.`
  });
  return response.text || "{}";
};

export const getTutorialContent = async (featureKey: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Explain how to use the "${featureKey}" feature. Output exactly ONE short, direct sentence under 12 words. No technical jargon.`
  });
  return response.text || "Capture your site to begin.";
};
