export class AppError extends Error {
  public statusCode: number;
  public messageKey?: string | undefined;
  public errors?: any[] | undefined;

  constructor(
    statusCode: number,
    message: string,
    messageKey?: string,
    errors?: any[]
  ) {
    super(message);
    this.statusCode = statusCode;
    this.messageKey = messageKey;
    this.errors = errors;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}
