import mongoose from 'mongoose';
import openai from '../../../config/openai.js';
import Agent from '../../../models/agentModel.js';
import AIConversation from '../../../models/AIConversation.js';
import ChatSettings from '../../../models/ChatSettings.js';
import { countTokens, MAX_CONTEXT_TOKENS, summarizeMessages } from '../../../utils/aiUtils.js';
import PromptManager from '../../../utils/PromptManager.js';

const MAX_AGENT_TURNS = 5; // Maximum number of turns in the agent conversation
const MAX_COMPLETION_TOKENS = 2000; // Maximum tokens for completion

export const streamChat = async (req, res) => {
  try {
    const {
      message,
      sessionId,
      model = 'gpt-4',
      temperature = 0.7,
      max_tokens = MAX_COMPLETION_TOKENS,
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
    let currentAgentIndex = 0;

    // Continue conversation until no more responses or max turns reached
    while (currentTurn < MAX_AGENT_TURNS && activeAgents.size > 0) {
      // Get current agent
      const currentAgent = selectedAgents[currentAgentIndex];

      // If there's only one agent, stop after first response
      if (selectedAgents.length === 1 && currentTurn > 0) {
        break;
      }

      if (!activeAgents.has(currentAgent._id.toString())) {
        // Move to next agent if current one is inactive
        currentAgentIndex = (currentAgentIndex + 1) % selectedAgents.length;
        continue;
      }

      // Create prompt manager for current agent
      const promptManager = new PromptManager(currentAgent, currentTurn, MAX_AGENT_TURNS);

      // Check token count and manage context window
      let messagesToSend = [...conversation.messages];
      let totalTokens = countTokens(messagesToSend);

      if (totalTokens > MAX_CONTEXT_TOKENS) {
        const messagesToSummarize = messagesToSend.slice(0, -5); // Keep last 5 messages
        const summary = await summarizeMessages(messagesToSummarize);
        messagesToSend = [{ role: 'system', content: summary }, ...messagesToSend.slice(-5)];
      }

      const systemMessage = {
        role: 'system',
        content: promptManager.getFullPrompt(),
      };

      let fullResponse = '';
      let finishReason = null;

      // Define available tools
      const tools = [
        {
          type: 'function',
          function: {
            name: 'search_web',
            description: 'Search the web for current information about a topic',
            parameters: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'The search query to look up on the web',
                },
              },
              required: ['query'],
            },
          },
        },
      ];

      // Create the chat completion stream for this agent
      const stream = await openai.chat.completions.create({
        model,
        messages: [systemMessage, ...messagesToSend],
        temperature: currentTurn > 0 ? Math.min(temperature + 0.2, 1.0) : temperature,
        max_tokens: Math.min(max_tokens, MAX_COMPLETION_TOKENS),
        top_p,
        frequency_penalty,
        presence_penalty,
        stop,
        stream: true,
        tools: tools,
        tool_choice: 'auto',
      });

      // Stream each chunk for this agent
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        const toolCalls = chunk.choices[0]?.delta?.tool_calls || [];
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
                id: currentAgent._id,
                name: currentAgent.name,
                icon: currentAgent.icon,
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

        // Handle tool calls
        if (toolCalls.length > 0) {
          for (const toolCall of toolCalls) {
            // Stream tool call information
            res.write(
              `data: ${JSON.stringify({
                id: chunk.id,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: chunk.model,
                agent: {
                  id: currentAgent._id,
                  name: currentAgent.name,
                  icon: currentAgent.icon,
                },
                turn: currentTurn,
                choices: [
                  {
                    index: 0,
                    delta: {
                      tool_calls: [toolCall],
                    },
                    finish_reason: null,
                  },
                ],
              })}\n\n`,
            );

            // If this is a complete tool call, execute it
            if (toolCall.function) {
              const { name, arguments: args } = toolCall.function;

              if (name === 'search_web') {
                try {
                  const searchQuery = JSON.parse(args).query;
                  // Here you would implement the actual web search
                  // For now, we'll just simulate a response
                  const searchResult = `Search results for: ${searchQuery}`;

                  // Add the tool response to the conversation
                  messagesToSend.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    name: 'search_web',
                    content: searchResult,
                  });
                } catch (error) {
                  console.error('Error executing tool:', error);
                }
              }
            }
          }
        }
      }

      // Process the response
      const trimmedResponse = fullResponse.trim();

      if (
        trimmedResponse.toUpperCase() === 'NO_RESPONSE_NEEDED' ||
        trimmedResponse.toUpperCase() === 'TASK_COMPLETE' ||
        (lastResponses.has(currentAgent._id.toString()) &&
          lastResponses.get(currentAgent._id.toString()) === trimmedResponse)
      ) {
        // Mark agent as inactive if they have nothing to add
        activeAgents.delete(currentAgent._id.toString());
      } else if (trimmedResponse.startsWith('CONVERSATION_END:')) {
        // Extract the ending message
        const endMessage = trimmedResponse.substring('CONVERSATION_END:'.length).trim();
        // Mark all agents as inactive to end the conversation
        activeAgents.clear();
        // Add the ending message to the conversation
        const endSystemMessage = {
          role: 'system',
          content: `Conversation ended by ${currentAgent.name}: ${endMessage}`,
        };
        messagesToSend = [endSystemMessage, ...messagesToSend];
      } else if (currentTurn === MAX_AGENT_TURNS - 1) {
        // Force conversation end on the last turn if not already ended
        const forcedEndMessage = `${currentAgent.name} has reached the maximum number of turns (${MAX_AGENT_TURNS}). Ending conversation.`;
        const endSystemMessage = {
          role: 'system',
          content: forcedEndMessage,
        };
        messagesToSend = [endSystemMessage, ...messagesToSend];
        activeAgents.clear();
      } else if (
        trimmedResponse.startsWith('AGENT_QUERY:') ||
        trimmedResponse.startsWith('AGENT_COLLABORATE:')
      ) {
        // Extract the query and target agent
        const queryMatch = trimmedResponse.match(
          /(?:AGENT_QUERY|AGENT_COLLABORATE):\s*(\w+):\s*(.*)/i,
        );
        if (queryMatch) {
          const [_, targetAgentName, query] = queryMatch;
          const targetAgent = selectedAgents.find(
            (a) => a.name.toLowerCase() === targetAgentName.toLowerCase(),
          );

          if (targetAgent && activeAgents.has(targetAgent._id.toString())) {
            // Move to the target agent in the next turn
            currentAgentIndex = selectedAgents.findIndex((a) => a._id.equals(targetAgent._id));

            // Add the query/collaboration request to the conversation context
            const collaborationMessage = {
              role: 'system',
              content: `Previous agent requested ${
                trimmedResponse.startsWith('AGENT_QUERY:') ? 'input' : 'collaboration'
              } from ${targetAgentName}: ${query}`,
            };
            messagesToSend = [collaborationMessage, ...messagesToSend];
          }
        }
      }

      // Add AI response to conversation
      const aiMessage = {
        role: 'assistant',
        content: fullResponse,
        agent: {
          id: currentAgent._id,
          name: currentAgent.name,
          icon: currentAgent.icon,
        },
      };
      conversation.messages.push(aiMessage);
      lastResponses.set(currentAgent._id.toString(), trimmedResponse);

      // Send completion event
      res.write(
        `data: ${JSON.stringify({
          id: conversation._id,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model,
          agent: {
            id: currentAgent._id,
            name: currentAgent.name,
            icon: currentAgent.icon,
          },
          turn: currentTurn,
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: fullResponse,
                agent: {
                  id: currentAgent._id,
                  name: currentAgent.name,
                  icon: currentAgent.icon,
                },
              },
              finish_reason: finishReason,
            },
          ],
          usage: {
            prompt_tokens: totalTokens,
            completion_tokens: Math.ceil(fullResponse.length / 4),
            total_tokens: totalTokens + Math.ceil(fullResponse.length / 4),
          },
        })}\n\n`,
      );

      // Move to next agent
      currentAgentIndex = (currentAgentIndex + 1) % selectedAgents.length;
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
