import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getApiRoot() {
    return {
      name: 'AmericanHomes API',
      status: 'ok',
      version: process.env.npm_package_version ?? '0.1.0',
      docs: '/api/docs',
      health: '/api/health',
    };
  }
}
