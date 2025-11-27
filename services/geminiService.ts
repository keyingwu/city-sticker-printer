import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Tourist-Oriented Aspect Model (v3)
// All aspects are things a VISITOR would notice, buy, or experience.
// Each one should still generate ONE clear subject for the sticker.

const CITY_ASPECTS = [
  {
    dimension: "postcard-landmark",
    instruction:
      "pick ONE random postcard-famous landmark or view in this city, shown as ONE simplified element (for example just the tower, gate, bridge, dome, main square statue). If the city is not globally famous, imagine a typical town-square landmark or historic building that would appear on a postcard for this region."
  },
  {
    dimension: "must-try-food-or-drink",
    instruction:
      "pick ONE iconic local food or drink in this city, shown as a single serving (plate, cone, cup, glass) with no table, no restaurant interior, no second dish. If you are unsure, choose a typical food or drink from the country or region that visitors would likely try first."
  },
  {
    dimension: "street-signature",
    instruction:
      "pick ONE small street-level detail that tourists notice and photograph in this city, Show only this object, with no surrounding buildings or crowd."
  },
];


const STYLES = [ 
  "classic bold vector sticker", 
"satirical caricature illustration", 
"funny cartoon style", 
"bold line art with flat colors", 
"retro souvenir decal style" 
];
/**
 * Removes the black background from the generated image using a flood-fill algorithm.
 * This creates a true "die-cut" sticker with a white border.
 */
const processImageWithTransparency = (imageSrc: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('No canvas context'));

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const w = canvas.width;
      const h = canvas.height;

      // Flood Fill Algorithm to remove black background
      // We start from the 4 corners, assuming the background touches them.
      const stack: [number, number][] = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]];
      const visited = new Int8Array(w * h); // 0 = unvisited, 1 = visited

      // Helper to check if a pixel is "Black-ish" (Background)
      // Threshold: 40/255 allows for slight compression artifacts
      const isBackground = (idx: number) => {
        return data[idx] < 40 && data[idx + 1] < 40 && data[idx + 2] < 40;
      };

      while (stack.length > 0) {
        const [x, y] = stack.pop()!;
        const pixelIndex = y * w + x;

        if (visited[pixelIndex]) continue;
        visited[pixelIndex] = 1;

        const dataIndex = pixelIndex * 4;

        if (isBackground(dataIndex)) {
          // Turn pixel transparent
          data[dataIndex + 3] = 0; 

          // Check neighbors
          if (x > 0) stack.push([x - 1, y]);
          if (x < w - 1) stack.push([x + 1, y]);
          if (y > 0) stack.push([x, y - 1]);
          if (y < h - 1) stack.push([x, y + 1]);
        }
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL());
    };
    img.onerror = () => reject(new Error("Failed to load image for processing"));
    img.src = imageSrc;
  });
};

export const generateCitySticker = async (city: string, attemptIndex: number = 0): Promise<string> => {
  try {
    const model = 'gemini-2.5-flash-image';
    // const model = 'gemini-3-pro-image-preview';
    
    // Select Aspect based on rotation index
    const aspect = CITY_ASPECTS[attemptIndex % CITY_ASPECTS.length];
    
    const randomStyle = STYLES[Math.floor(Math.random() * STYLES.length)];
    const seed = Date.now();

    // We ask for a SOLID BLACK background so we can computationally remove it later.
    // We ask for a THICK WHITE BORDER to create the die-cut physical object look.
    const prompt = `
      Design a funny souvenir sticker for: ${city}.
      
      SUBJECT CONSTRAINT:
      The sticker MUST represent: ${aspect.instruction}.
      Aspect Category: ${aspect.dimension}
      
      CRITICAL RULES:
      - Choose THE most stereotypical, immediately recognizable example from ${city} for this aspect.
      - Avoid generic ideas; pick something specific that locals and tourists would both recognize.
      - EXACTLY ONE clear main subject (one character OR one object).
      
      STYLE:
      - ${randomStyle}
      
      DIE-CUT LAYOUT (CRITICAL):
      1. THICK WHITE OUTLINE around the entire subject
      2. SOLID BLACK (#000000) background
      3. High contrast, no shadows on background
      4. Center the subject
      
      Seed: ${seed}
    `;



    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [{ text: prompt }]
      }
    });

    let rawImageUrl = '';

    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          rawImageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          break;
        }
      }
    }

    if (!rawImageUrl) {
      throw new Error("No image data found in response");
    }

    // Process the image to make it transparent
    const processedUrl = await processImageWithTransparency(rawImageUrl);
    return processedUrl;

  } catch (error) {
    console.error("Error generating sticker:", error);
    throw error;
  }
};
