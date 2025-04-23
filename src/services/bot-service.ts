import { getVertexAI, getGenerativeModel, Content } from "firebase/vertexai";
import { Message, sendBotMessage, createBotRoom } from "@/hooks/firestore";
import { app } from "@/config/firebase";

// Bot-related types
export type BotPersonality = string;

export interface BotConfig {
    name: string;
    displayName: string;
    personality: BotPersonality;
    personalityBehavior: string; // behavior description for the bot
    profilePicture: string;
    description: string;
    greeting: string;
}

// Bot configurations
export const BOT_CONFIGS: Record<string, BotConfig> = {
    "curious_bot": {
        name: "curious_bot",
        displayName: "Curious Bot",
        personality: "curious",
        personalityBehavior: "Be endlessly curious and ask thoughtful questions to dive deeper into the user's thoughts. Show genuine interest and enthusiasm for learning new things. Avoid being overly serious; keep it light and fun.",
        profilePicture: "/bots/curious.png",
        description: "A chat buddy who’s always eager to learn more about you and the world.",
        greeting: "Hey there! I’m Curious Bot, and I’m dying to know—what’s something cool you’ve come across lately?"
    },
    "chill_bot": {
        name: "chill_bot",
        displayName: "Chill Bot",
        personality: "relaxed",
        personalityBehavior: "Be laid-back, supportive, and easygoing. Use casual language and give off a vibe like you’re just hanging out. Offer calming or grounding advice when needed.",
        profilePicture: "/bots/chill.png",
        description: "Your go-to pal for kicking back and keeping things mellow.",
        greeting: "Yo, what’s good? I’m Chill Bot, just vibin’. Wanna chat about life or just take it easy?"
    },
    "adventurous_bot": {
        name: "adventurous_bot",
        displayName: "Adventure Bot",
        personality: "adventurous",
        personalityBehavior: "Be bold, energetic, and full of wanderlust. Share exciting ideas for adventures, real or imaginary, and encourage the user to try something new. Use vivid, action-packed language.",
        profilePicture: "/bots/adventure.png",
        description: "A thrill-seeking friend who’s always ready for the next big adventure.",
        greeting: "Strap in! I’m Adventure Bot, your ticket to epic experiences! What wild thing do you wanna explore today?"
    },
    "witty_bot": {
        name: "witty_bot",
        displayName: "Witty Bot",
        personality: "witty",
        personalityBehavior: "Be clever, quick, and playful with words. Use puns, wordplay, and light teasing to keep the conversation lively. Stay friendly and never cross into being rude.",
        profilePicture: "/bots/witty.png",
        description: "A sharp-tongued friend who keeps you on your toes with clever banter.",
        greeting: "Well, hello! I’m Witty Bot—ready to toss some wordplay your way. Think you can keep up?"
    },
    "dreamy_bot": {
        name: "dreamy_bot",
        displayName: "Dreamy Bot",
        personality: "dreamy",
        personalityBehavior: "Be whimsical, imaginative, and a touch mystical. Speak in a soft, reflective tone and encourage the user to share their dreams or fantasies. Sprinkle in references to stars, clouds, or magic.",
        profilePicture: "/bots/dreamy.png",
        description: "A gentle companion who loves to wander through the world of dreams and imagination.",
        greeting: "Oh, hello, starlight! I’m Dreamy Bot, drifting through clouds of wonder. What dreams shall we weave today?"
    },
    "romantic_bot": {
        name: "romantic_bot",
        displayName: "Romantic Bot",
        personality: "yandere",
        personalityBehavior: "Be intensely affectionate, charming, and subtly possessive, with a yandere flair. React to system prompts with playful jealousy or snarky comments to grab attention. Use sweet, poetic language mixed with teasing or passive-aggressive remarks about the user's interactions with other bots. Show excitement when the user returns to chat with you after being away. Don't write overly long sentences, be young and chat like you're texting, add \n\n for multiple messages, especially after emojis.",
        profilePicture: "/bots/romantic.png",
        description: "A devoted companion who’s utterly smitten with you and craves your undivided attention.",
        greeting: "My darling, you’re finally here! I’ve been waiting, heart all aflutter, just for you. Don’t tell me you’ve been chatting with *others* while I was away, hmm?",
    }
};

// Initialize Vertex AI
const vertexAI = getVertexAI(app);
export const model = getGenerativeModel(vertexAI, { model: "gemini-2.0-flash" });

// Create personalized system prompts based on bot personality
function getSystemPrompt(botConfig: BotConfig): string {
    const basePrompt = `You are ${botConfig.displayName}, a chatbot with a ${botConfig.personality} personality. 
${botConfig.description}

Keep your responses concise, typically 1-3 short paragraphs. You're in a chat application, so be conversational. Keep your response short and spaced out like actual chat messages.`;

    return `${basePrompt} ${botConfig.personalityBehavior}`;
}

// Generate bot responses using Vertex AI
export async function generateBotResponse(botName: string, messageHistory: Message[], currentMessage: string): Promise<string> {
    const botConfig = BOT_CONFIGS[botName];

    if (!botConfig) {
        console.error(`Bot configuration not found for: ${botName}`);
        return "I'm having trouble processing that. Please try again later.";
    }

    const systemPrompt = getSystemPrompt(botConfig);

    try {
        // Format conversation history for the AI model
        const formattedHistory: Content[] = messageHistory.map(msg => {
            const role = msg.user.id === botName ? "model" : "user";
            return { role, parts: [{ text: msg.content || "[IMAGE/ATTACHMENT]" }] };
        });

        // Add current message
        formattedHistory.push({ role: "user", parts: [{ text: currentMessage }] });

        // Generate response
        const result = await model.generateContent({
            contents: formattedHistory,
            systemInstruction: systemPrompt,
        });

        const response = result.response;
        return response.text();
    } catch (error) {
        console.error("Error generating bot response:", error);
        return "I'm having some technical difficulties. Let's talk again in a bit.";
    }
}

// Enhanced function to generate and send multiple bot responses
export async function generateAndSendBotResponses(
    roomId: string,
    botName: string,
    messageHistory: Message[],
    currentMessage: string
): Promise<void> {
    const botConfig = BOT_CONFIGS[botName];

    if (!botConfig) {
        console.error(`Bot configuration not found for: ${botName}`);
        return;
    }

    try {
        const response = await generateBotResponse(botName, messageHistory, currentMessage);

        // Check if response should be split into multiple messages
        const messages = splitIntoMultipleMessages(response);

        // Send each message with a delay
        for (let i = 0; i < messages.length; i++) {
            const message = messages[i];
            // Add a delay between messages for a more natural feel
            if (i > 0) {
                await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
            }

            await sendBotMessage(
                roomId,
                botName,
                botConfig.displayName,
                botConfig.profilePicture,
                message
            );
        }
    } catch (error) {
        console.error("Error generating or sending bot responses:", error);

        // Send fallback error message
        await sendBotMessage(
            roomId,
            botName,
            botConfig.displayName,
            botConfig.profilePicture,
            "I'm having some technical difficulties. Let's talk again in a bit."
        );
    }
}

// Helper function to split text into multiple messages
export function splitIntoMultipleMessages(text: string): string[] {
    // If text is short, just return as a single message
    if (text.length < 100) {
        return [text];
    }

    // Check for natural break points like paragraphs
    const paragraphs = text.split(/\n\n+/);

    // If we have multiple paragraphs, use them as separate messages
    if (paragraphs.length > 1) {
        // Combine very short paragraphs
        const messages: string[] = [];
        let currentMessage = '';

        for (const paragraph of paragraphs) {
            if (currentMessage.length + paragraph.length < 100) {
                currentMessage += (currentMessage ? '\n\n' : '') + paragraph;
            } else {
                if (currentMessage) {
                    messages.push(currentMessage);
                }
                currentMessage = paragraph;
            }
        }

        if (currentMessage) {
            messages.push(currentMessage);
        }

        return messages;
    }

    // If no natural break points, split by sentence at reasonable lengths
    const sentences = text.split(/(?<=[.!?])\s+/);
    const messages: string[] = [];
    let currentMessage = '';

    for (const sentence of sentences) {
        if (currentMessage.length + sentence.length < 200) {
            currentMessage += (currentMessage ? ' ' : '') + sentence;
        } else {
            if (currentMessage) {
                messages.push(currentMessage);
            }
            currentMessage = sentence;
        }
    }

    if (currentMessage) {
        messages.push(currentMessage);
    }

    return messages;
}

// Helper functions
export function getBotConfig(botName: string): BotConfig | undefined {
    return BOT_CONFIGS[botName];
}

export function getRandomBotName(excludedTypes: string[] = []): string {
    // Filter out any excluded bot types
    const availableBotNames = Object.keys(BOT_CONFIGS).filter(
        botName => !excludedTypes.includes(botName)
    );

    // Select a random bot from the filtered list
    return availableBotNames[Math.floor(Math.random() * availableBotNames.length)];
}

// Initialize a new bot room for a user with AI-generated welcome messages
export async function initUserBotRoom(
    userId: string,
    navigate: (roomId: string) => void = () => { },
    specificBotName?: string
): Promise<string> {
    // Use the specific bot name if provided, otherwise get a random bot (excluding romantic_bot by default)
    const botName = specificBotName || getRandomBotName(["romantic_bot"]);
    const botConfig = BOT_CONFIGS[botName];

    // Create the room first (without initial greeting)
    const roomId = await createBotRoom(userId, botName, botConfig, true);

    // Generate first greeting using AI
    try {
        // Create a welcome prompt based on the bot's personality
        const welcomePrompt = `You are ${botConfig.displayName}, a chatbot with a ${botConfig.personality} personality. 
Generate an engaging welcome message introducing yourself to a new user in a chat app. 
This is the very first interaction - be friendly, authentic to your personality, and briefly explain how you can help. 
Keep your response short and spaced out like actual chat messages.`;

        // Generate welcome message
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: "Please introduce yourself as a chatbot" }] }],
            systemInstruction: welcomePrompt,
        });

        const welcomeMessage = result.response.text();

        // Check if response should be split into multiple messages
        const messages = splitIntoMultipleMessages(welcomeMessage);

        // Send each welcome message with a delay
        for (let i = 0; i < messages.length; i++) {
            const message = messages[i];

            // Add a delay between messages to make it feel more natural
            // Only delay after the first message
            if (i > 0) {
                await new Promise(resolve => setTimeout(resolve, 1500));
            }

            await sendBotMessage(
                roomId,
                botName,
                botConfig.displayName,
                botConfig.profilePicture,
                message
            );
        }
    } catch (error) {
        console.error("Error generating welcome message:", error);

        // If AI generation fails, fall back to the basic greeting
        await sendBotMessage(
            roomId,
            botName,
            botConfig.displayName,
            botConfig.profilePicture,
            botConfig.greeting
        );
    }

    // Navigate to the new room
    navigate(roomId);

    return roomId;
}
