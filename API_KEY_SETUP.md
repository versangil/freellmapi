# API Key Setup Instructions

To use FreeLLMAPI with free models, you need to add API keys for at least one provider. Here's how to get started:

## Option 1: OpenRouter (Recommended for beginners)
1. Sign up at https://openrouter.ai
2. Go to https://openrouter.ai/settings/keys
3. Create a new API key
4. Copy the key (starts with `sk-or-...`)

## Option 2: Other Free Providers
You can also get free API keys from:
- Google Gemini: https://aistudio.google.com/app/apikey
- Groq: https://console.groq.com/keys
- Cerebras: https://cloud.cerebras.ai/
- And others listed in the README

## Adding Keys to FreeLLMAPI
1. Make sure the FreeLLMAPI server is running (it is on http://localhost:3001)
2. Open your browser to http://localhost:3001
3. Click "Sign up" to create an admin account
4. Go to the "Keys" page
5. Add your provider API keys
6. Reorder the fallback chain as desired
7. Your unified API key will appear in the page header (starts with `freellmapi-...`)
8. Use this unified key with any OpenAI-compatible client

## Example Usage
Once you have your unified key:
```bash
curl http://localhost:3001/v1/chat/completions \
  -H "Authorization: Bearer freellmapi-your-unified-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "auto",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

## Notes
- Free tiers have rate limits; the router will automatically fall back when limits are reached
- Keep your `.env` file safe as it contains the encryption key for your stored provider keys