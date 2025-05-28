import mongoose from 'mongoose';
import openai from '../../../config/openai.js';
import Agent from '../../../models/agentModel.js';
import AIConversation from '../../../models/AIConversation.js';
import ChatSettings from '../../../models/ChatSettings.js';
import { countTokens } from '../../../utils/aiUtils.js';
import { firebaseStorage } from '../../../utils/firebase.js';
import PromptManager from '../../../utils/PromptManager.js';
import ToolsManager from '../../../utils/ToolsManager.js';

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
      images = [],
    } = req.body;

    const workspaceId = req.workspace._id;
    const toolsManager = new ToolsManager(workspaceId);

    if (!message && images.length === 0) {
      return res.status(400).json({
        error: {
          message: 'Message or images are required',
          type: 'invalid_request_error',
          code: 'missing_message',
        },
      });
    }

    // Process images if present
    let processedImages = [];
    if (images.length > 0) {
      try {
        // Process each image
        for (const image of images) {
          if (image.url.startsWith('data:image')) {
            // Handle base64 image data
            const base64Data = image.url.split(',')[1];
            const buffer = Buffer.from(base64Data, 'base64');

            // Upload to Firebase
            const storagePath = firebaseStorage.generatePath(
              workspaceId,
              `chat_image_${Date.now()}.png`,
            );
            const { url } = await firebaseStorage.uploadFile(buffer, storagePath, 'image/png');

            processedImages.push({
              url,
              alt: image.alt,
            });
          } else if (image.url.startsWith('http')) {
            // If it's already a regular URL, use it as is
            processedImages.push(image);
          } else {
            console.warn('Unsupported image URL format:', image.url);
          }
        }
      } catch (error) {
        console.error('Error processing images:', error);
        return res.status(500).json({
          error: {
            message: 'Failed to process images',
            type: 'server_error',
            code: 'image_processing_error',
          },
        });
      }
    }

    // Get workspace chat settings
    const chatSettings = await ChatSettings.findOne({ workspace: workspaceId });

    // Get all specified agents
    const selectedAgents = await Agent.find({
      _id: { $in: agents },
      workspace: workspaceId,
    });

    console.log('\n=== DEBUG: Agent Selection ===');
    console.log('Requested agents:', agents);
    console.log(
      'Found agents:',
      selectedAgents.map((a) => ({ id: a._id, name: a.name })),
    );

    if (agents.length > 0 && selectedAgents.length === 0) {
      return res.status(400).json({
        error: {
          message: 'No valid agents found',
          type: 'invalid_request_error',
          code: 'invalid_agents',
        },
      });
    }

    // If no agents specified, use default agent
    if (selectedAgents.length === 0) {
      const defaultAgent = await Agent.findOne({ workspace: workspaceId });
      if (defaultAgent) {
        selectedAgents.push(defaultAgent);
        console.log('Using default agent:', defaultAgent.name);
      } else {
        return res.status(400).json({
          error: {
            message: 'No agents available',
            type: 'invalid_request_error',
            code: 'no_agents',
          },
        });
      }
    }

    // Get or create conversation
    let conversation;
    if (sessionId && mongoose.Types.ObjectId.isValid(sessionId)) {
      conversation = await AIConversation.findOne({
        _id: sessionId,
        workspace: workspaceId,
      });

      console.log('\n=== DEBUG: MongoDB Conversation ===');
      console.log('Session ID:', sessionId);
      console.log('Found conversation:', conversation ? 'Yes' : 'No');
      if (conversation) {
        console.log('Total messages in DB:', conversation.messages.length);
        console.log('Messages in DB:');
        conversation.messages.forEach((msg, idx) => {
          console.log(`\nDB Message ${idx + 1}:`);
          console.log('Role:', msg.role);
          console.log('Content:', msg.content);
          if (msg.agent) {
            console.log('Agent:', msg.agent.name);
          }
        });
      }
    }

    if (!conversation) {
      let title = message?.trim() || 'Image Analysis';
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
      console.log('\n=== DEBUG: Created New Conversation ===');
      console.log('Title:', title);
    }

    // Add user message
    const userMessage = {
      role: 'user',
      content: message || '',
      images: processedImages.length > 0 ? processedImages : undefined,
    };
    conversation.messages.push(userMessage);

    // Save after adding user message
    await conversation.save();
    console.log('\n=== DEBUG: After Adding User Message ===');
    console.log('Total messages after save:', conversation.messages.length);
    console.log('Last message:', conversation.messages[conversation.messages.length - 1]);

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

    // Check for direct agent request in the message
    const directAgentRequest = message.toLowerCase().match(/^(clara|leo)\s+(.+)$/i);
    if (directAgentRequest) {
      const [_, requestedAgent, actualMessage] = directAgentRequest;
      const targetAgent = selectedAgents.find(
        (a) => a.name.toLowerCase() === requestedAgent.toLowerCase(),
      );

      if (targetAgent) {
        // Only activate the requested agent
        activeAgents.clear();
        activeAgents.add(targetAgent._id.toString());
        currentAgentIndex = selectedAgents.findIndex((a) => a._id.equals(targetAgent._id));

        // Update the message to remove the agent name
        message = actualMessage.trim();
        userMessage.content = message;
      }
    }

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

      // Prepare messages for the API call
      let messagesToSend = [];

      // Add system message first
      const systemMessage = {
        role: 'system',
        content: promptManager.getFullPrompt(),
      };
      messagesToSend.push(systemMessage);

      // Add conversation history, properly formatted
      const recentMessages = conversation.messages.slice(-10); // Keep last 10 messages for context

      console.log('\n=== DEBUG: Conversation State ===');
      console.log('Current Turn:', currentTurn);
      console.log('Current Agent:', currentAgent.name);
      console.log('Active Agents:', Array.from(activeAgents));

      console.log('\n=== DEBUG: Recent Messages ===');
      console.log('Number of messages:', recentMessages.length);
      recentMessages.forEach((msg, idx) => {
        console.log(`\nMessage ${idx + 1}:`);
        console.log('Role:', msg.role);
        console.log('Content:', msg.content);
        if (msg.images) {
          console.log('Images:', msg.images);
        }
        if (msg.agent) {
          console.log('Agent:', msg.agent.name);
        }
      });

      // Format messages for API, including image content
      const formattedMessages = recentMessages.map((msg) => {
        if (msg.images && msg.images.length > 0) {
          return {
            role: msg.role,
            content: [
              { type: 'text', text: msg.content || 'Please analyze this image.' },
              ...msg.images.map((img) => ({
                type: 'image_url',
                image_url: {
                  url: img.url,
                },
              })),
            ],
          };
        }
        return {
          role: msg.role,
          content: msg.content,
        };
      });

      messagesToSend.push(...formattedMessages);

      console.log('\n=== DEBUG: Final Prompt ===');
      console.log('Total messages to send:', messagesToSend.length);
      console.log('Messages being sent to OpenAI:', JSON.stringify(messagesToSend, null, 2));

      // Create the chat completion stream for this agent
      const stream = await openai.chat.completions.create({
        model: 'gpt-4.1',
        messages: messagesToSend,
        temperature: currentTurn > 0 ? Math.min(temperature + 0.2, 1.0) : temperature,
        max_tokens: Math.min(max_tokens, MAX_COMPLETION_TOKENS),
        top_p,
        frequency_penalty,
        presence_penalty,
        stop: stop || undefined,
        stream: true,
        tools: toolsManager.getTools(),
      });

      console.log('\n=== DEBUG: Stream Created ===');
      console.log('Stream initialized with model:', 'gpt-4.1');

      // Stream each chunk for this agent
      let fullResponse = '';
      let toolCall = null;
      let toolCallArgs = '';
      let hasProcessedToolCall = false;
      let lastFinishReason = null;

      for await (const chunk of stream) {
        console.log('\n=== DEBUG: Received Chunk ===');
        console.log('Chunk:', JSON.stringify(chunk, null, 2));

        const content = chunk.choices[0]?.delta?.content || '';
        const toolCalls = chunk.choices[0]?.delta?.tool_calls || [];
        const finishReason = chunk.choices[0]?.finish_reason;
        lastFinishReason = finishReason || lastFinishReason;

        // Handle content
        if (content) {
          fullResponse += content;
          console.log('Content received:', content);
          res.write(
            `data: ${JSON.stringify({
              id: chunk.id,
              object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000),
              model: chunk.model,
              sessionId: conversation._id,
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
          const currentToolCall = toolCalls[0];

          if (currentToolCall.function?.name) {
            toolCall = {
              id: currentToolCall.id,
              type: 'function',
              function: {
                name: currentToolCall.function.name,
                arguments: '',
              },
            };
          }

          if (currentToolCall.function?.arguments) {
            toolCallArgs += currentToolCall.function.arguments;
          }
        }

        // Process tool call when finished
        if (finishReason === 'tool_calls' && toolCall && !hasProcessedToolCall) {
          try {
            const searchResult = await toolsManager.executeTool(toolCall, toolCallArgs);

            // Add the tool response to the conversation
            messagesToSend.push(toolsManager.createToolCallMessage(toolCall));
            messagesToSend.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(searchResult),
            });

            // Stream the tool response
            res.write(
              `data: ${JSON.stringify({
                id: chunk.id,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: chunk.model,
                sessionId: conversation._id,
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
                      content: null,
                      tool_calls: [toolCall],
                    },
                    finish_reason: 'tool_calls',
                  },
                ],
              })}\n\n`,
            );

            hasProcessedToolCall = true;
          } catch (error) {
            console.error('Error executing tool:', error);
            messagesToSend.push(
              toolsManager.createToolResponse(toolCall, `Error executing search: ${error.message}`),
            );
          }
        }
      }

      // Process the response
      const trimmedResponse = fullResponse.trim();

      if (!trimmedResponse && !hasProcessedToolCall) {
        console.warn('Empty response received from agent:', {
          agent: currentAgent.name,
          turn: currentTurn,
        });
        activeAgents.delete(currentAgent._id.toString());
        continue;
      }

      // Mark agent as inactive after providing their response
      activeAgents.delete(currentAgent._id.toString());

      if (
        trimmedResponse.toUpperCase() === 'NO_RESPONSE_NEEDED' ||
        trimmedResponse.toUpperCase() === 'TASK_COMPLETE' ||
        (lastResponses.has(currentAgent._id.toString()) &&
          lastResponses.get(currentAgent._id.toString()) === trimmedResponse)
      ) {
        // Agent already marked as inactive above
        continue;
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
        content: hasProcessedToolCall
          ? 'Processing your request...'
          : fullResponse || 'No response generated',
        agent: {
          id: currentAgent._id,
          name: currentAgent.name,
          icon: currentAgent.icon,
        },
      };
      conversation.messages.push(aiMessage);

      // Save after adding agent response
      await conversation.save();
      console.log('\n=== DEBUG: After Adding Agent Response ===');
      console.log('Agent:', currentAgent.name);
      console.log('Total messages after save:', conversation.messages.length);
      console.log('Last message:', conversation.messages[conversation.messages.length - 1]);

      lastResponses.set(currentAgent._id.toString(), trimmedResponse);

      // If we processed a tool call, continue the conversation
      if (hasProcessedToolCall) {
        // Create a new stream for the follow-up response
        const followUpStream = await openai.chat.completions.create({
          model,
          messages: messagesToSend,
          temperature: currentTurn > 0 ? Math.min(temperature + 0.2, 1.0) : temperature,
          max_tokens: Math.min(max_tokens, MAX_COMPLETION_TOKENS),
          top_p,
          frequency_penalty,
          presence_penalty,
          stop,
          stream: true,
        });

        // Reset state for follow-up response
        fullResponse = '';
        toolCall = null;
        toolCallArgs = '';
        hasProcessedToolCall = false;
        lastFinishReason = null;

        // Process follow-up response
        for await (const chunk of followUpStream) {
          const content = chunk.choices[0]?.delta?.content || '';
          const finishReason = chunk.choices[0]?.finish_reason;
          lastFinishReason = finishReason || lastFinishReason;

          if (content) {
            fullResponse += content;
            res.write(
              `data: ${JSON.stringify({
                id: chunk.id,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: chunk.model,
                sessionId: conversation._id,
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
        }

        // Add follow-up response to conversation
        if (fullResponse.trim()) {
          const followUpMessage = {
            role: 'assistant',
            content: fullResponse,
            agent: {
              id: currentAgent._id,
              name: currentAgent.name,
              icon: currentAgent.icon,
            },
          };
          conversation.messages.push(followUpMessage);
        }
      }

      // Send completion event
      res.write(
        `data: ${JSON.stringify({
          id: conversation._id,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model,
          sessionId: conversation._id,
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
              finish_reason: lastFinishReason,
            },
          ],
          usage: {
            prompt_tokens: countTokens(messagesToSend),
            completion_tokens: Math.ceil(fullResponse.length / 4),
            total_tokens: countTokens(messagesToSend) + Math.ceil(fullResponse.length / 4),
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
