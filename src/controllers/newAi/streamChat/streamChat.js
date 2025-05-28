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

// Helper function to stream status/reasoning content
function streamStatus(res, message, { type = 'reasoning', step = null } = {}, conversation = null) {
  const statusMessage = {
    type,
    step,
    content: message,
    timestamp: Date.now(),
  };
  streamMessage(res, statusMessage);

  // Save status message to conversation if it's a reasoning or action
  if (conversation && (type === 'reasoning' || type === 'action')) {
    const currentMessage = conversation.messages[conversation.messages.length - 1];
    if (currentMessage && currentMessage.role === 'assistant') {
      currentMessage.parts.push(statusMessage);
      conversation.save();
    }
  }
}

// Helper function to handle tool calls
async function handleToolCall(toolCall, toolCallArgs, toolsManager, messagesToSend, conversation) {
  try {
    // Validate and parse tool call arguments
    let parsedArgs;
    try {
      // Check if we have multiple JSON objects concatenated
      if (toolCallArgs.includes('}{')) {
        // Split into individual JSON objects and parse each one
        const jsonObjects = toolCallArgs.split('}{').map((obj, index) => {
          // Add back the braces that were split
          if (index === 0) return obj + '}';
          if (index === toolCallArgs.split('}{').length - 1) return '{' + obj;
          return '{' + obj + '}';
        });

        // Parse each JSON object
        parsedArgs = jsonObjects.map((obj) => JSON.parse(obj));
      } else {
        parsedArgs = JSON.parse(toolCallArgs);
      }
    } catch (parseError) {
      console.error('JSON parsing error in tool call arguments:', {
        error: parseError.message,
        position: parseError.message.match(/position (\d+)/)?.[1],
        arguments: toolCallArgs,
        toolName: toolCall.function?.name,
      });
      throw new Error(`Invalid JSON in tool arguments: ${parseError.message}`);
    }

    const searchResult = await toolsManager.executeTool(toolCall, parsedArgs);

    // Ensure searchResult is properly stringified
    let searchResultContent;
    try {
      searchResultContent =
        typeof searchResult === 'string' ? searchResult : JSON.stringify(searchResult);
    } catch (stringifyError) {
      console.error('Error stringifying search result:', {
        error: stringifyError.message,
        result: searchResult,
        toolName: toolCall.function?.name,
      });
      throw new Error(`Failed to stringify search result: ${stringifyError.message}`);
    }

    messagesToSend.push({
      role: 'assistant',
      content: null,
      tool_calls: [toolCall],
    });
    messagesToSend.push({
      role: 'tool',
      tool_call_id: toolCall.id,
      content: searchResultContent,
    });

    // Save tool call to conversation using findOneAndUpdate
    const currentMessage = conversation.messages[conversation.messages.length - 1];
    if (currentMessage && currentMessage.role === 'assistant') {
      currentMessage.parts.push({
        type: 'tool_call',
        content: JSON.stringify(toolCall),
        step: toolCall.function?.name,
        timestamp: new Date(),
      });
      await AIConversation.findOneAndUpdate(
        { _id: conversation._id },
        { $set: { messages: conversation.messages } },
        { new: true },
      );
    }

    return true;
  } catch (error) {
    console.error('Error executing tool:', {
      error: error.message,
      toolName: toolCall.function?.name,
      arguments: toolCallArgs,
      stack: error.stack,
    });
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
  // Set up streaming response headers once at the start
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

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
      streamMessage(res, {
        type: 'error',
        error: {
          message: 'Message or images are required',
          type: 'invalid_request_error',
          code: 'missing_message',
        },
      });
      return res.end();
    }

    // Process images if present
    let processedImages = [];
    if (images.length > 0) {
      try {
        streamStatus(res, 'Processing images...', { type: 'status', step: 'image_processing' });
        processedImages = await processImages(images, workspaceId);
      } catch (error) {
        console.error('Error processing images:', error);
        streamMessage(res, {
          type: 'error',
          error: {
            message: 'Failed to process images',
            type: 'server_error',
            code: 'image_processing_error',
          },
        });
        return res.end();
      }
    }

    // Get workspace chat settings
    const chatSettings = await ChatSettings.findOne({ workspace: workspaceId });

    // Get selected agents
    streamStatus(res, 'Loading agent configuration...', { type: 'status', step: 'agent_setup' });
    const selectedAgents = await Agent.find({
      _id: { $in: agents },
      workspace: workspaceId,
    });

    if (agents.length > 0 && selectedAgents.length === 0) {
      streamMessage(res, {
        type: 'error',
        error: {
          message: 'No valid agents found',
          type: 'invalid_request_error',
          code: 'invalid_agents',
        },
      });
      return res.end();
    }

    // Use default agent if none specified
    if (selectedAgents.length === 0) {
      const allAgents = await Agent.find({ workspace: workspaceId });
      if (allAgents.length > 0) {
        selectedAgents.push(allAgents[0]);
      } else {
        streamMessage(res, {
          type: 'error',
          error: {
            message: 'No agents available',
            type: 'invalid_request_error',
            code: 'no_agents',
          },
        });
        return res.end();
      }
    }

    // Get or create conversation
    const conversation = await getOrCreateConversation(sessionId, workspaceId, message);

    // Add user message
    const userMessage = {
      role: 'user',
      parts: [
        {
          type: 'text',
          content: message || '',
          timestamp: new Date(),
        },
      ],
      images: processedImages.length > 0 ? processedImages : undefined,
    };
    conversation.messages.push(userMessage);
    conversation.lastActive = new Date();
    await conversation.save();

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
      // For messages with images
      if (msg.images && msg.images.length > 0) {
        return {
          role: msg.role,
          content: [
            { type: 'text', text: msg.parts?.[0]?.content || 'Please analyze this image.' },
            ...msg.images.map((img) => ({
              type: 'image_url',
              image_url: { url: img.url },
            })),
          ],
        };
      }

      // For regular messages, use the first text part or empty string
      return {
        role: msg.role,
        content: msg.parts?.find((part) => part.type === 'text')?.content || '',
      };
    });

    // Filter out any messages with empty content
    const validMessages = formattedMessages.filter((msg) => msg.content !== '');

    messagesToSend.push(...validMessages);

    // Now we can pass conversation to streamStatus since it's created
    streamStatus(res, 'Thinking...', { type: 'reasoning' }, conversation);

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

    // Create initial assistant message
    const assistantMessage = {
      role: 'assistant',
      parts: [],
      agent: {
        id: currentAgent._id,
        name: currentAgent.name,
        icon: currentAgent.icon,
      },
      timestamp: new Date(),
    };
    conversation.messages.push(assistantMessage);
    await conversation.save();
    const assistantMsgIdx = conversation.messages.length - 1;

    // Helper function to save assistant part
    const saveAssistantPart = async (part) => {
      // Ensure we have a text part for the main content
      if (part.type === 'text') {
        const existingTextPart = conversation.messages[assistantMsgIdx].parts.find(
          (p) => p.type === 'text',
        );
        if (existingTextPart) {
          existingTextPart.content += part.content;
        } else {
          conversation.messages[assistantMsgIdx].parts.push(part);
        }
      } else {
        conversation.messages[assistantMsgIdx].parts.push(part);
      }

      conversation.markModified('messages');

      // Use findOneAndUpdate instead of save to avoid parallel save issues
      const updatedConversation = await AIConversation.findOneAndUpdate(
        { _id: conversation._id },
        { $set: { messages: conversation.messages } },
        { new: true },
      );

      // Update our local conversation object with the latest data
      Object.assign(conversation, updatedConversation);
    };

    // Helper function to stream and save part
    const streamAndSavePart = async (part) => {
      const partWithTimestamp = {
        ...part,
        timestamp: new Date(),
      };
      streamMessage(res, {
        ...partWithTimestamp,
        conversationId: conversation._id,
      });
      await saveAssistantPart(partWithTimestamp);
    };

    let fullResponse = '';
    let toolCall = null;
    let toolCallArgs = '';
    let hasProcessedToolCall = false;
    let lastFinishReason = null;
    let finalResponse = null;

    // Process stream
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      const toolCalls = chunk.choices[0]?.delta?.tool_calls || [];
      const finishReason = chunk.choices[0]?.finish_reason;
      lastFinishReason = finishReason || lastFinishReason;

      if (content) {
        fullResponse += content;

        // Stream and save text content
        await streamAndSavePart({
          type: 'text',
          content: content,
        });

        streamMessage(res, {
          type: 'text',
          id: chunk.id,
          choices: [
            {
              index: 0,
              delta: { content },
              finish_reason: null,
            },
          ],
          conversationId: conversation._id,
        });
      }

      if (toolCalls.length > 0 && !hasProcessedToolCall) {
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

          // Stream and save tool call as a part
          await streamAndSavePart({
            type: 'tool_call',
            content: JSON.stringify(toolCall),
            step: currentToolCall.function.name,
          });

          // Stream status
          await streamAndSavePart({
            type: 'action',
            content: `Running action: ${currentToolCall.function.name}`,
            step: currentToolCall.function.name,
          });
        }
        if (currentToolCall.function?.arguments) {
          toolCallArgs += currentToolCall.function.arguments;
          // Update the toolCall object with accumulated arguments
          toolCall.function.arguments = toolCallArgs;
        }
      }

      if (finishReason === 'tool_calls' && toolCall && !hasProcessedToolCall) {
        await streamAndSavePart({
          type: 'status',
          content: 'Waiting for external tool result...',
          step: toolCall.function?.name,
        });

        const success = await handleToolCall(
          toolCall,
          toolCallArgs,
          toolsManager,
          messagesToSend,
          conversation,
        );
        if (!success) {
          await streamAndSavePart({
            type: 'status',
            content: 'Error executing tool',
            step: toolCall.function?.name,
          });
          streamMessage(res, {
            type: 'error',
            error: {
              message: 'Error executing tool',
              type: 'server_error',
              code: 'tool_execution_error',
            },
            conversationId: conversation._id,
          });
          return res.end();
        }

        await streamAndSavePart({
          type: 'status',
          content: `Tool execution result: ${JSON.stringify(toolCall)}`,
          step: toolCall.function?.name,
        });

        streamMessage(res, {
          type: 'status',
          id: chunk.id,
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
          conversationId: conversation._id,
        });

        hasProcessedToolCall = true;

        // Create follow-up stream
        try {
          await streamAndSavePart({
            type: 'reasoning',
            content: 'Processing tool results...',
          });

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

          for await (const followUpChunk of followUpStream) {
            const content = followUpChunk.choices[0]?.delta?.content || '';
            const finishReason = followUpChunk.choices[0]?.finish_reason;
            lastFinishReason = finishReason || lastFinishReason;

            if (content) {
              fullResponse += content;

              // Stream and save text content
              await streamAndSavePart({
                type: 'text',
                content: content,
              });

              streamMessage(res, {
                type: 'text',
                id: followUpChunk.id,
                choices: [
                  {
                    index: 0,
                    delta: { content },
                    finish_reason: null,
                  },
                ],
                conversationId: conversation._id,
              });
            }

            if (finishReason === 'stop') {
              await streamAndSavePart({
                type: 'status',
                content: 'Response complete',
              });

              // Ensure the final response is saved
              await streamAndSavePart({
                type: 'text',
                content: fullResponse,
              });

              streamMessage(res, {
                type: 'status',
                id: followUpChunk.id,
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
                conversationId: conversation._id,
              });

              finalResponse = fullResponse;
              break;
            }
          }

          // Send final response if we have one
          if (finalResponse) {
            streamMessage(res, {
              type: 'text',
              content: finalResponse,
              conversationId: conversation._id,
            });
          }
        } catch (followUpError) {
          console.error('Error in follow-up stream:', followUpError);
          await streamAndSavePart({
            type: 'status',
            content: 'Error processing follow-up response: ' + followUpError.message,
            step: toolCall?.function?.name,
          });
          streamMessage(res, {
            type: 'error',
            error: {
              message: 'Error processing follow-up response: ' + followUpError.message,
              type: 'server_error',
              code: 'follow_up_error',
            },
            conversationId: conversation._id,
          });
          return res.end();
        }
      }
    }

    const trimmedResponse = fullResponse.trim();

    if (!trimmedResponse && !hasProcessedToolCall) {
      console.warn('Empty response received from agent:', {
        agent: currentAgent.name,
      });
      return res.end();
    }

    // Final save of the conversation
    await AIConversation.findOneAndUpdate(
      { _id: conversation._id },
      {
        $set: {
          lastActive: new Date(),
          messages: conversation.messages,
        },
      },
      { new: true },
    );

    res.end();
  } catch (error) {
    console.error('Error in streaming chat endpoint:', error);
    streamMessage(res, {
      type: 'error',
      error: {
        message: error.message,
        type: 'server_error',
        code: 'internal_error',
      },
    });
    res.end();
  }
};
