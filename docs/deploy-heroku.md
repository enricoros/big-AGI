# Heroku Deployment Guide

## Required Environment Variables

### Database
- POSTGRES_PRISMA_URL: Postgres connection string
- POSTGRES_URL_NON_POOLING: Non-pooling Postgres connection string
- MDB_URI: MongoDB connection string (optional)

### LLM Providers
- OPENAI_API_KEY: OpenAI API key
- ANTHROPIC_API_KEY: Anthropic API key
- DEEPSEEK_API_KEY: DeepSeek API key
- GEMINI_API_KEY: Google Gemini API key
- OPENPIPE_API_KEY: OpenPipe API key
- PERPLEXITY_API_KEY: Perplexity API key

### Authentication
- HTTP_BASIC_AUTH_USERNAME: Basic auth username
- HTTP_BASIC_AUTH_PASSWORD: Basic auth password

### Optional Services
- HELICONE_API_KEY: Helicone observability key
- GOOGLE_CLOUD_API_KEY: Google Cloud API key
- GOOGLE_CSE_ID: Google Custom Search ID
- ELEVENLABS_API_KEY: ElevenLabs API key
- PRODIA_API_KEY: Prodia API key

## Deployment Steps

1. Create a new Heroku app
2. Add Postgres add-on
3. Set environment variables in Heroku dashboard
4. Deploy using Heroku CLI:
```bash
heroku container:login
heroku container:push web
heroku container:release web
```
5. Run database migrations:
```bash
heroku run npm run db:push
