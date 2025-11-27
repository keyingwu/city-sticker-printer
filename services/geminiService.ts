import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Deterministic Rotation Categories
// This ensures the user gets a Variety Pack: Landmark -> Food -> Transport -> Animal -> Object
const STICKER_CONCEPTS = [
  {
    type: "ARCHITECTURAL_LANDMARK",
    instruction: "Draw a famous building, monument, or physical landmark specific to this city. Do NOT draw food or animals. Focus on the most recognizable silhouette."
  },
  {
    type: "LOCAL_FOOD",
    instruction: "Draw a popular local street food or dish specific to this city. Do NOT draw buildings or generic food (no ramen in NY). Focus on delicious, messy detail."
  },
  {
    type: "TRANSPORTATION",
    instruction: "Draw a specific taxi, bus, train, boat or bicycle that is iconic to this city. Do NOT draw static buildings. Focus on movement."
  },
  {
    type: "LOCAL_ANIMAL_OR_PEST",
    instruction: "Draw a local animal, pest, or pet associated with this city (e.g., Pigeons/Rats for NYC, Bears for rural, Stray cats). Give it a funny human personality."
  },
  {
    type: "LOCAL_STEREOTYPE_PERSON",
    instruction: "Draw a humorous caricature of a stereotypical local resident or tourist in this city. (e.g., Busy business person, confused tourist with map, local hipster)."
  },
  {
    type: "STREET_OBJECT",
    instruction: "Draw a specific street object found in this city (e.g., a specific style of trash can, street sign, fire hydrant, kiosk, mailbox)."
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
    
    // Select concept based on the index (Deterministic rotation)
    // 0: Landmark, 1: Food, 2: Transport, 3: Animal...
    const concept = STICKER_CONCEPTS[attemptIndex % STICKER_CONCEPTS.length];
    
    const randomStyle = STYLES[Math.floor(Math.random() * STYLES.length)];
    const seed = Date.now();

    // We ask for a SOLID BLACK background so we can computationally remove it later.
    // We ask for a THICK WHITE BORDER to create the die-cut physical object look.
    const prompt = `
      Design a funny, stereotypical souvenir sticker for the city: ${city}.
      
      STRICT SUBJECT DIRECTIVE:
      The sticker MUST feature: ${concept.instruction}
      Category: ${concept.type}.
      
      NEGATIVE CONSTRAINTS:
      - Do NOT generate generic items (e.g., Ramen, Sushi, Burgers) unless they are THE most famous thing in ${city}.
      - Do NOT mix categories (e.g. if asked for a Building, do not draw a Hot Dog).
      
      STYLE & HUMOR:
      - Use a ${randomStyle}.
      - Make the object look slightly silly, tired, chaotic, or overly enthusiastic.
      - If it's a landmark, maybe it's slightly bent or crowded. If it's an animal, maybe it's eating human food.
      
      CRITICAL LAYOUT INSTRUCTIONS:
      1. The sticker object MUST have a THICK, UNBROKEN WHITE OUTLINE (Die-Cut Border) all around it.
      2. The background MUST be solid, pure BLACK (#000000).
      3. High contrast between the white border and the black background.
      4. Do NOT cast any shadows onto the black background. Flat colors only for background.
      5. Center the object.
      
      Random Seed: ${seed}
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