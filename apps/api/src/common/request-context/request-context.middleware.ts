import { Injectable, type NestMiddleware } from "@nestjs/common";
import { RequestContextService } from "./request-context.service";

type HeaderCarrier = { headers: Record<string, string | string[] | undefined> };

@Injectable()
export class TemporaryHeaderRequestContextMiddleware implements NestMiddleware {
  constructor(private readonly contextService: RequestContextService) {}

  use(request: HeaderCarrier, _response: unknown, next: () => void): void {
    const context = this.contextService.fromTemporaryHeaders(request.headers);
    this.contextService.run(context, next);
  }
}
