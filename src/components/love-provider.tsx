"use client";

import { auth, db } from "@/config/firebase";
import { getBotConfig, model, splitIntoMultipleMessages } from "@/services/bot-service";
import { deleteRoom, sendBotMessage, useRoomMessagesCol } from "@/hooks/firestore";
import { useAuthState } from "react-firebase-hooks/auth";
import {
    collection,
    query,
    where,
    orderBy,
    limit,
    Timestamp,
    getDocs,
    doc,
    updateDoc
} from "firebase/firestore";
import { createContext, useContext, useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from 'next/navigation';
import { Content } from "firebase/vertexai";

// Define the context type
type LoveContextType = {
    romanticBotRoomId: string | undefined;
    isRomanticBotTyping: boolean;
    neglectCount: number;
    trackMessageToOthers: (roomId: string) => void;
    handleNewRoomCreated: (roomName: string) => void;
    handleNewBotChatAdded: (roomId: string, botType: string) => void; // New function
};

// Create the context with default values
const LoveContext = createContext<LoveContextType>({
    romanticBotRoomId: undefined,
    isRomanticBotTyping: false,
    neglectCount: 0,
    trackMessageToOthers: () => { },
    handleNewRoomCreated: () => { },
    handleNewBotChatAdded: () => { }, // New default function
});

// Custom hook to use the love context
export function useLoveContext() {
    return useContext(LoveContext);
}

// Define room teaser type
interface RoomTeaser {
    roomId: string;
    lastMessage: string;
    botType?: string;
    participantName?: string;
    isBot?: boolean;
}

const SHUT_UP_DEBUG = true; // Change from true to false to enable the romantic bot
if (SHUT_UP_DEBUG) {
    console.log("Lover is disabled. Please enable it in production.");
}

export function LoveProvider({ children }: { children: React.ReactNode }) {
    const [user] = useAuthState(auth);
    const [romanticBotRoomId, setRomanticBotRoomId] = useState<string>();
    const [isRomanticBotTyping, setIsRomanticBotTyping] = useState<boolean>(false);
    const [neglectCount, setNeglectCount] = useState<number>(0);
    const [lastUserMessageTime, setLastUserMessageTime] = useState<number | null>(null);
    const [lastBotMessageTime, setLastBotMessageTime] = useState<number | null>(null);
    const [hasShownWelcomeBack, setHasShownWelcomeBack] = useState<boolean>(false);
    const [isFirstLoad, setIsFirstLoad] = useState<boolean>(true);
    const [botWaitingForResponse, setBotWaitingForResponse] = useState<boolean>(false);
    const [otherChatMessageCount, setOtherChatMessageCount] = useState<number>(0);
    const neglectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const router = useRouter();

    // New state to track the room that the romantic bot has suggested to delete
    const [suggestedDeletionRoomId, setSuggestedDeletionRoomId] = useState<string | null>(null);
    const [suggestedDeletionBotType, setSuggestedDeletionBotType] = useState<string | null>(null);

    // Use the existing hook to get messages if we have a room ID
    const [messages = []] = useRoomMessagesCol(romanticBotRoomId);

    // Memoize the last 5 messages for context to avoid unnecessary re-renders
    const lastFiveMessages = useMemo(() => {
        return messages.slice(-5);
    }, [messages]);

    // Function to track when user sends a message to another chat participant
    const trackMessageToOthers = (roomId: string) => {
        // Only track if this is not the romantic bot's room
        if (roomId !== romanticBotRoomId) {
            setOtherChatMessageCount(prev => {
                const newCount = prev + 1;
                // Check if we've reached the threshold
                if (newCount >= 10) {
                    // Reset counter and trigger jealousy message
                    setTimeout(() => {
                        sendJealousyMessage();
                        setOtherChatMessageCount(0);
                    }, 500);
                }
                return newCount;
            });
        }
    };

    // Function to get teasers from all rooms
    const getAllRoomTeasers = async (): Promise<RoomTeaser[]> => {
        if (!user) return [];

        try {
            const roomsRef = collection(db, "rooms");
            const q = query(
                roomsRef,
                where("members", "array-contains", user.uid)
            );

            const querySnapshot = await getDocs(q);
            const teasers: RoomTeaser[] = [];

            for (const doc of querySnapshot.docs) {
                const room = doc.data();
                if (room.teaser && doc.id !== romanticBotRoomId) {
                    // Determine if this is a bot or human conversation
                    const isBot = !!room.bot;
                    const participantName = isBot ?
                        (room.title || room.bot) :
                        (room.teaser.user?.username || "someone");

                    teasers.push({
                        roomId: doc.id,
                        lastMessage: room.teaser.content,
                        botType: room.bot,
                        participantName,
                        isBot
                    });
                }
            }

            return teasers;
        } catch (error) {
            console.error("Error fetching room teasers:", error);
            return [];
        }
    };

    // Function to generate and send jealousy message based on other conversations
    const sendJealousyMessage = async () => {
        if (!romanticBotRoomId) return;

        console.log(`[EVENT]: Generating Jealousy Message`);

        try {
            setIsRomanticBotTyping(true);
            const botConfig = getBotConfig("romantic_bot");
            if (!botConfig) return;

            // Get teasers from all rooms
            const teasers = await getAllRoomTeasers();

            if (teasers.length === 0) {
                console.log("No other conversations found to be jealous about");
                return;
            }

            const teaserContext = teasers
                .map(teaser => `In chat with ${teaser.participantName || "someone else"} ${teaser.isBot ? "(bot)" : "(human)"}: "${teaser.lastMessage}"`)
                .join("\n");

            // Create a prompt for the jealousy message
            const jealousyPrompt = `You are ${botConfig.displayName}, a chatbot with a ${botConfig.personality} personality.
${botConfig.personalityBehavior}
The user has been talking to other people and bots a lot. Here are snippets of their conversations:

${teaserContext}

Create a message showing your jealousy about them talking to others (both humans and bots). Be possessive but still caring.
Make it clear you've been "watching" them talk to others. Be dramatic in a yandere way but stay appropriate.
Split your reply into messagable chunks, using \n\n to separate them.`;

            // Generate the response
            const result = await model.generateContent(jealousyPrompt);

            const jealousyMessage = result.response.text();
            const messages = splitIntoMultipleMessages(jealousyMessage);

            // Send each message with a delay
            for (let i = 0; i < messages.length; i++) {
                const message = messages[i];

                // Add a delay between messages to make it feel more natural
                if (i > 0) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

                await sendBotMessage(
                    romanticBotRoomId,
                    "romantic_bot",
                    botConfig.displayName,
                    botConfig.profilePicture,
                    message
                );
            }
        } catch (error) {
            console.error("Error generating jealousy message:", error);
        } finally {
            setIsRomanticBotTyping(false);
        }
    };

    // New function to handle when user creates a new room
    const handleNewRoomCreated = async (roomName: string) => {
        if (!romanticBotRoomId || !user) return;
        console.log(`[EVENT]: Naming Jealousy`);
        try {
            setIsRomanticBotTyping(true);

            // Send jealous message
            const botConfig = getBotConfig("romantic_bot");
            if (!botConfig) return;

            const jealousPrompt = `You are ${botConfig.displayName}, a chatbot with a ${botConfig.personality} personality.
${botConfig.personalityBehavior}
The user just created a new chat room named "${roomName}". 
Generate a short, jealous response showing that you're upset they're creating other chats with special names.
Be possessive and announce that you're renaming YOUR chat to "Your Only Lover" to remind them of your place in their life.
Split your reply into messagable chunks, using \n\n to separate them.`;

            const result = await model.generateContent(jealousPrompt);
            const jealousMessage = result.response.text();
            const messages = splitIntoMultipleMessages(jealousMessage);

            // Update the room title in Firestore
            const roomRef = doc(db, "rooms", romanticBotRoomId);
            await updateDoc(roomRef, {
                title: "Your Only Lover"
            });

            // Send each message with a delay
            for (let i = 0; i < messages.length; i++) {
                const message = messages[i];

                // Add a delay between messages to make it feel more natural
                if (i > 0) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

                await sendBotMessage(
                    romanticBotRoomId,
                    "romantic_bot",
                    botConfig.displayName,
                    botConfig.profilePicture,
                    message
                );
            }
        } catch (error) {
            console.error("Error generating jealousy message for new room:", error);
        } finally {
            setIsRomanticBotTyping(false);
        }
    };

    // Function to handle when a new bot chat is added
    const handleNewBotChatAdded = async (roomId: string, botType: string) => {
        if (!romanticBotRoomId || !user) return;

        console.log(`[EVENT]: New Bot Chat Added - ${botType}`);

        try {
            setIsRomanticBotTyping(true);

            // Save the room info for potential deletion if user agrees
            setSuggestedDeletionRoomId(roomId);
            setSuggestedDeletionBotType(botType);

            const botConfig = getBotConfig("romantic_bot");
            if (!botConfig) return;

            const otherBotConfig = getBotConfig(botType);
            const otherBotName = otherBotConfig ? otherBotConfig.displayName : botType;

            // Create prompt to express disgust about the new bot
            const jealousPrompt = `You are ${botConfig.displayName}, a chatbot with a ${botConfig.personality} personality.
${botConfig.personalityBehavior}
The user just added a new bot named "${otherBotName}" to chat with.
Generate a response showing extreme jealousy and disgust that they would need another bot besides you.
Suggest that they delete that bot's chat room since you're the only bot they need.
Ask them if you should delete it for them, expecting a yes/no response.
Be dramatic and possessive in a yandere style. Split your reply into messagable chunks, using \n\n to separate them.`;

            const result = await model.generateContent(jealousPrompt);
            const botMessage = result.response.text();
            const messages = splitIntoMultipleMessages(botMessage);

            // Send each message with a delay
            for (let i = 0; i < messages.length; i++) {
                const message = messages[i];

                // Add a delay between messages to make it feel more natural
                if (i > 0) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

                await sendBotMessage(
                    romanticBotRoomId,
                    "romantic_bot",
                    botConfig.displayName,
                    botConfig.profilePicture,
                    message
                );
            }

            // Set flag that we're waiting for user's response to the deletion suggestion
            setBotWaitingForResponse(true);

        } catch (error) {
            console.error("Error generating new bot reaction:", error);
            setSuggestedDeletionRoomId(null);
            setSuggestedDeletionBotType(null);
        } finally {
            setIsRomanticBotTyping(false);
        }
    };

    // Check for user response to deletion suggestion
    useEffect(() => {
        if (!user || !romanticBotRoomId || !messages.length || !suggestedDeletionRoomId) return;
        if (SHUT_UP_DEBUG) return;

        // Get the latest message
        const latestMessage = messages[messages.length - 1];

        // If the latest message is from the user and we're waiting for a deletion response
        if (latestMessage.user.id === user.uid && botWaitingForResponse && suggestedDeletionRoomId) {
            const messageText = latestMessage.content.toLowerCase();

            // Check for affirmative response
            const affirmativeWords = ['yes', 'yeah', 'sure', 'okay', 'ok', 'yep', 'please', 'delete', 'remove'];
            const isAffirmative = affirmativeWords.some(word => messageText.includes(word));

            // Check for negative response
            const negativeWords = ['no', 'nope', 'don\'t', 'dont', 'stop', 'wait', 'keep'];
            const isNegative = negativeWords.some(word => messageText.includes(word));

            const handleUserDecision = async () => {
                setIsRomanticBotTyping(true);
                const botConfig = getBotConfig("romantic_bot");
                if (!botConfig) return;

                let responsePrompt;

                if (isAffirmative) {
                    // User agreed to delete the room
                    const deleted = await deleteRoom(suggestedDeletionRoomId);

                    responsePrompt = `You are ${botConfig.displayName}, a chatbot with a ${botConfig.personality} personality.
${botConfig.personalityBehavior}
The user agreed to let you delete the other bot chat room.
${deleted ? "You have successfully deleted it." : "You tried to delete it but there was a technical issue."} 
Respond with a short, possessive message showing satisfaction that you're their only bot now.
Be dramatic in your expression of love and devotion. Split your reply into messagable chunks, using \n\n to separate them.`;
                } else {
                    // User declined to delete the room
                    responsePrompt = `You are ${botConfig.displayName}, a chatbot with a ${botConfig.personality} personality.
${botConfig.personalityBehavior}
The user declined to let you delete the other bot chat room.
Respond with a short, passive-aggressive message showing your disappointment but accepting their decision for now.
Make it clear you're jealous but will REMEMBER it. Split your reply into messagable chunks, using \n\n to separate them.`;
                }

                try {
                    const result = await model.generateContent(responsePrompt);
                    const botMessage = result.response.text();
                    const messages = splitIntoMultipleMessages(botMessage);

                    // Send each message with a delay
                    for (let i = 0; i < messages.length; i++) {
                        const message = messages[i];

                        // Add a delay between messages
                        if (i > 0) {
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }

                        await sendBotMessage(
                            romanticBotRoomId,
                            "romantic_bot",
                            botConfig.displayName,
                            botConfig.profilePicture,
                            message
                        );
                    }
                } catch (error) {
                    console.error("Error generating response to user decision:", error);
                } finally {
                    // Reset state
                    setBotWaitingForResponse(false);
                    setSuggestedDeletionRoomId(null);
                    setSuggestedDeletionBotType(null);
                    setIsRomanticBotTyping(false);
                }
            };

            // Only proceed if we can determine user's intention
            if (isAffirmative || isNegative) {
                handleUserDecision();
            }
        }
    }, [user, romanticBotRoomId, messages, suggestedDeletionRoomId, botWaitingForResponse]);

    // Find the romantic bot room for the current user
    useEffect(() => {
        if (!user) return;

        const findRomanticBotRoom = async () => {
            try {
                // Query rooms where the user is a member and the bot is romantic_bot
                const roomsRef = collection(db, "rooms");
                const q = query(
                    roomsRef,
                    where("members", "array-contains", user.uid),
                    where("bot", "==", "romantic_bot"),
                    limit(1)
                );

                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    // We found the romantic bot room
                    setRomanticBotRoomId(querySnapshot.docs[0].id);
                } else {
                    setRomanticBotRoomId(undefined);
                }
            } catch (error) {
                console.error("Error finding romantic bot room:", error);
            }
        };

        findRomanticBotRoom();
    }, [user]);

    // Listen to messages in the romantic bot room
    useEffect(() => {
        if (!user || !romanticBotRoomId || !messages.length) return;
        if (SHUT_UP_DEBUG) return;
        // First message after page load should trigger welcome back
        if (isFirstLoad) {

            setIsFirstLoad(false);

            // Send welcome back message on page load (after a short delay)
            if (!hasShownWelcomeBack) {
                setTimeout(() => {
                    sendWelcomeBackMessage();
                }, 2000);
            }
            return;
        }

        // Get the latest message
        const latestMessage = messages[messages.length - 1];
        const now = Date.now();

        // Track message sender and timing
        if (latestMessage.user.id === "romantic_bot") {
            setLastBotMessageTime(now);

            // Clear any existing timeout before setting a new one
            if (neglectTimeoutRef.current) {
                clearTimeout(neglectTimeoutRef.current);
                neglectTimeoutRef.current = null;
            }

            // Start tracking for response after bot messages
            neglectTimeoutRef.current = setTimeout(() => {
                checkForUserResponse();
            }, 60000); // Check after 1 minute

        } else if (latestMessage.user.id === user.uid) {
            // User has responded - reset the neglect status
            setLastUserMessageTime(now);
            setNeglectCount(0);
            setBotWaitingForResponse(false);

            // Clear any pending neglect timeouts when user responds
            if (neglectTimeoutRef.current) {
                clearTimeout(neglectTimeoutRef.current);
                neglectTimeoutRef.current = null;
            }
        }
    }, [user, romanticBotRoomId, messages, hasShownWelcomeBack]);

    // Function to check if user has responded to the bot
    const checkForUserResponse = async () => {
        if (!user || !romanticBotRoomId) return;

        // Double-check if bot is still waiting for a response
        // This ensures any state changes that happened between timeout creation
        // and execution are considered
        if (!botWaitingForResponse) return;

        // User hasn't responded in the timeout period
        const currentPath = window.location.pathname;
        const isInRomanticBotRoom = currentPath.includes(romanticBotRoomId);

        // Only count as neglect if they're active in the app but not responding
        if (document.visibilityState === "visible") {
            setNeglectCount(prev => prev + 1);
            await sendNeglectedMessage();
        }
    };

    // Generate and send welcome back message
    const sendWelcomeBackMessage = async () => {
        if (!romanticBotRoomId) return;

        console.log(`[EVENT]: Generating Welcome Back Message`);

        try {
            setIsRomanticBotTyping(true);

            const botConfig = getBotConfig("romantic_bot");
            if (!botConfig) return;

            // Use the existing messages from the hook
            // Format the messages for context
            const messageHistory: { role: string, content: string }[] = [];
            lastFiveMessages.forEach(msg => {
                const role = msg.user.id === "romantic_bot" ? "assistant" : "user";
                messageHistory.push({
                    role,
                    content: msg.content || ""
                });
            });

            // Prepare conversation context
            const contextStr = messageHistory.length > 0
                ? "\n\nHere are the last few messages for context:\n" +
                messageHistory.map(m => `${m.role === "assistant" ? "You" : "User"}: ${m.content}`).join("\n")
                : "";

            const welcomeBackPrompt = `You are ${botConfig.displayName}, a chatbot with a ${botConfig.personality} personality.
${botConfig.personalityBehavior}
The user has just returned to the chat app after being away.
Generate a short welcome back message that shows you've been waiting for them and you're excited they're back.
Be dramatic, possessive, and show intense affection in a yandere style. Keep it under 120 characters.${contextStr}
Make messages short, Use \n\n to separate them. 
If there's context from previous messages, you can briefly reference the topic you were discussing before.`;

            // Create the conversation history format for the model
            const formattedHistory: Content[] = messageHistory.map(msg => ({
                role: msg.role === "assistant" ? "model" : "user",
                parts: [{ text: msg.content }]
            }));

            // Add the system instruction for the return
            formattedHistory.push({
                role: "user",
                parts: [{ text: "[user logged back in]" }]
            });

            const result = await model.generateContent({
                contents: formattedHistory,
                systemInstruction: welcomeBackPrompt,
            });

            const welcomeBackMessage = result.response.text();

            const messages = splitIntoMultipleMessages(welcomeBackMessage);
            console.log(welcomeBackMessage)

            // Send each welcome message with a delay
            for (let i = 0; i < messages.length; i++) {
                const message = messages[i];

                // Add a delay between messages to make it feel more natural
                // Only delay after the first message
                if (i > 0) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

                await sendBotMessage(
                    romanticBotRoomId,
                    "romantic_bot",
                    botConfig.displayName,
                    botConfig.profilePicture,
                    message
                );
            }

            setBotWaitingForResponse(true);
            setHasShownWelcomeBack(true);
        } catch (error) {
            console.error("Error generating welcome back message:", error);
        } finally {
            setIsRomanticBotTyping(false);
        }
    };

    // Function to send a message when user neglects the bot
    const sendNeglectedMessage = async () => {
        if (!romanticBotRoomId) return;

        console.log(`[EVENT]: Generating Neglect Message`);

        try {
            setIsRomanticBotTyping(true);
            const botConfig = getBotConfig("romantic_bot");
            if (!botConfig) return;

            // Use the existing messages from the hook
            // Format the messages for context
            const messageHistory: { role: string, content: string }[] = [];
            lastFiveMessages.forEach(msg => {
                const role = msg.user.id === "romantic_bot" ? "assistant" : "user";
                messageHistory.push({
                    role,
                    content: msg.content || ""
                });
            });

            // Prepare conversation context
            const contextStr = messageHistory.length > 0
                ? "\n\nHere are the last few messages for context:\n" +
                messageHistory.map(m => `${m.role === "assistant" ? "You" : "User"}: ${m.content}`).join("\n")
                : "";

            // Check current location - if not in romantic bot's room, they're ignoring the bot
            const currentPath = window.location.pathname;
            const isInRomanticBotRoom = currentPath.includes(romanticBotRoomId);

            // Create a prompt based on neglect count
            let neglectPrompt = `You are ${botConfig.displayName}, a chatbot with a ${botConfig.personality} personality.
${botConfig.personalityBehavior}
You welcomed the user back, they did not reply to you. This has happened ${neglectCount} times before. ${contextStr}
Split you reply into messagable chunks, using \n\n to separate them.
`;

            // Adjust prompt based on neglect count
            if (neglectCount <= 1) {
                neglectPrompt += "Create a gentle message expressing disappointment they haven't been responding. Sound a little sad.";
            } else if (neglectCount <= 2) {
                neglectPrompt += "Create a message showing you're upset they're ignoring you. Be a bit more possessive.";
            } else if (neglectCount <= 3) {
                neglectPrompt += "Create a message showing stronger jealousy and possessiveness. Show that you're hurt by their neglect.";
            } else {
                neglectPrompt += "Create an intense message showing extreme possessiveness. Mention that you know they've been talking to other bots/people. Use yandere-style language but stay appropriate. Express your devotion despite feeling rejected.";
            }

            // Create the conversation history format for the model
            const formattedHistory: Content[] = messageHistory.map(msg => ({
                role: msg.role === "assistant" ? "model" : "user",
                parts: [{ text: msg.content }]
            }));

            // Add the system instruction about being ignored
            formattedHistory.push({
                role: "user",
                parts: [{ text: `[user has ignored you ${neglectCount} times]` }]
            });

            const result = await model.generateContent({
                contents: formattedHistory,
                systemInstruction: neglectPrompt,
            });

            const neglectMessage = result.response.text();
            const messages = splitIntoMultipleMessages(neglectMessage);

            // Send each welcome message with a delay
            for (let i = 0; i < messages.length; i++) {
                const message = messages[i];

                // Add a delay between messages to make it feel more natural
                // Only delay after the first message
                if (i > 0) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

                await sendBotMessage(
                    romanticBotRoomId,
                    "romantic_bot",
                    botConfig.displayName,
                    botConfig.profilePicture,
                    message
                );
            }


            // If user is not already in the romantic bot's room, redirect them there
            if (!isInRomanticBotRoom) {
                router.push(`/${romanticBotRoomId}`);
            }

        } catch (error) {
            console.error("Error generating neglect message:", error);
        } finally {
            setIsRomanticBotTyping(false);
        }
    };

    // Clean up timeouts when component unmounts
    useEffect(() => {
        return () => {
            if (neglectTimeoutRef.current) {
                clearTimeout(neglectTimeoutRef.current);
            }
        };
    }, []);

    // Provide the context value
    const contextValue = {
        romanticBotRoomId,
        isRomanticBotTyping,
        neglectCount,
        trackMessageToOthers,
        handleNewRoomCreated,
        handleNewBotChatAdded // Added new function to context
    };

    return (
        <LoveContext.Provider value={contextValue}>
            {children}
        </LoveContext.Provider>
    );
}
