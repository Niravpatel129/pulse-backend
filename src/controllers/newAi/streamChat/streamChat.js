import mongoose from 'mongoose';
import openai from '../../../config/openai.js';
import Agent from '../../../models/agentModel.js';
import AIConversation from '../../../models/AIConversation.js';
import ChatSettings from '../../../models/ChatSettings.js';
import { countTokens, MAX_CONTEXT_TOKENS, summarizeMessages } from '../../../utils/aiUtils.js';
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
    } = req.body;

    const workspaceId = req.workspace._id;
    const toolsManager = new ToolsManager();

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
        tools: toolsManager.getTools(),
      });

      // Stream each chunk for this agent
      let fullResponse = '';
      let toolCall = null;
      let toolCallArgs = '';
      let hasProcessedToolCall = false;
      let lastFinishReason = null;

      console.log('Starting stream for agent:', currentAgent.name);

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        const toolCalls = chunk.choices[0]?.delta?.tool_calls || [];
        const finishReason = chunk.choices[0]?.finish_reason;
        lastFinishReason = finishReason || lastFinishReason;

        console.log('Received chunk:', {
          content,
          toolCalls,
          finishReason,
          hasToolCall: !!toolCall,
          toolCallArgs,
          hasProcessedToolCall,
        });

        // Handle content
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
          const currentToolCall = toolCalls[0];
          console.log('Processing tool call:', currentToolCall);

          if (currentToolCall.function?.name) {
            toolCall = {
              id: currentToolCall.id,
              type: 'function',
              function: {
                name: currentToolCall.function.name,
                arguments: '',
              },
            };
            console.log('Initialized tool call:', toolCall);
          }

          if (currentToolCall.function?.arguments) {
            toolCallArgs += currentToolCall.function.arguments;
            console.log('Accumulated tool call args:', toolCallArgs);
          }
        }

        // Process tool call when finished
        if (finishReason === 'tool_calls' && toolCall && !hasProcessedToolCall) {
          console.log('Processing complete tool call:', {
            toolCall,
            toolCallArgs,
            finishReason,
          });

          try {
            const searchResult = await toolsManager.executeTool(toolCall, toolCallArgs);

            // Add the tool response to the conversation
            messagesToSend.push(toolsManager.createToolCallMessage(toolCall));
            messagesToSend.push(toolsManager.createToolResponse(toolCall, searchResult));

            // Stream the tool response
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
      console.log('Final response state:', {
        trimmedResponse,
        hasToolCall: !!toolCall,
        toolCallArgs,
        hasProcessedToolCall,
      });

      if (!trimmedResponse && !hasProcessedToolCall) {
        console.warn('Empty response received from agent:', {
          agent: currentAgent.name,
          turn: currentTurn,
        });
        activeAgents.delete(currentAgent._id.toString());
        continue;
      }

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
