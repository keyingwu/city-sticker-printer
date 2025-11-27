import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// CITY ASPECTS
// Used to guide the AI's "lens" for concept generation.
// We rotate through these to ensure semantic variety.
const CITY_ASPECTS = [
  {
    dimension: "iconic-landmark",
    instruction: "A famous building, statue, or physical structure. Focus on a single architectural element."
  },
  {
    dimension: "local-food",
    instruction: "A specific local dish, street food, or beverage. Focus on a single serving."
  },
  {
    dimension: "local-fauna",
    instruction: "A local animal, pest, or pet associated with the city (e.g., NYC rat, Tokyo Shiba Inu)."
  },
  {
    dimension: "transportation",
    instruction: "A vehicle or mode of transit specific to this city (e.g., Yellow Cab, Gondola, Tuk-Tuk)."
  },
  {
    dimension: "street-object",
    instruction: "A small object found on the street (e.g., Fire Hydrant, Postbox, Street Sign)."
  },
  {
    dimension: "local-stereotype",
    instruction: "A humorous caricature of a typical local resident or tourist behavior."
  }
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
      // Seed from the entire outer border to catch stickers touching any edge
      const stack: [number, number][] = [];
      
      // Top & Bottom rows
      for (let x = 0; x < w; x++) {
          stack.push([x, 0]);
          stack.push([x, h - 1]);
      }
      // Left & Right cols
      for (let y = 0; y < h; y++) {
          stack.push([0, y]);
          stack.push([w - 1, y]);
      }

      const visited = new Int8Array(w * h); // 0 = unvisited, 1 = visited

      // Helper to check if a pixel is "Black-ish" (Background)
      // Increased Threshold to 60 to catch compression artifacts/dark grays
      const isBackground = (idx: number) => {
        return data[idx] < 60 && data[idx + 1] < 60 && data[idx + 2] < 60;
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

/**
 * STEP 1: GENERATE CONCEPT (Text Model)
 * Generates a specific subject description, checking history to avoid repetition.
 */
const generateConcept = async (city: string, aspect: typeof CITY_ASPECTS[0], history: string[]): Promise<string> => {
    const prompt = `
        Role: Creative Director for a funny sticker app.
        Task: Brainstorm ONE specific visual subject for a sticker.
        
        Subject: ${city}
        
        AVOID these concepts (already generated):
        ${history.map(h => `- ${h}`).join('\n')}
        
        Rules:
        1. Return ONLY the short visual description (max 10 words).
        2. Be specific (e.g., instead of "Pizza", say "A slice of pepperoni pizza dripping cheese").
        3. Make it funny or iconic.
        4. Do NOT repeat anything from the avoidance list.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt
        });
        return response.text.trim();
    } catch (e) {
        console.error("Concept generation failed, falling back to generic aspect", e);
        return aspect.instruction;
    }
}

/**
 * ORCHESTRATOR: Two-Step Generation
 */
export const generateCitySticker = async (city: string, attemptIndex: number = 0, history: string[] = []): Promise<{imageUrl: string, concept: string}> => {
  try {
    const imageModel = 'gemini-2.5-flash-image';
    
    // Select Aspect based on rotation index
    const aspect = CITY_ASPECTS[attemptIndex % CITY_ASPECTS.length];
    const seed = Date.now();
    
    // STEP 1: Generate a unique concept string
    const conceptDescription = await generateConcept(city, aspect, history);
    console.log(`Generated Concept for ${city} (${aspect.dimension}):`, conceptDescription);

    const randomStyle = STYLES[Math.floor(Math.random() * STYLES.length)];

    // STEP 2: Generate the image based on that concept
    // We ask for a SOLID BLACK background so we can computationally remove it later.
    // We ask for a THICK WHITE BORDER to create the die-cut physical object look.
    const imagePrompt = `
      Design a funny souvenir sticker.
      
      SUBJECT: ${conceptDescription}
      CONTEXT: This is for the city of ${city}.
      
      STYLE:
      - ${randomStyle}
      - Vector Art style (clean lines, flat colors).
      - Funny, slightly caricatured.
      
      DIE-CUT LAYOUT (CRITICAL):
      1. THICK WHITE OUTLINE around the entire subject (Sticker Border).
      2. SOLID BLACK (#000000) background.
      3. High contrast.
      4. Center the subject. No cropping.
      
      Seed: ${seed}
    `;

    const response = await ai.models.generateContent({
      model: imageModel,
      contents: {
        parts: [{ text: imagePrompt }]
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
    
    return {
        imageUrl: processedUrl,
        concept: conceptDescription
    };

  } catch (error) {
    console.error("Error generating sticker:", error);
    throw error;
  }
};