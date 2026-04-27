import { Module } from "@nestjs/common";
import { TemporaryHeaderRequestContextMiddleware } from "./request-context.middleware";
import { RequestContextService } from "./request-context.service";

@Module({
  providers: [RequestContextService, TemporaryHeaderRequestContextMiddleware],
  exports: [RequestContextService, TemporaryHeaderRequestContextMiddleware]
})
export class RequestContextModule {}
