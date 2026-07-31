export class ProviderError extends Error {}


export class SecretNotFoundError extends ProviderError {}


export class ProviderCommandError extends ProviderError {
  constructor(command, result) {
    super(`${command} could not retrieve the requested secret`);
    this.command = command;
    this.status = result.status;
    this.stderr = result.stderr ?? "";
    this.cause = result.error;
  }
}
