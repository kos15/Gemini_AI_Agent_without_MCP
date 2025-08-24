import { GoogleGenerativeAI } from "@google/generative-ai";

// ========== Setup Gemini Client ==========
const API_KEY = 'YOUR_GEMINI_API_KEY'; // put your Gemini API key in env
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// ========== Function Registry ==========
const functionRegistry = {
    getTime: () => {
        return { time: new Date().toISOString() };
    },
    addNumbers: ({ a, b }) => {
        return { result: `${a + b} from function` };
    },
    echo: ({ message }) => {
        return { echoed: message };
    }
};

// Helper: Call functions safely
async function executeFunction(name, input) {
    if (functionRegistry[name]) {
        return Object.keys(input).length ? functionRegistry[name](input): functionRegistry[name]();
    }
    return { error: `Function ${name} not found` };
}

// Cleaner function to generate JSON with the response of gemini 
function extractJsonObjects(text) {
  text = text.replace(/```json/,'');
  text = text.replace(/```/,'');
  return JSON.parse(text);
}

// ========== AI Agent Loop ==========
async function aiLoop(initialGoal) {
    let state = {
        stage: "start",
        goal: initialGoal,
        history: []
    };

    let steps = 0;
    while (true) {  
        console.log(`\n--- Step ${steps + 1} | Stage: ${state.stage} ---`);

        // AI Prompt: Describe the loop stage
        const response = await model.generateContent({
            contents: [
                {
                    role: "user",
                    parts: [
                        {
                            text: JSON.stringify({
                                instruction: `
                        You are a helpfull AI Assistant who is designed to resolve user query.
                        You work on START, THINK, ACTION, OBSERVE and OUTPUT Mode.
                        In the start phase, user gives a query to you.
                        Then, you THINK how to resolve that query at least 3-4 times and make sure that If there is a need to call a tool, you call an ACTION event with tool and input If there is an action call, wait for the OBSERVE that is output of the tool.
                        Based on the OBSERVE from prev step, you either output or repeat the loop.
                        Always return valid JSON with keys: {stage, thought, functionCall?, output?}
                        output should be strictly only in JSON format.
                        NEVER RETURN ANYTHING OTHER THAN JSON.
                        NEVER RETURN MARKDOWN.
                        Available Tools: ${Object.keys(functionRegistry).join(", ")}
                        Example:
                            START: What is 5 + 8?
                            THINK: The user is asking for the addition of 5 + 8.
                            THINK: From the available tools, I must call addNumbers tool for inputs 5 and 8.
                            ACTION: Call Tool addNumbers with inputs {a:5, b:8}
                            OBSERVE: The output of addNumbers is 13
                            OUTPUT: The result of 5 + 8 is 13.

                        Output Example:
                            {"role": "user", "content": "What is 5 + 8?" }
                            {"step": "think": "content": "The user is asking for the addition of 5 + 8."}
                            {"step": "think": "content": "From the available tools, I must call addNumbers"}
                            {"step": "action": "tool": "addNumbers", "input": {a:5, b:8} }
                            {"step": "observe": "content": "13" }
                            {"step": "think": "content": "The output of 5 + 8 is 13"}
                            { "step": "output": "content": "Hey, The Addition of 5 + 8 is 13 "}

                        NOTE: For each reply, only respond with the next single step in JSON format (without markdown). Do NOT return all steps at once. After each response, WAIT for further information before replying again.
                        Example output: 
                            {"stage": "think", "thought": "I should use addNumbers with 5 and 7"}
                        Do NOT include multiple stages OR markdown code fences. Only one step per output.

                    `,
                                currentStage: state.stage,
                                goal: state.goal,
                                history: state.history,
                                format: "Always return valid JSON with keys: {stage, thought, functionCall?, output?}"
                            })
                        }
                    ]
                }
            ]
        });

        // Parse AI JSON
        let aiOutput;
        try {
            aiOutput = extractJsonObjects(response.response.candidates[0].content.parts[0].text);
        } catch (err) {
            console.error("Failed to parse AI JSON:", err);
            break;
        }

        console.log("🤖 AI Output:", aiOutput);

        // If AI wants to call a function
        if (aiOutput?.functionCall) {
            const { tool, input } = aiOutput.functionCall;
            console.log(`🔧 Calling function: ${tool} with input:`, input);
            const functionResult = await executeFunction(tool, input);
            console.log("🛠️ Function result:", functionResult);
            state.history.push({ stage: state.stage, thought: aiOutput.thought, action: { tool, input, result: functionResult } });
            state.stage = "observe";
            state.goal = functionResult;
        } else {
            // Just output result
            state.history.push({ stage: state.stage, thought: aiOutput.thought, output: aiOutput.output });
            state.stage = aiOutput.stage || "output";
        }

        steps++;
    }

    console.log("\n✅ Final Agent Output:");
    console.dir(state.history, { depth: null });
}

// ========== Run Agent ==========
// Example: "Tell me current time and add 5 + 7"
aiLoop("Find current time and sum 5+7");
