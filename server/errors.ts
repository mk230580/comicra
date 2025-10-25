export class ServiceUnavailableError extends Error {
  statusCode = 503;
  constructor(message: string) {
    super(message);
    this.name = 'ServiceUnavailableError';
  }
}

export class BadRequestError extends Error {
  statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = 'BadRequestError';
  }
}

export class UpstreamServiceError extends Error {
  statusCode = 502;
  constructor(message: string) {
    super(message);
    this.name = 'UpstreamServiceError';
  }
}
