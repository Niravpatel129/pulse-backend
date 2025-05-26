import mongoose from 'mongoose';
import openai from '../../../config/openai.js';
import AIConversation from '../../../models/AIConversation.js';
import ChatSettings from '../../../models/ChatSettings.js';
import Agent from '../../../models/agentModel.js';
import { countTokens, MAX_CONTEXT_TOKENS, summarizeMessages } from '../../../utils/aiUtils.js';

const MAX_AGENT_TURNS = 5; // Maximum number of turns in the agent conversation

export const streamChat = async (req, res) => {
  try {
    const {
      message,
      sessionId,
      model = 'gpt-4',
      temperature = 0.7,
      max_tokens = 8000,
      top_p = 1,
      frequency_penalty = 0,
      presence_penalty = 0,
      stop = null,
      agents = [],
    } = req.body;

    const workspaceId = req.workspace._id;

    if (!message) {
      return res.status(400).json({
        error: {
          message: 'Message is required',
          type: 'invalid_request_error',
          code: 'missing_message',
        },
      });
    }

    // Get workspace chat settings
    const chatSettings = await ChatSettings.findOne({ workspace: workspaceId });

    // Get all specified agents
    const selectedAgents = await Agent.find({
      _id: { $in: agents },
      workspace: workspaceId,
    });

    if (agents.length > 0 && selectedAgents.length === 0) {
      return res.status(400).json({
        error: {
          message: 'No valid agents found',
          type: 'invalid_request_error',
          code: 'invalid_agents',
        },
      });
    }

    // Get or create conversation
    let conversation;
    if (sessionId && mongoose.Types.ObjectId.isValid(sessionId)) {
      conversation = await AIConversation.findOne({
        _id: sessionId,
        workspace: workspaceId,
      });
    }

    if (!conversation) {
      let title = message.trim();
      if (title.endsWith('?')) {
        title = title.substring(0, 50);
      } else {
        const words = title.split(' ');
        if (words.length > 5) {
          title = words.slice(0, 5).join(' ') + '...';
        }
      }

      conversation = await AIConversation.create({
        workspace: workspaceId,
        messages: [],
        title: title,
      });
    }

    // Add user message
    const userMessage = {
      role: 'user',
      content: message,
    };
    conversation.messages.push(userMessage);

    // Set up streaming response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Initialize conversation state
    let currentTurn = 0;
    let activeAgents = new Set(selectedAgents.map((agent) => agent._id.toString()));
    let lastResponses = new Map();

    // Continue conversation until no more responses or max turns reached
    while (currentTurn < MAX_AGENT_TURNS && activeAgents.size > 0) {
      const turnResponses = await Promise.all(
        selectedAgents
          .filter((agent) => activeAgents.has(agent._id.toString()))
          .map(async (agent) => {
            // Get agent's system prompt
            const systemPrompt =
              agent.sections.find((s) => s.type === 'system_prompt')?.content ||
              'You are a helpful AI assistant. Keep responses concise and relevant.';

            // Add conversation context
            const conversationContext = `You are participating in a conversation with other AI agents. 
              ${
                currentTurn === 0
                  ? 'This is the initial user message.'
                  : 'Other agents have responded to the conversation.'
              }
              ${
                currentTurn > 0
                  ? 'Consider the previous responses and decide if you want to add to the conversation.'
                  : ''
              }
              IMPORTANT: If you don't have anything new or meaningful to add, or if you would just repeat what you or others have already said, respond with "NO_RESPONSE_NEEDED".
              Your response should be unique and add value to the conversation.`;

            // Check token count and manage context window
            let messagesToSend = [...conversation.messages];
            let totalTokens = countTokens(messagesToSend);

            if (totalTokens > MAX_CONTEXT_TOKENS) {
              const messagesToSummarize = messagesToSend.slice(0, -10);
              const summary = await summarizeMessages(messagesToSummarize);
              messagesToSend = [{ role: 'system', content: summary }, ...messagesToSend.slice(-10)];
            }

            const systemMessage = {
              role: 'system',
              content: `${systemPrompt}\n\n${conversationContext}`,
            };

            let fullResponse = '';
            let finishReason = null;

            // Create the chat completion stream for this agent
            const stream = await openai.chat.completions.create({
              model,
              messages: [systemMessage, ...messagesToSend],
              temperature: currentTurn > 0 ? Math.min(temperature + 0.2, 1.0) : temperature, // Increase creativity in follow-up responses
              max_tokens,
              top_p,
              frequency_penalty,
              presence_penalty,
              stop,
              stream: true,
            });

            // Stream each chunk for this agent
            for await (const chunk of stream) {
              const content = chunk.choices[0]?.delta?.content || '';
              finishReason = chunk.choices[0]?.finish_reason;

              if (content) {
                fullResponse += content;
                res.write(
                  `data: ${JSON.stringify({
                    id: chunk.id,
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: chunk.model,
                    agent: {
                      id: agent._id,
                      name: agent.name,
                      icon: agent.icon,
                    },
                    turn: currentTurn,
                    choices: [
                      {
                        index: 0,
                        delta: { content },
                        finish_reason: null,
                      },
                    ],
                  })}\n\n`,
                );
              }
            }

            // Check if agent wants to continue the conversation
            if (
              fullResponse.trim().toUpperCase() === 'NO_RESPONSE_NEEDED' ||
              (lastResponses.has(agent._id.toString()) &&
                lastResponses.get(agent._id.toString()) === fullResponse.trim())
            ) {
              activeAgents.delete(agent._id.toString());
              return null;
            }

            // Add AI response to conversation
            const aiMessage = {
              role: 'assistant',
              content: fullResponse,
              agent: {
                id: agent._id,
                name: agent.name,
                icon: agent.icon,
              },
            };
            conversation.messages.push(aiMessage);
            lastResponses.set(agent._id.toString(), fullResponse);

            return {
              agent,
              response: fullResponse,
              finishReason,
              totalTokens,
            };
          }),
      );

      // Filter out null responses (agents that chose not to respond)
      const validResponses = turnResponses.filter((response) => response !== null);

      // Send completion events for this turn
      validResponses.forEach(({ agent, response, finishReason, totalTokens }) => {
        res.write(
          `data: ${JSON.stringify({
            id: conversation._id,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model,
            agent: {
              id: agent._id,
              name: agent.name,
              icon: agent.icon,
            },
            turn: currentTurn,
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: response,
                  agent: {
                    id: agent._id,
                    name: agent.name,
                    icon: agent.icon,
                  },
                },
                finish_reason: finishReason,
              },
            ],
            usage: {
              prompt_tokens: totalTokens,
              completion_tokens: Math.ceil(response.length / 4),
              total_tokens: totalTokens + Math.ceil(response.length / 4),
            },
          })}\n\n`,
        );
      });

      currentTurn++;
    }

    // Update conversation
    conversation.lastActive = new Date();
    await conversation.save();

    res.end();
  } catch (error) {
    console.error('Error in streaming chat endpoint:', error);
    if (!res.headersSent) {
      return res.status(500).json({
        error: {
          message: error.message,
          type: 'server_error',
          code: 'internal_error',
        },
      });
    } else {
      res.write(
        `data: ${JSON.stringify({
          error: {
            message: error.message,
            type: 'server_error',
            code: 'internal_error',
          },
        })}\n\n`,
      );
      res.end();
    }
  }
};
