const fs = require('fs');
const path = require('path');
const axios = require('axios'); // Assuming axios is available or using fetch if node 18+

const PROMPT_PATH = path.resolve(__dirname, '../../../infrastructure/prompts/canonicalContentPrompt.txt');

/**
 * Generates a lesson using the LLM.
 * @param {string} topic 
 * @param {string} subject 
 * @param {string} difficulty 
 * @returns {Promise<Object>} The generated lesson object.
 */
async function generateLesson(topic, subject, difficulty) {
    try {
        let promptTemplate;
        try {
            promptTemplate = fs.readFileSync(PROMPT_PATH, 'utf-8');
        } catch (err) {
            console.error('Failed to load prompt template:', err);
            throw new Error('Internal error: Could not load prompt.');
        }

        const prompt = promptTemplate
            .replace(/{{TOPIC}}/g, topic)
            .replace(/{{SUBJECT}}/g, subject)
            .replace(/{{DIFFICULTY}}/g, difficulty);

        const apiKey = process.env.LLM_API_KEY;

        if (!apiKey) {
            console.warn('LLM_API_KEY not found. Using mock response.');
            return getMockLesson(topic, subject, difficulty);
        }

        // Call LLM API (Example using generic OpenAI-compatible endpoint)
        // Adjust logic based on actual provider
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: "gpt-3.5-turbo", // Or "gpt-4"
            messages: [
                { role: "system", content: "You are a helpful assistant that outputs strict JSON." },
                { role: "user", content: prompt }
            ],
            temperature: 0.2,
            max_tokens: 1500
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        const content = response.data.choices[0].message.content;

        // Attempt to parse JSON
        try {
            // Find JSON substring if there's extra text
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            const jsonString = jsonMatch ? jsonMatch[0] : content;
            return JSON.parse(jsonString);
        } catch (parseError) {
            console.error('JSON Parse Error:', parseError);
            console.error('Raw Output:', content);
            throw new Error('Failed to parse LLM response as JSON.');
        }

    } catch (error) {
        console.error('LLM Service Error:', error.message);
        throw error;
    }
}

function getMockLesson(topic, subject, difficulty) {
    return Promise.resolve({
        topic: topic,
        subject: subject,
        difficulty: difficulty,
        summary: `This is a mock summary for ${topic}. It is at least 50 characters long to pass validation.`,
        explanation: `This is a mock explanation for ${topic}. It needs to be at least 200 characters long. ` +
            `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ` +
            `Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.`,
        codeExample: {
            language: "javascript",
            code: "console.log('Hello Mock World');"
        },
        quiz: [
            { question: "Q1?", options: ["A", "B", "C", "D"], correctAnswer: "A" },
            { question: "Q2?", options: ["A", "B", "C", "D"], correctAnswer: "B" },
            { question: "Q3?", options: ["A", "B", "C", "D"], correctAnswer: "C" },
            { question: "Q4?", options: ["A", "B", "C", "D"], correctAnswer: "D" },
            { question: "Q5?", options: ["A", "B", "C", "D"], correctAnswer: "A" }
        ]
    });
}

module.exports = { generateLesson };
