import { app } from './app';
import { env } from './config/env';

const server = app.listen(env.PORT, () => {
  console.log(`=========================================`);
  console.log(` QuestAI Backend Service Running`);
  console.log(` Environment : ${env.NODE_ENV}`);
  console.log(` Port        : ${env.PORT}`);
  console.log(` HealthCheck : http://localhost:${env.PORT}/api/health`);
  console.log(` CORS Origin : ${env.FRONTEND_URL}`);
  console.log(`=========================================`);
});

// Graceful shutdown handling
function handleShutdown(signal: string) {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log('QuestAI HTTP server closed.');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('Forced shutdown due to timeout.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

