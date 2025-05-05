const { Configuration, OpenAIApi } = require("openai");

// Configure OpenAI API
const configuration = new Configuration({
    apiKey: "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", 
});
const openai = new OpenAIApi(configuration);

// Function to moderate and alter comments
async function moderateComment(comment) {
    try {
        
        const moderationResponse = await openai.createModeration({
            input: comment,
        });

        const flagged = moderationResponse.data.results[0].flagged;

        if (flagged) {
            // If flagged, rephrase the comment
            console.log("Comment flagged for moderation:", comment);
            const rephraseResponse = await openai.createCompletion({
                model: "text-davinci-003", // Use a GPT model
                prompt: `Rephrase the following comment to make it appropriate while retaining its original intent:\n\n"${comment}"`,
                max_tokens: 100,
                temperature: 0.7,
            });

            return rephraseResponse.data.choices[0].text.trim();
        } else {
            // If not flagged, return the original comment
            return comment;
        }
    } catch (error) {
        console.error("Error moderating comment:", error);
        return "An error occurred while processing the comment.";
    }
}

