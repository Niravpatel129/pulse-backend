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
      console.log('\n=== DEBUG: Created New Conversation ===');
      console.log('Title:', title);
    }

    // Add user message
    const userMessage = {
      role: 'user',
      content: message,
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
    let agentChain = [];

    // Create a chain of agents based on their roles and capabilities
    if (selectedAgents.length > 0) {
      agentChain = selectedAgents.sort((a, b) => {
        const roleOrder = { primary: 0, secondary: 1, specialist: 2 };
        return (roleOrder[a.role] || 0) - (roleOrder[b.role] || 0);
      });
    }

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
      // Get current agent from the chain
      const currentAgent = agentChain[currentAgentIndex];

      if (!activeAgents.has(currentAgent._id.toString())) {
        // Move to next agent if current one is inactive
        currentAgentIndex = (currentAgentIndex + 1) % agentChain.length;
        continue;
      }

      // Create prompt manager for current agent with chain context
      const promptManager = new PromptManager(currentAgent, currentTurn, MAX_AGENT_TURNS);

      // Add chain context to the system message
      const chainContext = {
        role: 'system',
        content: `You are part of a collaborative AI chain. ${
          agentChain.length > 1
            ? `Other agents in the chain are: ${agentChain
                .filter((a) => a._id.toString() !== currentAgent._id.toString())
                .map((a) => `${a.name} (${a.role || 'general'})`)
                .join(', ')}. `
            : ''
        } 
          Based on the conversation context and your role, decide if you should respond and how to collaborate with other agents.
          If you need input from another agent, use AGENT_QUERY or AGENT_COLLABORATE.
          If you think another agent would be better suited to respond, use AGENT_TRANSFER.
          If you think the conversation is complete, use CONVERSATION_END.`,
      };

      // Prepare messages for the API call
      let messagesToSend = [chainContext];

      // Add system message
      const systemMessage = {
        role: 'system',
        content: promptManager.getFullPrompt(),
      };
      messagesToSend.push(systemMessage);

      // Add conversation history
      const recentMessages = conversation.messages.slice(-10);
      messagesToSend.push(...recentMessages);

      // Check token count and manage context window
      let totalTokens = countTokens(messagesToSend);
      if (totalTokens > MAX_CONTEXT_TOKENS) {
        const systemMessages = messagesToSend.slice(0, 2); // Keep chain context and system message
        const lastMessages = messagesToSend.slice(-2);
        const messagesToSummarize = messagesToSend.slice(2, -2);
        const summary = await summarizeMessages(messagesToSummarize);
        messagesToSend = [
          ...systemMessages,
          { role: 'system', content: `Previous conversation summary: ${summary}` },
          ...lastMessages,
        ];
      }

      // Create the chat completion stream
      const stream = await openai.chat.completions.create({
        model,
        messages: messagesToSend,
        temperature: currentTurn > 0 ? Math.min(temperature + 0.2, 1.0) : temperature,
        max_tokens: Math.min(max_tokens, MAX_COMPLETION_TOKENS),
        top_p,
        frequency_penalty,
        presence_penalty,
        stop,
        stream: true,
        tools: toolsManager.getTools(),
      });

      // Process stream and handle responses
      let fullResponse = '';
      let toolCall = null;
      let toolCallArgs = '';
      let hasProcessedToolCall = false;
      let lastFinishReason = null;

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        const toolCalls = chunk.choices[0]?.delta?.tool_calls || [];
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

        // Handle tool calls and agent coordination
        if (
          toolCalls.length > 0 ||
          fullResponse.includes('AGENT_QUERY:') ||
          fullResponse.includes('AGENT_COLLABORATE:') ||
          fullResponse.includes('AGENT_TRANSFER:') ||
          fullResponse.includes('CONVERSATION_END:')
        ) {
          // Process tool calls
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

          // Process agent coordination
          const agentTransferMatch = fullResponse.match(/AGENT_TRANSFER:\s*(\w+):\s*(.*)/i);
          const collaborationMatch = fullResponse.match(
            /(?:AGENT_QUERY|AGENT_COLLABORATE):\s*(\w+):\s*(.*)/i,
          );
          const conversationEndMatch = fullResponse.match(/CONVERSATION_END:\s*(.*)/i);

          if (agentTransferMatch) {
            const [_, targetAgentName, reason] = agentTransferMatch;
            const targetAgent = agentChain.find(
              (a) => a.name.toLowerCase() === targetAgentName.toLowerCase(),
            );

            if (targetAgent && activeAgents.has(targetAgent._id.toString())) {
              // Transfer to the target agent
              currentAgentIndex = agentChain.findIndex((a) => a._id.equals(targetAgent._id));

              // Add the transfer context
              const transferMessage = {
                role: 'system',
                content: `Previous agent transferred to ${targetAgentName} because: ${reason}`,
              };
              messagesToSend = [transferMessage, ...messagesToSend];
            }
          } else if (collaborationMatch) {
            const [_, targetAgentName, query] = collaborationMatch;
            const targetAgent = agentChain.find(
              (a) => a.name.toLowerCase() === targetAgentName.toLowerCase(),
            );

            if (targetAgent && activeAgents.has(targetAgent._id.toString())) {
              // Move to the target agent in the next turn
              currentAgentIndex = agentChain.findIndex((a) => a._id.equals(targetAgent._id));

              // Add the collaboration request to the conversation context
              const collaborationMessage = {
                role: 'system',
                content: `Previous agent requested ${
                  fullResponse.includes('AGENT_QUERY:') ? 'input' : 'collaboration'
                } from ${targetAgentName}: ${query}`,
              };
              messagesToSend = [collaborationMessage, ...messagesToSend];
            }
          } else if (conversationEndMatch) {
            const [_, endMessage] = conversationEndMatch;
            // End the conversation
            activeAgents.clear();
            const endSystemMessage = {
              role: 'system',
              content: `Conversation ended by ${currentAgent.name}: ${endMessage}`,
            };
            messagesToSend = [endSystemMessage, ...messagesToSend];
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

      // Add AI response to conversation
      const aiMessage = {
        role: 'assistant',
        content: hasProcessedToolCall ? 'Processing your request...' : fullResponse,
        agent: {
          id: currentAgent._id,
          name: currentAgent.name,
          icon: currentAgent.icon,
        },
      };
      conversation.messages.push(aiMessage);

      // Save after adding agent response
      await conversation.save();

      // Move to next agent in chain
      currentAgentIndex = (currentAgentIndex + 1) % agentChain.length;
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
