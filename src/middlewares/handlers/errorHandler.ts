export default class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly status: boolean,
    readonly message: string,
    readonly source?: Error
  ) {
    super();
  }
}

export class NotFoundError extends ApiError {
  constructor(readonly message: string = 'Not Found', source?: Error) {
    super(404, false, message, source);
  }
}

export class ForbiddenError extends ApiError {
  constructor(readonly message: string = 'Forbidden', source?: Error) {
    super(403, false, message, source);
  }
}

export class InternalServerError extends ApiError {
  constructor(readonly message: string = 'Internal Server Error', source?: Error) {
    super(500, false, message, source);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(readonly message: string = 'Unauthorized Request', source?: Error) {
    super(401, false, message, source);
  }
}

export class BadRequestError extends ApiError {
  constructor(readonly message: string = 'Bad Request', source?: Error) {
    super(400, false, message, source);
  }
}

export class ConflictError extends ApiError {
  constructor(readonly message: string = 'Bad Request', source?: Error) {
    super(409, false, message, source);
  }
}

export class UnprocessableEntityError extends ApiError {
  constructor(readonly message: string = 'Unprocessable Entity', source?: Error) {
    super(422, false, message, source);
  }
}

export class WebSocketError extends ApiError {
  constructor(
    public statusCode: number = 500,
    public message: string = 'Web Socket Error',
    public source?: Error
  ) {
    super(statusCode, false, message, source);
  }
}
