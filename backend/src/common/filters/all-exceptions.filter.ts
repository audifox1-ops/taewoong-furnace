import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '서버 내부 오류가 발생했습니다';
    let code = 'INTERNAL_ERROR';
    let details: any = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exResponse = exception.getResponse();

      if (typeof exResponse === 'string') {
        message = exResponse;
      } else if (typeof exResponse === 'object' && exResponse !== null) {
        const res = exResponse as any;
        message = res.message || message;
        code = res.error || this.getStatusText(status);
        details = res.details || (Array.isArray(res.message) ? res.message : undefined);
        if (Array.isArray(message)) {
          details = message;
          message = '요청 데이터 검증에 실패했습니다';
        }
      }

      code = code || this.getStatusText(status);
    } else if (exception instanceof Error) {
      message = exception.message || message;
      this.logger.error(`${request.method} ${request.url}`, exception.stack);
    }

    const errorResponse: ApiResponse = {
      success: false,
      error: {
        code,
        message: Array.isArray(message) ? message.join(', ') : message,
        details,
      },
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(errorResponse);
  }

  private getStatusText(status: number): string {
    const texts: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_ERROR',
    };
    return texts[status] || 'ERROR';
  }
}
