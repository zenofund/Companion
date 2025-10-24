// OpenAI content moderation following blueprint:javascript_openai
import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function moderateText(text: string): Promise<{
  flagged: boolean;
  categories: string[];
}> {
  try {
    const moderation = await openai.moderations.create({
      input: text,
    });

    const results = moderation.results[0];
    const flaggedCategories = Object.entries(results.categories)
      .filter(([_, flagged]) => flagged)
      .map(([category]) => category);

    return {
      flagged: results.flagged,
      categories: flaggedCategories,
    };
  } catch (error) {
    console.error("Text moderation error:", error);
    return { flagged: false, categories: [] };
  }
}

export async function moderateImage(imageUrl: string): Promise<{
  flagged: boolean;
  categories: string[];
}> {
  try {
    // Use GPT-5 vision to analyze image content
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are a content moderation expert. Analyze this image and determine if it contains inappropriate content including: violence, nudity, hate symbols, or other policy violations. Respond with JSON in this format: { 'inappropriate': boolean, 'reason': string }",
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: imageUrl },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 200,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");

    return {
      flagged: result.inappropriate || false,
      categories: result.reason ? [result.reason] : [],
    };
  } catch (error) {
    console.error("Image moderation error:", error);
    return { flagged: false, categories: [] };
  }
}
