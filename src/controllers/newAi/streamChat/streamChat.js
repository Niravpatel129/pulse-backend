import mongoose from 'mongoose';
import openai from '../../../config/openai.js';
import Agent from '../../../models/agentModel.js';
import AIConversation from '../../../models/AIConversation.js';
import ChatSettings from '../../../models/ChatSettings.js';
import { firebaseStorage } from '../../../utils/firebase.js';
import PromptManager from '../../../utils/PromptManager.js';
import ToolsManager from '../../../utils/ToolsManager.js';

const MAX_COMPLETION_TOKENS = 2000; // Maximum tokens for completion

// Helper function to process images
async function processImages(images, workspaceId) {
  const processedImages = [];
  for (const image of images) {
    if (image.url.startsWith('data:image')) {
      const base64Data = image.url.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      const storagePath = firebaseStorage.generatePath(workspaceId, `chat_image_${Date.now()}.png`);
      const { url } = await firebaseStorage.uploadFile(buffer, storagePath, 'image/png');
      processedImages.push({ url, alt: image.alt });
    } else if (image.url.startsWith('http')) {
      processedImages.push(image);
    } else {
      console.warn('Unsupported image URL format:', image.url);
    }
  }
  return processedImages;
}

// Helper function to get or create conversation
async function getOrCreateConversation(sessionId, workspaceId, message) {
  if (sessionId && mongoose.Types.ObjectId.isValid(sessionId)) {
    const conversation = await AIConversation.findOne({
      _id: sessionId,
      workspace: workspaceId,
    });
    if (conversation) return conversation;
  }

  let title = message?.trim() || 'Image Analysis';
  if (title.endsWith('?')) {
    title = title.substring(0, 50);
  } else {
    const words = title.split(' ');
    if (words.length > 5) {
      title = words.slice(0, 5).join(' ') + '...';
    }
  }

  return await AIConversation.create({
    workspace: workspaceId,
    messages: [],
    title: title,
  });
}

// Helper function to stream a message
function streamMessage(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// Helper function to handle tool calls
async function handleToolCall(toolCall, toolCallArgs, toolsManager, messagesToSend) {
  try {
    const searchResult = await toolsManager.executeTool(toolCall, toolCallArgs);
    messagesToSend.push({
      role: 'assistant',
      content: null,
      tool_calls: [toolCall],
    });
    messagesToSend.push({
      role: 'tool',
      tool_call_id: toolCall.id,
      content: JSON.stringify(searchResult),
    });
    return true;
  } catch (error) {
    console.error('Error executing tool:', error);
    messagesToSend.push({
      role: 'tool',
      tool_call_id: toolCall.id,
      content: `Error executing tool: ${error.message}`,
    });
    return false;
  }
}

// Main stream chat function
export const streamChat = async (req, res) => {
  try {
    const {
      message,
      sessionId,
      model = 'gpt-3.5-turbo-0125',
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

    // Validate input
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
        processedImages = await processImages(images, workspaceId);
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

    // Get selected agents
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

    // Use default agent if none specified
    if (selectedAgents.length === 0) {
      const allAgents = await Agent.find({ workspace: workspaceId });
      if (allAgents.length > 0) {
        selectedAgents.push(allAgents[0]);
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
    const conversation = await getOrCreateConversation(sessionId, workspaceId, message);

    // Add user message
    const userMessage = {
      role: 'user',
      content: message || '',
      images: processedImages.length > 0 ? processedImages : undefined,
    };
    conversation.messages.push(userMessage);
    conversation.lastActive = new Date();
    await conversation.save();

    // Set up streaming response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Use the first agent
    const currentAgent = selectedAgents[0];
    const promptManager = new PromptManager(currentAgent, 0, 1);
    let messagesToSend = [];

    // Add system message
    messagesToSend.push({
      role: 'system',
      content: promptManager.getFullPrompt(),
    });

    // Add conversation history
    const recentMessages = conversation.messages.slice(-10);
    const formattedMessages = recentMessages.map((msg) => {
      if (msg.images && msg.images.length > 0) {
        return {
          role: msg.role,
          content: [
            { type: 'text', text: msg.content || 'Please analyze this image.' },
            ...msg.images.map((img) => ({
              type: 'image_url',
              image_url: { url: img.url },
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

    // Create chat completion stream
    const stream = await openai.chat.completions.create({
      model: model,
      messages: messagesToSend,
      max_completion_tokens: Math.min(max_tokens, MAX_COMPLETION_TOKENS),
      top_p,
      frequency_penalty,
      presence_penalty,
      stop: stop || undefined,
      stream: true,
      tools: toolsManager.getTools(),
    });

    let fullResponse = '';
    let toolCall = null;
    let toolCallArgs = '';
    let hasProcessedToolCall = false;
    let lastFinishReason = null;
    let shouldSaveMessage = true; // Add flag to control message saving

    // Process stream
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      const toolCalls = chunk.choices[0]?.delta?.tool_calls || [];
      const finishReason = chunk.choices[0]?.finish_reason;
      lastFinishReason = finishReason || lastFinishReason;

      if (content) {
        fullResponse += content;
        streamMessage(res, {
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
          choices: [
            {
              index: 0,
              delta: { content },
              finish_reason: null,
            },
          ],
        });
      }

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

      if (finishReason === 'tool_calls' && toolCall && !hasProcessedToolCall) {
        const success = await handleToolCall(toolCall, toolCallArgs, toolsManager, messagesToSend);
        if (!success) {
          streamMessage(res, {
            error: {
              message: 'Error executing tool',
              type: 'server_error',
              code: 'tool_execution_error',
            },
          });
          res.end();
          return;
        }

        streamMessage(res, {
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
        });

        hasProcessedToolCall = true;
        shouldSaveMessage = false; // Don't save the initial tool call message

        // Create follow-up stream
        try {
          const followUpStream = await openai.chat.completions.create({
            model: model,
            messages: messagesToSend,
            max_completion_tokens: Math.min(max_tokens, MAX_COMPLETION_TOKENS),
            top_p,
            frequency_penalty,
            presence_penalty,
            stop,
            stream: true,
            tools: toolsManager.getTools(),
          });

          fullResponse = '';
          toolCall = null;
          toolCallArgs = '';
          hasProcessedToolCall = false;
          lastFinishReason = null;
          shouldSaveMessage = true; // Enable saving for the follow-up response

          for await (const followUpChunk of followUpStream) {
            const content = followUpChunk.choices[0]?.delta?.content || '';
            const finishReason = followUpChunk.choices[0]?.finish_reason;
            lastFinishReason = finishReason || lastFinishReason;

            if (content) {
              fullResponse += content;
              streamMessage(res, {
                id: followUpChunk.id,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: followUpChunk.model,
                sessionId: conversation._id,
                agent: {
                  id: currentAgent._id,
                  name: currentAgent.name,
                  icon: currentAgent.icon,
                },
                choices: [
                  {
                    index: 0,
                    delta: { content },
                    finish_reason: null,
                  },
                ],
              });
            }

            if (finishReason === 'stop') {
              streamMessage(res, {
                id: followUpChunk.id,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: followUpChunk.model,
                sessionId: conversation._id,
                agent: {
                  id: currentAgent._id,
                  name: currentAgent.name,
                  icon: currentAgent.icon,
                },
                choices: [
                  {
                    index: 0,
                    message: {
                      role: 'assistant',
                      content: fullResponse,
                    },
                    finish_reason: 'stop',
                  },
                ],
              });

              // Save the message only if we should
              if (shouldSaveMessage && fullResponse.trim()) {
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
                conversation.lastActive = new Date();
                await conversation.save();
              }
              break;
            }
          }
        } catch (followUpError) {
          console.error('Error in follow-up stream:', followUpError);
          streamMessage(res, {
            error: {
              message: 'Error processing follow-up response: ' + followUpError.message,
              type: 'server_error',
              code: 'follow_up_error',
            },
          });
          res.end();
          return;
        }
      }
    }

    const trimmedResponse = fullResponse.trim();

    if (!trimmedResponse && !hasProcessedToolCall) {
      console.warn('Empty response received from agent:', {
        agent: currentAgent.name,
      });
      res.end();
      return;
    }

    // If no tool call was processed, save the direct response
    if (!hasProcessedToolCall && shouldSaveMessage && trimmedResponse) {
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
      conversation.lastActive = new Date();
      await conversation.save();
    }

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
      streamMessage(res, {
        error: {
          message: error.message,
          type: 'server_error',
          code: 'internal_error',
        },
      });
      res.end();
    }
  }
};
