import app from './app';
import { env } from './config/env';
import { connectDB } from './config/database';

async function bootstrap() {
  await connectDB();

  const server = app.listen(Number(env.PORT), () => {
    console.log(`🚀 AI Hotel Agent API running in ${env.NODE_ENV} mode on port ${env.PORT}`);
    console.log(`👉 Health check: http://localhost:${env.PORT}/api/v1/health`);
  });

  process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
      console.log('HTTP server closed');
    });
  });
}

bootstrap();
