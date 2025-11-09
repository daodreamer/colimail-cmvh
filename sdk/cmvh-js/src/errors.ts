/**
 * CMVH Error Classes
 */

export class CMVHError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CMVHError";
  }
}

export class CMVHValidationError extends CMVHError {
  constructor(message: string) {
    super(message);
    this.name = "CMVHValidationError";
  }
}

export class CMVHSignatureError extends CMVHError {
  constructor(message: string) {
    super(message);
    this.name = "CMVHSignatureError";
  }
}

export class CMVHParseError extends CMVHError {
  constructor(message: string) {
    super(message);
    this.name = "CMVHParseError";
  }
}
